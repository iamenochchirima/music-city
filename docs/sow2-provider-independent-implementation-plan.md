# SOW 2: core completion and ramp integration plan

This plan tracks the work requested on 28 October 2026. The [SOW 2 tracker](sow-2-tracker.md) remains the source of deliverable status. The [provider sandbox plan](ramp-sandbox-implementation-plan.md) retains provider-specific requirements. Provider acceptance and live fiat enablement remain open until supported routes and real provider outcomes are verified.

## Completion criteria

Music City exposes a locally tested, authenticated funding and cash-out lifecycle with durable state, recovery, wallet authorization and clear user and admin views. Provider-specific behavior is implemented only where verified. Test fixtures remain confined to tests and isolated local environments. Unavailable routes cannot create payable orders. SOW core evidence and outstanding checks are reconciled with the tracker. Reviewer acceptance and production release require separate actions.

## Baseline and design

- [x] B1. Inspect current changes, workspace instructions, shared contracts, ramp migrations, repository, MoonPay adapter, cash-out validator, worker, authentication, and Revenue UI. Record any conflicting behavior and preserve unrelated work.
- [x] B2. Define state transitions and a provider interface using actual requirements, including separate provider and chain outcomes, exact amounts, ownership, expiry, and recovery. Reuse or replace existing overlapping contracts deliberately.
- [x] B3. Confirm provider flags disable unavailable routes by default. Keep test fixtures inaccessible outside explicitly isolated tests.

## Backend and transaction lifecycle

- [x] R1. Implement authenticated capability, order creation, detail, history, and resume routes. Bind user, wallet, network, provider, and direction on the server. Provider routes remain empty until verified account-specific capabilities exist.
- [x] R2. Persist intent before launch, serialize duplicate creates, and recover the same order after a lost response. Prevent another transaction while an outcome remains unknown. Retry and unresolved-order behavior is covered by ramp service and isolated PostgreSQL tests.
- [ ] R3. Connect verified MoonPay sandbox URL creation and lookup to the provider interface. Restrict URLs and parameters to server-controlled values.
- [ ] R4. Verify provider notifications from raw payloads, deduplicate and record observations, preserve unknown statuses, and reject unrelated events.
- [ ] R5. Reconcile provider status in the financial worker with bounded retries and restart recovery. Keep paid, chain confirmed, delivered, failed, expired, and refunded states distinct.
- [ ] R6. Bind outgoing transfers to authoritative provider instructions, validate the asset, issuer, source, destination, memo, amount, fee, network and expiry, and persist signed envelopes and hashes before submission.
- [ ] R7. Verify incoming delivery using chain evidence before reflecting wallet funds. Never generate wallet credit, earnings or entitlements from sandbox simulation.
- [ ] R8. Implement cancellation and failure recovery without overwriting financial history. Support refunds only where actual provider behavior is documented and tested.
- [ ] R9. If a verified route requires conversion, design and validate the quote, slippage, fees and separate wallet authorization. Do not add an unverified conversion path.

## Creator and admin experience

- [x] U1. Add funding and cash-out entry points next to spendable wallet funds, separate from unclaimed earnings. Show unavailable providers clearly.
- [ ] U2. Build the amount, quote, provider action and status flow with automatic progress, history and resumable URLs. Do not expose fixtures as live options.
- [x] U3. Build authorized read-only admin list and detail views for status, chain receipts and reconciliation exceptions.
- [ ] U4. Verify desktop, mobile, keyboard, cancellation, slow responses, reload and recovery through computer use against the local app.

## Core SOW completion

- [x] C1. Audit every specified protected treasury action and verify its required threshold. Record evidence or the exact remaining gap.
- [ ] C2. Re-run the creator-to-purchase-to-settlement-to-claim lifecycle locally against current code with real Dynamic Sandbox and Stellar Testnet where available. Preserve the historical evidence and distinguish fixtures.
- [ ] C3. Prepare a repeatable deployment and evidence package with tested revisions, contract IDs, transaction receipts, screenshots and results. Verify deployed versions before making live claims.
- [x] C4. Resolve or document the production admin setup and historical migration-before-backup exception. Do not claim reviewer acceptance without the reviewer.

## Verification and handoff

- [x] V1. Test ownership, capability rejection, idempotency, duplicate and reordered events, expired quotes, unknown status, worker restarts, and transfer tampering with meaningful unit and isolated PostgreSQL tests.
- [x] V2. Run affected server, client, admin and shared tests, workspace typechecks, builds, and fresh and existing database migrations. Recheck agreements, support, checkout, claims and settlements.
- [x] V3. Record dated local browser evidence and separately label simulated provider outcomes, real sandbox outcomes and on-chain transfers.
- [x] V4. Update the SOW tracker and provider plan only for evidenced results. Commit each completed coherent change without secrets, runtime state, or unrelated edits.
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

### 28 October 2026: launch API and ingress gate

Added an authenticated launch endpoint that accepts no client-supplied payment terms or IP address. It is disabled by default and requires a sandbox key, a launch encryption key, an explicitly enabled direct connection and a current verified route. The direct connection uses only the socket address and rejects private or reserved addresses. It does not trust forwarding headers or support proxy ingress; a separately verified proxy integration is still needed for the deployed architecture.

Local HTTP and IP tests passed for authentication, injected fields, proxy rejection and public-address selection; server typecheck passed. No provider route is currently verified, and MoonPay resume and completed transactions remain unverified. This does not complete the user-facing flow or R3.

### 28 October 2026: local demonstration runbook

Added a [local SOW 2 demonstration guide](sow2-local-demo.md) for the release, consent, purchase, settlement and claim sequence. It identifies the required Testnet wallets, two treasury signatures, services, receipts and reconciliation checks. It links the historical E8 evidence and distinguishes it from a new run. The guide has not yet been exercised end to end against the current revision, so C2 and C3 remain open.

### 28 October 2026: current workspace and database regression

At revision `221b1b8`, `pnpm typecheck` and `pnpm build` passed for the workspace. The client build reported its existing large-bundle warning. `pnpm test` passed 204 server, 168 client and 20 admin tests; 13 database-dependent server tests were skipped in that default run.

Each skipped test then ran against its own disposable local PostgreSQL database. The publication, metadata, agreement workflow, onboarding, guest listening, referrals, sponsorship and admin-auth suites passed 58 checks. The finalization, checkout, direct support, settlement and ramp suites passed another 47 checks. The chain boundaries in the financial integration suites use mocks, although those suites exercise real signatures and PostgreSQL transactions. These results do not establish new Testnet transactions.

Fresh and repeated migration initialization passed on a disposable database. A simulated existing database with a retained user row and the launch-session migration removed initialized again, restored the table and migration marker, and preserved the row. The disposable databases were removed. This completes V2 for local regression; the real-wallet browser journey, provider transactions, deployment and reviewer acceptance remain open.

### 29 October 2026: funding entry flow

Wallet funding now presents verified available routes as visible choices, accepts an amount within the route limits, creates an owner-scoped order and offers the validated provider link. A failed or lost launch response leaves the user directed to transaction history rather than retrying the launch. The server advertises only routes whose verified provider and local direct-ingress configuration are both available. No provider route is verified today, so the entry point remains disabled; cash-out creation is also still unavailable.

Focused client and server tests passed for route configuration, supported amounts, authentication and uncertain launch. Server and client typechecks passed. A local browser preview of the component used simulated routes and responses at desktop and 375-pixel widths; selecting a route and reaching the simulated handoff worked. It did not contact a provider or prove an end-to-end payment. The selected country and payment method still need provider-specific verification through checkout; U1, U2 and U4 remain open.

### 29 October 2026: resume saved funding orders

The owner-scoped history response now distinguishes an unlaunched order from a requested launch or an established provider reference without exposing the reference. Wallet history can continue an unlaunched MoonPay order using its existing ID. An unresolved launch is labelled as checking and blocks another funding request while history is loaded or unavailable. The server remains the authority for rejecting conflicting launches.

Local component and HTTP tests passed for resuming the same order, blocking an unresolved launch and account-scoped responses. Client and server typechecks passed. The resume screen has not yet been exercised in the full local application or with a real provider; MoonPay's safe-resume behavior remains unverified.

