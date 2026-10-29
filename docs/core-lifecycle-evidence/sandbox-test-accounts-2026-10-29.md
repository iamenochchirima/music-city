# Dynamic Sandbox test-account run, 29 October 2026

This run used two new Dynamic Sandbox test identities against the local app and an isolated PostgreSQL clone. Stellar operations used Testnet. No production provider or account was used.

## Artist account

The artist identity completed onboarding with listener and artist access. The EARLYUSER offer covered the artist activation fee. The account created and published the synthetic single `SOW2 Sandbox Lifecycle Test`, release `rel_0a9243e4a54c4779`, with track `Lifecycle Test Tone`, ID `trk_1dc3a2751cdf4b5b`.

The release appeared once on Discover. Its generated eight-second WAV played to completion, and the stream count changed from zero to one. The run used synthetic audio and artwork stored under `/tmp`; it did not upload or change project media.

The Testnet faucet funded this test wallet with 10,000 XLM. The faucet transaction hash is `acbc389f2cd8a40980baa3e4398fc76d34489a33759129c9938c55ae1ce9cd32`. The wallet had no USDC or USDC trustline. The Add USDC trustline action remained at "Waiting for wallet approval". No trustline transaction was submitted.

## Listener account

The listener identity completed onboarding, saw the published test release on Discover, and opened the playlist page. A direct request for the artist-only release editor returned HTTP 403 with `Artist access is required to manage releases`.

The listener wallet had no Testnet funds or USDC trustline. Both test accounts showed MoonPay and MoneyGram as unavailable. Add funds and Cash out remained disabled, and the capabilities endpoint returned no routes.

## Findings and limits

Each new identity's first Dynamic session callback returned HTTP 403 because the provider had not linked a Stellar wallet yet. A later sign-in retry completed onboarding. Treat this first-login behavior as intermittent and unresolved.

The listener's first visit to the playlist route occurred before onboarding created a profile. The API returned an internal error for that empty result. The app now returns an empty playlist list before profile creation. Artist-only routes now return an explicit 403 instead of a 500 for a listener account.

No purchase, settlement, claim, USDC transfer, provider session, quote, payment, or payout was created. The trustline approval stall prevents this run from completing a USDC purchase. Provider routes remain unavailable.

## Verification

- The local API readiness endpoint reported a healthy database and applied schema groups.
- The focused user and playlist server tests passed: 12 tests.
- Server typecheck passed.
- Computer use verified both onboarding flows, local publication, playback, playlist access, and the artist-only 403 response.
- No screenshot artifact was saved.

This run adds current-code account and UI evidence. It does not replace the historical creator-to-claim Testnet evidence in [E8](README.md). C2 remains open until a fresh purchase, settlement, and claim pass succeeds.

## Follow-up account checks

The local API was restarted against the isolated `sow2_current_demo_test` database with Dynamic Sandbox, Stellar Testnet, local media and storage, and ramp providers disabled. The API readiness route reported healthy. The app account was reauthenticated with the Dynamic Sandbox test identity after the restart.

The artist account showed its Testnet USDC trustline as active, with 0 USDC and 9,999.99999 XLM spendable. This follows a successful Testnet `change_trust` operation; no USDC was received. Circle's Testnet faucet presented a reCAPTCHA challenge, so no faucet request was completed and no funds were sent. The faucet tab is left open for the user to complete the challenge.

The current app showed one published synthetic release and its one track. A qualified playback advanced the track's stream count from one to two. The artist track list initially labeled that same track `Not in a release`, although the release detail and track detail showed the assignment. The list response now hydrates release membership from the authoritative `release_tracks` relation; the local browser retest displayed `SOW2 Sandbox Lifecycle Test` as the track's release.

The Revenue page loaded with 0.00 USDC available, 0.00 pending, and no purchases. Funding and cash-out displayed MoonPay and MoneyGram as unavailable, with both actions disabled. No quote, provider session, purchase, settlement, claim, or payout was created. A fresh creator-to-claim lifecycle remains open.

The separate listener Sandbox identity also signed in successfully. Discover showed the synthetic release once and its two qualified streams. The empty playlist and agreement pages showed their normal empty states; direct access to artist tracks showed the artist setup gate. Its wallet was unfunded on Testnet with no USDC trustline, and add-funds, cash-out, and trustline controls stayed disabled where prerequisites were missing.

After the track-list correction, the focused track-service tests passed (9/9), the full workspace tests passed (218 server, 194 client, and 22 admin; 13 database-backed server tests were skipped by the default runner), workspace typechecks passed, and the production builds passed. The broader mobile, keyboard, cancellation, slow-response, and recovery browser matrix remains open under U4.

## Analytics and second existing Sandbox account check

The current local app was also checked with the existing artist Sandbox identity and an existing contributor/listener Sandbox identity (`Kwame`). These are existing test accounts, not newly created users. The artist account's Revenue page remained at 0.00 USDC available and pending and displayed the explicit treasury/split-registry configuration requirement. Its track list showed the synthetic track assigned to `SOW2 Sandbox Lifecycle Test`.

The artist analytics page exposed a real counting bug in the existing test data: two playback sessions had two `started` rows but four `completed` rows. The player could report completion at the near-end threshold and again on the audio `ended` event. The player now reports completion once per session, while analytics counts distinct started sessions and distinct completed sessions. Analytics also resolves release membership from the authoritative release-track relation instead of stale track fields. After the fix, the local browser showed two streams, the correct release under Top Releases, the track under that release, and a 100% completion rate.

The second account could open account details and its historical royalty agreements, including the accepted Core Journey agreement. Its earnings page showed no new claimable balance and the same explicit treasury configuration requirement. No agreement was accepted, no purchase or payout was made, and no wallet or chain transaction was submitted. These checks verify existing account access and read-only views; they do not complete a fresh creator-to-claim lifecycle or provider flow.

The full workspace tests passed (218 server, 196 client, and 22 admin; 13 database-backed server tests skipped by the default runner). Workspace typecheck and build passed; the client build retains its existing large-chunk warning. The local browser verification was visual, but no screenshot file was saved. C2 and U4 remain open.

## Mobile navigation and transaction recovery check

Computer use checked the local account and Revenue pages at a 390-pixel viewport using existing Sandbox identities. The account page used its compact navigation button; keyboard Tab focused it, Enter opened the menu with Discover focused, and Escape closed the menu and returned focus to the navigation button. The account and Revenue documents measured 375 CSS pixels wide inside the 390-pixel viewport, with no horizontal overflow. The Revenue page displayed 0.00 USDC available and pending, plus the treasury/finalized-split configuration requirement. Add funds and Cash out remained disabled because the app advertises no verified provider route.

The contributor account's cancelled GBP test order opened its detail at a resumable `?ramp=` URL. It showed MoonPay as the provider, Cancelled as provider status, and Transfer unconfirmed as Stellar status. Refreshing status and reloading the page preserved the same saved states; Close returned to the account page. This was a read-only check of a local cancelled fixture. No provider was contacted, no quote was requested, and no wallet or chain action occurred.

The root local `.env` lacks `AGREEMENT_TREASURY_ADDRESS`. Its configured royalty registry differs from the registry recorded in the historical E8 evidence; whether it is a newer valid Testnet registry has not been verified. No contract setting was changed. A fresh current-code claim journey remains blocked on identifying the correct current Testnet configuration and available user signing. U4 also remains open for the quote/review/signing screens, real provider handoff, slow-response failures, and their mobile/keyboard recovery. No screenshot artifact was saved.

## Additional Sandbox account role and ramp checks, 29 October 2026

Computer use verified the local app and API with two Sandbox identities. The existing Kwame listener account retained its wallet history and accepted Core Journey agreement. Its agreement detail showed the 70/30 split, accepted participant responses, version history, and finalized Testnet receipt. Revenue kept 0.0073 USDC spendable wallet funds separate from 0.00 USDC unclaimed earnings, and reported that no verified provider route was enabled.

A fresh synthetic artist identity completed Dynamic Sandbox sign-in and the Music City onboarding flow. The EARLYUSER activation offer showed $0 due and no transaction. The artist profile, Studio overview, tracks, releases, analytics, Revenue, agreements, playlists, and account pages loaded. The empty release and track states, zeroed analytics, empty agreement and playlist states, and artist-access navigation were all visible. The new wallet had no Testnet XLM, USDC, or USDC trustline; send, trustline, Add funds, and Cash out controls remained disabled. The Dynamic Sandbox console already showed Test Accounts enabled; no setting changes were saved.

The account pages do not establish provider readiness: the local capabilities response had no routes, so no quote, provider session, payment, payout, or signature could be started. No release, playlist, agreement, or chain transaction was created for the new identity. The browser was left at `/dashboard/releases` under the synthetic artist so the empty release state is available for local review.

The cash-out review now shows one compact total grouped by currency, with the fee breakdown and network/provider transaction identifiers inside collapsed disclosures. Its focused UI tests passed 7/7, all ramp UI tests passed 36/36, and client typecheck passed. The required identity action remains unverified because no provider adapter or quote is enabled. CO-19 therefore remains open.

## Current checkout test-account rerun, 29 October 2026

Computer use rechecked the local app using the signed-in Dynamic Sandbox profile `SOW2 Artist Test`. The local API process used `NODE_ENV=test`, the `sow2_current_demo_test` database on localhost, the Music City Dynamic Sandbox, Stellar Testnet, local storage/media, and ramps disabled. The API readiness endpoint reported a healthy database and applied schema groups. Dynamic's Test Accounts setting was already enabled; no authentication settings were changed. The SOW2 environment preflight passed when run with the same explicit local Sandbox/Testnet overrides.

