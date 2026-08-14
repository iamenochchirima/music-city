# Music City Product Readiness Plan

This document is the working plan for taking Music City from a guided MVP demo to a reliable artist-and-fan beta.

It combines the repository audit, the current product direction, and an end-to-end validation checklist. Items should be converted into implementation tickets as they are scheduled.

## Current baseline

The project already has a meaningful foundation:

- Artist dashboard with tracks, releases, uploads, analytics, and revenue surfaces.
- Public artist, release, track, playlist, marketplace, and discovery routes.
- Global playback with local media and Mux-oriented playback support.
- Likes, saves, follows, playlist activity, release views, and qualified playback analytics.
- Wallet-authenticated payments, platform subscriptions, artist onboarding payments, and entitlements.
- Royalty splits, Soroban registry integration, payout records, and an admin console.
- Ads/preroll infrastructure and administrative inventory management.
- Passing baseline: 47 server tests and typechecks for shared, client, admin, and server packages.

The product is suitable for a controlled demo. The main work now is closing the gaps that can make an external artist or listener confused, blocked, or unconvinced.

## Product principles

- Listening comes first. The public experience should sell discovery, playback, and artist connection before monetization or creation tools.
- Artists should understand the complete path from profile setup to upload, release, discovery, analytics, and earnings.
- Every visible promise must be backed by a real rule or be clearly labelled as upcoming.
- Empty, loading, expired, failed, and unauthenticated states must explain what happened and what to do next.
- Wallet and blockchain functionality should create trust and optional depth, not prevent a first listen.
- Demo content must be intentional, playable, visually coherent, and resettable.

## Priority and release gates

### P0 — Required before inviting external artists or fans

These items protect the first impression and prevent incorrect product behavior.

- [ ] Add guest or anonymous preview playback.
- [ ] Decide and implement the authoritative track access model: public, subscriber-only, purchased-only, and private.
- [ ] Make subscription and purchase enforcement match the UI and server behavior.
- [ ] Add a seeded, resettable demo catalog with playable audio and complete artwork.
- [ ] Add error states and retry actions to all public catalog pages.
- [ ] Align authentication copy with the actual Dynamic/Stellar flow, or add the promised email/social path.
- [ ] Add global search across artists, tracks, releases, and playlists.
- [ ] Add shareable public URLs and social preview metadata for artists, tracks, releases, and playlists.
- [ ] Add upload progress, retry, processing status, and actionable failure states.
- [ ] Run the complete demo script on a clean browser session and on a mobile device.

### P1 — Required before a public beta

- [ ] Complete artist profiles with biography, images, social links, featured release, and artist pick.
- [ ] Add listening history, saved music, followed artists, and a simple listener home/feed.
- [ ] Add artist release notifications and upcoming-release/presave behavior.
- [ ] Extend artist analytics with audience geography, sources, retention, and exportable reports.
- [ ] Add release metadata and rights checks: explicit content, language, credits, ownership, and contributor splits.
- [ ] Add fan engagement: comments, replies, reposts, notifications, and artist announcements.
- [ ] Add clear artist earnings, royalty status, payout timing, and transaction links.
- [ ] Add reporting, moderation, takedown, audit-log, and support workflows.
- [ ] Add production monitoring, webhook retry visibility, backup verification, and operational runbooks.

### P2 — Strategic expansion

- [ ] External distribution to Spotify, Apple Music, YouTube, TikTok, and other stores.
- [ ] Merch, ticketing, preorders, discount codes, and richer direct-to-fan commerce.
- [ ] Artist teams, labels, contributor invitations, and role-based collaboration.
- [ ] Offline listening and native mobile applications.
- [ ] Lyrics, Canvas-style visuals, video, and live listening experiences.
- [ ] Personalized recommendations and a mature discovery/ranking system.
- [ ] Artist subscriptions with exclusive content and community features.

## Workstream 1 — Listener-first discovery and playback

### 1.1 Public access and first listen

