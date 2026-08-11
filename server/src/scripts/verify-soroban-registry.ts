import type { TrackRoyaltySplitRecord } from "@music-city/shared";

import { env } from "../config/env.js";
import { sorobanRegistryService } from "../modules/royalties/soroban-registry.service.js";

const TRACK_ID = "music-city-grant-evidence-2026";

const main = async () => {
  if (!env.STELLAR_TREASURY_ADDRESS) {
    throw new Error("STELLAR_TREASURY_ADDRESS is required");
  }

  const timestamp = new Date().toISOString();
  const split: TrackRoyaltySplitRecord = {
    id: "rsplit_grant_evidence",
    trackId: TRACK_ID,
    version: 1,
    status: "active",
    registryKind: "offchain",
    registryChain: "stellar",
    registryNetwork: env.ROYALTY_REGISTRY_NETWORK,
    registryContractId: sorobanRegistryService.getConfig().contractId,
    recipients: [
      {
        walletAddress: env.STELLAR_TREASURY_ADDRESS,
        chain: "stellar",
        role: "artist",
        shareBps: 10_000,
      },
    ],
    totalBps: 10_000,
    registryVerificationStatus: "unverified",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const existing = await sorobanRegistryService.getTrackSplit(TRACK_ID);
  const publication = existing
    ? undefined
    : await sorobanRegistryService.publishTrackSplit(split);
  const readBack = await sorobanRegistryService.getTrackSplit(TRACK_ID);
  const expectedHash = sorobanRegistryService.metadataHashForSplit(split);

  if (!readBack || readBack.version !== 1 || readBack.metadataHash !== expectedHash) {
    throw new Error("Soroban registry read-back does not match the evidence split");
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        contractId: sorobanRegistryService.getConfig().contractId,
        contractExplorerUrl: sorobanRegistryService.contractExplorerUrl(),
        publication,
        readBack,
        verified: true,
      },
      null,
      2,
    )}\n`,
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