### 29 October 2026: reconciliation scheduling

The worker now checks fully confirmed deliveries and terminal failures less frequently, while retaining frequent checks for unconfirmed or uncertain transfers. A new verified notification makes the relevant job due immediately, including when a worker holds its lease. This reduces the chance that old completed jobs delay active orders; it does not remove the periodic check or treat provider completion as chain confirmation.

The isolated PostgreSQL test covered prompt checks before delivery, slower checks after a confirmed receipt, and notification wake-up. Worker and webhook tests and server typecheck passed. Provider status regressions with newer timestamps still need an explicit policy and tests; R5 remains open.

### 29 October 2026: conflicting provider statuses

After a provider observation reaches completed, failed, cancelled or refunded, a later different status is retained as a conflict and the order moves to checking. The original terminal observation and any confirmed chain receipt remain in the audit history. A new transaction is blocked while the status is unknown. A later, newer observation matching the original terminal status can clear the conflict. A stale observation cannot change the order or trigger delivery verification. The worker records a provider-status conflict for administrator review.

The isolated PostgreSQL tests covered a completed-to-processing conflict, duplicate conflict, stale update, blocked replacement and later matching observation. Worker tests confirmed that stale or conflicting observations cannot confirm delivery. Server typecheck passed. This conservative policy does not implement a provider refund transition; documented and verified refund behavior still needs an explicit integration. R5 and R8 remain open.

### 29 October 2026: cancel unlaunched funding

An owner can cancel a saved funding order before it has a provider launch, provider reference or chain activity. Cancellation keeps the order and an append-only event. It shares the launch lock, so concurrent cancellation and launch cannot both succeed. Orders with an uncertain or established provider transaction cannot use this cancellation path.

Local PostgreSQL, HTTP and component tests passed, including the launch-versus-cancellation race and owner checks. Client and server typechecks passed. A local browser preview using simulated data showed the cancellation and the resulting history label; it did not contact a provider. R8 remains open for provider-specific cancellation and refunds.

### 29 October 2026: local admin conflict review

Started the actual local admin and API against a disposable clone of the settlement test database. A simulated order with conflicting provider observations appeared in transaction history and its detail page. The detail page now displays a clear conflict warning rather than relying on the activity list alone. The admin component tests and typecheck passed. The temporary app processes, fixture script and cloned database were removed after the check.

This was a local browser check with simulated provider data. It did not verify a real provider transaction, the creator wallet journey, mobile layout or SOW reviewer acceptance; U4 and V3 remain open.

### 29 October 2026: local wallet and environment safeguards

Signed in to the local application with a Dynamic Sandbox test identity against a disposable PostgreSQL clone. A simulated unlaunched funding order appeared in the wallet, could be opened and cancelled, and remained cancelled after reloading. New funding and cash-out remained unavailable because no provider route is verified. This did not contact a payment provider or prove a transfer.

The initial local configuration pointed to Dynamic Live. A disposable test email was submitted to the Live login prompt before the mismatch was noticed; no verification code was entered and no sign-in or payment was performed. The local application was restarted with Sandbox authentication and its matching signing-key endpoint before the wallet check. A new preflight checks the local database, Dynamic, Stellar and provider settings before a demonstration. Provider transactions, the complete real-wallet cash-out path and reviewer acceptance remain open.

### 29 October 2026: current lifecycle run preparation

Read-only Testnet checks found the previously used registry and settlement contract instances present. The historical artist and contributor accounts had USDC trustlines and balances; the treasury account had USDC and a two-signature threshold. These checks do not prove current contract configuration or a new transaction.

Started the current local API and frontends against an isolated clone, with Dynamic Sandbox, Testnet, local storage and local media processing. API readiness reported the current migrations applied. Before starting the workers, checked that the clone contained no pending checkout, agreement, funding or ramp attempts; removed three inherited queued publication jobs from the disposable clone so they would not run as part of this demonstration. The preflight now rejects remote media processing. The new creator-to-claim journey and its receipts have not yet been produced; C2 remains open.

### 29 October 2026: provider-scoped reconciliation

The reconciliation worker now selects jobs by its configured provider and uses the shared observation contract. A future adapter can be passed to the same reconciliation flow without a MoonPay worker leasing another provider's jobs. Only MoonPay is configured in the running worker; this change does not enable MoneyGram or claim its status mapping is verified.

Worker tests passed, including provider selection. An isolated PostgreSQL test created simulated jobs for both providers and confirmed the MoonPay lease ignored a due MoneyGram job. Server typecheck passed. B2 and R5 remain open for provider-specific behavior and full state coverage.

### 29 October 2026: cash-out provider-state recheck

The worker now locks and rechecks the persisted provider state before claiming a signed cash-out for submission. A failed, cancelled, refunded, completed or unknown provider state prevents a new submission claim; the retained attempt remains eligible for receipt and expiry reconciliation because an earlier submission may already have succeeded. A provider update can still arrive after the claim and before the network request, so adapter-specific cancellation guarantees and recovery remain necessary.

The isolated PostgreSQL test covered each blocked state, recovery when the provider is ready, and recording a chain receipt even after provider failure. Server typecheck passed. This is a simulated-provider check, not a completed provider cash-out; R6 and R8 remain open.

### 29 October 2026: capability validation

Capability discovery now checks route combinations against the actual order contract, pins Testnet USDC to Circle's issuer, excludes cash-out assets unsupported by the current transfer path, and hides ambiguous duplicate choices. Invalid provider-supplied route data is excluded before it reaches the wallet or order creation. This does not certify a provider's geographic coverage, fees or availability; those still require provider evidence.

### 29 October 2026: analytics verification with existing Sandbox accounts

Read-only browser checks used the existing artist Sandbox account and the existing contributor/listener account `Kwame`. The artist analytics page exposed duplicate completion events: two playback sessions had two starts and four completions. The client now records one completion per playback session, database analytics counts distinct sessions with a corresponding start, and completion rate is capped at 100% as a guard. Track-to-release analytics now uses the authoritative release-track relation. Local browser verification showed two streams, the correct release and track grouping, and 100% completion.

The contributor's historical agreements remained readable, while the earnings view showed no new claimable balance and required explicit treasury/split-registry configuration. No new agreement, purchase, settlement, claim, provider session, quote, transfer, or payout was created. This fixes an analytics defect and verifies account read paths; it does not close C2 or the broader U4 browser matrix. The full workspace tests, typecheck, and build passed; the default suite skipped 13 database-backed server tests.

### 29 October 2026: mobile navigation and transaction recovery browser check

Computer use verified the local Account and Revenue pages at 390 pixels. The mobile navigation is keyboard reachable, opens with Enter, and closes with Escape while restoring focus. Both pages fit without horizontal overflow. The Revenue page keeps available earnings and pending payments at 0.00 USDC, shows the missing treasury/finalized-registry setup reason, and leaves funding and cash-out disabled while no verified routes exist.

An existing cancelled GBP sandbox fixture opened at its saved `?ramp=` detail URL. Provider status stayed Cancelled and Stellar status stayed Transfer unconfirmed after manual refresh and browser reload; closing returned to the account page. This was read-only local fixture evidence, not a provider or chain result.

The root `.env` lacks `AGREEMENT_TREASURY_ADDRESS`; its configured registry differs from the historical E8 registry, and its current Testnet validity has not been established. No environment or contract setting was changed. C2 remains open pending correct current Testnet configuration and a real user-authorized claim. U4 remains open for the actual quote, review, signing, provider overlay, slow-response, and cancellation matrix. No screenshot artifact was saved.

Focused capability tests, the existing isolated PostgreSQL order and recovery suite, and server typecheck passed. No payment route was enabled. B2 and U2 remain open for verified adapters and their complete user journeys.

### 29 October 2026: unavailable saved funding route

A saved unlaunched funding request now opens through Manage. The dialog offers cancellation but only offers provider continuation when the current capability matches the saved route and amount. This is a user-interface guard; the server still checks capability at launch.