- [ ] Let an unauthenticated visitor browse the public catalog.
- [ ] Let an unauthenticated visitor play a safe preview or public track.
- [ ] Preserve authentication requirements for likes, saves, follows, playlists, purchases, and artist tools.
- [ ] Show a clear login prompt only when an authenticated action is attempted.
- [ ] Confirm that playback works after a page refresh.
- [ ] Confirm that playback works on mobile Safari and Chrome.
- [ ] Confirm that a failed playback session offers retry rather than silently stopping.
- [ ] Confirm behavior when a playback token expires during a long listening session.
- [ ] Confirm behavior when the media provider is unavailable.
- [ ] Confirm that artist-owned unpublished tracks are not accidentally public.

### 1.2 Search and discovery

- [ ] Add a persistent search entry point in the header.
- [ ] Search tracks by title and artist.
- [ ] Search releases by title and artist.
- [ ] Search artists by name, genre, and location.
- [ ] Search playlists by title and creator.
- [ ] Add empty search results with suggested next actions.
- [ ] Add filters for genre, release type, artist location, and release status.
- [ ] Add sorting for newest, most played, most saved, and editorially featured.
- [ ] Add “new releases,” “popular this week,” and “artists to discover” shelves.
- [ ] Record search events for analytics.
- [ ] Add pagination or bounded loading for larger catalogs.

### 1.3 Listener library

- [ ] Add recently played tracks.
- [ ] Add liked tracks.
- [ ] Add saved tracks.
- [ ] Add followed artists.
- [ ] Add owned or unlocked tracks.
- [ ] Add followed playlists if playlists are intended to be a social surface.
- [ ] Add queue persistence during navigation and refresh.
- [ ] Add queue controls for repeat and shuffle.
- [ ] Add a clear “add to playlist” action from every track surface.
- [ ] Render playlist artwork instead of placeholder gradients when artwork exists.
- [ ] Add share actions for tracks, releases, artists, and playlists.

### 1.4 Playback quality

- [ ] Define public preview length and enforcement rules.
- [ ] Define qualified-stream rules for public, purchased, and subscriber playback.
- [ ] Add playback-session refresh or a graceful renewal path.
- [ ] Add retry for failed media URLs and expired sessions.
- [ ] Confirm previous/next behavior at queue boundaries.
- [ ] Confirm seeking, volume, mute, mobile expanded player, and browser background behavior.
- [ ] Add a visible “now playing” state to track and release pages.
- [ ] Prevent duplicate playback events after seeks, restarts, or repeated heartbeats.
- [ ] Add self-play and suspicious-stream rules before exposing public popularity rankings.

## Workstream 2 — Authentication and onboarding

### 2.1 Fan onboarding

- [ ] Define the minimum fan account requirement.
- [ ] Allow a visitor to listen before creating an account, if product policy permits.
- [ ] Make wallet requirements explicit in the login screen.
- [ ] Provide testnet setup and funding instructions for the demo environment.
- [ ] Handle cancelled wallet login without trapping the user.
- [ ] Handle missing Dynamic configuration with a clear environment error.
- [ ] Handle expired sessions and logout across browser tabs.
- [ ] Review client-side token storage and reduce exposure to XSS where practical.

### 2.2 Artist onboarding

- [ ] Explain artist benefits in listener-friendly language: upload, release, discoverability, analytics, and earnings.
- [ ] Make the onboarding fee state unambiguous.
- [ ] Handle zero-fee development mode separately from production pricing.
- [ ] Collect artist display name, biography, location, genres, profile image, header image, and links.
- [ ] Add artist ownership/rights acknowledgement.
- [ ] Add an onboarding completion checklist.
- [ ] Route a completed artist directly to the first-upload flow.
- [ ] Provide a demo artist account or guided wallet path for invited artists.
- [ ] Add artist verification/claim status if profiles can be created before ownership is proven.

## Workstream 3 — Artist profile and release workflow

### 3.1 Artist profile

- [ ] Render profile and header images on public artist pages.
- [ ] Add a biography and location/genre presentation.
- [ ] Add external social and website links.
- [ ] Add follower count and follow state.
- [ ] Add featured release or “Artist Pick.”
- [ ] Add top tracks and latest release.
- [ ] Add discography grouping for singles, EPs, and albums.
- [ ] Add a public share button and copy-link confirmation.
- [ ] Add a profile preview before publishing changes.

### 3.2 Track creation and upload

