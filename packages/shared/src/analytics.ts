import { z } from "zod";

export const analyticsEventTypeSchema = z.enum([
  "follow_artist",
  "unfollow_artist",
  "track_playback_started",
  "track_playback_progress",
  "track_playback_completed",
  "track_playback_qualified",
  "like_track",
  "unlike_track",
  "save_track",
  "unsave_track",
  "view_release",
  "create_playlist",
  "add_playlist_track",
  "remove_playlist_track",
]);
export type AnalyticsEventType = z.infer<typeof analyticsEventTypeSchema>;

const analyticsEventBaseSchema = z.object({
  id: z.string().min(1),
  eventType: analyticsEventTypeSchema,
  occurredAt: z.string().min(1),
  actorUserId: z.string().min(1).optional(),
  artistId: z.string().min(1).optional(),
  trackId: z.string().min(1).optional(),
  releaseId: z.string().min(1).optional(),
  playlistId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  source: z.string().min(1),
  surface: z.string().min(1).optional(),
});

export const followArtistEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("follow_artist"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1),
});
export type FollowArtistEvent = z.infer<typeof followArtistEventSchema>;

export const unfollowArtistEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("unfollow_artist"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1),
});
export type UnfollowArtistEvent = z.infer<typeof unfollowArtistEventSchema>;

export const trackPlaybackStartedEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("track_playback_started"),
  actorUserId: z.string().min(1).optional(),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
  sessionId: z.string().min(1),
});
export type TrackPlaybackStartedEvent = z.infer<
  typeof trackPlaybackStartedEventSchema
>;

export const trackPlaybackProgressEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("track_playback_progress"),
  actorUserId: z.string().min(1).optional(),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
  sessionId: z.string().min(1),
  positionSeconds: z.number().min(0).optional(),
  durationSeconds: z.number().min(0).optional(),
});
export type TrackPlaybackProgressEvent = z.infer<
  typeof trackPlaybackProgressEventSchema
>;

export const trackPlaybackCompletedEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("track_playback_completed"),
  actorUserId: z.string().min(1).optional(),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
  sessionId: z.string().min(1),
  positionSeconds: z.number().min(0).optional(),
  durationSeconds: z.number().min(0).optional(),
});
export type TrackPlaybackCompletedEvent = z.infer<
  typeof trackPlaybackCompletedEventSchema
>;

export const trackPlaybackQualifiedEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("track_playback_qualified"),
  actorUserId: z.string().min(1).optional(),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
  sessionId: z.string().min(1),
  positionSeconds: z.number().min(0).optional(),
  durationSeconds: z.number().min(0).optional(),
  qualifiedBy: z.enum(["started", "progress", "completed"]),
});
export type TrackPlaybackQualifiedEvent = z.infer<
  typeof trackPlaybackQualifiedEventSchema
>;

export const likeTrackEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("like_track"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
});
export type LikeTrackEvent = z.infer<typeof likeTrackEventSchema>;

export const unlikeTrackEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("unlike_track"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
});
export type UnlikeTrackEvent = z.infer<typeof unlikeTrackEventSchema>;

export const saveTrackEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("save_track"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
});
export type SaveTrackEvent = z.infer<typeof saveTrackEventSchema>;

export const unsaveTrackEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("unsave_track"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1),
  trackId: z.string().min(1),
});
export type UnsaveTrackEvent = z.infer<typeof unsaveTrackEventSchema>;

export const releaseViewEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("view_release"),
  actorUserId: z.string().min(1).optional(),
  artistId: z.string().min(1),
  releaseId: z.string().min(1),
});
export type ReleaseViewEvent = z.infer<typeof releaseViewEventSchema>;

export const playlistCreatedEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("create_playlist"),
  actorUserId: z.string().min(1),
  playlistId: z.string().min(1),
});
export type PlaylistCreatedEvent = z.infer<typeof playlistCreatedEventSchema>;

export const playlistTrackAddedEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("add_playlist_track"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1).optional(),
  trackId: z.string().min(1),
  playlistId: z.string().min(1),
});
export type PlaylistTrackAddedEvent = z.infer<
  typeof playlistTrackAddedEventSchema
>;

