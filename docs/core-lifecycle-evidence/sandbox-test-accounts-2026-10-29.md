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
