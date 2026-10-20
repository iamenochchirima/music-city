import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { royaltiesService } = await import("./royalties.service.js");
const { royaltiesRepository } = await import("./royalties.repository.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");
const { finalizedSplitsRepository } = await import("../agreements/effective-split.js");

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

test("track purchases retain their captured agreement after amendment and apply exact fees", async () => {
  const insertedEntries: Array<{
    walletAddress: string;
    amount: string;
    grossAmount: string;
    feeAmount?: string;
    status: string;
  }> = [];

  const cleanup = [
    restore(royaltiesRepository,"recognizeSource",async (_type,_id,build) => {const entries=await build();for(const entry of entries)await royaltiesRepository.upsertLedgerEntry(entry);return entries;}),
    restore(finalizedSplitsRepository,"effective",async trackId => (await finalizedSplitsRepository.list(trackId)).find(split => split.status === "active") ?? null),
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
      finalizedSplitsRepository,
      "list",
      (async () => [
        { id: "rsplit_new", trackId: "trk_3", version: 2, status: "active", recipients: [{walletAddress:"wrong-recipient",shareBps:10000}] },
        {
          id: "rsplit_active",
          trackId: "trk_3",
          version: 1,
          status: "superseded" as const,
          historical: false,
          registryKind: "soroban" as const,
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
      ]) as typeof finalizedSplitsRepository.list,
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
      royaltySplitId: "rsplit_active",
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
    restore(royaltiesRepository,"recognizeSource",async (_type,_id,build) => {const entries=await build();for(const entry of entries)await royaltiesRepository.upsertLedgerEntry(entry);return entries;}),
    restore(finalizedSplitsRepository,"effective",async trackId => (await finalizedSplitsRepository.list(trackId)).find(split => split.status === "active") ?? null),
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
      (async () => ["trk_sub_1", "trk_sub_2"]) as typeof tracksRepository.listPublicTrackIds,
    ),
    restore(
      finalizedSplitsRepository,
      "list",
      (async (trackId: string) => {
        if (trackId === "trk_sub_1") {
          return [
            {
              id: "rsplit_sub_1",
              trackId,
              version: 1,
              status: "active" as const,
          historical: false,
              registryKind: "soroban" as const,
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
          historical: false,
              registryKind: "soroban" as const,
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
      }) as typeof finalizedSplitsRepository.list,
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
    restore(royaltiesRepository,"recognizeSource",async (_type,_id,build) => {const entries=await build();for(const entry of entries)await royaltiesRepository.upsertLedgerEntry(entry);return entries;}),
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
