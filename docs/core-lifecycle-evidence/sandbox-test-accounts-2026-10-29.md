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