The account's Studio pages showed normal empty states for its own tracks and releases. Agreements and playlists also loaded their empty states. Discover contained the synthetic public release `SOW2 Sandbox Lifecycle Test` and its eight-second `Lifecycle Test Tone`. The database clone referenced local masters that were absent from `server/data/media`; playback preload initially failed for those missing files. I recreated only this named synthetic WAV in ignored local media storage. Preload then returned HTTP 200, the browser played the recording through to 0:08, and its stream count advanced from two to three. This changed only the isolated test database. Other cloned catalog assets remain absent, so this check does not prove playback for every catalog item.

Revenue settled to 0.00 USDC available, 0.00 USDC pending, and 0 USDC spendable. The page displayed the explicit treasury/finalized-registry setup requirement because `/settlements/balances` returned 503 without `AGREEMENT_TREASURY_ADDRESS`. The ramps capability endpoint returned no routes; Add funds and Cash out stayed disabled. No claim, provider session, quote, payment, payout, wallet signature, or chain transaction was attempted. The current Sandbox artist has no funds, and fresh claims remain blocked on verifying the Testnet treasury and registry configuration. After playback ended, the track-details button still said `Playing` while the global player offered `Play`; this is a separate playback-state UI inconsistency to investigate.

Verification on this checkout:

- `pnpm test`: 218 server tests passed, 13 database-backed server tests skipped by the default runner, 199 client tests passed, and 22 admin tests passed.
- Server tests with dedicated disposable PostgreSQL databases: 321 passed, zero skipped, including agreement finalization, checkout recovery, settlement and claim history, direct support, and ramp persistence.
- `pnpm typecheck` and `pnpm build` passed. The client build retains its existing large-chunk warning.
- `migrate-production.ts` applied all 27 schema groups to a fresh disposable PostgreSQL database with no missing relations, indexes, columns, or constraints.

This run verifies one real local Sandbox account path and one synthetic playback. It does not complete CASH-01 through CASH-12 or a fresh purchase-to-claim journey. CO-25 remains open for the admin/worker browser checks, mobile/keyboard and recovery matrix, and genuine provider integration. CO-26 is complete for the current checkout; CO-27 remains open because the browser matrix and provider evidence are incomplete. No screenshot artifact was saved.

## Current checkout release and ramp smoke run, 29 October 2026

The Dynamic developer console already had Sandbox Test Accounts enabled; no setting was changed. Computer use reused the signed-in `SOW2 Artist Test` Sandbox profile. The local API process reported `NODE_ENV=test`, a loopback `sow2_current_demo_test` database, and local media/storage. No production API or account was used.

The test account's own Tracks and Releases pages began empty. I created the clearly labeled single `SOW2 Sandbox Verification 2026-10-29`, uploaded a generated eight-second WAV and generated square PNG cover, set the song title and genre, and reached Review. The page showed `Artwork uploaded`, `Tracklist is valid`, and `Audio is ready`; I saved the release as a private draft and left it at Review for inspection. Its local URL is `/dashboard/releases/rel_526bbf64f2b14cdf?step=review`. This changed only the isolated test database and local media.

On the account page, the test wallet had 0 XLM and 0 USDC, with no verified ramp routes. Add funds and Cash out were disabled and explained that no verified provider route was enabled. No provider session, quote, payment, payout, wallet signature, trustline transaction, publication, or chain transaction was attempted. The review was checked at a 390-pixel viewport; the document width was 375 pixels, with no horizontal overflow.

The first browser observation after live module reload showed a React `useAuthContext must be used within AuthProvider` error. A full page reload restored the app and Sandbox session. A separate cold tab also loaded the signed-in app. A read-only smoke pass opened Studio overview, Analytics, Releases, Tracks, Revenue, Agreements, Playlists, Support, and Discover; each rendered its expected heading without an application error page. The Dynamic SDK logged six failed `getSupportedOnramps` fetches during the fresh tab's initialization even though the Music City pages rendered. The exact cause and request endpoint were not established, so keep this SDK warning open for investigation. The HMR context error was not reproduced after reload. Browser screenshots were visually inspected but not saved as evidence files.

The current workspace test run passed admin 23/23, client 200/200, and server 219 passed with 12 database-dependent skips. The ramp repository lifecycle passed against isolated PostgreSQL without skips; fresh disposable migration applied all 27 schema groups, including the new `refund_failed` provider state. Workspace typecheck and production build passed. A sanitized, read-only provider capability snapshot is in [readiness-2026-10-29.json](../ramp-sandbox-evidence/readiness-2026-10-29.json): MoonPay reports native XLM Test Mode support but Stellar USDC remains unavailable, while MoneyGram rejects the configured non-custodial mode. These checks created no provider transactions.

This browser run verifies only a local artist release draft and unavailable-provider behavior. The admin/worker browser matrix, genuine MoonPay buy/sell, MoneyGram account-mode prerequisite, USDC delivery, fresh purchase-to-claim journey, and mobile/keyboard/recovery matrix remain open. Do not mark CO-25 or CO-27 complete on this evidence alone.

## Sandbox test-account lifecycle follow-up, 29 October 2026

Using the same local Dynamic Sandbox artist profile, I verified its Revenue and account pages. The wallet has no Testnet funds or USDC, and the funding and cash-out actions remain disabled because there are no verified provider routes. The account's agreements and support pages showed their empty states. No provider order, quote, payment, payout, wallet signature, claim, or chain transaction was created.

The account created the private playlist `SOW2 Sandbox Verification Playlist 2026-10-29` and added the public synthetic track `Lifecycle Test Tone`. The playlist and track remained present after reloading the direct manage URL. The first reload exposed a transient false "Playlist not found" state while authentication and the playlist record were resolving. The page now keeps its loading state until the authenticated request completes; a regression test covers the auth-to-record transition, and a browser reload now shows loading followed by the saved playlist. The private test playlist is intentionally left in the isolated local database for inspection.

Discover playback of the synthetic eight-second track advanced its stream count from three to four after qualified playback. At the end, the player advanced to a different catalog track whose local master is absent from this database clone; the player reported that the audio source could not be loaded. This matches the previously recorded missing cloned media limitation. It confirms the synthetic track's playback and stream event, not playback readiness for every catalog item.

The local admin frontend opened its first-admin setup screen, which requires the operator's setup token. No token was supplied or guessed, so authenticated admin browser checks remain open. The financial worker and genuine provider journeys were not run from this artist account because no route or funds are available. The local app remains on the private release review page; the draft was not published.

Verification for this follow-up: the client suite passed 201/201 and client typecheck passed. CO-25 and U4 remain open for admin authentication, worker browser checks, the remaining mobile/keyboard/recovery matrix, and genuine provider acceptance.

## Listener Sandbox account pass, 29 October 2026

I created a second synthetic Dynamic Sandbox identity, `SOW2 Listener Test`, and completed listener-only onboarding. The first sign-in reported "No Stellar wallet is linked to this account." A retry opened Dynamic's "Wallet not available" prompt; closing it returned to Music City onboarding, which then completed. This is another first-login friction case to investigate. No production identity or personal email was used, and no Dynamic setting was changed.

The listener account opened Discover and Revenue. Revenue showed 0.00 USDC and disabled Add funds and Cash out because no verified provider route is enabled. Opening the artist's private release review URL displayed "Artist access is required to manage releases." The artist dashboard instead offered the path to set up an artist profile. The listener account created no provider order, quote, payment, payout, wallet signature, claim, or chain transaction.

After the role check, I signed back into `SOW2 Artist Test` and restored its private draft at `/dashboard/releases/rel_526bbf64f2b14cdf?step=review`. CO-25 remains open for admin and worker checks, mobile/keyboard/recovery coverage, and real provider acceptance.

## Listener role matrix recheck, 29 October 2026

I signed out and back into both synthetic Dynamic Sandbox identities using the local app. Repeat sign-in succeeded for the listener and artist accounts. The earlier missing-wallet response did not recur on this pass; keep the first-login issue open because the initial failure was observed previously.

With the listener account, I opened Studio overview, Create, Tracks, Releases, Analytics, and Revenue. The five artist-only screens showed the artist setup gate rather than a server error. Revenue loaded with no verified ramp routes and disabled Add funds and Cash out. Agreements and playlists loaded their expected empty states, and Discover remained accessible. A direct request to the artist's private release draft displayed the artist-access message. The browser logged no console errors during this route check.

I then signed back into `SOW2 Artist Test` and reopened the private release review. It still showed `Draft`, `All changes saved`, `Artwork uploaded`, `Tracklist is valid`, and `Audio is ready`. The app remained connected to the isolated local test database with ramps disabled. No provider request, quote, payment, payout, wallet signature, claim, publication, or chain transaction occurred.

This pass extends listener route and repeat-auth coverage. It does not complete the admin/worker browser matrix, keyboard and interrupted-request checks, provider flow, or fresh purchase-to-claim lifecycle. CO-25, U4, and C2 remain open.

## Ramp retry UI and artist account recheck, 29 October 2026

The current local `SOW2 Artist Test` account still opened its private release review as a draft. It showed all changes saved, uploaded artwork, a valid tracklist, and ready audio. Revenue showed 0 USDC, no verified provider route, and disabled Add funds/Cash out. Account showed the test artist profile, EARLYUSER activation coverage, and wallet/testnet controls; no financial action was started.

For the funding and cash-out create dialogs, focused tests simulate a lost network response, retry the exact request with the same idempotency key and frozen terms, and verify that a saved order can continue to the returned provider URL. A definite HTTP 400/422 rejection unlocks the form and rotates the request ID before edited terms are submitted. HTTP 409 and authentication failures remain ambiguous to avoid duplicating a possibly existing order. These are controlled UI/API tests; they do not prove a real provider route.

