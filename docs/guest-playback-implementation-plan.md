# Guest playback implementation plan

## Implementation status (2026-10-19)

The guest playback flow is implemented across the client, API, media delivery and database migration. The API issues a signed browser identity token, stores only its hash in a durable 24-hour allowance row, permits one pinned first track and one pinned second track, and exposes the guest flow only for public tracks. Guest sessions use the same global player. The player stops the second track at its halfway point, offers sign-in, and recreates an authenticated session from the saved position after login. Authenticated playback keeps its existing entitlement and ad flow.

The release media guarantee depends on the provider:

- **Mux:** guest HLS playlists are rewritten through the API and omit segments beyond the session's remaining allowance. Segment requests are checked against that bounded playlist; the Mux URL/token is not exposed in the guest session response.
- **Local/S3:** media bytes are served through the API and capped by byte range. The client also stops at the runtime-based allowance. Because compressed audio can be variable bitrate, a byte fraction is an approximation of a time fraction. Use Mux for production guest playback when the 50% cutoff must correspond closely to playback time; exact time limits for local/S3 require time-indexed packaging.

The browser identity is held in local storage because the client and API may be on different origins. Clearing browser storage creates a new anonymous identity; the IP limiter is an abuse guard, not an identity-proofing system. `GUEST_PLAYBACK_ENABLED=false` disables guest session creation and playback.

## Product rule

- [ ] A visitor can play public, published tracks without signing in.
- [ ] In each rolling 24-hour guest window, allow one distinct track to play to its end, then allow 50% of one additional track. Show the sign-in prompt as soon as the second track reaches 50%.
- [ ] Count actual playback progress, not elapsed wall time or seeks. Replays do not earn more allowance. A visitor who leaves the first track early still has the first-track allowance available; selecting another track consumes that slot and starts the second-track allowance.
- [ ] Signing in removes the guest cap and resumes the selected track from its current position where possible.
- [ ] Artist-owned unpublished tracks and any track not in a published public release remain unavailable to guests.

## Audit findings

- `client/src/features/playback/providers/global-playback-provider.tsx` returns from `playTrack` and `startTrackSession` when there is no auth token. It also routes authenticated plays through ads and reports progress only for authenticated sessions.
- `server/src/modules/playback/playback.router.ts` requires a session to create playback sessions and submit playback events. Manifest and media routes instead rely on a short-lived playback token.
- `server/src/modules/playback/playback.service.ts` persists sessions and emits playback events, but creates sessions with a user ID and hands the client a full media URL. Its manifest currently contains one 30-second EXTINF entry that points to that full URL; it does not limit playback to 30 seconds.
- `server/src/modules/uploads/uploads.router.ts` serves full audio and arbitrary valid byte ranges without a playback token. For S3, `storageService.getDownloadUrl` returns a direct signed object URL. Either can bypass a client-side cutoff.
- Mux playback URLs are direct Mux HLS URLs. Guest limits must also constrain the actual playlist/segments; a client timer or hiding the URL in the app is not enforcement.
- `playback_sessions` already persist playback session payloads, and `playback_events.listener_user_id` permits null. This supports anonymous event attribution, but the guest allowance needs its own durable per-guest state and atomic updates.
- The rate limiter is in-memory per server process. Keep it as a request-abuse guard only; it cannot enforce a durable 24-hour allowance across restarts or multiple instances.
- The client already maintains an audio element, queue, current position and progress reporting. The guest flow can share those controls, with account-only actions and ad flows gated separately.

## Functional implementation checklist

### 1. Guest identity and allowance

- [ ] Issue a random, opaque guest identifier on first playback and persist it in a signed, HTTP-only, SameSite cookie; use Secure in production. Do not trust a caller-supplied guest ID.
- [ ] Add a database table/migration for guest listening windows and track-slot progress. Persist window start/expiry, the first track, the second track, verified listened seconds, and timestamps. Add indexes/constraints needed for one active allowance per guest and atomic updates.
- [ ] Define the 24-hour window start as the first guest play. Enforce the first-track and half-second-track budget server-side. Use track runtime from trusted track metadata, not duration supplied by the browser.
- [ ] Make concurrent session creation/progress updates atomic so multiple tabs cannot obtain extra allowance.
- [ ] Add per-IP request rate limiting as a secondary abuse control, with proxy/IP configuration checked in deployment. Do not treat IP as the guest identity or daily quota.
- [ ] Expire guest state after its window and decide data retention for old rows.

### 2. Enforce the cutoff in media delivery