- [ ] Validate title, artist, genre, audio type, file size, and duration before upload.
- [ ] Add explicit-content flag.
- [ ] Add audio language.
- [ ] Add songwriter, producer, featured-artist, and contributor credits.
- [ ] Add ISRC and other catalog identifiers where available.
- [ ] Add ownership and sample/license confirmation.
- [ ] Add artwork requirements and image validation.
- [ ] Show upload progress and processing progress separately.
- [ ] Allow retry after a failed upload.
- [ ] Allow cancellation of an in-progress upload.
- [ ] Poll or receive processing updates until the track is playable.
- [ ] Explain local-media versus Mux behavior in the demo environment.
- [ ] Add replace-audio and version history rules.
- [ ] Add an explicit draft/unpublished state that cannot leak into public discovery.

### 3.3 Release management

- [ ] Keep single, EP, and album creation flows working.
- [ ] Add release validation before publish.
- [ ] Prevent publish while required tracks are missing or still processing.
- [ ] Confirm cover precedence between release and track artwork.
- [ ] Confirm track order and focus-track behavior.
- [ ] Add scheduled-release processing that changes state automatically.
- [ ] Add release countdown or presave page.
- [ ] Add release preview link for private sharing.
- [ ] Add release update/takedown/archive behavior.
- [ ] Add release-level rights and contributor confirmation.
- [ ] Add store/distribution metadata fields when external distribution begins.
- [ ] Test draft, scheduled, published, archived, and failed states.

### 3.4 Artist release promotion

- [ ] Notify followers when a release becomes public.
- [ ] Generate share cards for social platforms.
- [ ] Add a featured release/artist-pick placement.
- [ ] Add a pre-release landing page with tracklist preview.
- [ ] Add campaign/referral attribution to shared links.
- [ ] Add a simple artist announcement post or release note.

