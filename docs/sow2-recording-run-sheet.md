# Record the SOW 2 demo

Keep this rehearsal on the local Sandbox app and isolated database. The hosted product and the completed Stellar Testnet journey are separate evidence; label each clip with the environment it shows.

## Current local setup

Checked on 29 October 2026:

- The local client at `http://localhost:3000` is signed in as **SOW2 Sandbox Artist**. Studio shows one published synthetic release, **Sandbox QA EP** (two tracks). The release setup page is available at `/dashboard/create`.
- Both tracks are marked **Ready**. Studio Analytics currently shows six streams and one unique listener from synthetic QA playback; label those values as test data if the page is shown, not as audience results.
- Computer use started `music-city-sandbox-qa`, paused it at 0:01, and reloaded the page. Its stream count remained 4; the volume and mute controls appeared, and the browser reported no console errors. This verifies start/pause and the short-listen threshold for this fixture, not zero-gap transitions.
- At a 390-pixel viewport, local Studio Releases, Create setup, Analytics, Revenue, and release details stacked without horizontal overflow. Analytics and Revenue scroll vertically as expected.
- The local API at port `4339` returns HTTP 200 from `/api/v1/health/ready`. The database and all 29 schema groups are healthy; storage and media use local providers.
- The local Revenue screen resolves earnings and spendable balance to `0 USDC`. Add funds and Cash out are disabled with an explanation that those routes are unavailable; this is an honest empty state, not a provider demo.
- `node scripts/check-sow2-local-env.mjs` passes for the isolated loopback `_test` database, Dynamic Sandbox, Stellar Testnet, local storage/media, and disabled ramps. The read-only Stellar verifier confirms the Testnet treasury, registry, settlement contract, deployment ledger, and 2-of-3 signer threshold.
- Fresh recheck at 18:30 SAST on 29 October: I restarted the local API on port `4339`, client on `3000`, and admin on `4318`. Readiness returned HTTP 200 with the database and all 29 schema groups healthy. The client and admin returned HTTP 200. Computer use reloaded **Sandbox QA EP**, started its release-level player, and paused `music-city-sandbox-qa-2` at 0:01. The two track counts stayed at 2 and 4, and the browser reported no errors. The browser is back on Studio Releases.
- The local admin app is at `http://localhost:4318/auth`. It currently shows the sign-in form; an authenticated local admin browser session has not been reverified. Use the saved E7/E8 admin evidence for protected admin screens instead of claiming a live local admin view.
- Do not show credentials, wallet secrets, or real customer data. No production sign-in, provider order, or new chain transaction was part of this local check.

## Before recording

Run `node scripts/check-sow2-local-env.mjs` and confirm `http://localhost:4339/api/v1/health/ready` is healthy. Keep the API and client on the configured local ports. If the app or API restarts, refresh the page and confirm that it remains signed into **SOW2 Sandbox Artist** before recording. The full setup is in the [local demo guide](sow2-local-demo.md).

Use synthetic or otherwise authorized media. Keep test content labeled **Local app and isolated database**. Do not present a Sandbox/Testnet operation as a production transaction. Keep playback shorter than five seconds unless you intend to add a stream to the local test data.

## Clip 1: Local artist studio

Start at [local Releases](http://localhost:3000/dashboard/releases). Show **Sandbox QA EP** once, its published status, and the preview link. Open [Create](http://localhost:3000/dashboard/create) to show the five-step release setup: release type and name, songs, song details, artwork and release details, then review and publish. Label the clip **Local Sandbox app and isolated database**. This shows the current local release UI; it does not establish hosted artist access.

Studio Analytics is optional. It currently reports six streams from one unique listener on the synthetic EP; say that these are QA playback counts if you include the screen. The local artist's Agreements page is empty, so use the saved E7/E8 evidence for agreement and treasury controls.

Open [local Revenue](http://localhost:3000/dashboard/revenue) only if you want to show the unavailable funding state. It displays zero earnings and spendable balance; Add funds and Cash out are disabled. Do not describe either provider flow as completed.

For a complete audio upload demonstration, use the dated [multi-format browser verification](audio-upload-evidence/2026-10-29-multi-format-browser-e2e.md) and [local creator upload smoke test](sow2-hosted-demo-handoff.md#local-creator-upload-smoke-test). WAV, MP3, FLAC, OGG, M4A, and AAC passed through the local release flow. Do not create another release just for the recording unless the synthetic media is available and the isolated database preflight passes.

## Clip 2: Agreements and treasury controls

Use the dated [E7 agreement lifecycle evidence](contributor-agreements-evidence/lifecycle-review/README.md) to show the contributor proposal and admin finalization. Label it **Stellar Testnet**. Contributor signatures are separate from the treasury's 2-of-3 authorization. Do not show private signer material.

## Clip 3: Testnet purchase to claim

Use the saved receipts for the completed local Testnet cycle. Label it **Stellar Testnet, local app and database**; it is not a production transaction.

1. Show the [purchase](core-lifecycle-evidence/current-qa-purchase-2026-10-29.png). One 0.0010000 USDC purchase created the listening entitlement and two royalty entries.
2. Show the [funded batch](core-lifecycle-evidence/current-qa-funded-2026-10-29.png). Two treasury signatures funded 0.0010000 USDC.
3. Show the [closed batch](core-lifecycle-evidence/current-qa-closed-2026-10-29.png) and the [artist's received payment](core-lifecycle-evidence/current-qa-artist-received-2026-10-29.png). The beneficiary claims were 0.0003000 and 0.0007000 USDC. Reconciliation passed with no remaining obligation from this purchase.

The [evidence log](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) links each transaction to Stellar Horizon. These saved receipts are the proof; do not create duplicate payments to reproduce them.

## Limits to state clearly

MoonPay has no successful sandbox order, and MoneyGram still lacks the required non-custodial Stellar partner mode. Funding and cash-out stay disabled. The local admin sign-in has not been reverified after the API restart; rely on dated admin screenshots for now. Do not present artist activation, provider funding, cash-out, or a new hosted transaction as complete.

Production checks are documented separately in the [SOW 2 production demo plan](sow2-production-demo-plan.md). The current recording rehearsal remains local.
