# Ramp sandbox evidence

Latest off-ramp check: 1 November 2026. The separate XLM-to-GBP MoonPay Balance sandbox test completed successfully. Stellar USDC sandbox selling remains unavailable. Earlier account readiness below was checked on 29 October 2026. This index separates provider account capability, local application behavior, and actual payment or payout evidence. It records the evidence available for the SOW2 on-ramp/off-ramp work; it does not certify either provider's full transaction lifecycle.

## Current provider decision

The project owner reopened MoneyGram integration on 29 October. Keep the four journeys distinct: MoonPay buy, MoonPay sell, MoneyGram cash-in, and MoneyGram cash-out. Do not automatically substitute XLM for USDC or one provider for another.

The [29 October readiness snapshot](readiness-2026-10-29.json) is a read-only Sandbox capability check. MoonPay authentication was verified; native XLM Test Mode was available, while Stellar USDC Test Mode was unavailable. The snapshot reports ZA and GB eligibility and ZAF/ZAR buy methods (Google Pay, cards, Apple Pay) plus a card sell method. Those market-level flags do not guarantee an account-specific quote, supported amount, or successful payment. Exact route limits and payment progression remain unverified.

A later [MoneyGram partner configuration check](moneygram-config-2026-10-29.json) corrected the earlier interpretation of `customerIdentifier is required for custodial partners`: the sandbox credentials are valid and create a custodial session, but this partner configuration does not include Stellar or configured Stellar omnibus wallets. Cash-in and cash-out products are enabled for the account, but its supported chains are Ethereum, Polygon, and Solana. No provider transaction was created. Music City uses users' Dynamic Stellar wallets, so this account cannot complete the current Stellar journeys as configured.

The 26 October snapshot is historical capability evidence. It records unavailable `usdc_xlm` Test Mode and is superseded for account readiness by the 29 October snapshot; neither snapshot records a provider transaction.

## Sandbox behavior from provider documentation

MoonPay's [official Sandbox guide](https://dev.moonpay.com/widget/sandbox-testing) says to use a US or UK address, does not verify Sandbox KYC data, and lists Stellar Testnet support. It identifies Visa ending 6584 as the UK frictionless 3DS test card. The attempted UK-address checkout used that documented card, so the address country and card number alone do not explain its decline. The widget displayed only a generic decline. MoonPay lists incorrect card details, an empty/underfunded testnet wallet, unsupported region, rate limiting (wait about 20 minutes), and a restricted or production user account among possible failure reasons. The available screenshot and account API response do not distinguish them, and the saved evidence does not establish which expiry/CVC values were entered. Do not infer the cause or submit another purchase without a provider-side transaction diagnosis. The guide also warns that Sandbox purchases may deliver only 1/100th of the quoted amount due to limited Testnet liquidity. That simulation has not been observed on this account.

MoonPay separately documents Visa Direct test-card support for off-ramp payouts. Its existence does not prove that the account's Stellar USDC sell route or card payout is enabled; the current account snapshot does not verify either route.

MoneyGram's current [non-custodial Stellar widget quickstart](https://xramps.moneygram.com/ops/developer/quickstarts/web-stellar) uses a server-created wallet-bound session, public widget key, allowlisted domain, Stellar Testnet USDC, and wallet signing for cash-out. The official [status and webhook guide](https://xramps.moneygram.com/ops/developer/reference/transaction-status-webhooks) distinguishes a cash-out transfer/ready-for-pickup state from the later `paid_out` collection state; cash-in requires a physical cash deposit before the provider sends USDC. MoneyGram documentation says the wallet custody model is fixed at partner onboarding ([custodial guide](https://xramps.moneygram.com/ops/developer/guides/custodial-cashout-stellar)). To use MoneyGram with Music City's current wallet model, the provider must provision a non-custodial Stellar Sandbox configuration and allowlist the test domain. Switching the application to custodial operation would require a separately approved omnibus-wallet and custody design.

