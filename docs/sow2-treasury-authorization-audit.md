# SOW 2 treasury authorization audit

Date: 28 October 2026. Scope: current repository code and local tests. The historical Testnet evidence is identified separately below.

| Action | Required authority | Current enforcement |
| --- | --- | --- |
| Publish a finalized contributor split | Two of three treasury signers | The registry requires treasury authorization. The finalization service verifies the exact signed envelope and the current signer configuration before submission. |
| Fund an earnings settlement | Two of three treasury signers | The settlement contract requires treasury authorization. The settlement service checks the exact signed transaction and the configured signers. |
| Reclaim an expired allocation | Two of three treasury signers | The settlement contract requires treasury authorization. The settlement service uses the same signed-transaction check. |
| Maintain settlement records | Two of three treasury signers | Maintenance submits a treasury-sourced transaction through the same signed-transaction check. |
| Restore archived records | Two of three treasury signers | Restoration uses a treasury-sourced `restoreFootprint` transaction and the same signed-transaction check. |
| Change protected treasury or financial configuration | No mutable configuration action is exposed | The prior single-key transfer, payout executor and mutable treasury and fee routes are absent. Contract configuration is established at deployment. |

A creator claim is a separate action. It requires the beneficiary's signature and does not use an administrator signature.

## Local verification

- `settlement-domain.test.ts` checks each protected settlement action with zero, repeated, and two independent signatures over the exact transaction.
- `treasury-signatures.test.ts` checks three distinct weight-one signers, thresholds of two, altered envelopes, wrong networks, outsiders, duplicate signatures and expiry.
- `settlement.integration.test.ts` checks one-signer funding rejection, funding recovery, maintenance and two-signer restoration with PostgreSQL and real test signatures. Its chain transport is mocked.
- `finalization.integration.test.ts` checks one-signer finalization rejection, two-signer submission and recovery with PostgreSQL and real test signatures. Its chain transport is mocked.
- The administrator router tests check read access, super-admin operation access and removal of legacy privileged routes.
- `cargo test --workspace` checks contract authorization and settlement behavior. Contract tests use the Soroban test environment.

On 28 October, the protected-action and signature tests passed 14 tests. The settlement PostgreSQL suite and signature tests passed 20 tests. The finalization and administrator router suites passed 13 tests. The contract workspace passed 11 tests. Both PostgreSQL suites used separate local test databases.

The earlier [settlement Testnet evidence](settlement-evidence/README.md) and [agreement lifecycle evidence](contributor-agreements-evidence/lifecycle-review/README.md) record real Testnet signatures and transactions for their dated revisions. The local tests above do not establish the current production treasury configuration or reviewer acceptance. Verify the deployed configuration separately before production operations.
