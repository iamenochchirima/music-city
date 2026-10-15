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

The original capture did not exercise Dynamic. The subsequent [real Dynamic browser record](dynamic-browser.json) closes SET-03 and SET-20. Reviewer acceptance remains SET-24.

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

## Real Dynamic browser follow-up

[Dynamic browser evidence](dynamic-browser.json) records real hosted-provider authentication for two separate Sandbox identities, embedded Stellar wallet creation, trustline signing, four exact contributor consent signatures, and four confirmed creator claims. No Dynamic contributor private key was exported or supplied to the CLI.

CLI setup created a disposable track and initial proposed 70/30 agreement, supplied native reserves through Friendbot, and used two existing treasury keys to finalize accepted versions and fund each 0.01 USDC source. The actual creator pages handled contributor review and signatures. The owner created the 60/40 amendment through the actual editor. It began with no inherited consent, left version one effective until finalization, and changed only the later source.

The in-app browser used the existing allowed origin `http://localhost:3000`, the Dynamic Sandbox environment, and a local API with the same environment's JWKS verification. No production authentication setting was weakened. Sandbox test accounts use Dynamic's official static verification mechanism. Sandbox Wallet Sign also requires provider reauthentication, so cancellation was verified inside the real provider flow.

Cancelling consent authorization recorded no contributor acceptance. Cancelling withdrawal authorization left an available entitlement and a prepared attempt with zero signatures and zero submissions. Retry confirmed the same transaction hash once. The page changed from signing to confirming to received without a refresh. The listener contributor could claim without artist activation.

The new sources total 0.02 USDC, all claimed. Combined with the earlier demonstration, the escrow independently reconciles 200.02 funded, 170.02 claimed, 30 recovered, zero outstanding, and zero token balance. These are demonstration contracts, separate from the fresh live application contracts.

- [Provider authorization prompt](dynamic-step-up-signing-prompt.png)
- [Cancelled consent](dynamic-wallet-consent-cancelled.png)
- [Cancelled withdrawal authorization](dynamic-withdrawal-wallet-cancelled.png)
- [Both contributor receipts](dynamic-contributor-claims-confirmed.png)
- [Both owner receipts](dynamic-all-owner-claims-confirmed.png)

The browser test found two integration defects. Custom wallet actions now request Dynamic's `wallet:sign` authorization when required, and the app no longer dismisses provider reauthentication merely because a user is already signed in. Cancellation propagates before signing or submitting. The shared authorization applies to agreements, claims, transfers, checkout, and trustlines. It does not introduce a test signer or alternative production payout path.

[Final deployment verification](dynamic-deployment.json) records commit `721fe67`, 85 passing client tests, client typecheck and build, deployment IDs, served code, Live authentication identity, and the healthy worker report. Backend and contract source are unchanged from the preceding verified rollout. SET-01 through SET-23 are complete; SET-24 and separate SOW scope remain open.
