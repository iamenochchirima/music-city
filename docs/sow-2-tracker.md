# SOW 2 milestone tracker

This is the single working tracker for Music City's submitted SOW 2. The Google Doc defines the scope. This tracker records implementation, verification, deployment, and remaining work without changing that scope.

## Source and baseline

- Source: [Music City Instawards SOW - 2](https://docs.google.com/document/d/1Nk0WR6laCp2meQT_VANp3oYFr9YkuZyVKe5ziuPWFoc/edit).
- Source read: 14 October 2026. Drive reports the document last modified on 11 September 2026 at 17:57:16 UTC.
- Submitted date recorded in the source: 1 August 2026. Suggested start: 3 August 2026. Duration: 30 days. These are submitted dates, not a newly agreed schedule.
- Builder: Enoch N Chirima. Chapter: South Africa. Chapter lead: David Ogoegbunem.
- Implementation baseline inspected: `a21ea0b` in [iamenochchirima/music-city](https://github.com/iamenochchirima/music-city).
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
| D1. Soroban earnings settlement engine | Open. Backend accounting and a finalized-split registry exist. The complete on-chain settlement and creator-claim engine is not evidenced. | Specify and implement batches, allocation, claimable USDC, claim, expiry, withdrawal, and reconciliation. |
| D2. Contributor agreements and treasury controls | Partial. Agreement services and protected registry finalization have historical Testnet evidence. Current browser consent remains unverified. Separate direct support is outstanding. | Verify current wallet consent, configure the deployment, cover protected admin operations, and implement both direct-support destinations. |
| D3. Product integration, operations, reconciliation, and verification | Partial. Creator and admin agreement screens, release flows, API migrations, and deployment evidence exist. | Integrate and demonstrate the complete D1 and D2 lifecycle, including failure recovery and evidence packaging. |

## D1. Soroban earnings settlement engine

Source: sections 4.1 D1, 5.1 Weeks 1, 2, and 4, and 6.1 D1. D1 owns settlement and the creator-claim path.

| ID | Submitted requirement | Implementation and evidence | Remaining work |
| --- | --- | --- | --- |
| D1-01 | Validate finalized royalty splits | Partial. `effective-split.ts` and the registry expose confirmed agreement versions. | Bind settlement to the exact effective version and evidence. Reject drafts, disputed versions, and unconfirmed finalization. |
| D1-02 | Create settlement batches from aggregated backend earnings | Partial. A backend ledger and payout records exist. | Define batch identity, eligible earnings, immutable inputs, persistence, and Soroban submission. |
| D1-03 | Calculate each recipient's allocation | Partial. Backend royalty calculations exist. | Specify asset precision, rounding, remainder distribution, and conservation. Verify identical backend and contract results. |
| D1-04 | Prevent duplicate settlement | Open for the new engine. | Enforce batch uniqueness on-chain and in persistence. Test repeated and concurrent submissions. |
| D1-05 | Create claimable Stellar USDC balances | Open. No complete claimable-balance flow was found in the inspected settlement code. | Choose and document the claimable-balance mechanism. Persist each recipient, amount, balance identity, and transaction. |
| D1-06 | Creator claim handling | Open. | Enforce beneficiary authorization, successful claim, and repeat-claim rejection. |
| D1-07 | Expiry and reclaim handling | Open. | Define deadlines and reclaim authority. Verify expiry boundaries and conservation without double spending. |
| D1-08 | Wallet-signed creator withdrawals | Open. Existing treasury payout signing is not creator withdrawal consent. | Implement exact wallet-authorized claims or withdrawals, network checks, cancellation, and replay protection. |
| D1-09 | Stellar USDC settlement | Partial. An existing treasury payment service signs with one key. | Connect the new engine to funded USDC settlement without substituting the old payout path for the required workflow. |
| D1-10 | Settlement events and independently verifiable on-chain evidence | Open for settlement. Agreement finalization events are separate evidence. | Emit and capture settlement and claim events, contract IDs, transaction hashes, balance IDs, and explorer links. |
| D1-11 | Backend reconciliation of on-chain settlement and claims | Partial. Existing payout reconciliation is a starting component. | Reconcile exact batches, allocations, claims, expiry, and uncertain submissions against confirmed chain results. |

D1 acceptance checklist:

- [ ] Approve the canonical batch, allocation, claim, expiry, authorization, and event specification.
- [ ] Demonstrate one earnings batch allocated to multiple recipients using a verified finalized agreement.
- [ ] Demonstrate duplicate prevention with no duplicate payment or claimable balance.
- [ ] Demonstrate wallet-authorized USDC claim or withdrawal and beneficiary restrictions.
- [ ] Demonstrate expiry and reclaim, including boundary and repeated-action tests.
- [ ] Match backend records to confirmed settlement, claim, balance, and event evidence.
- [ ] Package contract tests, integration tests, Testnet evidence, screenshots, and technical documentation.
- [ ] Record reviewer acceptance of D1.

## D2. Contributor agreements and treasury controls

Source: sections 4.1 D2, 5.1 Weeks 1, 3, and 4, and 6.1 D2. D2 owns consent, governance, separate direct support, and protected treasury actions.

| ID | Submitted requirement | Implementation and evidence | Remaining work |
| --- | --- | --- | --- |
| D2-01 | Canonical split proposal | Implemented. Versioned proposal, wallet, role, share, terms, track, release context, and hash. Domain and database evidence in E1. | Verify creation and review through the current deployed creator interface. |
| D2-02 | Wallet-signed acceptance | Implemented. One-time challenges bind exact proposal, action, wallet, version, and network. Real generated-key verification is recorded. | Demonstrate two actual users reviewing, cancelling, and signing through the current Dynamic Stellar wallet integration. |
| D2-03 | Rejection and dispute | Verified historically. Signed responses block finalization. | Capture current creator and admin behavior and actionable recovery. |
| D2-04 | Finalization requires complete consent | Verified historically. Ready-state checks and confirmed registry read-back gate the effective version. | Repeat end-to-end with current browser-generated contributor signatures. |
| D2-05 | Amendments preserve history and require fresh consent | Verified historically. Finalized versions 1 and 3 and disputed version 2 are recorded in E2. | Verify current interfaces preserve the old effective version until the amendment confirms. |
| D2-06 | Direct fan-to-artist support payments | Open as a separate SOW flow. Existing purchases and subscriptions are not proof of direct support. | Implement destination selection, exact wallet-authorized payment, confirmation, idempotency, and history. |
| D2-07 | Direct fan-to-contributor support payments | Open as a separate SOW flow. | Implement an explicit contributor destination and verify the recipient receives the intended support payment. |
| D2-08 | 2-of-3 treasury authorization for finalization | Verified historically. One signer failed and two succeeded against a disposable Testnet treasury and registry. | Configure the current environment and repeat exact transaction preparation, independent signing, and confirmation. |
| D2-09 | 2-of-3 authorization for protected admin actions | Partial. Agreement finalization is protected. Super-admin application permission is not chain multisignature authorization. | Specify the complete protected-action list. Remove or replace single-key bypasses for those actions and test each boundary. |
| D2-10 | Migration, approval records, state transitions, and audit history | Implemented. Transaction-backed agreement records and integrity constraints exist. | Include dated migration evidence and current UI history for the final D2 demonstration. |

D2 acceptance checklist:

- [ ] Demonstrate a registered owner and contributor creating and independently signing the same 70/30 proposal through the current UI.
- [ ] Cancel signing and verify that no consent is recorded.
- [ ] Reject unauthorized contributors, changed proposals, duplicate or replayed responses, invalid splits, and incomplete acceptance.
- [ ] Demonstrate rejection, dispute, resolution, amendment, fresh consent, and preserved history.
- [ ] Verify three independent treasury signers, the registry treasury, and thresholds requiring two.
- [ ] Demonstrate one signer cannot finalize and two distinct signers can finalize.
- [ ] Verify every specified protected admin action requires the required treasury authorization.
- [ ] Demonstrate separate fan-to-artist and fan-to-contributor support payments with transaction evidence.
- [ ] Package approval records, migrations, state transitions, support hashes, treasury evidence, screenshots, and tests.
- [ ] Record reviewer acceptance of D2.

## D3. Product integration, operations, reconciliation, and verification

Source: sections 4.1 D3, 5.1 Week 4, and 6.1 D3. D3 integrates the two technical deliverables into an operable product.

| ID | Submitted requirement | Implementation and evidence | Remaining work |
| --- | --- | --- | --- |
| D3-01 | Creator and administrator interfaces for D1 and D2 | Partial. Agreement screens and improved track and release flows exist. | Add settlement, claim, withdrawal, support, and operational screens. Verify the complete lifecycle. |
| D3-02 | Wallet and trustline readiness | Partial. Wallet resolution and existing wallet/payment facilities exist. | Verify network, correct signing wallet, required asset trustline, insufficient balance, and corrective actions across all new flows. |
| D3-03 | Settlement and claim status | Open for D1. | Present pending, confirmed, failed, claimed, and expired states from authoritative records. |
| D3-04 | Support-payment history | Open. | Show recipient, amount, asset, status, and confirmed transaction reference for each support payment. |
| D3-05 | Payout and reconciliation workflows | Partial. Existing payout records and reconciliation exist. | Connect them to new settlement and claim evidence without duplicate allocation or false completion. |
| D3-06 | Multisignature configuration evidence | Verified historically for the disposable agreement treasury. | Capture configuration for the final demonstrated deployment and protected action set. |
| D3-07 | Failure recovery | Partial. Agreement finalization persists attempts and reconciles unknown outcomes. | Cover failed settlement, signing cancellation, expiry, provider errors, retry, and uncertain submission across the complete flow. |
| D3-08 | Automated security and failure tests | Partial. Agreement signature, authorization, persistence, concurrency, and treasury tests exist. | Complete the submitted D1, support, withdrawal, trustline, balance, retry, and reconciliation cases. |
| D3-09 | Deployment documentation and final Testnet deployment | Partial. API migrations and live frontend deployment are documented in E3. | Deploy and document the complete settlement, claim, support, and treasury configuration. Application deployment alone does not complete the SOW. |
| D3-10 | Transaction evidence and end-to-end Testnet verification | Partial. Agreement publication has E2. | Capture a continuous contributor-consent to settlement to creator-claim demonstration, plus support and failure branches. |

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
| Week 1 | Approved D1 and D2 specifications, contract architecture, integration map, Testnet configuration, treasury plan, security assumptions, and executable tests | D2 model exists. D1 batch, allocation, claim, expiry, and support specifications need completion. Approval is not recorded. |
| Week 2 | Working settlement and creator-claim flow, contract tests, integration, balance and transaction evidence, reconciliation | D1 remains open. |
| Week 3 | Contributor agreements, direct support, treasury controls, and creator/admin views | Agreement Testnet evidence exists. Current wallet verification, live treasury configuration, support, and full admin protection remain open. |
| Week 4 | Integrated final deployment, complete tests, and technical evidence pack | Complete D1 and D2, then verify and package D3. |

Next implementation checkpoints:

1. Close current agreement browser verification and reconcile the wallet documentation with the actual Dynamic implementation.
2. Specify the dedicated treasury, registry, and protected admin action set. Configure the intended Testnet environment and verify its signatures and thresholds.
3. Specify and implement D1 batches, allocation, claimable USDC, wallet withdrawal, expiry, and reconciliation. Replace conflicting payout paths within that scope.
4. Implement both D2 direct-support destinations as a separate payment flow.
5. Complete D3 interfaces, failure tests, deployment, and continuous Testnet evidence. Track provider readiness separately.

## Required SOW test matrix

| Test group | Required result | Evidence position |
| --- | --- | --- |
| Finalized-split and invalid-split tests | Only exact confirmed splits settle. Invalid shares, wallets, totals, and versions fail. | Agreement validation is recorded in E1. Settlement tests remain open. |
| Incomplete acceptance and unauthorized contributors | Missing consent and outsider signatures cannot finalize. | Historical agreement tests in E1. Current browser proof remains open. |
| Dispute and amendment history | Blocked versions cannot finalize. New versions require fresh consent and preserve effective history. | Historical E1 and E2. Current UI verification remains open. |
| Duplicate approval | Identical retries do not add consent or duplicate events. Changed or replayed signatures fail. | Historical E1. |
| Duplicate settlement and allocation | Repeated or concurrent batch submission cannot pay twice. Allocations conserve the batch amount. | Open for D1. |
| Claimable balances and creator claim | Correct balances exist. Only the authorized beneficiary claims once. | Open for D1. |
| Expiry and reclaim | Exact deadline rules hold. Claim and reclaim cannot both succeed for the same funds. | Open for D1. |
| Wallet-signed withdrawal | Correct wallet and network authorize the exact action. Cancellation, altered transactions, and replay fail safely. | Open for D1. |
| Trustline and insufficient balance | Unready wallets or insufficient funds fail without false confirmation or partial accounting. | New-flow evidence remains open. |
| Direct support | Artist and contributor destinations receive the exact intended payment. Duplicate confirmations do not duplicate history. | Open for D2. |
| Multisignature threshold | One signer fails. Two independent valid signers succeed. Wrong or altered envelopes fail. | Historical finalization evidence E1 and E2. Full protected-action coverage remains open. |
| Failed settlement and retry | Failures retain truthful status. Uncertain results reconcile the original transaction before another attempt. | Agreement recovery tests in E1. D1 and support coverage remain open. |
| Reconciliation | Backend totals and status match confirmed transactions, events, claims, and expiry outcomes. | Agreement confirmation evidence exists. Complete financial reconciliation remains open. |

## Evidence register

| ID | Evidence | What it establishes |
| --- | --- | --- |
| E1 | [Agreement test evidence](contributor-agreements-evidence/milestone-verification.md) and [repeatable Testnet setup](contributor-agreements-evidence/README.md) | Historical agreement domain, persistence, authorization, signature, finalization, and reconciliation checks. Dates and transport limits belong to those records. |
| E2 | [Public agreement Testnet record](contributor-agreements-evidence/stellar-testnet.json) | Historical 70/30 finalization, dispute, fresh-consent amendment, treasury thresholds, and immutable registry read-back. No D1 settlement or creator-claim evidence. |
| E3 | [Production deployment](production-deployment.md) and [deployment evidence](production-deployment-evidence/README.md) | API migrations, readiness, frontend deployment, and selected runtime checks. Not proof of configured agreement finalization or complete SOW acceptance. |
| E4 | [Release-flow evidence](release-flow-evidence/README.md) | Current release creation, editing, upload, publication choices, and visible processing. Supporting product work, not a substitute for financial-flow verification. |

Current runtime findings from 14 October 2026:

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

For future entries, record the requirement IDs, tested commit, environment, result, evidence location, and remaining gap. Mark a deliverable accepted only after its checklist and source-required evidence are complete and acceptance is recorded.