## Provider diagnostics

- [MoonPay IP-binding investigation](moonpay-ip-binding-audit.md): real verification requests identified the missing `allowedIpAddress` HMAC as the widget-load failure. Correctly IP-bound buy and sell URLs reached the sandbox widget. This fixed widget loading; it did not establish a completed payment or payout.
- [Widget launch screenshot](moonpay-sell-widget-fixed.jpg): confirms the sell widget loaded without credentials or customer details.
- [Buy card decline screenshot](moonpay-buy-card-declined.jpg): records a declined sandbox card attempt. The decline's underlying cause was not established, so this is not proof of a provider transaction result or a working buy flow.
- [Official SDK error screenshot](moonpay-official-sdk-error.jpg): diagnostic evidence from the earlier signing investigation; use the IP-binding audit for the resolved widget-load cause.
- [Sanitized signing investigation record](moonpay-signing-2026-10-26.json): records the correction and explicitly says buy and sell were not completed and funds did not move.

On 29 October, the signed-in MoonPay Partner Dashboard was in Test Mode. Its transaction list showed three failed US$100 XLM buys and no completed transaction in the displayed date range. The latest order, `9b2f74b9-0164-4692-b7c3-5afc4c30b3c9`, had external ID `38423219-78e5-458c-bbc7-dca25762268a`, country GBR, and failure reason `Payment authorization declined`. The dashboard did not expose a more specific authorization cause. An existing support ticket was submitted in the partner dashboard; no human diagnosis was visible during this check. No transaction was submitted from this investigation.

This failed-order record has a provider dashboard reference, but no completed payout, provider-confirmed buy delivery, or ramp-specific Stellar Testnet receipt exists in this evidence package. Historical SOW2 marketplace and settlement receipts are documented separately in the [core lifecycle evidence](../core-lifecycle-evidence/README.md) and must not be presented as ramp transactions.

The [29 October status audit](known-order-status-2026-10-29.json) queried that existing order through MoonPay's real API and the current `MoonpaySandbox.lookup` adapter. The API returned one failed XLM transaction. Provider ID, external ID, customer ID, wallet, asset, fiat currency, and the $100 total charge matched the saved test attempt. The adapter returned `failed` with no chain hash or delivered asset amount. This read-only check created no order and changed no capability. At 09:10 UTC, partner ticket `#39343117` still showed “Submitted” with no human diagnosis visible. R3 and V5 remain open for the authenticated launch and provider journey checks.

## Local application and test evidence

- [Provider-independent implementation plan and dated checkpoints](../sow2-provider-independent-implementation-plan.md): shared order model, ownership, persistence, retry and recovery behavior, worker reconciliation, status polling, current local test results, and unresolved provider dependencies.
- [SOW2 tracker](../sow-2-tracker.md): CO-01 through CO-27 acceptance boundaries and the separate provider-readiness checklist.
- [Ramp lifecycle contract](../ramp-lifecycle-contract.md): provider/chain status separation, ownership, exact transfer checks, recovery, and adapter requirements.
- [Sandbox test-account evidence](../core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md): actual Dynamic Sandbox artist/listener route checks, wallet and earnings separation, mobile Revenue behavior, and explicit absence of a verified provider route.
- [Local SOW2 demo procedure](../sow2-local-demo.md): isolated local setup and the available core lifecycle demonstration.

The latest client check passed all 228 tests and client typecheck. The local API reported all 29 schema groups healthy. The [dated account log](../core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md) records the separate server and disposable PostgreSQL runs with their revisions. These tests verify application behavior and controlled provider fixtures; they do not establish provider-side payment, payout, or delivery.

## Remaining provider conditions

