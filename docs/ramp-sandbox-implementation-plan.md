# Implement MoneyGram and MoonPay sandbox flows

Agreed scope: 26 October 2026. Code baseline: `5190cd9` on `main`.

Deliver four working journeys through the local Music City client, API, database, admin, and financial worker. Use real provider sandboxes and Dynamic Sandbox wallets. Keep production fiat transactions disabled.

This plan supplies the implementation detail for the provider-readiness work in [the SOW 2 tracker](sow-2-tracker.md#separately-scoped-provider-readiness-and-budget). It replaces the earlier MoneyGram-first, cash-out-only work order. It does not change the submitted SOW or record its acceptance. Keep the existing CO checklist as the detailed cash-out requirements and link its evidence to this plan.

## Current execution decision

The owner deferred MoneyGram until its partner mode is resolved. Focus current execution on MoonPay. The owner also approved a separate native XLM sandbox buy and sell demonstration because MoonPay reports `supportsTestMode: false` for `usdc_xlm` and `true` for `xlm`. This does not complete Stellar USDC acceptance or authorize a production asset change. Keep the MoneyGram requirements below for resumption.

## Deliver the four journeys

| Journey | User experience | Acceptance boundary |
| --- | --- | --- |
| MoonPay buy | Select **Add funds**, review the provider quote, complete identity and test payment, then return to wallet status. | A real sandbox order reaches its documented result. Verify delivery to the bound wallet if the sandbox supplies a chain transfer. Label simulated delivery explicitly. |
| MoonPay sell | Select **Cash out**, choose an available online payout method, review the quote, authorize the exact crypto deposit, then track the payout. | The provider confirms the sandbox payout result. Prove the transfer where the sandbox supports it. A deposit receipt alone is not a completed payout. |
| MoneyGram cash-in | Select **Deposit cash**, choose a supported location, and obtain instructions. Complete the provider's sandbox counter-payment procedure. | Verify provider payment and wallet delivery where supported. Obtaining instructions or finishing the widget does not establish receipt of funds. |
| MoneyGram cash-out | Select **Collect cash**, review the quote, authorize the exact USDC transfer, then receive pickup instructions. | Verify the transfer, pickup readiness, and the separate sandbox collection result. A reference number alone does not establish collection. |

Prioritize MoonPay's online flows. Keep MoneyGram's physical cash options lower in the choice list, with their physical visit stated before the user starts. Users can choose country, currency, and method from verified options. Start verification with one supported combination per journey, then add combinations with evidence.

## Establish the current baseline

- [x] R-01 Inspect the existing shared cash-out contracts and Stellar transfer validator. `packages/shared/src/cashout.ts` defines requests, quotes, money, sessions, and states. `server/src/modules/cashout/cashout-transfer.ts` validates part of the outgoing transfer. Neither establishes a provider integration.
- [x] R-02 Carry forward the dated credential checkpoint. The 25 October tracker records MoneyGram sandbox authentication and locally configured MoonPay test keys. This is historical evidence, not a fresh capability test.
- [x] R-03 Confirm the agreed delivery order: MoonPay online funding and withdrawals first, followed by MoneyGram cash deposits and collection. Both providers and both directions remain in scope.
- [ ] R-04 Capture a fresh, redacted readiness report for both accounts. Check authentication, enabled products, allowed local origins, and sandbox callback configuration without printing keys or customer history.
- [ ] R-05 Build a capability table for each provider and direction. Record country, fiat currency, payment or payout method, minimum, maximum, precision, asset, issuer, network, identity requirements, and verification date. Use account APIs where available. Record documented or dashboard-only checks explicitly.
- [ ] R-06 Verify Stellar USDC buy and sell separately for MoonPay. Verify MoneyGram's cash-in and cash-out combinations separately. General provider coverage does not establish account-enabled support.
- [ ] R-07 Record what each sandbox simulates, which network it uses, how transactions advance, and whether it delivers actual test assets. Do not send Testnet assets to an unverified or mainnet deposit address.
- [ ] R-08 Select one verified country, currency, and method for each of the four initial browser journeys. Do not hardcode that selection as the only product option.

If an account cannot support a required Stellar USDC journey, keep that journey open with the provider response and exact missing prerequisite. Do not silently switch chains, add a bridge, or substitute a different asset. An unrelated ETH sandbox demonstration does not complete Music City's USDC integration.

## Build the shared backend and persistence

- [x] R-09 Add validated sandbox configuration for both providers. Keep secret and webhook keys server-side. Permit only the intended provider hosts and callback destinations. Reject sandbox credentials in production fiat mode.
- [ ] R-10 Extend shared contracts for funding and withdrawals. Include direction, provider, environment, market, exact money amounts, wallet, quote expiry, provider references, chain attempts, and independent provider and chain statuses. Preserve the completed CO-06 contracts where they fit.
- [x] R-11 Add migrations for ramp transactions, quote snapshots, chain attempts, provider events, and reconciliation jobs. Use unique request and provider identifiers. Keep existing earnings, claims, entitlements, and payments intact.
- [ ] R-12 Define provider adapters for capabilities, session creation, order lookup, status normalization, and notification verification. Implement distinct MoneyGram and MoonPay behavior behind those operations. Do not add unimplemented provider stubs or automatic provider substitution.
- [ ] R-13 Add authorized capability, create, detail, resume, and history endpoints. Derive user and wallet from the authenticated session. Enforce ownership on every endpoint and bind each provider order to its intended direction and environment.
- [ ] R-14 Persist the request and correlation identifier before opening the provider. Serialize duplicate creates. Recover an existing order after a lost response. If the provider outcome is unknown, reconcile it before permitting another order.
- [ ] R-15 Bind quotes and transfer instructions to authoritative provider data. Review exact debit, fees, expected proceeds, destination, network, issuer, memo, and expiry before outgoing authorization. Changed terms require new confirmation.
- [ ] R-16 Reuse and complete the Stellar transfer validator for outgoing USDC. Allow only the operations required by the verified provider flow. Persist the signed envelope and hash before submission and recover the original hash after a timeout.
- [ ] R-17 Add authenticated provider notification endpoints using each provider's documented verification rules. Deduplicate events, validate transaction ownership, and retain original provider statuses. Treat browser callbacks as progress hints rather than proof of payment.
- [ ] R-18 Extend the financial worker to reconcile both providers and directions. Use bounded retries and provider rate limits. Recover missed notifications and interrupted submissions without requiring the browser to remain open.
- [ ] R-19 Reconcile incoming delivery with the correct wallet, asset, issuer, network, amount, and chain receipt when available. Refresh the actual wallet balance. A provider simulation must not manufacture spendable balance, artist earnings, revenue allocations, or a purchase entitlement.
- [ ] R-20 Implement expiry, cancellation, failure, and refund handling per provider and direction. Distinguish a pending refund from confirmed return of funds. Preserve the original order and transfer history. A cash-out failure does not reverse an already confirmed earnings claim.

## Connect MoonPay buy and sell

- [ ] MP-01 Implement backend creation of wallet-bound buy and sell sessions or signed widget URLs using the account's supported SDK and API version. Restrict signing to server-built parameters and approved URLs. Reject arbitrary client-provided URLs.
- [ ] MP-02 Embed the sandbox buy flow with the verified Stellar USDC asset code and bound destination wallet. Use provider test identities and payment instruments. Handle verification, rejection, cancellation, expiry, and return navigation.
- [ ] MP-03 Persist and verify the buy order's authoritative status. Confirm actual test-asset delivery if provided. Keep provider order completion, chain delivery, and balance refresh distinct.
- [ ] MP-04 Embed the sandbox sell flow with an available payout method. Fetch and validate the exact deposit instructions. Use the linked Dynamic wallet for outgoing authorization when the provider's sandbox supports a genuine Stellar transfer.
- [ ] MP-05 Verify sell status through provider notifications and authenticated lookup. Show completion only on the documented payout result. Exercise the supported refund or failed-payout procedure and record any simulation limit.
- [ ] MP-06 Complete both MoonPay browser journeys locally. Save sanitized provider references, state transitions, transfer receipts where supported, and screenshots. Keep each journey open if its required capability is unavailable.

## Connect MoneyGram cash-in and cash-out

- [ ] MG-01 Create Stellar sessions on the backend with the sandbox secret key and authenticated wallet. Embed the supported non-custodial widget on an allowed local origin. Keep sandbox and production sessions separate.
- [ ] MG-02 Connect cash-in mode. Persist its order reference early, show the location and payment instructions, and resume the same order after closing the widget. Do not require an outgoing wallet signature for the standard cash-in path.
- [ ] MG-03 Use MoneyGram's supported sandbox procedure to advance the simulated counter payment. Verify authoritative payment status and wallet delivery where provided. Do not label the widget's done screen as money received.
- [ ] MG-04 Connect cash-out mode. Validate the sign request against trusted instructions, including the exact Stellar memo. Obtain Dynamic authorization and recover the original transfer if submission is interrupted.
- [ ] MG-05 Show pickup readiness separately from collection. Verify the provider's terminal sandbox status, and exercise its supported cancellation or refund path. Keep reference numbers out of public logs and screenshots.
- [ ] MG-06 Complete both MoneyGram browser journeys locally. Record references in protected evidence, redacted screenshots, chain receipts where supported, and which counter or collection outcomes were simulated.

## Complete the user and admin interfaces

- [ ] UX-01 Add **Add funds** beside the wallet balance and **Cash out** for spendable funds in Revenue. Keep funds still awaiting an earnings claim separate from funds already in the wallet. Reuse the existing claim flow first when necessary.
- [ ] UX-02 Show available online methods first and physical cash methods second. Filter country, currency, and method choices by provider and direction. Show a concise reason for an unavailable selection. Never present an unverified option as available.
- [ ] UX-03 Use a short sequence: method and amount, provider verification and quote, authorization if required, then status. Keep identity documents and card or bank entry inside the provider flow. Retain the user's place when they cancel.
- [ ] UX-04 Show progress automatically through polling of local transaction status or the existing event mechanism. Provide a resumable transaction URL and history. Reopening an order must not create a new payment or request another completed signature.
- [ ] UX-05 Add authorized admin list and detail views for both directions and providers. Include original provider status, chain receipt, event history, refund state, and reconciliation exceptions. Ordinary admins cannot mark transactions paid or send user funds.
- [ ] UX-06 Verify desktop and 390-pixel layouts through computer use. Test keyboard navigation, focus return, hosted overlays, loading states, errors, Back, reload, and resuming after sign-in. Keep technical details in a disclosure.

## Run the acceptance tests

For each test, record the source commit, date, environment, actor, expected result, observed result, and evidence location. Run the four success journeys through the real local app and provider sandbox. Use automated fixtures only for identified fault cases.

| ID | Scenario | Required evidence |
| --- | --- | --- |
| T-01 | Compare available countries, currencies, methods, assets, and limits for both directions. | Choices match dated account capabilities. An unsupported or disabled combination cannot create an order. |
| T-02 | Complete MoonPay buy with its documented test payment. | The bound wallet, quote, order reference, and authoritative provider outcome match. Distinguish simulated delivery from a chain receipt. |
| T-03 | Complete MoonPay sell with its documented test payout. | Deposit instructions and any actual transfer match the quote. The provider payout result is distinct from the crypto deposit result. |
| T-04 | Complete MoneyGram cash-in using its documented counter simulation. | Instructions alone leave the order awaiting payment. Provider payment and delivery have separate evidence. |
| T-05 | Complete MoneyGram cash-out using its documented collection simulation. | Exact USDC transfer and memo where supported. Pickup readiness and collection remain different states. |
| T-06 | Cancel identity verification, payment, or Dynamic signing. Expire a quote and request changed terms. | No premature credit or outgoing transfer. New financial terms require new confirmation. |
| T-07 | Enter zero, negative, excessive-precision, below-minimum, above-limit, and insufficient-balance amounts. | Inline validation and matching backend rejection. No invalid payable order persists. |
| T-08 | Repeat create and submit requests, lose responses, close the browser, and restart the API and worker. | One provider order and one outgoing transfer. The same transaction resumes without double payment. |
| T-09 | Send duplicate, reordered, missing, forged, or unknown provider notifications. | Authentication and deduplication work. The worker recovers missing updates. Unknown states never imply success. |
| T-10 | Attempt cross-user access and alter provider, wallet, network, asset issuer, memo, amount, destination, or widget origin. | No unauthorized session disclosure, transfer, or financial state change. |
| T-11 | Exercise supported failure and refund paths before and after funding. | Original transfer and refund references remain linked. No replacement transfer starts while the first outcome is uncertain. |
| T-12 | Observe a buy order reported complete before its chain delivery appears. | Wallet funds remain unchanged until actual delivery is confirmed. Simulated completion is clearly identified in sandbox evidence. |
| T-13 | Follow an incoming delivery into wallet balance and an outgoing withdrawal from claimed earnings. | No duplicate wallet credit, earnings allocation, entitlement, or reversal of valid claim history. |
| T-14 | Complete the four journeys at desktop and mobile widths with keyboard and browser navigation. | Screenshots and computer-use observations show usable controls, overlays, focus return, and persisted status. |

- [ ] V-01 Add adapter, schema, amount, transfer, URL-signing, origin, and notification tests for both providers and directions.
- [ ] V-02 Run isolated PostgreSQL tests for uniqueness, concurrency, ownership, migrations, original-hash recovery, event ordering, and worker restarts.
- [ ] V-03 Run T-01 through T-14. Record provider simulations separately from local fault injection and confirmed chain transfers.
- [ ] V-04 Run affected client, server, and admin suites, workspace typechecks, production builds, and fresh and existing-database migrations. Recheck existing claims, purchases, agreements, and settlement behavior.
- [ ] V-05 Package a sanitized evidence index and a local demo procedure. Keep credentials, session tokens, signed authorization material, identity documents, bank details, and usable pickup references out of public evidence.
- [ ] V-06 Update the SOW provider-readiness checklist and applicable CO items only for requirements with evidence. Record each unavailable capability as open. Do not count one provider's success as completion of the other.

## Execute in this order

1. Finish R-04 through R-08 for all four journeys. Select the actual supported test routes before building payment controls.
2. Prove small MoonPay buy and sell integrations. Prove MoneyGram session creation and both widget modes. Resolve asset and network mismatches before moving funds.
3. Implement shared persistence and reconciliation with the first MoonPay journey. Finish the other MoonPay journey using the same ownership and recovery rules.
4. Add MoneyGram's cash-in and cash-out behavior, including counter instructions and separate pickup and collection states.
5. Complete creator, listener, and admin views. Run the complete browser and failure matrix, then package the evidence.

Keep sandbox integration local. If provider notifications need public HTTPS, expose only the intended development callback through a temporary provider-supported URL. Register the exact callback with test keys and remove it after verification. Do not expose a development database or admin interface.

## Record completion honestly

All four journeys must have implemented code, real provider sandbox evidence, and tested persistence and recovery. Link the applicable CO-01 through CO-27 results for withdrawals. Physical cash handling and actual bank settlement are simulated in sandbox and cannot establish live settlement. If a sandbox does not execute Stellar transfers, record that limitation and verify the app's signing and reconciliation separately on Testnet. This remains a gap in provider-to-chain integration evidence.

No production activation, real-money transaction, new chain, bridge, treasury custody change, or unattended user signing is authorized by this plan. Production rollout remains a separate decision after sandbox acceptance.

## Provider references checked on 26 October 2026

- [MoneyGram Stellar guide](https://xramps.moneygram.com/ops/developer/guides/web-stellar) covers both cash-in and cash-out through sessions and the widget.
- [MoneyGram credentials and environments](https://xramps.moneygram.com/ops/developer/getting-started) describes partner access, allowed origins, and separate sandbox keys.
- [MoneyGram status and webhooks](https://xramps.moneygram.com/ops/developer/reference/transaction-status-webhooks) distinguishes widget completion from authoritative transaction outcomes.
- [MoonPay buy quickstart](https://moonpay.readme.io/docs/quickstart) describes sandbox payment testing and server-side URL signatures for a supplied destination wallet.
- [MoonPay sell quickstart](https://moonpay.readme.io/docs/off-ramp-quickstart) describes the sandbox sell widget and test payout procedure.
- [MoonPay keys, domains, and webhooks](https://support.moonpay.com/en/articles/694414-managing-your-api-keys-domains-and-webhooks) describes separate test configuration and notification verification keys.
- [MoonPay payment methods](https://support.moonpay.com/en/articles/380823-moonpay-s-supported-payment-methods) lists method availability by direction and region. Recheck the account and exact asset before enabling an option.

## Implementation checkpoint, 26 October 2026

The first implementation slice adds sandbox configuration validation, a repeatable readiness command, strict server-resolved order terms, and a transactional order repository. Additive migrations create orders, quotes, chain attempts, append-only events, and reconciliation jobs. They do not enable payment controls or process provider transactions.

Fresh MoonPay requests to the enabled currency catalogue and country endpoint returned HTTP 200. Stellar USDC is listed but unavailable in test mode. South Africa, the UK, and the US report buy and sell country eligibility; Zimbabwe reports neither. These country flags do not establish available payment methods. MoneyGram session creation returned HTTP 400 requiring `customerIdentifier` for a custodial partner, including when the request explicitly selected non-custodial mode. See [the redacted readiness report](ramp-sandbox-evidence/readiness-2026-10-26.json).

Verification passed nine focused tests, including a real isolated PostgreSQL lifecycle test with eight concurrent reservations, changed-term rejection, owner isolation, unique provider references, append-only event enforcement, and duplicate-transfer constraints. Fresh full-schema initialization reported ready. Workspace typechecks passed. The default server suite passed 168 tests and skipped 13 database-dependent tests. The ramp PostgreSQL test ran separately without a skip. No funds moved and no provider payment order was created.

Reproduce readiness from the server workspace with `pnpm ramps:check --sandbox --wallet GADDRESS --output /private/path/report.json`. The command reads local credentials, prints only normalized outcomes, and exits with code 2 while a provider prerequisite remains unmet. Run PostgreSQL checks with `RAMP_TEST_DATABASE_URL` set to an isolated loopback database whose name ends in `_test`.

Next: implement the separately authorized MoonPay XLM demonstration, including wallet-bound signed URLs, protected order routes, authenticated provider lookup and notifications, and local browser verification. Keep the Stellar USDC capability gate in place.

## MoonPay signing and progress checkpoint, 26 October 2026

Completed local components for the separately authorized XLM demonstration:

- [x] Add explicit XLM and provider selection flags. Keep USDC as the default asset and sandbox payment controls disabled by default.
- [x] Build wallet-bound buy and sell URLs with exact amounts and stable local order identifiers. Validate enabled test assets and country eligibility before producing a URL.
- [x] Authenticate provider lookups with the documented publishable `apiKey`. Verify the provider reference, wallet, currencies, correlation identifiers, and original amount before accepting an observation.
- [x] Verify V2 notification HMACs over the timestamp and exact raw body, with a five-minute replay window.
- [x] Persist launch issuance and provider observations. Test concurrent launch rejection, stale update handling, notification deduplication, and exclusive reconciliation leases in isolated PostgreSQL.
- [x] Compare signatures with the official Node SDK and launch the official browser SDK. Compare all three configured keys with the signed-in dashboard without recording their values.
- [x] Resolve the real Test Mode widget failure. Both adapter-generated XLM URLs pass provider verification and reach normal sign-in. See the [IP-binding audit](ramp-sandbox-evidence/moonpay-ip-binding-audit.md).
- [ ] Complete sandbox authentication and reach the payment or payout confirmation.
- [ ] Connect protected routes, notification handling, worker execution, and the client and admin views. Repository and adapter methods alone do not complete these items.
- [ ] Complete real sandbox buy and sell, verify any Testnet delivery, and exercise recovery and failure paths.

The dashboard keys match the root `.env`. The implementation's signature equals the official `@moonpay/moonpay-node@0.2.13` result, which that SDK validates. Both its URL and the official browser SDK reach Test Mode but display `Signature check failed`. The basic browser SDK example also shows that error without a wallet or signature. This does not establish a credential mismatch. No provider order was created. See the [sanitized diagnostic report](ramp-sandbox-evidence/moonpay-signing-2026-10-26.json) and [browser evidence](ramp-sandbox-evidence/moonpay-official-sdk-error.jpg).

The adapter's real buy and sell external-ID lookups authenticate successfully and return no matching order. A previous attempt used a secret key in that endpoint's query; the implementation now uses the documented publishable key. This fixes lookup authentication and does not resolve the widget error.

Fifteen focused tests pass without skips, including real PostgreSQL persistence checks. Fresh full database initialization and workspace typechecks pass. The full server suite passes 174 tests with 13 database-dependent skips; the ramp database test runs separately without a skip. Provider completion never changes chain confirmation or creates an application balance. All end-to-end acceptance items above remain open.

With owner approval, temporarily allowed `http://localhost:4352` in the MoonPay dashboard and verified persistence after reloading. Both the signed wallet-bound SDK example and the basic example still displayed `Signature check failed`. Removed the diagnostic origin and verified its absence after another reload. No keys or live-payment settings changed. The test did not resolve the widget failure; the required propagation interval is unknown. Independent browser comparison and provider diagnostics remain open.

## Widget failure resolved, 26 October 2026

The earlier unresolved signing checkpoint is superseded by the [root-cause audit](ramp-sandbox-evidence/moonpay-ip-binding-audit.md). The exact provider rejection was `5_PARTNERS_IP_MISSING`, not a mismatched key or invalid HMAC. Added canonical customer-IP hashing to the signed query for both directions. Real verification now returns HTTP 200 for buy and sell; negative requests still reject missing, mismatched, or tampered IP bindings. Both sandbox widgets load normally. The full payment lifecycle and protected application routes remain open.

## First XLM sandbox buy attempt, 26 October 2026

The owner confirmed control of the bound Testnet wallet. MoonPay created a sandbox buy order, then returned `failed` with `Payment authorization declined` for the published test card. No chain delivery has been confirmed. The failure screen is recorded in [the sandbox evidence](ramp-sandbox-evidence/moonpay-buy-card-declined.jpg). Do not treat the wallet prompt, card confirmation, or order creation as successful payment.

The real response reported a USD 100.00 total as USD 95.81 base, USD 3.99 processing fee, and USD 0.20 network fee. The lookup now compares the sum of all four documented components in exact currency units; it rejects missing or invalid components and mismatched totals. Sell still compares the crypto base amount. `waitingAuthorization` remains processing. The authenticated lookup now returns the real attempt as `failed`. MoonPay documents the [buy transaction amount and fee fields](https://dev.moonpay.com/api-reference/widget/getbuytransaction).

## MoonPay UK billing retry, 28 October 2026

A new $100 XLM sandbox buy was launched with a fresh local order after the two provider records under the original correlation ID were confirmed failed. A UK test billing address was entered when re-adding the documented Visa ending 6584; MoonPay selected the existing card, so whether the address was attached to that saved card was not independently confirmed. After the owner approved the test purchase and displayed terms, MoonPay showed card verification and then declined the transaction. Its authenticated lookup returned `failed` with `Payment authorization declined`. There is no confirmed delivery. The UK-address hypothesis remains unproven; obtain provider-side diagnostics or verify the saved card billing association before another attempt. The two prior provider records sharing one correlation ID remain a reconciliation exception and must not be automatically treated as one order.
