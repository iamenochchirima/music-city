# SOW 2: core completion and ramp integration plan

This plan tracks the work requested on 28 October 2026. The [SOW 2 tracker](sow-2-tracker.md) remains the source of deliverable status. The [provider sandbox plan](ramp-sandbox-implementation-plan.md) retains provider-specific requirements. Provider acceptance and live fiat enablement remain open until supported routes and real provider outcomes are verified.

## Completion criteria

Music City exposes a locally tested, authenticated funding and cash-out lifecycle with durable state, recovery, wallet authorization and clear user and admin views. Provider-specific behavior is implemented only where verified. Test fixtures remain confined to tests and isolated local environments. Unavailable routes cannot create payable orders. SOW core evidence and outstanding checks are reconciled with the tracker. Reviewer acceptance and production release require separate actions.

## Baseline and design

- [x] B1. Inspect current changes, workspace instructions, shared contracts, ramp migrations, repository, MoonPay adapter, cash-out validator, worker, authentication, and Revenue UI. Record any conflicting behavior and preserve unrelated work.
- [x] B2. Define state transitions and a provider interface using actual requirements, including separate provider and chain outcomes, exact amounts, ownership, expiry, and recovery. Reuse or replace existing overlapping contracts deliberately.
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
- [x] V2. Run affected server, client, admin and shared tests, workspace typechecks, builds, and fresh and existing database migrations. Recheck agreements, support, checkout, claims and settlements.
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