Eight client component tests and client typecheck passed. A desktop browser component preview showed the unavailable message and cancellation action, and keyboard focus moved between actions. The preview used fixture data and did not contact a provider. Mobile and full application verification remain open under U4.

### 29 October 2026: provider launch validation boundary

The launch service now requires each registered adapter to validate its provider-specific URL against the saved order. The shared boundary independently rejects non-HTTPS URLs, embedded credentials and fragments. MoonPay retains its existing sandbox origin and parameter checks, including on resumed encrypted sessions. A second provider adapter in tests demonstrates the boundary; it is a fixture and does not enable MoneyGram.

Launch service and HTTP tests, isolated PostgreSQL session tests and server typecheck passed. Additional provider adapters still require verified route discovery, URL rules, transaction lookup, status mapping, UI support and sandbox evidence; B2 and R3 remain open.

### 29 October 2026: pending delivery and duplicate launch prevention

A started transaction now blocks a second launch while provider action, processing, pickup or refund is pending, and while provider completion lacks a confirmed chain transfer. Both launch entry points enforce the rule under the existing wallet lock. The wallet applies the same rule and allows a new funding request when provider completion and chain confirmation are both recorded. Failure and refund recovery still require provider-specific evidence; an unresolved completed delivery may need operator investigation.

Isolated PostgreSQL tests covered concurrent launches, pending states, unconfirmed delivery and the two launch entry points. Ten wallet component tests and client/server typechecks passed. This was simulated data; provider and chain completion were not newly demonstrated. R2 and R7 remain open for end-to-end verification.


### 29 October 2026: lifecycle and adapter contract

Documented the active order, observation, quote and transfer contracts in [Ramp lifecycle contract](ramp-lifecycle-contract.md), including the separate provider and chain outcomes, ownership, exact units, expiry, retries and adapter responsibilities. The document distinguishes the active ramp contracts from the broader cash-out model and identifies provider-specific state transitions and refunds as unfinished. B2 covers this design record; it does not claim the unchecked implementation or provider verification items are complete.

### 29 October 2026: visible unresolved history

The owner-scoped history still returns at most 100 orders, but puts orders that block another launch first. It uses the same database condition as the launch guard. This keeps at least one blocking transaction visible even when the account has more than 100 newer orders; full history pagination remains separate work.

An isolated PostgreSQL test created one old unresolved order and 101 newer orders, then verified that the old order appeared in its owner's bounded history and remained inaccessible to another user. The repository suite and server typecheck passed. This was simulated data and does not complete provider verification.

### 29 October 2026: stale cash-out quotes and reviews

The quote service rejects terminal or unknown provider states before making a provider request, and the repository checks again while saving the response. A prepared transfer is withheld from a fresh review when the provider is no longer ready, and a repeat prepare request is rejected. The user can still cancel the unsigned attempt. Authorization remains subject to the existing server-side provider-state check; a status change after a review has loaded can still lead to a wallet prompt before that check, so a just-in-time review refresh remains open.

Isolated PostgreSQL tests covered blocked provider states, a state change during provider lookup and a previously prepared transfer. Four cash-out review component tests and client/server typechecks passed. Provider fixtures do not demonstrate a real quote or payout.

### 29 October 2026: pre-sign cash-out refresh

The review re-reads the saved transfer immediately before opening the wallet and compares the attempt, quote, transaction hash, envelope, fee and expiry. If the record changed or cannot be read, it does not request a signature. The server still checks provider state when authorization is submitted. A provider update can occur after either check, so this does not replace provider-specific cancellation and reconciliation rules.

Six cash-out review component tests and client typecheck passed. The checks used fixtures and did not open a real wallet or contact a provider; full cash-out browser verification remains open.

### 29 October 2026: current workspace regression

At revision `abc4fc6`, the workspace build and a subsequent standalone typecheck passed. The client build retained its large-bundle warning. A standalone `pnpm test` passed 210 server tests, 181 client tests and 22 admin tests. The default server run skipped 13 database-dependent tests; the ramp PostgreSQL suite was run separately after the relevant changes, as recorded above. These results do not constitute a new real-wallet or provider transaction.

An earlier run started tests, typecheck and build concurrently. An onboarding test timed out and typecheck reported missing shared-package exports while the shared package was being rebuilt. The standalone reruns passed. The exact cause of the first failures was not independently proven, so future regression checks should run build, typecheck and tests sequentially.

### 29 October 2026: database-backed regression on current code

At revision `a247f8c`, ran the 13 suites skipped by the default server test command against separate disposable local PostgreSQL databases. All 105 checks passed with no skips. These covered admin authentication, agreements, finalization, checkout, guest playback, publication, ramp persistence, referrals, settlement, sponsorship, support, track metadata and onboarding. The disposable databases were removed after the run.

The financial integration suites use real signatures with mocked chain or provider boundaries. They do not replace the current-code Dynamic wallet and Testnet journey or provider sandbox evidence.

### 29 October 2026: cash-out route expiry

The cash-out service rechecks the verified route before exposing an unsigned prepared envelope and before accepting an authorization. If the route is unavailable or its evidence has expired, the user can still cancel the unsigned attempt and inspect existing transfer status. A signed attempt already held by the worker remains subject to chain reconciliation. This is an application-side capability check, not proof of current provider availability or payout behavior.

Focused service and HTTP tests, the isolated PostgreSQL ramp suite, and server typecheck passed. The test uses simulated route availability and does not enable cash-out.

### 29 October 2026: reconstructed cash-out recovery

The isolated PostgreSQL recovery test now reconstructs the repository and envelope cipher after a simulated lost submission response. With a wrong encryption key, the attempt stays unknown and no new submission occurs. With the original key, the reconstructed worker submits the same signed envelope and later records its receipt. The network transport is mocked and the worker is reconstructed in the test process; an operating-system process restart and a real provider payout remain unverified.


### 29 October 2026: cash-out process restart test

The PostgreSQL recovery test now starts separate Node worker processes against the same isolated schema and mocked Stellar transport. A process with the wrong test key leaves the retained attempt unknown and submits nothing. A new process with the correct key submits the exact saved envelope, after which the test records the retained transaction receipt. Lease recovery, ownership, idempotency, reordered observations, expired quotes and transfer tampering are covered by the related unit and database suites recorded above. V1 covers these automated tests only; real provider and wallet verification remain open.

### 29 October 2026: current local wallet cancellation

At revision `1630aea`, signed in through Dynamic Sandbox in the actual local application using an existing test identity and an isolated database. A simulated, unlaunched funding order appeared under Transactions. Manage opened the unavailable-option dialog, with cancellation available and no provider continuation. Cancellation succeeded and remained visible after reloading. No provider was contacted. The temporary fixture script was removed, and the test account was signed out.

This check covers the current desktop flow only. Mobile, a real provider transaction, cash-out signing and the creator-to-claim journey remain open under U4, V3 and C2.

### 29 October 2026: shared route checks for cash-out quotes

Launch, cash-out quotes and cash-out authorization now use the same exact order-to-route match. The quote service checks verified capability before and after the adapter request, and the configured route also requires sandbox and cash-out encryption settings. A route that becomes unavailable during a quote request cannot save a new actionable quote. Existing quotes remain available for history and review.

Focused capability and HTTP tests, the isolated PostgreSQL ramp suite and server typecheck passed. Quote adapters remain unconfigured and no cash-out route is enabled. A provider-specific session and the user-facing cash-out entry flow are still required before this can be demonstrated end to end.


### 29 October 2026: cancel unlaunched cash-out orders

The owner can now cancel a cash-out order before a provider session or chain activity exists. Cancellation uses the same wallet lock as session launch and records a separate cash-out event. It remains unavailable once a provider reference, launch or chain activity exists. This prepares the entry flow without enabling a provider.

The isolated PostgreSQL test covered owner checks, idempotent cancellation and a cancellation-versus-launch race. The authenticated HTTP test and server typecheck passed. Provider cancellation and refunds remain open.

### 29 October 2026: cash-out entry screen

