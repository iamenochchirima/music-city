# Ads Implementation Plan

## Goal

Add audio ads for listeners who do not have an active `Music City Pass`, while keeping playback clean for subscribed users and preserving the current unlock model.

Working tracker:

- `docs/ads-mvp-checklist.md`

## Product Rules

- Serve ads only to users without an active platform subscription.
- Default ad format for MVP: audio preroll.
- Do not serve ads for:
  - active `Music City Pass` subscribers
  - purchased tracks
  - subscriber-only tracks that were unlocked through the platform subscription
  - artists previewing their own tracks
- Start with public tracks only.

## Recommended MVP

Implement `server-side ad decisioning + client-side preroll playback`.

Why:
- playback is already centrally controlled in the client global player
- access decisions already happen on the server
- this gives us one place to enforce ad eligibility
- this is much simpler and safer than stream-side ad insertion

## Scope Phases

### Phase 1: Foundations

- Add an `ads` module on the server.
- Add ad persistence in the database.
- Add admin CRUD for ad inventory.
- Add a public-safe ad decision endpoint for playback.
- Add impression logging.

### Phase 2: Playback Integration

- Update the global playback provider to request an ad before starting eligible tracks.
- If an ad is returned, play ad audio first.
- After ad completion, continue directly into the selected track.
- If ad loading fails, continue to track playback without blocking the listener.

### Phase 3: Controls

- Add frequency caps.
- Add active date windows.
- Add campaign priority / weighting.
- Add reporting for impressions and completions.

### Phase 4: Expansion

- Add genre targeting.
- Add geography targeting.
- Add visual placements only if explicitly needed.
- Consider third-party ad serving or SSAI later if scale requires it.

## Server Implementation List

### 1. Shared Types

Add new shared contracts under `packages/shared` for:
- `AdRecord`
- `AdDecision`
- `AdImpressionRecord`
- admin input schemas for ads

Suggested fields for `AdRecord`:
- `id`
- `name`
- `status`
- `audioUrl`
- `clickUrl`
- `startsAt`
- `endsAt`
- `priority`
- `weight`
- `targetAccess`
- `targetGenres`
- `maxImpressionsPerWalletPerDay`
- `createdAt`
- `updatedAt`

Suggested fields for `AdDecision`:
- `serveAd`
- `ad`
- `reason`

### 2. Database

Add tables:
- `ads`
- `ad_impressions`

Suggested `ads` columns:
- `id`
- `status`
- `starts_at`
- `ends_at`
- `payload`

Suggested `ad_impressions` columns:
- `id`
- `ad_id`
- `wallet_address`
- `track_id`
- `playback_session_id`
- `status`
- `created_at`
- `payload`

Add indexes for:
- `ads.status`
- `ads.starts_at`
- `ads.ends_at`
- `ad_impressions.wallet_address`
- `ad_impressions.ad_id`
- `ad_impressions.created_at`

### 3. Server Modules

Create:
- `server/src/modules/ads/ads.repository.ts`
- `server/src/modules/ads/ads.service.ts`
- `server/src/modules/ads/ads.router.ts`

Responsibilities:
- list active ads
- evaluate ad eligibility
- choose the next ad
- log impression start
- log impression complete / skip / fail

### 4. Eligibility Logic

Add a function like:
- `adsService.getPlaybackAdDecision(walletAddress, trackId)`

Rules for MVP:
- return `serveAd: false` if wallet has active platform subscription
- return `serveAd: false` if track access is not `public`
- return `serveAd: false` if user owns the track as artist
- return `serveAd: false` if frequency cap is exceeded
- otherwise select an active eligible ad

### 5. Routes

Add endpoints:
- `GET /api/v1/ads/playback-decision/:trackId`
- `POST /api/v1/ads/impressions`
- `PUT /api/v1/ads/impressions/:id`

Admin endpoints:
- `GET /api/v1/admin/ads`
- `POST /api/v1/admin/ads`
- `PUT /api/v1/admin/ads/:id`
- `DELETE /api/v1/admin/ads/:id`

### 6. Subscription Integration

Use existing platform subscription logic when deciding whether ads should be skipped.

Primary rule:
- active `Music City Pass` means ad-free playback

### 7. Analytics

Track at minimum:
- impression requested
- impression served
- impression started
- impression completed
- impression skipped
- impression failed

## Client Implementation List

### 1. Playback Hooking

Update:
- `client/src/features/playback/providers/global-playback-provider.tsx`

Flow:
1. user clicks play
2. client asks server for ad decision
3. if no ad, continue as normal
4. if ad exists, play ad audio first
5. after ad completion, start track playback

### 2. Client Ad State

Add player state for:
- `activeAd`
- `isPlayingAd`
- `pendingTrackAfterAd`
- `adImpressionId`

### 3. Ad Audio Playback

For MVP:
- use the same HTML audio element for ad playback first
- then swap to track stream

Alternative later:
- separate ad audio element if transitions become messy

### 4. UI

Add minimal ad UI:
- small `Sponsored` label
- ad title / brand name if available
- optional `Learn more` link

Do not overcomplicate MVP UI.

### 5. Error Handling

If ad fetch fails:
- continue into track playback

If ad audio fails:
- log failure
- continue into track playback

If impression logging fails:
- do not block playback

## Admin Work

Add ad management to the admin surface:
- create ad
- pause ad
- schedule ad
- upload / set audio URL
- set targeting and caps
- review impression stats

## Rollout Order

1. Add shared ad types
2. Add DB tables and repository methods
3. Add ad decision service
4. Add admin CRUD
5. Add playback decision endpoint
6. Add client preroll flow
7. Add impression logging
8. Add frequency caps
9. Add reporting

## Non-Goals For MVP

- stream-side ad insertion
- banner ad network integrations
- video ads
- advanced third-party targeting
- auction-based ad serving

## Future Options

- one ad every N tracks
- one ad every X minutes
- campaign targeting by track genre
- sponsored playlists
- home/discover visual sponsorships
- advertiser dashboard

## Open Decisions

- exact ad frequency cap
- whether anonymous free users should also get ads
- whether ads play before every public track or only intermittently
- whether ads should appear on web only or also future mobile apps
- whether artists eventually receive revenue share from ads

## Recommendation

Ship the MVP as:
- audio preroll only
- server-side eligibility
- ad-free for `Music City Pass`
- public-track-only targeting
- graceful fallback to normal playback if ad delivery fails

This is the fastest clean implementation that fits the current Music City architecture.

## Concrete MVP Build Order

1. shared ad contracts
2. DB persistence for ads and ad impressions
3. server ads module plus admin CRUD
4. playback ad decision endpoint
5. client preroll insertion in the global player
6. impression lifecycle reporting
7. basic admin visibility into impression status