Verification: 29 focused client tests passed, the full client suite passed 207/207, client typecheck passed, and `git diff --check` passed. No provider quote, session, payment, payout, wallet signature, claim, publication, or chain transaction occurred. The listener role matrix, its artist-only access checks, and its empty ramp capability state remain recorded in the preceding pass. C2 and U4 remain open; provider journeys remain open under R3-R9 and V5.

The browser account check in this pass also signed into the existing `SOW2 Listener Test` identity with Dynamic Sandbox Test Accounts, then signed back into `SOW2 Artist Test`. As the listener, Discover, agreements, and playlists loaded; Create, Tracks, Releases, and Analytics showed the artist-access setup gate; Revenue showed no verified ramp route and disabled Add funds/Cash out; and the artist's direct release-review URL resolved to the expected access-denied state after loading. The browser was restored to the artist's private draft.

I then checked the artist's Studio overview, Create, Tracks, Releases, Analytics, Revenue, Account, agreements, playlists, support, Discover, Artists, and public Releases pages. None showed an application error or an incorrect artist-access gate. Revenue and Account first displayed transient loading states, then settled: Revenue showed 0 USDC and no verified provider route; Account showed an unfunded Testnet wallet with 0 XLM/USDC and disabled trustline/send/provider actions. The synthetic release remained private, saved, and ready. No account settings were changed and no payment, payout, claim, wallet signature, publication, or chain transaction was made.

## Artist Revenue responsive recheck, 29 October 2026

Using the authenticated local `SOW2 Artist Test` Dynamic Sandbox account, I checked `/dashboard/revenue` at a 390 x 844 viewport. After capability loading completed, the page showed zero available, pending, and spendable USDC; the agreement-treasury setup message; and the no-verified-provider-route explanation. Add funds and Cash out remained disabled. The document measured 390 CSS pixels wide with a 390-pixel viewport and no horizontal overflow. The funding card and its explanation fit in the mobile viewport when scrolled into view.

The compact Studio navigation opened and Escape closed it with focus returning to its trigger. The browser recorded no console errors. I reset the viewport and returned the browser to the saved private release review. No settings or records were changed, and no provider request, quote, payment, payout, wallet signature, claim, publication, or chain transaction was made.

This verifies only the mobile layout and keyboard dismissal for the unavailable-route state. It does not verify amount/quote/review screens, live provider handoff, cancellation after launch, or slow-request recovery in a real browser flow. The separate UI tests cover idempotent retry after an ambiguous create; U4 remains open for the complete browser matrix, and C2 remains open for a fresh purchase-to-claim run.

## Fresh Dynamic Sandbox account check and playback, 29 October 2026

The local API was first started with the workspace `.env`, whose database URL resolves to Railway. The server's startup path initializes the database and migrations before listening. I stopped that process after detecting the remote host. Because no before/after migration snapshot was taken, whether startup applied a migration or repair is unknown; the remote schema state is unverified. I did not query or modify Railway further. No provider, wallet, or chain transaction was made during that startup.

All later tests used the `sow2_current_demo_test` database inside the local `music-city-settlement-demo-final` Postgres container. The server ran in `NODE_ENV=test` on port 4339 with Dynamic Sandbox, Stellar Testnet, local media, and provider ramps disabled. The local readiness route reported a healthy database and schema. The SOW 2 local preflight passed after confirming the exact local database target.

The previously open app session returned `Invalid or expired session`; signing out and back in restored access. Dynamic Sandbox Test Accounts were already enabled. I used synthetic `+dynamic_test@example.com` aliases, not a personal email. The artist alias completed all seven onboarding steps with artist access and the EARLYUSER $0 activation offer. Its first Dynamic session callback returned 403 because no Stellar wallet was linked; the retry succeeded and onboarding completed. A listener test identity loaded the account page, agreements, playlists, Discover, and Revenue. Direct artist-release access showed the artist setup gate. The listener wallet had no Testnet balance or USDC trustline; send, trustline, Add funds, and Cash out stayed unavailable. The artist Revenue page showed zero earnings and no verified provider route, with Add funds and Cash out disabled.

Discover initially failed to play the synthetic `Lifecycle Test Tone` because the local clone lacked its `support-demo/master.wav` file and the API was building audio URLs from the client port. I restored only that missing eight-second generated tone in ignored local media storage and corrected the local runtime `APP_BASE_URL` to `http://localhost:4339`. Playback then completed from 0:00 to 0:08, and the synthetic track's stream count moved from four to five once. A failed earlier start stayed incomplete and did not increment the count. Several other cloned catalog masters and cover images remain absent, so this proves the named synthetic track only.

The preflight had accepted the incorrect `APP_BASE_URL` even though the server uses it to build playback stream URLs. I updated `scripts/check-sow2-local-env.mjs` to require the configured local API origin and added rejection coverage for the client port and remote origins; `pnpm test:sow2-preflight` passed 3/3. The browser was left on Discover with the completed synthetic track. No purchase, quote, provider session, wallet signature, trustline transaction, payout, claim, or new chain transaction was created. C2, U2, U4, R3-R9, and V5 remain open.

## First-login Stellar wallet recovery, 29 October 2026

The first-login test account showed the wallet setup message before Dynamic had returned its verified Stellar credential. The old recovery action opened a wallet picker that had no available wallet. Dynamic's Sandbox console already had Test Accounts enabled in the Sandbox environment. I did not change authentication settings.

Commit `e863be9` replaces the wallet-picker action with `Check wallet again`. The button calls Dynamic's `useRefreshUser` hook, checks the refreshed verified credentials, clears the failed-session key, and retries Music City's session request. If the Stellar credential is still missing, the page keeps the retry action available.

Computer use reproduced the delayed-credential state with a fresh synthetic Sandbox identity. Clicking `Check wallet again` completed sign-in and opened onboarding. The account finished all seven steps with artist access and the $0 EARLYUSER offer. It uploaded a synthetic WAV and cover, published the local single `SOW2 Wallet Retry Test Single 2026-10-29` (`rel_791e5c2b3db24ce5`), and showed the release once on Discover. The eight-second track changed from zero to one stream after qualified playback. The Revenue page showed zero USDC and disabled Add funds and Cash out because no provider route was verified. Browser error logs were empty.

The track page initially kept its `Playing` label after the audio ended, while the global player showed Play at 0:08. Commit `c4dc6a6` makes the track action follow the actual playback state. The local browser then showed Play on the ended track, and its stream count remained one.

The focused auth suite passed 6/6, the focused track-action suite passed 6/6, the full client suite passed 212/212, and client typecheck passed. The local API readiness route returned HTTP 200 with the database, storage, and all 28 schema groups healthy. No provider request, payment, payout, wallet signature, trustline, claim, or chain transaction was created. C2 remains open for a fresh purchase-to-claim run. U4 remains open for the other responsive, keyboard, cancellation, slow-response, and recovery cases.

## Current Sandbox account surface recheck, 29 October 2026

On the current local checkout (`c4dc6a6`), I used the signed-in synthetic artist account to recheck Revenue and Account at a 390 × 844 viewport, then restored the browser to `/dashboard/releases`. Revenue settled to 0.00 USDC available, pending, and spendable, explained that no verified provider route is enabled, and kept Add funds and Cash out disabled. Account showed the $0 EARLYUSER activation, an unfunded Testnet wallet with 0 XLM and 0 USDC, and disabled trustline, send, funding, and cash-out actions. Neither page had horizontal overflow. The browser error log was empty.

On desktop, keyboard Tab traversed the header and Studio navigation links to wallet history; the disabled money actions were not focusable. At the mobile breakpoint, the navigation opened and Escape returned focus to its trigger. Reloading Revenue preserved the Sandbox session and loaded the wallet balance after its normal loading state. Returning to Releases showed the persisted `SOW2 Wallet Retry Test Single 2026-10-29` once, with one published release.

This remains account and interface verification only. The test wallet has no Testnet funds or USDC, no provider route is verified, and no provider order, quote, payment, payout, wallet signature, trustline transaction, claim, or chain transaction was created. Admin setup and worker browser checks are still open. This adds partial U4 coverage but does not close U4, C2, or CO-25.

## Local admin sign-in surface check, 29 October 2026

I started the local admin frontend with its API base explicitly set to `http://localhost:4339/api/v1/admin`. `/auth` showed the existing-admin Login form, not first-admin bootstrap. At 390 × 844 the document fit without horizontal overflow; keyboard Tab reached Email, Password, Show password, and Sign in in order. The browser error log was empty. I did not enter credentials or submit the form, so authenticated admin lists and details were not checked. The admin frontend was stopped after this check.

The financial worker was not running during the local account tests, so its browser-independent startup and reconciliation cycle were not verified in this pass. CO-25 and U4 remain open for authenticated admin review, worker checks, remaining interruption/recovery coverage, and provider acceptance.

## Sell-capability gate recheck, 29 October 2026

After updating the local backend's sell-route gate, I reloaded `/dashboard/revenue` in the existing signed-in Dynamic Sandbox artist session. The page settled to 0 USDC spendable and displayed “No verified provider route is enabled yet. Your wallet balance stays unchanged.” Add funds and Cash out remained disabled. The browser error log was empty. I did not create an order, quote, or provider session, sign a wallet transaction, or modify the account.

This confirms only that the current Sandbox account does not receive an unverified sell route. Unit tests used a synthetic MoonPay catalog to verify that a USDC sell can be validated while the buy asset is XLM. MoonPay's real sandbox still reports Stellar USDC unavailable; the production verified route source and cash-out quote adapter remain empty. The separate artist/listener role matrix is documented above; admin authentication and financial worker checks remain open.

## Financial worker Sandbox smoke and event-history retention gap, 29 October 2026

