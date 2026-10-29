# Prepare Music City for production demos

Make the current creator, listener, and admin flows work on the hosted applications, then rehearse them through computer use. Target a recording-ready product in the next few hours. Estimates below are working budgets, not a delivery guarantee.

The [SOW 2 tracker](sow-2-tracker.md) remains the scope and acceptance record. The [implementation checklist](sow2-provider-independent-implementation-plan.md) and [verified local financial cycle](core-lifecycle-evidence/README.md#current-local-financial-cycle-closed-29-october-2026) retain their evidence. This plan orders the remaining release and usability work; it does not replace those records.

## Start from the verified state

- Local application/evidence baseline: `018f7de`. A fresh purchase, two-signature treasury funding, both beneficiary claims, and final reconciliation passed on Stellar Testnet. Creator onboarding and publication have separate dated browser evidence.
- Live release check at 13:42 SAST on 29 October 2026: Railway's API and both workers run `0aa57d9`; the Vercel admin runs `0aa57d9`; the Vercel client runs `4ec021b`. The client change only hides empty Discover sections. API readiness returns HTTP 200 with all 29 schema groups healthy. The initial draft's first-admin bootstrap blocker has since been resolved: the owner created the first production super-admin and signed in successfully.
- Computer-use check on `musiccity.pro`: three unique releases and their artwork load; the empty playlists section is hidden. A track starts, pauses, and exposes working mute and volume controls. A listen under five seconds did not count. A second test crossed five seconds and raised Isgubhu from three to four streams. That test added one counted stream to the public catalog.
- Google sign-in through Dynamic completed on `musiccity.pro` on 29 October. The signed-in listener's account page opened and showed a Testnet wallet with XLM and USDC enabled. The Marketplace reports that no track purchases are live; its separate Music City Pass offers access to three locked tracks for 15 USDC every 30 days. Public release and track pages show playback, support, and social actions, but no track purchase action. Add funds and Cash out remain disabled as expected while no provider route is enabled.
- Follow-up copy fix `13c3154` deployed to `musiccity.pro` at 13:52 SAST. Reloading the signed-in account confirmed the clearer unavailable-funding message, with both actions still disabled.
- At 13:59 SAST, Railway reported the API and both workers on successful deployment `0aa57d9`. A read-only production check found no queued, running, or failed media jobs; all existing jobs are done, with the latest update on 26 October. The financial worker's Stellar Testnet cursor was caught up with zero recorded errors: it had indexed ledger `5450302` when Horizon had closed ledger `5450305` 13 seconds later. The production database currently has no payment intents, confirmed payments, support payments, settlement batches, or claims to inspect. This verifies index freshness and current record state, but not a new upload or a hosted purchase/settlement.
- Fresh live recheck at 15:15 SAST: Railway reports the API, media worker, and financial worker Online. The API readiness endpoint returns HTTP 200 with database and schema healthy; all 29 schema groups are applied. The latest successful Railway code deployments remain `0aa57d9`; later documentation-only pushes were skipped by the configured file filters. The latest client and admin production deployments are Ready and their production aliases are attached. Vercel's deployment inspection did not expose the source commit, so the exact deployed frontend SHA still needs confirmation.
- Fresh production check at 15:35 SAST: the client and admin Vercel deployments for `f2b8445` are Ready, and Railway reports the API plus both workers Online. The API readiness endpoint returns HTTP 200 with all 29 schema groups applied. Computer use on the signed-in listener account confirmed that **Set up artist profile** from `/dashboard/releases/new` opens onboarding step 2 with **I’m an artist** selected. At a 390-pixel viewport, the page has no horizontal overflow. The account remains unchanged because Continue was not pressed.
- Local QA check after `193b883`: the default client dev API URL is `localhost:4339`, while the repository `.env` database URL targets Railway. Do not use that default pair for writes. That pass used an isolated PostgreSQL `_test` database and API on port `4349`; readiness returned HTTP 200 with all 29 schema groups applied. The client on port `4350` loaded `/onboarding?intent=artist` and correctly showed the sign-in gate. No production or existing customer records were changed. The artist-entry fix is now deployed and verified; completing production artist setup still requires an authorized production artist account.
- A first hosted recording handoff is now drafted in [SOW 2 hosted demo handoff](sow2-hosted-demo-handoff.md). It includes verified listener and admin access, recording order, Testnet labels, and the current provider limitation; artist/contributor/buyer access and the hosted financial journey remain outstanding.
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

- [x] Fetch the latest remote changes and compare them with local work. `origin/main` is at `f2b8445`, which includes the artist-entry fix `1dfad1b`, its server regression test `193b883`, and its readiness notes. The client and admin production deployments for this revision are Ready; the client aliases include `musiccity.pro`.
- [x] Review the outgoing changes and production configuration. Confirm the client, admin, API, media worker, and financial worker point to the intended services.
- [ ] Confirm the hosted Dynamic environment, Stellar network, USDC issuer, treasury, registry, and settlement contract match. Keep Sandbox identities and disposable data out of the live customer database. Label Testnet financial recordings clearly.
- [ ] Confirm access to one artist, one contributor, and one fresh buyer. Existing listener and production super-admin sign-ins are verified. The signed-in owner account still has artist access locked; the live setup CTA now works, but no production role change was made. Artist/contributor roles and a fresh buyer remain unverified. A Dynamic Sandbox identity does not authenticate to the hosted client, which uses a different Dynamic environment; use an account provisioned for the hosted environment rather than treating a Sandbox identity as production access. Prepare authorized audio and artwork. Check wallet funding, trustlines, and signer access before the financial rehearsal.
- [x] Run the release checks from [production deployment](production-deployment.md): tests, typecheck, and builds. Reuse valid results for unchanged code; rerun affected checks after fixes. Confirm current migrations against an isolated existing-data test database.

Ready when: there is one release candidate, every required role can be accessed, and the demo's network and data location are explicit. If hosted configuration prevents the financial rehearsal, resolve it here rather than switching environments during recording.

## 2. Put the current implementation on the hosted apps

Execute the rollout after the release candidate is reviewed and deployment is authorized. Follow the existing deployment guide and update its primary client URL to `https://musiccity.pro`.

- [x] Take a private production database backup before migrations. Record the backup location privately and capture baseline record counts.
- [x] Deploy the Railway API with the registered migration command. Verify readiness against the current schema manifest, including all 29 groups at this baseline.
- [x] Deploy the media worker and financial worker from the same backend revision (`0aa57d9`).
- [x] Verify financial-index freshness against Testnet Horizon. At 13:59 SAST, the production cursor was caught up, had zero errors, and was three ledgers behind Horizon.
- [x] Check existing media-job progress. Production has no queued, running, or failed jobs, and all existing jobs are done; the latest update was 26 October.
- [ ] Verify a fresh production media job through an authorized artist upload. This remains dependent on artist access and approved demo audio/artwork.
- [x] Deploy the Vercel admin and client through `f2b8445`. This includes the artist-entry fix. Earlier client releases `4ec021b` and `13c3154` added the Discover cleanup and clearer unavailable-funding message.
- [x] Verify listener sign-in on the hosted client. Google OAuth through Dynamic returned to `musiccity.pro`, the signed-in account appeared in the header, and `/account` loaded with the Testnet wallet. No account email or wallet address is included in this evidence.
- [x] Verify production admin sign-in and first-admin setup. The owner created the first production super-admin and completed normal sign-in. The hosted Admins page shows one super-admin.
- [x] Verify read-only access to Agreements, Royalties, Settlements, and reconciliation. Agreements and royalty ledger are empty; settlement reconciliation reports Reconciled with zero funded, claimed, recovered, unclaimed, and escrow USDC, no approved earnings sources, and no settlement history. Keep the admin credential out of the demo.
- [x] Restore the pre-migration backup into a disposable PostgreSQL 18 database and rehearse the migration. Existing table counts stayed unchanged; the live API now reports all 29 schema groups.
- [x] Spot-check existing releases, payments, and claims in production. Three public releases load; no production payment intents, payments, support payments, settlement batches, or claims exist to inspect. The API/migration results and deployed revisions are recorded above; previous deployments remain available for rollback.

Ready when: the hosted client, admin, API, and both workers run the intended release; current migrations pass; admin sign-in works; existing records remain available.

## 3. Rehearse the product and fix visible blockers

Use the actual hosted applications through computer use. For each row, perform the path, fix any reproduced issue, and repeat the affected path. Save a receipt or screenshot where it proves the result. Check one narrow mobile viewport and desktop; use keyboard navigation on the main forms and review screens.

| Done | User path | Pass condition |
| --- | --- | --- |
| [x] | Existing listener sign-in | Google sign-in on `musiccity.pro` returned to the app, showed the signed-in account, and loaded `/account` with its Testnet wallet. |
| [x] | Production admin access | First-admin setup completed, normal sign-in works, and the admin can open Agreements, Royalties, and Settlements. The production console has no agreements or royalty earnings; settlement reconciliation is healthy and empty. |
| [ ] | New-user onboarding and account roles | New users can finish onboarding. Back and Cancel work; saved details survive return. Verify artist and contributor access separately. The artist-entry fix `1dfad1b` is live in `f2b8445`; computer use confirmed the production listener reaches onboarding step 2 with **I’m an artist** selected, without changing the account. Finish the broader onboarding, artist activation, and contributor-access checks. |
| [ ] | Create and publish music | Enter release details, add WAV/MP3 audio and artwork, review track information, and publish. Selected tracks appear once in the same working area. Upload/processing progress is visible and updates automatically. Pending publication completes after audio is ready. The local Sandbox creator path passed with a generated WAV and artwork; see the [local upload smoke test](sow2-hosted-demo-handoff.md#local-creator-upload-smoke-test). Recent checks pass for six supported format families (MP3, WAV, FLAC, M4A, AAC, OGG), but only WAV has a full browser upload-to-playback trace; non-WAV processing remains unverified. Hosted upload and publication still need artist access and approved demo media. |
| [x] | Discover catalog | Three live releases and their artwork load once. Featured tracks appear, and the empty playlist section is hidden. |
| [x] | Playback controls | A ready track starts and pauses from its visible button. Mute and volume controls respond. A listen under five seconds did not count; a test past five seconds counted once. The longer test changed Isgubhu from three to four streams. |
| [ ] | Release playback and other pages | On 29 October, production computer use opened Delight’s artist page, the Isgubhu release, and its track details (4:39 runtime, published, 4 streams). At a 390-pixel viewport, the track page and Support amount dialog fit without horizontal overflow; the dialog was cancelled before review, so no transfer was created. The public artist directory returned eight artists although only three had public releases, including an empty `SOW2 QA Listener` profile. A local client fix now limits Discover and Artists listings to artists with published or scheduled releases; onboarding and credit-selection lists are unchanged. Focused tests and a production-shaped browser fixture passed; the fix is not deployed or live-verified yet. No multi-track release is currently available, so next-track playback remains unverified. |
| [ ] | Agreements and treasury | Create/review the intended split, collect contributor responses, and finalize with the required treasury signatures. Show the resulting agreement version and receipt. |
| [ ] | Purchase and earnings | The Marketplace reports no track purchases live, so the one-time track purchase flow has no eligible listing. Configure an authorized demo track for sale, then use a buyer who has not bought it. Complete one purchase; verify Purchased persists after reload and show the matching sale and exact beneficiary allocations without another charge. The separate Music City Pass checkout is available at 15 USDC every 30 days for three locked tracks, but has not been submitted. |
| [ ] | Admin settlement | Approve the purchase source, review allocations, reserve once, and fund with two treasury signatures. Show confirmation and the matching receipt. Current production check: Settlements shows **Reconciled**, all balances at zero, no approved/unreserved earnings sources, and no settlements; at a 390-pixel viewport the page has no horizontal overflow. The hosted screen is only an empty-state check, not a settlement demo. |
| [ ] | Both beneficiary claims | Each beneficiary claims through their own wallet. Received and wallet funds update. Reload preserves the result; admin shows Closed and reconciliation passes. |
| [ ] | Direct fan support | Complete an authorized demonstration transfer to an artist or contributor. Show sender and recipient history and the confirmed receipt. Keep support separate from royalty earnings. |
| [ ] | Cancel, refresh, and return | Cancel a review before signing, retry a failed load, and refresh during confirmation. Show the original transaction's result without duplicate payment. Loading and waiting states remain visible. |

Fix these usability issues when the rehearsal exposes them:

- [x] Replace the account page's “verified provider route” wording with plain availability copy. Continue checking other labels during the remaining hosted rehearsal.
- [x] Check the account and Marketplace at 390-pixel width. Neither page has horizontal overflow; keyboard focus reaches the Marketplace membership link and traverses the first-admin form through **Create admin** without submitting it.
- [ ] Check remaining creator, agreement, checkout, and review forms for spacing, mobile overflow, tap targets, focus, readable amounts, and one clear next action. Keep transaction details available without crowding the main flow. Local-only: the New agreement form for the synthetic QA release fit the 390-pixel viewport override with no horizontal overflow; keyboard traversal reached role, share, contributor search, optional terms, Cancel, and Save draft. The form was cancelled without saving. Hosted agreement, checkout, and review forms remain unaudited.
- [ ] Make wallet handoffs explicit: show the amount, destination, current account, and what the user must click. Prepare the review immediately before signing so it does not expire while instructions are given.
- [x] Keep Add funds/Cash out disabled without a verified route, explain their availability in plain language, and present their provider status honestly in the demo notes.

Ready when: each core row passes on the intended hosted environment, any remaining row has an explicit reason, and no known blocker interrupts the selected recording paths. A local result does not count as hosted verification. Provider buy/sell success remains a separate requirement.

## 4. Make the demo ready to record

- [ ] Rehearse these clips once, in order: artist creation/publication; agreement/admin finalization; purchase/funding/both claims; direct support and history. Aim for 3–5 minutes per clip, with transaction waits edited or shown honestly.
- [ ] Prepare fresh inputs for actions that cannot be repeated: an unpurchased recording/buyer pair, future claim deadlines, and sufficient network fees. Retain the completed receipts for the results portion. Prepare each expiring signature review only when the signer is ready.
- [ ] Leave the exact application tabs open in recording order. Supply one-line click instructions for each wallet handoff. Hide credentials, OTP setup screens, unrelated test fixtures, and private signer files from the recording.
- [ ] Complete the [hosted demo handoff](sow2-hosted-demo-handoff.md) after the owner sets up admin access and the artist, buyer, contributor, and treasury signer accounts are verified. Clearly distinguish hosted production behavior, Testnet receipts, and the earlier local evidence.
- [ ] Package the deployed revision, contract IDs/network, passing checks, transaction receipts, screenshots, and final reconciliation. Update the canonical SOW tracker only for demonstrated results.
- [ ] Provide the owner a short recording handoff in this chat with ready links, clip order, and remaining provider limitations. Record reviewer acceptance when the reviewer supplies it; it does not block preparing the demos.

## Keep provider work separate from the recording deadline

The five open provider checklist items remain tracked in the existing implementation plan. MoonPay needs a successful account-specific sandbox journey and supported asset route. MoneyGram needs the non-custodial Stellar partner mode. After a route works, finish its authenticated launch, populated browser flow, provider-specific refunds, and any required conversion verification. Do not enable a route based only on valid credentials or show a simulated provider result as a completed transfer.

## Stop condition for this release pass

The selected demo paths work on the intended hosted release, production admin access works, workers advance real jobs, migrations and reconciliation pass, the owner has recording-ready tabs and instructions, and known provider limitations are disclosed. Any remaining implementation failure stays unchecked. Production verification and reviewer acceptance remain separate claims.
