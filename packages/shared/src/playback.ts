import { z } from "zod";

export const GUEST_PLAYBACK_SECONDS = 25 * 60;

export const createPlaybackSessionSchema = z.object({
  trackId: z.string().min(1),
  preloadTicket: z.string().max(4096).optional(),
});
export type CreatePlaybackSessionInput = z.infer<
  typeof createPlaybackSessionSchema
>;

export const recordPlaybackEventSchema = z.object({
  eventType: z.enum(["progress", "completed"]),
  positionSeconds: z.number().min(0).optional(),
  durationSeconds: z.number().min(0).optional(),
  listenedSeconds: z.number().positive().max(60).optional(),
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
  listenedSeconds?: number;
  lastPlaybackEventAt?: string;
  qualifiedStreamCountedAt?: string;
  completedAt?: string;
  guestIdHash?: string;
  isGuest?: boolean;
  guestLimitSeconds?: number;
  guestRemainingSeconds?: number;
  guestBudgetRemainingSeconds?: number;
  guestTrackDurationSeconds?: number;
}

export interface PlaybackPreload {
  ticket: string;
  iv: string;
  ciphertext: string;
  expiresAt: string;
}
