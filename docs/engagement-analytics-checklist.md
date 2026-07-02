# Engagement And Analytics Checklist

Use this checklist as the working implementation tracker for streams, follows, likes, saves, playlist activity, and analytics reporting across Music City.

## Phase 1: Analytics Foundations
- [ ] Define the core analytics goals for v1
- [ ] Decide the source of truth for analytics: raw events plus aggregated rollups
- [ ] Define canonical entity ids to support analytics joins:
  - [ ] `userId`
  - [ ] `artistId`
  - [ ] `trackId`
  - [ ] `releaseId`
  - [ ] `playlistId`
  - [ ] `sessionId`
- [ ] Define canonical event timestamps in UTC
- [ ] Define analytics attribution fields:
  - [ ] `surface`
  - [ ] `source`
  - [ ] `campaign`
  - [ ] `referrer`
  - [ ] `deviceType`
  - [ ] `country`
- [ ] Decide event retention policy
- [ ] Decide whether we need internal vs external listener segmentation in v1

## Phase 2: Shared Types And Event Contracts
- [x] Add shared analytics event types in `packages/shared`
- [x] Define `FollowArtistEvent`
- [x] Define `UnfollowArtistEvent`
- [x] Define `TrackPlaybackStartedEvent`
- [x] Define `TrackPlaybackProgressEvent`
- [x] Define `TrackPlaybackCompletedEvent`
- [x] Define `TrackLikeEvent`
- [x] Define `TrackUnlikeEvent`
- [x] Define `TrackSaveEvent`
- [x] Define `TrackUnsaveEvent`
- [ ] Define `ReleaseViewEvent`
- [ ] Define `PlaylistCreatedEvent`
- [ ] Define `PlaylistTrackAddedEvent`
- [ ] Define `PlaylistTrackRemovedEvent`
- [ ] Define `SearchPerformedEvent`
- [ ] Define shared aggregation result types:
  - [x] `TrackAnalyticsSummary`
  - [x] `ArtistAnalyticsSummary`
  - [x] `ReleaseAnalyticsSummary`
  - [x] `PlaylistAnalyticsSummary`
  - [x] `AudienceSummary`

## Phase 3: Data Model And Persistence
- [x] Add storage for `analytics_events`
- [x] Add storage for `artist_follows`
- [x] Add storage for `track_likes`
- [x] Add storage for `track_saves`
- [ ] Add storage for `playlist_follows` if playlist following is in v1
- [ ] Add storage for `analytics_track_daily`
- [ ] Add storage for `analytics_artist_daily`
- [ ] Add storage for `analytics_release_daily`
- [ ] Add storage for `analytics_platform_daily`
- [ ] Add indexes for:
  - [x] `event_type`
  - [x] `occurred_at`
  - [x] `track_id`
  - [x] `artist_id`
  - [x] `release_id`
  - [x] `actor_user_id`
  - [x] `session_id`
- [ ] Add uniqueness constraints where needed:
  - [ ] one follow per user and artist
  - [ ] one like per user and track
  - [x] one save per user and track

## Phase 4: Stream Counting Rules
- [x] Define what counts as a stream in v1
- [ ] Choose the minimum threshold:
  - [x] 30 seconds listened
  - [x] or 50 percent completion
  - [x] or whichever comes first
- [x] Define what counts as a playback start
- [x] Define deduplication rules for repeat plays in the same session
- [ ] Define bot or spam protection rules
- [x] Define how partial plays are stored when they do not qualify as streams
- [ ] Define how rewinds, skips, and restarts affect counting
- [ ] Define stream rules for gated tracks:
  - [x] public
  - [x] purchase required
  - [x] subscriber only

## Phase 5: Server Event Capture
- [x] Add server endpoint for playback start
- [x] Add server endpoint for playback progress heartbeat
- [x] Add server endpoint for playback completion
- [x] Add server endpoint for follow artist
- [x] Add server endpoint for unfollow artist
- [x] Add server endpoint for like track
- [x] Add server endpoint for unlike track
- [x] Add server endpoint for save track
- [x] Add server endpoint for unsave track
- [ ] Add server endpoint for release view
- [ ] Add server endpoint for playlist interaction events
- [x] Validate auth and ownership rules for engagement actions
- [x] Log analytics events server-side from trusted endpoints only