- [ ] Replace the current placeholder one-segment manifest with real bounded delivery. No guest session may receive a reusable full-track URL.
- [ ] For local/S3 audio, serve authenticated-by-playback-token media through a server-controlled stream that limits delivered media to the remaining allowance, supports the player's required seeking/range behavior, and rejects requests after the budget is exhausted. Ensure S3 objects are not directly exposed to the guest flow.
- [ ] For Mux, implement and verify a provider-specific method to stop delivery at the permitted media position while keeping the Mux credential/token server-side. If the provider cannot enforce this reliably, package or proxy segments so the server controls which time-bounded segments are returned.
- [ ] Ensure segment/byte requests cannot skip ahead, replay prior segments to extend allowance, or continue after the cap. Keep authenticated playback's existing full-track behavior.
- [ ] Keep public-track eligibility checks on every session and media authorization; never infer public access from a client-provided track summary.
- [ ] Rotate/refresh short-lived playback credentials for long first tracks, without resetting the guest allowance.

### 3. Playback API and analytics

- [ ] Make session creation optionally authenticated: logged-in users retain current entitlement/public checks; guests receive a limited session only for a public published track.
- [ ] Bind each guest playback token to its server-side guest record, track, allowance and expiry. Keep event and media routes authorized by that token.
- [ ] Accept guest progress events without `requireSession`, validate them against session and server-observed progress, and persist nullable listener user IDs. Do not let event payloads grant listen time or change track duration.
- [ ] Preserve current authenticated engagement, qualified-stream counting, ads and ownership rules. Decide whether guest listens count toward popularity/artist analytics; recommended: record guest events separately and do not count them as qualified streams until an anti-abuse policy is agreed.
- [ ] Return remaining allowance and a stable `guest_limit_reached` response so the client can render a prompt rather than a generic media error.

### 4. Player and sign-in experience

- [ ] Remove the auth-token early returns for public guest playback and share the existing player/queue behavior.
- [ ] Continue enforcing login for likes, saves, follows, playlists, purchases, support and artist tools.
- [ ] Stop guest playback at the server-enforced boundary and show a focused sign-in prompt with a clear continue action.
- [ ] Preserve the current track and position through sign-in; on successful authentication, replace the guest session with a normal authenticated session and continue playback.
- [ ] On a guest's next visit inside the same window, restore allowance from the server cookie/state, including after refresh. Show a concise remaining-listening indicator where the prompt is otherwise surprising.
- [ ] Handle expired guest cookies, expired playback tokens, offline/API errors, denied autoplay and unavailable media with retry or sign-in recovery; do not silently strand the player.
- [ ] Verify public catalog entry points (track page, release page, search/shelves and queue next/previous) all start guest sessions consistently.

### 5. Configuration, rollout and operations

- [ ] Confirm production cookie domain, HTTPS, SameSite/CORS credentials, trusted proxy configuration, API origin and client origin.
- [ ] Add migration to the normal deployment migration path and verify worker/API instances use the same database.
- [ ] Add configuration only for policy values that need operations control (window length and second-track fraction); use safe defaults of 24 hours and 50%.
- [ ] Add logs/metrics for guest session starts, cap enforcement, media denials, provider errors and sign-in conversion without logging the raw guest identifier.
- [ ] Roll out behind a server-side feature flag; enable first for staging, then production after both media providers in use pass the delivery checks.
- [ ] Update `docs/music-city-product-readiness-plan.md` to replace the generic guest-preview item with the shipped full-song-plus-half-next-track rule.

## Minimal verification checklist

Keep verification focused on one guest journey and the enforcement boundary:

- [ ] API integration: no auth can create a session for a public track; private/unpublished track is denied; guest session cannot be reused for another track.
- [ ] API integration: first track plays through; second track is denied beyond 50%; repeated requests, seeking, reload, a second tab and a new playback token do not reset allowance; after the rolling window expires, allowance is available again.
- [ ] Media check for every enabled provider: direct object/full-track URL is not returned to guests; range/segment requests stop at the server allowance; expired or altered guest tokens are rejected. Include one long track and one short track.
- [ ] Browser smoke path: visit logged out, play first track to completion, start a second track, reach the halfway prompt, sign in, and continue from the same position; refresh before the limit and confirm allowance remains.
- [ ] Regression smoke: logged-in playback still plays a full track, playback events still record, and account-only actions still require login.

Do not expand into a full cross-browser matrix for this change unless the client specifically requires it. The key release gate is proof that the media endpoint itself cannot provide audio past the guest cap.

## Verification completed

- [x] Playback service tests cover proxied local/S3 session URLs, a guest's reserved allowance slot, Mux segment cutoff, and analytics failure fallback.
- [x] Upload router tests cover traversal rejection, byte ranges, upload validation and S3 staged streaming.
- [x] Server and client TypeScript checks pass.
- [ ] Browser smoke test on the deployed/staging origins: full first song, halfway prompt on second, sign-in and resume. This requires a running app with configured database, auth, and media provider.
- [ ] Production configuration check: confirm the selected media provider, API/app origins, migration rollout and `GUEST_PLAYBACK_ENABLED` value.
