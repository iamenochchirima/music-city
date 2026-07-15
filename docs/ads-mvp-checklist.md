# Ads MVP Checklist

Use this checklist as the working tracker for shipping Music City's first admin-managed audio ad system.

## MVP Goal

Ship a simple ad-supported playback flow that:

- serves audio ads only to non-subscribed listeners at scheduled breaks
- makes every ready published track playable
- keeps subscribed listeners ad-free
- lets admins manage ad inventory directly
- records enough delivery data to evolve into mature ad accounting later

## Product Rules

- [x] Serve ads only to listeners without an active platform subscription
- [x] Serve ads only on ready, published tracks
- [x] Skip ads for artists previewing their own tracks
- [x] Keep purchases as optional artist support, not playback access
- [x] Default slot is audio preroll at a scheduled break
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
- [x] Require three playback sessions before the first ad break
- [x] Require three playback sessions and a ten-minute cooldown between later breaks
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
- [x] Return `serveAd=false` until a free listener reaches an eligible break
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
- [x] Play an eligible preroll ad before the selected track
- [x] Continue into the track automatically after ad completion
- [x] Fall back to track playback on ad errors
- [x] Add minimal sponsored UI state

## Phase 8: Reporting And Future Readiness

- [x] Add admin visibility into impressions by status
- [x] Keep impression records compatible with future revenue accounting
- [x] Add one ad every N tracks and a minimum interval between breaks
- [ ] Leave room for:
  - [ ] campaign targeting by genre
  - [ ] ad revenue pool allocation into royalties

## Sprint Done When

- [x] Admin can manage active audio ads
- [x] Non-subscribed listeners can receive an audio preroll before eligible public tracks
- [x] Subscribed listeners remain ad-free
- [x] Every ready published track is playable without a purchase or subscription
- [x] Ad failures do not break music playback
- [x] Impression lifecycle is recorded end-to-end