1. MoonPay must enable or document a supported Stellar USDC Sandbox buy and sell route, including account-specific limits, quote behavior, test payment/payout outcomes, and how a test USDC delivery is observed. The tested native XLM path remains a separate demonstration and did not complete an end-to-end transaction.
2. MoonPay must diagnose the declined Sandbox transaction from provider-side logs. The published UK test card and UK address were used; the generic decline screen is insufficient to identify whether the remaining cause was account restrictions, rate limits, available Testnet funds, or another provider-side failure.
3. MoneyGram must provision non-custodial Stellar widget Sandbox access for this partner (or a separate partner configuration), add Stellar to the enabled chains, allowlist the test domain, and provide the cash-in and cash-out Sandbox procedures, including memo handling and simulated collection outcomes. If the provider only offers custodial mode, the account also needs Stellar omnibus-wallet configuration and Music City needs a separate approved custody design before implementation can proceed on that model.
4. After those prerequisites are available, capture the four genuine provider journeys, authoritative provider state progression, any supported chain receipt, callbacks, restart/recovery behavior, and redacted browser evidence.
5. Complete the remaining local admin/worker browser matrix and responsive, keyboard, validation, and interruption checks tracked under CO-22 and CO-25. Provider-specific work remains open under R-04 through R-08, R-12, R-15 through R-20, MP-01 through MP-06, and MG-01 through MG-06.

Do not place credentials, session tokens, raw customer IP addresses, signed URLs, identity documents, bank details, payment-card data, or usable pickup references in this index or its linked public evidence.

## Off-ramp rehearsal, 1 November 2026

Goal: exercise the actual MoonPay sandbox sell flow and distinguish provider receipt of crypto from a completed payout. Fresh read-only API checks confirm that the account enables Stellar USDC in its off-ramp dashboard, but the currency catalogue reports `supportsTestMode=false`. A sell quote for 100 `usdc_xlm` into GBP returns HTTP 400, `Currency not supported in test mode`. UK payout methods are reported as available; this does not make Stellar USDC available. The Music City USDC cash-out route remains disabled.

The user separately authorized an XLM provider demonstration and approved the explicit sandbox Terms continuation. A 200-test-XLM sell quote succeeded. The documented Visa Direct sandbox payout card ending 5032 was accepted, and provider order `db67844e-70fb-472b-9739-9f48049e55c3` was created for a UK customer/GBP payout. The exact 200 XLM deposit was sent from the generated verification fixture wallet on Stellar Testnet with the provider's required numeric ID memo. It confirmed at ledger 5503675, transaction `8b6241ad14bf93aa330504b4206d1f5a0d9442ebf46e53225823ac89b5818dd4`. MoonPay independently matched that same deposit hash and completed its deposit stage.

The payout then failed with the authoritative API and partner-dashboard reason `Cross-border payout to this card is not supported`. No successful payout is claimed. Refund approval became `approved`, with no refund hash at the last recorded check. The original order is retained and must not be treated as refunded before a verified return transaction. A separate US/USD sandbox-customer test is being prepared, pending the user's test-email choice. No second deposit has been sent.

Evidence: [fresh readiness](moonpay-offramp-readiness-2026-11-01.json), [Stellar catalogue](moonpay-stellar-sell-catalog-2026-11-01.json), [USDC quote rejection](moonpay-usdc-sell-quote-2026-11-01.json), [XLM quote](moonpay-xlm-sell-quote-2026-11-01.json), [confirmed deposit](moonpay-xlm-deposit-2026-11-01.json), [flow state](moonpay-offramp-flow-2026-11-01.json), and [provider failure screenshot](moonpay-offramp-card-failure-2026-11-01.png). Existing sandbox API keys and signed URLs are retained only outside the repository in a private directory. No keys were created or rotated.

Follow-up: the US/California/USD preflight returned a valid quote for 200 XLM and listed card payout as available. No new customer, order or deposit was created. At the latest [refund check](moonpay-xlm-refund-2026-11-01.json), the first order still had refund approval but no refund hash or incoming return payment to the source wallet. The [US/USD preflight](moonpay-xlm-usd-preflight-2026-11-01.json) is preliminary evidence only, not a completed payout.

