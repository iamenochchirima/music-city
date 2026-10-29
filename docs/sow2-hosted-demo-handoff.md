# SOW 2 hosted demo handoff

Status checked 29 October 2026. This guide separates the production pages that are ready to show from SOW 2 journeys that still need setup or wallet authorization.

## Ready to show

Start at [Discover](https://musiccity.pro/discover). The page shows the three live releases once, with featured tracks and no empty playlist category. Playback, pause, mute, and volume controls were checked in the browser. A listen under five seconds did not count; crossing five seconds added one stream to Isgubhu, moving it from three to four. For another recording, keep playback under five seconds unless you want another public stream counted.

The public account page is [musiccity.pro/account](https://musiccity.pro/account). Sign-in was checked through Google and Dynamic. The account used for this rehearsal is listener-only and its wallet is on Stellar Testnet. Keep the account page out of the recording unless you hide the wallet address and balances; it currently has no track, payment, or subscription history.

The [Marketplace](https://musiccity.pro/marketplace) currently says no track purchases are live. It shows a separate Music City Pass offer: three locked tracks for 15 USDC every 30 days. The offer was viewed, not purchased. Do not present it as a completed transaction.

The [Music City Admin console](https://music-city-admin.vercel.app/console/admins) has one production super-admin, and normal sign-in was verified. Agreements and the royalty ledger are empty. Settlement reconciliation reports **Reconciled** with zero funded, claimed, recovered, unclaimed, or escrow USDC; there are no approved earnings sources or settlement records. This verifies admin access and empty states, not an agreement or settlement transaction.

## Creator access

The artist-entry fix was pushed in `f2b8445` and is live on `musiccity.pro`. On 29 October, computer use clicked **Set up artist profile** on `/dashboard/releases/new`; the signed-in listener reached step 2, “How will you use Music City?”, with **I’m an artist** preselected. At a 390-pixel viewport, the page has no horizontal overflow. Continue was not pressed, so the account remains unchanged and listener-only. Focused onboarding tests (9), client typecheck, client production build, and the server regression test pass. This verifies artist setup entry only; an authorized artist profile, activation, and approved demo audio/artwork are still needed to verify upload and publication.

## Short production walkthrough that is ready now

This is a read-only product walkthrough, not a completed SOW 2 transaction demo:

1. Open [Discover](https://musiccity.pro/discover) and show the three current live releases and featured tracks.
2. Open [Delight’s artist profile](https://musiccity.pro/artists/usr_0d9124aacde146c9), then open its single, [Isgubhu](https://musiccity.pro/releases/rel_0fcde14a70674ad2).
3. Open [Isgubhu track details](https://musiccity.pro/stream/trk_f9cc725f7966466b). The current page shows a 4:39 published track and 4 streams. The page and its Support amount dialog fit a 390-pixel viewport; cancel the dialog before **Review support** because no support transfer is being demonstrated.
4. For an admin readiness clip, open [Settlements](https://music-city-admin.vercel.app/console/settlements) after signing in. It shows a reconciled, empty production ledger, not a funded settlement.

The artist directory currently exposes an empty `SOW2 QA Listener` profile with no releases or tracks. Do not use that profile in the walkthrough. Its visibility should be resolved before a public-facing directory recording. Avoid playing a production track for five seconds or longer during an unplanned take; that can add a public stream.

## Remaining setup before recording SOW 2 transactions

1. Sign in at [Music City Admin](https://music-city-admin.vercel.app/auth) with the production super-admin account. Keep the password out of screenshots and recordings.
2. Sign in to the artist account and prepare one authorized audio file and artwork. Publish a demo release, then use the track's **Track sales** setting to enable a one-time USDC price. The public Marketplace currently has no purchase-enabled tracks.
3. Prepare the contributor and fresh buyer accounts. Confirm their Testnet wallets, USDC trustlines, and XLM for fees. Keep the chosen network and asset visible in the recording.
4. Have both authorized treasury signers available before opening a funding review. Each beneficiary must be available to sign their own claim. Wallet signatures must be made by the account owner in the wallet prompt.

## Suggested recording order after setup

1. Artist: create and publish a release with the prepared audio and artwork.
2. Artist and contributor: review and approve the split. Admin: finalize the agreement with the required treasury signatures.
3. Fresh buyer: purchase the enabled demo track and show its confirmed status.
4. Admin: approve the purchase earnings, review the allocation, reserve once, and fund with two treasury signatures.
5. Each beneficiary: claim with their own wallet. Admin: show the closed batch and successful reconciliation.
6. Artist or contributor: show a separately labeled direct-support transfer only if its Testnet handoff is ready.

Use the earlier [local SOW 2 demo guide](sow2-local-demo.md) and [E8 evidence](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) for the proven Testnet lifecycle. Label any local recording as local evidence; it does not prove that the same financial path passed on the hosted production application. MoonPay and MoneyGram routes remain disabled and are outside these clips.

## Current release and verification

- Railway API and workers: `0aa57d9`; Vercel admin: `0aa57d9`.
- Vercel client: functional fixes `4ec021b` and `13c3154`; the latter deployment was checked live on `musiccity.pro`.
- Fresh check at 15:15 SAST: Railway API, media worker, and financial worker are Online; readiness returns HTTP 200 with all 29 schema groups applied. Latest client and admin Vercel production deployments are Ready, but CLI inspection did not expose their source SHAs. Production first-admin setup is complete; the owner signed in and the Admins page shows one super-admin.
- Railway's media and financial workers are deployed successfully. Existing media jobs are complete with no backlog; a fresh upload still needs an authorized artist and demo file. The Stellar Testnet financial cursor was caught up with zero errors and three ledgers behind Horizon at the latest check.
- There are currently no production payment intents, confirmed payments, support payments, settlement batches, or claims. There are no hosted financial receipts to use as a completed-transaction demo.
- The hosted admin's Agreements and Royalties pages are empty. Settlement reconciliation passes with all balances at zero, and there are no approved earnings sources or settlement batches.
- A Dynamic Sandbox static-OTP identity did not authenticate to the hosted client, which is configured against a different Dynamic environment. Use an account belonging to the hosted environment for the demo; do not present that Sandbox identity as production access.
- Client checks for `13c3154`: 23 focused ramp tests, client typecheck, and production build passed.
- Artist-entry fix `1dfad1b`, regression test `193b883`, and QA notes are included in pushed production commit `f2b8445`. Vercel deployment `v0-music-city-dg1tbf6fa-iamenochchirimas-projects.vercel.app` is Ready and aliases `musiccity.pro`. Computer use confirmed the live listener account now reaches step 2 with **I’m an artist** selected; the user did not continue, so no account change was made. Upload and publication still need an authorized artist profile and approved demo media.
- The complete hosted agreement, purchase, settlement, and claim journey has not yet been rehearsed.

## Local creator upload smoke test

On 29 October 2026, the browser rehearsal on `http://localhost:3000` used the isolated `sow2_current_demo_test` database and the Sandbox test artist `SOW2 QA Listener`. A generated 44.1 kHz stereo PCM WAV uploaded successfully; the release workspace showed **Audio ready**. An 800 × 800 PNG cover saved, the review showed artwork, a valid tracklist, and ready audio, and publishing succeeded in the local test environment. The release appeared once in Studio and its fan page opened. Playback of the uploaded WAV started and reached the end without a media-source error. The file was exactly five seconds long; the server recorded 4.91 seconds listened, so it correctly remained below the five-second stream threshold. This is local evidence only and does not replace the hosted artist upload/publish rehearsal.

One older seeded `SOW2 QA Tone` fixture still points to unavailable local media and produced an audio-source error. The freshly uploaded WAV played normally; use newly uploaded media for local demonstrations instead of that stale fixture.