Added a cash-out entry dialog that appears only for an advertised supported sell route, a connected signing wallet and spendable Testnet USDC. The user chooses a payout option and an amount within the route limits and spendable balance. The dialog reserves an order, requests a validated MoonPay sandbox handoff and avoids a second launch after an uncertain response. An unlaunched sell order can be managed and cancelled from transaction history. The current server advertises no sell route, so this screen is not enabled for users.

Twenty-one focused client tests and client typecheck passed. A local component preview with a simulated route was inspected at desktop and 390-pixel widths; keyboard focus moved from the route to the amount field. The preview did not contact a provider. Provider session behavior, the return-to-quote flow, MoneyGram handoff, real wallet signing and end-to-end cash-out remain open. U1, U2 and U4 are not complete.

### 29 October 2026: cash-out quote to review

For a started sell order with a matching advertised route and an awaiting-user or processing provider state, transaction history can request a quote. The client sends the saved quote ID and confirmation hash to prepare the transfer, then opens the existing review screen. A failed quote can be retried; an uncertain preparation response directs the user back to transaction history rather than automatically preparing another transfer. The wallet is not asked to sign until the user confirms in the review screen.

Focused component tests cover the quote-to-review path, unavailable quotes, lost preparation responses and duplicate effect execution. Client typecheck passed. A simulated error-state preview was inspected at desktop and 390-pixel widths with keyboard focus. No real route, quote or wallet signature was used. Provider-specific readiness and status mapping, a verified quote adapter and the complete real sandbox flow remain open; U2 and U4 are not complete.

### 29 October 2026: cash-out balance and reserve checks

Cash-out preparation and authorization now read the Testnet account and ledger and check spendable USDC, the exact issuer and trustline authorization, XLM liabilities, account reserve and network fee using integer units. A fresh review withholds the unsigned transaction if those checks fail and displays an actionable reason. Existing submitted attempts remain available for reconciliation. Chain submission remains authoritative because balances and fees can change after a read.

Focused server tests covered insufficient USDC after liabilities, wrong or unauthorized trustlines, the XLM reserve boundary, malformed account data and changed fees. The isolated PostgreSQL recovery suite, cash-out component tests and client/server typechecks passed. Live Testnet reads confirmed that the account and ledger endpoints expose the fields used; no cash-out was submitted. Provider verification and real wallet signing remain open.

### 29 October 2026: Dynamic Sandbox account check

The dated browser results are in [Local Sandbox account verification](core-lifecycle-evidence/local-sandbox-checkpoint-2026-10-29.md). The local app used an isolated PostgreSQL clone, Dynamic Sandbox identities for Ngoni and Kwame, and Stellar Testnet wallet data. The readiness endpoint reported a healthy database and applied schema groups.

Kwame's account showed the existing Core Journey purchase and prior USDC receipt. The accepted 70/30 agreement, purchase, settlement funding, and claims remain the historical Testnet transactions recorded in [E8](core-lifecycle-evidence/README.md). This run did not create a new purchase, claim, or other wallet transaction. A separate new Sandbox listener completed onboarding but had no Testnet funds or USDC trustline.

The wallet showed MoonPay and MoneyGram as unavailable. Add funds and Cash out stayed disabled, and history showed only a cancelled local GBP fixture. The application created no provider session or quote. The local admin page still required an admin sign-in, so this run did not verify a new admin browser session.

The same browser check found that the wallet summary initially rendered `0` balances and an enable-USDC prompt while Horizon was still loading. The client now shows placeholders during that request and only displays trustline status after a response. The account page and a read-only Horizon query then agreed on the wallet's 9,999.9969 XLM and 0.0073 USDC. No funds were moved. This is a wallet loading-state correction; it does not enable a ramp route.

The cloned database had no audio files. Disposable synthetic tones restored playback checks without using real recordings. Playback then completed in the local app. This exposed and fixed the short-track stream fallback under commit `1e49dfd`; a one-second play did not count, and a six-second play counted once. That product fix is separate from the SOW 2 ramp scope.

`pnpm test` passed 215 server, 194 client, and 22 admin tests. The default server suite skipped 13 database-backed tests. Workspace typechecks and builds passed. The browser state was inspected, but this run did not save a screenshot file. C2, C3, U2, U4, R1 through R9, and V5 remain open. No provider sandbox payment or payout was verified.

### 29 October 2026: two fresh Dynamic Sandbox test accounts

The [test-account run](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md) used separate artist and listener identities. The artist published a synthetic single, and a completed playback increased its stream count from zero to one. The listener saw the release, opened playlists, and received an explicit 403 when opening the artist-only editor.

The browser exposed a server error for an empty playlist list before onboarding finished and a 500 for a listener opening the artist editor. Playlist reads now return an empty list before profile creation. Artist-only access failures now return 403. Twelve focused server tests and server typecheck passed. Local browser retests confirmed the listener playlist page and the readable artist-access denial.

The artist's XLM test wallet was funded through Friendbot, but the Dynamic wallet approval for its USDC trustline stayed pending. The test account had no USDC, and MoonPay and MoneyGram had no verified routes. No purchase, settlement, claim, provider session, quote, payment, or payout was created. C2 and U4 remain open.

### 29 October 2026: Sandbox account follow-up and track-list correction

The follow-up account evidence is in [Local Sandbox account verification](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md). Against the isolated local database, the artist account now showed the Testnet USDC trustline as active, 0 USDC, and 9,999.99999 XLM. The track's qualified playback advanced the stream count from one to two. The Revenue view remained at zero available and pending earnings with no purchases; both ramp actions remained disabled because neither provider had a verified route.

Account testing exposed stale release membership on the artist track list: the release detail and track detail showed an assigned release, but the list showed `Not in a release`. The list API now hydrates membership from the authoritative release-track relation in one batch, and the local browser retest showed the correct release title. Focused server tests, the full workspace suite, typechecks, and builds passed. The default runner still skips 13 database-backed tests.

The separate listener identity signed into Dynamic Sandbox and saw the published release once in Discover, normal empty playlist and agreement states, and the artist setup gate on direct studio access. The listener's unfunded Testnet wallet had no USDC trustline, so funding, cash-out, and trustline actions stayed disabled.

The Circle Testnet faucet required a reCAPTCHA challenge, which was not completed. The wallet therefore received no USDC and this run created no purchase, settlement, claim, or payout. C2 remains open. The full mobile and interaction browser matrix remains open under U4; provider sandbox outcomes remain open under V5.

### 29 October 2026: reloadable ramp transaction details

Wallet transaction history now opens a saved order at `/account?ramp=<orderId>`. The authenticated detail request is owner-scoped; the app refreshes it on open and every 15 seconds, preserves the last saved state during a failed refresh, and lets the user close the detail with browser Back. Provider and Stellar statuses remain separate, with explicit copy that provider completion alone does not confirm delivery or payout. The order ID is safe to share only within the signed-in app because the server still enforces both account and wallet ownership.

Computer use verified the real local artist account and wallet page against an isolated database row seeded only for this visual check, then removed that row. The page displayed the saved order, method and amount, provider completion, unconfirmed Stellar delivery, and a manual status refresh. The seeded state was simulated; no provider request, wallet signature, or chain transaction occurred. Sixteen focused wallet-ramp tests and the full client suite (196 tests), client typecheck, and diff check passed. U2 has this detail/recovery slice but remains open for verified quote and provider journeys; mobile and keyboard acceptance remain open under U4.

### 29 October 2026: Revenue cash-out entry point

Commit `19550fe` adds the wallet's spendable USDC and the existing funding/cash-out actions directly to Revenue, visibly separate from claimable earnings. It reuses the Account flow and wallet signer; transaction history remains on Account. Empty verified capabilities now have a clear unavailable state, and failed capability requests can be retried. The new component tests verify issuer-scoped spendable USDC and retry behavior. The full client suite passed 199 tests, client typecheck passed, and the production build passed with the existing large-bundle warning. Authenticated desktop review is now recorded below. No provider route or financial transaction was created.

### 29 October 2026: provider-independent ramp routes and concurrency checks

