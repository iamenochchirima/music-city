# Contributor controlled agreements and payout implementation plan

Updated 31 October 2026. Status: implemented with passing Testnet service verification; Dynamic/Firefox interactive verification remains pending. See [verification evidence](contributor-controlled-agreements-evidence/README.md).

Deliver one working local Stellar Testnet journey: contributors finalize their agreement without admin approval, a fan buys the song, treasury signers fund the earnings, and each contributor collects independently. Finish when this journey and the essential negative cases below pass. Do not expand this into a production migration or a general platform redesign.

## What changes

| Action | Required authorization |
| --- | --- |
| Propose a split | The registered track owner. |
| Finalize an agreement | Every required contributor, including the owner. The last required approval finalizes it on-chain. |
| Amend a split | The owner, existing rights holders and proposed recipients approve the replacement. Existing terms remain effective until then. |
| Fund earnings | Two independent treasury signers approve the exact settlement transaction. |
| Collect a funded share | The beneficiary signs once; no admin signature. |
| Direct support | The fan pays the selected person directly; royalty shares do not apply. |

Track pricing, song-page buying, platform fee accounting, support and beneficiary claims already exist. Adapt their agreement verification and reuse their existing behavior. Keep the configured fee percentage unchanged; the inspected local configuration was 0%.

