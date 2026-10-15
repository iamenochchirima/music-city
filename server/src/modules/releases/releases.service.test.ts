import { validatePublication, publicationService } from "../publication/publication.service.js";
import assert from "node:assert/strict";
import test from "node:test";
import type { ReleaseSummary } from "@music-city/shared";

process.env.DATABASE_URL ??= "postgres://music-city:music-city@127.0.0.1:5432/music-city";

const walletAddress = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const artistProfile = {
  id: "artist-1",
  walletAddress,
  email: "",
  displayName: "Artist",
  primaryIntent: "artist" as const,
  artistAccess: true,
  onboardingStatus: "complete" as const,
  onboardingStep: "complete" as const,
  onboardingVersion: 1,
  onboardingCompletedAt: new Date(0).toISOString(),
  location: "",
  genres: [],
  favoriteArtistIds: [],
  interestedInLocalMusic: false,
  notificationPreferences: {
    releaseNotifications: true,
    artistUpdates: true,
    productUpdates: false,
  },
  bio: "",
  socialLinks: {
    website: "",
    instagram: "",
    youtube: "",
    soundcloud: "",
    x: "",
  },
  profileImageUrl: undefined,
  profileImageStorageKey: undefined,
  headerImageUrl: undefined,
  headerImageStorageKey: undefined,
  hasReleasedMusic: false,
  verified: false,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const { releasesService } = await import("./releases.service.js");
const { releasesRepository } = await import("./releases.repository.js");
const { tracksRepository } = await import("../tracks/tracks.repository.js");
const { usersService } = await import("../users/users.service.js");

test("unpaid artist cannot create a release", async () => {
  const original = usersService.getProfile;
  usersService.getProfile = async () => ({ ...artistProfile, artistAccess: false });
  try {
    await assert.rejects(
      releasesService.createRelease(walletAddress,{ title: "Locked release",type: "single",genre: "Pop" }),
      (error: { statusCode?: number }) => error.statusCode === 402,
    );
  } finally { usersService.getProfile = original; }
});

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

const release = (type: "single" | "ep" | "album"): ReleaseSummary => ({
  id: "rel-1",
  artistId: "artist-1",
  artistName: "Artist",
  title: "A Release",
  type,
  status: "draft" as const,
  genre: "Electronic",
  coverStorageKey: "covers/rel-1.jpg",
  trackCount: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
});

const track = (id: string) => ({
  id,
  title: `Track ${id}`,
  artistId: "artist-1",
  artistName: "Artist",
  genre: "Electronic",
  runtime: "3:00",
  priceLabel: "Unpublished",
  status: "uploaded" as const,
  visibility: "unpublished" as const,
  plays: 0,
  likes: 0,
  playbackReady: true,
});

const runUpdate = async (
  currentRelease: ReturnType<typeof release>,
  assignments: Array<{
    release_id: string;
    track_id: string;
    track_number: number;
    disc_number: number;
    is_focus_track: boolean;
  }>,
  tracks: Record<string, ReturnType<typeof track>>,
) => {
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(tracksRepository, "findById", async (trackId: string) => tracks[trackId] ?? null),
  ];

  try {
    validatePublication(currentRelease,assignments,Object.values(tracks));
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
};

test("publishing a release requires artwork and a valid track count", async () => {
  const noArtworkRelease = {
    ...release("single"),
    coverStorageKey: undefined,
  };

  await assert.rejects(
    () => runUpdate(noArtworkRelease, [], {}),
    /Add release artwork before publishing/,
  );

  await assert.rejects(
    () =>
      runUpdate(
        noArtworkRelease,
        [{ release_id: "rel-1", track_id: "trk-1", track_number: 1, disc_number: 1, is_focus_track: false }],
        { "trk-1": track("trk-1") },
      ),
    /Add release artwork before publishing/,
  );
});

test("release creation persists release-owned metadata as a draft", async () => {
  let persistedRelease: ReleaseSummary | null = null;
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(
      releasesRepository,
      "upsert",
      (async (nextRelease) => {
        persistedRelease = nextRelease;
        return nextRelease;
      }) as typeof releasesRepository.upsert,
    ),
    restore(releasesRepository, "listTracks", async () => []),
  ];

  try {
    const created = await releasesService.createRelease(walletAddress, {
      title: "Release-owned metadata",
      type: "single",
      genre: "Pop",
      recordLabel: "Music City Records",
    });

    assert.equal(created.status, "draft");
    const savedRelease = persistedRelease as unknown as ReleaseSummary;
    assert.equal(savedRelease.recordLabel, "Music City Records");
    assert.equal(savedRelease.trackCount, 0);
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("album publishing rejects fewer than seven tracks", async () => {
  const currentRelease = release("album");

  await assert.rejects(
    () =>
      runUpdate(
        currentRelease,
        [
          { release_id: "rel-1", track_id: "trk-1", track_number: 1, disc_number: 1, is_focus_track: false },
        ],
        { "trk-1": track("trk-1") },
      ),
    /Choose a release format/,
  );
});

test("publishing a single rejects an empty tracklist even with artwork", async () => {
  const currentRelease = {
    ...release("single"),
    coverStorageKey: "covers/rel-1.jpg",
  };

  await assert.rejects(
    () => runUpdate(currentRelease, [], {}),
    /Choose a release format/,
  );
});

test("publication delegates to the durable request service",async()=>{
  let requested=false;
  const current=release("single");
  const cleanup=[
    restore(usersService,"getProfile",async()=>artistProfile),
    restore(releasesRepository,"findById",async()=>current),
    restore(publicationService,"request",async()=>{requested=true;return {id:"request",state:"processing",mode:"published",releaseAt:null,error:null};}),
    restore(releasesService,"getManageRelease",async()=>({...current,publication:undefined,tracks:[]})),
  ];
  try {await releasesService.updateRelease(walletAddress,current.id,{status:"published"});assert.equal(requested,true);assert.equal(current.status,"draft");}
  finally{cleanup.reverse().forEach(fn=>fn());}
});

test("unpublishing a release removes public track visibility", async () => {
  const currentRelease = {
    ...release("single"),
    status: "published" as const,
    coverStorageKey: "covers/rel-1.jpg",
  };
  const assignments = [
    {
      release_id: "rel-1",
      track_id: "trk-1",
      track_number: 1,
      disc_number: 1,
      is_focus_track: true,
    },
  ];
  const unpublishedTracks: string[] = [];
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(releasesRepository, "upsert", (async (nextRelease) => nextRelease) as typeof releasesRepository.upsert),
    restore(
      tracksRepository,
      "findById",
      async () => ({ ...track("trk-1"), visibility: "published" as const }),
    ),
    restore(
      tracksRepository,
      "upsert",
      (async (nextTrack) => {
        if (nextTrack.visibility === "unpublished") {
          unpublishedTracks.push(nextTrack.id);
        }
        return nextTrack;
      }) as typeof tracksRepository.upsert,
    ),
  ];

  try {
    const updated = await releasesService.updateRelease(walletAddress, "rel-1", {
      status: "draft",
    });

    assert.deepEqual(unpublishedTracks, ["trk-1"]);
    assert.equal(updated.tracks[0]?.track.visibility, "unpublished");
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("release tracklists allow only one focus track and unique positions", async () => {
  const currentRelease = release("ep");
  const assignments = [
    { release_id: "rel-1", track_id: "trk-1", track_number: 1, disc_number: 1, is_focus_track: false },
    { release_id: "rel-1", track_id: "trk-2", track_number: 2, disc_number: 1, is_focus_track: false },
  ];
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => currentRelease),
    restore(releasesRepository, "listTracks", async () => assignments),
    restore(tracksRepository, "findById", async (trackId: string) => track(trackId)),
  ];

  try {
    await assert.rejects(
      () =>
        releasesService.reorderReleaseTracks(walletAddress, currentRelease.id, {
          items: [
            { trackId: "trk-1", trackNumber: 1, discNumber: 1, isFocusTrack: true },
            { trackId: "trk-2", trackNumber: 2, discNumber: 1, isFocusTrack: true },
          ],
        }),
      /only one focus track/,
    );
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("published and scheduled tracklists require an explicit revision",async () => {
  for (const status of ["published","scheduled"] as const) {
    const current={...release("single"),status};
    const cleanup=[restore(usersService,"getProfile",async () => artistProfile),restore(releasesRepository,"findById",async () => current),restore(tracksRepository,"findById",async () => track("trk-1"))];
    try {
      await assert.rejects(releasesService.addTrackToRelease(walletAddress,current.id,{trackId:"trk-1"}),/Start a revision/);
      await assert.rejects(releasesService.updateRelease(walletAddress,current.id,{title:"Changed"}),/Start a revision/);
      await assert.rejects(releasesService.removeTrackFromRelease(walletAddress,current.id,"trk-1"),/Start a revision/);
    } finally {cleanup.reverse().forEach(fn => fn());}
  }
});

test("scheduled revision edits stay private while the original schedule and artwork are served",async () => {
  const live={...release("single"),status:"scheduled" as const,releaseDate:"2030-12-01T13:00:00Z",trackCount:1,tracks:[{trackId:"trk-1",trackNumber:1,discNumber:1,isFocusTrack:false,track:track("trk-1")}]};
  const current={...live,title:"Unfinished revision",type:"ep" as const,tracks:undefined,liveVersion:live};
  const cleanup=[restore(usersService,"getProfile",async () => artistProfile),restore(releasesRepository,"findById",async () => current),restore(releasesRepository,"listTracks",async () => []),restore(releasesRepository,"upsert",async release => release)];
  try {
    const updated=await releasesService.updateRelease(walletAddress,current.id,{title:"Saved revision"});
    assert.equal(updated.title,"Saved revision");assert.equal(updated.hasRevision,true);
    const visible=await releasesService.getRelease(current.id);
    assert.equal(visible?.title,live.title);assert.equal(visible?.type,"single");assert.equal(visible?.releaseDate,live.releaseDate);assert.deepEqual(visible?.tracks,[]);
    assert.ok(!Object.hasOwn(visible!,"liveVersion"));
  } finally {cleanup.reverse().forEach(fn => fn());}
});

test("release plan persists its song count and rejects incompatible formats", async () => {
  let persisted: ReleaseSummary | undefined;
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "upsert", async (next) => {
      persisted = next;
      return next;
    }),
    restore(releasesRepository, "listTracks", async () => []),
  ];
  try {
    const created = await releasesService.createRelease(walletAddress, {
      title: "Night Songs",
      type: "ep",
      expectedTrackCount: 4,
    });
    assert.equal(created.expectedTrackCount, 4);
    assert.equal(persisted?.expectedTrackCount, 4);
    await assert.rejects(
      releasesService.createRelease(walletAddress, {
        title: "Night Songs",
        type: "ep",
        expectedTrackCount: 8,
      }),
      /song count that matches/,
    );
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("adding another song never silently converts a Single into an EP", async () => {
  const current = { ...release("single"), expectedTrackCount: 1 };
  let assigned = false;
  const cleanup = [
    restore(usersService, "getProfile", async () => artistProfile),
    restore(releasesRepository, "findById", async () => current),
    restore(releasesRepository, "listByArtist", async () => [current]),
    restore(releasesRepository, "listTracks", async () => [
      {
        release_id: current.id,
        track_id: "trk-1",
        track_number: 1,
        disc_number: 1,
        is_focus_track: false,
      },
    ]),
    restore(tracksRepository, "findById", async () => track("trk-2")),
    restore(releasesRepository, "assignTrack", async () => {
      assigned = true;
    }),
  ];
  try {
    await assert.rejects(
      releasesService.addTrackToRelease(walletAddress, current.id, {
        trackId: "trk-2",
      }),
      /song count before adding more/,
    );
    assert.equal(current.type, "single");
    assert.equal(assigned, false);
  } finally {
    cleanup.reverse().forEach((restoreOriginal) => restoreOriginal());
  }
});

test("publication rejects a tracklist missing planned songs", () => {
  const current = { ...release("ep"), expectedTrackCount: 4 };
  const assignments = [1, 2].map((n) => ({
    release_id: current.id,
    track_id: `trk-${n}`,
    track_number: n,
    disc_number: 1,
    is_focus_track: false,
  }));
  assert.throws(
    () =>
      validatePublication(current, assignments, [
        track("trk-1"),
        track("trk-2"),
      ]),
    /Add all planned songs/,
  );
});