Reviewed the current authenticated ramp API and launch path. Capability, creation, history, detail, cancellation and launch/resume operations are session protected and owner scoped. Order terms are selected from server-verified routes; provider URLs and launch parameters are server built and validated. Persisted request IDs return the original order on retry, duplicate reservations and launches serialize, and unresolved launched orders block another transaction. Provider routes intentionally remain empty until an account-specific route is verified.

Ran all ramp and cash-out server tests against the isolated local `sow2_current_demo_test` PostgreSQL database. The suite passed 65 tests with no skips, including persistence, ownership, concurrent idempotency, append-only events, worker restart and unknown-outcome recovery, cash-out quote/transfer validation, provider callback checks, and chain receipt verification. This completes R1, R2, CO-23, and CO-24. The repository test seeds an approved and a previously paid royalty entry plus an existing funded claim batch, snapshots the ledger, claim/reservation/event records and financial attempts, then asserts the complete ramp and cash-out lifecycle leaves those records unchanged. R3-R9 and real provider flows remain open.

### Local Sandbox test-account review, 29 October 2026

The local client had been loading Dynamic environment `36b4587d…`, which the Dynamic console labels Live, while the local API was already configured for Sandbox `2bf133b3…`. Before attempting sign-in, the client was switched to the matching Sandbox with an ignored `client/.env.development.local` containing only public localhost and environment settings. A normal Vite restart then served the Sandbox ID, and the existing Kwame Sandbox test session restored. No credentials were entered or submitted in Live. Dynamic Test Accounts remain disabled and unchanged; this check used the existing session rather than static OTP.

Revenue showed spendable wallet funds (`0.0073 USDC`) separately from unclaimed earnings (`0.00 USDC`), the missing treasury/finalized-split registry reason, and disabled Add funds/Cash out because no verified provider route is enabled. Account showed the test wallet balances (`9,999.9969 XLM`, `0.0073 USDC`) and an existing cancelled GBP fixture. Its detail showed MoonPay `Cancelled` and Stellar `Transfer unconfirmed`; manual refresh and full page reload preserved the separate states. No provider payment, new order, or wallet transfer was created. The fixture is local, not a real MoonPay outcome.

Current verification: client tests `199/199`, admin tests `22/22`, server tests `218 passed / 13 skipped` (default-runner database skips), focused ramp/cash-out isolated-PostgreSQL suite `65/65`, workspace typecheck passed, and workspace production build passed with the existing large-client-chunk warning. CO-22/U4 remain open for the full responsive, keyboard, slow-request and end-to-end browser matrix; a second account and real provider quote, launch, payment, signing, payout and refund remain unverified.

### 29 October 2026: Sandbox account playlist deep-link recovery

The signed-in Dynamic Sandbox artist account created a private test playlist, added a synthetic catalog track, and verified the playlist persisted after reload. The first direct reload briefly showed "Playlist not found" while the session and playlist were still resolving. `PlaylistManageOverview` now keeps a loading state while auth initializes and restarts its data load when the session token changes, avoiding the false missing-record state. A regression test covers the auth-to-record transition, and a computer-use reload showed loading followed by the saved playlist. Qualified playback of the synthetic eight-second track increased its stream count from three to four. The player then auto-advanced to a cloned catalog track whose local media is absent; this remains a test-database asset limitation documented in the evidence file.

The client suite passed `201/201`, and client typecheck passed. Account Revenue still shows zero funds and no provider routes, so Add funds and Cash out are disabled. The local admin frontend reaches first-admin setup and requires the operator's setup token; no token was used. The worker browser path, remaining responsive/keyboard/recovery matrix, fresh purchase-to-claim journey, and genuine provider transactions remain open. CO-25 and U4 are still incomplete; see the [test-account follow-up](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#sandbox-test-account-lifecycle-follow-up-29-october-2026).

### 29 October 2026: listener account role checks

