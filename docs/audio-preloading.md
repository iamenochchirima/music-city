# Audio preloading

Playable catalog rows, release tracklists, song pages and studio playback controls prepare audio before Play. The shared player prepares the first queued tracks and observes visible playback controls with a 200-pixel margin, so later tracks prepare as they scroll into view. Initial preparation runs two requests at a time and retains up to 12 encrypted buffers per tab. The beginning of each recording uses at most 256 KiB of source bytes. Mux preparation includes its manifests, initialization data and at most one complete opening fragment within that budget.

`POST /playback/preload` validates access without creating a playback session, listening event, ad impression or guest allowance. The response contains an encrypted binary bundle and a signed, ten-minute ticket bound to the listener, recording and current media identity. Guest bundles exclude full provider playlists and their access tokens.

Play still performs the existing ad decision, access checks and guest listening allowance checks. Only a successful playback-session response releases the matching decryption key. The browser service worker then serves the prepared prefix against that session's exact media URL. Later range requests stream from the existing media endpoint. HLS can reuse prepared resources without replacing the guest's bounded server manifest. Guest prefixes are clamped to the actual remaining allowance. No buffer or key is persisted to disk. Expired, unsupported or unavailable preparation never authorizes playback or blocks the ordinary authorized streaming request.

Buffers are isolated by browser tab and cleared on account changes. Signed-in playback is stopped when its account signs out or changes. Guest-to-signed-in continuation retains the existing upgrade path. In-flight responses for the previous account cannot attach a player after that account changes.

## Verification

Local browser checks on 20 October 2026 used Dynamic Sandbox and the isolated Testnet review environment:

- Opening a guest catalog prepared three songs. Playback sessions stayed at 2, playback events at 7, analytics events at 9 and guest allowance rows at 0. No listening time was consumed.
- The four-second synthetic Core Journey recording reused its 262,144-byte prefix. The media server subsequently returned only the remaining 90,700 bytes.
- A 215.808-second uploaded recording played with a partial buffer while the remainder streamed. Its guest allowance remained bounded.
- The guest sign-in prompt blocked playback beyond the allowance in effect during that check, despite a prepared encrypted prefix.
- Unit and HTTP checks cover prefix limits, authenticated encryption, actor and replacement-media binding, access rejection, no session creation during preparation, guest provider-token removal, concurrency, deduplication, expiry, guest byte clamping, per-tab worker isolation and range reuse.

The workspace suite passed 145 server, 125 client and 18 admin tests. Ten environment-dependent server checks were skipped in the default run. Focused playback verification passed 9 server and 7 client checks. Workspace typecheck and production builds passed. The existing frontend bundle-size warnings remain.

Commands: `pnpm test`, `pnpm typecheck`, and `pnpm build`. The PostgreSQL and Testnet financial suites are unrelated to this optimization and are not required to exercise it.

## Runtime

Deploy the API and client together. This change has no database migration and adds no environment variables. The client registers `/playback-preload-worker.js`; production requires HTTPS, while localhost is supported for development. The worker handles only explicitly unlocked audio resources and forwards all other requests normally. Another existing service worker is not replaced. Browser builds without this worker still use the existing authorized streaming player.

## Guest listening allowance

Guests receive 25 minutes of cumulative listening time per rolling 24-hour window across all songs. Paused time does not count. Switching or replaying songs does not reset the budget. The API, local media bounds, Mux playlists and prepared audio respect the remaining duration returned by the server.

Migration `2026-10-20-guest-listening-time` preserves consumed seconds from the previous two slots and their window expiry, then removes the old slot columns. Apply API migrations before starting the updated API, and deploy the updated client with it.
