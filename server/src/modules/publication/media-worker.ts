import { muxService } from "../../services/mux.service.js";
import { storageService } from "../../services/storage.service.js";
import type { UploadSession } from "@music-city/shared";
import { randomUUID, createHash } from "node:crypto";
import type Mux from "@mux/mux-node";
import type { TrackSummary } from "@music-city/shared";
import { databaseService } from "../../services/database.service.js";
import { tracksService } from "../tracks/tracks.service.js";
import { mediaService } from "../media/media.service.js";
import {
  publicationService,
  recordingGeneration,
} from "./publication.service.js";
import { logger } from "../../utils/logger.js";

type Job = {
  id: string;
  kind: "media" | "event" | "publication" | "ingest";
  payload: {
    sessionId?: string;
    trackId?: string;
    releaseId?: string;
    event?: Mux.Webhooks.UnwrapWebhookEvent;
  };
  attempts: number;
  lease_token: string;
};
export const mediaWorker = {
  async receive(event: Mux.Webhooks.UnwrapWebhookEvent) {
    await databaseService.transaction(async (client) => {
      await client.query(
        "INSERT INTO media_jobs(id,kind,payload) VALUES($1,'event',$2::jsonb) ON CONFLICT(id) DO NOTHING",
        [`event:${event.id}`, JSON.stringify({ event })],
      );
    });
  },
  async scan() {
    await publicationService.advanceExistingSchedules();
    await databaseService.transaction(async (client) => {
      const tracks = (
        await client.query<{ payload: TrackSummary }>(
          "SELECT payload FROM tracks WHERE payload->>'mediaProvider'='mux' AND payload->>'playbackReady'='false' AND payload->>'status'<>'failed' ORDER BY payload->>'updatedAt',id LIMIT 100",
        )
      ).rows;
      for (const { payload: t } of tracks) {
        const key = createHash("sha256")
          .update(recordingGeneration(t))
          .digest("hex")
          .slice(0, 24);
        await client.query(
          "INSERT INTO media_jobs(id,kind,payload) VALUES($1,'media',$2::jsonb) ON CONFLICT(id) DO UPDATE SET state='queued',available_at=NOW(),attempts=0 WHERE media_jobs.state='done'",
          [`media:${t.id}:${key}`, JSON.stringify({ trackId: t.id })],
        );
      }
      const requests = (
        await client.query<{ id: string; release_id: string }>(
          "SELECT id,release_id FROM publication_requests WHERE state IN ('processing','scheduled') ORDER BY updated_at LIMIT 100",
        )
      ).rows;
      for (const r of requests)
        await client.query(
          "INSERT INTO media_jobs(id,kind,payload) VALUES($1,'publication',$2::jsonb) ON CONFLICT(id) DO UPDATE SET state='queued',available_at=NOW(),attempts=0 WHERE media_jobs.state='done'",
          [`publication:${r.id}`, JSON.stringify({ releaseId: r.release_id })],
        );
    });
  },
  async runOne() {
    const token = randomUUID();
    const job = await databaseService.transaction(async (client) => {
      const row = (
        await client.query<Job>(
          "SELECT * FROM media_jobs WHERE (state='queued' AND available_at<=NOW()) OR (state='running' AND lease_until<NOW()) ORDER BY available_at,id FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!row) return null;
      await client.query(
        "UPDATE media_jobs SET state='running',lease_until=NOW()+INTERVAL '90 seconds',lease_token=$2,attempts=attempts+1,updated_at=NOW() WHERE id=$1",
        [row.id, token],
      );
      return { ...row, attempts: row.attempts + 1, lease_token: token };
    });
    if (!job) return false;
    try {
      if (
        job.kind === "ingest" &&
        job.payload.sessionId &&
        job.payload.trackId
      ) {
        const session = await databaseService.findPayloadById<UploadSession>(
          "upload_sessions",
          job.payload.sessionId,
        );
        const track = await databaseService.findPayloadById<TrackSummary>(
          "tracks",
          job.payload.trackId,
        );
        if (
          session?.storageKey &&
          track?.masterStorageKey === session.storageKey
        ) {
          const passthrough = `${track.id}|${session.id}`;
          let asset = session.remoteUploadId
            ? await muxService.getAsset(session.remoteUploadId)
            : await muxService.findAssetByPassthrough(passthrough);
          if (!asset) {
            if (job.attempts > 1)
              throw new Error(
                "Asset creation outcome is uncertain. Retaining this upload for reconciliation.",
              );
            asset = await muxService.createAssetFromUrl(
              storageService.getDownloadUrl(session.storageKey, "s3", 3600),
              passthrough,
            );
          }
          await databaseService.transaction(async (client) => {
            await client.query(
              "UPDATE upload_sessions SET payload=payload || $2::jsonb WHERE id=$1",
              [session.id, JSON.stringify({ remoteUploadId: asset!.id })],
            );
            await client.query(
              "UPDATE tracks SET payload=payload || $3::jsonb WHERE id=$1 AND payload->>'masterStorageKey'=$2",
              [
                track.id,
                session.storageKey,
                JSON.stringify({
                  muxAssetId: asset!.id,
                  muxAssetStatus: "asset_created",
                }),
              ],
            );
          });
          await tracksService.syncMediaFromWorker(track.id);
        }
      }
      if (job.kind === "event" && job.payload.event)
        await mediaService.handleMuxWebhook(job.payload.event);
      if (job.kind === "media" && job.payload.trackId)
        await tracksService.syncMediaFromWorker(job.payload.trackId);
      if (job.kind === "publication" && job.payload.releaseId)
        await publicationService.process(job.payload.releaseId);
      await databaseService.transaction(async (client) => {
        await client.query(
          "UPDATE media_jobs SET state='done',lease_until=NULL,error=NULL,updated_at=NOW() WHERE id=$1 AND lease_token=$2",
          [job.id, token],
        );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Background task failed";
      await databaseService.transaction(async (client) => {
        await client.query(
          "UPDATE media_jobs SET state=$3,error=$4,lease_until=NULL,available_at=NOW()+($5 * INTERVAL '1 second'),updated_at=NOW() WHERE id=$1 AND lease_token=$2",
          [
            job.id,
            token,
            job.attempts >= 12 ? "failed" : "queued",
            message,
            Math.min(300, 2 ** job.attempts),
          ],
        );
        if(job.attempts>=12 && job.kind==="ingest" && job.payload.trackId)await client.query("UPDATE tracks SET status='failed',payload=payload || '{\"status\":\"failed\",\"runtime\":\"Audio needs attention\"}'::jsonb WHERE id=$1 AND payload->>'playbackReady'='false'",[job.payload.trackId]);
        if (job.attempts >= 12 && job.payload.trackId)
          await client.query(
            "UPDATE publication_requests SET state='failed',error='Audio status could not be confirmed. Try publishing again.',updated_at=NOW() WHERE state IN ('processing','scheduled') AND release_id IN (SELECT release_id FROM release_tracks WHERE track_id=$1)",
            [job.payload.trackId],
          );
        if (job.attempts >= 12 && job.payload.releaseId)
          await client.query(
            "UPDATE publication_requests SET state='failed',error='Publication could not finish. Review and publish again.',updated_at=NOW() WHERE release_id=$1 AND state IN ('processing','scheduled')",
            [job.payload.releaseId],
          );
      });
      logger.warn("Background task retry", {
        id: job.id,
        attempts: job.attempts,
        error: message,
      });
    }
    return true;
  },
};
