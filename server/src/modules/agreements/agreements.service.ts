import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  agreementTermsSchema,
  agreementFinalizationSchema,
} from "@music-city/shared";
import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import {
  canonicalProposal,
  amendVersion,
  applyResponse,
  cancelVersion,
  createResponseChallenge,
  createVersion,
  submitVersion,
  type ResponseChallenge,
} from "./agreement-domain.js";
import {
  agreementContext,
  agreementPermissions,
  visibleAgreementVersions,
  validateRegisteredRecipients,
} from "./agreement-views.js";
import {
  agreementsRepository,
  readVersion,
  recordEvent,
  writeVersion,
} from "./agreements.repository.js";

export const agreementsService = {
  list: agreementsRepository.list,
  async contributors(query: string) {
    const term = query.trim();
    if (term.length < 2 || term.length > 80) return [];
    return databaseService.transaction(async (client) => {
      const result = await client.query<{
        id: string;
        wallet_address: string;
        name: string;
      }>(
        `SELECT id,wallet_address,payload->>'displayName' AS name FROM users WHERE payload->>'onboardingStatus'='complete' AND (wallet_address=$1 OR strpos(lower(COALESCE(payload->>'displayName','')),lower($1))>0) ORDER BY CASE WHEN wallet_address=$1 THEN 0 ELSE 1 END,payload->>'displayName',id LIMIT 10`,
        [term],
      );
      return result.rows.map((r) => ({
        profileId: r.id,
        walletAddress: r.wallet_address,
        name: r.name || "Contributor",
      }));
    });
  },
  async forTrack(actor: string, trackId: string) {
    return databaseService.transaction(async (client) => {
      const track = await client.query(
        "SELECT t.id FROM tracks t JOIN users u ON u.id=t.artist_id WHERE t.id=$1 AND u.wallet_address=$2",
        [trackId, actor],
      );
      if (!track.rowCount) throw new HttpError(404, "Recording not found");
      const found = await client.query(
        "SELECT id FROM contributor_agreements WHERE track_id=$1",
        [trackId],
      );
      return (found.rows[0]?.id as string | undefined) ?? null;
    });
  },
  async create(actor: string, input: unknown) {
    const request = z
      .object({
        trackId: z.string().min(1),
        ...agreementTermsSchema.innerType().shape,
      })
      .strict()
      .parse(input);
    const terms = agreementTermsSchema.parse({
      recipients: request.recipients,
      terms: request.terms,
    });
    return databaseService.transaction(async (client) => {
      const track = await client.query(
        "SELECT t.id FROM tracks t JOIN users u ON u.id=t.artist_id WHERE t.id=$1 AND u.wallet_address=$2 FOR UPDATE OF t",
        [request.trackId, actor],
      );
      if (!track.rowCount)
        throw new HttpError(
          403,
          "Only the track owner can propose its royalty agreement",
        );
      const existing = await client.query(
        "SELECT id FROM contributor_agreements WHERE track_id=$1",
        [request.trackId],
      );
      if (existing.rowCount) {
        const current = await client.query<{
          payload: import("@music-city/shared").AgreementVersion;
        }>(
          "SELECT v.payload FROM contributor_agreements a JOIN agreement_versions v ON v.agreement_id=a.id AND v.version=a.current_version WHERE a.id=$1",
          [existing.rows[0].id],
        );
        const saved = current.rows[0]!.payload;
        if (
          saved.state === "draft" &&
          canonicalProposal({ ...saved.proposal, ...terms }).proposalHash ===
            saved.proposalHash
        )
          return saved;
        throw new HttpError(
          409,
          "This recording already has an agreement. Open it to continue",
        );
      }
      await validateRegisteredRecipients(
        client,
        terms.recipients.map((r) => r.walletAddress),
      );
      const release = await client.query(
        "SELECT r.id,u.wallet_address FROM release_tracks rt JOIN releases r ON r.id=rt.release_id JOIN users u ON u.id=r.artist_id WHERE rt.track_id=$1 FOR SHARE OF rt,r",
        [request.trackId],
      );
      if (release.rows[0] && release.rows[0].wallet_address !== actor)
        throw new HttpError(
          403,
          "Track release ownership does not match the agreement owner",
        );
      const id = randomUUID();
      const version = createVersion({
        schemaVersion: 1,
        agreementId: id,
        trackId: request.trackId,
        releaseId: release.rows[0]?.id ?? null,
        ownerWallet: actor,
        networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
        version: 1,
        previousHash: null,
        ...terms,
      });
      await client.query(
        "INSERT INTO contributor_agreements(id,track_id,owner_wallet,current_version) VALUES($1,$2,$3,1)",
        [id, request.trackId, actor],
      );
      await writeVersion(client, version, true);
      await recordEvent(client, version, actor, "draft_created");
      return version;
    });
  },
  async get(id: string, actor: string) {
    return agreementsRepository.locked(id, actor, async (client, root) => {
      const rows = await client.query(
        "SELECT version FROM agreement_versions WHERE agreement_id=$1 ORDER BY version",
        [id],
      );
      const versions = [];
      for (const row of rows.rows)
        versions.push(await readVersion(client, id, row.version as number));
      const events = await client.query(
        "SELECT id,version,actor_wallet,action,payload,created_at FROM agreement_events WHERE agreement_id=$1 ORDER BY id",
        [id],
      );
      const sent = new Set(
        events.rows
          .filter((e) => e.action === "proposed")
          .map((e) => e.version as number),
      );
      const visible = visibleAgreementVersions(
        versions,
        actor,
        root.owner_wallet,
        sent,
      );
      if (!visible.length)
        throw new HttpError(403, "This proposal has not been sent to you");
      const visibleNumbers = visible.map((v) => v.proposal.version);
      const attempts = await client.query(
        "SELECT payload FROM agreement_finalizations WHERE agreement_id=$1 ORDER BY version,payload->>'createdAt',id",
        [id],
      );
      const selected = visible.at(-1)!;
      return {
        id,
        effectiveVersion: visibleNumbers.includes(root.effective_version!)
          ? root.effective_version
          : null,
        currentVersion: selected.proposal.version,
        versions: visible,
        finalizations: attempts.rows
          .map((row) => agreementFinalizationSchema.parse(row.payload))
          .filter((a) => visibleNumbers.includes(a.version)),
        events: events.rows.filter((e) =>
          visibleNumbers.includes(e.version as number),
        ),
        context: await agreementContext(client, visible),
        permissions: agreementPermissions(
          selected,
          actor,
          selected.proposal.version === root.current_version,
        ),
      };
    });
  },
  async edit(
    id: string,
    actor: string,
    input: unknown,
    expectedVersion?: number,
    expectedHash?: string,
  ) {
    const terms = agreementTermsSchema.parse(input);
    return agreementsRepository.locked(
      id,
      actor,
      async (client, _root, current) => {
        if (
          expectedVersion !== undefined &&
          expectedVersion !== current.proposal.version
        )
          throw new HttpError(
            409,
            "The agreement changed. Review the latest version before continuing",
          );
        if (expectedHash !== undefined && expectedHash !== current.proposalHash)
          throw new HttpError(
            409,
            "The draft changed. Review the latest details before continuing",
          );
        if (current.proposal.ownerWallet !== actor)
          throw new HttpError(403, "Only the owner can edit a draft");
        if (current.state !== "draft")
          throw new HttpError(
            409,
            "Submitted proposals cannot be edited; create a revision",
          );
        await validateRegisteredRecipients(
          client,
          terms.recipients.map((r) => r.walletAddress),
        );
        const next = {
          ...createVersion({ ...current.proposal, ...terms }),
          createdAt: current.createdAt,
        };
        if (next.proposalHash === current.proposalHash) return current;
        await writeVersion(client, next);
        await recordEvent(client, next, actor, "draft_edited");
        return next;
      },
    );
  },
  async submit(
    id: string,
    actor: string,
    expectedVersion?: number,
    expectedHash?: string,
  ) {
    return agreementsRepository.locked(
      id,
      actor,
      async (client, _root, current) => {
        if (
          expectedVersion !== undefined &&
          expectedVersion !== current.proposal.version
        )
          throw new HttpError(
            409,
            "The agreement changed. Review the latest version before continuing",
          );
        if (expectedHash !== undefined && expectedHash !== current.proposalHash)
          throw new HttpError(
            409,
            "The draft changed. Review the latest details before continuing",
          );
        if (current.proposal.ownerWallet === actor && current.state !== "draft")
          return current;
        const next = submitVersion(current, actor);
        await writeVersion(client, next);
        await recordEvent(client, next, actor, "proposed");
        return next;
      },
    );
  },
  async cancel(
    id: string,
    actor: string,
    expectedVersion?: number,
    expectedHash?: string,
  ) {
    return agreementsRepository.locked(
      id,
      actor,
      async (client, _root, current) => {
        if (
          expectedVersion !== undefined &&
          expectedVersion !== current.proposal.version
        )
          throw new HttpError(
            409,
            "The agreement changed. Review the latest version before continuing",
          );
        if (expectedHash !== undefined && expectedHash !== current.proposalHash)
          throw new HttpError(
            409,
            "The draft changed. Review the latest details before continuing",
          );
        const next = cancelVersion(current, actor);
        await writeVersion(client, next);
        await recordEvent(client, next, actor, "cancelled");
        return next;
      },
    );
  },
  async revise(
    id: string,
    actor: string,
    input: unknown,
    expectedVersion?: number,
    expectedHash?: string,
  ) {
    const request = z
      .object({
        resolution: z.string().trim().min(1).max(1000),
        ...agreementTermsSchema.innerType().shape,
      })
      .strict()
      .parse(input);
    return agreementsRepository.locked(
      id,
      actor,
      async (client, _root, current) => {
        if (
          expectedVersion !== undefined &&
          expectedVersion !== current.proposal.version
        )
          throw new HttpError(
            409,
            "The agreement changed. Review the latest version before continuing",
          );
        if (expectedHash !== undefined && expectedHash !== current.proposalHash)
          throw new HttpError(
            409,
            "The draft changed. Review the latest details before continuing",
          );
        await validateRegisteredRecipients(
          client,
          request.recipients.map((r) => r.walletAddress),
        );
        const next = amendVersion(current, actor, {
          recipients: request.recipients,
          terms: request.terms,
        });
        await writeVersion(client, next, true);
        await client.query(
          "UPDATE contributor_agreements SET current_version=$2 WHERE id=$1",
          [id, next.proposal.version],
        );
        await recordEvent(client, next, actor, "revision_created", {
          previousVersion: current.proposal.version,
          resolution: request.resolution,
        });
        return next;
      },
    );
  },
  async challenge(id: string, actor: string, input: unknown) {
    return agreementsRepository.locked(
      id,
      actor,
      async (client, _root, current) => {
        const challenge = createResponseChallenge(current, actor, input);
        await client.query(
          "INSERT INTO agreement_challenges(id,agreement_id,version,wallet_address,expires_at,payload) VALUES($1,$2,$3,$4,$5,$6)",
          [
            challenge.id,
            id,
            challenge.version,
            actor,
            challenge.expiresAt,
            challenge,
          ],
        );
        return {
          ...challenge,
          networkPassphrase: current.proposal.networkPassphrase,
        };
      },
    );
  },
  async respond(id: string, actor: string, input: unknown) {
    const request = z
      .object({
        challengeId: z.string().uuid(),
        signedTransaction: z.string().min(1).max(20000),
      })
      .strict()
      .parse(input);
    return agreementsRepository.locked(
      id,
      actor,
      async (client, _root, current) => {
        const rows = await client.query(
          "SELECT payload FROM agreement_challenges WHERE id=$1 AND agreement_id=$2 AND wallet_address=$3 FOR UPDATE",
          [request.challengeId, id, actor],
        );
        if (!rows.rows[0])
          throw new HttpError(404, "Response challenge not found");
        const challenge = rows.rows[0].payload as ResponseChallenge;
        // An exact retry can refer to a prior version after an amendment was created.
        const version =
          challenge.version === current.proposal.version
            ? current
            : await readVersion(client, id, challenge.version);
        const result = applyResponse(
          version,
          challenge,
          request.signedTransaction,
          actor,
        );
        if (!result.duplicate) {
          if (version.proposal.version !== current.proposal.version)
            throw new HttpError(
              409,
              "Only the current proposal accepts new responses",
            );
          await client.query(
            "INSERT INTO agreement_responses(challenge_id,agreement_id,version,wallet_address,action,payload) VALUES($1,$2,$3,$4,$5,$6)",
            [
              challenge.id,
              id,
              challenge.version,
              actor,
              challenge.action,
              result.response,
            ],
          );
          await writeVersion(client, result.version);
          await client.query(
            "UPDATE agreement_challenges SET consumed_at=NOW() WHERE id=$1",
            [challenge.id],
          );
          await recordEvent(client, result.version, actor, challenge.action, {
            challengeId: challenge.id,
            reason: challenge.reason,
          });
        }
        return result.version;
      },
    );
  },
};