Spotify provides useful benchmarks here: artist profile customization, Artist Pick, release promotion, pitching, countdown pages, presaves, and release analytics. See [Spotify for Artists](https://artists.spotify.com/en/get-started?cb=28516), [Artist tools](https://artists.spotify.com/en/blog/spotify-for-artists-tools-101), and [release preparation guidance](https://artists.spotify.com/blog/release-guide-preparing-for-release-day?lid=zoifg73pifan).

## Workstream 4 — Fan engagement and community

- [ ] Add comments on tracks or releases, with moderation controls.
- [ ] Add replies or threaded discussion if comments are retained.
- [ ] Add repost/share-to-profile behavior.
- [ ] Add artist announcements.
- [ ] Add follow notifications for new releases.
- [ ] Add notification preferences and unsubscribe behavior.
- [ ] Add playlist follow/share behavior.
- [ ] Add fan support/tipping if direct support is part of the positioning.
- [ ] Show public support history only with explicit user consent.
- [ ] Add a “top supporters” or supporter badge concept only after privacy rules are defined.
- [ ] Add reporting for tracks, comments, profiles, and playlists.
- [ ] Add moderation statuses and admin review actions.
- [ ] Add rate limits and abuse prevention for follows, likes, comments, and support payments.

SoundCloud benchmarks the social layer with feeds, reposts, comments, likes, playlists, artist spotlights, and discovery surfaces. [SoundCloud platform anatomy](https://help.soundcloud.com/hc/en-us/articles/115003570748-Anatomy-of-SoundCloud) and [SoundCloud insights](https://help.soundcloud.com/hc/en-us/articles/115003564988-Insights-on-SoundCloud) are useful references.

## Workstream 5 — Commerce, subscriptions, and royalties

### 5.1 Access model

- [ ] Choose whether a track purchase grants exclusive access, permanent access, or only represents fan support.
- [ ] Choose whether the platform subscription unlocks specific tracks, all eligible tracks, or platform benefits.
- [ ] Add explicit access fields to shared schemas and database persistence.
- [ ] Enforce access on the server, not only in UI components.
- [ ] Add entitlement checks for public, subscriber, purchased, and owner playback.
- [ ] Add clear purchase/subscription states to track and release pages.
- [ ] Add expired-subscription behavior.
- [ ] Add idempotency for payment confirmation and entitlement granting.

### 5.2 Fan checkout

- [ ] Show price, asset, destination, and network before wallet approval.
- [ ] Handle user rejection, insufficient balance, timeout, and failed transaction states.
- [ ] Show pending, confirmed, and failed payment history.
- [ ] Link confirmed transactions to the appropriate Stellar explorer.
- [ ] Add receipts or downloadable payment records.
- [ ] Define refunds, disputes, and mistaken-payment policy.
- [ ] Test duplicate confirmation and refresh during checkout.

### 5.3 Artist earnings

- [ ] Show per-track and per-release earnings.
- [ ] Show purchases, subscriptions, ads, fees, pending amounts, and payable amounts separately.
- [ ] Show the royalty split version used for each earning.
- [ ] Show payout status and expected timing.
- [ ] Link paid payouts to transaction evidence.
- [ ] Add track-level royalty earning history.
- [ ] Add subscription-revenue allocation by qualified consumption if subscription revenue is distributed by listening.
- [ ] Add exportable earnings reports.
- [ ] Explain batch payout timing in the artist dashboard.

The royalty system is a product differentiator, but it must be understandable to artists who do not know Stellar terminology.

## Workstream 6 — Analytics and trust

### 6.1 Listener analytics

- [ ] Record search events.
- [ ] Record referral/share attribution.
- [ ] Record playlist follows if implemented.
- [ ] Show recently played and listening history to the listener.
- [ ] Define privacy and retention rules.
- [ ] Provide an opt-out path where required.

### 6.2 Artist analytics

- [ ] Show qualified streams and playback starts separately.
- [ ] Show unique listeners.
- [ ] Show completion rate and skips.
- [ ] Show likes, saves, playlist adds, and follows.
- [ ] Show top countries and cities.
- [ ] Show traffic sources and campaign attribution.
- [ ] Show new versus returning listeners.
- [ ] Show follower growth and conversion from profile visits.
- [ ] Show release-level and track-level trends for 7, 30, 90 days, and lifetime.
- [ ] Add CSV export.
- [ ] Add self-play, bot, replay, seek, and spam rules.
- [ ] Add rollup jobs for tracks, artists, releases, and platform totals.
- [ ] Add backfill and rollup reconciliation tools.

Spotify, YouTube, and SoundCloud all expose some combination of geographic, source, audience, engagement, and top-listener data. See [Spotify analytics](https://artists.spotify.com/en/blog/release-details-page-and-audience-engagement-analytics), [YouTube Analytics](https://support.google.com/youtube/answer/9419340?hl=en), and [SoundCloud insights](https://help.soundcloud.com/hc/en-us/articles/45764477043355-Insights-basics).

## Workstream 7 — Admin, moderation, and operations

- [ ] Add a public and admin health/readiness check.
- [ ] Add database connectivity and schema-health visibility.
- [ ] Add media-provider readiness visibility.
- [ ] Add wallet/network configuration visibility without exposing secrets.
- [ ] Add webhook delivery history and retry actions.
- [ ] Add moderation queue for reported tracks, profiles, playlists, and comments.
- [ ] Add content takedown and restore actions.
- [ ] Add audit logs for admin changes, payouts, access grants, and moderation decisions.
- [ ] Add user support/contact workflow.
- [ ] Add rate-limit and abuse dashboards.
- [ ] Add database backup and restore runbook.
- [ ] Add demo-data seed and reset commands.
- [ ] Add a production deployment checklist separate from the local/ngrok checklist.
- [ ] Confirm secrets are not committed or shown in client bundles.
- [ ] Confirm CORS, allowed hosts, cookie/token, and HTTPS behavior in the deployed environment.

## Workstream 8 — Mobile and shareability

- [ ] Test the landing page at phone width.
- [ ] Test header navigation and menu controls on touch devices.
- [ ] Test player controls with a thumb-sized viewport.
- [ ] Test upload and artist dashboard layouts on mobile.
- [ ] Add installable PWA behavior if mobile usage is a near-term priority.
- [ ] Add Open Graph and Twitter/X metadata.
- [ ] Add share previews with correct artist/release artwork.
- [ ] Test deep links through ngrok and the eventual production host.
- [ ] Test browser refresh on every public deep link.
- [ ] Test unsupported-browser and unavailable-media messages.

## End-to-end acceptance checklists

### A. Anonymous fan: discover and listen

- [ ] Open the landing page in a clean browser.
- [ ] Confirm the page clearly positions Music City for listeners.
- [ ] Open Discover without authentication.
- [ ] Confirm seeded releases, tracks, playlists, and artists appear.
- [ ] Search for an artist by name.
- [ ] Open the artist profile.
- [ ] Confirm profile image, biography, releases, and top tracks render.
- [ ] Open a release.
- [ ] Confirm artwork, date, type, track order, and artist link.
- [ ] Start playback without a wallet, or receive a clear preview explanation.
- [ ] Confirm the persistent player appears.
- [ ] Navigate to another page while audio continues.
- [ ] Pause, resume, seek, change volume, and play the next track.
- [ ] Refresh the page and confirm the expected player behavior.
- [ ] Share the artist, release, and track URLs.
- [ ] Confirm social previews show the correct artwork and title.
- [ ] Confirm an API or media failure displays a useful retry state.

### B. Fan: create an account and engage

- [ ] Start login from a track action.
- [ ] Complete wallet/authentication flow.
- [ ] Complete basic profile onboarding.
- [ ] Like a track.
- [ ] Save a track.
- [ ] Follow an artist.
- [ ] Create a playlist.
- [ ] Add a track to the playlist.
- [ ] Remove a track from the playlist.
- [ ] Open the playlist publicly if its visibility allows it.
- [ ] Confirm the account page reflects the activity.
- [ ] Log out and confirm protected actions are unavailable.
- [ ] Log back in and confirm activity persists.

### C. Artist: onboard and publish a track

- [ ] Start from the listener-facing artist CTA.
- [ ] Complete artist onboarding.
- [ ] Confirm artist access is unlocked only after the intended payment/state.
- [ ] Open the dashboard.
- [ ] Create a track draft.
- [ ] Complete metadata and rights fields.
- [ ] Upload audio and artwork.
- [ ] Observe upload progress.
- [ ] Observe processing state.
- [ ] Recover from a failed upload or retry it.
- [ ] Confirm the track is not public while unpublished.
- [ ] Publish the track.
- [ ] Open the public track page in a clean browser.
- [ ] Play the published track.
- [ ] Confirm the track appears in discovery.
- [ ] Confirm the artist page reflects the track.

### D. Artist: create and promote a release

- [ ] Create a single, EP, or album.
- [ ] Add cover art and metadata.
- [ ] Attach tracks.
- [ ] Reorder tracks.
- [ ] Set a focus track.
- [ ] Save a draft.
- [ ] Validate that incomplete or processing tracks block publish.
- [ ] Schedule a release.
- [ ] Confirm scheduled status and public visibility rules.
- [ ] Confirm automatic publication at the release time.
- [ ] Open the public release page.
- [ ] Confirm the release appears on the artist page and discovery shelves.
- [ ] Share the release link.
- [ ] Confirm follower notification behavior.

### E. Fan: purchase or subscribe

- [ ] Open a gated track or release.
- [ ] Confirm access requirements are explained before wallet approval.
- [ ] Start checkout.
- [ ] Confirm amount, asset, network, and receiving wallet.
- [ ] Reject the wallet transaction and confirm a recoverable state.
- [ ] Complete a valid transaction.
- [ ] Confirm payment status changes from pending to confirmed.
- [ ] Confirm the entitlement is granted exactly once.
- [ ] Play the unlocked content.
- [ ] Refresh and confirm access persists.
- [ ] Confirm the account/payment history is accurate.
- [ ] Test an expired or missing entitlement.

### F. Artist: inspect analytics and earnings

- [ ] Generate one qualified playback.
- [ ] Generate one skipped/non-qualified playback.
- [ ] Like, save, and follow the artist.
- [ ] Add the track to a playlist.
- [ ] Open the artist analytics page.
- [ ] Confirm stream qualification rules are reflected.
- [ ] Confirm listener, engagement, and trend metrics update.
- [ ] Confirm purchase or subscription revenue appears in the correct category.
- [ ] Confirm royalty split recipients and percentages total 100%.
- [ ] Confirm pending and payable balances are distinguished.
- [ ] Confirm payout evidence is visible after a payout.

### G. Admin and operations

- [ ] Log into the admin console.
- [ ] Confirm platform health and database readiness.
- [ ] Inspect users and subscriptions.
- [ ] Inspect tracks, artists, and reported content.
- [ ] Create or review an ad only if ads are enabled for the demo.
- [ ] Inspect royalty split history.
- [ ] Run a royalty dry run.
- [ ] Confirm payout idempotency and failure handling.
- [ ] Inspect treasury balance and network configuration.
- [ ] Review audit logs.
- [ ] Reset demo data and repeat the core demo flow.

## Demo release checklist

### Environment

- [ ] Server starts with the intended demo environment variables.
- [ ] Client points to the correct API base URL.
- [ ] Dynamic authentication environment is configured, or demo auth bypass is intentionally enabled.
- [ ] Media provider is configured and tested.
- [ ] Stellar network, asset, contract, and receiving wallet settings are correct.
- [ ] Database schema is current.
- [ ] Demo data is seeded.
- [ ] Demo data has been tested from a clean browser.
- [ ] ngrok or the remote preview host is running when remote review is needed.
- [ ] API and client URLs are recorded and tested from a phone.

### Content

- [ ] Every featured track has playable audio.
- [ ] Every featured artist has a name, image, biography, and at least one release.
- [ ] Every featured release has artwork, date, tracklist, and public status.
- [ ] At least one upcoming release is available for the countdown story.
- [ ] At least one playlist demonstrates the fan listening loop.
- [ ] No placeholder copy, broken images, empty shelves, or dead CTAs appear in the primary demo path.
- [ ] Ads are either disabled or have a deliberate, tested demo campaign.

### Demo narrative

- [ ] Begin as an anonymous listener.
- [ ] Discover an artist.
- [ ] Play a track.
- [ ] Follow the artist and save the track.
- [ ] Open the release page.
- [ ] Show the artist’s path into the studio.
- [ ] Upload or reveal a prepared artist track.
- [ ] Publish or preview a release.
- [ ] Return to the public artist page.
- [ ] Show analytics and engagement.
- [ ] Show purchase/subscription and royalty transparency only after the listening story is clear.

## Implementation order

### Sprint 1 — Make the listener path undeniable

- [ ] Guest preview playback.
- [ ] Access-model decision and enforcement.
- [ ] Seeded demo catalog.
- [ ] Public-page error and empty states.
- [ ] Search and basic filters.
- [ ] Shareable URLs and metadata.
- [ ] Clean-browser mobile acceptance pass.

### Sprint 2 — Make artists successful on the first attempt

- [ ] Artist profile completion.
- [ ] Upload progress/retry/recovery.
- [ ] Release validation.
- [ ] Scheduled-release behavior.
- [ ] Private preview links.
- [ ] Demo artist onboarding.
- [ ] Artist-facing help text and completion checklist.

### Sprint 3 — Make the platform sticky

- [ ] Listening history and library.
- [ ] Followed-artist feed.
- [ ] Notifications.
- [ ] Comments/reposts or a deliberately scoped first community feature.
- [ ] Release promotion and artist pick.
- [ ] Basic recommendations and trending logic.

### Sprint 4 — Make money and trust legible

- [ ] Correct gated-access behavior.
- [ ] Payment receipts and explorer links.
- [ ] Per-track and per-release earnings.
- [ ] Royalty history and payout explanations.
- [ ] Moderation/reporting/takedown flows.
- [ ] Admin health, audit, webhook, and backup runbooks.

## Definition of done for the next external demo

The next external demo is ready when:

- [ ] A new visitor can understand the listener value proposition immediately.
- [ ] A visitor can discover and play music without first understanding wallets.
- [ ] At least one complete artist journey works from onboarding to public release.
- [ ] No visible CTA leads to a dead, misleading, or incomplete flow.
- [ ] Purchases and subscriptions behave exactly as their labels promise.
- [ ] A failed API, media upload, wallet transaction, or expired session produces a recoverable state.
- [ ] The same demo works from a clean desktop browser and a mobile phone.
- [ ] The team can reset and reseed the demo environment quickly.
- [ ] The admin can diagnose the most likely failures without reading server logs manually.
- [ ] The client can try the product themselves without requiring live developer intervention for every step.

