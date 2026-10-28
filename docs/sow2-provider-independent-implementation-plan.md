# SOW 2: core completion and ramp integration plan

This plan tracks the work requested on 28 October 2026. The [SOW 2 tracker](sow-2-tracker.md) remains the source of deliverable status. The [provider sandbox plan](ramp-sandbox-implementation-plan.md) retains provider-specific requirements. Provider acceptance and live fiat enablement remain open until supported routes and real provider outcomes are verified.

## Completion criteria

Music City exposes a locally tested, authenticated funding and cash-out lifecycle with durable state, recovery, wallet authorization and clear user and admin views. Provider-specific behavior is implemented only where verified. Test fixtures remain confined to tests and isolated local environments. Unavailable routes cannot create payable orders. SOW core evidence and outstanding checks are reconciled with the tracker. Reviewer acceptance and production release require separate actions.

## Baseline and design

- [x] B1. Inspect current changes, workspace instructions, shared contracts, ramp migrations, repository, MoonPay adapter, cash-out validator, worker, authentication, and Revenue UI. Record any conflicting behavior and preserve unrelated work.
- [ ] B2. Define state transitions and a provider interface using actual requirements, including separate provider and chain outcomes, exact amounts, ownership, expiry, and recovery. Reuse or replace existing overlapping contracts deliberately.
- [x] B3. Confirm provider flags disable unavailable routes by default. Keep test fixtures inaccessible outside explicitly isolated tests.

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
- [x] U3. Build authorized read-only admin list and detail views for status, chain receipts and reconciliation exceptions.
- [ ] U4. Verify desktop, mobile, keyboard, cancellation, slow responses, reload and recovery through computer use against the local app.

## Core SOW completion

- [x] C1. Audit every specified protected treasury action and verify its required threshold. Record evidence or the exact remaining gap.
- [ ] C2. Re-run the creator-to-purchase-to-settlement-to-claim lifecycle locally against current code with real Dynamic Sandbox and Stellar Testnet where available. Preserve the historical evidence and distinguish fixtures.
- [ ] C3. Prepare a repeatable deployment and evidence package with tested revisions, contract IDs, transaction receipts, screenshots and results. Verify deployed versions before making live claims.
- [x] C4. Resolve or document the production admin setup and historical migration-before-backup exception. Do not claim reviewer acceptance without the reviewer.

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

### 28 October 2026: authenticated transaction history

Added authenticated ramp history and detail endpoints. The account is resolved from the signed-in wallet, and both the account and wallet scope each query. Responses keep provider and chain status separate and omit provider references and internal order terms. HTTP tests cover missing or invalid credentials, cross-account access, missing orders and response privacy; server typecheck passed. This is part of R1; creation, capabilities and resume remain open.

### 28 October 2026: worker scheduling

Settlement reconciliation now runs before ramp polling, and each worker cycle checks at most one ramp order. This bounds the delay from a provider timeout to one request per cycle; it does not make provider polling concurrent or complete the reconciliation checklist. Ramp worker tests and server typecheck passed.

### 28 October 2026: concurrent launch protection

Launches for one wallet now serialize across providers and directions. A different order cannot launch while an earlier launched or provider-bound order has an unknown provider outcome or an uncertain chain submission. The PostgreSQL test races different request IDs and providers, checks owner isolation and verifies that unknown chain state remains blocking. Server typecheck passed. This advances R2; authenticated creation, reliable recovery after a lost launch response and chain reconciliation remain open.

### 28 October 2026: admin read-only data

Added authenticated, read-only admin endpoints for ramp history and details, including provider and chain state, chain hashes, event types, and reconciliation errors. Queries exclude transaction envelopes and event payloads. HTTP authorization and isolated PostgreSQL checks passed. The admin interface and browser verification are still required for U3.

### 28 October 2026: baseline and admin interface

The baseline inspection found that Revenue shows unclaimed earnings, while spendable balances are on the separate wallet page. Ramp history was not connected to either page. The existing quote and transfer validator is not connected to verified provider instructions or persistence; MoonPay catalog checks do not establish available payout methods. The current one-time launch record cannot yet recover a lost launch response. Sandbox creation remains unavailable through the application until these gaps are resolved. The unrelated local evidence checkpoint remains untouched.

