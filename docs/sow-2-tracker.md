# SOW 2 milestone tracker

This is the single working tracker for Music City's submitted SOW 2. The Google Doc defines the scope. This tracker records implementation, verification, deployment, and remaining work without changing that scope.

## Source and baseline

- Source: [Music City Instawards SOW - 2](https://docs.google.com/document/d/1Nk0WR6laCp2meQT_VANp3oYFr9YkuZyVKe5ziuPWFoc/edit).
- Source read again: 15 October 2026. Drive reports the document last modified on 11 September 2026 at 17:57:16 UTC. The submitted scope is unchanged.
- Submitted date recorded in the source: 1 August 2026. Suggested start: 3 August 2026. Duration: 30 days. These are submitted dates, not a newly agreed schedule.
- Builder: Enoch N Chirima. Chapter: South Africa. Chapter lead: David Ogoegbunem.
- Implementation baseline inspected: `fae2730` in [iamenochchirima/music-city](https://github.com/iamenochchirima/music-city).
- Scope references below use source sections 4.1, 4.2, 5.1, and 6.1.
- Reviewer acceptance has not been recorded for any deliverable.

Existing ledger, payment, registry, and payout capabilities are starting components. They do not establish completion of the new settlement, claim, support, or treasury requirements.

## Status rules

| Status | Meaning |
| --- | --- |
| Open | Required work or its design remains outstanding. |
| Partial | Related implementation exists, but does not cover the complete requirement. |
| Implemented | Required code exists. Listed verification gaps still apply. |
| Verified historically | Recorded tests or Testnet evidence cover the stated behavior at their recorded date. This does not establish current browser or deployment behavior. |
| Verified current | A dated check covers the current implementation and specified environment. |
| Accepted | Required evidence is complete and reviewer acceptance is recorded. |

An unchecked acceptance item remains open even when its implementation has passed local tests. Record the environment, commit, date, command or user action, result, and evidence for each verification. Do not convert generated-key signatures, mocked wallet calls, or a healthy API into proof of real user signing.

Implementation rules:

- Refactor or replace existing code when it conflicts with the submitted lifecycle. Remove replaced endpoints, controls, configuration, and tests in the same change.
- Do not retain consent bypasses, unsigned approval, off-chain success substitutes, or single-key authorization for protected treasury actions.
- Preserve valid financial, consent, and transaction history. Code removal does not authorize fabricated approvals or deletion of ledger evidence.
- Implement required authorization, signature verification, transactional correctness, and failure handling with each flow. Broader hardening can follow, but required SOW security tests remain acceptance work.

## Deliverable summary

| Deliverable | Current position | Next completion boundary |
| --- | --- | --- |
| D1. Soroban earnings settlement engine | Implemented and service lifecycle verified on Testnet. E5 records funding, beneficiary claims, amendment, expiry recovery, and independent reconciliation. | Record reviewer acceptance. Real Dynamic wallet journeys passed in E5. |
| D2. Contributor agreements and treasury controls | Implemented. E7 verifies the current creator/admin agreement lifecycle through real Dynamic Sandbox and Stellar Testnet. E5 covers protected settlement operations; E6 covers direct support. | Complete authenticated production admin setup in E7 and obtain reviewer acceptance. |
| D3. Product integration, operations, reconciliation, and verification | Core creator-to-earnings journey verified locally in E8, including actual purchase, recovery, two-signer funding and both claims. Earlier deployments are documented in E5 through E7. | Settlement integration, failure recovery, deployment, and evidence are complete in E5. Direct support integration passed in E6. Its rollout is verified. Complete authenticated live admin setup in E7 and obtain SOW acceptance. |

## D1. Soroban earnings settlement engine

Source: sections 4.1 D1, 5.1 Weeks 1, 2, and 4, and 6.1 D1. D1 owns settlement and the creator-claim path.

| ID | Submitted requirement | Implementation and evidence | Remaining work |
| --- | --- | --- | --- |
| D1-01 | Validate finalized royalty splits | Exact captured agreement ID, version, hash, registry, and network verified in backend and contract. Historical versions remain valid. E5. | Reviewer acceptance. Current Dynamic consent verified in E5. |
| D1-02 | Create settlement batches from aggregated backend earnings | Immutable source-wide batches and transactional ledger reservations implemented. PostgreSQL concurrency and audit rollback tests pass. E5. | Reviewer acceptance. |
| D1-03 | Calculate each recipient's allocation | Seven-decimal integer allocation, deterministic remainder, per-recipient fee floor, and conservation verified in backend and contract. E5. | Reviewer acceptance. |
| D1-04 | Prevent duplicate settlement | Permanent batch and source uniqueness on-chain, unique database reservations, and exact-envelope retries. Duplicate Testnet simulation rejected. E5. | Reviewer acceptance. |
| D1-05 | Create claimable Stellar USDC balances | Soroban escrow holds Circle USDC and contract-managed claim records. Four recipient claim IDs and exact funding receipts recorded. E5. | Reviewer acceptance of the documented mechanism. These are not native protocol claimable-balance IDs. |
| D1-06 | Creator claim handling | Beneficiary-authorized, fixed-destination, single-use claims implemented. Three real Testnet claims confirmed. E5. | Reviewer acceptance. Current Dynamic claims verified in E5. |
| D1-07 | Expiry and reclaim handling | Expiry boundary, threshold recovery, and repeat rejection implemented. 30 USDC recovered through the admin browser. E5. | Reviewer acceptance. |
| D1-08 | Wallet-signed creator withdrawals | Exact-XDR creator signing, session wallet, network, readiness, cancellation, and replay checks implemented. E5. | Reviewer acceptance. Real provider cancellation and signing verified in E5. |
| D1-09 | Stellar USDC settlement | 200 Circle Testnet USDC funded through threshold treasury transactions. Single-key payout executor removed. E5. | Reviewer acceptance. |
| D1-10 | Settlement events and independently verifiable on-chain evidence | Six confirmed lifecycle events indexed with receipt validation, ledgers, hashes, and explorer links. Unknown external batches produce exceptions. E5. | Reviewer acceptance. |
| D1-11 | Backend reconciliation of on-chain settlement and claims | Worker reconciles exact receipts, contract state, indexed events, escrow token balance, and network fees. Demonstrated totals are 200 funded, 170 claimed, 30 recovered, zero outstanding. E5. | Reviewer acceptance. |

D1 acceptance checklist:

- [ ] Approve the canonical batch, allocation, claim, expiry, authorization, and event specification.
- [x] Demonstrate one earnings batch allocated to multiple recipients using a verified finalized agreement.
- [x] Demonstrate duplicate prevention with no duplicate payment or claimable balance.
- [x] Demonstrate wallet-authorized USDC claim or withdrawal and beneficiary restrictions.
- [x] Demonstrate expiry and reclaim, including boundary and repeated-action tests.
- [x] Match backend records to confirmed settlement, claim, balance, and event evidence.
- [x] Package contract tests, integration tests, Testnet evidence, screenshots, and technical documentation.
- [ ] Record reviewer acceptance of D1.

## D2. Contributor agreements and treasury controls

Source: sections 4.1 D2, 5.1 Weeks 1, 3, and 4, and 6.1 D2. D2 owns consent, governance, separate direct support, and protected treasury actions.

| ID | Submitted requirement | Implementation and evidence | Remaining work |
| --- | --- | --- | --- |
| D2-01 | Canonical split proposal | Current recording-to-proposal UI, registered identities, exact splits, review and submission verified in E7. Production serves the same implementation. | Complete authenticated production admin setup and reviewer acceptance. |
| D2-02 | Wallet-signed acceptance | Verified through real Dynamic Sandbox accounts. Four independent provider signatures authorize exact original and amended proposals. Cancellation records no consent. E5. | Reviewer acceptance. |
| D2-03 | Rejection and dispute | Real signed rejection, accepted-contributor dispute, admin resolution, owner resubmission and fresh consent verified in E7. | Reviewer acceptance. |
| D2-04 | Finalization requires complete consent | Current browser-generated consent and two treasury signatures finalized versions 1 and 2. Earlier effective terms remained active until confirmation. E5. | Reviewer acceptance. |
| D2-05 | Amendments preserve history and require fresh consent | Real Dynamic browser verification preserves the 70/30 entitlement while a 60/40 amendment requires fresh signatures and governs a different source. E5. E2 retains historical dispute coverage. | Reviewer acceptance. |
| D2-06 | Direct fan-to-artist support payments | Implemented. Exact direct USDC payment, Dynamic signature, receipt, balance reconciliation, and retained history verified in E6. | Reviewer acceptance. Rollout verified in E6. |
| D2-07 | Direct fan-to-contributor support payments | Implemented for registered contributors linked to public recordings. Real Dynamic payment to a listener contributor verified in E6. | Reviewer acceptance. Rollout verified in E6. |
| D2-08 | 2-of-3 treasury authorization for finalization | Current dedicated treasury and registries verify thresholds of two. Both Dynamic-consented versions finalized with two distinct signatures. E5. | Reviewer acceptance. |
| D2-09 | 2-of-3 authorization for protected admin actions | Finalization, funding, recovery, maintenance, and restoration require exact threshold signatures. The single-key executor and mutable financial controls are removed. E5. | Reviewer acceptance. Separate support must preserve these controls. |
| D2-10 | Migration, approval records, state transitions, and audit history | E7 records current approval history, fresh-database migrations, recovery and preserved production records. Early additive migration exception is disclosed. | Review the rollout exception; authenticated production admin setup and reviewer acceptance. |

D2 acceptance checklist:

- [x] Demonstrate a registered owner and contributor creating and independently signing the same 70/30 proposal through the current UI.
- [x] Cancel signing and verify that no consent is recorded.
- [x] Reject unauthorized contributors, changed proposals, duplicate or replayed responses, invalid splits, and incomplete acceptance.
- [x] Demonstrate rejection, dispute, resolution, amendment, fresh consent, and preserved history.
- [x] Verify three independent treasury signers, the registry treasury, and thresholds requiring two.
- [x] Demonstrate one signer cannot finalize and two distinct signers can finalize.
- [ ] Verify every specified protected admin action requires the required treasury authorization.
- [x] Demonstrate separate fan-to-artist and fan-to-contributor support payments with transaction evidence.
- [x] Package approval records, migrations, state transitions, support hashes, treasury evidence, screenshots, and tests.
- [ ] Record reviewer acceptance of D2.

## D3. Product integration, operations, reconciliation, and verification

Source: sections 4.1 D3, 5.1 Week 4, and 6.1 D3. D3 integrates the two technical deliverables into an operable product.

| ID | Submitted requirement | Implementation and evidence | Remaining work |
| --- | --- | --- | --- |
| D3-01 | Creator and administrator interfaces for D1 and D2 | Creator Revenue claims and admin settlement preview, threshold signing, receipts, recovery, and global reconciliation implemented. E5. E6 adds artist and contributor support, user history, and read-only admin events. | Reviewer acceptance. |
| D3-02 | Wallet and trustline readiness | Network, beneficiary, trustline authorization and capacity, USDC balance, XLM reserve and fees checked with corrective actions. E5. E6 verifies direct-support network, trustline, capacity, balance, reserve, and fee checks. | Reviewer acceptance. |
| D3-03 | Settlement and claim status | Automatic read-only polling presents preparation, signature collection, submission, confirmation, claim, expiry, and recovery. E5. | Reviewer acceptance. Real provider signing and cancellation verified in E5. |
| D3-04 | Support-payment history | Sent and received records, automatic pending status, receipts, and read-only admin events implemented and verified in E6. | Reviewer acceptance. Rollout verified in E6. |
| D3-05 | Payout and reconciliation workflows | New financial worker and durable event index reconcile exact receipts, contract state, token obligations, and unique fees. Old payout records remain read-only. E5. | Reviewer acceptance. |
| D3-06 | Multisignature configuration evidence | Dedicated current treasury and both deployed registries verify three distinct weight-one keys and thresholds of two. E5. | Reviewer acceptance. |
| D3-07 | Failure recovery | Exact-envelope bounded retries, unknown-outcome retention, archival restoration, signed maintenance, and expiry recovery implemented and tested. E5. E6 adds durable support authorization, original-hash recovery, and chain-based expiry. | Reviewer acceptance. |
| D3-08 | Automated security and failure tests | Contract, domain, signatures, routes, readiness, components, and real PostgreSQL failure/concurrency suites pass. E5. E6 adds support signature, route, component, readiness, concurrency, immutable evidence, and failure suites. | Reviewer acceptance. |
| D3-09 | Deployment documentation and final Testnet deployment | Settlement API, financial worker, media worker, creator and admin frontends, dedicated registry, and escrow deployed and runtime-verified. E5. E6 records the support API, migration, worker startup, both frontends, and preservation of existing records. | Reviewer acceptance. Application deployment alone does not complete the SOW. |
| D3-10 | Transaction evidence and end-to-end Testnet verification | Generated-key service lifecycle and real admin browser recovery confirmed on Testnet, including amendment and expiry. E5. E6 verifies both real Dynamic direct-support destinations and independent balance reconciliation. | Reviewer acceptance. |

D3 acceptance checklist:

Local core verification is complete in E8. The completed checkout changes have a local Git checkpoint. Their production rollout remains open. The two rollout/package items and reviewer acceptance below remain open.

- [x] Demonstrate the complete creator and admin journeys using real wallets and confirmed Testnet transactions. E8 connects actual release publication and purchase to two-signer funding and both beneficiary claims.
- [x] Verify readiness, status, history, and recovery at each signing and payment boundary. E5 through E8 record the separate agreement, support, checkout and settlement results. E8 discloses the provider OTP dismissal limitation.
- [x] Reconcile all new financial records to their exact chain outcomes. E8 verifies one payment, one entitlement, two paid allocations, exact fees, both claims and unchanged older escrow obligations.
- [x] Complete the security and failure test matrix below. E5 through E8 cover the listed groups, with current automated regression results and explicit transport limits.
- [ ] Publish deployment instructions and a repeatable demonstration with no private keys in evidence.
- [ ] Package deployed contract IDs, repository commit, test results, hashes, balance IDs, explorer links, screenshots, and reconciliation records.
- [ ] Record reviewer acceptance of D3.

## Separately scoped provider readiness and budget

Source section 4.2 includes $1,300 for provider integration readiness. Sections 4.1 and 6.1 make provider approval non-blocking for core Stellar acceptance. Track the budgeted work explicitly rather than dropping it or blocking D1 through D3 on it.

| Item | Submitted amount | Position |
| --- | --- | --- |
| Soroban earnings settlement engine | $1,400 | D1. |
| Contributor agreements and treasury controls | $1,000 | D2. |
| Fiat provider integration readiness | $1,300 | Separate adapter and sandbox work. No completion evidence established in this review. |
| Product integration, audit trail, and reconciliation | $500 | D3 integration and operations. |
| Security, testing, and failure handling | $500 | Cross-deliverable tests and recovery. |
| Deployment, documentation, and evidence packaging | $300 | D3 final verification and evidence. |
| Total | $5,000 | Submitted budget. This tracker does not record spending or payment. |

Provider readiness checklist:

- [ ] Specify and implement the off-ramp payout adapter. Start with the [creator cash-out implementation plan](#creator-cash-out-implementation-plan).
- [ ] Specify and implement the on-ramp payment adapter.
- [ ] Map provider payments and payouts to internal records.
- [ ] Handle provider status and failure transitions.
- [ ] Capture sandbox verification and document any unavailable provider access.

Provider approval, fiat conversion, and live fiat payout are outside core acceptance. Marketing, acquisition, promotions, incentives, secondary trading, rights investment, cross-chain settlement, per-stream chain writes, and multi-country launch are excluded. The 50-artist and 200-listener counts are validation targets, not technical completion gates.

## Submitted timeline and current work order

The submitted weekly plan remains the scope reference. The current implementation order below reflects work already done and does not rewrite submitted dates.

| Submitted week | Required output | Current gap |
| --- | --- | --- |
| Week 1 | Approved D1 and D2 specifications, contract architecture, integration map, Testnet configuration, treasury plan, security assumptions, and executable tests | Settlement specification, contracts, treasury configuration, and executable tests are complete in E5. E6 records the direct-support specification and tests. Reviewer approval remains. |
| Week 2 | Working settlement and creator-claim flow, contract tests, integration, balance and transaction evidence, reconciliation | D1 implementation and real Dynamic Testnet lifecycle verified in E5. Reviewer acceptance remains. |
| Week 3 | Contributor agreements, direct support, treasury controls, and creator/admin views | Current wallet consent, dedicated treasury, protected settlement actions, and claims verified in E5. E6 verifies support failures and original-hash recovery. |
| Week 4 | Integrated final deployment, complete tests, and technical evidence pack | Settlement rollout and evidence are complete in E5. E6 records direct support. Finish authenticated live admin setup in E7, track provider work separately, and obtain SOW acceptance. |

Next implementation checkpoints:

1. Obtain reviewer acceptance of the settlement specification and E5 evidence.
2. Review the direct-support implementation and E6 evidence.
3. Complete the [agreement lifecycle implementation plan](#agreement-lifecycle-implementation-plan) below. Track provider readiness separately.

## Earnings settlement and creator claims chunk

Planned on 15 October 2026 against commit `fae2730`. Implementation, real Dynamic browser verification, and final rollout are complete at `721fe67`. E5 records the evidence. Reviewer acceptance remains SET-24.

The outcome is a complete Testnet journey from a contributor-approved agreement to a funded settlement batch, creator-authorized USDC receipt, expiry recovery, and reconciled records. This chunk covers D1-01 through D1-11 and the D3 interfaces, readiness, recovery, and evidence needed to operate that journey. Agreement browser verification and dedicated treasury configuration are prerequisites within this chunk. Direct fan support, provider adapters, and unrelated music-creation UX remain separate work.

### User and administrator lifecycle

1. The artist and collaborator independently approve their exact agreement. Two treasury signers finalize it. Future earnings capture that finalized version.
2. The administrator previews an eligible earnings batch, including its sources, agreement versions, asset, recipient amounts, and expiry.
3. Two independent treasury signers authorize the exact funded settlement. The system shows pending until confirmed chain evidence is verified.
4. Each contributor sees their available USDC and expiry in Revenue. The creator selects Claim USDC, reviews the amount and destination, and signs with the bound wallet.
5. After confirmation, Revenue shows the receipt and transaction link. A cancelled signature leaves the claim available.
6. Unclaimed funds expire according to the fixed terms. Authorized recovery returns those funds to the designated treasury and records the outcome.
7. The administrator reconciles funding, open claims, receipts, and recovered amounts. Unknown submissions remain pending until the original transaction is resolved.

Creator screens show amounts, expiry, actionable errors, and transaction links. Contract IDs, XDR, and reconciliation internals belong in optional detail or admin views. Status refresh and reconciliation run in the backend. Users do not need to refresh or keep the page open after a transaction has been submitted.

### Architecture decisions to settle first

| Decision | Proposed direction and completion requirement |
| --- | --- |
| Claimable-balance mechanism | Use a Soroban settlement escrow holding USDC through its Stellar Asset Contract. Claim IDs are contract ID, batch hash, and recipient index. The SOW requires a Soroban-owned claim lifecycle and does not mandate native protocol operations. Record these as contract-managed claimable balances. Reviewer acceptance of the evidence remains SET-24. |
| Native Stellar claimable balances | These are a distinct protocol mechanism. Soroban contracts cannot directly interact with them. If native balance IDs are required for acceptance, specify the native-operation integration and its consistency guarantees explicitly. Do not label contract claim IDs as native balance IDs. |
| Asset and network | Bind the network, USDC issuer, and asset contract in configuration and batch hashes. Use Testnet USDC for demonstration. Do not silently change asset, issuer, or network. |
| Allocation units | Use integer asset units, canonical recipient ordering, and a documented remainder rule. The existing code assigns the remainder to the last recipient. Select one canonical rule and implement it identically in the contract and backend. Reject excess precision instead of silently truncating it. |
| Treasury control | Protect funding, settlement authorization, reclaim, and any privileged financial configuration with the specified 2-of-3 treasury authorization. Creator claims require the beneficiary's own wallet authorization. Admin login alone cannot authorize a protected chain action. |
| Expiry | Pin an absolute expiry in the authorized batch. Specify claim-before-expiry and reclaim-at-or-after-expiry boundaries. A claim and reclaim for the same entitlement cannot both succeed. |
| Contract state lifetime | Define storage lifetime, extension, restoration, and recovery for batch and claim records. Contract storage expiry cannot be mistaken for a paid or reclaimed entitlement. |
| Execution ownership | Use dedicated settlement attempts and financial reconciliation jobs. Reuse durable-job patterns, not media-processing state or request-local background promises. |

Technical references: [Stellar smart-contract limitations](https://developers.stellar.org/docs/build/smart-contracts/overview), [native claimable balances](https://developers.stellar.org/docs/build/guides/transactions/claimable-balances), and [Stellar Asset Contract](https://developers.stellar.org/docs/tokens/stellar-asset-contract). The implementation uses contract-managed claimable balances. This does not claim reviewer acceptance or native balance IDs. See the [settlement specification](settlement-specification.md) for exact terms.

### Financial invariants

- The current royalty ledger already contains recipient allocations. Identify the original revenue event, track, approved agreement version, asset, and associated ledger entries before constructing a batch. Do not split each recipient's allocated amount again.
- Capture the effective finalized agreement when earnings are recognized. Settlement and claims retain that exact version and hash. Later amendments govern future earnings and do not change amounts already earned.
- Validate immutable finalized registry evidence for the captured version. A newer proposed or disputed amendment does not invalidate an older effective finalized agreement.
- Legacy entries without valid contributor-approved evidence remain visible and blocked for this new workflow until explicitly resolved. Do not invent historical consent.
- Reserve each eligible ledger entry once. Exclude already paid, reversed, reserved, and unresolved old payout entries. A database reservation and on-chain batch identity jointly prevent duplicate settlement.
- Separate settlement funding from creator receipt. Confirming a funded claim does not mean the creator has withdrawn it. Preserve historical paid records and their transaction references.
- Enforce conservation in integer units. Funded amount equals claimed amount plus open claim obligations plus reclaimed amount. Network fees and reserves are recorded separately.
- Fix recipient wallets, amounts, claim IDs, agreement evidence, expiry, and target contracts in the signed payload. Redirecting a claim requires an explicitly designed authorization flow and is not included in this first implementation.
- Persist exact transaction envelopes and hashes before submission. A timeout is not a confirmed failure and cannot justify a fresh transaction that might pay twice.
- Remove the replaced single-key payout execution path and obsolete financial controls. Retain historical records and read-only evidence. No fallback payout rail is permitted when the required settlement flow fails.

### Phased implementation checklist

Checked items indicate finished work with recorded evidence. Update this checklist at each completed phase, not only at the end of the chunk.

Phase 0. Confirm scope and technical specification.

- [x] SET-00. Re-read the submitted Google Doc and inspect the registry, finalized-agreement projection, existing ledger allocation, and single-key payout executor. Source unchanged on 15 October 2026.
- [x] SET-01. Fix the claimable-balance mechanism, evidence identifiers, expiry, integer precision, rounding, resource limits, and storage lifetime. Resolve any acceptance ambiguity before implementing the contract interface.
- [x] SET-02. Define canonical batch and claim schemas, states, idempotency keys, source eligibility, ledger reservation, signed payloads, events, and the protected admin action list.

Phase 1. Close the agreement and treasury prerequisites.

- [x] SET-03. Verify the current Dynamic Stellar wallet flow with two real contributor accounts: review, cancellation, acceptance, and amendment consent. Record the actual browser result rather than generated-key evidence alone.
- [x] SET-04. Configure a dedicated Testnet treasury and finalized-agreement registry for the demonstrated environment. Verify three independent signers and a threshold requiring two.
- [x] SET-05. Confirm that a funded batch can pin and verify the exact finalized agreement version, including historical versions still referenced by earnings.

Phase 2. Implement the funded settlement and claim contract.

- [x] SET-06. Add the settlement contract and registry integration. Reject unfinalized, altered, foreign-contract, and wrong-network evidence.
- [x] SET-07. Implement canonical batch allocation, authorized funding, unique batch and source identities, atomic claim creation, and insufficient-funding rollback.
- [x] SET-08. Implement beneficiary-authorized claim or withdrawal, replay prevention, fixed destinations, expiry, and threshold-protected reclaim.
- [x] SET-09. Add immutable evidence, lifecycle events, contract-state lifetime handling, and contract tests for conservation and concurrent actions.

Phase 3. Implement accounting, authorization, and reconciliation.

- [x] SET-10. Add transactional migrations for batches, source reservations, allocations, claim records, signing attempts, and append-only audit events. Preserve existing financial records.
- [x] SET-11. Build an admin preview that validates source eligibility, captured agreement evidence, totals, asset identity, and expiry before reserving earnings.
- [x] SET-12. Prepare exact treasury transactions, collect and verify independent signatures, submit once, and confirm both transaction and contract state before marking settlement funded.
- [x] SET-13. Prepare creator claims for the authenticated beneficiary. Verify wallet, network, trustline readiness, fees, expiry, and exact transaction identity. A login signature does not authorize withdrawal.
- [x] SET-14. Implement backend reconciliation, restart recovery, bounded retry, unknown-outcome handling, expiry processing, and visible financial discrepancies.
- [x] SET-15. Retire the replaced single-key executor, mutating payout routes, and obsolete UI controls. Prevent the old and new executors from consuming the same earnings during rollout.

Phase 4. Connect creator and administrator interfaces.

- [x] SET-16. Add creator Revenue balances, pending and available earnings, Claim USDC, expiry, cancellation recovery, and confirmed receipts with explorer links.
- [x] SET-17. Add admin batch preview, agreement evidence, signer progress, submission and claim status, reclaim, and reconciliation exception views.
- [x] SET-18. Add automatic read-only status updates and direct corrective actions for missing trustlines, changed wallets, insufficient funds, failed submission, and unresolved outcomes.

Phase 5. Verify, deploy, and package evidence.

- [x] SET-19. Pass the contract, signature, authorization, real PostgreSQL, concurrency, accounting, and failure tests below.
- [x] SET-20. Pass real-browser creator claim and admin authorization journeys, including wallet cancellation and successful signing.
- [x] SET-21. Run the complete funded Testnet demonstration, including expiry recovery, duplicate attempts, and an amendment affecting only later earnings.
- [x] SET-22. Back up the target database, apply migrations, deploy the contracts and financial worker, validate runtime configuration, and verify the final environment.
- [x] SET-23. Package contract IDs, asset identity, batches, claim or balance IDs, transaction hashes, ledgers, explorer links, screenshots, test results, and reconciled totals. Update D1 and the covered D3 rows with evidence.
- [ ] SET-24. Record reviewer acceptance separately. Completing this chunk does not imply completion of direct support, provider readiness, or all of SOW 2.

### Required tests for this chunk

| Case | Required outcome |
| --- | --- |
| Valid 70/30 agreement and 100 USDC | Confirmed settlement produces exactly 70 and 30 USDC of claimable entitlement. |
| Recipient ledger entries already allocated | Consume each source once without applying a second royalty split. |
| Rounding, tiny amounts, zero allocations, excess precision, overflow | Apply the specified rule deterministically. Preserve totals and reject unsupported inputs before moving funds. |
| Pending, disputed, forged, or wrong-registry version | Reject invalid evidence. A valid previously finalized version remains usable for its already captured earnings. |
| Amendment from 70/30 to 50/50 | Earlier earnings keep 70/30. Earnings captured after the amendment use 50/50. |
| Duplicate batch, repeated source, concurrent reservation or submission | One financial outcome. No duplicate obligation, fund movement, or ledger consumption. |
| One treasury signer, duplicate signer, altered envelope | No protected financial operation can succeed. Two independent authorized signers can execute the exact operation. |
| Wrong claimant, wallet mismatch, altered destination, replay, cancelled signing | No unauthorized receipt or false success. Cancellation leaves the valid claim available. |
| Missing trustline, account readiness, asset authorization, fee balance, or treasury funding | Show the correct action. Do not mark settlement or claim complete or leave partial financial records. |
| Claim before expiry, claim at expiry, reclaim before expiry, concurrent claim and reclaim | Enforce the exact boundary. Claim and reclaim cannot consume the same entitlement. |
| RPC timeout, crash after submission, repeated confirmation, pruned or uncertain history | Reconcile the persisted original transaction. Do not create another payment while its outcome is unresolved. |
| Contract storage expiry or restoration | Preserve the entitlement and its evidence. Missing state cannot be treated as a successful financial transition. |
| Database failure during reservation or confirmation | Roll back the complete application transition. Confirmed chain outcomes remain recoverable through reconciliation. |
| Old payout submitted or uncertain | Exclude its sources until resolved. Preserve the original transaction and prevent cross-executor double payment. |
| Independent reconciliation | Funding, claims, open obligations, and reclaim agree across ledger entries, database records, contract state, token balances, and events. |

### Demonstration and completion boundary

Use disposable Testnet accounts, the explicit Testnet USDC issuer, an actual finalized 70/30 agreement, and 100 USDC of traceable demonstration earnings. Synthetic earnings must be clearly labelled test fixtures rather than real streams or purchases.

Settle once. Let contributor A sign and receive 70 USDC. Let contributor B's unclaimed 30 USDC expire and recover it through the required authorization. Prove that a second claim, repeated batch, and early reclaim fail. Final reconciliation shows 70 claimed, zero still open, and 30 reclaimed, with fees recorded separately. A second independently funded batch under a 50/50 amendment verifies that old entitlements remain unchanged.

The chunk is functionally complete when that demonstration and all applicable tests pass through the real creator and admin flows. Generated-key service tests, a successful registry publication, and deployment health alone do not complete it. Reviewer acceptance remains an explicitly separate record.

## Required SOW test matrix

| Test group | Required result | Evidence position |
| --- | --- | --- |
| Finalized-split and invalid-split tests | Only exact confirmed splits settle. Invalid shares, wallets, totals, and versions fail. | E1 plus E5 contract, domain, and PostgreSQL tests. Exact captured historical versions are checked before funding. |
| Incomplete acceptance and unauthorized contributors | Missing consent and outsider signatures cannot finalize. | E1 and E5 authorization tests. Current Dynamic signatures and cancelled consent are independently verified in E5. |
| Dispute and amendment history | Blocked versions cannot finalize. New versions require fresh consent and preserve effective history. | E1 and E2 retain dispute evidence. E5 verifies fresh Dynamic amendment consent, effective history, and unchanged funded entitlements. |
| Duplicate approval | Identical retries do not add consent or duplicate events. Changed or replayed signatures fail. | Historical E1. |
| Duplicate settlement and allocation | Repeated or concurrent batch submission cannot pay twice. Allocations conserve the batch amount. | E5 contract replay tests, Testnet duplicate simulations, source uniqueness, and real PostgreSQL concurrency tests. |
| Claimable balances and creator claim | Correct balances exist. Only the authorized beneficiary claims once. | E5 funded escrow records and seven real Testnet claims, including four through Dynamic. Unauthorized and repeated claims are rejected in tests. |
| Expiry and reclaim | Exact deadline rules hold. Claim and reclaim cannot both succeed for the same funds. | E5 exact boundary and replay tests plus actual 30 USDC recovery through the admin browser. |
| Wallet-signed withdrawal | Correct wallet and network authorize the exact action. Cancellation, altered transactions, and replay fail safely. | E5 verifies real provider approval, cancellation with zero signatures and submissions, same-hash retry, beneficiary receipts, and mismatch/replay tests. |
| Trustline and insufficient balance | Unready wallets or insufficient funds fail without false confirmation or partial accounting. | E5 readiness tests and both actual Dynamic trustline transactions. Insufficient funding rolls back in contract tests. |
| Direct support | Artist and contributor destinations receive the exact intended payment. Duplicate confirmations do not duplicate history. | E6 verifies both real Dynamic destinations, exact USDC balance changes, network fees, and one confirmed history entry per payment. |
| Multisignature threshold | One signer fails. Two independent valid signers succeed. Wrong or altered envelopes fail. | E1 and E5 verify one-signer rejection and two-signer publication, funding, recovery, restoration, and maintenance authorization. |
| Failed settlement and retry | Failures retain truthful status. Uncertain results reconcile the original transaction before another attempt. | E5 verifies exact-envelope retry bounds, uncertain-outcome retention, receipt mismatch, immutable audit rollback, and pruned-history refusal. E6 verifies support failures and original-hash recovery. |
| Reconciliation | Backend totals and status match confirmed transactions, events, claims, and expiry outcomes. | E5 verifies receipts, event index, token balance, unique fees, external-batch discrepancies, and final conservation with zero outstanding. |

## Evidence register

| ID | Evidence | What it establishes |
| --- | --- | --- |
| E1 | [Agreement test evidence](contributor-agreements-evidence/milestone-verification.md) and [repeatable Testnet setup](contributor-agreements-evidence/README.md) | Historical agreement domain, persistence, authorization, signature, finalization, and reconciliation checks. Dates and transport limits belong to those records. |
| E2 | [Public agreement Testnet record](contributor-agreements-evidence/stellar-testnet.json) | Historical 70/30 finalization, dispute, fresh-consent amendment, treasury thresholds, and immutable registry read-back. No D1 settlement or creator-claim evidence. |
| E3 | [Production deployment](production-deployment.md) and [deployment evidence](production-deployment-evidence/README.md) | API migrations, readiness, frontend deployment, and selected runtime checks. Not proof of configured agreement finalization or complete SOW acceptance. |
| E5 | [Settlement lifecycle evidence](settlement-evidence/README.md) | Final contract binaries, funded USDC claims, expiry recovery, immutable event index, tests, admin browser signatures, and explicit real-wallet gaps. |
| E6 | [Direct support evidence](support-evidence/README.md) | Exact artist and contributor payments through Dynamic Sandbox, cancelled signing, immutable history, PostgreSQL concurrency, and independent Testnet reconciliation. |
| E7 | [Current agreement lifecycle evidence](contributor-agreements-evidence/lifecycle-review/README.md) | Real creator/admin Testnet lifecycle, independent signatures and registry checks, original-hash restart recovery, lost response, real expiry, historical entitlement comparison, responsive UI, and rollout. Live first-admin setup remains open; early migration exception disclosed. |
| E8 | [Core music-to-earnings evidence](core-lifecycle-evidence/README.md) | Local release publication, actual Dynamic purchase, captured agreement, lost-response/API-restart recovery, two-signer funding, both beneficiary claims, exact reconciliation and corrected artist sales. No new production rollout or SOW acceptance. |
| E4 | [Release-flow evidence](release-flow-evidence/README.md) | Current release creation, editing, upload, publication choices, and visible processing. Supporting product work, not a substitute for financial-flow verification. |

Historical baseline findings from 14 October 2026, superseded for settlement by E5:

- The creator agreement UI calls Dynamic's Stellar wallet integration. Historical direct-Freighter notes do not describe the current implementation.
- A presence-only Railway check found no `AGREEMENT_TREASURY_ADDRESS` or `ROYALTY_REGISTRY_CONTRACT_ID` on the production server. Live agreement finalization requires explicit configuration.
- The registry implements finalized split publication. It is not the complete settlement or creator-claim contract.
- Existing treasury payout code signs with one key. It cannot count as proof that all protected actions meet the SOW's 2-of-3 requirement.
- Current release UI checks passed 77 client tests, typecheck, production build, and a browser release-flow run. These results cover that update only.

## Verification and acceptance log

| Date | Scope | Result | Evidence or next action |
| --- | --- | --- | --- |
| 2 October 2026 | Agreement service and registry Testnet demonstration | Historical verification recorded | E1 and E2. Real current browser consent still needs verification. |
| 14 October 2026 | Live API and frontend rollout | Deployment and schema verification recorded | E3. Agreement treasury and registry variables remain absent. |
| 14 October 2026 | Release review UI | Tests, browser flow, deployment, and served bundle verified | E4, commit `a21ea0b`. |
| 14 October 2026 | SOW 2 alignment review | Source read and current gaps mapped | This tracker. No reviewer acceptance claimed. |

| 15 October 2026 | SET-01 through SET-23 implementation and Testnet rollout | Implementation, automated checks, service lifecycle, admin browser recovery, and initial rollout verified. Real-wallet gates were open at this initial checkpoint and subsequently closed below. | E5 records tested commit `3b4fa52`, deployment IDs, receipts, migrations, data preservation, and real-wallet limits. |

| 15 October 2026 | SET-03 and SET-20 real Dynamic follow-up | Both gates passed, including provider cancellation, four consent signatures, four claims, and unchanged historical entitlements. SET-01 through SET-23 complete. | E5 dynamic-browser.json and dynamic-deployment.json, commit `721fe67`. Reviewer acceptance remains separate. |

For future entries, record the requirement IDs, tested commit, environment, result, evidence location, and remaining gap. Mark a deliverable accepted only after its checklist and source-required evidence are complete and acceptance is recorded.

### Settlement implementation checkpoint, 15 October 2026

The final binaries passed 11 contract tests. Server tests passed 110 with eight opt-in suites skipped. The separate disposable PostgreSQL run passed metadata, publication, agreement, and settlement suites, including all 14 settlement subtests. Client tests passed 79 and admin tests passed 16. Workspace typecheck and production builds passed.

E5 records the complete service Testnet lifecycle and real admin browser recovery. Independent reconciliation verified 200 USDC funded, 170 claimed, 30 recovered, zero outstanding, and zero escrow balance. Six lifecycle events and four contract-managed claim IDs are recorded. The deployed live contracts are separate from the synthetic demonstration contracts.

The initial generated-key demonstration did not establish Dynamic wallet behavior. The follow-up real Dynamic Sandbox browser verification now closes SET-03 and SET-20. It covers two independent embedded wallets, exact original and amended consent, provider signing cancellation, unsigned withdrawal retry, all four confirmed claims, and automatic status updates. The original two 100 USDC batches remain historical evidence. The additional two 0.01 USDC batches bring the demonstration escrow totals to 200.02 funded, 170.02 claimed, 30 recovered, and zero outstanding. SET-22 passed. The initial three Railway deployments ran commit `3b4fa52`; the final rollout runs `721fe67`, both Vercel frontends are ready, migrations and API access controls passed, the live event index is caught up, and existing database records match the pre-deployment audit. E5 contains deployment IDs and the cached reconciliation report. Reviewer acceptance and separate direct support are not claimed.

### Real Dynamic browser verification completed, 15 October 2026

The in-app browser completed genuine Dynamic Sandbox authentication and embedded-wallet signing on the existing approved origin `http://localhost:3000`. A Chrome extension is not required for this flow. Static test accounts and signing reauthentication are enabled only in Sandbox. Live authentication retains environment `36b4587d-d6e3-4831-8a77-0d1b0de32e32`.

[Dynamic browser evidence](settlement-evidence/dynamic-browser.json) independently verifies all four contributor consent signatures and the exact confirmed receipts for four claims. Cancelling Dynamic consent authorization left the amendment unsigned by that contributor. Cancelling withdrawal authorization left zero signatures and zero submissions. Retrying used the same prepared transaction hash and confirmed once. The listener contributor reached claims through the account's Your earnings link without artist activation.

The test exposed and fixed missing scoped provider authorization and premature closing of reauthentication prompts. Commit `721fe67` centralizes wallet authorization across agreements, claims, transfers, checkout, and trustlines. All 85 client tests, client typecheck, and the production build pass. [Deployment verification](settlement-evidence/dynamic-deployment.json) records the final rollout and confirms the live bundle still uses Live authentication.

SET-01 through SET-23 are complete. SET-24 remains reviewer acceptance. Separate direct support, provider adapters, and the rest of SOW 2 remain tracked in their own rows.

## Direct fan support implementation chunk

Started 15 October 2026 from `a00d98d`. Covers D2-06, D2-07 and support integration in D3. Fan support transfers the exact selected USDC amount directly to a registered recipient. It does not create a purchase, subscription, royalty allocation, treasury payout, or change protected treasury authorization.

- [x] SUP-01 Define artist and contributor destinations, exact amounts, immutable transaction identity, and truthful recovery states.
- [x] SUP-02 Add retained payment records, append-only events, migration, and database integrity checks.
- [x] SUP-03 Resolve public artist and registered contributor destinations on the server.
- [x] SUP-04 Prepare a single exact USDC payment after account, trustline, capacity, fee, and balance checks.
- [x] SUP-05 Verify real wallet signatures against the exact prepared transaction and source account authorization.
- [x] SUP-06 Persist submission before sending, reconcile the original hash, and prevent duplicate or uncertain-outcome replacement.
- [x] SUP-07 Add artist and track contributor support controls with a short review and explicit signing action.
- [x] SUP-08 Show sent and received history, automatic status, and confirmed explorer receipts.
- [x] SUP-09 Verify database concurrency, invalid recipients, changed signatures, wrong network, failures, cancellation, expiry, and idempotent retries.
- [x] SUP-10 Complete real wallet Testnet artist and contributor journeys and independent balance/receipt reconciliation.
- [x] SUP-11 Verify deployment, migrations, worker operation, and package the evidence.
- [ ] SUP-12 Record reviewer acceptance separately.

### Direct support completion checkpoint, 15 October 2026

SUP-01 through SUP-11 are complete at implementation commit `2dbca88`. E6 records two real Dynamic Sandbox payments on Stellar Testnet, exact recipient balances and network fees, cancelled authorization with zero submissions, user history, admin events, and 11 separate PostgreSQL checks. The full suites passed 119 server, 96 client, and 16 admin tests, with nine opt-in server suites skipped. Workspace typecheck and all production builds passed.

All three Railway services run the implementation commit. Both Vercel frontends are ready. The support migration and immutable audit triggers are present, readiness and route access checks pass, the financial worker started, and the deployed browser opens the Support dialog. A private backup preceded rollout. Existing users, recordings, releases, agreements, royalty records, and settlement batches match the pre-deployment audit. No support fixtures or payments were inserted into production. Live authentication remains unchanged.

SUP-12 remains reviewer acceptance. This completes the direct-support chunk, not the entire SOW 2. Remaining agreement interface evidence, provider readiness, and deliverable acceptance retain their own checklist items above.

## Agreement lifecycle implementation plan

Planned 17 October 2026 against `bba39eb`. This chunk completes the creator and admin agreement experience and its current browser evidence. It covers D2-01, D2-03, and D2-10, verifies the existing D2 consent and treasury controls, and closes the related D3 interface and recovery gaps. It does not expand into fiat providers, new settlement contracts, unrelated release redesign, or general platform hardening.

The completion target is one understandable journey from a recording to an active agreement, including rejection, dispute resolution, fresh consent, and preserved history. Replace conflicting UI and code in the same change. Keep valid signatures, financial records, and historical evidence.

### Baseline and known gaps

- [x] AGR-01 Inspect the existing creator, admin, service, repository, signature, chain, and test implementations.
- [x] AGR-02 Inspect the deployed entry points through computer use and save a dated baseline.

[Computer-use baseline](contributor-agreements-evidence/lifecycle-review/baseline.json) records read-only checks on 17 October. The creator route displays a sign-in instruction. The admin route redirects to authentication and presents first-admin setup. No account, agreement, signature, or transaction was created. These checks do not establish the authenticated lifecycle.

Source inspection establishes the following starting points:

| Area | Current behavior | Work required |
| --- | --- | --- |
| Creator entry | `/account/agreements` exists in the account and Studio navigation. No recording-level agreement entry was found. | Open or create the agreement from its recording. Retain account access for listener contributors. |
| Creation and review | One large component handles the list, editor, review, responses, and history. Contributors are entered by wallet. Listener views can show a raw track ID because titles come from owned tracks. | Separate the tasks, resolve registered identities, and return authorized recording context from the server. |
| State changes | Initial loading and explicit actions fetch data. There is no periodic refresh in either agreement screen. | Keep cross-user responses and finalization status current without a manual refresh requirement. |
| Admin finalization | Exact transaction download, signature import, two-signature submission, and a manual outcome check exist. | Keep exact signature checks. Make pending progress and automatic reconciliation visible. |
| Worker | The financial worker scans support and settlements, but does not scan agreement finalizations. | Add retained-attempt reconciliation and bounded recovery for agreement publication. |
| History and access | Versions and events are retained. Membership in any version currently grants agreement detail access. | Define and test version visibility, including removed contributors and unpublished drafts. |
| Existing verification | Domain, PostgreSQL, component, and prior real Dynamic evidence already exist. | Extend focused tests and perform the complete current creator and admin journey. Do not replace real-wallet evidence with mocks. |

### Intended user flow

1. The owner opens a recording and selects **Royalty agreement**. An existing agreement opens directly. Otherwise, the recording is already selected.
2. The owner selects registered contributors, roles, percentages, and any additional terms. Each contributor appears once. A visible total must reach exactly 100%.
3. The owner saves a draft, reviews one summary, and sends the proposal. Sending fixes that version. Each included wallet, including the owner's when included, must independently consent.
4. A contributor opens **Royalty agreements** from their account. They see the recording title, owner, complete split, their share, terms, and one clear next action.
5. **Accept and sign** requests the exact wallet authorization. **Reject** and **Raise dispute** reveal a reason field only when selected. Cancelling signing records no response.
6. A rejected or disputed version blocks finalization. The owner can revise it with a reason. A super admin can record a resolution and create an owner-controlled revised draft. Neither path creates consent.
7. The owner reviews and sends the revision. Every included contributor signs the revised version again. An existing active version stays active during this process.
8. Once consent is complete, a super admin reviews the exact proposal and prepares finalization. Two independent treasury signers authorize the same transaction before submission.
9. The worker verifies the receipt and registry state. Both interfaces automatically show **Active** only after confirmation. History identifies each version, response, resolution, and receipt.

Use a list page and a shareable detail URL for each agreement. Keep the existing account and admin entry points. Add optional recording context to creation. Refreshing a detail URL must restore the same agreement and selected version.

### Implementation order and checklist

Complete each phase with its focused checks before proceeding. Update these boxes with the tested commit and evidence when the work passes.

#### Phase 1. Establish the verification environment and response contracts

- [x] AGR-03 Restore an isolated local PostgreSQL, API, client, admin, and financial worker using the existing review setup. Preserve prior demonstration receipts. Use Dynamic Sandbox and Stellar Testnet only for mutable verification.
- [x] AGR-04 Prepare an owner, a registered listener contributor, an outsider, an ordinary admin, a super admin, and three independent Testnet treasury signers. Verify network, registry, thresholds, and required balances. Use the ordinary application sign-in flows.
- [x] AGR-05 Define typed summary and detail responses with authorized recording title, owner identity, contributor identity, current version, active version, response status, and next permitted actions. Keep display metadata outside the signed canonical proposal.
- [x] AGR-06 Define and enforce visibility by role and version. Owners and authorized admins can inspect the full record. Contributors retain versions they participated in. Historical membership alone must not reveal future proposals they were removed from. Keep unrelated wallets out. Do not change valid historical consent.

#### Phase 2. Make creation and review straightforward

- [x] AGR-07 Add a recording-level agreement action and persistent list/detail routes. Existing agreements open directly instead of offering duplicate creation. Preserve navigation and browser Back behavior.
- [x] AGR-08 Replace the combined creator screen with focused list, editor, review, and detail components using the established form and layout components. Keep one primary action per task.
- [x] AGR-09 Add authenticated registered-contributor lookup by name or exact wallet. Show the resolved name, role, and wallet for confirmation. Reuse selected recording credits where useful without assigning shares or consent automatically. Do not expose email addresses or unrelated private profile fields.
- [x] AGR-10 Validate duplicate wallets, registered accounts, roles, positive shares, precision, and the exact 100% total on both client and server. Keep terms and entered values after a failed save. Map validation failures to the relevant fields.
- [x] AGR-11 Implement a recoverable draft and one review summary before sending. Prevent duplicate drafts or revisions after a repeated click or lost response. Recover the existing result before offering another mutation.

#### Phase 3. Complete contributor responses and dispute recovery

- [x] AGR-12 Present an inbox of actionable proposals with recording titles and personal response status. A listener contributor must reach the same review without artist activation.
- [x] AGR-13 Show the complete proposal before signing. Bind the response to its wallet, action, reason, version, hash, challenge, expiry, and network. Preserve scoped Dynamic authorization and provider prompt visibility. Recover response state after an interrupted request before enabling another response.
- [x] AGR-14 Make rejection and dispute separate deliberate actions with a required reason. Remove the always-visible combined reason form. Preserve a prior acceptance when a contributor later disputes an eligible version.
- [x] AGR-15 Complete owner revision and admin resolution paths. Require a reason, preserve the blocked version, create one new draft, and require owner submission plus fresh consent. Serialize concurrent owner and admin actions so they cannot create competing revisions.
- [x] AGR-16 Show the current proposal separately from the active agreement. Verify initial rejection, a dispute before finalization, an accepted contributor's dispute before finalization, and a revised agreement after an active version. Finalized versions remain immutable.
- [x] AGR-17 Add automatic, bounded polling while relevant states are pending. Refresh on focus, stop on unmount, and ignore stale responses after account or agreement changes. Show a compact interrupted-status state with retry when reads fail. Never infer consent or activation from a spinner ending.

#### Phase 4. Finish admin finalization and background recovery

- [x] AGR-18 Refactor admin list/detail views around recording context, consent progress, blocked reasons, active version, and the next allowed action. Keep hashes, XDR, and registry details in an accessible verification disclosure. Ordinary admins remain read-only.
- [x] AGR-19 Preserve prepare, download, and signed-envelope import for treasury signers. Verify the exact envelope, network, source, registry, proposal hash, and two distinct authorized signatures. Duplicate, altered, or outsider signatures cannot increase the count. Do not add a server-held signing key.
- [x] AGR-20 Add agreement finalizations to the financial worker with per-attempt serialization, fair scheduling, and isolated errors. Persist authorization and submission intent before network calls. Reconcile the original hash after timeouts or restarts. Bound retries of the same envelope and prevent replacement while the outcome is uncertain.
- [x] AGR-21 Preserve chain-based expiry and history coverage checks. Confirm exact receipt and registry contents before changing the active version. Failed attempts retain evidence and allow a new attempt only after a verified terminal outcome. Add additive migrations only for fields or indexes the worker actually needs.
- [x] AGR-22 Display automatic finalization progress and confirmed receipts in both interfaces. A cancelled signer prompt or incomplete threshold must leave the proposal inactive. Remove normal dependence on **Check transaction outcome**.

#### Phase 5. Finish history, UX, and regression verification

- [x] AGR-23 Present a compact version history with full prior terms, shares, responses, reasons, resolution records, timestamps, actors, and receipts available on demand. Human-readable names supplement immutable wallet identity.
- [x] AGR-24 Inspect creator and admin screens at desktop and 390-pixel mobile widths through computer use. Check long titles, wallets, terms, validation, keyboard focus, provider overlays, loading, empty states, and interrupted requests. Fix overflow, inconsistent spacing, and repeated explanations.
- [x] AGR-25 Extend domain, HTTP, PostgreSQL, worker, client, and admin tests for changed behavior. Run workspace typecheck and production builds. Verify settlement still consumes the exact confirmed version and historical entitlements remain unchanged. Verify support remains independent.
- [x] AGR-26 Execute the complete computer-use matrix below. Save evidence for each scenario, including browser-visible results and independent service or chain checks. Close real-wallet gaps rather than relabeling mocked results.

#### Phase 6. Roll out and close the chunk

- [ ] AGR-27 Back up production before any migration. Deploy the API, financial worker, and both affected frontends. Deploy other services if shared runtime or schema changes require it. Verify migrations, worker startup, readiness, CORS, authorization, exact source commits, and existing-record preservation.
- [ ] AGR-28 Verify deployed creator and admin navigation, detail deep links, and access boundaries through computer use. The current live admin page requires initial setup. Complete legitimate operator setup before claiming authenticated production verification. Use the isolated environment for destructive scenarios and synthetic agreements.
- [x] AGR-29 Package results under `docs/contributor-agreements-evidence/lifecycle-review/`. Reconcile overlapping D2 and D3 checklist rows against actual evidence. Keep unverified items open. Record reviewer acceptance separately.

### Required computer-use verification matrix

Drive the real rendered client, admin, and Dynamic prompts with the computer-use tool. Use CLI helpers for disposable setup, failure injection, treasury signatures held outside the server, and independent database or chain inspection. Helpers must not substitute for the creator actions being demonstrated. Never inject a session into browser storage, fabricate a contributor response, or count a mocked wallet as a real signature.

| ID | Browser journey | Required visible and independent result |
| --- | --- | --- |
| CU-01 | Open a recording, create a 70/30 proposal, save, reload, review, and send. | The recording is preselected, values persist, exactly one agreement exists, and the submitted version is fixed. Both roles see the correct recording title. |
| CU-02 | Enter duplicate or unknown wallets, invalid shares, excess precision, and a total other than 100%. | Inline correction is clear. No invalid draft or proposal is saved. A valid correction succeeds without re-entering unrelated fields. |
| CU-03 | Open the proposal as the listener contributor and sign acceptance. Independently sign as the included owner. | Actual Dynamic prompts authorize the exact version. The other screen updates automatically. Consent records verify against the real linked wallets. |
| CU-04 | Cancel the provider prompt, then retry the response. Interrupt the HTTP response after a successful save. | Cancellation records no consent. A lost response recovers the existing result. Retrying cannot duplicate consent or events. |
| CU-05 | Open a separate proposed agreement as a contributor, reject it with a reason, then revise it as owner. | The reason and rejection remain in history. Finalization is blocked. The revised draft has no carried-over consent and is sent by its owner. |
| CU-06 | Accept a proposed version, then raise a dispute before finalization. Inspect it as admin. | Original acceptance and later dispute are both retained. Finalization is blocked and the reason is visible to authorized participants. |
| CU-07 | Record a resolution as super admin, return to owner, edit the revised draft, and send it. | Resolution creates a draft, not acceptance or activation. Fresh real Dynamic signatures are required from all included contributors. |
| CU-08 | Open the admin review with incomplete consent, then with complete consent. Add one treasury signature and then a second distinct signature. | Incomplete consent and one signature cannot finalize. Two verified signatures for the same exact transaction enable submission. Normal admin access cannot operate finalization. |
| CU-09 | Submit finalization and leave both screens open. | Pending state is visible. The worker confirms the original hash. Both screens show the active version and a real receipt without a manual status check. Registry data matches every approved term and recipient. |
| CU-10 | Interrupt submission, close a tab, restart the worker, then reopen the detail URL. | The retained attempt resumes by its original identity. No replacement or second publication is created while unresolved. Each confirmed outcome has one activation event. |
| CU-11 | Let an unsigned attempt expire. Separately inject missing or pruned transaction history in an isolated automated fixture. | Proven expiry permits a new attempt. Incomplete history remains unresolved. The UI does not falsely show failure or activation. Record the simulated transport case separately from real-chain evidence. |
| CU-12 | Amend an active 70/30 agreement to 60/40 and complete new consent and treasury confirmation. | The old agreement stays active until confirmation. Earlier signatures do not authorize the amendment. Historical versions and funded entitlements remain unchanged. |
| CU-13 | Open direct URLs as a signed-out user, outsider, removed contributor, ordinary admin, and super admin. | Correct sign-in and permission boundaries hold. A former contributor retains permitted history without reading a future version they are excluded from. Server checks enforce the same rules. |
| CU-14 | Review history, refresh a deep link, use browser Back, and complete representative actions on mobile and by keyboard. | The selected agreement is recoverable, actions are reachable, long content stays within the viewport, and focus returns correctly after a prompt or dialog. |

Use separate disposable recordings where mutually exclusive branches require them. Do not repeatedly reset an immutable proposal to reuse a fixture. Test races, altered signatures, audit rollback, and unauthorized HTTP mutations through focused automated checks as well as visible role checks.

### Evidence and completion rules

For every matrix row, record the date, source commit, environment, actor role, browser path, expected result, observed result, screenshot, and independent check. Include agreement IDs, version hashes, finalization hashes, ledgers, and explorer links when applicable. Keep passwords, tokens, OTPs, callback codes, and private keys out of the evidence.

The final evidence set must include a baseline, dated scenario results, desktop and mobile screenshots, real Dynamic consent proof, two-signer finalization receipts, registry read-back, historical entitlement comparison, automated test results, and deployment verification. Classify each result as real browser and chain, mocked transport, or unverified. Existing E1, E2, E5, and E6 remain supporting evidence with their original dates.

This chunk is complete only when AGR-03 through AGR-29 and the applicable CU scenarios pass. A written plan, successful build, manually seeded final state, or historical screenshot does not establish completion. If real authentication or signing is unavailable, continue independent implementation and testing, record the exact remaining gap, and leave its verification box open. Reviewer acceptance and broader SOW 2 completion remain separate.

### Agreement implementation checkpoint, 17 October 2026

The local review database, API, client, admin, and financial worker are restored. Authorized summary/detail responses now contain recording and registered contributor names without changing signed proposal data. Version-level visibility excludes unpublished drafts and future proposals from removed contributors. Fifteen agreement checks and ten finalization checks passed against disposable PostgreSQL, with mocked chain transport in the latter suite. Server typecheck passed. Current browser lifecycle and rollout verification remain open.

### Agreement lifecycle verification checkpoint, 17 October 2026, 14:34 UTC

Commits `04096bb`, `882c231`, and `889113a` implement the authorized response contracts, routed creator and admin screens, and retained-attempt worker. Open Sky version 1 was created and sent through the creator UI. Both independent Dynamic Sandbox wallets signed it; two external Testnet treasury signatures were imported through admin. The first signature left submission disabled. The second enabled it. The UI automatically confirmed transaction `b199ee8b29fedf4c944a3ac4a88a78e97eb8b1dedd472006caccc5edea70857c` and the database now records effective version 1.

The browser download capture timed out. Verification used the exact prepared XDR displayed by the admin verification disclosure, followed by real file imports. Successful browser download capture is not claimed. The setup-helper incident and production record audit are recorded in [setup verification](contributor-agreements-evidence/lifecycle-review/setup-verification.json). Production admin setup, remaining lifecycle branches, responsive inspection, and rollout are still open.

### Agreement lifecycle verification checkpoint, 17 October 2026, 14:52 UTC

The browser has exercised rejection, an accepted contributor's later dispute, super-admin resolution, owner editing and resubmission, independent fresh consent, and a 70/30 to 60/40 active amendment. Exact on-chain registry checks and original funded entitlement hashes are saved in the lifecycle evidence directory. A local API crash after committed submission intent recovered attempt `86f679c4-ed49-457f-b993-d58840c1b2ee` by its original hash, with one activation event and no replacement attempt. A local proxy then dropped one successful consent response; the actual browser recovered the recorded response without requesting a second signature.

Independent review found and prompted fixes for random-UUID attempt selection and expired challenge retries (`2a71a1e`). The final focused runs passed 13 creator, 8 admin, 17 PostgreSQL agreement, and 10 PostgreSQL finalization checks. The full baseline suite passed 121 server, 105 client, and 17 admin checks, with nine server checks skipped in its default environment; the PostgreSQL suites ran separately. Workspace typecheck and production builds passed. Mobile admin navigation was fixed after actual 390-pixel inspection (`bc181c1`).

Railway API, financial worker, and media worker report successful deployments of `2a71a1e`. The client deployment is ready; the final mobile-admin deployment is still being checked. Production application and financial table hashes match the audit before rollout. Authenticated production admin verification remains pending legitimate first-admin setup. The early additive migration is a documented rollout exception, not a passed backup-before-migration check.

### Agreement lifecycle handoff, 17 October 2026

E7 now records all CU-01 through CU-14 checks, including the exact observations and transport limits. The final UI suites passed 106 client and 18 admin tests. Real provider cancellation returns keyboard focus to the agreement heading (`11c38a4`). The XDR download capture timeout was investigated: the actual file exists in Downloads and matches the prepared 1,900-byte transaction exactly. This supersedes the earlier uncertainty about download completion.

AGR-27 remains open as a rollout exception: the early additive migration occurred before the fresh backup; the earlier 15 October backup and unchanged-record audit are retained. Deployment and runtime checks passed. AGR-28 remains open because the live admin service requires first-admin setup. An existing Live listener signed in normally and reached the deployed inbox. No synthetic production agreement or financial transaction was created. AGR-29 packages these results and explicitly leaves reviewer acceptance and broader SOW completion open.


## Core D3 lifecycle closure

Started 17 October 2026 at `9cd39f0`. Verify the core music-to-earnings journey locally with Dynamic Sandbox and Stellar Testnet. Provider onboarding, fiat cash-out, production changes, and external reviewer acceptance are outside this goal. Preserve the separate cash-out working tree.

- [x] CORE-01 Inspect E4 through E7, identify remaining integration evidence, and confirm the isolated client, admin, API and financial worker are running. Earlier settlement funding used synthetic earnings sources; a real listener purchase through recording publication, ledger recognition, settlement and claim remains to be demonstrated together. Existing consent, support, amendment and recovery evidence remains supporting evidence with its original date.
- [x] CORE-02 Create or publish a local verification release through the creator UI with playable audio, sale settings and a valid finalized agreement. The actual admin UI confirmed publication hash `8a5a6860e54c615cb8ac5973a97ff8b0953c1fd473626d219ab576bd61ddfa21` after two independent external signatures. The owner enabled sales at exactly 0.001 USDC through the new track sales form. Browser purchase remains CORE-03.
  - [x] CORE-02a Publish `Core Journey` through the actual five-step creator flow using a synthetic WAV and existing repository artwork. Release `rel_f8f84266f7314b02`, recording `trk_810ef0432acc4b44`; screenshot `docs/core-lifecycle-evidence/release-published.png`.
  - [x] CORE-02b Obtain independent real Dynamic Sandbox consent from Ngoni and Kwame for nonbinding 70/30 agreement `7186e534-47db-4d05-9c2f-1bee561cc67e`. The ordinary admin sees read-only consent. One treasury signature left finalization disabled; two enabled it and confirmed the exact Testnet publication.
- [x] CORE-03 Completed actual Dynamic Sandbox purchase `pay_58803ad973d64988`, exact 0.001 USDC, hash `a28b10da421be9242492416cf8eadc2345807fb7cf647ee7291d67190fbbfc71`. The backend retained authorization before an injected API crash and lost response. With the buyer tab closed, the restarted financial worker submitted the original hash once and recorded 0.0007/0.0003 USDC against the captured agreement. Review cancellation and abandoned provider authentication sent nothing; the unsigned attempt expired after chain-history verification. Reopening shows Purchased. Exact balances and receipts are being packaged under CORE-07.
- [x] CORE-04 Verify that direct artist and contributor support remains separate from purchases and royalty settlement. Current contributor history and admin support screens retain E6's actual artist receipt `564e96041b61f166496014fd188b70d9371b9fc0e502e2a11e90f3a98dd497f8` and contributor receipt `4fba178c9ba2f838fff5752925e9bdcb146795bebb9f63eba222974d911c1fcd`. Their amounts remain 0.001 USDC each. Screenshots are in `docs/core-lifecycle-evidence/`. This reuses E6's real transfers, not new support transactions. Generated-key transport fixtures in the same disposable database are not actual chain receipts.
- [x] CORE-05 Admin preview and two-signer funding used the actual purchase source. Both real Dynamic beneficiaries claimed 0.0007 and 0.0003 USDC. Independent SDK and Horizon checks verified receipt hashes, sources, fees, wallet deltas, captured agreement, both paid entries and the closed batch. The separate 0.01 USDC escrow obligation remains intact. E8 records every hash and contract claim identifier.
- [x] CORE-06 Verified review cancellation, abandoned authentication, lost committed authorization response, API restart and worker completion with the browser closed. Automated checks reject changed envelopes, other wallets, wrong networks and signers, duplicate preparation, unverifiable expiry and replay. Fixed durable checkout, exact price and memo, captured royalty agreement, purchase ownership display, incoming artist sales and release context preservation. E8 discloses the provider OTP dismissal limitation. E5 through E7 retain their original separate results.
- [x] CORE-07 Packaged E8 screenshots, browser results, independent chain checks, interruption evidence and a recoverable working-tree checkpoint at base `9cd39f0`. Workspace tests, typecheck and builds pass. Real PostgreSQL checkout and financial regression suites passed 44 checks with no skips. Parent D3 technical evidence is updated below. Production rollout, its commit/deployment package and reviewer acceptance remain open.

The goal was created successfully. The connected Linear search still returns no Music City project or issue; no external ticket update is claimed. Track completion in this existing canonical document as explicitly requested by the project owner.

## Creator cash-out implementation plan

Planned 17 October 2026 against `9cd39f0`, following the provider research in this conversation. This is the first implementation chunk for the separately scoped fiat provider readiness work in section 4.2. The outcome is one complete cash-out journey for one confirmed country, currency, payout method, and provider.

This chunk covers the off-ramp adapter, transaction mapping, status and failure handling, and sandbox evidence. On-ramp payments remain a later chunk. Production activation, real-money testing, and broader SOW acceptance remain separate decisions. Complete functional acceptance locally with Dynamic Sandbox, Stellar Testnet, and the selected provider's sandbox. Live admin setup from the agreement chunk is not a prerequisite.

### Confirm the provider and first payout market

The launch market and payout method are still undecided. Use these researched options to make the decision:

| Candidate | Relevant evidence | Decision condition |
| --- | --- | --- |
| MoneyGram Ramps | Its current non-custodial Stellar integration uses server-created sessions, a hosted widget, and wallet-signed USDC transfers. New partners use the widget and API-key path. | Prefer for cash pickup if the exact country, payout currency, user eligibility, and Music City use case are supported. Obtain partner sandbox keys and an approved browser origin. |
| Yellow Card | Its channel documentation lists South African bank-transfer and EFT payouts. Its direct-settlement API describes crypto-funded local payouts. | Consider for South African bank payouts only after verifying the enabled Stellar USDC funding route, KYC responsibilities, and account-specific channels. Its current restrictions explicitly exclude Zimbabwe. |

Provider-wide country coverage does not establish support for the required asset, network, payout method, or customer. Confirm that complete combination through the selected provider. Record fees, exchange-rate spread, minimums, limits, quote lifetime, and refund behavior for representative artist payout amounts. Do not promise a settlement time from a general marketing page.

Research sources checked on 17 October 2026:

- [MoneyGram Stellar web integration](https://xramps.moneygram.com/ops/developer/guides/web-stellar).
- [MoneyGram partner access and environments](https://xramps.moneygram.com/ops/developer/getting-started).
- [MoneyGram transaction status and webhooks](https://xramps.moneygram.com/ops/developer/reference/transaction-status-webhooks).
- [Yellow Card channels](https://docs.yellowcard.engineering/docs/channels-api).
- [Yellow Card country restrictions](https://help.yellowcard.io/articles/6362178041-countries-and-regions-we-do-not-support).
- [Yellow Card crypto-funded local payouts](https://docs.yellowcard.engineering/docs/direct-settlement).
- [Yellow Card sandbox testing](https://docs.yellowcard.engineering/v1.0.36/docs/sandbox-testing-api).

Recheck these sources and enabled account capabilities when selecting the provider. Sandbox availability and commercial approval are not established by this plan.

### Follow the ownership and payout lifecycle

The existing settlement contract pays a claim to its beneficiary wallet. Keep that authorization and fixed destination. A subsequent cash-out transfers wallet USDC to the selected provider with the user's authorization. A provider payment failure cannot undo a valid earnings claim or mark that claim unpaid.

The user journey is:

1. The creator opens Revenue and sees claimable earnings separately from spendable wallet USDC.
2. If earnings remain in escrow, the creator uses the existing claim flow. After confirmation, those funds become available in the wallet.
3. The creator selects **Cash out**, chooses an eligible destination or pickup location, and enters an amount.
4. The provider completes required identity checks and supplies a quote. The creator sees the USDC amount, all quoted fees, the local amount to receive, and the expiry before authorizing payment.
5. The creator authorizes the exact Stellar transfer through their linked Dynamic wallet. Cancelling this prompt sends no payment.
6. The app follows the transfer and provider status in the background. Closing the page does not lose the transaction.
7. For cash pickup, show the pickup reference and instructions only when the provider confirms readiness. Show collection separately from readiness. For bank payouts, show payment completion only after provider confirmation.
8. If the provider returns funds, show a confirmed refund separately from a request for a refund. Keep unresolved outcomes visible and recoverable.

Use concise copy and one primary action per stage. Reuse the provider's hosted identity flow where available. If the chosen integration requires Music City to supply identity data, settle the verification and data-handling requirements before implementing that path.

### Implementation order and checklist

Keep every item unchecked until its implementation or decision has evidence. Record the source commit and verification result as work completes.

#### Phase 1. Validate access and prove one real provider flow

- [ ] CO-01 Confirm the first country, payout currency, payout method, and eligible customer group with the project owner.
- [ ] CO-02 Select one provider using verified corridor coverage, Stellar USDC support, pricing, limits, identity requirements, refund behavior, and partner eligibility. Record unresolved commercial conditions.
- [ ] CO-03 Obtain legitimate sandbox access and approve a local development origin or provider-supported development URL. Keep sandbox and production credentials separate. Do not create accounts, accept agreements, or contact providers without the required user authorization.
- [ ] CO-04 Complete a small feasibility integration using the current supported API. For MoneyGram, use the non-custodial widget and API-key path, not its legacy direct SEP integration. Prove that Dynamic can authorize the required Stellar transaction and memo.
- [ ] CO-05 Capture a genuine provider sandbox transaction, its Stellar Testnet evidence where supported, its provider reference, and its actual status progression. Record which outcomes the provider simulates. Proceed to the full implementation after the corridor and integration are proven.

If access is unavailable, finish applicable design and automated failure checks, record the exact missing access, and leave CO-03 through CO-05 open. A local simulator does not establish provider sandbox completion. Public provider documentation and local test results can support progress without production onboarding.

#### Phase 2. Define and persist the cash-out transaction

- [x] CO-06 Define shared request, quote, transaction, and status contracts. Include the authenticated wallet, environment, provider, country, currency, payout method, amount, fees, quote expiry, provider IDs, and chain attempt IDs. Keep money in exact integer units or validated decimal strings. Implemented in `packages/shared/src/cashout.ts`; see the 17 October implementation checkpoint below.
- [ ] CO-07 Add additive migrations for cash-out transactions, chain attempts, and immutable events. Keep provider records separate from earnings allocations and existing claim records. Link a cash-out to its source wallet and any associated claim without rewriting settled earnings.
- [ ] CO-08 Implement one provider integration behind a small cash-out interface. Validate active capabilities and limits before creating a request. Keep provider-specific IDs and original statuses alongside normalized app states.
- [ ] CO-09 Create provider sessions server-side and bind them to the authenticated user's wallet. Authorize all quote, detail, resume, and status routes. Verify that a session for one wallet cannot open another wallet's transaction.
- [ ] CO-10 Persist quotes and user intent before requesting a signature. Serialize duplicate create and submit requests. Recover a saved transaction after a lost HTTP response. Requote expired terms and require renewed confirmation when the amount or destination changes.

#### Phase 3. Authorize the transfer and recover its outcome

- [ ] CO-11 Build or validate the exact transfer against trusted server-side provider instructions. Check the source wallet, Stellar network, USDC issuer, destination, memo type and value, amount, allowed operations, fee bounds, and time bounds. Treat widget messages as untrusted input and validate their origin and active session.
- [ ] CO-12 Reuse scoped Dynamic wallet authorization. Keep the provider prompt visible and preserve the user's place when signing is cancelled. Check the wallet balance and network fee readiness without suggesting an unsupported payout.
- [ ] CO-13 Persist the signed envelope, hash, and submission intent before sending. Recover the original hash after a timeout or restart. Do not create another transfer while the prior outcome is uncertain. Prove terminal expiry or failure before permitting a replacement.
- [ ] CO-14 Add cash-out reconciliation to the financial worker. Poll within provider rate limits, retry transient errors with backoff, and isolate failures between transactions. Keep progress independent of the browser.
- [ ] CO-15 Verify provider callbacks using the supported authentication mechanism and raw payload rules. Deduplicate events, reject unrelated transactions, and confirm authoritative provider status before changing financial outcomes. Reconcile missed or out-of-order callbacks through the status API.
- [ ] CO-16 Implement the selected provider's full state map, including required identity action, expired quote, transfer pending, provider processing, pickup readiness or bank payout, collected or paid, failure, refund pending, refunded, and refund failure. Preserve unknown statuses for investigation without reporting success.
- [ ] CO-17 Verify refunds to the approved user wallet and distinguish a refund request from confirmed return of funds. Preserve the original transfer, payout, and refund references. Define recovery for each supported point of failure before exposing the flow to users.

#### Phase 4. Complete creator and admin interfaces

- [ ] CO-18 Add **Cash out** to Revenue for eligible spendable wallet funds. Keep claimable earnings and wallet funds distinct. Display supported payout options openly and explain an unavailable option with one actionable reason.
- [ ] CO-19 Build a compact amount, quote, review, and authorization flow. Display the amount the user receives, total fees, destination, expiry, and required identity action before payment. Keep technical transaction details in a disclosure.
- [ ] CO-20 Show automatic progress, pickup instructions or payout receipt, and recoverable failures. Restore the same transaction from a detail URL after reload or sign-in. Keep the user from signing again when a transfer was already submitted.
- [ ] CO-21 Add an authorized admin cash-out list and detail view with provider status, chain receipt, event history, and reconciliation exceptions. Keep ordinary admins read-only. Add no server-held user signing key or single-admin override for protected treasury actions.
- [ ] CO-22 Inspect creator and admin screens through computer use at desktop and 390-pixel widths. Verify keyboard access, provider overlay visibility, focus return, concise copy, empty states, validation, and slow or interrupted requests.

#### Phase 5. Verify and package local acceptance

- [ ] CO-23 Add contract-validation and provider-mapping tests for amounts, limits, stale quotes, unsupported markets, altered transfer instructions, callbacks, and complete status transitions. Use explicit provider fixtures for simulated transport cases.
- [ ] CO-24 Add isolated PostgreSQL checks for duplicate requests, lost responses, concurrent submissions, immutable audit events, worker restarts, cross-user access, and preserved earnings and claim history.
- [ ] CO-25 Run the browser matrix below against the actual local client, API, admin, and worker. Use real Dynamic Sandbox signing and the real provider sandbox for integration acceptance. Keep synthetic identities and funds out of production.
- [ ] CO-26 Run affected suites, workspace typecheck, production builds, and fresh-database migrations. Verify that agreements, claims, settlements, and direct support retain their existing behavior.
- [ ] CO-27 Package the provider decision, capability evidence, dated test results, browser screenshots, transaction references, Testnet receipts where applicable, and remaining provider conditions. Update the parent provider-readiness checklist only for requirements actually covered.

Local acceptance completes this implementation chunk. Production enablement requires a separate rollout decision covering provider approval, credentials, country eligibility, and deployment. This plan does not require live admin setup or real-money transactions to pass local acceptance.

### Required local browser and failure matrix

| ID | Scenario | Required result |
| --- | --- | --- |
| CASH-01 | Open Revenue with unclaimed earnings, then claim through the existing flow. | Escrow earnings and spendable wallet funds remain distinct. The confirmed claim pays only its beneficiary and appears once. |
| CASH-02 | Open cash-out for a supported market and an unsupported market. | Eligible methods and limits match provider capabilities. Unsupported combinations cannot create a payable request. |
| CASH-03 | Enter an amount below the minimum, above the limit, above the wallet balance, and with excess precision. | Clear inline correction. No invalid quote or transfer persists. Valid corrections retain the user's other fields. |
| CASH-04 | Complete the provider's identity and quote flow. Let the quote expire, then request another quote. | Review shows current fees, local proceeds, destination, and expiry. Changed terms require fresh confirmation. |
| CASH-05 | Open the real Dynamic prompt, cancel, then retry. | Cancellation records no payment. Retry uses a valid quote and restores keyboard focus correctly. |
| CASH-06 | Authorize a genuine sandbox cash-out through the selected provider. | Exact wallet, asset, network, destination, memo, amount, and receipt match the approved request. Record provider simulations separately from chain confirmation. |
| CASH-07 | Close the browser after submission, restart the local API and worker, and reopen the transaction. | The original transaction resumes by its existing identity. No duplicate transfer or payout request appears. |
| CASH-08 | Lose an HTTP response and deliver duplicate or out-of-order provider notifications. | One authoritative transaction and event history remain. Missed notifications recover through reconciliation. |
| CASH-09 | Observe provider processing, readiness, and completion. | MoneyGram pickup readiness remains distinct from cash collection. A bank payout is paid only after the provider confirms payment. A chain transfer alone does not complete the payout. |
| CASH-10 | Exercise provider failure after funding and its supported refund process. | No replacement payment starts while the outcome is unknown. Refund pending, confirmed return, and refund failure remain distinct. Earnings claim history stays unchanged. |
| CASH-11 | Open another user's detail URL or send an unauthorized mutation. Send forged widget messages and callbacks. | Both interfaces and server checks reject the action. No unauthorized transfer, session disclosure, or financial status change occurs. |
| CASH-12 | Complete representative actions on mobile and by keyboard. Reload a detail URL and use browser Back. | Controls remain reachable, overlays fit, focus returns, and the same transaction is recoverable. |

Use local fault injection for interrupted network calls, forged payloads, pruned chain history, and restart races. Label those results separately from actual provider sandbox behavior. A provider sandbox may simulate cash collection or bank settlement. Record that limit rather than claiming physical collection or a real bank receipt.

### Completion evidence

For each CO item and CASH scenario, record the date, source commit, environment, actor, expected result, observed result, and evidence location. Include provider transaction IDs, chain hashes, event counts, and refund references where applicable. Keep private keys, session tokens, identity documents, bank details, and credentials out of public evidence.

This chunk is complete when CO-01 through CO-27 pass, every applicable CASH scenario has evidence, and all provider-specific gaps are explicit. An unavailable sandbox, mocked provider response, ready deployment, or completed Stellar transfer alone does not prove the cash-out journey. Reviewer acceptance, the on-ramp implementation, and production activation remain separate.

### Implementation checkpoint, 17 October 2026

The working tree on `main` at `9cd39f0` contains the first cash-out implementation slice. Fetching `origin` confirmed no newer commits. These changes are not committed or deployed.

CO-06 is complete. Shared schemas define strict create inputs, wallet-bound session records, exact quote amounts and fees, provider and correlation references, separate claim and chain references, normalized states, and transfer instructions. A create input cannot supply a wallet, user, provider, environment, or status. Session creation and route authorization remain CO-09 work.

`server/src/modules/cashout/cashout-transfer.ts` also implements part of CO-11: one USDC payment bound to a quote, cash-out identity, wallet, network, issuer, memo, amount, fee ceiling, and a lifetime of at most five minutes. Signed envelopes must match the prepared hash and satisfy the source account's signer threshold. The module does not fetch provider instructions, persist attempts, submit transactions, or expose an API. Provider response authentication and widget validation remain open, so CO-11 is unchecked.

Verification passed 12 cash-out domain tests, 133 server tests, 106 client tests, and 18 admin tests. Nine existing database-dependent server tests were skipped by the default suite. Workspace typecheck and production builds passed. The cash-out fixtures are local test data and do not establish an approved country, available provider, signed Dynamic flow, or provider sandbox transaction.

CO-01 through CO-05 remain open pending the owner's first-market decision and legitimate provider sandbox access. No provider environment variable names were found in the repository's environment files or the local Music City verification environment files. No Music City Linear project was found through connected search. The goal tool rejected a new goal because the earlier agreement goal remains unfinished; that goal was not marked complete to bypass the restriction.

The owner supplied the public developer-reference OAuth example for a direct sandbox check. On 17 October, the exact GET request returned HTTP 401 without an access token. GET and POST with canonical Base64 padding also returned HTTP 401, with gateway code `G900` and message `AccessControl_voilation`. This establishes that these requests did not obtain access; it does not distinguish credential rejection from gateway access restrictions. No token or credential was saved. The authorization value matches the example in the [OAuth reference](https://developer.moneygram.com/moneygram-developer/reference/getaccesstoken). The [current Stellar Ramps setup](https://xramps.moneygram.com/ops/developer/getting-started) separately requires partner sandbox keys and an allowed browser origin. CO-03 remains open.
