# Ads MVP Checklist

Use this checklist as the working tracker for shipping Music City's first admin-managed audio ad system.

## MVP Goal

Ship a simple ad-supported playback flow that:

- serves audio ads only to non-subscribed listeners
- inserts ads before eligible public tracks
- keeps subscribed listeners ad-free
- lets admins manage ad inventory directly
- records enough delivery data to evolve into mature ad accounting later

## Product Rules

- [x] Serve ads only to listeners without an active platform subscription
- [x] Start with `public` tracks only
- [x] Skip ads for artists previewing their own tracks
- [x] Skip ads for purchased-track playback
- [x] Default slot is audio preroll
- [x] Do not block track playback if ad decisioning or ad media fails

## Phase 1: Shared Contracts

- [x] Add shared ad record schema
- [x] Add shared ad status schema
- [x] Add shared ad decision schema
- [x] Add shared ad impression schema
- [x] Add shared admin input schemas for:
  - [x] create ad
  - [x] update ad
  - [x] ad impression start
  - [x] ad impression completion / failure / skip

## Phase 2: Database

- [x] Add `ads` persistence
- [x] Add `ad_impressions` persistence
- [x] Add indexes for:
  - [x] ad status
  - [x] ad active window
  - [x] impression wallet
  - [x] impression ad id
  - [x] impression created at

## Phase 3: Server Ads Module

- [x] Add `ads.repository`
- [x] Add `ads.service`
- [x] Add `ads.router`
- [x] Add ad selection logic
- [x] Add active-window filtering
- [x] Add simple frequency cap support
- [x] Add subscription-aware ad eligibility check
- [x] Add self-artist skip check

## Phase 4: Admin Management

- [x] Add admin API to list ads
- [x] Add admin API to create ads
- [x] Add admin API to update ads
- [x] Add admin API to archive / disable ads
- [x] Add admin UI for ad management
- [x] Add admin control for:
  - [x] audio URL
  - [x] campaign name
  - [x] status
  - [x] start and end dates
  - [x] priority
  - [x] weight
  - [x] daily wallet cap

## Phase 5: Playback Decisioning

- [x] Add public-safe playback ad decision endpoint
- [x] Return `serveAd=false` for subscribed listeners
- [x] Return `serveAd=false` for ineligible tracks
- [x] Return `serveAd=false` when no active ad is eligible
- [x] Return ad metadata plus impression id when an ad should play

## Phase 6: Impression Tracking

- [x] Record impression creation
- [x] Record ad start
- [x] Record ad complete
- [x] Record ad skip
- [x] Record ad failure
- [x] Keep impression updates non-blocking for playback

## Phase 7: Client Playback Integration

- [x] Add ad decision request before eligible playback
- [x] Add ad playback state to the global player
- [x] Play preroll ad before the selected track
- [x] Continue into the track automatically after ad completion
- [x] Fall back to track playback on ad errors
- [x] Add minimal sponsored UI state

## Phase 8: Reporting And Future Readiness

- [x] Add admin visibility into impressions by status
- [x] Keep impression records compatible with future revenue accounting
- [ ] Leave room for:
  - [ ] one ad every N tracks
  - [ ] one ad every X minutes
  - [ ] campaign targeting by genre
  - [ ] ad revenue pool allocation into royalties

## Sprint Done When

- [x] Admin can manage active audio ads
- [x] Non-subscribed listeners can receive an audio preroll before eligible public tracks
- [x] Subscribed listeners remain ad-free
- [x] Ad failures do not break music playback
- [x] Impression lifecycle is recorded end-to-end
