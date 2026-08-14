import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { royaltiesService } = await import("./royalties.service.js");
const { royaltiesRepository } = await import("./royalties.repository.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");
const { stellarPayoutService } = await import("./stellar-payout.service.js");
const { sorobanRegistryService } = await import("./soroban-registry.service.js");

const basePayoutSettings = {
  approvalMode: "admin" as const,
  cadence: "manual" as const,
  minimumPayoutAmount: "1.0000000",
  retryFailedPayouts: true,
  shortfallBehavior: "allow_partial_batches" as const,
  automaticApproval: false,
  reversalPolicy:
    "Failed or cancelled payouts return linked ledger entries to approved for retry.",
  confirmBeforeMarkPaid: true,
};

const baseFeeSettings = {
  trackPurchaseFeeBps: 0,
  platformSubscriptionFeeBps: 0,
  adRevenueFeeBps: 0,
  manualAdjustmentFeeBps: 0,
};

const restore = <T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
) => {
  const original = target[key];
  target[key] = replacement;
  return () => {
    target[key] = original;
  };
};

test("upsertTrackSplits rejects split totals that do not add up to 10000 bps", async () => {
  const cleanup = [
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk_1",
      })) as unknown as typeof tracksRepository.findById,
    ),
    restore(
      royaltiesRepository,
      "listTrackSplits",
      (async () => []) as typeof royaltiesRepository.listTrackSplits,
    ),
  ];

  try {
    await assert.rejects(
      () =>
        royaltiesService.upsertTrackSplits("trk_1", {
          recipients: [
            {
              walletAddress: "GD6R4ND0MADDR355000000000000000000000000000000000000000000",
              chain: "stellar",
              role: "artist",
              shareBps: 9000,
            },
          ],
          activate: true,
        }),
      (error) =>
        error instanceof Error &&
        error.message.includes("must total exactly 10000 bps"),
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("upsertTrackSplits supersedes previous active splits and increments version", async () => {
  const upserts: Array<{ id: string; version: number; status: string }> = [];

  const cleanup = [
    restore(
      tracksRepository,
      "findById",
      (async () => ({
        id: "trk_2",
      })) as unknown as typeof tracksRepository.findById,
    ),
    restore(
      royaltiesRepository,
      "listTrackSplits",
      (async () => [
        {
          id: "rsplit_old",
          trackId: "trk_2",
          version: 1,
          status: "active" as const,
          registryKind: "offchain" as const,
          registryChain: "stellar" as const,
          registryNetwork: "stellar:testnet",
          recipients: [
            {
              walletAddress:
                "GD6R4ND0MADDR355000000000000000000000000000000000000000001",
              chain: "stellar" as const,
              role: "artist" as const,
              shareBps: 10_000,
            },
          ],
          totalBps: 10_000,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listTrackSplits,
    ),
    restore(
      royaltiesRepository,
      "upsertSplit",
      (async (split) => {
        upserts.push({
          id: split.id,
          version: split.version,
          status: split.status,
        });
        return split;
      }) as typeof royaltiesRepository.upsertSplit,
    ),
  ];

  try {
    const split = await royaltiesService.upsertTrackSplits("trk_2", {
      recipients: [
        {
          walletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000002",
          chain: "stellar",
          role: "artist",
          shareBps: 7000,
        },
        {
          walletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000003",
          chain: "stellar",
          role: "producer",
          shareBps: 3000,
        },
      ],
      activate: true,
    });

    assert.equal(split.version, 2);
    assert.equal(split.status, "active");
    assert.deepEqual(
      upserts.map((item) => item.status),
      ["superseded", "active"],
    );
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("publishTrackSplit anchors the active split on Soroban and stores evidence", async () => {
  const timestamp = "2026-07-21T08:00:00.000Z";
  const activeSplit = {
    id: "rsplit_publish",
    trackId: "trk_publish",
    version: 1,
    status: "active" as const,
    registryKind: "offchain" as const,
    registryChain: "stellar" as const,
    registryNetwork: "stellar:testnet",
    registryContractId: "CCONTRACT",
    recipients: [
      {
        walletAddress: "GARTIST",
        chain: "stellar" as const,
        role: "artist" as const,
        shareBps: 10_000,
      },
    ],
    totalBps: 10_000,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  const metadataHash = sorobanRegistryService.metadataHashForSplit(activeSplit);
  const onChainSplit = {
    version: 1,
    recipients: activeSplit.recipients,
    metadataHash,
    frozen: false,
    updatedLedger: 123,
  };
  const persisted: Array<{
    registryKind: string;
    registryVerificationStatus?: string;
  }> = [];

  const cleanup = [
    restore(
      royaltiesRepository,
      "listTrackSplits",
      (async () => [activeSplit]) as typeof royaltiesRepository.listTrackSplits,
    ),
    restore(
      royaltiesRepository,
      "upsertSplit",
      (async (split) => {
        persisted.push(split);
        return split;
      }) as typeof royaltiesRepository.upsertSplit,
    ),
    restore(
      sorobanRegistryService,
      "getConfig",
      (() => ({
        contractId: "CCONTRACT",
        network: "stellar:testnet",
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
      })) as typeof sorobanRegistryService.getConfig,
    ),
    restore(
      sorobanRegistryService,
      "getTrackSplit",
      (async () => undefined) as typeof sorobanRegistryService.getTrackSplit,
    ),
    restore(
      sorobanRegistryService,
      "publishTrackSplit",
      (async () => ({
        onChainSplit,
        metadataHash,
        txHash: "soroban-publish-tx",
        ledger: 123,
        contractId: "CCONTRACT",
        network: "stellar:testnet",
        explorerUrl:
          "https://stellar.expert/explorer/testnet/tx/soroban-publish-tx",
      })) as typeof sorobanRegistryService.publishTrackSplit,
    ),
  ];

  try {
    const result = await royaltiesService.publishTrackSplit("trk_publish");

    assert.equal(result.txHash, "soroban-publish-tx");
    assert.equal(result.split.registryKind, "soroban");
    assert.equal(result.split.registryVerificationStatus, "match");
    assert.equal(persisted.length, 1);
    assert.equal(persisted[0]?.registryKind, "soroban");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("verifyTrackSplit records a mismatch returned by Soroban", async () => {
  const timestamp = "2026-07-21T08:00:00.000Z";
  const activeSplit = {
    id: "rsplit_verify",
    trackId: "trk_verify",
    version: 1,
    status: "active" as const,
    registryKind: "soroban" as const,
    registryChain: "stellar" as const,
    registryNetwork: "stellar:testnet",
    registryContractId: "CCONTRACT",
    recipients: [
      {
        walletAddress: "GARTIST",
        chain: "stellar" as const,
        role: "artist" as const,
        shareBps: 10_000,
      },
    ],
    totalBps: 10_000,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  let persistedStatus: string | undefined;

  const cleanup = [
    restore(
      royaltiesRepository,
      "listTrackSplits",
      (async () => [activeSplit]) as typeof royaltiesRepository.listTrackSplits,
    ),
    restore(
      royaltiesRepository,
      "upsertSplit",
      (async (split) => {
        persistedStatus = split.registryVerificationStatus;
        return split;
      }) as typeof royaltiesRepository.upsertSplit,
    ),
    restore(
      sorobanRegistryService,
      "getConfig",
      (() => ({
        contractId: "CCONTRACT",
        network: "stellar:testnet",
        networkPassphrase: "Test SDF Network ; September 2015",
        rpcUrl: "https://soroban-testnet.stellar.org",
      })) as typeof sorobanRegistryService.getConfig,
    ),
    restore(
      sorobanRegistryService,
      "getTrackSplitVersion",
      (async () => ({
        version: 1,
        recipients: activeSplit.recipients,
        metadataHash: "0".repeat(64),
        frozen: false,
        updatedLedger: 124,
      })) as typeof sorobanRegistryService.getTrackSplitVersion,
    ),
  ];

  try {
    const result = await royaltiesService.verifyTrackSplit("trk_verify");

    assert.equal(result.matches, false);
    assert.ok(result.differences.some((item) => item.includes("metadata hash")));
    assert.equal(persistedStatus, "mismatch");
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("ensureTrackPurchaseLedgerEntries applies fee settings and can auto-approve entries", async () => {
  const insertedEntries: Array<{
    walletAddress: string;
    amount: string;
    grossAmount: string;
    feeAmount?: string;
    status: string;
  }> = [];

  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => ({
        ...basePayoutSettings,
        automaticApproval: true,
      })) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesService,
      "getFeeSettings",
      (async () => ({
        ...baseFeeSettings,
        trackPurchaseFeeBps: 500,
      })) as typeof royaltiesService.getFeeSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntriesBySource",
      (async () => []) as typeof royaltiesRepository.listLedgerEntriesBySource,
    ),
    restore(
      royaltiesRepository,
      "listTrackSplits",
      (async () => [
        {
          id: "rsplit_active",
          trackId: "trk_3",
          version: 1,
          status: "active" as const,
          registryKind: "offchain" as const,
          registryChain: "stellar" as const,
          registryNetwork: "stellar:testnet",
          recipients: [
            {
              walletAddress:
                "GD6R4ND0MADDR355000000000000000000000000000000000000000004",
              chain: "stellar" as const,
              role: "artist" as const,
              shareBps: 7000,
            },
            {
              walletAddress:
                "GD6R4ND0MADDR355000000000000000000000000000000000000000005",
              chain: "stellar" as const,
              role: "producer" as const,
              shareBps: 3000,
            },
          ],
          totalBps: 10_000,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listTrackSplits,
    ),
    restore(
      royaltiesRepository,
      "upsertLedgerEntry",
      (async (entry) => {
        insertedEntries.push({
          walletAddress: entry.recipientWalletAddress,
          amount: entry.netAmount,
          grossAmount: entry.grossAmount,
          feeAmount: entry.feeAmount,
          status: entry.status,
        });
        return entry;
      }) as typeof royaltiesRepository.upsertLedgerEntry,
    ),
  ];

  try {
    const entries = await royaltiesService.ensureTrackPurchaseLedgerEntries({
      id: "pay_track_1",
      intentId: "payi_track_1",
      walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      productType: "track_purchase",
      trackId: "trk_3",
      txHash: "stellar-track-tx-1",
      amount: "10.0000000",
      assetCode: "USDC",
      assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      status: "confirmed",
      confirmedAt: "2026-07-02T10:00:00.000Z",
      createdAt: "2026-07-02T10:00:00.000Z",
    });

    assert.equal(entries.length, 2);
    assert.deepEqual(insertedEntries, [
      {
        walletAddress:
          "GD6R4ND0MADDR355000000000000000000000000000000000000000004",
        amount: "6.6500000",
        grossAmount: "7.0000000",
        feeAmount: "0.3500000",
        status: "approved",
      },
      {
        walletAddress:
          "GD6R4ND0MADDR355000000000000000000000000000000000000000005",
        amount: "2.8500000",
        grossAmount: "3.0000000",
        feeAmount: "0.1500000",
        status: "approved",
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("ensurePlatformSubscriptionLedgerEntries allocates evenly across eligible subscriber tracks", async () => {
  const insertedEntries: Array<{ trackId: string; walletAddress: string; amount: string }> = [];

  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => basePayoutSettings) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesService,
      "getFeeSettings",
      (async () => baseFeeSettings) as typeof royaltiesService.getFeeSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntriesBySource",
      (async () => []) as typeof royaltiesRepository.listLedgerEntriesBySource,
    ),
    restore(
      tracksRepository,
      "list",
      (async () => [
        {
          id: "trk_sub_1",
          title: "Subscriber One",
          artistId: "artist_1",
          artistName: "Artist One",
          genre: "Pop",
          runtime: "3:20",
          priceLabel: "Subscriber",
          status: "published" as const,
          access: "subscribers" as const,
          plays: 0,
          likes: 0,
          playbackReady: true,
        },
        {
          id: "trk_sub_2",
          title: "Subscriber Two",
          artistId: "artist_2",
          artistName: "Artist Two",
          genre: "Soul",
          runtime: "4:05",
          priceLabel: "Subscriber",
          status: "published" as const,
          access: "subscribers" as const,
          plays: 0,
          likes: 0,
          playbackReady: true,
        },
        {
          id: "trk_public",
          title: "Public Track",
          artistId: "artist_3",
          artistName: "Artist Three",
          genre: "Hip Hop",
          runtime: "2:50",
          priceLabel: "Public",
          status: "published" as const,
          access: "public" as const,
          plays: 0,
          likes: 0,
          playbackReady: true,
        },
      ]) as typeof tracksRepository.list,
    ),
    restore(
      tracksRepository,
      "listPublicTrackIds",
      (async () => ["trk_sub_1", "trk_sub_2", "trk_public"]) as typeof tracksRepository.listPublicTrackIds,
    ),
    restore(
      royaltiesRepository,
      "listTrackSplits",
      (async (trackId: string) => {
        if (trackId === "trk_sub_1") {
          return [
            {
              id: "rsplit_sub_1",
              trackId,
              version: 1,
              status: "active" as const,
              registryKind: "offchain" as const,
              registryChain: "stellar" as const,
              registryNetwork: "stellar:testnet",
              recipients: [
                {
                  walletAddress:
                    "GD6R4ND0MADDR355000000000000000000000000000000000000000010",
                  chain: "stellar" as const,
                  role: "artist" as const,
                  shareBps: 10_000,
                },
              ],
              totalBps: 10_000,
              createdAt: "2026-07-01T00:00:00.000Z",
              updatedAt: "2026-07-01T00:00:00.000Z",
            },
          ];
        }

        if (trackId === "trk_sub_2") {
          return [
            {
              id: "rsplit_sub_2",
              trackId,
              version: 1,
              status: "active" as const,
              registryKind: "offchain" as const,
              registryChain: "stellar" as const,
              registryNetwork: "stellar:testnet",
              recipients: [
                {
                  walletAddress:
                    "GD6R4ND0MADDR355000000000000000000000000000000000000000011",
                  chain: "stellar" as const,
                  role: "artist" as const,
                  shareBps: 6000,
                },
                {
                  walletAddress:
                    "GD6R4ND0MADDR355000000000000000000000000000000000000000012",
                  chain: "stellar" as const,
                  role: "producer" as const,
                  shareBps: 4000,
                },
              ],
              totalBps: 10_000,
              createdAt: "2026-07-01T00:00:00.000Z",
              updatedAt: "2026-07-01T00:00:00.000Z",
            },
          ];
        }

        return [];
      }) as typeof royaltiesRepository.listTrackSplits,
    ),
    restore(
      royaltiesRepository,
      "upsertLedgerEntry",
      (async (entry) => {
        insertedEntries.push({
          trackId: entry.trackId,
          walletAddress: entry.recipientWalletAddress,
          amount: entry.netAmount,
        });
        return entry;
      }) as typeof royaltiesRepository.upsertLedgerEntry,
    ),
  ];

  try {
    const entries = await royaltiesService.ensurePlatformSubscriptionLedgerEntries({
      id: "pay_sub_1",
      intentId: "payi_sub_1",
      walletAddress: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      productType: "platform_subscription",
      subscriptionScope: "platform",
      txHash: "stellar-sub-tx-1",
      amount: "15.0000000",
      assetCode: "USDC",
      assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      status: "confirmed",
      confirmedAt: "2026-07-02T10:00:00.000Z",
      createdAt: "2026-07-02T10:00:00.000Z",
    });

    assert.equal(entries.length, 3);
    assert.deepEqual(insertedEntries, [
      {
        trackId: "trk_sub_1",
        walletAddress:
          "GD6R4ND0MADDR355000000000000000000000000000000000000000010",
        amount: "7.5000000",
      },
      {
        trackId: "trk_sub_2",
        walletAddress:
          "GD6R4ND0MADDR355000000000000000000000000000000000000000011",
        amount: "4.5000000",
      },
      {
        trackId: "trk_sub_2",
        walletAddress:
          "GD6R4ND0MADDR355000000000000000000000000000000000000000012",
        amount: "3.0000000",
      },
    ]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("approveLedgerEntries marks pending entries as approved", async () => {
  const updatedStatuses: string[] = [];

  const cleanup = [
    restore(
      royaltiesRepository,
      "listLedgerEntriesByIds",
      (async () => [
        {
          id: "rled_pending_1",
          trackId: "trk_approved",
          splitId: "rsplit_approved",
          sourceType: "track_purchase" as const,
          sourceId: "pay_approved",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000020",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "pending" as const,
          grossAmount: "5.0000000",
          netAmount: "5.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntriesByIds,
    ),
    restore(
      royaltiesRepository,
      "upsertLedgerEntry",
      (async (entry) => {
        updatedStatuses.push(entry.status);
        return entry;
      }) as typeof royaltiesRepository.upsertLedgerEntry,
    ),
  ];

  try {
    const entries = await royaltiesService.approveLedgerEntries({
      entryIds: ["rled_pending_1"],
    });

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.status, "approved");
    assert.deepEqual(updatedStatuses, ["approved"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("runPayouts creates a dry-run payout summary for approved Stellar entries", async () => {
  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => basePayoutSettings) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntries",
      (async () => [
        {
          id: "rled_payout_1",
          trackId: "trk_pay_1",
          splitId: "rsplit_pay_1",
          sourceType: "track_purchase" as const,
          sourceId: "pay_source_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000030",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "4.0000000",
          netAmount: "4.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
        {
          id: "rled_payout_2",
          trackId: "trk_pay_2",
          splitId: "rsplit_pay_2",
          sourceType: "platform_subscription" as const,
          sourceId: "pay_source_2",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000030",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "1.5000000",
          netAmount: "1.5000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T11:00:00.000Z",
          updatedAt: "2026-07-02T11:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntries,
    ),
    restore(
      royaltiesRepository,
      "listPayouts",
      (async () => []) as typeof royaltiesRepository.listPayouts,
    ),
  ];

  try {
    const result = await royaltiesService.runPayouts({
      dryRun: true,
      maxEntries: 100,
    });

    assert.equal(result.items.length, 1);
    assert.deepEqual(result.items[0], {
      recipientWalletAddress:
        "GD6R4ND0MADDR355000000000000000000000000000000000000000030",
      recipientChain: "stellar",
      payoutRail: "stellar",
      status: "dry_run",
      amount: "5.5000000",
      assetCode: "USDC",
      assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      ledgerEntryIds: ["rled_payout_2", "rled_payout_1"],
    });
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("runPayouts submits Stellar payouts and waits for reconciliation before marking entries paid", async () => {
  const payoutStatuses: string[] = [];
  const ledgerStatuses: string[] = [];

  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => basePayoutSettings) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntries",
      (async () => [
        {
          id: "rled_payout_live_1",
          trackId: "trk_live_1",
          splitId: "rsplit_live_1",
          sourceType: "track_purchase" as const,
          sourceId: "pay_live_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000040",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "2.0000000",
          netAmount: "2.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntries,
    ),
    restore(
      stellarPayoutService,
      "submitPayment",
      (async () => ({
        txHash: "stellar-payout-tx-1",
        amount: "2.0000000",
        assetCode: "USDC",
        assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
        treasuryWalletAddress:
          "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      })) as typeof stellarPayoutService.submitPayment,
    ),
    restore(
      royaltiesRepository,
      "upsertPayout",
      (async (payout) => {
        payoutStatuses.push(payout.status);
        return payout;
      }) as typeof royaltiesRepository.upsertPayout,
    ),
    restore(
      royaltiesRepository,
      "listPayouts",
      (async () => []) as typeof royaltiesRepository.listPayouts,
    ),
    restore(
      royaltiesRepository,
      "upsertLedgerEntry",
      (async (entry) => {
        ledgerStatuses.push(entry.status);
        return entry;
      }) as typeof royaltiesRepository.upsertLedgerEntry,
    ),
  ];

  try {
    const result = await royaltiesService.runPayouts({
      dryRun: false,
      maxEntries: 100,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.status, "submitted");
    assert.equal(result.items[0]?.txHash, "stellar-payout-tx-1");
    assert.deepEqual(payoutStatuses, ["submitted"]);
    assert.deepEqual(ledgerStatuses, []);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("runPayouts records failed payouts without marking ledger entries paid", async () => {
  const payoutStatuses: string[] = [];
  const ledgerStatuses: string[] = [];

  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => basePayoutSettings) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntries",
      (async () => [
        {
          id: "rled_payout_fail_1",
          trackId: "trk_fail_1",
          splitId: "rsplit_fail_1",
          sourceType: "track_purchase" as const,
          sourceId: "pay_fail_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000050",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "3.0000000",
          netAmount: "3.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntries,
    ),
    restore(
      stellarPayoutService,
      "submitPayment",
      (async () => {
        throw new Error("Treasury balance is insufficient");
      }) as typeof stellarPayoutService.submitPayment,
    ),
    restore(
      royaltiesRepository,
      "upsertPayout",
      (async (payout) => {
        payoutStatuses.push(payout.status);
        return payout;
      }) as typeof royaltiesRepository.upsertPayout,
    ),
    restore(
      royaltiesRepository,
      "listPayouts",
      (async () => []) as typeof royaltiesRepository.listPayouts,
    ),
    restore(
      royaltiesRepository,
      "upsertLedgerEntry",
      (async (entry) => {
        ledgerStatuses.push(entry.status);
        return entry;
      }) as typeof royaltiesRepository.upsertLedgerEntry,
    ),
  ];

  try {
    const result = await royaltiesService.runPayouts({
      dryRun: false,
      maxEntries: 100,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.status, "failed");
    assert.match(result.items[0]?.reason ?? "", /insufficient/i);
    assert.deepEqual(payoutStatuses, ["failed"]);
    assert.deepEqual(ledgerStatuses, []);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("runPayouts skips batches below the configured minimum threshold", async () => {
  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => ({
        ...basePayoutSettings,
        minimumPayoutAmount: "10.0000000",
      })) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntries",
      (async () => [
        {
          id: "rled_payout_small_1",
          trackId: "trk_small_1",
          splitId: "rsplit_small_1",
          sourceType: "track_purchase" as const,
          sourceId: "pay_small_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000060",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "2.5000000",
          netAmount: "2.5000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntries,
    ),
    restore(
      royaltiesRepository,
      "listPayouts",
      (async () => []) as typeof royaltiesRepository.listPayouts,
    ),
  ];

  try {
    const result = await royaltiesService.runPayouts({
      dryRun: true,
      maxEntries: 100,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.status, "skipped");
    assert.match(result.items[0]?.reason ?? "", /minimum threshold/i);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("runPayouts skips duplicate ledger batches that already have a submitted payout", async () => {
  const cleanup = [
    restore(
      royaltiesService,
      "getPayoutSettings",
      (async () => basePayoutSettings) as typeof royaltiesService.getPayoutSettings,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntries",
      (async () => [
        {
          id: "rled_dup_1",
          trackId: "trk_dup_1",
          splitId: "rsplit_dup_1",
          sourceType: "track_purchase" as const,
          sourceId: "pay_dup_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000061",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "4.0000000",
          netAmount: "4.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntries,
    ),
    restore(
      royaltiesRepository,
      "listPayouts",
      (async () => [
        {
          id: "rpay_existing_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000061",
          recipientChain: "stellar" as const,
          payoutRail: "stellar" as const,
          status: "submitted" as const,
          amount: "4.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          txHash: "duplicate-tx",
          ledgerEntryIds: ["rled_dup_1"],
          submittedAt: "2026-07-02T11:00:00.000Z",
          createdAt: "2026-07-02T11:00:00.000Z",
          updatedAt: "2026-07-02T11:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listPayouts,
    ),
  ];

  try {
    const result = await royaltiesService.runPayouts({
      dryRun: false,
      maxEntries: 100,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.status, "skipped");
    assert.equal(result.items[0]?.payoutId, "rpay_existing_1");
    assert.match(result.items[0]?.reason ?? "", /conflicts with existing submitted payout/i);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});

test("reconcilePayouts confirms submitted payouts and marks linked entries paid", async () => {
  const payoutStatuses: string[] = [];
  const ledgerStatuses: string[] = [];

  const cleanup = [
    restore(
      royaltiesRepository,
      "listPayouts",
      (async () => [
        {
          id: "rpay_reconcile_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000070",
          recipientChain: "stellar" as const,
          payoutRail: "stellar" as const,
          status: "submitted" as const,
          amount: "2.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          txHash: "stellar-reconcile-tx-1",
          ledgerEntryIds: ["rled_reconcile_1"],
          submittedAt: "2026-07-02T10:00:00.000Z",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listPayouts,
    ),
    restore(
      stellarPayoutService,
      "getTransactionStatus",
      (async () => ({
        found: true,
        successful: true,
        txHash: "stellar-reconcile-tx-1",
        createdAt: "2026-07-02T10:05:00.000Z",
      })) as typeof stellarPayoutService.getTransactionStatus,
    ),
    restore(
      royaltiesRepository,
      "listLedgerEntriesByIds",
      (async () => [
        {
          id: "rled_reconcile_1",
          trackId: "trk_reconcile_1",
          splitId: "rsplit_reconcile_1",
          sourceType: "track_purchase" as const,
          sourceId: "pay_reconcile_1",
          recipientWalletAddress:
            "GD6R4ND0MADDR355000000000000000000000000000000000000000070",
          recipientChain: "stellar" as const,
          recipientRole: "artist" as const,
          status: "approved" as const,
          grossAmount: "2.0000000",
          netAmount: "2.0000000",
          assetCode: "USDC",
          assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
          createdAt: "2026-07-02T10:00:00.000Z",
          updatedAt: "2026-07-02T10:00:00.000Z",
        },
      ]) as typeof royaltiesRepository.listLedgerEntriesByIds,
    ),
    restore(
      royaltiesRepository,
      "upsertPayout",
      (async (payout) => {
        payoutStatuses.push(payout.status);
        return payout;
      }) as typeof royaltiesRepository.upsertPayout,
    ),
    restore(
      royaltiesRepository,
      "upsertLedgerEntry",
      (async (entry) => {
        ledgerStatuses.push(entry.status);
        return entry;
      }) as typeof royaltiesRepository.upsertLedgerEntry,
    ),
  ];

  try {
    const result = await royaltiesService.reconcilePayouts({
      submittedOnly: true,
      maxItems: 100,
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.status, "confirmed");
    assert.deepEqual(payoutStatuses, ["confirmed"]);
    assert.deepEqual(ledgerStatuses, ["paid"]);
  } finally {
    cleanup.reverse().forEach((fn) => fn());
  }
});
