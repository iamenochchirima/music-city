# Settlement evidence

This evidence covers the SOW 2 settlement and creator claims implementation. Direct fan support and provider adapters remain separate.

## Verified lifecycle

[Final Testnet record](stellar-testnet.json) contains the final contract IDs, exact agreement versions, batches, four contract-managed claim IDs, six lifecycle events, transaction hashes, ledgers, explorer links, and independent reconciliation. The final settlement WASM SHA-256 is `31aacab667aad2f49cf4d85fd3c58437dba9cbf875404025cc1d0c852b0a7de6`.

The initial 70/30 agreement funded 100 USDC. The owner claimed 70 USDC. A freshly consented 50/50 amendment funded a different 100 USDC source, and both recipients claimed 50 USDC. The original 30 USDC entitlement expired and was recovered through the admin browser. Final totals are 200 funded, 170 claimed, 30 recovered, zero outstanding, and zero escrow balance. Backend records, on-chain state, indexed events, receipts, and asset balance agree.

The demonstration uses actual Circle USDC on Stellar Testnet. It acquired the asset through a confirmed Testnet exchange trade. Demonstration signers are disposable generated keys. No real money or production earnings were used.

## Browser evidence and limits

The actual admin interface prepared recovery, verified one then two independent partial XDR signatures, submitted the transaction, and displayed the worker-confirmed receipt at ledger 5204691.

- [Awaiting signatures](admin-recovery-awaiting-signatures.png)
- [One signature](admin-recovery-one-signature.png)
- [Two signatures](admin-recovery-two-signatures.png)
- [Confirmed recovery](admin-recovery-confirmed.png)
- [Independent reconciliation displayed in admin](admin-reconciliation-confirmed.png)

The browser used the official local admin bootstrap and login routes against the dedicated demonstration database. Signatures were generated from disposable Testnet keys and uploaded through the interface. This does not verify a Dynamic wallet popup. A development reload also occurred during confirmation, so this capture alone does not prove uninterrupted automatic browser updates.

Real contributor review, cancellation, acceptance, amendment consent, and creator claim through Dynamic remain SET-03 and SET-20. Reviewer acceptance remains SET-24.

## Deployment

[Live contracts](live-contracts.json) records a separate fresh registry and escrow for the deployed application. Synthetic demonstration earnings were not imported into the live database. The treasury has three distinct weight-one public keys and all thresholds set to two. Signing keys remain outside the application environment.

The API and financial worker require the same contract, registry, treasury, asset, network, and deployment ledger. The worker indexes successful contract events from that ledger, reconciles persisted attempts, and caches a global report. An incomplete index, unknown batch, missing receipt, stale report, or inconsistent token balance cannot appear as verified.

[Deployment verification](deployment.json) records commit `3b4fa522c7d95632a11810104288b513d8c234ac`, successful API and both worker deployments, both ready Vercel frontends, migrations, API access checks, served frontend code, and a caught-up worker report. The fresh live escrow has zero obligations and zero balance. Existing records have identical before-and-after hashes. The pre-deployment backup archive was checked with `pg_restore --list`. The actual funded lifecycle is recorded against the separate demonstration contracts above.

## Automated verification

On 15 October 2026:

- `cargo test --manifest-path contracts/Cargo.toml`: 7 settlement and 4 registry tests passed.
- `pnpm test`: server 110 passed and 8 opt-in suites skipped; client 79 passed; admin 16 passed.
- `pnpm test:track-credits`: real disposable PostgreSQL metadata, publication, agreement, and settlement suites passed. Settlement has 14 subtests plus the parent test.
- `pnpm typecheck`: passed across the workspace.
- `pnpm build`: passed across the workspace. The client reports a large bundle warning.

PostgreSQL tests use real signatures and mocked chain transport. The Testnet demonstration separately verifies real network outcomes. Tests cover atomic reservations, concurrent recognition, immutable financial evidence, insufficient signatures, wrong beneficiaries, altered transactions, audit failure rollback, uncertain submissions, bounded retries, history pruning, restoration, expiry, external contract activity, and reconciliation.

## Repeat the demonstration

Run `pnpm settlements:demo:testnet`. It preserves a private database volume and transaction state under the operator's local state directory. Resume the same state after expiry or a network interruption. Do not reset an uncertain transaction to create a fresh attempt.

See [the settlement specification](../settlement-specification.md) for exact amounts, lifecycle rules, configuration, maintenance, and recovery. Private keys, database credentials, sessions, and private backups are excluded from this evidence directory.

The `initial-*.json` files preserve an earlier candidate demonstration. They are historical evidence and do not identify the final deployed binary.