## Successful MoonPay Balance sandbox sale, 1 November 2026

After restarting, the user had created order `9ae54fba-acc8-4c74-b64a-b6a70881bff2` under the original UK sandbox customer with payout method `moonpay_balance`, rather than a US/USD card order. The user authorized choosing the more viable test route. The existing order was retained and funded with exactly 200 test XLM using the provider's required ID memo `3010377762`. The Testnet payment confirmed at ledger 5504064, hash `789d71b771668c2e91fed74f42fdf88591307589117c02622eb159f8a9b501e5`. MoonPay's authoritative API matched that same deposit hash, returned `status=completed`, and marked verification, deposit, processing and withdrawal stages successful. The final quote/payout was 24.37 GBP with zero MoonPay fee. The widget independently displayed “Delivered to your MoonPay Balance” and “All done — your XLM sale is complete” in Test Mode.

This proves a completed separate native-XLM provider sandbox sale credited to an internal GBP MoonPay Balance. It does not prove a bank/card payout, real fiat delivery, a US/USD customer flow or Music City's Stellar USDC cash-out integration. The application database contains no matching ramp order for either standalone provider test. No USDC cash-out route was enabled. A fresh Stellar USDC sell quote still returned HTTP 400, `Currency not supported in test mode`. The earlier card order still reports refund approval with no refund hash; its test-token refund is not claimed complete.

Proof: [balance-result API record](moonpay-xlm-balance-result-2026-11-01.json), [confirmed native deposit](moonpay-xlm-balance-deposit-2026-11-01.json), [completion screenshot](moonpay-xlm-balance-success-2026-11-01.png), [receipt screenshot](moonpay-xlm-balance-receipt-2026-11-01.png), [final audit](moonpay-offramp-audit-2026-11-01.json), and [application scope check](moonpay-application-scope-2026-11-01.json).


### Revenue cash-out asset picker, 1 November 2026

Cash out on Revenue and Account now opens an XLM/USDC selector. The enabled local Testnet route is XLM to GBP MoonPay Balance. USDC has a one-line unavailable message. This does not convert USDC earnings to XLM.

The server rechecks MoonPay's live catalog and Balance sell quote before advertising the route. The signed launch locks the asset, amount, refund wallet and correlation identifiers and preselects MoonPay Balance. After provider setup, return to Music City and use Get quote to review and sign the deposit. Deposit instructions come from a direct provider lookup bound to the saved order, customer identifier, wallet, exact amount, currency and payout method. Native payments include the provider's numeric memo. Reserve, liabilities, fees, exact envelope signatures and retained-attempt reconciliation still apply.

Local credentials and encryption keys are stored privately outside the repository. Local launch IP binding accepts only loopback connections in development with Testnet and sandbox credentials, using the browser public IP observed on this workstation. Direct ingress still ignores untrusted forwarding headers. Refresh that private binding if the browser connection changes.

Verification: 78 focused server tests passed, including the isolated database persistence suite; 54 client ramp tests passed; client build and both typechecks passed. The running Revenue modal was exercised with both assets and a 200 XLM amount. No new provider sale or wallet transfer was submitted during this UI implementation check. Earlier MoonPay completion evidence remains a separate provider test.


### USD attempt on the original GBP account, 1 November 2026

The original account was signed back in, and a fresh 200 XLM request explicitly selected USD and MoonPay Balance. The resulting provider order `aa32a32d-558a-45b0-8481-e536114917a2` used the same customer ID as the successful GBP test, but its actual payout currency was GBP, estimated £24.34. The test did not establish USD payout support on this account or through other payout methods. No deposit was sent. The unfunded order was cancelled; the provider reports `failed` with `Cancelled by customer` and no deposit hash. See `moonpay-same-account-usd-result-2026-11-01.json`.

Per the user's fallback instruction, the demo remains on the verified GBP MoonPay Balance route. The original completed GBP receipt was restored in the browser.
