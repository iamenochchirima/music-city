import { z } from "zod";

export const createPlaybackSessionSchema = z.object({
  trackId: z.string().min(1),
});
export type CreatePlaybackSessionInput = z.infer<
  typeof createPlaybackSessionSchema
>;

export const recordPlaybackEventSchema = z.object({
  eventType: z.enum(["progress", "completed"]),
  positionSeconds: z.number().min(0).optional(),
  durationSeconds: z.number().min(0).optional(),
});
export type RecordPlaybackEventInput = z.infer<typeof recordPlaybackEventSchema>;

export interface PlaybackSession {
  id: string;
  trackId: string;
  artistId?: string;
  listenerUserId?: string;
  provider: "local" | "mux";
  streamUrl: string;
  playbackId?: string;
  token: string;
  expiresAt: string;
  createdAt?: string;
  maxPositionSeconds?: number;
  qualifiedStreamCountedAt?: string;
  completedAt?: string;
}
