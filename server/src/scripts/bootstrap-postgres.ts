import type {
  ArchiveRecord,
  EntitlementRecord,
  PlaybackSession,
  TrackSummary,
  UploadSession,
  UserProfile,
} from "@music-city/shared";

import { env } from "../config/env.js";
import { databaseService } from "../services/database.service.js";
import { createJsonStore } from "../services/json-store.service.js";
import { archivesRepository } from "../modules/archives/archives.repository.js";
import { entitlementsRepository } from "../modules/entitlements/entitlements.repository.js";
import { playbackRepository } from "../modules/playback/playback.repository.js";
import { tracksRepository } from "../modules/tracks/tracks.repository.js";
import { uploadsRepository } from "../modules/uploads/uploads.repository.js";
import { usersRepository } from "../modules/users/users.repository.js";

const usersStore = createJsonStore<UserProfile>("users");
const tracksStore = createJsonStore<TrackSummary>("tracks");
const uploadSessionsStore = createJsonStore<UploadSession>("upload-sessions");
const playbackSessionsStore = createJsonStore<PlaybackSession>("playback-sessions");
const entitlementsStore = createJsonStore<EntitlementRecord>("entitlements");
const archivesStore = createJsonStore<ArchiveRecord>("archives");

const importRows = async <T>(
  label: string,
  rows: T[],
  upsert: (row: T) => Promise<unknown>,
) => {
  for (const row of rows) {
    await upsert(row);
  }

  console.log(`[bootstrap][postgres] imported ${rows.length} ${label}`);
};

const main = async () => {
  await databaseService.initialize();

  const existingUsers = await databaseService.countRows("users");

  if (existingUsers > 0) {
    console.log(
      "[bootstrap][postgres] skipping JSON import because the database already contains users",
    );
    return;
  }

  const users = usersStore.list();
  const tracks = tracksStore.list();
  const uploadSessions = uploadSessionsStore.list();
  const playbackSessions = playbackSessionsStore.list();
  const entitlements = entitlementsStore.list();
  const archives = archivesStore.list();

  await importRows("users", users, (row) => usersRepository.upsert(row));
  await importRows("tracks", tracks, (row) => tracksRepository.upsert(row));
  await importRows("upload sessions", uploadSessions, (row) =>
    uploadsRepository.upsert(row),
  );
  await importRows("playback sessions", playbackSessions, (row) =>
    playbackRepository.upsert(row),
  );
  await importRows("entitlements", entitlements, (row) =>
    entitlementsRepository.upsert(row),
  );
  await importRows("archives", archives, (row) => archivesRepository.upsert(row));

  console.log("[bootstrap][postgres] complete");
};

main().catch((error) => {
  console.error("[bootstrap][postgres] failed", error);
  process.exitCode = 1;
}).finally(async () => {
  await databaseService.close();
});