Created a second synthetic Dynamic Sandbox identity and completed listener-only onboarding. Revenue showed no verified ramp routes and kept both actions disabled. The listener saw the artist setup gate on Studio overview, Create, Tracks, Releases, and Analytics. Agreements and playlists loaded their expected empty states, Discover stayed available, and a direct request for the artist's private release showed the artist-access message. Both synthetic accounts signed in again successfully, and the browser logged no console errors during the listener route matrix. The earlier first-login missing-wallet response did not recur, but remains an open issue because it was observed on initial onboarding. The browser was restored to the original artist's private draft, which still showed all saved and ready-to-publish checks. No provider or wallet transaction occurred. CO-25, U4, and C2 remain incomplete; see the [listener role recheck](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#listener-role-matrix-recheck-29-october-2026).

### 29 October 2026: unsupported buy-route handoff guard

The add-funds dialog validates only MoonPay's sandbox URL, but the capability response was passed through for every buy provider. The client now hides buy routes for providers without an implemented, validated handoff. A regression test supplies both MoonPay and MoneyGram routes and verifies that only MoonPay appears. The focused ramp activity suite passed 19/19 and client typecheck passed. Computer use on the real local artist account showed the expected no-verified-route message and disabled Add funds and Cash out controls. No provider route or transaction was available. U2 remains open for real quote, launch, and status journeys; this guard prevents unsupported options from appearing when another server adapter becomes available.

### 29 October 2026: retrying an ambiguous ramp request

Funding and cash-out order creation now treats a network failure or server response without a definite validation rejection as an unknown outcome. The form freezes the selected route and amount and retries with the same request ID, allowing the server's idempotency check to return an already-saved order instead of creating a second one. Only input-validation responses (HTTP 400/422) unlock correction and rotate the request ID; conflicts and auth errors remain uncertain because a previous order may exist. Regression tests cover safe retry and correction after rejection for both flows.

The focused ramp UI tests passed 29/29, the full client suite passed 207/207, client typecheck passed, and `git diff --check` passed. Computer use checked both Dynamic Sandbox identities across their available routes. Artist Studio, account, playlist, agreement, support, and public discovery pages loaded without application errors. Revenue resolved to 0 USDC and no verified provider route; Account resolved to an unfunded Testnet wallet with 0 XLM/USDC and disabled trustline, send, funding, and cash-out actions. The synthetic release remained private and ready to publish. The listener could open Discover, agreements, and playlists; artist-only pages showed the setup gate; and direct access to the artist draft was denied. The browser was restored to the artist's private draft. No financial or wallet transaction was attempted. U2 remains open for verified quotes and provider handoff/status journeys, while U4 and C2 remain open for the remaining browser matrix and a fresh purchase-to-claim run.

### 29 October 2026: evidence package and local schema readiness

The core lifecycle evidence README separates the historical 17 October E8 Testnet receipts from the current `c4dc6a6` local checkout. Local client and API endpoints responded, and `/api/v1/health/ready` returned HTTP 200 with the database, schema, local storage, and all 28 registered schema groups healthy. The current client evidence is 212/212 tests and a passing client typecheck; the current checkout is not deployed. The provider capability snapshot and account evidence are linked from the package. C3 stays open because current deployed versions are unavailable to verify, and C2 stays open because no current purchase-to-claim journey has been completed.

### 29 October 2026: test-account mobile revenue check

Using the signed-in Dynamic Sandbox artist account, computer use checked Revenue at 390 x 844. The page fit without horizontal overflow, showed the zero balances and no-verified-route explanation, and kept Add funds and Cash out disabled. The compact Studio navigation opened and closed with Escape returning focus to its trigger; no browser console errors appeared. The viewport was reset and the browser returned to the saved private release draft. No provider or wallet transaction was created. This advances only part of U4; real quote/review/handoff screens, launched-order cancellation, and slow-request browser recovery remain unverified. C2 remains open for a fresh current-code purchase-to-claim journey.

### 29 October 2026: fresh Sandbox artist and listener recheck

The fresh account run is recorded in [Sandbox test-account evidence](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#fresh-dynamic-sandbox-account-check-and-playback-29-october-2026). A synthetic Dynamic Sandbox artist alias completed onboarding and saw the $0 EARLYUSER activation offer; the existing listener Sandbox identity loaded account, agreements, playlists, Discover and Revenue, with artist-only tools gated. Both wallets had no spendable test funds and no verified provider routes; Add funds and Cash out stayed disabled.

The listener played the synthetic eight-second lifecycle track. The clone was missing the local WAV, so only that synthetic fixture was regenerated. Playback completed and the displayed stream count increased from four to five once. The local server URL mismatch was corrected, and the SOW 2 preflight now checks that `APP_BASE_URL` points to the API origin because signed playback URLs are built from it. The focused preflight suite passed 3/3. No provider, payment, payout, trustline, claim, wallet signature, or chain transaction occurred. This does not close C2 or U2; U4 remains open for the remaining browser matrix, and R3-R9/V5 remain provider-dependent.

The first attempted API startup used the root `.env` and reached the Railway database before the host mismatch was detected. Startup runs schema initialization before listening, so whether that startup applied a remote migration or repair is unknown. The process was stopped, and all subsequent tests used the local Music City test database. Remote schema state was not checked.

### 29 October 2026: first-login Stellar wallet recovery

Dynamic can authenticate a new user before its embedded Stellar credential appears in the verified credentials. The previous sign-in action opened an empty wallet picker. Commit `e863be9` replaces it with `Check wallet again`, which refreshes Dynamic's user profile and retries Music City's session when the Stellar credential appears.

Computer use reproduced the delayed-credential state with a new Sandbox identity. The retry completed sign-in, and the account finished seven onboarding steps with artist access and the $0 EARLYUSER offer. It uploaded synthetic audio and artwork, published a synthetic single in the isolated local database, and played the eight-second track. Discover showed the release once, and its stream count changed from zero to one. After playback, the track page incorrectly retained the `Playing` label while the global player showed Play at 0:08. Commit `c4dc6a6` fixes the label, and the browser confirmed Play after playback ended. Revenue showed zero USDC and disabled funding and cash-out because no provider route is verified. No provider request, payment, payout, wallet signature, trustline, claim, or chain transaction occurred.

The focused auth tests passed 6/6, the focused playback-action tests passed 6/6, the full client suite passed 212/212, client typecheck passed, and local API readiness reported all 28 schema groups healthy. This confirms wallet-sync recovery and the local artist release path. C2 remains open because no current purchase-to-claim journey has completed. U4 remains open for the remaining browser matrix. The Linear search returned no Music City SOW2 issue, and the Linear agent-context tool was unavailable; this checkpoint updates the repository evidence only.

### 29 October 2026: current Sandbox account and mobile wallet recheck

Computer use rechecked the fresh Sandbox artist's Revenue and Account pages at 390 × 844. Both fit without horizontal overflow and produced no browser errors. The unfunded Testnet wallet showed 0 XLM and 0 USDC; trustline, send, Add funds, and Cash out stayed disabled. Revenue explained that no provider route is verified. Desktop Tab navigation reached the wallet history link and skipped disabled actions; the mobile navigation opened and Escape restored focus. Reloading Revenue preserved the Sandbox session, and `/dashboard/releases` showed the persisted synthetic single once. No account or financial data was changed and no provider, wallet, or chain transaction occurred. See [the current Sandbox account recheck](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#current-sandbox-account-surface-recheck-29-october-2026).

This extends only the account and unavailable-route portion of U4. Provider quote/review/handoff, launched-order cancellation, slow/interrupted browser recovery, authenticated admin and worker checks, and a current purchase-to-claim run remain open. The account has no Testnet USDC and provider routes are disabled, so these Sandbox login tests cannot complete C2 or provider acceptance.

### 29 October 2026: local admin sign-in check

The local admin frontend was started with an explicit localhost API origin. Its `/auth` route showed the Login form, indicating first-admin bootstrap was already complete in this database. At 390 × 844 there was no horizontal overflow, the keyboard order was Email, Password, Show password, then Sign in, and the browser error log was empty. No credentials were entered and no authenticated view was opened. The frontend was stopped after the check. The financial worker was not running and was not verified. CO-25 and U4 remain open for authenticated admin and worker checks.

### 29 October 2026: shared sell-route capability gate

Fixed two gaps in the off-ramp capability path. The operational filter now accepts only a verified MoonPay USDC sell route when `RAMPS_SANDBOX_SELL_ENABLED=true`, the sandbox launch configuration is valid, and the cash-out envelope key is present. Buy routes continue to use the separately configured buy asset. Cash-out quote and authorization routers now use the same operational capability source as route listing and launch. `MoonpaySandbox` likewise validates the configured asset for buys and USDC for sells, so an XLM buy configuration no longer rejects a USDC cash-out order.

Regression tests passed `17/17` across capability gating, MoonPay URL/lookup behavior, cash-out quote and authorization HTTP routes, and launch validation. The full server suite reported 219 passes, 0 failures, and 13 skips; server typecheck passed. Computer use on the existing signed-in Dynamic Sandbox artist account showed zero spendable USDC and no verified provider route, with Add funds and Cash out disabled. The page produced no browser errors. No provider route was advertised and no order, quote, wallet signature, or transaction was created. The test used a synthetic MoonPay catalog fixture for adapter-level USDC-sell validation; MoonPay Test Mode still reports Stellar USDC unavailable, the production verified route source remains empty, and the cash-out quote adapter map remains unconfigured. See the [sell-capability test-account recheck](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#sell-capability-gate-recheck-29-october-2026). R3-R9, U2, U4 and provider acceptance remain open.

### 29 October 2026: Sandbox test-account and financial-worker smoke

Computer use rechecked the current Dynamic Sandbox artist's release, track, analytics, agreement, playlist, discovery, and Revenue pages. The synthetic release and track were associated correctly; analytics showed one qualified stream and 100% completion. Empty agreement/playlist states rendered normally, while Revenue kept funding and cash-out disabled with no verified route. Browser errors were empty. The separate listener role matrix remains recorded in the [test-account evidence](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#listener-role-matrix-recheck-29-october-2026).

One financial-worker cycle ran against a newly initialized disposable local database with ramps and cash-out disabled. It did not submit transactions. The event index remained fail-closed because the public Stellar Testnet RPC had pruned ledgers before the contract deployment ledger: configured deployment ledger 5204451 versus RPC retention starting at 5322980. The existing demo database also held a cursor at 5310657, outside retention, and contained a funded batch; it was deliberately excluded from worker execution. The smoke database and temporary script were removed afterward. Structured RPC errors now retain their message text in the worker log and cursor error field, covered by two focused tests.

Stellar's [`getHealth` docs](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getHealth) describe the RPC retention boundary. Hubble's [`history_contract_events` schema](https://developers.stellar.org/docs/data/analytics/hubble/data-catalog/data-dictionary/bronze/history-contract-events) includes raw event XDR for historical lookup, but Hubble is read-only and batch-updated; Testnet coverage and complete contract-history availability are still unverified. Do not advance the cursor across the gap. CO-25 remains open for a verified archival/backfill source, authenticated admin review, and remaining browser cases. C2 remains open for a fresh purchase-to-claim journey. See the [dated worker and account evidence](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#financial-worker-sandbox-smoke-and-event-history-retention-gap-29-october-2026).

### 29 October 2026: current Sandbox account and full workspace verification

The local API readiness endpoint returned HTTP 200 against the loopback test database. Computer use exercised the signed-in Sandbox artist's Releases, Tracks, Analytics, Account, Royalty agreements, Playlists, Discover, Artists, and Revenue routes at 390 pixels with no horizontal overflow. Analytics showed one stream and one listener; the test wallet and earnings remained at zero, and Add funds/Cash out stayed disabled because no provider route is verified. The local workspace suite passed 221 server, 212 client, and 23 admin tests; 13 database-backed server tests are skipped by the default runner. Separate disposable-PostgreSQL lifecycle suites passed 15/15 settlements and 3/3 ramp persistence/capability tests, and `pnpm typecheck` passed.

The listener login check reached OTP entry but could not continue because Dynamic Sandbox Test Accounts currently shows off. No authentication setting was changed; the requested action-time approval to enable Sandbox test sign-in is pending. The test Account route evidence and test limitations are in [the dated Sandbox test-account report](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#local-workspace-suite-and-test-account-route-pass-29-october-2026). This does not close the listener matrix, C2, U2, U4, CO-25, or provider acceptance.

The browser attempt on port 4317 exposed a local-origin mismatch: the API allowed `localhost:3000`, and the Dynamic SDK could not fetch Sandbox settings from `localhost:4317`. The SOW 2 preflight now requires `CLIENT_ORIGIN` and `VITE_APP_BASE_URL` to be local and to match, with a regression test for mismatched ports. The runbook now starts the client on the configured Sandbox origin. `pnpm test:sow2-preflight` passed 4/4, and the direct preflight passed with the active local API port 4339, client origin 3000, local test database, Sandbox Dynamic ID and Testnet settings. This prevents the known local CORS/origin misconfiguration before a browser run; it does not verify Dynamic's second-account sign-in or provider integration.

### 29 October 2026: fresh Sandbox test-account sign-in and ramp gate

Following the user's request to test accounts, I verified Dynamic Sandbox Test Accounts was already enabled and signed in using its static-OTP test identity. No Dynamic setting was changed. The test identity completed artist onboarding with test-only details; the EARLYUSER activation offer was $0 due, with no payment. The local API readiness check returned HTTP 200. Computer use verified the signed-in artist's Dashboard, Tracks, Releases, Analytics, Royalty agreements, and Revenue pages. Tracks, releases, and agreements showed their empty states, and Analytics loaded. Revenue showed 0.00 USDC earnings, 0 USDC spendable, and no verified provider route; Add funds and Cash out remained disabled. No release, upload, provider session, quote, payment, payout, wallet signature, claim, or chain transaction was created.

Repeated Dynamic SDK `getSupportedOnramps` fetch errors appeared in the browser console while the app remained usable. Their root cause is not established. This is recorded as a local SDK/provider-lookup issue, not as a successful on-ramp test. R3-R9, U2, C2, U4, CO-25, and V5 remain open; no provider or purchase-to-claim lifecycle was verified.

### 29 October 2026: fresh Sandbox artist release, revision, playback, and analytics

On the current local app and isolated database, a fresh Dynamic Sandbox artist uploaded an eight-second generated WAV through the release editor. Local processing reached `Audio ready`; generated QA artwork was saved; the release passed review and was published locally. Playback crossed the five-second stream threshold, and a replay incremented the same track from one to two streams. The count persisted after reload, and Artist Analytics showed two total streams for the release and track.

The artist then revised the published Single into an EP, added a second WAV, reordered the two ready songs, and applied the revision. After application, the public release showed the new two-track EP. Playing the EP automatically advanced from its first eight-second song to the second. The browser reported no console errors; the mobile Analytics page and desktop public release page fit their viewports without horizontal overflow. The local QA release and assets remain in the isolated test database and storage, clearly named as QA data.

This verifies the account-authenticated creator, upload, media readiness, publication, revision, playback, repeat-stream counting, persistence, and analytics paths locally. Revenue remained zero, with Add funds and Cash out disabled. No provider route or transaction, quote, wallet signature, payout, claim, or chain submission was produced. This does not satisfy C2 or provider-specific R3-R9/V5. U4 remains open for launched-order cancellation, slow responses, and recovery.

The release audio picker now advertises only the supported audio extensions plus `audio/*`, preserving extension-based support when a mobile device omits MIME metadata. The focused uploader test, full client test suite (212 tests), and client typecheck passed. A real Android/iOS native source chooser was not available in this desktop browser run.

### 29 October 2026: Sandbox account, wallet gate, and earnings-load recovery

The client was already running on `http://localhost:3000`, but the API on `localhost:4339` had stopped. The first Revenue check therefore failed with `Failed to fetch`. I restarted the API against the disposable local PostgreSQL clone on loopback, explicitly set Dynamic Sandbox and Stellar Testnet, and cleared provider credentials. The root `.env` points to the hosted database, so it was not used as the API database. The SOW 2 preflight and `/api/v1/health/ready` both passed after the local configuration was set.

A new synthetic Dynamic Sandbox identity completed artist onboarding. The account showed the automatic $0 EARLYUSER offer, an unfunded Testnet wallet with 0 XLM and USDC, and no enabled USDC trustline or send action. The signed-in account's Tracks and Releases pages showed empty states; Analytics showed zero activity; agreements and playlists showed their empty states. Revenue showed zero spendable USDC and no verified provider route, with Add funds and Cash out disabled. No financial action or Testnet wallet transaction occurred.

Revenue exposed the internal server configuration message `Agreement treasury and finalized-split registry must be configured explicitly` even when the account had no earnings. The UI now shows a retry action, hides earnings totals while loading or after a failed load, and does not display the server's setup detail. Failed loads pause the five-second poll until the user retries, avoiding repeated 503 requests. Claim errors that indicate a server failure or lost connection now tell the user to check status before retrying. The full client suite passed 214/214 and client typecheck passed. Computer use confirmed the updated local message, disabled provider actions, and one-request manual retry with no follow-up poll after six seconds.

One Dynamic SDK `getSupportedOnramps` request still logs `Failed to fetch` in the browser while Music City authentication and local pages work. Its cause remains unverified. No Music City ramp capability is enabled, so no provider quote, session, payment, payout, or transfer can be tested. U4 remains open for the remaining browser matrix. C2 remains open for a fresh purchase-to-claim run; R3-R9 and V5 remain gated on provider access and verified behavior.

### 29 October 2026: Sandbox test-account role coverage

With the local API on port 4339 and the client on port 3000, I used Dynamic Sandbox Test Accounts for both an existing artist profile and a new synthetic listener profile. The Sandbox setting was already enabled. The listener completed onboarding, selected Kwaito, and followed a synthetic artist; Discover and listener account pages loaded, while Studio routes showed the expected artist-access gate. The existing artist's Dashboard, Tracks, Releases, Analytics, Account, agreements, and Revenue pages loaded against the isolated test database.

Both test wallets were unfunded on Stellar Testnet: 0 XLM and USDC, with trustline and send disabled. Revenue showed no verified provider route, and Add funds and Cash out remained disabled. The earnings balance still needs the local agreement treasury and finalized-split registry. The spendable balance resolved to zero after its initial loading state. Readiness returned HTTP 200 and the local Sandbox/Testnet preflight passed. No provider or chain transaction was attempted. This advances the test-account and role/access portion of U4; U4 remains open for the slow-response, launched-order cancellation, and recovery cases. C2 and provider-specific R3-R9/V5 remain open.

### 29 October 2026: funded Sandbox buyer checkout preparation

I signed into an existing synthetic buyer account with a funded Stellar Testnet USDC wallet and opened the published `Core Journey` track. The first purchase attempt revealed that the local API defaulted to XLM while the track was priced in Testnet USDC; it rejected the attempt before creating an order. The local demo preflight did not catch this mismatch or the missing treasury environment setting.

I restarted the isolated local API with Testnet USDC and the public address of the previously verified Testnet demo treasury. The preflight now checks the server settlement asset and issuer, client asset agreement, and treasury public-key format; the runbook lists the required values. The focused suite passed 4/4 and the active local configuration passed preflight. The UI then opened `Review payment` for 0.001 USDC. I stopped before wallet confirmation; no purchase was signed or submitted. A short-lived pending checkout intent exists in the isolated test database. This advances checkout preparation but leaves C2 open for wallet submission, settlement, and beneficiary claims.

Expanding payment details also showed an unsigned, unsent transaction hash labeled only `Transaction`. The review now labels it `Prepared transaction hash (not submitted)` until authorization. The focused checkout hook suite passed 6/6, client typecheck passed, and the local browser displayed the updated wording. This clarifies preparation without implying that a payment was submitted.

The browser also verified the close-and-resume behavior: the action says `Close review`, the resulting notice says `Payment review closed. No payment was sent.`, and the existing order opens again when the buyer retries. No wallet signature or Testnet transaction occurred. This covers one U4 close/reopen case; the broader browser matrix and C2 remain open.

Keyboard verification showed focus moving through the review controls and wrapping in both directions; Escape closed it with the same no-payment notice, and the buyer could reopen the review. This adds desktop keyboard and pre-sign recovery evidence to U4. Mobile, slow-response, lost-response, post-submission recovery, and C2 remain open.

### 29 October 2026: Sandbox account route check and full server suite

The signed-in Sandbox artist session opened Dashboard, Tracks, Releases, Analytics, Royalty agreements, Account, Discover, and Revenue. The API readiness check passed with all 28 schema groups healthy. The wallet showed 0.014 USDC. Earnings still need the local agreement treasury and finalized-split registry, and provider actions remained disabled because no route is verified. A stale Vite tab briefly logged an `AuthProvider` context error; reloading it and opening fresh tabs restored the pages without new console errors. No Dynamic `getSupportedOnramps` failure reproduced in the clean-tab check.

The workspace run passed 221 server, 214 client, and 23 admin tests; the default server runner skipped 13 database tests. The full server suite then passed 324/324 against a fresh disposable loopback `_test` database, with no skips. The test database was removed. `pnpm test:sow2-preflight` passed 4/4, and workspace typechecks and builds passed. The 0.001 USDC buyer review remains unsigned and unsubmitted. See the [dated test-account evidence](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#current-sandbox-account-and-full-local-verification-29-october-2026). This extends the role and route checks for U4; it does not complete C2, U2, provider-specific R3-R9, CO-25, or V5.

### 29 October 2026: cash-out claim association

The active cash-out order can now carry an optional immutable reference to an already-claimed settlement allocation. Creation rejects buy orders with the reference and rejects a cash-out unless the selected allocation is claimed by the authenticated wallet. Dedicated order columns, a foreign key, a terms-consistency constraint, and the immutable-order trigger preserve the link. This is an audit association only: it does not reserve earnings or alter the ledger, settlement batch, allocation, or claim events. The isolated PostgreSQL ramp repository test applied the migration twice and verified persistence, reference integrity, immutable terms, and unchanged financial history. The shared schema also rejects claim references on buy orders. A fresh disposable database applied all 28 schema groups and passed migration health checks.

The workspace run passed 224 server tests, 214 client tests, and 23 admin tests; 12 unrelated database-only server tests were skipped. Workspace typecheck and production build passed with the existing large-client-chunk warning. Focused cash-out service tests passed 5/5, and the isolated PostgreSQL ramp repository test passed 3/3.

Computer use checked the signed-in local Dynamic Sandbox artist on `/dashboard/releases`, `/dashboard/revenue`, and `/account`. The release list loaded with its saved drafts and published release. Account showed a 0.014 USDC Testnet balance. Revenue showed the same spendable balance, but earnings could not load because the local settlement treasury configuration is missing. No verified provider route was available, so Add funds and Cash out remained disabled. No provider session, quote, wallet signature, payout, or chain transaction was created. This closes CO-07's durable source-wallet and optional claim-association requirement; it does not complete U2, provider-specific R3-R9/V5, C2, or the remaining U4/CO-25 browser matrix.

### 29 October 2026: test-account onboarding and role verification

The existing local Sandbox artist and a separate synthetic listener account were exercised in the browser. The listener's artist selection now creates a durable, idempotent follow; before the fix, onboarding stored the recommendation but the artist profile still showed an unfollowed state. The listener role gate, private playlist creation and reload persistence, public playlist privacy, and empty/disabled ramp states also behaved as expected. Focused engagement and onboarding service tests passed 26/26, onboarding UI tests passed 7/7, and the final workspace run passed 225 server, 214 client, and 23 admin tests (13 opt-in PostgreSQL tests skipped). Typecheck and production build passed. This is additional partial CO-25/U4 evidence; the admin/worker browser matrix, provider journeys, remaining recovery and responsive checks, and fresh purchase-to-claim acceptance remain open. See [listener onboarding follow persistence](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#listener-onboarding-follow-persistence-29-october-2026).

### 29 October 2026: Revenue mobile check and full database suite

At 390 pixels, Revenue showed no horizontal overflow, kept the spendable wallet balance separate from earnings, and clearly disabled funding/cash-out actions without a verified route. Keyboard focus moved from earnings retry to transaction history. Earnings still require the local treasury/finalized-split configuration. The workspace suite passed 225 server, 214 client, and 23 admin tests; typecheck and build passed. The complete server suite then passed 328/328 against a fresh disposable PostgreSQL database with all opt-in integration tests enabled and zero skips. The database was removed. This strengthens CO-26 and partially extends U4/CO-25; see the [dated account evidence](core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md#revenue-mobile-and-full-server-database-suite-29-october-2026). Admin browser verification, remaining responsive/recovery coverage, provider journeys, and fresh creator-to-claim acceptance remain open.

### 29 October 2026: automatic ramp status refresh

The ramp UI polls transaction history and an open transaction detail every 15 seconds, and refreshes a submitted or uncertain cash-out transfer every 5 seconds. New client regression tests advance those intervals and verify that `Processing` changes to `Provider completed` in history and detail, and that `Submitting` changes to `Transfer confirmed` in the cash-out review without a manual refresh. All seven ramp UI files passed 45/45 tests; the full client suite passed 216/216 and client typecheck passed. This verifies local polling behavior, not a live provider status transition. U2/CO-20 remain open for actual provider progress, payout instructions/receipts, and full browser recovery acceptance.

### 29 October 2026: test-account mobile Revenue recheck

In a temporary local browser tab with the signed-in Dynamic Sandbox artist, Revenue at 390×844 had a 375-pixel document width and no horizontal overflow. Spendable balance resolved to 0.014 USDC; Add funds and Cash out stayed disabled with the no-verified-route explanation. Keyboard Tab from the earnings retry button focused wallet history. The browser viewport was reset and the temporary tab closed. This extends CO-22/U4 mobile and keyboard evidence; authenticated admin, provider dialog focus return, and the complete validation/interruption matrix remain open.

At the same mobile width, Overview, Create, Tracks, Releases, Analytics, Royalty agreements, Revenue, and Account all rendered their expected headings without horizontal overflow or a `Failed to fetch` message. The widest document was Royalty agreements at 390 pixels; the other routes measured 375 pixels. CO-22 remains open for the authenticated admin UI and complete modal/failure matrix.

### 29 October 2026: artist and isolated admin test-account browser pass

Computer use rechecked the local client with the existing Dynamic Sandbox artist account. Overview, Tracks, Releases, Analytics, Royalty agreements, Account, and Revenue rendered. The account wallet resolved after its loading state to 9,999.9979448 XLM and 0.014 USDC. Revenue still showed the earnings retry state because the local agreement treasury/finalized-split registry is unavailable; wallet funds resolved, and Add funds and Cash out remained disabled because no verified route is enabled. The browser had no application errors; a LaunchDarkly SDK warning was present. Prior listener-account role and route evidence remains in the dated test-account record.

For admin verification, a fresh loopback-only PostgreSQL database applied all 28 schema groups. The unauthenticated ramp-list request returned 401. A synthetic first-admin account was created in the disposable database through the browser, and the authenticated `/console/ramps` page showed the expected empty transaction state. At 390 × 844 the page had no horizontal overflow or browser errors. The temporary database, credentials, API, and frontend were removed or stopped after the check. No provider order, quote, wallet signature, payment, payout, or chain action occurred. This closes the authenticated-admin portion of U4 for the empty state only; the wider interruption/recovery matrix, processing of a queued provider transaction, provider journeys, and C2 remain open.

### 29 October 2026: independent financial worker tasks

The financial worker previously required settlement-contract configuration before starting, which prevented unrelated ramp and cash-out reconciliation when that configuration was missing. Startup now retries settlement readiness in the background; settlement reconciliation stays skipped until its configuration verifies. Worker tasks are isolated so a failure in one subsystem does not stop later tasks. Focused worker, ramp, and cash-out tests passed 26/26, and the server typecheck and production build passed. A compiled-worker smoke against a fresh disposable PostgreSQL database applied all migrations, started without settlement configuration, logged that independent ramp/cash-out jobs would continue, and remained running. The queue was empty, so no provider request, wallet signature, or chain transfer occurred. This verifies scheduling and task isolation only; R5, CO-25, and provider acceptance remain open for real transaction progression and the remaining browser matrix.
