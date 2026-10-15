import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { PoolClient } from "pg";
import type {
  PublicationStatus,
  ReleaseSummary,
  TrackSummary,
} from "@music-city/shared";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { releasesService } from "../releases/releases.service.js";
import type { StoredRelease } from "../releases/releases.repository.js";

type Assignment = {
  track_id: string;
  track_number: number;
  disc_number: number;
  is_focus_track: boolean;
};
type RequestRow = {
  id: string;
  state: PublicationStatus["state"];
  mode: "published" | "scheduled";
  release_at: Date | null;
  target: { fingerprint: string };
  error: string | null;
};
const inputSchema = z.object({
  mode: z.enum(["published", "scheduled"]),
  releaseAt: z.string().datetime().optional(),
});
export const recordingGeneration = (track: TrackSummary) =>
  track.muxUploadId || track.masterStorageKey || track.muxAssetId || "";
export function publicationFingerprint(
  release: ReleaseSummary,
  assignments: Assignment[],
  tracks: TrackSummary[],
) {
  const recordings = assignments.map((a) => {
    const t = tracks.find((t) => t.id === a.track_id)!;
    return [
      a.track_id,
      a.track_number,
      a.disc_number,
      a.is_focus_track,
      recordingGeneration(t),
      t.title,
      t.artistId,
      t.artistName,
      t.genre.trim() || release.genre,
      t.isExplicit,
      t.credits ?? [],
      t.isrc ?? "",
      t.recordLabel ?? "",
    ];
  });
  return createHash("sha256")
    .update(
      JSON.stringify([
        release.artistId,
        release.title,
        release.artistName,
        release.genre,
        release.type,
        release.description ?? "",
        release.recordLabel ?? "",
        release.coverStorageKey ?? "",
        release.coverImageUrl ?? "",
        recordings,
      ]),
    )
    .digest("hex");
}
export function validatePublication(
  release: ReleaseSummary,
  assignments: Assignment[],
  tracks: TrackSummary[],
) {
  if (
    !release.title.trim() ||
    !release.artistName.trim() ||
    !release.genre.trim()
  )
    throw new HttpError(
      400,
      "Add the release title, artist, and genre before publishing",
    );
  if (!release.coverStorageKey && !release.coverImageUrl)
    throw new HttpError(400, "Add release artwork before publishing");
  const count = assignments.length;
  if (
    !count ||
    (release.type === "single" && count !== 1) ||
    (release.type === "ep" && (count < 2 || count > 6)) ||
    (release.type === "album" && count < 7)
  )
    throw new HttpError(
      400,
      "Choose a release format that matches the number of songs",
    );
  if (release.expectedTrackCount && count !== release.expectedTrackCount)
    throw new HttpError(400, "Add all planned songs or update the song count before publishing");
  if (
    new Set(assignments.map((a) => a.track_number)).size !== count ||
    assignments.some((a) => a.track_number < 1 || a.disc_number < 1) ||
    assignments.filter((a) => a.is_focus_track).length > 1
  )
    throw new HttpError(400, "Check the track order");
  if (
    tracks.length !== count ||
    tracks.some(
      (t) =>
        t.artistId !== release.artistId ||
        !t.title.trim() ||
        !recordingGeneration(t),
    )
  )
    throw new HttpError(400, "Finish uploading every song before publishing");
}
const status = (r: RequestRow): PublicationStatus => ({
  id: r.id,
  state: r.state,
  mode: r.mode,
  releaseAt: r.release_at?.toISOString() ?? null,
  error: r.error,
});
async function assignmentsAndTracks(client: PoolClient, releaseId: string) {
  const assignments = (
    await client.query<Assignment>(
      "SELECT track_id,track_number,disc_number,is_focus_track FROM release_tracks WHERE release_id=$1 ORDER BY track_number,track_id FOR UPDATE",
      [releaseId],
    )
  ).rows;
  const rows = (
    await client.query<{ payload: TrackSummary }>(
      "SELECT payload FROM tracks WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
      [assignments.map((a) => a.track_id)],
    )
  ).rows;
  return { assignments, tracks: rows.map((r) => r.payload) };
}
export const publicationService = {
  async advanceExistingSchedules() {
    await databaseService.transaction(async (client) => {
      const rows = (
        await client.query<{ id: string; payload: StoredRelease }>(
          "SELECT id,payload FROM releases WHERE status='scheduled' AND release_date<=NOW() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 50",
        )
      ).rows;
      for (const row of rows) {
        const current = row.payload;
        const live = current.liveVersion;
        const ids = live
          ? live.tracks.map((t) => t.trackId)
          : (
              await client.query<{ track_id: string }>(
                "SELECT track_id FROM release_tracks WHERE release_id=$1",
                [row.id],
              )
            ).rows.map((t) => t.track_id);
        const tracks = (
          await client.query<{ payload: TrackSummary }>(
            "SELECT payload FROM tracks WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE",
            [ids],
          )
        ).rows.map((t) => t.payload);
        if (
          !ids.length ||
          tracks.length !== ids.length ||
          (!live && tracks.some((t) => !t.playbackReady))
        )
          continue;
        const timestamp = new Date().toISOString();
        const published = live
          ? {
              ...current,
              status: "published",
              liveVersion: {
                ...live,
                status: "published",
                publishedAt: live.publishedAt ?? timestamp,
              },
            }
          : {
              ...current,
              status: "published",
              publishedAt: current.publishedAt ?? timestamp,
            };
        for (const id of ids)
          await client.query(
            'UPDATE tracks SET visibility=\'published\',payload=payload || \'{"visibility":"published","priceLabel":"Published"}\'::jsonb WHERE id=$1',
            [id],
          );
        await client.query(
          "UPDATE releases SET status='published',payload=$2::jsonb WHERE id=$1",
          [row.id, JSON.stringify(published)],
        );
      }
    });
  },
  async latest(releaseId: string) {
    return databaseService.transaction(async (client) => {
      const r = (
        await client.query<RequestRow>(
          "SELECT * FROM publication_requests WHERE release_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",
          [releaseId],
        )
      ).rows[0];
      return r ? status(r) : undefined;
    });
  },
  async cancel(wallet: string, releaseId: string) {
    const owned = await releasesService.getManageRelease(wallet, releaseId);
    if (!owned) throw new HttpError(404, "Release not found");
    await databaseService.transaction(async (client) => {
      await client.query("SELECT id FROM releases WHERE id=$1 FOR UPDATE", [
        releaseId,
      ]);
      await client.query(
        "UPDATE publication_requests SET state='cancelled',updated_at=NOW() WHERE release_id=$1 AND state IN ('processing','scheduled')",
        [releaseId],
      );
    });
  },
  async request(wallet: string, releaseId: string, input: unknown) {
    const parsed = inputSchema.parse(input);
    if (
      parsed.mode === "scheduled" &&
      (!parsed.releaseAt || Date.parse(parsed.releaseAt) <= Date.now())
    )
      throw new HttpError(400, "Choose a future release time");
    const owned = await releasesService.getManageRelease(wallet, releaseId);
    if (!owned) throw new HttpError(404, "Release not found");
    const requestId = await databaseService.transaction(async (client) => {
      const release = (
        await client.query<{ payload: StoredRelease }>(
          "SELECT payload FROM releases WHERE id=$1 AND artist_id=$2 FOR UPDATE",
          [releaseId, owned.artistId],
        )
      ).rows[0]?.payload;
      if (!release) throw new HttpError(404, "Release not found");
      const active = (
        await client.query<RequestRow>(
          "SELECT * FROM publication_requests WHERE release_id=$1 AND state IN ('processing','scheduled') FOR UPDATE",
          [releaseId],
        )
      ).rows[0];
      const { assignments, tracks } = await assignmentsAndTracks(
        client,
        releaseId,
      );
      validatePublication(release, assignments, tracks);
      const fingerprint = publicationFingerprint(release, assignments, tracks);
      if (active) {
        if (
          active.target.fingerprint !== fingerprint ||
          active.mode !== parsed.mode ||
          (active.release_at?.toISOString() ?? null) !==
            (parsed.mode === "scheduled" ? (parsed.releaseAt ?? null) : null)
        )
          throw new HttpError(
            409,
            "Cancel the pending publication before changing it",
          );
        return active.id;
      }
      if (!release.liveVersion && release.status === "published") {
        const previous=(await client.query<RequestRow>("SELECT * FROM publication_requests WHERE release_id=$1 AND state='published' ORDER BY created_at DESC LIMIT 1",[releaseId])).rows[0];
        if(previous?.target.fingerprint===fingerprint && previous.mode===parsed.mode)return previous.id;
      }
      if (!release.liveVersion && release.status === "published")
        throw new HttpError(
          409,
          "Start a revision before updating a live release",
        );
      if (
        tracks.some(
          (t) => t.status === "failed" || t.muxAssetStatus === "errored",
        )
      )
        throw new HttpError(400, "Replace failed audio before publishing");
      const id = randomUUID();
      await client.query(
        "INSERT INTO publication_requests(id,release_id,artist_id,state,mode,release_at,target) VALUES($1,$2,$3,'processing',$4,$5,$6::jsonb)",
        [
          id,
          releaseId,
          release.artistId,
          parsed.mode,
          parsed.mode === "scheduled" ? parsed.releaseAt : null,
          JSON.stringify({
            fingerprint,
            release,
            assignments,
            recordings: tracks.map((t) => ({
              id: t.id,
              generation: recordingGeneration(t),
            })),
          }),
        ],
      );
      await client.query(
        "UPDATE media_jobs SET state='queued',attempts=0,available_at=NOW() WHERE kind='media' AND state='failed' AND payload->>'trackId'=ANY($1::text[])",
        [tracks.map((t) => t.id)],
      );
      await client.query(
        "INSERT INTO media_jobs(id,kind,payload) VALUES($1,'publication',$2::jsonb)",
        [`publication:${id}`, JSON.stringify({ releaseId })],
      );
      return id;
    });
    await this.process(releaseId);
    const latest = await this.latest(releaseId);
    if (latest?.id !== requestId)
      throw new HttpError(409, "Publication changed. Reload the release.");
    return latest;
  },
  async process(releaseId: string) {
    return databaseService.transaction(async (client) => {
      const release = (
        await client.query<{ payload: StoredRelease }>(
          "SELECT payload FROM releases WHERE id=$1 FOR UPDATE",
          [releaseId],
        )
      ).rows[0]?.payload;
      if (!release) return;
      const req = (
        await client.query<RequestRow>(
          "SELECT * FROM publication_requests WHERE release_id=$1 AND state IN ('processing','scheduled') FOR UPDATE",
          [releaseId],
        )
      ).rows[0];
      if (!req) return;
      const finish = async (state: string, error: string | null = null) => {
        await client.query(
          "UPDATE publication_requests SET state=$2,error=$3,updated_at=NOW() WHERE id=$1",
          [req.id, state, error],
        );
      };
      const { assignments, tracks } = await assignmentsAndTracks(
        client,
        releaseId,
      );
      try {
        validatePublication(release, assignments, tracks);
      } catch (error) {
        await finish(
          "failed",
          error instanceof Error ? error.message : "Check release details",
        );
        return;
      }
      if (
        publicationFingerprint(release, assignments, tracks) !==
        req.target.fingerprint
      ) {
        await finish("cancelled", "Release changed. Review and publish again.");
        return;
      }
      if (
        tracks.some(
          (t) => t.status === "failed" || t.muxAssetStatus === "errored",
        )
      ) {
        await finish(
          "failed",
          "Audio processing failed. Replace the affected song and publish again.",
        );
        return;
      }
      const ready = tracks.every((t) => t.playbackReady);
      if (req.mode === "scheduled") {
        if (
          !ready &&
          req.release_at &&
          req.release_at.getTime() <= Date.now()
        ) {
          await finish(
            "failed",
            "Audio missed the release time. Choose a new date or publish now.",
          );
          return;
        }
        if (req.release_at && req.release_at.getTime() > Date.now()) {
          await finish(ready ? "scheduled" : "processing");
          return;
        }
      }
      if (!ready) return;
      const timestamp = new Date().toISOString();
      const oldIds = release.liveVersion?.tracks.map((t) => t.trackId) ?? [];
      const removedIds = oldIds.filter(
        (id) => !tracks.some((t) => t.id === id),
      );
      const remainingPublic = (
        await client.query<{ track_id: string }>(
          "SELECT DISTINCT rt.track_id FROM release_tracks rt JOIN releases r ON r.id=rt.release_id WHERE rt.track_id=ANY($1::text[]) AND r.id<>$2 AND r.status='published'",
          [removedIds, releaseId],
        )
      ).rows.map((r) => r.track_id);
      for (const t of tracks)
        await client.query(
          "UPDATE tracks SET visibility='published',payload=payload || $2::jsonb WHERE id=$1",
          [
            t.id,
            JSON.stringify({
              visibility: "published",
              priceLabel: "Published",
              genre: t.genre.trim() || release.genre,
              updatedAt: timestamp,
            }),
          ],
        );
      for (const id of removedIds.filter((id) => !remainingPublic.includes(id)))
        await client.query(
          "UPDATE tracks SET visibility='unpublished',payload=payload || $2::jsonb WHERE id=$1",
          [
            id,
            JSON.stringify({
              visibility: "unpublished",
              priceLabel: "Unpublished",
              updatedAt: timestamp,
            }),
          ],
        );
      const {
        liveVersion: _live,
        publication: _status,
        hasRevision: _revision,
        ...base
      } = release;
      const published = {
        ...base,
        status: "published",
        trackCount: tracks.length,
        releaseDate:
          req.release_at?.toISOString() ?? release.releaseDate ?? timestamp,
        publishedAt: release.publishedAt ?? timestamp,
        updatedAt: timestamp,
      };
      await client.query(
        "UPDATE releases SET status='published',release_date=$2,payload=$3::jsonb WHERE id=$1",
        [releaseId, published.releaseDate, JSON.stringify(published)],
      );
      await finish("published");
    });
  },
};