The [current SOW](https://docs.google.com/document/d/1Nk0WR6laCp2meQT_VANp3oYFr9YkuZyVKe5ziuPWFoc/edit) explicitly includes treasury authorization for agreement finalization. Record this change for reviewer alignment before submission or production rollout. That does not block authorized local implementation or rehearsal.

## Boundaries for this pass

Use a fresh isolated rehearsal database and new Testnet contracts. Copy only the creator/catalog data needed for the demonstration, preserving its ownership relationships and existing sponsorship activation access. Create new agreement approvals, purchases and settlements. Do not copy old financial obligations into the new flow or relabel old approvals as new contract authorization.

Retain the existing database, contracts, configuration and receipts. Check for pending submissions and outstanding claims before changing the active runtime. If obligations exist, keep their original runtime available at separate local addresses until resolved; the new demo must not make them inaccessible. A backup alone is not continued claim access.

Defer production deployment, general multi-contract routing and combined dashboards, historical earnings migration, ownership transfer/account recovery, subscription redesign, new fee administration, notification expansion and song-level support splitting. Do not add these as prerequisites for the local demo.

## 1 Protect the existing work and prove signing

- [x] Back up the current working tree, ignored runtime configuration and local database. Preserve the imported Mint commits, contributor-editor work, wallet fix and existing receipt history. Verify the database backup restores into a disposable database.
- [x] Check pending financial attempts and outstanding obligations. Preserve the old contract/database/runtime access where needed; prepare a separate rehearsal database with no imported payments, earnings, claims or pending envelopes.
- [ ] Prove that the real Dynamic Stellar wallet can authorize the proposed registry call on Testnet, including Firefox Google reauthentication. Do this before building the complete flow. Do not bypass authorization if the wallet cannot sign it.

Done when: existing work is recoverable, old obligations remain accessible, and one real wallet can authorize the new contract transaction.

## 2 Replace treasury finalization with contributor consent

The registry currently checks treasury authorization and relies on the backend for contributor consent. Removing that check alone is unsafe. The replacement must enforce contributor consent itself.

- [x] Bind each demo track ID to its legitimate owner once through authenticated platform registration. Reject duplicate registration and owner replacement. Use that stored identity for owner authorization; an arbitrary caller cannot claim an existing track by knowing its ID. Document the registration authority's trust assumption; no per-agreement admin approval.
- [x] Implement immutable proposals with exact track/agreement/version, predecessor, recipients, roles and terms hash. Use native Soroban authorization for the owner and each required contributor. Preserve recipient limits, unique wallets, positive shares and a total of 100%.
- [x] Record contributor approvals on-chain. The last required approval atomically finalizes the version. Reject wrong-wallet, wrong-version and changed-payload authorizations; exact retries must not create a second result.
- [x] Enforce rejection, dispute and cancellation of pending proposals on-chain. Final approval racing cancellation follows ledger order. Keep the existing distinction between pending proposals and immutable finalized history; do not invent reversal of already earned or funded money.
- [x] Require the owner and the union of existing rights holders and proposed recipients for amendments. Bind the replacement to the current effective version, keep earlier versions immutable, and reject stale competing amendments. Removing someone must not remove their approval requirement.
- [x] Add the events and bounded storage/lifetime handling needed to confirm proposals, decisions and finalization. Keep treasury authorization on settlement funding and expired-fund recovery; add no privileged consent bypass.

Done when: contract tests demonstrate automatic finalization with valid approvals and reject incomplete consent, unauthorized calls, stale versions and blocked proposals.

## 3 Connect the existing app to the new registry

- [x] Adapt agreement preparation, wallet signing, durable submission and reconciliation for the new contract calls. Store the exact envelope/hash before sending and reconcile uncertain outcomes instead of blindly signing again.
- [x] Update effective-split verification to require matching confirmed contract state and receipt. Keep the checkout guard; do not replace it with a database-only approved flag. Pending legacy agreements need fresh approval in the rehearsal environment.
- [x] Update creator status and admin views: contributors see confirmation followed by finalized status; admin sees agreement evidence without a routine finalize/signature step. Preserve useful existing rejection, dispute and amendment controls.
- [ ] Check the shared wallet recovery with the new signing calls. Google completion resumes the original request once; cancellation, account changes, navigation and failed authorization cannot submit consent for the wrong request.
- [x] Fix the purchase-readiness explanation and the release editor's hardcoded sales-unavailable wording. Reuse per-track enable/price controls and the song-page Buy button. Keep public buying flags outside the rehearsal unchanged.

Done when: both contributors can approve through the real UI, the agreement confirms without treasury signatures, and the song becomes eligible for purchase.

## 4 Deploy the rehearsal pair and complete one financial journey

The current settlement contract pins its registry address and has no upgrade entry point. Deploy a new registry and compatible settlement contract for new rehearsal records. Reuse the settlement logic and change only what the registry integration requires.

- [x] Deploy the new Testnet pair and verify contract IDs, network, supported USDC asset and treasury configuration. Point only the separate rehearsal runtime at it. Preserve a runnable configuration for the original environment.
- [x] Inspect queued work before starting reconciliation against the rehearsal database. Ensure no old source or envelope can be processed by the new runtime. Do not build a general historical migration system.
- [x] Use a different buyer account to purchase the demo track at its saved price. Retain the exact effective agreement and fee terms captured for that purchase, even if an amendment finalizes later. Verify one payment, entitlement and set of earnings after retry.
- [x] Fund the earnings with two independent treasury signatures. Confirm one signature is insufficient. Have each beneficiary collect once with their own wallet, without an admin signature. Check receipts and final admin totals.
- [x] Verify captured fee accounting in focused tests, including a nonzero-fee fixture: gross equals contributor net plus platform fee, the fee stays in the receiving treasury, and collection does not deduct it again. Do not change the demo's fee rate.

Done when: a fresh purchase, funding transaction, both claims and reconciliation match their expected amounts. For a 3 USDC purchase with 70/30 shares and a 0% fee, expected claims are 2.1 and 0.9 USDC, separately from XLM network fees.

## Essential verification

| Check | Pass condition |
| --- | --- |
| Ownership and exact consent | An outsider cannot overwrite ownership or publish a split. Missing approvals and wrong wallet/version/payload/network authorizations fail. |
| Dispute and amendment | Rejection/dispute/cancellation blocks the pending version. Removed rights holders must approve amendments. Old finalized terms and earned amounts remain intact. |
| Wallet continuation | Firefox Google authentication resumes the original signing request once. Cancellation or navigation does not create consent. |
| Purchase and fees | A pending agreement blocks purchase; a confirmed one allows it. Exact price, asset and captured split/fee terms match. A retry does not create another charge or allocation. |
| Treasury and claims | One treasury signer cannot fund; two can. Each beneficiary collects independently. Wrong-wallet, duplicate and expired collection fails. Existing expiry/reclaim protections remain. |
| History and reconciliation | Refresh retains confirmed statuses and receipts. Funded, claimed, recovered and outstanding amounts balance with no unexplained difference. Old obligations remain accessible separately. |

- [x] Run contract authorization tests/build, shared-package build, workspace typecheck and focused agreement, checkout, wallet, settlement and admin tests. Run the workspace test suite once after focused checks pass. Do not repeat broad suites without a new failure or change.
- [x] Run the changed agreement/checkout/settlement PostgreSQL cases against disposable loopback databases ending in `_test`, never the preserved database or rehearsal database. Record skipped tests accurately; mocks do not replace live wallet evidence.
- [ ] Complete the real-wallet journey above, plus prepared rejection/dispute and amendment examples. Smoke-check existing direct support/history and wallet readiness for the recording; do not redesign them. Test expiry boundaries in focused tests and reuse a prepared recovery example.
- [x] Save one concise, redacted verification record with commit, environment, contract IDs, test results, transaction receipts and expected/actual totals. Update the changed-flow documentation and recording steps only. Keep historical evidence labelled as historical.

## Stop condition

Stop implementation when the essential checks pass and the local recording journey works. Remaining unrelated cleanup goes into later work, not another implementation phase.

The video should show contributor approvals and automatic finalization, a track purchase, two-signature treasury funding, independent contributor collection, and creator/admin history and reconciliation. Include the prepared dispute/amendment, readiness, support and recovery examples without repeating the full setup. MoonPay transactions and production rollout are outside this pass.

## Main code references

- [Registry](../contracts/royalty-split-registry/src/lib.rs) and [settlement contract](../contracts/earnings-settlement/src/lib.rs).
- [Agreement signing](../server/src/modules/agreements/agreement-domain.ts), [finalization](../server/src/modules/agreements/finalization.service.ts) and [effective split verification](../server/src/modules/agreements/effective-split.ts).
- [Purchases](../server/src/modules/payments/payments.service.ts), [fee accounting](../server/src/modules/royalties/royalties.service.ts) and [wallet authorization](../client/src/features/wallet/lib/use-stellar-authorization.ts).

## Follow-up: payout run funding

On 31 October the user expanded the local scope to combine multiple earnings sources in one treasury approval. This follow-up is implemented through an additive payout-run contract and admin multi-selection, without replacing the existing registry or escrow. Exact source terms and independent beneficiary claims remain intact. See the [payout-run evidence](contributor-controlled-agreements-evidence/payout-run-testnet.json) and the updated recording guidance in the verification README. The earlier single-source funding demo remains historical evidence of the same escrow rules.

## Follow-up: prefunded pool

On 1 November the user replaced per-run funding for new song purchases with a prefunded pool, explicitly requiring no per-purchase admin registration. The local implementation now atomically pays and registers each purchase through the buyer's native authorization. Treasury top-ups and returns of unused liquidity require two signatures; individual purchases and beneficiary claims do not. Earlier payout runs and classic checkouts remain available for their existing records. See the dated [pool verification](contributor-controlled-agreements-evidence/prefunded-pool-testnet.json) and the README's updated recording sequence and scope limits.
