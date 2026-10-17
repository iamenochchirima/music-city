import type { PoolClient } from "pg";
import type {
  AgreementContext,
  AgreementPermissions,
  AgreementPerson,
  AgreementVersion,
} from "@music-city/shared";
import { HttpError } from "../../utils/http-error.js";

export function visibleAgreementVersions(
  versions: AgreementVersion[],
  actor: string,
  owner: string,
  submittedVersions: ReadonlySet<number>,
  admin = false,
) {
  return versions.filter(
    (v) =>
      admin ||
      actor === owner ||
      (submittedVersions.has(v.proposal.version) &&
        v.proposal.recipients.some((r) => r.walletAddress === actor)),
  );
}
export function agreementPermissions(
  version: AgreementVersion,
  actor: string,
  latest: boolean,
): AgreementPermissions {
  const owner = latest && version.proposal.ownerWallet === actor;
  const member =
    latest &&
    version.proposal.recipients.some((r) => r.walletAddress === actor);
  const open = ["proposed", "ready"].includes(version.state);
  const response = version.responses
    .filter((r) => r.walletAddress === actor)
    .at(-1);
  return {
    edit: owner && version.state === "draft",
    submit: owner && version.state === "draft",
    cancel: owner && ["draft", "proposed", "ready"].includes(version.state),
    revise:
      owner &&
      ["finalized", "rejected", "disputed", "cancelled"].includes(
        version.state,
      ),
    accept: member && open && !response,
    reject: member && open && !response,
    dispute: member && open && (!response || response.action === "accept"),
  };
}
export async function agreementContext(
  client: PoolClient,
  versions: AgreementVersion[],
): Promise<AgreementContext> {
  const first = versions[0]!;
  const wallets = [
    ...new Set([
      first.proposal.ownerWallet,
      ...versions.flatMap((v) =>
        v.proposal.recipients.map((r) => r.walletAddress),
      ),
    ]),
  ];
  const users = await client.query<{
    id: string;
    wallet_address: string;
    payload: { displayName?: string };
  }>(
    "SELECT id,wallet_address,payload FROM users WHERE wallet_address=ANY($1::text[])",
    [wallets],
  );
  const people: AgreementPerson[] = users.rows.map((u) => ({
    profileId: u.id,
    walletAddress: u.wallet_address,
    name: u.payload.displayName?.trim() || "Contributor",
  }));
  const track = await client.query<{ id: string; payload: { title?: string } }>(
    "SELECT id,payload FROM tracks WHERE id=$1",
    [first.proposal.trackId],
  );
  return {
    track: {
      id: first.proposal.trackId,
      title: track.rows[0]?.payload.title?.trim() || "Untitled recording",
    },
    owner: people.find((p) => p.walletAddress === first.proposal.ownerWallet)!,
    people,
  };
}
export async function validateRegisteredRecipients(
  client: PoolClient,
  wallets: string[],
) {
  const result = await client.query(
    "SELECT wallet_address FROM users WHERE wallet_address=ANY($1::text[])",
    [wallets],
  );
  if (result.rowCount !== wallets.length)
    throw new HttpError(400, "Choose registered Music City contributors");
}
