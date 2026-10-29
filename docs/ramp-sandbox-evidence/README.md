# Ramp sandbox evidence

Status checked 29 October 2026. This index separates provider account capability, local application behavior, and actual payment or payout evidence. It records the evidence available for the SOW2 on-ramp/off-ramp work; it does not certify either provider's full transaction lifecycle.

## Current provider decision

Prioritize MoonPay's online buy and sell journeys. The project owner deferred MoneyGram until its partner account supports Music City's non-custodial Stellar integration. Keep the four original journeys distinct: MoonPay buy, MoonPay sell, MoneyGram cash-in, and MoneyGram cash-out. Do not automatically substitute XLM for USDC or one provider for another.

The [29 October readiness snapshot](readiness-2026-10-29.json) is a read-only Sandbox capability check. MoonPay authentication was verified; native XLM Test Mode was available, while Stellar USDC Test Mode was unavailable. The snapshot reports ZA and GB eligibility and ZAF/ZAR buy methods (Google Pay, cards, Apple Pay) plus a card sell method. Those market-level flags do not guarantee an account-specific quote, supported amount, or successful payment. Exact route limits and payment progression remain unverified. MoneyGram rejected the configured partner mode with `non_custodial_partner_required`; both directions remain unavailable.

The 26 October snapshot is historical capability evidence. It records unavailable `usdc_xlm` Test Mode and is superseded for account readiness by the 29 October snapshot; neither snapshot records a provider transaction.

## Sandbox behavior from provider documentation

MoonPay's [official Sandbox guide](https://dev.moonpay.com/widget/sandbox-testing) says to use a US or UK address, does not verify Sandbox KYC data, and lists Stellar Testnet support. It identifies Visa ending 6584 as the UK frictionless 3DS test card. The attempted UK-address checkout used that documented card, so the address country and card number alone do not explain its decline. The widget displayed only a generic decline. MoonPay lists incorrect card details, an empty/underfunded testnet wallet, unsupported region, rate limiting (wait about 20 minutes), and a restricted or production user account among possible failure reasons. The available screenshot and account API response do not distinguish them, and the saved evidence does not establish which expiry/CVC values were entered. Do not infer the cause or submit another purchase without a provider-side transaction diagnosis. The guide also warns that Sandbox purchases may deliver only 1/100th of the quoted amount due to limited Testnet liquidity. That simulation has not been observed on this account.

MoonPay separately documents Visa Direct test-card support for off-ramp payouts. Its existence does not prove that the account's Stellar USDC sell route or card payout is enabled; the current account snapshot does not verify either route.

MoneyGram's current [non-custodial Stellar widget quickstart](https://xramps.moneygram.com/ops/developer/quickstarts/web-stellar) uses a server-created wallet-bound session, public widget key, allowlisted domain, Stellar Testnet USDC, and wallet signing for cash-out. The official [status and webhook guide](https://xramps.moneygram.com/ops/developer/reference/transaction-status-webhooks) distinguishes a cash-out transfer/ready-for-pickup state from the later `paid_out` collection state; cash-in requires a physical cash deposit before the provider sends USDC. The partner credentials checked for Music City were rejected as the wrong partner mode, so these documented widget behaviors have not been exercised with this account.

## Provider diagnostics

- [MoonPay IP-binding investigation](moonpay-ip-binding-audit.md): real verification requests identified the missing `allowedIpAddress` HMAC as the widget-load failure. Correctly IP-bound buy and sell URLs reached the sandbox widget. This fixed widget loading; it did not establish a completed payment or payout.
- [Widget launch screenshot](moonpay-sell-widget-fixed.jpg): confirms the sell widget loaded without credentials or customer details.
- [Buy card decline screenshot](moonpay-buy-card-declined.jpg): records a declined sandbox card attempt. The decline's underlying cause was not established, so this is not proof of a provider transaction result or a working buy flow.
- [Official SDK error screenshot](moonpay-official-sdk-error.jpg): diagnostic evidence from the earlier signing investigation; use the IP-binding audit for the resolved widget-load cause.
- [Sanitized signing investigation record](moonpay-signing-2026-10-26.json): records the correction and explicitly says buy and sell were not completed and funds did not move.

No verified provider transaction reference, completed payout, provider-confirmed buy delivery, or ramp-specific Stellar Testnet receipt exists in this evidence package. Historical SOW2 marketplace and settlement receipts are documented separately in the [core lifecycle evidence](../core-lifecycle-evidence/README.md) and must not be presented as ramp transactions.

## Local application and test evidence

- [Provider-independent implementation plan and dated checkpoints](../sow2-provider-independent-implementation-plan.md): shared order model, ownership, persistence, retry and recovery behavior, worker reconciliation, status polling, current local test results, and unresolved provider dependencies.
- [SOW2 tracker](../sow-2-tracker.md): CO-01 through CO-27 acceptance boundaries and the separate provider-readiness checklist.
- [Ramp lifecycle contract](../ramp-lifecycle-contract.md): provider/chain status separation, ownership, exact transfer checks, recovery, and adapter requirements.
- [Sandbox test-account evidence](../core-lifecycle-evidence/sandbox-test-accounts-2026-10-29.md): actual Dynamic Sandbox artist/listener route checks, wallet and earnings separation, mobile Revenue behavior, and explicit absence of a verified provider route.
- [Local SOW2 demo procedure](../sow2-local-demo.md): isolated local setup and the available core lifecycle demonstration.

The latest recorded automated evidence includes a full client run at 216/216, a 45/45 ramp UI suite with timer-driven status updates, and a full server run at 328/328 against a disposable PostgreSQL database with no skips. The local API reported all 28 schema groups healthy. These tests verify application behavior and controlled provider fixtures; they do not establish provider-side payment, payout, or delivery.

## Remaining provider conditions

1. MoonPay must enable or document a supported Stellar USDC Sandbox buy and sell route, including account-specific limits, quote behavior, test payment/payout outcomes, and how a test USDC delivery is observed. The tested native XLM path remains a separate demonstration and did not complete an end-to-end transaction.
2. MoonPay must diagnose the declined Sandbox transaction from provider-side logs. The published UK test card and UK address were used; the generic decline screen is insufficient to identify whether the remaining cause was account restrictions, rate limits, available Testnet funds, or another provider-side failure.
3. MoneyGram must issue or enable the non-custodial Stellar widget-partner Sandbox mode for this account, allowlist the client domain, and provide its supported Sandbox cash-in and cash-out procedures, including exact memo handling and simulated collection outcomes.
4. After those prerequisites are available, capture the four genuine provider journeys, authoritative provider state progression, any supported chain receipt, callbacks, restart/recovery behavior, and redacted browser evidence.
5. Complete the remaining local admin/worker browser matrix and responsive, keyboard, validation, and interruption checks tracked under CO-22 and CO-25. Provider-specific work remains open under R-04 through R-08, R-12, R-15 through R-20, MP-01 through MP-06, and MG-01 through MG-06.

Do not place credentials, session tokens, raw customer IP addresses, signed URLs, identity documents, bank details, payment-card data, or usable pickup references in this index or its linked public evidence.
