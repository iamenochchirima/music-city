# SOW 2: core completion and ramp integration plan

This plan tracks the work requested on 28 October 2026. The [SOW 2 tracker](sow-2-tracker.md) remains the source of deliverable status. The [provider sandbox plan](ramp-sandbox-implementation-plan.md) retains provider-specific requirements. Provider acceptance and live fiat enablement remain open until supported routes and real provider outcomes are verified.

## Completion criteria

Music City exposes a locally tested, authenticated funding and cash-out lifecycle with durable state, recovery, wallet authorization and clear user and admin views. Provider-specific behavior is implemented only where verified. Test fixtures remain confined to tests and isolated local environments. Unavailable routes cannot create payable orders. SOW core evidence and outstanding checks are reconciled with the tracker. Reviewer acceptance and production release require separate actions.

## Baseline and design

- [ ] B1. Inspect current changes, workspace instructions, shared contracts, ramp migrations, repository, MoonPay adapter, cash-out validator, worker, authentication, and Revenue UI. Record any conflicting behavior and preserve unrelated work.
- [ ] B2. Define state transitions and a provider interface using actual requirements, including separate provider and chain outcomes, exact amounts, ownership, expiry, and recovery. Reuse or replace existing overlapping contracts deliberately.
- [ ] B3. Confirm provider flags disable unavailable routes by default. Keep test fixtures inaccessible outside explicitly isolated tests.

## Backend and transaction lifecycle

- [ ] R1. Implement authenticated capability, order creation, detail, history, and resume routes. Bind user, wallet, network, provider, and direction on the server.
- [ ] R2. Persist intent before launch, serialize duplicate creates, and recover the same order after a lost response. Prevent another transaction while an outcome remains unknown.
- [ ] R3. Connect verified MoonPay sandbox URL creation and lookup to the provider interface. Restrict URLs and parameters to server-controlled values.
- [ ] R4. Verify provider notifications from raw payloads, deduplicate and record observations, preserve unknown statuses, and reject unrelated events.
- [ ] R5. Reconcile provider status in the financial worker with bounded retries and restart recovery. Keep paid, chain confirmed, delivered, failed, expired, and refunded states distinct.
- [ ] R6. Bind outgoing transfers to authoritative provider instructions, validate the asset, issuer, source, destination, memo, amount, fee, network and expiry, and persist signed envelopes and hashes before submission.
- [ ] R7. Verify incoming delivery using chain evidence before reflecting wallet funds. Never generate wallet credit, earnings or entitlements from sandbox simulation.
- [ ] R8. Implement cancellation and failure recovery without overwriting financial history. Support refunds only where actual provider behavior is documented and tested.
- [ ] R9. If a verified route requires conversion, design and validate the quote, slippage, fees and separate wallet authorization. Do not add an unverified conversion path.

## Creator and admin experience

- [ ] U1. Add funding and cash-out entry points next to spendable wallet funds, separate from unclaimed earnings. Show unavailable providers clearly.
- [ ] U2. Build the amount, quote, provider action and status flow with automatic progress, history and resumable URLs. Do not expose fixtures as live options.
- [ ] U3. Build authorized read-only admin list and detail views for status, chain receipts and reconciliation exceptions.
- [ ] U4. Verify desktop, mobile, keyboard, cancellation, slow responses, reload and recovery through computer use against the local app.

## Core SOW completion

- [ ] C1. Audit every specified protected treasury action and verify its required threshold. Record evidence or the exact remaining gap.
- [ ] C2. Re-run the creator-to-purchase-to-settlement-to-claim lifecycle locally against current code with real Dynamic Sandbox and Stellar Testnet where available. Preserve the historical evidence and distinguish fixtures.
- [ ] C3. Prepare a repeatable deployment and evidence package with tested revisions, contract IDs, transaction receipts, screenshots and results. Verify deployed versions before making live claims.
- [ ] C4. Resolve or document the production admin setup and historical migration-before-backup exception. Do not claim reviewer acceptance without the reviewer.

## Verification and handoff

- [ ] V1. Test ownership, capability rejection, idempotency, duplicate and reordered events, expired quotes, unknown status, worker restarts, and transfer tampering with meaningful unit and isolated PostgreSQL tests.
- [ ] V2. Run affected server, client, admin and shared tests, workspace typechecks, builds, and fresh and existing database migrations. Recheck agreements, support, checkout, claims and settlements.
- [ ] V3. Record dated local browser evidence and separately label simulated provider outcomes, real sandbox outcomes and on-chain transfers.
- [ ] V4. Update the SOW tracker and provider plan only for evidenced results. Commit each completed coherent change without secrets, runtime state, or unrelated edits.
- [ ] V5. When MoonPay responds or other providers grant access, finish provider-specific integration and real sandbox journeys. These external dependencies remain open until demonstrated.

## Execution checkpoints

The checklist starts unchecked. Record completed checks and commit IDs here as work proceeds. Do not mark provider or reviewer acceptance complete on fixture results.

### 28 October 2026: repository ownership

Removed the ramp repository's unscoped list path. Listing now requires both a user and wallet, and always filters by both. The isolated PostgreSQL repository suite passed both tests, including missing identity and cross-user checks. Server typecheck passed. This protects the repository boundary but does not complete the authenticated API or admin views.

### 28 October 2026: sandbox provider polling

The financial worker now runs a bounded MoonPay sandbox reconciliation cycle when the sandbox feature is explicitly enabled. A missing provider record remains unresolved, provider errors trigger backoff, and provider failures do not stop settlement reconciliation. Jobs are eligible for provider lookup only after a launch or a provider reference exists. Tests passed for missing records, errors, cycle limits and PostgreSQL job leasing; server typecheck passed. This is part of R5, not completion: notification handling, chain reconciliation, terminal scheduling, authenticated routes and browser verification remain open. No provider success is claimed.
