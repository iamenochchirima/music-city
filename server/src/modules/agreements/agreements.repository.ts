import type { PoolClient } from "pg";
import {
  agreementVersionSchema,
  type AgreementVersion,
  type AgreementSummary,
} from "@music-city/shared";
import { databaseService } from "../../services/database.service.js";
import {
  agreementContext,
  visibleAgreementVersions,
} from "./agreement-views.js";
import { HttpError } from "../../utils/http-error.js";

export type AgreementRoot = {
  id: string;
  track_id: string;
  owner_wallet: string;
  current_version: number;
  effective_version: number | null;
};
export async function readVersion(
  client: PoolClient,
  id: string,
  version: number,
) {
  const result = await client.query(
    "SELECT payload FROM agreement_versions WHERE agreement_id=$1 AND version=$2",
    [id, version],
  );
  if (!result.rows[0]) throw new HttpError(404, "Agreement version not found");
  return agreementVersionSchema.parse(result.rows[0].payload);
}
export async function writeVersion(
  client: PoolClient,
  version: AgreementVersion,
  insert = false,
) {
  const p = version.proposal;
  if (insert) {
    await client.query(
      "INSERT INTO agreement_versions(agreement_id,version,proposal_hash,state,payload) VALUES($1,$2,$3,$4,$5)",
      [p.agreementId, p.version, version.proposalHash, version.state, version],
    );
    for (const recipient of p.recipients) {
      await client.query(
        "INSERT INTO agreement_contributors(agreement_id,version,wallet_address) VALUES($1,$2,$3)",
        [p.agreementId, p.version, recipient.walletAddress],
      );
    }
  } else {
    await client.query(
      "UPDATE agreement_versions SET proposal_hash=$3,state=$4,payload=$5 WHERE agreement_id=$1 AND version=$2",
      [p.agreementId, p.version, version.proposalHash, version.state, version],
    );
    if (version.state === "draft") {
      await client.query(
        "DELETE FROM agreement_contributors WHERE agreement_id=$1 AND version=$2",
        [p.agreementId, p.version],
      );
      for (const recipient of p.recipients)
        await client.query(
          "INSERT INTO agreement_contributors(agreement_id,version,wallet_address) VALUES($1,$2,$3)",
          [p.agreementId, p.version, recipient.walletAddress],
        );
    }
  }
}
export async function recordEvent(
  client: PoolClient,
  version: AgreementVersion,
  actor: string,
  action: string,
  details: object = {},
) {
  await client.query(
    "INSERT INTO agreement_events(agreement_id,version,actor_wallet,action,payload) VALUES($1,$2,$3,$4,$5)",
    [
      version.proposal.agreementId,
      version.proposal.version,
      actor,
      action,
      { state: version.state, proposalHash: version.proposalHash, ...details },
    ],
  );
}
export const agreementsRepository = {
  async locked<T>(
    id: string,
    actor: string,
    work: (
      client: PoolClient,
      root: AgreementRoot,
      version: AgreementVersion,
    ) => Promise<T>,
    admin = false,
  ) {
    return databaseService.transaction(async (client) => {
      const result = await client.query<AgreementRoot>(
        "SELECT * FROM contributor_agreements WHERE id=$1 FOR UPDATE",
        [id],
      );
      const root = result.rows[0];
      if (!root) throw new HttpError(404, "Agreement not found");
      if (!admin && actor !== root.owner_wallet) {
        const member = await client.query(
          "SELECT 1 FROM agreement_contributors WHERE agreement_id=$1 AND wallet_address=$2 LIMIT 1",
          [id, actor],
        );
        if (!member.rowCount)
          throw new HttpError(403, "Agreement access denied");
      }
      return work(
        client,
        root,
        await readVersion(client, id, root.current_version),
      );
    });
  },
  async list(actor: string): Promise<AgreementSummary[]> {
    return databaseService.transaction(async (client) => {
      const roots = await client.query<AgreementRoot>(
        "SELECT a.* FROM contributor_agreements a WHERE a.owner_wallet=$1 OR EXISTS(SELECT 1 FROM agreement_contributors c WHERE c.agreement_id=a.id AND c.wallet_address=$1) ORDER BY a.created_at DESC LIMIT 100",
        [actor],
      );
      const summaries: AgreementSummary[] = [];
      for (const root of roots.rows) {
        const rows = await client.query<{ payload: AgreementVersion }>(
          "SELECT payload FROM agreement_versions WHERE agreement_id=$1 ORDER BY version",
          [root.id],
        );
        const sent = await client.query<{ version: number }>(
          "SELECT DISTINCT version FROM agreement_events WHERE agreement_id=$1 AND action='proposed'",
          [root.id],
        );
        const versions = visibleAgreementVersions(
          rows.rows.map((r) => agreementVersionSchema.parse(r.payload)),
          actor,
          root.owner_wallet,
          new Set(sent.rows.map((r) => r.version)),
        );
        const current = versions.at(-1);
        if (!current) continue;
        summaries.push({
          id: root.id,
          current,
          effectiveVersion: versions.some(
            (v) => v.proposal.version === root.effective_version,
          )
            ? root.effective_version
            : null,
          context: await agreementContext(client, versions),
        });
      }
      return summaries;
    });
  },
};
