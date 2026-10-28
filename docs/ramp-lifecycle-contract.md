# Ramp lifecycle contract

This contract describes the current sandbox foundation and the work an adapter must complete before it can be enabled. It does not certify a provider or change the submitted SOW 2 scope. The [implementation plan](sow2-provider-independent-implementation-plan.md) records test evidence and open work.

## Identity and money

The server binds each order to an authenticated user, wallet, provider, direction, market, environment and Stellar network. The user supplies an idempotency key and an amount, not a wallet or provider instruction. The capability source supplies the permitted route and limits. A repeated key returns the original order only when its terms match. An unverified or expired route cannot create an order.

Amounts are stored as integer unit strings and a decimal scale. Funding amounts use the selected fiat currency. Cash-out amounts use Stellar asset units at seven decimal places. The current cash-out transfer validator accepts USDC. The capability filter pins Testnet USDC to the Circle issuer. A quote and instructions must match the order, wallet, provider, network, amount, market and provider reference. The user confirms the hash of the saved quote and instructions before signing.

## Separate observations

The order has a provider state and a chain state. Neither state alone proves the whole transaction succeeded.

| Provider state | Meaning for the application | Current boundary |
| --- | --- | --- |
| `created` | The order is saved. A launch may or may not have been requested. | An unlaunched funding or cash-out order can be cancelled. After launch, a missing provider record remains unresolved. |
| `awaiting_user`, `processing` | The provider reports an outstanding action or processing. | Continue reconciliation. Do not start another launch for the same owner and wallet. |
| `ready_for_pickup` | The provider reports that collection is available. | The shared state exists. No verified provider adapter currently maps and demonstrates this state. |
| `completed` | The provider reports completion. | For funding, verify the actual chain delivery before displaying a confirmed transfer. Until then, another launch is blocked. |
| `failed`, `cancelled` | The provider reports failure or cancellation. | Preserve the observation and chain history. Provider-specific recovery is still required. |
| `refund_pending`, `refunded` | The provider reports a refund state. | The shared states exist. Refund transitions and proof of returned funds are not yet implemented. |
| `unknown` | The provider status is unrecognized, conflicts with an earlier terminal observation, or needs investigation. | Retain the original status and block a replacement launch. |

Chain states are `unobserved`, `prepared`, `submitting`, `confirmed`, `failed`, `unknown` and `expired`. A funding delivery is confirmed only when Horizon proves a successful transaction with one matching payment to the bound wallet, for the expected asset, issuer and exact amount. A cash-out receipt must match the retained transaction hash and wallet. No simulated provider outcome creates a wallet balance, earnings entry or entitlement.

For cash-out, the intended path is `unobserved` to `prepared`, then `submitting`, and finally `confirmed`, `failed`, `unknown` or `expired`. The user can cancel an unsigned prepared attempt. A signed attempt is encrypted and persisted before a worker submits it. The worker checks the retained hash before resubmitting the same envelope. It records expiry only when closed-ledger time and retained history cover the attempt. Missing history remains `unknown`. The worker rechecks provider state before claiming a submission, but a provider update may still arrive before the network request. Provider-specific cancellation and refund behavior must address that window.

## Observations and recovery

A verified notification schedules a provider lookup. The notification itself does not set a financial outcome. The adapter must authenticate the lookup and bind the result to the stored order, customer, wallet, currency and amount. Observations retain the provider reference, original status and timestamp. Duplicate events are idempotent. An older observation cannot overwrite a newer one. A conflicting observation after a terminal provider state moves the order to `unknown` and preserves both the original and the conflict for review. A later matching terminal observation can clear that conflict. The implementation does not yet enforce a complete provider-specific transition graph for nonterminal states.

Reconciliation jobs have provider-scoped leases. An expired lease can be reclaimed, and a stale worker cannot record an outcome with its old lease token. Provider and delivery checks use bounded retry delays. A retained transaction or provider reference is never replaced merely because a response is lost. The admin view is read-only and shows status, receipts and reconciliation exceptions.

## Adapter responsibilities

A provider integration must supply and verify the following before its route is exposed:

1. Account-specific capabilities for the exact country, currency, method, asset and direction, including supported limits, precision and an expiry for the evidence.
2. A launch adapter that prepares a session without creating a provider transaction, validates its destination and binds its parameters to the order. It may mark a saved link resumable only when provider behavior is verified. The common launch service also requires HTTPS and rejects URL credentials and fragments.
3. An authenticated lookup that binds provider results to the saved order and maps documented statuses without converting unknown values into success. The worker leases only jobs for its configured provider.
4. Verified notification signatures and event binding, if the provider supports notifications. Lookup remains authoritative.
5. For cash-out, an authenticated quote and transfer-instruction adapter with destination, asset issuer, amount, memo, fees and expiry. The application validates and persists the exact transaction before wallet signing. Refunds require separately verified instructions and chain evidence.
6. Browser and failure tests for the actual sandbox, including user authorization, lost responses, restart recovery, cancellation, payout and refund behavior where supported. Record real provider and Testnet evidence separately from fixtures.

MoonPay currently has a sandbox launch adapter, lookup and notification verifier. Its completed sandbox purchase and Stellar USDC route have not been demonstrated. MoneyGram has no verified non-custodial instruction or launch adapter in the running application. No funding or cash-out route is currently advertised. Adding an adapter alone does not enable a route.

## Existing contracts

`rampOrderTermsSchema` and `rampProviderObservationSchema` are the active order and observation contracts. `cashOutQuoteSchema` and `cashOutTransferInstructionsSchema` define the quote and transfer inputs used by the active ramp cash-out code. The separate `cashOutTransactionSchema` and `cashOutStatusSchema` describe a broader cash-out model; they do not establish that its full lifecycle is implemented. Keep these contracts separate until a verified provider demonstrates how its session, payout and refund states map to the active order. Do not expose both as competing user flows.
