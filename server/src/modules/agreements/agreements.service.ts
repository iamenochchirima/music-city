import { randomUUID } from "node:crypto";
import { z } from "zod";
import { agreementTermsSchema, agreementFinalizationSchema } from "@music-city/shared";
import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { amendVersion, applyResponse, cancelVersion, createResponseChallenge, createVersion, submitVersion, type ResponseChallenge } from "./agreement-domain.js";
import { agreementsRepository, readVersion, recordEvent, writeVersion } from "./agreements.repository.js";

export const agreementsService = {
  list: agreementsRepository.list,
  async create(actor: string, input: unknown) {
    const request = z.object({ trackId: z.string().min(1), ...agreementTermsSchema.innerType().shape }).strict().parse(input);
    const terms = agreementTermsSchema.parse({ recipients: request.recipients, terms: request.terms });
    return databaseService.transaction(async client => {
      const track = await client.query("SELECT t.id FROM tracks t JOIN users u ON u.id=t.artist_id WHERE t.id=$1 AND u.wallet_address=$2 FOR UPDATE OF t", [request.trackId,actor]);
      if (!track.rowCount) throw new HttpError(403, "Only the track owner can propose its royalty agreement");
      const existing = await client.query("SELECT id FROM contributor_agreements WHERE track_id=$1", [request.trackId]);
      if (existing.rowCount) throw new HttpError(409, "This track already has an agreement; revise its current version");
      const release = await client.query("SELECT r.id,u.wallet_address FROM release_tracks rt JOIN releases r ON r.id=rt.release_id JOIN users u ON u.id=r.artist_id WHERE rt.track_id=$1 FOR SHARE OF rt,r",[request.trackId]);
      if (release.rows[0] && release.rows[0].wallet_address !== actor) throw new HttpError(403,"Track release ownership does not match the agreement owner");
      const id = randomUUID();
      const version = createVersion({ schemaVersion: 1, agreementId: id, trackId: request.trackId, releaseId: release.rows[0]?.id ?? null, ownerWallet: actor, networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE, version: 1, previousHash: null, ...terms });
      await client.query("INSERT INTO contributor_agreements(id,track_id,owner_wallet,current_version) VALUES($1,$2,$3,1)", [id,request.trackId,actor]);
      await writeVersion(client,version,true);
      await recordEvent(client,version,actor,"draft_created");
      return version;
    });
  },
  async get(id: string, actor: string) {
    return agreementsRepository.locked(id,actor,async (client,root) => {
      const rows = await client.query("SELECT version FROM agreement_versions WHERE agreement_id=$1 ORDER BY version", [id]);
      const versions = [];
      for (const row of rows.rows) versions.push(await readVersion(client,id,row.version as number));
      const events = await client.query("SELECT id,version,actor_wallet,action,payload,created_at FROM agreement_events WHERE agreement_id=$1 ORDER BY id", [id]);
      const attempts = await client.query("SELECT payload FROM agreement_finalizations WHERE agreement_id=$1 ORDER BY version,id", [id]);
      return { id, effectiveVersion: root.effective_version, currentVersion: root.current_version, versions, finalizations: attempts.rows.map(row => agreementFinalizationSchema.parse(row.payload)), events: events.rows };
    });
  },
  async edit(id: string, actor: string, input: unknown) {
    const terms = agreementTermsSchema.parse(input);
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      if (current.proposal.ownerWallet !== actor) throw new HttpError(403,"Only the owner can edit a draft");
      if (current.state !== "draft") throw new HttpError(409,"Submitted proposals cannot be edited; create a revision");
      const next = { ...createVersion({ ...current.proposal, ...terms }), createdAt: current.createdAt };
      await writeVersion(client,next);
      await recordEvent(client,next,actor,"draft_edited");
      return next;
    });
  },
  async submit(id: string, actor: string) {
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const next = submitVersion(current,actor);
      await writeVersion(client,next);
      await recordEvent(client,next,actor,"proposed");
      return next;
    });
  },
  async cancel(id: string, actor: string) {
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const next = cancelVersion(current,actor);
      await writeVersion(client,next);
      await recordEvent(client,next,actor,"cancelled");
      return next;
    });
  },
  async revise(id: string, actor: string, input: unknown) {
    const request = z.object({ resolution: z.string().trim().min(1).max(1000), ...agreementTermsSchema.innerType().shape }).strict().parse(input);
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const next = amendVersion(current,actor,{ recipients: request.recipients, terms: request.terms });
      await writeVersion(client,next,true);
      await client.query("UPDATE contributor_agreements SET current_version=$2 WHERE id=$1", [id,next.proposal.version]);
      await recordEvent(client,next,actor,"revision_created",{ previousVersion: current.proposal.version, resolution: request.resolution });
      return next;
    });
  },
  async challenge(id: string, actor: string, input: unknown) {
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const challenge = createResponseChallenge(current,actor,input);
      await client.query("INSERT INTO agreement_challenges(id,agreement_id,version,wallet_address,expires_at,payload) VALUES($1,$2,$3,$4,$5,$6)", [challenge.id,id,challenge.version,actor,challenge.expiresAt,challenge]);
      return { ...challenge, networkPassphrase: current.proposal.networkPassphrase };
    });
  },
  async respond(id: string, actor: string, input: unknown) {
    const request = z.object({ challengeId: z.string().uuid(), signedTransaction: z.string().min(1).max(20000) }).strict().parse(input);
    return agreementsRepository.locked(id,actor,async (client,_root,current) => {
      const rows = await client.query("SELECT payload FROM agreement_challenges WHERE id=$1 AND agreement_id=$2 AND wallet_address=$3 FOR UPDATE", [request.challengeId,id,actor]);
      if (!rows.rows[0]) throw new HttpError(404,"Response challenge not found");
      const challenge = rows.rows[0].payload as ResponseChallenge;
      // An exact retry can refer to a prior version after an amendment was created.
      const version = challenge.version === current.proposal.version ? current : await readVersion(client,id,challenge.version);
      const result = applyResponse(version,challenge,request.signedTransaction,actor);
      if (!result.duplicate) {
        if (version.proposal.version !== current.proposal.version) throw new HttpError(409,"Only the current proposal accepts new responses");
        await client.query("INSERT INTO agreement_responses(challenge_id,agreement_id,version,wallet_address,action,payload) VALUES($1,$2,$3,$4,$5,$6)", [challenge.id,id,challenge.version,actor,challenge.action,result.response]);
        await writeVersion(client,result.version);
        await client.query("UPDATE agreement_challenges SET consumed_at=NOW() WHERE id=$1", [challenge.id]);
        await recordEvent(client,result.version,actor,challenge.action,{ challengeId: challenge.id, reason: challenge.reason });
      }
      return result.version;
    });
  },
};
