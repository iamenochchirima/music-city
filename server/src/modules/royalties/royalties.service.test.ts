import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const { royaltiesService } = await import("./royalties.service.js");
const { royaltiesRepository } = await import("./royalties.repository.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");

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

test("ensureTrackPurchaseLedgerEntries creates recipient entries from the active split", async () => {
  const insertedEntries: Array<{ walletAddress: string; amount: string }> = [];

  const cleanup = [
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
        amount: "7.0000000",
      },
      {
        walletAddress:
          "GD6R4ND0MADDR355000000000000000000000000000000000000000005",
        amount: "3.0000000",
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