export const playlistTrackRemovedEventSchema = analyticsEventBaseSchema.extend({
  eventType: z.literal("remove_playlist_track"),
  actorUserId: z.string().min(1),
  artistId: z.string().min(1).optional(),
  trackId: z.string().min(1),
  playlistId: z.string().min(1),
});
export type PlaylistTrackRemovedEvent = z.infer<
  typeof playlistTrackRemovedEventSchema
>;

export const analyticsEventSchema = z.discriminatedUnion("eventType", [
  followArtistEventSchema,
  unfollowArtistEventSchema,
  trackPlaybackStartedEventSchema,
  trackPlaybackProgressEventSchema,
  trackPlaybackCompletedEventSchema,
  trackPlaybackQualifiedEventSchema,
  likeTrackEventSchema,
  unlikeTrackEventSchema,
  saveTrackEventSchema,
  unsaveTrackEventSchema,
  releaseViewEventSchema,
  playlistCreatedEventSchema,
  playlistTrackAddedEventSchema,
  playlistTrackRemovedEventSchema,
]);
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const artistFollowStateSchema = z.object({
  following: z.boolean(),
  followerCount: z.number().int().min(0),
});
export type ArtistFollowState = z.infer<typeof artistFollowStateSchema>;

export const trackLikeStateSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int().min(0),
});
export type TrackLikeState = z.infer<typeof trackLikeStateSchema>;

export const trackSaveStateSchema = z.object({
  saved: z.boolean(),
  saveCount: z.number().int().min(0),
});
export type TrackSaveState = z.infer<typeof trackSaveStateSchema>;

export const artistAnalyticsTrackSchema = z.object({
  trackId: z.string().min(1),
  title: z.string().min(1),
  releaseTitle: z.string().optional(),
  access: z.enum(["private", "subscribers", "purchase_required", "public"]),
  status: z.enum([
    "draft",
    "awaiting_upload",
    "uploaded",
    "processing",
    "published",
    "failed",
  ]),
  plays: z.number().int().min(0),
  likes: z.number().int().min(0),
  uniqueListeners: z.number().int().min(0),
});
export type ArtistAnalyticsTrack = z.infer<typeof artistAnalyticsTrackSchema>;

export const trackAnalyticsSummarySchema = z.object({
  trackId: z.string().min(1),
  artistId: z.string().min(1),
  plays: z.number().int().min(0),
  likes: z.number().int().min(0),
  saves: z.number().int().min(0),
  uniqueListeners: z.number().int().min(0),
});
export type TrackAnalyticsSummary = z.infer<typeof trackAnalyticsSummarySchema>;

export const artistAnalyticsDailyPointSchema = z.object({
  date: z.string().min(1),
  streams: z.number().int().min(0),
});
export type ArtistAnalyticsDailyPoint = z.infer<
  typeof artistAnalyticsDailyPointSchema
>;

export const artistAnalyticsSummarySchema = z.object({
  artistId: z.string().min(1),
  followerCount: z.number().int().min(0),
  totalStreams: z.number().int().min(0),
  totalLikes: z.number().int().min(0),
  uniqueListeners: z.number().int().min(0),
  totalTracks: z.number().int().min(0),
  publishedTracks: z.number().int().min(0),
  streamsLast7Days: z.number().int().min(0),
  streamsLast30Days: z.number().int().min(0),
  topTracks: z.array(artistAnalyticsTrackSchema),
  dailyStreams: z.array(artistAnalyticsDailyPointSchema),
});
export type ArtistAnalyticsSummary = z.infer<
  typeof artistAnalyticsSummarySchema
>;

export const releaseAnalyticsSummarySchema = z.object({
  releaseId: z.string().min(1),
  streams: z.number().int().min(0),
  likes: z.number().int().min(0),
  saves: z.number().int().min(0),
});
export type ReleaseAnalyticsSummary = z.infer<
  typeof releaseAnalyticsSummarySchema
>;

export const playlistAnalyticsSummarySchema = z.object({
  playlistId: z.string().min(1),
  trackAdds: z.number().int().min(0),
  trackRemovals: z.number().int().min(0),
});
export type PlaylistAnalyticsSummary = z.infer<
  typeof playlistAnalyticsSummarySchema
>;

export const audienceSummarySchema = z.object({
  uniqueListeners: z.number().int().min(0),
  authenticatedListeners: z.number().int().min(0),
});
export type AudienceSummary = z.infer<typeof audienceSummarySchema>;
