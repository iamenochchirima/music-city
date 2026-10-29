# Prepare Music City for production demos

Make the current creator, listener, and admin flows work on the hosted applications, then rehearse them through computer use. Target a recording-ready product in the next few hours. Estimates below are working budgets, not a delivery guarantee.

The [SOW 2 tracker](sow-2-tracker.md) remains the scope and acceptance record. The [implementation checklist](sow2-provider-independent-implementation-plan.md) and [verified local financial cycle](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) retain their evidence. This plan orders the remaining release and usability work; it does not replace those records.

## Start from the verified state

- Local application/evidence baseline: `018f7de`. A fresh purchase, two-signature treasury funding, both beneficiary claims, and final reconciliation passed on Stellar Testnet. Creator onboarding and publication have separate dated browser evidence.
- Live check at 13:01 SAST on 29 October 2026: `musiccity.pro`, the Vercel admin, and the Railway API returned HTTP 200. API readiness reported 19 healthy schema groups; current local code expects 29. Production admin bootstrap reported `bootstrapRequired: true`.
- MoonPay and MoneyGram remain unavailable for a verified funding/cash-out journey. Keep those routes disabled. Their external approval and testing do not hold up the other demos.
- Preserve the unrelated, untracked `docs/core-lifecycle-evidence/checkpoint.json` and all existing customer and financial records.

## Follow this order

| Work | Budget | Visible result |
| --- | --- | --- |
| 1. Prepare the release and demo accounts | 20–30 min | One reviewed revision and usable accounts |
| 2. Roll out API, workers, client, and admin | 30–50 min | Hosted apps run the reviewed code and migrations |
| 3. Rehearse and fix the actual user paths | 60–90 min | Core demos pass through computer use |
| 4. Prepare the recording handoff | 20–30 min | Short scripts, ready tabs, and verified receipts |

Work through the list once. Prioritize failures that prevent sign-in, music creation, playback, payment, claiming, or recording. Use remaining time for visible copy, layout, and navigation problems found during rehearsal. Record unrelated improvement ideas for later.

## 1. Prepare one release and usable accounts

- [ ] Fetch the latest remote changes and compare them with the local work. Integrate any new changes and record the exact release revision.
- [ ] Review the outgoing changes and production configuration. Confirm the client, admin, API, media worker, and financial worker point to the intended services.
- [ ] Confirm the hosted Dynamic environment, Stellar network, USDC issuer, treasury, registry, and settlement contract match. Keep Sandbox identities and disposable data out of the live customer database. Label Testnet financial recordings clearly.
- [ ] Confirm access to one artist, one contributor, one fresh buyer, and one production administrator. Prepare authorized audio and artwork. Check wallet funding, trustlines, and signer access before the financial rehearsal.
- [ ] Run the release checks from [production deployment](production-deployment.md): tests, typecheck, and builds. Reuse valid results for unchanged code; rerun affected checks after fixes. Confirm current migrations against an isolated existing-data test database.

Ready when: there is one release candidate, every required role can be accessed, and the demo's network and data location are explicit. If hosted configuration prevents the financial rehearsal, resolve it here rather than switching environments during recording.

## 2. Put the current implementation on the hosted apps

Execute the rollout after the release candidate is reviewed and deployment is authorized. Follow the existing deployment guide and update its primary client URL to `https://musiccity.pro`.

- [ ] Take a private production database backup before migrations. Record the backup location privately and capture baseline record counts.
- [ ] Deploy the Railway API with the registered migration command. Verify readiness against the current schema manifest, including all 29 groups at this baseline.
- [ ] Deploy the media worker and financial worker from the same revision. Verify real job progress and financial-index freshness, not only process status.
- [ ] Deploy both Vercel applications from the reviewed revision. Verify `musiccity.pro` and the hosted admin use the intended Railway API and authentication origins.
- [ ] Open first-admin setup for the owner to set the production password. Complete normal sign-in and verify access to Agreements, Royalties, Settlements, and reconciliation. Keep setup credentials out of the demo.
- [ ] Compare preserved data counts and spot-check existing releases, payments, and claims. Record deployed revisions and migration results. Keep the previous application deployment available for rollback if the release fails.

Ready when: the hosted client, admin, API, and both workers run the intended release; current migrations pass; admin sign-in works; existing records remain available.

## 3. Rehearse the product and fix visible blockers

Use the actual hosted applications through computer use. For each row, perform the path, fix any reproduced issue, and repeat the affected path. Save a receipt or screenshot where it proves the result. Check one narrow mobile viewport and desktop; use keyboard navigation on the main forms and review screens.