The Dynamic Developer Console showed Test Accounts already enabled in the Sandbox environment; no setting was changed. The signed-in Sandbox artist was rechecked on the current app. Releases showed one published synthetic single; Tracks showed its one ready recording assigned to that release; Analytics showed one stream, one listener, and a 100% completion rate. Royalty agreements and playlists showed their empty states. Revenue showed 0 USDC, no verified provider route, and disabled Add funds/Cash out. The browser error log was empty. Prior evidence in this file covers the separate listener role. These account checks made no changes.

I ran exactly one `financialCycle()` against a fresh local database, `sow2_worker_runtime_20261029_test`, after its schema was initialized. Ramps and cash-out were disabled; Stellar calls were read-only Testnet checks. The cycle returned, but settlement-event indexing correctly recorded an error rather than advancing an incomplete cursor. RPC returned `startLedger must be within the ledger range: 5322980 - 5443939`. The configured contract deployment ledger is 5204451; the older demo database's stored event cursor is at ledger 5310657, also before the endpoint's oldest retained ledger 5322980. No ledger gap was skipped and no transaction was submitted.

I did not run the worker on `sow2_current_demo_test`: read-only inspection showed confirmed financial attempts and a funded settlement batch in its existing Testnet history. The isolated smoke database was dropped after the run, and its temporary script was removed. The worker's error path previously rendered structured RPC errors as `[object Object]`; a small formatter now persists and logs the provider's string `message` field, with a focused regression test.

