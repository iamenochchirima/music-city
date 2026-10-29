# Ramp sandbox evidence

Status checked 29 October 2026. This index separates provider account capability, local application behavior, and actual payment or payout evidence. It records the evidence available for the SOW2 on-ramp/off-ramp work; it does not certify either provider's full transaction lifecycle.

## Current provider decision

Prioritize MoonPay's online buy and sell journeys. The project owner deferred MoneyGram until its partner account supports Music City's non-custodial Stellar integration. Keep the four original journeys distinct: MoonPay buy, MoonPay sell, MoneyGram cash-in, and MoneyGram cash-out. Do not automatically substitute XLM for USDC or one provider for another.

The [29 October readiness snapshot](readiness-2026-10-29.json) is a read-only Sandbox capability check. MoonPay authentication was verified; native XLM Test Mode was available, while Stellar USDC Test Mode was unavailable. The snapshot reports ZA and GB eligibility and ZAF/ZAR buy methods (Google Pay, cards, Apple Pay) plus a card sell method. Those market-level flags do not guarantee an account-specific quote, supported amount, or successful payment. Exact route limits and payment progression remain unverified. MoneyGram rejected the configured partner mode with `non_custodial_partner_required`; both directions remain unavailable.

The 26 October snapshot is historical capability evidence. It records unavailable `usdc_xlm` Test Mode and is superseded for account readiness by the 29 October snapshot; neither snapshot records a provider transaction.

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
2. MoneyGram must enable the non-custodial Stellar partner mode for this account and provide its supported Sandbox cash-in and cash-out procedures, including exact memo handling and simulated collection outcomes.
3. After those prerequisites are available, capture the four genuine provider journeys, authoritative provider state progression, any supported chain receipt, callbacks, restart/recovery behavior, and redacted browser evidence.
4. Complete the remaining local admin/worker browser matrix and responsive, keyboard, validation, and interruption checks tracked under CO-22 and CO-25. Provider-specific work remains open under R-04 through R-08, R-12, R-15 through R-20, MP-01 through MP-06, and MG-01 through MG-06.

Do not place credentials, session tokens, raw customer IP addresses, signed URLs, identity documents, bank details, payment-card data, or usable pickup references in this index or its linked public evidence.