| Done | User path | Pass condition |
| --- | --- | --- |
| [ ] | Sign in and onboarding | Sign-in on `musiccity.pro` reaches the correct account. New users can finish onboarding. Back and Cancel work; saved details survive return. Existing users reach the app without repeating onboarding. |
| [ ] | Create and publish music | Enter release details, add WAV/MP3 audio and artwork, review track information, and publish. Selected tracks appear once in the same working area. Upload/processing progress is visible and updates automatically. Pending publication completes after audio is ready. |
| [ ] | Listen from the catalog | Open Discover, artist, release, and track pages. Ready tracks play from their visible buttons; volume and mute work. A release continues to its next track. Existing artwork loads and empty/duplicate release categories are absent. |
| [ ] | Agreements and treasury | Create/review the intended split, collect contributor responses, and finalize with the required treasury signatures. Show the resulting agreement version and receipt. |
| [ ] | Purchase and earnings | Use a buyer who has not bought that track. Complete one purchase. Purchased persists after reload. Show the matching sale and exact beneficiary allocations without another charge. |
| [ ] | Admin settlement | Approve the purchase source, review allocations, reserve once, and fund with two treasury signatures. Show confirmation and the matching receipt. |
| [ ] | Both beneficiary claims | Each beneficiary claims through their own wallet. Received and wallet funds update. Reload preserves the result; admin shows Closed and reconciliation passes. |
| [ ] | Direct fan support | Complete an authorized demonstration transfer to an artist or contributor. Show sender and recipient history and the confirmed receipt. Keep support separate from royalty earnings. |
| [ ] | Cancel, refresh, and return | Cancel a review before signing, retry a failed load, and refresh during confirmation. Show the original transaction's result without duplicate payment. Loading and waiting states remain visible. |

Fix these usability issues when the rehearsal exposes them:

- [ ] Use short, familiar labels. Replace user-facing phrases such as “verified provider route” with plain availability copy. Keep implementation explanations in the evidence document.
- [ ] Check form spacing, mobile overflow, tap targets, focus, readable amounts, and one clear next action. Keep transaction details available without crowding the main flow.
- [ ] Make wallet handoffs explicit: show the amount, destination, current account, and what the user must click. Prepare the review immediately before signing so it does not expire while instructions are given.
- [ ] Keep unavailable Add funds/Cash out actions understandable and prevent a failed checkout path. Present their provider status honestly in the demo notes.

Ready when: each core row passes on the intended hosted environment, any remaining row has an explicit reason, and no known blocker interrupts the selected recording paths. A local result does not count as hosted verification. Provider buy/sell success remains a separate requirement.

## 4. Make the demo ready to record

- [ ] Rehearse these clips once, in order: artist creation/publication; agreement/admin finalization; purchase/funding/both claims; direct support and history. Aim for 3–5 minutes per clip, with transaction waits edited or shown honestly.
- [ ] Prepare fresh inputs for actions that cannot be repeated: an unpurchased recording/buyer pair, future claim deadlines, and sufficient network fees. Retain the completed receipts for the results portion. Prepare each expiring signature review only when the signer is ready.
- [ ] Leave the exact application tabs open in recording order. Supply one-line click instructions for each wallet handoff. Hide credentials, OTP setup screens, unrelated test fixtures, and private signer files from the recording.
- [ ] Update the demo guide with the current hosted URLs, account roles, button names, and successful rehearsal results. Clearly distinguish hosted production behavior, Testnet receipts, and the earlier local evidence.
- [ ] Package the deployed revision, contract IDs/network, passing checks, transaction receipts, screenshots, and final reconciliation. Update the canonical SOW tracker only for demonstrated results.
- [ ] Provide the owner a short recording handoff in this chat with ready links, clip order, and remaining provider limitations. Record reviewer acceptance when the reviewer supplies it; it does not block preparing the demos.

## Keep provider work separate from the recording deadline

The five open provider checklist items remain tracked in the existing implementation plan. MoonPay needs a successful account-specific sandbox journey and supported asset route. MoneyGram needs the non-custodial Stellar partner mode. After a route works, finish its authenticated launch, populated browser flow, provider-specific refunds, and any required conversion verification. Do not enable a route based only on valid credentials or show a simulated provider result as a completed transfer.

## Stop condition for this release pass

The selected demo paths work on the intended hosted release, production admin access works, workers advance real jobs, migrations and reconciliation pass, the owner has recording-ready tabs and instructions, and known provider limitations are disclosed. Any remaining implementation failure stays unchecked. Production verification and reviewer acceptance remain separate claims.