The admin transaction screen now lists and opens ramp orders, separates provider and chain status, and displays activity, chain attempt hashes, confirmed Testnet receipt links, and reconciliation errors. The screen is read-only. Component tests and admin typecheck passed; the local browser showed both an empty history and the details of a simulated order in a cloned test database. This completes the admin interface item U3, but does not prove a real provider transaction or chain receipt. The broader desktop/mobile and end-to-end browser matrix remains open under U4 and V3.

### 28 October 2026: reconciliation lease recovery

Added an additive lease-token migration. Expired workers can no longer persist observations or release a newer worker's lease, and a notification received during a lease keeps the job due for another check. The worker unit tests and isolated PostgreSQL race and repeated-migration tests passed; migration initialization also passed on an existing cloned local database. This advances R5 and V1 without establishing provider delivery or chain confirmation.

### 28 October 2026: authenticated intent creation

Added authenticated capability and intent-creation endpoints with server-derived account and wallet, exact decimal handling, current route limits, and recovery by request ID. Existing orders remain retrievable after a route becomes unavailable; changed terms or wallets are rejected. The application capability registry currently exposes no verified routes, regardless of sandbox flags, and therefore cannot create new orders yet. Test capabilities exist only in the isolated PostgreSQL suite. Concurrent create, retry, unsupported and expired capability, precision, limit, and ownership tests passed along with HTTP authorization and shared/server typechecks. This advances R1 and R2; provider capability discovery, launch recovery and actual provider processing remain open.

### 28 October 2026: wallet entry points and history

Added disabled Add funds and Cash out controls beside spendable wallet balances, with the unavailable providers identified. The wallet loads authenticated ramp history and refreshes it automatically; provider and chain states remain separate. Component tests cover unavailable controls, an unconfirmed transfer, error recovery, and account-scoped requests; client typecheck passed. The actions remain disabled until a verified route and its complete user flow exist. Local browser verification and the complete funding/cash-out flow remain open, so U1 and U2 are not checked off yet.

### 28 October 2026: MoonPay payment-method discovery

MoonPay's [payment-method configuration endpoint](https://dev.moonpay.com/api-reference/widget/listpaymentmethods) accepts country, fiat currency and buy/sell direction with a server-side test key. A read-only request using the configured test key returned HTTP 200 for GBP/GBR and ZAR/ZAF in both directions. For GBP it reported card, Google Pay, Apple Pay and bank-related options for buy, and card and bank-related options for sell. For ZAR it reported card, Google Pay and Apple Pay for buy, and card for sell. These are provider configuration responses, not successful transactions or proof that a particular Stellar asset, customer, or sandbox payout works. One reported GBP limit had floating-point artifacts, so its numeric result must not be treated as an exact signed amount. No route was enabled from this check. Next, combine this endpoint with asset, market, quote, test-mode, country-subdivision and actual flow verification before exposing it as an available option.

### 28 October 2026: repeatable payment-method checks

The MoonPay sandbox adapter and readiness command can now query reported methods for an explicitly supplied ISO-3 country, fiat currency, direction, and US state where required. The secret stays in the authorization header, and provider numeric limits are not used as exact money. Nine adapter tests and server typecheck passed. A read-only GBP/GBR XLM readiness run returned methods for both directions, while both flows still report that provider-flow verification is needed. This does not enable a route or demonstrate a payment.

### 28 October 2026: signed MoonPay notifications

