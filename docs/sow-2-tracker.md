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
| D2. Contributor agreements and treasury controls | Partial. Agreement services and protected registry finalization have historical Testnet evidence. Current Dynamic browser consent and protected settlement operations passed in E5. Direct artist and contributor support passed real Dynamic Testnet verification in E6. | Complete remaining agreement UI evidence and obtain reviewer acceptance. |
| D3. Product integration, operations, reconciliation, and verification | Partial. Creator and admin agreement screens, release flows, API migrations, and deployment evidence exist. | Settlement integration, failure recovery, deployment, and evidence are complete in E5. Direct support integration passed in E6. Its rollout is verified. Complete the remaining agreement UI evidence and obtain SOW acceptance. |

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
| D2-01 | Canonical split proposal | Implemented. Versioned proposal, wallet, role, share, terms, track, release context, and hash. Domain and database evidence in E1. | Verify creation and review through the current deployed creator interface. |
| D2-02 | Wallet-signed acceptance | Verified through real Dynamic Sandbox accounts. Four independent provider signatures authorize exact original and amended proposals. Cancellation records no consent. E5. | Reviewer acceptance. |
| D2-03 | Rejection and dispute | Verified historically. Signed responses block finalization. | Capture current creator and admin behavior and actionable recovery. |
| D2-04 | Finalization requires complete consent | Current browser-generated consent and two treasury signatures finalized versions 1 and 2. Earlier effective terms remained active until confirmation. E5. | Reviewer acceptance. |
| D2-05 | Amendments preserve history and require fresh consent | Real Dynamic browser verification preserves the 70/30 entitlement while a 60/40 amendment requires fresh signatures and governs a different source. E5. E2 retains historical dispute coverage. | Reviewer acceptance. |
| D2-06 | Direct fan-to-artist support payments | Implemented. Exact direct USDC payment, Dynamic signature, receipt, balance reconciliation, and retained history verified in E6. | Reviewer acceptance. Rollout verified in E6. |
| D2-07 | Direct fan-to-contributor support payments | Implemented for registered contributors linked to public recordings. Real Dynamic payment to a listener contributor verified in E6. | Reviewer acceptance. Rollout verified in E6. |
| D2-08 | 2-of-3 treasury authorization for finalization | Current dedicated treasury and registries verify thresholds of two. Both Dynamic-consented versions finalized with two distinct signatures. E5. | Reviewer acceptance. |
| D2-09 | 2-of-3 authorization for protected admin actions | Finalization, funding, recovery, maintenance, and restoration require exact threshold signatures. The single-key executor and mutable financial controls are removed. E5. | Reviewer acceptance. Separate support must preserve these controls. |
| D2-10 | Migration, approval records, state transitions, and audit history | Implemented. Transaction-backed agreement records and integrity constraints exist. | Include dated migration evidence and current UI history for the final D2 demonstration. |

D2 acceptance checklist:

- [ ] Demonstrate a registered owner and contributor creating and independently signing the same 70/30 proposal through the current UI.
- [x] Cancel signing and verify that no consent is recorded.
- [ ] Reject unauthorized contributors, changed proposals, duplicate or replayed responses, invalid splits, and incomplete acceptance.
- [ ] Demonstrate rejection, dispute, resolution, amendment, fresh consent, and preserved history.
- [x] Verify three independent treasury signers, the registry treasury, and thresholds requiring two.
- [x] Demonstrate one signer cannot finalize and two distinct signers can finalize.
- [ ] Verify every specified protected admin action requires the required treasury authorization.
- [x] Demonstrate separate fan-to-artist and fan-to-contributor support payments with transaction evidence.
- [ ] Package approval records, migrations, state transitions, support hashes, treasury evidence, screenshots, and tests.
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

- [ ] Demonstrate the complete creator and admin journeys using real wallets and confirmed Testnet transactions.
- [ ] Verify readiness, status, history, and recovery at each signing and payment boundary.
- [ ] Reconcile all new financial records to their exact chain outcomes.
- [ ] Complete the security and failure test matrix below.
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

- [ ] Specify and implement the off-ramp payout adapter.
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
| Week 4 | Integrated final deployment, complete tests, and technical evidence pack | Settlement rollout and evidence are complete in E5. E6 records direct support. Finish remaining agreement UI evidence, track provider work separately, and obtain SOW acceptance. |

Next implementation checkpoints:

1. Obtain reviewer acceptance of the settlement specification and E5 evidence.
2. Review the direct-support implementation and E6 evidence.
3. Finish the remaining D2 proposal, rejection, dispute, and history interface verification. Track provider readiness separately.

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
