# Record the SOW 2 demo

Use this run sheet to separate the live product walkthrough from the completed Stellar Testnet evidence. The hosted financial, creator, and provider flows are not all ready to record as live transactions.

## Before recording

- Use the hosted app for the product walkthrough and admin empty state.
- The public artist directory is now clean: `/artists` and Discover's **Artists in motion** show the three profiles with published releases. This was deployed and checked on 29 October 2026.
- Keep playback under five seconds unless you intend to add a public stream.
- Do not present the Marketplace as a completed purchase. It has no track sale enabled. The 15 USDC Music City Pass was viewed but not purchased.
- Do not show Add funds or Cash out as working. No provider route has a verified successful transaction.

## Clip 1: Hosted product walkthrough

Open [Discover](https://musiccity.pro/discover), show the three live-release cards and the three release-backed profiles in **Artists in motion**, then open the [artist directory](https://musiccity.pro/artists). Open [Delight's Isgubhu release](https://musiccity.pro/releases/rel_0fcde14a70674ad2) and its [track page](https://musiccity.pro/stream/trk_f9cc725f7966466b). The track page shows a published 4:39 recording. Avoid playing it for five seconds or longer during the recording.

For the admin view, open [Settlements](https://music-city-admin.vercel.app/console/settlements). Say that production reconciliation is healthy and empty. There are no production earnings sources or settlement records to process.

## Clip 2: Local creator upload and release

Use the [local creator upload evidence](sow2-hosted-demo-handoff.md#local-creator-upload-smoke-test) on the isolated Sandbox app and database. Show release details, an authorized audio file and artwork, **Audio ready**, review, publication, and playback. Label the recording **Local app and isolated database**. This verifies the creator flow locally, not production artist access. The production account is now at step 4, **Artist profile**; its previous activation screen showed $20 due and no early-user offer. The profile fields remain blank.

Local playback verification on 29 October also used a synthetic six-track EP in the isolated database. Release-level Play advanced through all six tracks, and the stream counts remained after reload. Keep this as technical evidence only; it is test content and does not establish hosted playback or a zero-gap transition.

## Clip 3: Agreement and treasury controls

Use the dated [E7 agreement lifecycle evidence](contributor-agreements-evidence/lifecycle-review/README.md) to show the signed contributor proposal and the admin's two-signature finalization. Label the recording **Stellar Testnet**. Explain that the contributor signatures are separate from the treasury's 2-of-3 authorization. Do not show private signer material.

## Clip 4: Testnet purchase-to-claim result

Use the saved screenshots and receipts for this completed local Testnet cycle. Label the clip **Stellar Testnet, local app and database**. It is not a production transaction.

1. Show the [purchase](core-lifecycle-evidence/current-qa-purchase-2026-10-29.png). One 0.0010000 USDC purchase created the listening entitlement and two royalty entries.
2. Show the [funded batch](core-lifecycle-evidence/current-qa-funded-2026-10-29.png). Two treasury signatures funded 0.0010000 USDC.
3. Show the [closed batch](core-lifecycle-evidence/current-qa-closed-2026-10-29.png) and the [artist's received payment](core-lifecycle-evidence/current-qa-artist-received-2026-10-29.png). The two beneficiary claims were 0.0003000 and 0.0007000 USDC. Reconciliation passed with no remaining obligation from this purchase.

The [evidence log](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) links each transaction to Stellar Horizon.

## Creator and provider limits

Do not record artist setup or publication as a hosted success yet. With the user's approval, **Continue** saved the artist intent and advanced onboarding through the activation screen to step 4, **Artist profile**. The activation screen showed **$20.00 due today** and said the early-user offer was unavailable. The Artist profile form is blank and unsaved. No artist access, payment, legal acceptance, or publication was completed. The production upload and publication path still needs artist access and approved demo media. For a local creator rehearsal, follow the [isolated local demo guide](sow2-local-demo.md) and confirm its database preflight before writing.

Do not claim a successful on-ramp or off-ramp. MoonPay has no successful sandbox order, and MoneyGram still lacks the required non-custodial Stellar partner mode. Keep both routes disabled in the demo.