## Phase 6: Domain Features
- [x] Implement artist follow service
- [x] Implement track like service
- [x] Implement track save service
- [ ] Implement playlist add/remove tracking
- [ ] Implement release view tracking
- [x] Update track counters from authoritative engagement records:
  - [x] `plays`
  - [x] `likes`
- [x] Add follower counts to artist-facing models
- [ ] Add saved counts where useful for internal analytics

## Phase 7: Aggregation And Rollups
- [ ] Build daily track rollup job
- [ ] Build daily artist rollup job
- [ ] Build daily release rollup job
- [ ] Build platform summary rollup job
- [ ] Aggregate:
  - [ ] starts
  - [ ] qualified streams
  - [ ] listeners
  - [ ] unique listeners
  - [ ] average listen time
  - [ ] completion rate
  - [ ] likes
  - [ ] saves
  - [ ] follows
  - [ ] release views
- [ ] Add backfill script for rebuilding analytics from raw events
- [ ] Add idempotency protections for rollup jobs

## Phase 8: Client Instrumentation
- [x] Track playback start from the global playback provider
- [x] Send periodic playback progress heartbeats
- [x] Track playback completion
- [x] Track follow and unfollow actions from artist surfaces
- [x] Track like and unlike actions from track surfaces
- [x] Track save and unsave actions from track surfaces
- [ ] Track release page views
- [ ] Track playlist actions
- [ ] Track discovery and search interactions where useful
- [ ] Add retry or buffering behavior for dropped analytics requests

## Phase 9: Product Surfaces
- [x] Add follow button on artist pages
- [x] Add like button on track detail surfaces
- [x] Add save button for tracks
- [x] Add follower count on artist profiles
- [x] Add likes count on track detail where appropriate
- [x] Add creator dashboard analytics overview
- [x] Add artist analytics page
- [ ] Add admin analytics overview

## Phase 10: Creator Analytics Reporting
- [ ] Show total streams per track
- [ ] Show unique listeners per track
- [ ] Show completion rate per track
- [ ] Show top tracks by streams
- [ ] Show top releases by streams
- [ ] Show follower growth
- [ ] Show saves and likes by track
- [ ] Show recent activity trend lines
- [ ] Add date filters:
  - [ ] 7 days
  - [ ] 30 days
  - [ ] 90 days
  - [ ] lifetime

## Phase 11: Admin Reporting
- [ ] Show total platform streams
- [ ] Show total active listeners
- [ ] Show top artists
- [ ] Show top tracks
- [ ] Show top releases
- [ ] Show follow growth platform-wide
- [ ] Show conversion funnel:
  - [ ] discovery impressions if available
  - [ ] release views
  - [ ] playback starts
  - [ ] qualified streams
  - [ ] saves
  - [ ] purchases
  - [ ] subscriptions

## Phase 12: Privacy, Abuse, And Quality
- [ ] Define privacy policy for analytics collection
- [ ] Decide what personally identifiable data is stored
- [ ] Hash or minimize sensitive device/network fields where possible
- [ ] Add spam prevention for repeated stream inflation
- [ ] Add rate limiting on analytics endpoints
- [ ] Add anomaly detection flags for suspicious streaming behavior
- [ ] Decide how to treat self-streams by creators
- [ ] Decide how to treat anonymous vs authenticated listeners

## Phase 13: QA And Verification
- [x] Test follow and unfollow flows
- [x] Test like and unlike flows
- [x] Test save and unsave flows
- [x] Test playback start event
- [x] Test heartbeat event progression
- [x] Test qualified stream counting threshold
- [x] Test duplicate event deduplication
- [ ] Test daily rollup accuracy
- [ ] Test creator dashboard analytics rendering
- [ ] Test admin analytics rendering
- [ ] Test event backfill script

## Recommended First Sprint
- [x] Shared analytics event contracts
- [x] `artist_follows` persistence and API
- [x] `track_likes` persistence and API
- [x] `analytics_events` storage
- [x] Playback start plus heartbeat plus completion tracking
- [ ] Qualified stream counting rules
- [x] Track-level stream and like counters
- [x] Creator dashboard track analytics basics

## Sprint Done When
- [x] Users can follow and unfollow artists
- [x] Users can like and unlike tracks
- [x] Users can save and unsave tracks
- [x] Playback emits trusted analytics events
- [x] Qualified streams are counted per track
- [x] Artist follower counts are visible
- [x] Track likes and stream totals are visible
- [x] Creators can view basic per-track analytics
