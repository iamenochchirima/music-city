# Contributor controlled agreement verification

31 October 2026. The new registry and settlement pair are deployed on Stellar Testnet. The local rehearsal uses `music_city_contributor_rehearsal_test`; the original `music_city_mint_demo_20261030_test` database is preserved. No production deployment or external SOW/report edit was made.

## Verified through the application services and real Testnet

A generated-key fixture completed the new agreement flow, a 3 USDC track purchase, treasury funding and both beneficiary claims. These were real Stellar Testnet transactions, not mocked receipts. They do not establish Dynamic or Firefox browser signing.

| Step | Result and receipt |
| --- | --- |
| Owner approval | [Confirmed](https://stellar.expert/explorer/testnet/tx/fd256bd308c1f4d0db8441b24c6db2e45d92ba2f13fcfb438bd4fc80f40684b1). Incomplete consent still blocked purchase. |
| Contributor approval and finalization | [Confirmed](https://stellar.expert/explorer/testnet/tx/1f0d5bf91c1c9afc9286dd03cd5402a9d58038f43ef9d4328309b66b8008962c), with no treasury signature. |
| Purchase | [3 Testnet USDC](https://stellar.expert/explorer/testnet/tx/991a0a8ce5eb44895885fb12e953a66558648e5029ee7cfceee54b2393653222), producing 2.1 and 0.9 USDC net allocations at the unchanged 0% fee. Exact retry retained one payment and its allocations. |
| Treasury funding | [Two independent signatures](https://stellar.expert/explorer/testnet/tx/73662bcbe3d1c710d73d8f659f7620c9c1f167cd2c9701e6b9cfcf696dcd720a). Submission with one signature was rejected by the application. |
| Artist claim | [2.1 USDC](https://stellar.expert/explorer/testnet/tx/3d1a4b0c30004f38510b114eb27cca99efcd07ed17e52342be6a186661e4299e), authorized only by the beneficiary. |
| Producer claim | [0.9 USDC](https://stellar.expert/explorer/testnet/tx/c3f4bc9e11be3b0c50e0a8725a1ea2a1bab26b1f612602fb373442cad5f1cfc5), authorized only by the beneficiary. |
| Reconciliation | 3 USDC funded, 3 claimed, zero outstanding, zero escrow balance, zero discrepancies. Network fees are recorded separately in XLM. |
| Rejection and dispute | Separate proposed versions 2 and 3 were blocked on-chain. |
| Amendment | [Version 4 finalized](https://stellar.expert/explorer/testnet/tx/cd6b002b5b14932b816460a8c32a05030b0db9d632ef619b35dd495a527a979d) only after the removed beneficiary gave fresh consent. Version 1 and its closed payout remained unchanged. |

The [machine-readable record](testnet-service-verification.json) includes contract IDs, deployment hashes, allocation details and reconciliation output. Fixture keys and resumable signing state remain outside the repository.

## Authorization and registration model

`contributor-registry` uses native Soroban authorization for each exact proposal/decision. The last required approval finalizes automatically. Existing rights holders remain required approvers for amendments, including when removed from the new recipients.

A separate registrar binds track ownership once. It cannot overwrite an owner or approve a split. Automatic registration is restricted to non-production Stellar Testnet and trusts the authenticated application's track-owner mapping. This is not a trustless proof of off-chain music ownership. The default application publication mode remains the existing treasury scheme; the rehearsal explicitly selects `AGREEMENT_PUBLICATION_MODE=contributors`.

The existing settlement contract code and two-signature treasury gate remain in use. It is redeployed only because its registry address is immutable. Direct support remains a separate payment to one selected person. Fees remain captured at earnings creation and are not deducted again on collection.

## Automated verification

- All 19 contract tests passed, including the eight new registry cases and the existing treasury, funding, claim, expiry and replay protections. WASM builds passed.
- New exact-envelope tests passed for payload encoding, authorized signer and rejection of altered action, wallet, contract and network.
- Real PostgreSQL verification passed for contributor receipt persistence, concurrent retry, finalization without treasury evidence, retained historical versions, and removed-holder membership after editing an amendment.
- Existing agreement/finalization, checkout and settlement PostgreSQL suites passed: 26, 8 and 15 tests respectively, with no skips in those runs. Chain transport is mocked in these database suites.
- The broad server run passed 248 tests with 14 database-dependent skips before the new suites were added. The separate database runs above cover the relevant skipped flows.
- Focused creator, wallet and admin checks cover signed cancellation, publication receipts, automatic-finalization messaging and removal of treasury-finalization controls. The final client run passed all 270 tests across 58 files with two workers. The admin suite passed all 23 existing tests; its updated agreement file passed all 9 cases, including the new contributor-only view. Workspace typechecks and all production builds passed. The existing client bundle-size warning remains.

## Interactive verification still required

The signed-in creator page is prepared at [the fresh 70/30 agreement](http://localhost:3000/account/agreements/4878484d-6856-483f-bbc7-dd1ea922abf3). Its original approvals were not copied from the preserved database. Ngoni signed first, followed by Enock. Both approvals were new on-chain authorizations from the actual account holders.

Ngoni completed the real Dynamic owner approval in the Codex in-app browser. The UI shows Accepted and the [Testnet transaction](https://stellar.expert/explorer/testnet/tx/a898492db5318e1c26283f65b2410f9b1090194e80c16efb2322899f1da3924f) independently returned SUCCESS at ledger 5487244. Enock then completed the [second approval](https://stellar.expert/explorer/testnet/tx/9015c6c1b58da4b919237843031d87a300fe4070f649b06ef8f66a4cfbf23cde), independently confirmed SUCCESS at ledger 5487391. The agreement finalized automatically with two contributor receipts and no treasury signature. The application’s effective-split verifier returned version 1 with 7000/3000 basis points, and the track retains buying enabled at 3 USDC. This does not establish Firefox Google return or cancellation.

The real listener then [purchased the song for 3 USDC](https://stellar.expert/explorer/testnet/tx/01ae9174defebd033d0a9a89b120cfb1ad357485a7a3e5b1414a7783752816eb), confirmed at ledger 5487689. The application captured 2.1 USDC for Ngoni and 0.9 USDC for Enock with zero platform fee. [Funding confirmed](https://stellar.expert/explorer/testnet/tx/316509fb279ad1486aafe03c20a6c5a6dc7d060a855727a80cef7f003b34539a) at ledger 5487720 with two distinct local Testnet treasury signatures supplied through the application services. Both allocations are available for their beneficiaries to collect. This funding was not performed through the admin browser. The batch expires on 1 November 2026 at 17:57:06 SAST.

Pending checks are both real beneficiary claims, final reconciliation, Firefox Google return and cancellation, and the admin browser rehearsal. Generated fixture signatures and passing unit tests must not be reported as proof that these browser checks passed.

## Recording order

1. Open the account wallet. Show Stellar Testnet, the USDC trustline and active creator access. Show that direct support is a separate person-to-person payment and open its history.
2. Open the fresh agreement linked above. Ngoni reviews 70%, Enock reviews 30%. Each signs with their own Dynamic wallet. Show that the last approval finalizes it and produces the chain receipt, with no treasury-finalization action.
3. In the release editor, show the saved 3 USDC sale setting. Open the song as a different buyer, review and buy once. Show the purchase receipt and entitlement. Do not use artist support to demonstrate a song revenue split.
4. Open admin earnings and show the purchase's captured 70/30 allocation and configured 0% fee. Prepare funding, show that one treasury signature is insufficient, then supply the second signature and show confirmed funding.
5. Open each contributor's Revenue page. Collect 2.1 and 0.9 USDC independently. Show each receipt and refresh to show the retained received state.
6. Show admin reconciliation with 3 USDC funded, 3 claimed, zero outstanding and no discrepancies. Explain that XLM network fees are separate from USDC royalty accounting.
7. Show the prepared generated-key rejection, dispute and version-4 amendment examples using the receipts in this record. Label these as Testnet service verification. The removed contributor's fresh approval was required; the earlier payout remains unchanged.
8. For expired-fund recovery, reuse the [historical recovery capture](../settlement-evidence/admin-recovery-confirmed.png), [two-signature capture](../settlement-evidence/admin-recovery-two-signatures.png) and [historical reconciliation record](../settlement-evidence/stellar-testnet.json). Label them as the earlier settlement demonstration, not a transaction against the new registry. Current contract and application tests cover expiry and recovery protections; this pass does not claim a new live recovery transaction.

Step 2 has confirmed real contributor receipts. Steps 3–6 still require the real-wallet browser rehearsal. The successful generated-key service run supplies independent financial evidence, but does not replace those steps. Do not record these instructions as a claim that the pending interactions passed.

## Run and recovery

Local app: `http://localhost:3000`. Admin: `http://localhost:4318`. API: `http://localhost:4319`. Media/notification and financial workers run against the fresh rehearsal database; email delivery uses the local sink.

The copied accounts retain their existing sponsorship activation grants and the referenced eligibility records; no old payment or royalty records were imported. Browser smoke checks confirmed Ngoni’s active creator access, funded Stellar wallet with its USDC trustline, and the empty fresh support history. A new support payment was not made through the real wallet.

Private configuration, database dump and restored-copy proof are retained under `/home/enoch/.codex/backups/music-city/contributor-implementation-20261031T125044Z`. The original database had no settlement batches or pending financial/finalization attempts at the preservation check. Existing contributor and editor code was preserved; affected files include additive integration changes.

To restore the original runtime, stop the rehearsal API and workers, restore the saved local configuration and original database URL, and start the original services. Do not reinterpret or copy the new rehearsal payments into the original database. Keep the rehearsal database and contract configuration available for any new outstanding claims.

Repeat the service verification with `server/src/scripts/verify-contributor-testnet.ts`, the rehearsal environment and its existing private state paths. Deployment and transaction scripts retain original transaction hashes for resumption; use the same state after an unknown outcome. Use disposable `_test` databases for database suites, never either preserved or rehearsal data.

## Scope alignment

The original SOW explicitly requested treasury-authorized agreement finalization. This local contributor-controlled implementation changes that requirement. Reviewer alignment remains necessary before claiming acceptance or deploying this model to production.

## Multiple-source payout runs, 31 October 2026

Admins can now select up to ten approved, unreserved earnings sources across songs in [Earnings settlements](http://localhost:4318/console/settlements). Review the exact combined net total, contributor totals, source amounts, captured agreement versions, fees and common claim deadline, then reserve the run. Prepare its funding transaction once, download it and collect two independent treasury signatures. Submission atomically funds all included sources. A failed source rolls back the entire transaction. The backend simulates the complete run before reserving sources so execution limits and treasury readiness are checked first.

The new immutable `payout-run` contract forwards the authorized sources to the existing settlement contract. The existing registry, escrow, balances, source-consumption guards and beneficiary claims are retained. There is no arbitrary pool deposit, contributor-consent bypass or production migration. Each source keeps its own entitlement and history; this change combines treasury funding rather than merging beneficiary claims.

A [new Testnet verification record](payout-run-testnet.json) proves two synthetic earnings sources, with different agreement versions and fee rates, funded through [one transaction](https://stellar.expert/explorer/testnet/tx/80040988ff0e4e8ae663c6a64caa26febc8850674d8078d96276cc64d90bc1f4) at ledger 5489489. The gross total was 0.02 USDC; funding was exactly 0.0195 USDC and the 0.0005 fee remained in treasury. One treasury signature was insufficient. Exact preparation retry retained the same attempt. All three beneficiary claims then confirmed with only their respective beneficiary signatures. Both new source batches closed. Global reconciliation showed 6.0195 USDC funded and claimed, zero outstanding, zero escrow balance and no discrepancies. These generated-key synthetic earnings are separate from the real listener purchase.

Validation passed: all 22 Rust tests, the WASM release build, 16 real PostgreSQL settlement checks without skips, all 25 admin tests, 251 server tests with 15 opt-in skips, server/admin typechecks and the workspace build. The changed PostgreSQL suite separately covers reservations, overlap/retries, authorization, all-source receipt matching and transaction rollback. Admin tests cover selection, combined recipient totals and exact reviewed-run reservation. No new live admin-browser capture is claimed. The existing client bundle-size warning remains.

Local deployment uses `PAYOUT_RUN_CONTRACT_ID=CDL5HB6OKACWCPKBSB5AJK2H4V3OTQWQVZPYO5VAVTVSLVKLFDZF3MLT`. Private resumable deployment and fixture state remain outside the repository. The API and financial worker use the same configuration. The default example leaves this contract unset until an operator deploys it for that environment.

## Prefunded pool, 1 November 2026

The user requested a pool without admin approval for every purchase. The local rehearsal now uses `EARNINGS_MODE=pool`, with the additive contract `CCVTCNVTZJKHDYGXTAJZ6TM2PZA46I5OHN4ZAYKWN43OGWOMM4V6Q3SQ`. The registry and earlier escrow remain unchanged. Existing pending or completed classic checkouts and settlement payouts retain their original paths and receipts. This supersedes payout runs for new song purchases; it does not migrate historical obligations or deploy to production.

A new purchase invokes `buy` with the buyer's native Stellar authorization. Payment, captured royalty allocations and earning registration succeed atomically. Gross USDC enters the pool, the fixed platform fee is transferred to treasury, and contributor net entitlements are recorded on-chain immediately. No treasury signer, registrar or admin approves or registers each purchase. These purchases never enter the old manual royalty approval queue. Off-chain catalog prices and music-access entitlements remain checked by the application against the exact prepared checkout and successful receipt. A direct contract call cannot grant music access, and every on-chain earning must be backed by an actual token payment.

Admins can top up any chosen positive amount through two independent treasury signatures. A top-up creates liquidity, not earnings. Purchase proceeds also replenish the pool, so paid purchases create fully backed liabilities even when no spare buffer exists. Contributors claim their own net amounts without an admin signature. Pool claims do not expire. Treasury can return unused liquidity only up to the on-chain balance minus all outstanding contributor liabilities, with two signatures. No reserved contributor funds can be returned. Pool fee policy is immutable and must match configured purchase fees; mismatches block new purchases rather than silently changing terms.

[The new Testnet record](prefunded-pool-testnet.json) contains a complete generated-key service journey:

- [1 USDC top-up](https://stellar.expert/explorer/testnet/tx/227feec5a85000ec9b994a92488c0c2098fabff5f8def167746b06a36ba840f5) confirmed before any pool purchase. Outstanding earnings remained zero.
- [3 USDC purchase](https://stellar.expert/explorer/testnet/tx/dbeaf0575ce51ad8a2327cbaf18ae386b9e24ee4f53a3ab4bd9e0824a08e309f) created the entitlement and claimable earnings with only the buyer's signature. The fixture used its finalized version 4 with one recipient and the unchanged 0% fee. Zero manual royalty-approval entries were created.
- [Beneficiary claim](https://stellar.expert/explorer/testnet/tx/602988454fb2e7c4a81b6aef52ff2d95e4227af6ec3a9167280c0573ec53c87e) collected 3 USDC with only that beneficiary's signature.
- [Return of unused liquidity](https://stellar.expert/explorer/testnet/tx/5c15ab964a23ab6877f2fa33a0b45a3c1a6a01cc13ee519f4b646b03ea216c38) returned the original 1 USDC buffer through two treasury signatures. Final pool balance, outstanding obligations and unexplained differences were all zero. Exact checkout retry retained one purchase.

The pool's five Rust tests also cover a 70/30 split and nonzero fee, insufficient-payment rollback, changed or stale orders, missing authorization, duplicate claims and attempts to return reserved funds. Real PostgreSQL tests cover durable uncertain submissions, signature requirements, concurrent preparation, wrong-wallet rejection and immutable signing/claim evidence. Existing checkout and settlement PostgreSQL suites pass separately against fresh disposable databases. Component checks cover wallet claims, explicit trustline errors, receipt states, arbitrary top-up amounts and the two-signature admin gate.

The financial worker indexes verified successful pool events and reconciles original transaction hashes. RPC history gaps, stale indexing, unmatched totals or expired submissions with unknown outcomes cannot be reported as reconciled. Persistent contract records extend their ledger lifetime when used. Archived records require Stellar footprint restoration before further operations; the application fails closed instead of treating missing state as a new entitlement. No production archive/backfill system or new restoration UI is claimed in this local pass.

Recording order is now: show a pool top-up and its two signatures, buy a song as a new listener, show automatic earnings with no admin approval action, claim as the beneficiary, then show pool obligations and reconciliation. Earlier settlement examples remain labelled historical. Private deployment/fixture keys and resumable envelopes are stored outside the repository. The default example configuration retains settlement mode; only the isolated local rehearsal enables this pool.

After the completed pool verification, a [separate two-signature top-up](https://stellar.expert/explorer/testnet/tx/fac2f7d34661b968a04f19e8763e301db7cf552dbd0f6a16185a43ff64bfebc7) left 1 Testnet USDC of unused rehearsal liquidity in the pool, with zero outstanding obligations and reconciled totals. The earlier test's return of its buffer remains recorded separately.

Final checks for this follow-up: 27 contract tests, 274 client tests, 27 admin tests, and 253 server tests passed. The default server run skipped 16 opt-in suites. Separate disposable PostgreSQL runs passed the new pool test, eight checkout checks and sixteen settlement checks without skips. Workspace builds and typechecks passed; the existing client bundle-size warning remains. No new live browser capture or personal-account signature is claimed.

## Two-admin signing rehearsal

Two separate local super-admin accounts, Treasury Admin A and Treasury Admin B, are prepared for the requested signing demonstration. Each is assigned a different existing Testnet treasury signer for this rehearsal. `prepare-two-admin-pool-demo.ts` verifies both official admin logins, prepares one 0.1 USDC pool top-up through Admin A's authenticated API session, and generates one partial signed XDR for each signer outside the repository. Both admin sessions can see the same attempt. The prepared app transaction starts with zero uploaded signatures. It has not been submitted.

Sign in as Admin A, upload `admin-a-signed.xdr` and add its verified signature. The app shows 1/2 and leaves submission disabled. Sign out, sign in as Admin B, upload `admin-b-signed.xdr` and add its verified signature. The app shows 2/2 and enables submission. The signature list records the authenticated uploader's admin name and signer wallet in append-only audit records. These are offline Testnet wallet signatures uploaded by two separate app accounts, not a demonstration of two hardware-wallet popups. The cryptographic threshold is still based on distinct treasury keys; creating or switching admin accounts alone does not supply a wallet signature.

Local credentials, partial XDRs and resumable state are under `/home/enoch/.codex/backups/music-city/two-admin-pool-demo`, outside the repository. Files bind to one exact transaction and its signing deadline. Rerun the preparation script with the same private state after an unsubmitted transaction has expired; do not reset an unknown submitted outcome. The existing admin accounts and original treasury keys were retained.

Verification passed for the two-account UI handoff and file upload, the disabled/enabled submission threshold, server-side admin attribution and immutable PostgreSQL audit records. The focused admin settlement suite passed ten cases; server and admin typechecks passed. No actual two-user browser upload or submitted demo top-up is claimed yet.

## Connected admin wallet signing, 1 November 2026

The offline two-admin file rehearsal above is superseded. The pool admin screen now links a wallet through a fresh signed ownership challenge and offers **Sign with connected wallet** instead of file download/upload or pasted XDR controls.

Admin authentication remains separate from wallet authentication. The wallet window runs on the existing wallet-enabled client origin. An authenticated super admin creates a short-lived request; the child receives only a random capability, never the admin JWT or password. The child displays the admin identity, connected wallet account, network and action before asking for a wallet signature. Ownership challenges bind the admin, origin, wallet, network, expiry and random nonce. They use a non-broadcast proof transaction and are not submitted to Stellar. The signing page stores its request capability only in per-tab session storage to survive provider redirects. Signing responses are relayed through the server, so successful Google authentication does not depend on the popup opener surviving navigation. The authenticated parent must confirm before a link or treasury signature is committed.

A linked wallet must be a current treasury signer. One wallet can be linked to only one admin, and a completed link cannot be silently replaced with a password-only request. Every pool admin signature endpoint checks that the exact prepared transaction has exactly one signature from that admin's linked wallet, still in the current signer set. Combined or foreign-wallet envelopes are rejected. Expired, cancelled and cross-admin challenges cannot be used. Admin account changes or leaving the page cancel the pending request. Native treasury authorization still requires two distinct wallets, with existing append-only signature attribution.

The isolated Testnet treasury now has the two previously proven personal wallets, Ngoni `GB3XS62ZJ7EVX2ZSMUJ2BWYXOXBOL6OCDY7J2F5QOOFWWLYWSEB6TV6U` and Enock `GCZS3HHJGOFZRSKOO4K6WO5PFQEBW7XP3QTTA53A6IITRCORN2ZS4APA`, plus the retained recovery/master signer. All weights remain one and every threshold remains two. The [authorized configuration transaction](https://stellar.expert/explorer/testnet/tx/69caeffa5f7c523a6ee165d63cfc3ef1760af9c6774609babd89557e95070889) confirmed at ledger 5501377. The old two generated non-master demo signers were removed. Old offline signing files and helper output must not be used for the new flow. No production signer configuration changed.

Rehearsal: sign in as `iamenochchirima@gmail.com`, open Earnings settlements, choose **Connect and link wallet**, and use Ngoni's wallet in the wallet window. Repeat as `chirimaenoch@gmail.com` using Enock's wallet. Prepare a fresh 0.1 USDC top-up. Admin A signs with its connected wallet, leaving 1/2 signatures. Admin B signs the same prepared transaction with its own connected wallet, reaching 2/2. Submit from admin and verify the confirmed pool top-up. The existing local demo passwords remain unchanged.

[Verification metadata](connected-admin-wallets.json) distinguishes tested server/component behavior and the confirmed native treasury configuration from the real-wallet prompts still requiring the account holders. Disposable PostgreSQL cases cover ownership proof, uniqueness, immutable identity, wrong-wallet and combined-envelope rejection, cancellation, expiry, cross-admin isolation and two-account attribution. The admin, client and server suites passed; the default server suite skipped 17 opt-in cases and the relevant PostgreSQL cases were run separately. Workspace typechecks and builds passed. No completed personal Dynamic ownership link or connected-wallet treasury signature is claimed yet.

The signing page additionally preserves an explicitly requested action across a full Google redirect. It resumes only for the same wallet after the SDK verifies the required signing scope. Incomplete authentication or cancellation clears the pending action instead of automatically reopening authorization. The updated signing-page suite passed five cases. The actual local API verified both demo logins, a scoped request, cross-admin denial and cancellation with all 35 schema groups ready. Fresh personal ownership proofs and connected-wallet treasury signatures still require the account holders' wallet prompts.

## Independent admin wallet sign-in, 1 November 2026

This replaces the cross-app wallet window described above. The admin site now owns its Dynamic provider and wallet session. Open `/console/settlements`, then **Your treasury wallet → Sign in to wallet**. Google returns to that admin route on the current origin. Once connected, click **Prove ownership and link wallet**, then use **Sign with connected wallet** for a prepared pool transaction. Authentication across a full redirect requires clicking link/sign again; it does not automatically sign after returning. No main-app login, popup relay or file upload is used by these controls. Admin credentials still establish the admin role; the connected wallet proves signer ownership. Switching admin identities disconnects the previous wallet.

The existing server ownership challenges, unique immutable wallet links, canonical transaction verification and native two-wallet treasury threshold are unchanged. The admin cancels pending requests on account changes and rejects changed-wallet or changed-network responses. Wallet authorization verifies the signing scope even after the provider prompt resolves.

Verification: 46 admin tests passed, including native wallet connection, canonical signing, wrong-wallet rejection, cancelled authentication, account changes during signing, network mismatches, authorization readiness and same-origin Google return. Admin typecheck and production build passed, with a large SDK bundle warning. In the live admin browser, both the Settlements controls and an explicit wallet-loading error were verified. Dynamic settings initialization failed with `Failed to fetch`; a direct provider request separately returned HTTP 403 for both admin and main-app origins. This does not establish an origin-specific cause. No live Google completion, personal ownership link or new connected-wallet treasury signature is claimed.

### Admin wallet origin diagnosis

A follow-up differential request using curl resolves the initialization cause: the same Dynamic SDK settings endpoint returns HTTP 200 for both origins, but sends `Access-Control-Allow-Origin: http://localhost:3000` only for the main app. No allowed-origin header is returned for `http://localhost:4318`, so browsers block admin initialization. The earlier Python HTTP 403 does not establish a provider outage. Add exactly `http://localhost:4318` to **Security → Allowed CORS Origin** in the Dynamic environment corresponding to the configured public environment ID, preserving existing origins. No path or wildcard is needed. Refresh admin afterwards and repeat the real-wallet ownership/signing rehearsal. No Dynamic administrative API credential is available in the isolated rehearsal environment, and no provider setting was changed.

### Admin origin added

Following the user's explicit instruction and Dynamic console login, `http://localhost:4318` was added to the matching MusicCity Sandbox CORS list. The existing three origins were retained. The saved origin row was visibly verified, and a fresh SDK settings request returned HTTP 200 with `Access-Control-Allow-Origin: http://localhost:4318`. Refreshing admin is required before retrying wallet sign-in. This verifies the origin fix, not personal wallet authentication or treasury signing.

### Demo treasury funded, 1 November 2026

At the user's request, exactly 10 Testnet USDC was transferred from the existing generated verification buyer wallet into the treasury, bringing its USDC balance from 0.5005 to 10.5005. The donor's original 20 test USDC acquisition was verified on-chain as a strict-receive exchange from test XLM into the same USDC issuer. The donor had 9.48 USDC remaining; an atomic transaction acquired the missing 0.52 test USDC with test XLM and paid 10 USDC into treasury. The transfer confirmed at ledger 5503116, transaction `3a6796639247aa9d2e623053801ab70c166aab82f35c04f9d6d43e173449ab34`. Receipt operations and the resulting treasury balance were verified. No pool funds or contributor earnings were used. No outgoing treasury/pool signature was generated or submitted; both personal admin signatures remain for the user's demo. [Public funding evidence](demo-treasury-topup.json).