Added a sandbox-only webhook endpoint for the documented buy and sell transaction events. It checks [MoonPay's V2 signature](https://dev.moonpay.com/api-reference/widget/webhooks/signature) against the raw body and timestamp, verifies the saved account, direction and existing provider reference, deduplicates the notification, and schedules an authenticated provider lookup. It does not treat the notification as a payment or chain receipt. HTTP signature, expiry, unsupported-event and ownership tests passed; isolated PostgreSQL tests covered duplicate notifications and an in-flight lease. Server typecheck passed. This advances R4; real sandbox notification delivery and the MoneyGram adapter remain unverified.

### 28 October 2026: protected treasury actions

The [treasury authorization audit](sow2-treasury-authorization-audit.md) maps each specified action to its required authority and current enforcement. Current local signature, administrator route, PostgreSQL integration and contract tests passed. The PostgreSQL integration tests use mocked chain transport; historical real Testnet evidence remains linked separately. Production configuration and reviewer acceptance are still open.

### 28 October 2026: local regression checks and rollout gaps

Workspace typechecks and builds passed. The admin suite passed 20 tests. The client suite passed all 164 tests when run independently; a concurrent workspace run first timed out in four unrelated client tests. The server suite passed 187 tests and skipped 13 database-dependent tests. Separate isolated PostgreSQL runs passed ramp, settlement, agreement finalization, checkout and support integration tests; their external chain transport is mocked. The broader verification item V2 remains open because other skipped suites and the browser matrix still need review.

The [agreement lifecycle evidence](contributor-agreements-evidence/lifecycle-review/README.md) documents both unresolved production issues: legitimate first-admin setup is needed for authenticated admin checks, and an additive migration occurred before the fresh rollout backup. The SOW tracker keeps AGR-27 and AGR-28 open. This satisfies the documentation branch of C4; it does not resolve either issue or establish reviewer acceptance.

### 28 October 2026: incoming Testnet delivery verification

The worker can now verify a completed MoonPay buy against Stellar Testnet before marking the chain transfer confirmed. It requires the provider's transaction hash and exact crypto amount, then checks the successful transaction, complete operation list, destination wallet, asset, issuer, amount and unique payment operation. Confirmation records a durable receipt without creating a balance, earnings or entitlement. A delivery check error is recorded separately from a provider lookup error. Admin details show confirmed incoming receipt links.

Unit, worker, admin and isolated PostgreSQL tests passed, including mismatches, duplicate receipt prevention and expired leases. Fresh and simulated existing-database migration checks passed. A read-only check matched the earlier [Testnet support payment](support-evidence/testnet.json) to its real Horizon operation using a synthetic provider reference. The local admin browser also displayed a simulated receipt. Neither check demonstrates a MoonPay delivery. R7 remains open for real provider delivery and other verified transfer types; payment routes remain disabled.

### 28 October 2026: cash-out quote persistence

The server can now request a cash-out quote through an authenticated provider adapter, validate its provider transaction, wallet, market, exact amount, issuer, destination, memo and expiry, and save the quote and instructions with a confirmation hash. Owner-scoped quote reads and retries return the same saved terms. Database triggers protect quote snapshots, order terms and an established provider reference from mutation. Card is included in the cash-out market contract for providers that verify it.

HTTP authorization, transfer validation and isolated PostgreSQL tests passed, including concurrent saves, altered terms, expiry and ownership. Fresh, repeat and simulated existing-database migrations passed. The application has no registered cash-out instruction adapter, so quote creation remains unavailable to users. Wallet authorization, signed-envelope persistence and submission recovery remain open under R6.

### 28 October 2026: prepared cash-out attempts

A cash-out attempt can now be prepared from an owner-scoped saved quote and its confirmation hash, using server-supplied Stellar sequence, fee and ledger data. The exact unsigned envelope, hash and expiry are persisted before wallet authorization. Concurrent retries return the same attempt, another unresolved transfer for the same wallet blocks preparation, and an unsigned attempt can be cancelled without erasing its history. A retry after cancellation receives a distinct transaction hash. Database rules protect the original attempt and reject invalid state transitions.

Isolated PostgreSQL and cash-out validator tests passed, including concurrent preparation, cross-wallet access, same-wallet blocking, cancellation and immutable records. The additive migration passed on an existing local test database. This is an internal preparation boundary only: no cash-out provider adapter or user-facing signing and submission flow is enabled. Signed-envelope persistence, authoritative account reads, submission and chain recovery remain open under R6.

### 28 October 2026: signed cash-out intent

The internal authorization boundary verifies the exact prepared Testnet transaction and the freshly supplied wallet signer threshold, then encrypts and stores the signed envelope and original hash before a network submission can occur. Encryption binds the ciphertext to the order, attempt and hash. Same-envelope retries are idempotent, and a signed attempt cannot be cancelled or replaced. Isolated PostgreSQL tests used generated wallet keys and covered concurrent authorization, altered signatures, expiry, owner isolation and immutable ciphertext. Encryption tests covered wrong keys, changed context and tampering. Server typecheck passed.

This does not enable cash-out or send a transaction. A verified provider adapter, server-managed encryption-key configuration, authoritative Stellar account reads, submission and receipt recovery, and the user-facing wallet flow remain open.

### 28 October 2026: cash-out submission recovery

The financial worker can reconcile a signed Testnet transfer by its original hash, retain an uncertain outcome after a timeout, and retry only the same verified envelope. A durable lease prevents an older worker from updating a newer attempt. An attempt expires only after a later closed ledger and sufficient Horizon history establish that the transaction was not found. Admin details show recorded outgoing receipts and reconciliation errors; wallet history can show an expired transfer.

The isolated PostgreSQL tests cover a simulated lost submission response, recovery from a matching receipt, stale leases, and incomplete ledger history. Chain verification, encryption, admin authorization and component tests passed, as did server and client typechecks. These are simulated provider and network outcomes, not a completed cash-out. A verified provider adapter, authoritative account reads, wallet signing flow, local browser review and real sandbox transaction remain open. No route has been enabled.

### 28 October 2026: trusted cash-out account reads

An internal authorization service now obtains the account sequence, signing configuration and bounded base fee directly from Stellar Testnet, after checking the order and quote belong to the requesting account. It reads a closed ledger before the account so recovery can later check history coverage. Signing configuration is refreshed before accepting a signed envelope. A read of the existing Testnet wallet showed a zero medium threshold; the verifier supports that configuration while still requiring a valid wallet signature.

Seventeen focused tests and server typecheck passed. Read-only Testnet requests verified that the ledger and existing wallet responses parse; no transfer was sent. The service is not exposed to users yet. A provider instruction adapter, wallet signing flow, local browser verification and a real provider transaction remain open.

The isolated PostgreSQL recovery test now also passes through the authorization service using simulated account and network responses, a real wallet signature and the encrypted saved envelope. It covers preparation, authorization, uncertain submission and matching receipt recovery together; it does not establish a provider payout.

### 28 October 2026: authenticated cash-out transfer actions

Added sandbox-only, owner-scoped endpoints to retrieve the latest transfer, prepare an approved quote, submit a signed envelope for recovery, and cancel an unsigned attempt. The latest-transfer response includes the unsigned transaction only while it is awaiting authorization and never returns the saved signed envelope. New preparation additionally requires a current verified provider route matching the order and amount. The verified route registry is empty, so this does not enable cash-outs. The user-facing signing flow remains to be built.

Local HTTP tests covered session and wallet ownership, rejected extra payment fields, safe responses and the disabled route gate. The isolated PostgreSQL test covered retrieval before and after signing, owner isolation, encrypted persistence and recovery. Focused tests and server typecheck passed. These checks used simulated provider instructions and do not prove a sandbox payout.

### 28 October 2026: resume a prepared cash-out

An existing prepared cash-out can now be reviewed from wallet transaction history. The review shows the saved amount, payout, destination, provider fees and the Stellar fee extracted from the saved transaction. The connected wallet signs the exact saved transfer after scoped authorization. Users can cancel an unsigned transfer; pending transfers are checked automatically. If an authorization response is lost and the current state cannot be read, signing remains disabled until a status check succeeds. The server also refuses a new authorization if the provider has already failed or cancelled the order.

Local component and HTTP tests covered review, signing, cancellation, an unavailable status check and empty cancellation responses. The isolated PostgreSQL suite covered provider failure before signing and validated extraction of the saved transaction fee. Server and client typechecks passed. A local browser rendered the actual review component with simulated data at desktop and 375-pixel widths; the mobile action layout was corrected after inspection. This isolated preview does not verify the full app journey. Payment routes remain unavailable and no real payout has been demonstrated. U2 and U4 remain open.

### 28 October 2026: durable provider session storage

Added append-only storage for an encrypted provider session and atomically recorded the launch with the order. Concurrent attempts share the first stored session only if the adapter has explicitly established that reopening it is safe. A provider reference, unresolved state or previously launched order without a saved session blocks replacement. This is an internal persistence boundary; it is not connected to a provider adapter or browser yet. MoonPay's duplicate-session behavior still needs provider evidence before treating its link as resumable.

An isolated PostgreSQL test covered concurrent saves, ownership, immutable records, unsafe retry and unresolved provider state. The migration ran twice on a fresh disposable database, and server typecheck passed. No provider transaction was created.

### 28 October 2026: provider launch boundary

Added an internal launch service that checks the order owner and verified route, prepares a provider link, validates its sandbox origin and exact order, amount and wallet parameters, and encrypts the link before returning it. A safe-to-resume adapter can recover the same stored link without regenerating it. The MoonPay adapter uses the existing signed URL builder and explicitly does not claim safe resume. No provider is enabled by this service, and the service is not exposed through an HTTP route yet; trusted customer IP handling and the user flow remain open.

Local adapter and service tests covered tampered destinations, duplicate parameters, capability and owner rejection, encryption and safe resume. An isolated PostgreSQL test exercised the service against durable storage; MoonPay catalog responses were simulated. Server typecheck passed. These checks did not create a MoonPay transaction or demonstrate provider-level idempotency.