The public RPC's retention boundary is documented by Stellar's [`getHealth` response](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getHealth). Stellar Hubble documents a historical `history_contract_events` table containing contract IDs, ledger sequence, successful-call status, and raw event XDR, but Hubble is read-only, updates in batches, and may incur BigQuery query costs ([Hubble overview](https://developers.stellar.org/docs/data/analytics/hubble), [event table schema](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/history-contract-events)). Testnet coverage and its ability to supply this contract's complete event history have not been verified. A valid archive source or an independently verified backfill is still required; do not reset or advance the production cursor to hide this gap.

The focused error-format tests passed 2/2, the full server suite passed 221 tests with 13 database-dependent tests skipped, and server typecheck passed. CO-25 remains open for admin authentication, the remaining browser matrix, and historical event recovery. C2 remains open; this smoke did not create or verify a new purchase, settlement, claim, provider order, wallet signature, or chain transaction.

## Local workspace suite and test-account route pass, 29 October 2026

The API on `localhost:4339` returned HTTP 200 from readiness with the local database and registered schema groups healthy. I started the current client on its configured local origin, `http://localhost:3000`; the earlier server at that origin had stopped and a stale offline shell appeared until the current Vite client was restarted. The browser session restored the existing synthetic Dynamic Sandbox artist, `SOW2 Wallet Retry Artist` (`sow2-wallet-refresh+dynamic_test@example.com`).

At a 390-pixel viewport, the signed-in artist opened Releases, Tracks, Analytics, Account, Royalty agreements, Playlists, Discover, Artists, and Revenue. All routes rendered their expected signed-in screens without horizontal overflow. Analytics showed one stream and one listener. Account showed the test wallet with 0 XLM and 0 USDC. Revenue showed 0.00 USDC available and pending, no verified provider route, and disabled Add funds/Cash out. Agreements and playlists loaded their empty states. The synthetic release and ready track remained available in the artist account. No financial action, profile edit, wallet approval, or chain transaction occurred.

I signed out to check the existing `SOW2 Listener Test` identity. Dynamic's Sandbox console showed its Test Accounts switch off at that point. The login form accepted the existing synthetic test email and advanced to verification-code entry, but I did not enter a code or change the Dynamic setting. This identity therefore was not authenticated in this pass. Approval to re-enable static-OTP Sandbox sign-in is pending; Live settings were not touched.

Verification on this checkout: `pnpm test` passed 221 server tests, 212 client tests, and 23 admin tests, with 13 database-backed server tests skipped by the default runner. Separate fresh disposable-PostgreSQL runs passed the settlement lifecycle suite `15/15` and ramp persistence/capability suite `3/3`; both disposable databases were removed. `pnpm typecheck` passed for all workspace packages. These checks verify persistence and fail-closed behavior, not a real provider quote, purchase, payout, or fresh purchase-to-claim flow. CO-25, C2, U2, U4, R3-R9, and V5 remain open.

The initial browser retry on `localhost:4317` failed to load Dynamic Sandbox settings while the API was configured to accept `localhost:3000`. The local SOW 2 preflight now verifies that `CLIENT_ORIGIN` and `VITE_APP_BASE_URL` are valid matching local origins. The local demo runbook starts the client at the configured `localhost:3000` origin. The preflight suite passed `4/4`, and a direct check passed with the active 4339 API and isolated local test database; no production origin or database was used.

## Fresh test-account sign-in and route check, 29 October 2026

At the user's request, I verified the Dynamic Sandbox Test Accounts setting and signed in with its static-OTP test identity on the configured local app origin. The setting was already enabled; I made no saved Dynamic configuration changes. The new identity completed the local artist onboarding using test-only profile details. The EARLYUSER offer showed $0 due, with no payment or transaction.

The local API readiness endpoint returned HTTP 200. Dashboard, Tracks, Releases, Analytics, Royalty agreements, and Revenue routes loaded. Tracks, releases, and agreements showed their empty states; Analytics loaded its sections. Revenue showed 0.00 USDC available and pending, 0 USDC spendable, and explained that no verified provider route is enabled. Add funds and Cash out remained disabled. No release, upload, provider order, quote, payment, payout, wallet signature, claim, or chain transaction was created.

The browser console showed repeated Dynamic SDK `getSupportedOnramps` fetch errors while the Music City pages continued to load. This confirms an SDK on-ramp configuration/request issue is still visible in the local browser; its root cause is not established by this check. Music City's own ramp capability remains empty, so no ramp transaction could be started. C2, U2, U4, CO-25, and provider acceptance remain open.

## Fresh Sandbox artist release, revision, and playback check, 29 October 2026

Using the new local Dynamic Sandbox artist account, I created a clearly labeled `Sandbox QA Single` and uploaded an eight-second generated stereo WAV through the normal release uploader. The local API and isolated database were healthy, and local storage and media processing were configured. The uploader attached the recording automatically and showed `Audio ready`. I added generated `LOCAL TEST ONLY` artwork, reached `Ready to publish`, and published the release in the local app.

On the public release page, the first playback that passed the five-second qualification threshold changed the recording from 0 to 1 stream. Replaying it changed the count from 1 to 2. Reloading the page preserved the count, and Artist Analytics showed two total streams for the test release and track. Browser console errors were empty during this upload, release, playback, and analytics pass.

I then started a revision of that published test release, changed it to an EP, added a second generated WAV, reordered the two ready tracks, and applied the revision. After application, the public page showed the EP with both recordings. Playing the EP advanced from the first eight-second track to the next track automatically; the first track reached one stream and the previously played recording advanced from two to three. The mobile Analytics page and desktop public release page had no horizontal overflow. The test assets and published release exist only in the isolated local test database and local storage; they are labeled as QA data.

Revenue remained at zero and Add funds/Cash out remained disabled because the provider capability registry has no verified route. No quote, provider session, payment, payout, wallet signature, claim, or chain transaction occurred. This is real browser playback and local app persistence for a test identity, not provider or purchase-to-claim acceptance. U4 remains open for the rest of the cancellation, slow-response, and recovery matrix; C2 and R3-R9 remain open.

The same uploader check found that the browser file input had no format hint. It now advertises `.mp3`, `.wav`, `.wave`, `.flac`, `.m4a`, `.aac`, `.ogg`, `.oga`, and `audio/*`, matching the server's accepted audio types while retaining extension-based handling for missing mobile MIME metadata. The focused uploader test and full client suite passed (212 tests), and client typecheck passed. This desktop browser run cannot certify which source tiles a native Android/iOS chooser shows; those menus remain device and browser controlled.

## Fresh Sandbox account and Revenue recovery check, 29 October 2026

The local client was running at `http://localhost:3000`, but its API on port 4339 had stopped. Revenue initially reported `Failed to fetch`. I started the API against the disposable loopback PostgreSQL clone, with Dynamic Sandbox and Stellar Testnet configured, local media and storage selected, and provider credentials cleared. The hosted database in the root `.env` was not used. The local SOW 2 preflight and API readiness endpoint both returned success.

A synthetic Dynamic Sandbox test identity completed artist onboarding. The $20 activation fee was fully covered by EARLYUSER, so no payment was due. Account showed a generated Testnet wallet with 0 XLM and USDC. Its address was not funded, and the Add USDC trustline and Send actions were disabled. Tracks and Releases showed empty states, Analytics showed zero activity, and agreements and playlists loaded their empty states.

Revenue showed no verified provider route, and Add funds and Cash out remained disabled. The earnings balance endpoint returned an internal configuration error because this isolated demo API had no agreement treasury or settlement registry. The page now displays a user-facing retry message, hides totals as `—` until the request succeeds, and does not show that configuration error. A failed request pauses the five-second poll until the user retries. Browser verification confirmed that a manual retry produced one request and no automatic retry six seconds later. The full client suite passed 214/214, and client typecheck passed.

The browser console also recorded a Dynamic SDK `getSupportedOnramps` request failing with `Failed to fetch`. Sign-in, the API session exchange, and local app pages succeeded. The SDK error's cause remains unknown and is not evidence of a Music City provider route. No provider order, quote, payment, payout, wallet signature, claim, or Stellar transaction was attempted. This check does not close U2, U4, C2, R3-R9, or V5.

## Sandbox artist and listener role check, 29 October 2026

I restarted the local API in an isolated runtime against the disposable `sow2_current_demo_test` database on the loopback PostgreSQL container. The process used Dynamic Sandbox, Stellar Testnet, local storage and media, and explicitly disabled ramp providers and cleared MoonPay and MoneyGram credentials. The API readiness endpoint returned HTTP 200 with the database schema healthy, and the SOW 2 local environment preflight passed. The existing client remained at `http://localhost:3000`. No workspace `.env` database or production API was used.

Dynamic Sandbox Test Accounts was already enabled. With its static OTP, I signed into the existing `SOW2 Wallet Retry Artist` profile and verified the Dashboard, Tracks, Releases, Analytics, Royalty agreements, Account, and Revenue pages. The local test release and track appeared in the artist's library and analytics. Revenue kept earnings separate from spendable wallet funds, displayed the user-facing earnings retry state, and showed that no provider route was verified. Add funds and Cash out stayed disabled. The profile's Testnet wallet was unfunded; its account page showed zero XLM and USDC, with trustline and send disabled.

I also signed into a second synthetic `+dynamic_test` identity and completed the five-step listener onboarding. The profile saved the Kwaito preference and a follow for the existing synthetic artist. Discover loaded the local catalog, the listener's agreements and playlists showed empty states, and the direct Studio, Tracks, Releases, and Analytics routes presented the artist-access gate. Its generated Testnet wallet had zero XLM and USDC; trustline, send, Add funds, and Cash out were unavailable. No provider quote, order, payment, payout, claim, wallet signature, or Stellar transaction occurred.

On Revenue, the wallet balance briefly showed its loading state during route navigation, then resolved to 0 USDC after the balance request completed. Earnings remained unavailable because this local demo lacks the agreement treasury and finalized-split registry; the UI showed its user-facing retry message and did not expose the internal setup detail. The browser log contained vendor LaunchDarkly warnings but no application errors in this run. This verifies Sandbox authentication and role separation with two test profiles, not provider transactions or the purchase-to-claim lifecycle. U4 is partially evidenced and remains open for the remaining slow-response, cancellation, and recovery matrix; U2, C2, R3-R9, CO-25, and V5 remain open.

## Sandbox buyer purchase-review check, 29 October 2026

I signed into an existing synthetic buyer account with a funded Stellar Testnet USDC wallet and opened the published `Core Journey` track. The first attempt exposed a local configuration mismatch: the API defaulted to XLM while the recording was correctly priced in Testnet USDC. The app rejected the attempt before creating an order. This showed that the local demo preflight could pass without checking the settlement asset or treasury address.

I restarted only the isolated local API with the Testnet USDC code and issuer and the public address of the previously verified Testnet demo treasury. The updated local preflight passed, and the API readiness endpoint remained healthy. Retrying the purchase opened the app's `Review payment` screen for 0.001 USDC. I stopped before `Confirm and pay`, which requires a wallet-authorized Testnet transaction. No payment transaction was signed or submitted; no provider route was used. One short-lived pending checkout intent was created in the isolated test database.

The local preflight now requires the API's Testnet USDC code and issuer, a matching client USDC configuration, and a syntactically valid Testnet treasury public key. The runbook now lists the required values. The focused preflight suite passed 4/4 tests, and a direct check passed against the active local Sandbox/Testnet configuration. The purchase review demonstrates checkout preparation only; C2 remains open until the wallet transaction, settlement, and claims are completed.

Expanding the payment details showed the prepared transaction hash before the user signed or submitted it, but the field was labeled only `Transaction`. I changed the review details to say `Prepared transaction hash (not submitted)` before authorization, while retaining `Transaction hash` during submission and confirmation. The local browser showed the new label, the focused checkout hook suite passed 6/6, and client typecheck passed. No wallet approval or chain action occurred.

I also verified the pre-sign close path in the browser. The review action now says `Close review`, and using it displayed `Payment review closed. No payment was sent.` The same buyer could reopen the review for the still-active order; no signature or submission occurred. This closes the misleading cancellation wording for this checkout state, but does not complete U4's broader recovery matrix or C2.

Keyboard testing opened the payment details, tabbed from `Payment details` to `Close review`, and confirmed the next Tab wrapped to `Confirm and pay`; Shift+Tab wrapped back to `Close review`. Escape closed the dialog and displayed the same no-payment notice. The review reopened successfully afterward. Focus stayed within the modal, and no signing or submission occurred. This adds desktop keyboard and Escape coverage to U4; mobile, slow-response, lost-response, and post-submission recovery remain open.

On a later local pass with the funded QA wallet, I checked the review again using keyboard input: Enter expanded `Payment details`, and Escape closed the review, returned focus to `Buy 0.001 USDC`, and displayed `Payment review closed. No payment was sent.` The details showed the local recipient and order and marked the prepared hash `not submitted`. This was a marketplace checkout review, not an on-ramp; no wallet signature, payment, or settlement occurred. U4's ramp-specific and slow-response/reload cases and C2's signed purchase-to-claim run remain open.

## Current Sandbox account and full local verification, 29 October 2026

Dynamic Sandbox Test Accounts remained enabled. I made no Dynamic setting changes. The signed-in Sandbox artist session opened Dashboard, Tracks, Releases, Analytics, Royalty agreements, Account, Discover, and Revenue at `http://localhost:3000`. Each route rendered its expected page heading. The Revenue wallet balance resolved to 0.014 USDC. Earnings showed the retryable load error because this local database lacks the agreement treasury and finalized-split registry. Add funds and Cash out remained disabled because no provider route is verified. A manual earnings retry returned the same user-facing error.

The API readiness endpoint returned HTTP 200. Its database and all 28 schema groups were healthy. `pnpm test:sow2-preflight` passed 4/4 checks. The default workspace run passed 221 server, 214 client, and 23 admin tests. The default server run skipped 13 opt-in database tests. I then ran the full server suite with those database tests enabled against a fresh loopback `_test` database. All 324 server tests passed with no skips, and the disposable database was removed. `pnpm typecheck` and `pnpm build` passed. Vite reported the existing client bundle-size warning.

One existing Vite browser tab briefly went blank during the local hot-reload session and logged `useAuthContext must be used within AuthProvider`. A full reload restored it, and fresh tabs loaded both the track page and Revenue without new console errors. I did not reproduce a Dynamic `getSupportedOnramps` error in the clean-tab pass. Revenue's earnings request still returned the documented retryable error; spendable wallet balance loaded normally.

The buyer tab remains at the 0.001 USDC `Review payment` step. Its transaction is prepared but unsigned and unsubmitted. No provider session, payment, payout, settlement, claim, or chain transaction occurred in this verification. The wallet authorization still requires the account holder. U2, U4, C2, R3-R9, CO-25, and V5 remain open.

## Cash-out claim-link account check, 29 October 2026

Using the signed-in local Dynamic Sandbox artist, I checked `/dashboard/releases`, `/account`, and `/dashboard/revenue`. The artist's saved drafts and published release appeared, and the wallet showed 0.014 USDC. Earnings failed to load because the local settlement treasury configuration is missing. The capabilities response contained no verified ramp route, so Add funds and Cash out remained disabled. The browser tabs shared the same signed-in profile; this pass did not switch to a second identity. No provider quote, session, wallet signature, payout, claim, or chain transaction was created. This account check confirms the unavailable-provider state only; service and isolated PostgreSQL tests cover the claimed-allocation link because the account has no newly claimed earnings and no provider route.

The shared workspace tests passed 224 server tests, 214 client tests, and 23 admin tests; 12 unrelated database-only server tests were skipped. Workspace typecheck and build passed. A fresh disposable PostgreSQL database applied all 28 registered schema groups with no missing relations, columns, indexes, or constraints. The temporary test database container was removed after verification.

## Listener onboarding follow persistence, 29 October 2026

Using the local Dynamic Sandbox app and loopback test database, I signed in as the existing artist and a separate synthetic listener. The listener selected Kwaito and the artist during onboarding. The artist-only Releases route showed the listener's role gate, and the listener could create a private playlist, add a synthetic published track, reload, and still see the playlist as private. The public playlist list did not expose it. The listener's unfunded Testnet wallet and unavailable ramp actions remained in their expected empty/disabled states.

This browser pass exposed a mismatch: onboarding saved selected artist IDs as recommendations, but it did not create the follow relationship shown on the artist profile. Saving the personalization step now creates the selected follows idempotently and records one analytics event per newly inserted follow. Repeating the save does not duplicate the follow event, and direct profile follows use the same insert result to avoid duplicate analytics. After re-saving onboarding, the artist profile showed `Following` and one follower.

Focused engagement and onboarding service tests passed 26/26; the focused onboarding UI tests passed 7/7. The final workspace run passed 225 server tests, 214 client tests, and 23 admin tests, with 13 opt-in PostgreSQL server tests skipped. Workspace typecheck and production build passed. The local API readiness check reported all 28 schema groups healthy. No provider quote, order, payment, payout, wallet signature, claim, or chain transaction was created. Provider journeys, admin authentication, worker browser checks, the remaining responsive/keyboard/recovery matrix, and fresh purchase-to-claim acceptance remain open; CO-25 is still incomplete.

## Revenue mobile and full server database suite, 29 October 2026

At a 390-pixel browser viewport, the authenticated artist's Revenue page had no horizontal overflow. The 0.014 USDC wallet balance remained separate from earnings; Add funds and Cash out were disabled with the visible reason that no provider route is verified. Keyboard Tab moved from the earnings retry control to wallet transaction history. Earnings still showed the retry state because the local demo lacks its treasury/finalized-split setup. I reset the viewport and restored the browser to Releases afterward.

I repeated the responsive check in a temporary local browser tab using the signed-in artist Sandbox session. At 390×844, the document width was 375 pixels, so the page did not overflow horizontally. The wallet resolved to 0.014 USDC, Add funds and Cash out remained disabled with the no-route explanation, and keyboard Tab from `Try again` reached `View wallet and transaction history`. I reset the viewport and closed the temporary tab afterward; the existing Releases tab remained unchanged.

At the same 390-pixel width, I also opened Overview, Create, Tracks, Releases, Analytics, Royalty agreements, Revenue, and Account. Every route rendered its expected page heading without a `Failed to fetch` message or horizontal overflow. Document width was 375 pixels on seven routes and exactly 390 pixels on Royalty agreements. The viewport was reset and the temporary browser tab closed.

The workspace test command passed 225 server, 214 client, and 23 admin tests; workspace typecheck and production build passed. I then ran the complete server suite against a fresh disposable local PostgreSQL database with every database opt-in enabled: 328/328 passed, zero skips. The disposable database was removed. After adding timer-driven ramp polling checks, the focused ramp UI suite passed 45/45 and the full client suite passed 216/216; client typecheck passed. This adds partial mobile/keyboard and full database-backed lifecycle evidence for U4/CO-25 and CO-26. It does not verify the authenticated admin browser, the complete responsive/recovery matrix, real provider transactions, or a fresh creator-to-claim journey.

## Artist Sandbox route recheck, 29 October 2026

Dynamic's Sandbox Test Accounts switch was on. I did not change authentication settings. A clean local tab restored the signed-in artist test profile after an older Dashboard tab showed a blank page. Reloading the older tab restored the page, and the browser recorded no application errors.

At 390×844, I opened Studio Overview, Create, Tracks, Releases, Analytics, Revenue, Royalty agreements, and Account. Every route rendered its expected content without horizontal overflow. The document width was 375 pixels on seven routes and 390 pixels on Royalty agreements. Revenue loaded the 0.014 USDC wallet balance and kept Add funds and Cash out disabled because no provider route is verified. Earnings showed the retryable error because the local database lacks the agreement treasury and finalized-split registry. The Revenue page had no browser console errors.

The temporary browser tab and viewport override were closed and reset. The existing Dashboard and Releases tabs remained open. This recheck covers the artist test profile only; prior entries in this file record the separate listener test profile. Authenticated admin and worker checks, the remaining responsive and recovery cases, and provider journeys remain open. No provider session, quote, payment, payout, wallet signature, claim, or chain transaction occurred.

## Artist and isolated admin test-account browser pass, 29 October 2026

The local client was opened in a clean browser tab with the existing Dynamic Sandbox artist account. Overview showed five tracks, one live release, and three plays. Tracks showed playable recordings plus one upload awaiting processing; Releases showed three drafts and one published release; Analytics showed three streams and two unique listeners; the agreement list contained one active agreement and one awaiting responses. The wallet page resolved after loading to 9,999.9979448 XLM and 0.014 USDC. Revenue's earnings panel still required a retry, while spendable wallet funds loaded and funding/cash-out stayed disabled because no route is verified. There were no browser application errors; the console had a LaunchDarkly SDK warning.

I also started the admin frontend and API against a new loopback-only disposable PostgreSQL database, applied all 28 schema groups, and confirmed the unauthenticated ramp list returned HTTP 401. Browser setup created a synthetic first super-admin in that disposable database. The authenticated ramp console loaded its empty state at 390 × 844 with no horizontal overflow or browser errors. The database, test account, temporary environment files, and processes were removed or stopped afterward. The existing listener Sandbox role check is documented in [the earlier role matrix](#sandbox-artist-and-listener-role-check-29-october-2026). No provider order, quote, wallet signature, payment, payout, claim, or chain transaction was created. U4 now has authenticated-admin empty-state evidence, but its full desktop/mobile, slow-response, interruption, and recovery matrix remains open; C2 and provider acceptance remain open.

## Independent financial worker smoke, 29 October 2026

I applied the production migration entry point to a fresh disposable loopback PostgreSQL database and started the compiled financial worker from an isolated temporary directory with only local test settings. Settlement contract configuration was intentionally absent. The worker logged that settlement reconciliation was unavailable, stated that independent ramp and cash-out jobs would continue, and remained running. With an empty queue, the worker made no MoonPay request and submitted no Stellar transaction. The disposable database and worker were removed afterward.

The focused task-isolation, ramp-worker, and cash-out suites passed 26/26. Server typecheck and production build passed. This verifies worker scheduling and failure isolation, not an order's provider status progression or payout. CO-25 remains open for the full browser/recovery matrix and provider journey; R5 and V5 remain open for genuine provider integration and acceptance.

## Fresh Dynamic Sandbox identity and funding gate, 29 October 2026

I signed into Dynamic Sandbox with a fresh synthetic test identity using the already-enabled static test-account flow. The Music City API exchanged the Sandbox identity for a local session successfully (HTTP 200). I completed artist onboarding with test-only profile details, skipped optional artwork and social links, and reached the artist workspace. The EARLYUSER activation offer showed $0 due; no payment or terms acceptance was needed.

The test account's Account page showed its generated Stellar Testnet wallet with zero XLM and USDC. The Revenue page resolved spendable funds to 0 USDC and clearly disabled Add funds and Cash out because no verified provider route is enabled. Earnings could not load because the isolated local environment has no agreement treasury/finalized-split registry; the interface showed its retryable message without exposing internal configuration details. This is an environment setup gap, not evidence of a user balance problem.

The local API was configured against the loopback-only disposable test database, Dynamic Sandbox, and Stellar Testnet; the hosted database configuration was not used. The client had stopped between turns, so the browser first displayed its cached offline shell. Restarting Vite on the configured `localhost:3000` origin restored the current app. The browser then completed sign-in, onboarding, and route navigation. No app console errors appeared; the only warning was the Dynamic vendor LaunchDarkly initialization notice.

I checked Dashboard, Create, Tracks, Releases, Analytics, Agreements, Playlists, Discover, Artists, Account, and Revenue as the signed-in test artist. Each route loaded without an offline screen or `Failed to fetch`. Analytics showed zero streams and zero catalog activity. Create opened the release wizard, which I left unsubmitted. Revenue remained the only setup-limited page: earnings showed its retryable error because the isolated database lacks settlement treasury configuration; the wallet balance loaded and the provider actions stayed disabled.

This fresh identity verifies Sandbox authentication and artist onboarding, plus the correct no-provider funding gate. It does not verify an on-ramp, cash-out, quote, wallet signature, Testnet transfer, or purchase-to-claim lifecycle. U2, U4, C2, R3-R9, CO-25, and V5 remain open.

## Provider-neutral sandbox handoff check, 29 October 2026

Code review found the client discarded every capability except MoonPay, while the dialog labels and launch-origin checks also assumed MoonPay. The client now renders each buy or supported USDC sell route returned by the authenticated server, derives provider copy from the provider type, and validates handoff URLs against the exact shared sandbox host and path for that provider and direction. The server uses the same shared MoonPay target for its existing strict parameter validation. The MoneyGram target matches the sandbox widget host and path already used by the readiness check.

Focused ramp UI tests passed 35/35, including MoneyGram buy, sell, saved-order resume, and rejection of a lookalike host. The full client suite passed 222/222; client and server typechecks passed; the shared package built; and focused server ramp-launch/capability tests passed 5/5. The signed-in local test account still receives an empty capability list, so the local Revenue page correctly keeps Add funds and Cash out disabled. This change does not implement or verify a MoneyGram adapter, provider transaction, quote, payout, or payment. R3-R9, U2, U4, C2, CO-25, and V5 remain open.

## Listener and artist test-account release journey, 29 October 2026

The local Vite process was still targeting API port 4351 while the healthy isolated Sandbox API was listening on port 4339. Restarting the isolated client with `VITE_API_BASE_URL=http://localhost:4339/api/v1`, the matching Dynamic Sandbox environment, and the already-configured `localhost:3000` origin restored API requests. No production API or hosted database was used. Dynamic Sandbox Test Accounts was already enabled; I made no Dynamic settings changes.

A fresh synthetic test identity completed listener onboarding, saved a Kwaito preference and artist follow, and created a private playlist. Adding `Lifecycle Test Tone` succeeded and the track remained after reloading the playlist. I switched the account to listener + artist; EARLYUSER activated artist access at $0 due, with no payment. The account had a generated Stellar Testnet wallet with 0 XLM and 0 USDC. Trustline and send stayed unavailable while unfunded, and Revenue kept Add funds and Cash out disabled because there is no verified provider route. The earnings request still needs the local agreement treasury/finalized-split registry.

From the same test account, I created `SOW2 QA Test Single 2026-10-29`, uploaded a generated eight-second WAV, waited for `Audio ready`, added temporary generated QA artwork, and published the release locally. The public Releases page listed the release once. The Discover “Latest live releases” section showed three other releases, while the new recording appeared in the track catalog and its public track page. Playback reached 6.59 seconds of the eight-second file, and the stream count changed from 0 to 1; Artist Analytics also reported one stream and one unique listener. The release remained visible in Studio after navigation, and browser console errors were empty.

MoonPay's signed-in Partner Dashboard was also checked in Test Mode. Its transaction list showed three failed $100 XLM on-ramp attempts and no completed transactions in the displayed date range. The latest record showed `Payment authorization declined`, country GBR, and the external transaction ID `38423219-78e5-458c-bbc7-dca25762268a`. The dashboard offered no more specific decline reason. Its existing support conversation had created a ticket, but no human diagnosis was visible. No new provider transaction, quote, payment, payout, wallet signature, trustline, or Stellar transaction was attempted in this check.

This adds local listener onboarding, artist activation, playlist persistence, upload, processing, publication, playback, stream counting, and analytics evidence. It does not verify a provider route or the purchase-to-settlement-to-claim lifecycle. R3-R9, U2, U4, C2, CO-25, and V5 remain open.

## Testnet wallet funding and trustline check, 29 October 2026

The signed-in `SOW2 QA Listener` account began with an unfunded Stellar Testnet wallet. I funded that public test wallet through Stellar Friendbot; transaction `f752974985b4019233e77d7c8f2dcb039906a8c5ab8f52a75f5b2e9e99e0d8ff` supplied 10,000 test XLM. After reloading Music City's Account page, it showed the funded balance and enabled the USDC trustline action.

The trustline action requested Dynamic Sandbox step-up verification. The sandbox static test code completed authentication, and the wallet trustline succeeded. Music City then displayed `USDC trustline added`; the account showed 9,999.99999 XLM, an active USDC trustline, and 0 USDC. This is a Testnet wallet configuration transaction only; no USDC was received.

The Core Journey track page showed its `Buy 0.001 USDC` action disabled at a zero USDC balance. Revenue kept Add funds and Cash out disabled because no verified provider route is configured. The release appeared once under the test artist's Singles, with its recording separately listed under Top tracks. The Circle public faucet was prepared for Stellar Testnet and this wallet, but the page indicates reCAPTCHA protection; I did not submit the request or complete a CAPTCHA while action-time approval is pending.

The local API readiness route returned HTTP 200 with all 28 schema groups healthy, and `pnpm test:sow2-preflight` passed 4/4. No provider order, quote, purchase, payout, settlement, claim, or non-Testnet transaction occurred. C2 remains open: this account still needs test USDC, and the local Revenue flow still requires the settlement treasury and finalized-split registry. U2, R3-R9, U4, CO-25, and V5 remain open for their previously recorded provider and recovery cases.

## Follow-up Circle funding and isolated local browser pass, 29 October 2026

After action-time approval, I completed the Circle Testnet faucet's reCAPTCHA and submitted the request for 20 testnet USDC to the Sandbox QA wallet. Stellar Horizon confirms a successful 20.0000000 USDC payment at ledger 5,446,483 on 29 October 2026. The [Horizon transaction](https://horizon-testnet.stellar.org/transactions/6e4a54dd862d4be15577c3c08f6a0550c5c094d2ae07e310a8ff0dd78e49643b) paid wallet `GBVL2UCJKSSRH7DFHSXU7IO3VRDQLQQCTOW2WMR2S2BC47D73WOO5PHE`. The Account page showed 20 USDC alongside 9,999.99999 XLM. These are Stellar Testnet tokens with no real-world value.

During the browser follow-up, I found that one API restart had omitted `DATABASE_URL`. With no `server/.env` present, the server loaded the root `.env`, which points to the hosted Railway database. I completed the Dynamic Sandbox test account's onboarding on that process, updating its display name, listener/artist role, Amapiano preference, and $0 EARLYUSER artist activation. I stopped the API after discovering the target. No purchase, payout, release upload, or provider transaction was submitted through that process. I did not attempt a rollback against the hosted account because deleting or reverting an account without reviewing its prior state would be another production write and could remove existing test data. The root `.env` remains a hosted configuration; local runs must set an explicit loopback `DATABASE_URL` and pass the SOW2 preflight before the API starts.

The corrected pass used an explicit connection to the isolated local `sow2_current_demo_test` database, Dynamic Sandbox, Stellar Testnet and Circle's Testnet USDC issuer, with `STORAGE_PROVIDER=local`, `MEDIA_PROVIDER=local`, and provider ramps disabled. The local preflight passed. API readiness returned `ok: true`, all 29 schema groups were applied, and readiness reported local storage and local media processing.

Computer use showed the signed-in QA account's Account page with 9,999.99999 XLM and 20 USDC. Revenue showed 20 USDC spendable, 0.00 USDC available or pending, no purchases, and no verified ramp capabilities. Add funds and Cash out remained disabled with the no-route explanation. Playing the existing eight-second synthetic `Lifecycle Test Tone` in the isolated database completed at 0:08 and moved its stream count from 5 to 6. No upload was performed during this pass.

This verifies the Testnet faucet balance in the wallet UI, the empty provider gate, and a qualified synthetic playback in the correctly isolated local application. It does not verify provider checkout, payout, purchase, settlement funding, or claims. C2, U2, U4's remaining responsive/recovery matrix, R3-R9, CO-25, and V5 remain open.

The 390-pixel Revenue view had no horizontal overflow: the document width was 375 pixels and no element exceeded the viewport. Keyboard Tab moved from the Music City link to Studio and then to the account menu. The page reported no browser console errors. These checks cover the Revenue mobile empty-provider state only; the full U4 matrix remains open.

With the funded Sandbox wallet, the local browser opened the published `Core Journey` purchase review for 0.001 USDC. The review stated that the network fee is paid separately in XLM. I left the review open at `Confirm and pay` for the user to authorize the Stellar Testnet transaction. The UI reached review, but no payment was signed or submitted, so purchase, settlement and claim remain unverified in this pass.

The Dynamic Sandbox test identity also reached the local Music City account with both listener and artist access. The account page showed its Testnet balance and the provider-independent empty state; Add funds and Cash out stayed disabled because the capability API returned no verified routes. This verifies local authentication, wallet display, and safe route gating, but it does not stand in for a provider order or signed payment.

## Non-production database startup guard, 29 October 2026

The database service now rejects database initialization in development or test mode unless `DATABASE_URL` uses loopback PostgreSQL and a database name ending in `_test`. It also rejects a PostgreSQL `host` query override. A focused child-process test confirmed that the service stops before its first schema query when a non-production process targets a remote database.

The safety suite passed 3/3. The full server suite passed 230/230 with 13 opt-in database tests skipped, and server typecheck passed. The local SOW 2 preflight passed with an explicit loopback `_test` URL. After restarting the local API with the guard, readiness returned `ok: true` with 29 healthy schema groups and local storage and media. The purchase review remained open in the authenticated browser. No Testnet payment was signed or submitted.

The ramp repository PostgreSQL test passed 3/3 against a separate disposable local `_test` database with no skips. It checked persisted ownership and idempotency, append-only events, cash-out attempt recovery and expiry, and unchanged earnings and claim history. The test database was dropped afterward. It did not contact MoonPay or create a provider order.

## Read-only production deployment and migration audit, 29 October 2026

The live Music City site at `https://musiccity.pro` returned HTTP 200. Its `/api/v1/health/ready` path served frontend HTML rather than API readiness, so I checked the configured Railway API directly: `https://server-production-d758.up.railway.app/api/v1/health/ready` returned HTTP 200 with database and schema readiness true and 19 migration groups. Railway reports the server, media worker, financial worker, and Postgres online. Their latest successful deployments are from 26 October at commit `5190cd955b4a1e4215a0c78af754b15a2ef85229`; each deployment has `pnpm --filter server db:migrate` configured as its pre-deploy command.

The current local checkout is 155 commits ahead of `origin/main`. Local API readiness reports 29 schema groups. Production is missing these 10 current ramp groups: `2026-10-26-ramp-orders`, `2026-10-26-ramp-progress`, `2026-10-28-ramp-lease`, `2026-10-28-ramp-delivery`, `2026-10-28-ramp-quote-integrity`, `2026-10-28-ramp-cashout-attempt`, `2026-10-28-ramp-cashout-recovery`, `2026-10-28-ramp-launch-session`, `2026-10-29-ramp-refund-failure`, and `2026-10-29-ramp-claim-link`. Vercel reports the `musiccity.pro` deployment Ready, created 26 October; the deployment metadata available during this read-only check did not identify its source commit.

This audit establishes that the deployed stack is healthy at its older revision and that the current ramp implementation and migrations are not live. It does not establish a rollout or production migration. No deployment, data write, or production transaction was performed.

## Second Sandbox listener and local configuration check, 29 October 2026

I restarted the local Vite client on `http://localhost:3000` with explicit API settings for the healthy local API on port 4339. The API process used the loopback `sow2_current_demo_test` database, Dynamic Sandbox, Stellar Testnet, local storage and media, and no enabled ramp provider. Readiness returned HTTP 200 with all 29 schema groups applied. Dynamic Sandbox Test Accounts was already enabled.

A second synthetic Dynamic test identity completed listener onboarding and opened Discover, a published QA release, and its track page. Its generated wallet had no XLM, USDC, or USDC trustline, so a funded purchase could not be tested with this identity. No faucet request, trustline, purchase, wallet signature, or Stellar transaction was made for it. I signed back into `SOW2 QA Listener`; its Account page showed 9,999.99999 XLM and 20 Testnet USDC, with Add funds and Cash out disabled because no provider route is verified.

Using the funded QA identity, I prepared the `Core Journey` checkout for 0.001 USDC. The review showed the separate XLM network fee, recipient, order ID `payi_0595d57fd5d24eec`, and prepared transaction hash `05e33eb75d8754f03053879f5266a50efeb9b4e476dc3228416581c6d1537e33` marked `not submitted`. The payment review is left open for the user to authorize in the wallet. No signature, payment, settlement, or claim occurred.

Revenue showed the earnings retry state. The running API had checksum-valid agreement treasury and registry values but no `SETTLEMENT_CONTRACT_ID` or `SETTLEMENT_DEPLOYMENT_LEDGER`, so earnings and event indexing cannot be verified. The current treasury and registry values do not match the older verified settlement deployment, so those stale contract values were not substituted. I updated the local SOW 2 preflight to require checksum-valid agreement treasury, registry, and settlement contract IDs plus a positive deployment ledger. Its tests pass 4/4. Running its checks against the actual API and client process environments reports the missing contract ID and ledger; the admin API setting is also absent because the admin app is not running in this local session. The preflight checks formats only; they do not establish that the contracts are deployed or configured together. A verified settlement deployment configuration and a newly signed purchase-to-claim cycle remain open.

The second Dynamic Sandbox test identity, `SOW2 Buyer QA`, also signed into the isolated local app. Its account page showed listener access and a generated Stellar Testnet wallet with no XLM, USDC, or USDC trustline. Send, Add USDC trustline, Add funds, and Cash out were unavailable as appropriate. Its Revenue page showed the retry state because the local API lacks the settlement contract and deployment ledger. The `Core Journey` page exposed its purchase action, but I did not start a purchase or request funds for this identity. I signed back into the funded QA identity and confirmed the prepared 0.001 USDC payment review remained open for the user. No new wallet signature, payment, or chain transaction occurred.

Reloading the funded QA account restored the authenticated session and the 9,999.99999 XLM and 20 USDC Testnet balances. Keyboard navigation moved focus to the Music City home link without browser errors. This adds a reload-recovery and basic keyboard check; slow-response, cancellation, and full mobile recovery remain open in U4.

## Read-only settlement deployment verification, 29 October 2026

I ran the current `settlementChain.verifyConfiguration()` code against the E8 Testnet deployment tuple. The read-only Horizon and Soroban checks confirmed treasury `GAGX4VX7XATS7247VUYFYDX5FZISYL3ME6SAO2MOTWVFEUVDBFQGBEB5`, registry `CAVW5STWK2C7Y3RC5Z6BSKICRFR4GVI6HDWEFQ23PSVQ62DBYRN4NLNS`, settlement contract `CAU2GOWTTF54DHUDEHVHSYMR6KZCT2BQK6ZVQ3KF5KIVDXJJHI4FBA43`, 2-of-3 treasury threshold, and deployment ledger `5,204,451`. The verified deployment is still available on Testnet. The running local API uses a different treasury and registry and has no settlement contract or deployment ledger configured; this successful verification does not change that process or validate a new purchase-to-claim cycle.

## Local SOW2 runtime aligned to verified Testnet deployment, 29 October 2026

I added `pnpm verify:sow2-settlement-config`, a read-only check that validates the live Testnet registry/treasury relationship, settlement contract configuration, 2-of-3 signer threshold, and deployment ledger using the current server code. It passes against the E8 deployment tuple above. Using the old local treasury with the E8 settlement contract fails verification because that treasury does not meet the required three independent weight-one signers and threshold of two.

I restarted only the local API with the verified E8 tuple, explicit loopback `_test` database, Dynamic Sandbox, Testnet USDC, local storage/media, and ramp providers disabled. I did not edit `.env`, run a production migration, or submit a chain transaction. API readiness returned HTTP 200 with the database healthy and all 29 schema groups applied. The runtime local preflight and `pnpm verify:sow2-settlement-config` both passed.

Computer use confirmed Revenue now loads for both Dynamic test accounts. `SOW2 QA Listener` showed 0.00 USDC available, 0.00 pending, and 20 USDC spendable. `SOW2 Buyer QA` showed 0.00 available, 0.00 pending, and 0 USDC spendable. Both kept Add funds and Cash out disabled because no provider route is verified. The old checkout review to the mismatched treasury was closed; the UI confirmed no payment was sent. This restores earnings visibility but does not complete a fresh purchase, settlement funding, or beneficiary claim. The purchase-to-claim signature remains a user wallet handoff.

With the verified treasury active in the local API, I prepared a fresh 0.001 USDC `Core Journey` purchase review from the funded QA listener. Computer use verified the E8 Testnet treasury recipient and the transaction hash marked `not submitted`. Order `payi_07e8ee4a77a342ae`; prepared hash `56df4854e6c437e3a167d8dd5750c1a8987e9a98261be8ddc6c6f40c6d1e4dfa`. Before the user could authorize it, I confirmed the settlement-event history gap below and closed the review. The UI showed `Payment review closed. No payment was sent.` No wallet signature, payment, settlement, or claim occurred. Do not sign or reuse this closed review.

## Stellar Testnet settlement-event history gap, 29 October 2026

The standard Testnet Soroban RPC's `getHealth` returned latest ledger `5,447,609`, oldest retained ledger `5,326,650`, and a 120,960-ledger window. The verified E8 settlement contract was deployed at ledger `5,204,451`. `getLedgers` from that deployment ledger and `getEvents` from that ledger both failed with a range error; `queryEvents` is not supported by this RPC. Read-only `getLedgers` checks against Ankr, Gateway.fm, and Tatum returned the same effective oldest ledger (`5,326,657`) and rejected the deployment ledger. No endpoint with full Testnet history was available in this environment.

Stellar's current guidance states that the default RPC event-history window is seven days. An RPC backed by a data lake can retrieve historical ledgers through `getLedgers`, but other RPC methods continue to use the local retention window; the public data lake documented by SDF is for Pubnet. Hubble contains historical contract-event records, but it is a read-only, batched BigQuery dataset that requires a billing project, and Testnet coverage/access for this contract was not established. Sources: [RPC retention and archive guidance](https://stellar.org/blog/developers/reconciling-stellar-events), [RPC data-lake behavior](https://stellar.org/blog/developers/rpc-now-with-infinite-scroll), [Hubble limitations](https://developers.stellar.org/docs/data/analytics/hubble), and [Hubble contract-event schema](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/history-contract-events).

The E8 contract/treasury configuration itself remains verified, but it is not sufficient to resume an index cursor that has fallen before available history. Do not advance or reset the cursor to hide the gap. C2 must wait for an archive-capable Testnet RPC or a complete, independently verified backfill into the durable event index. The unsigned purchase review was closed pending that recovery; no Testnet funds moved.

## Verified event backfill and second Circle faucet request, 29 October 2026

After action-time approval, I completed a second Circle Testnet faucet request. Stellar Horizon confirms another 20.0000000 USDC payment to `GBVL2UCJKSSRH7DFHSXU7IO3VRDQLQQCTOW2WMR2S2BC47D73WOO5PHE` at ledger `5,447,687`. The [payment transaction](https://horizon-testnet.stellar.org/transactions/9a8db3e0c8419e5a8ff5f6eee86dc60b72ad64ab1f7867d760948529f4a67870b) succeeded at 08:21:15 UTC. The local Account page now shows 40 Testnet USDC and 9,999.99999 XLM. These tokens have no real-world value.

The local API ran with the isolated loopback `sow2_current_demo_test` database, Dynamic Sandbox, Stellar Testnet, local storage and media, disabled ramp providers, and the verified E8 contract at deployment ledger `5,204,451`. Readiness returned HTTP 200 with all 29 schema groups healthy.

The settlement event index now backfills older E8 events from StellarExpert's Testnet contract index. It checks the explorer's event total against its paginated results, then verifies each returned record against Horizon's successful transaction, transaction-envelope hash, fee receipt, contract method, and current E8 batch state. The first local run verified 16 events across six batches: six `settlement_funded` events and ten `claim_consumed` events from ledgers `5,204,454` through `5,248,692`. The live RPC query returned zero newer contract events for that pass. The index cursor advanced to ledger `5,447,894` and reported caught up. A second pass returned zero new events. The reconciliation report returned `ok: true`, no discrepancies, and equal open obligations and escrow balances of `100,000` USDC base units.

StellarExpert is a third-party event index, not an SDF archival RPC. The adapter verifies every event it receives, but the provider's own event count does not independently prove that the index omitted no event. The current batches and receipts reconcile against contract state. Keep this source limitation in deployment review.

The first diagnostic backfill used explorer-specific IDs and appended 16 duplicate rows beside the 16 existing Soroban event rows in this isolated test database. The table's append-only trigger rejected deletion, so those diagnostic rows remain. The adapter now converts explorer IDs to canonical Soroban event IDs. It checks that each replay matches the existing receipt payload. The current database has 32 rows for 16 distinct transactions, and the reconciliation report accepts the repeated rows only when the transaction hashes and receipt data agree. A production database has not received this backfill.

With the funded `SOW2 QA Listener` account, the local browser prepared a new `Core Journey` purchase review for `0.0010000 USDC`. The review shows the verified E8 treasury `GAGX4VX7XATS7247VUYFYDX5FZISYL3ME6SAO2MOTWVFEUVDBFQGBEB5`, order `payi_8ee31d04a8624c7e`, and prepared transaction hash `3895ad5edb0e68f9b7ab5a78ae9050897498560a2148e7e7994b8fbf63250051`, marked `not submitted`. It states that the network fee is paid separately in XLM. The review remains open for the wallet owner to authorize. No purchase, settlement, or claim has been submitted.

`SOW2 Buyer QA` remains a separate, unfunded Dynamic Sandbox identity. Both accounts still show Add funds and Cash out disabled because no verified provider route is enabled. The checklist is 21 of 27 items complete by equal item count. C2 remains open until the wallet owner signs the Testnet purchase and the resulting settlement and beneficiary claim reconcile. U4 still needs the remaining browser recovery checks. MoonPay's verified sandbox journey and provider-dependent work remain open.

## Local revenue responsive and keyboard check, 29 October 2026

I restarted the local client at `http://localhost:3000` and checked its existing API at `http://localhost:4339`. The SOW2 preflight passed against the API process configuration, which targets `127.0.0.1:32768/sow2_current_demo_test`, Dynamic Sandbox, Stellar Testnet, local storage and media, and disabled ramp providers. Readiness returned HTTP 200 with all 29 schema groups healthy.

In the browser, `SOW2 QA Listener` showed 40 USDC spendable, zero earnings, and no verified funding or cash-out route. At a 390-pixel viewport, the Revenue and track-detail pages had a 375-pixel document width with no horizontal overflow. Keyboard navigation on the track-detail page reached Play and then Buy without activating either control. This adds responsive and keyboard evidence, but U4 remains open for the cancellation, slow-response, reload, and recovery checks. No provider order or financial action was created.
