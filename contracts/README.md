# Music City Smart Contracts

## Contributor controlled registry

`contributor-registry` is the opt-in local Testnet replacement. Its constructor takes the payout treasury and a separate track-ownership registrar. `register_track` binds an owner once; `respond` records owner/contributor authorization and automatically finalizes after all required approvals. Decisions, cancellation and amended versions are enforced on-chain. Existing beneficiaries must approve amendments even when removed from the new split.

The finalized read interface remains compatible with the earnings settlement contract. That contract is redeployed with the new registry address; treasury funding and recovery still require two signatures, while each claim requires only its beneficiary. The legacy contracts and data are preserved.

Use `AGREEMENT_PUBLICATION_MODE=contributors` only with its matching registry and fresh rehearsal database. Automatic registration is restricted to non-production Testnet. The registrar trusts the application's authenticated owner mapping and cannot overwrite an existing owner. Production rollout and SOW alignment remain separate.

See [the bounded implementation plan](../docs/contributor-controlled-agreements-implementation-plan.md) and [current verification evidence](../docs/contributor-controlled-agreements-evidence/README.md). Generated-key Testnet verification is distinct from Dynamic/Firefox browser verification.

## Treasury authorized royalty split registry

The `royalty-split-registry` Soroban contract records immutable finalized contributor agreement versions. Revenue accounting and payouts remain in the application backend. The agreement service verifies contributor signatures and prepares an exact transaction from a dedicated 2-of-3 Stellar treasury; the contract requires authorization from that treasury account.

### Commands

```bash
rustup target add wasm32v1-none
pnpm contract:test
pnpm contract:build
```

The release WASM is written to:

```text
contracts/target/wasm32v1-none/release/royalty_split_registry.wasm
```

### Contract methods

- `__constructor(treasury)` configures the account required to authorize publication.
- `treasury()` returns that account.
- `finalize_split(track_id, agreement_id, version, recipients, proposal_hash, previous_finalized_hash)` records an immutable version. Its transaction must be authorized by the treasury account.
- `get_finalized_split(track_id)` reads the latest finalized version.
- `get_finalized_version(track_id, version)` reads a historical finalized version.

Each published split has 1–20 unique Stellar recipient addresses and totals exactly 10,000 basis points. Recipient roles and shares, agreement identity and approved proposal hash are recorded together. Versions must increase, with gaps allowed for rejected proposals. An amendment binds the previous finalized hash, retains the same agreement identity and never edits historical versions. An identical retry returns the original record; conflicting republication fails.

Application configuration requires `AGREEMENT_TREASURY_ADDRESS` and `ROYALTY_REGISTRY_CONTRACT_ID` explicitly. The service verifies three independent Ed25519 signers of weight one, with low, medium and high account thresholds all set to two. It verifies that the registry's treasury matches the configured account. No backend treasury secret participates in agreement finalization. Existing payout configuration belongs to the separate settlement flow.

### Replacement Testnet verification

On 2 October 2026, a fresh disposable treasury with three independent signers and threshold two finalized 70/30 agreements on the replacement contract:

- Contract: [`CA6D67SDN2LB4QNFQQIRMT5DL5WWU4WZ6ZNAL2H2Q26254YVONEZKLQF`](https://stellar.expert/explorer/testnet/contract/CA6D67SDN2LB4QNFQQIRMT5DL5WWU4WZ6ZNAL2H2Q26254YVONEZKLQF)
- Version 1: [confirmed transaction](https://stellar.expert/explorer/testnet/tx/303c0d66841f228142387e9a548682d9731852b233cdedfa300a7af2b9ef1361)
- Version 3 after disputed version 2 and fresh consent: [confirmed transaction](https://stellar.expert/explorer/testnet/tx/bd05104c12f0cc5df4caede9dde2b9ad2b23640627cc29072b29d93d994d22f4)
- One-signature submission was rejected by Testnet with `txBadAuth`; publication was absent at that point.
- [Public verification record](../docs/contributor-agreements-evidence/stellar-testnet.json) and [repeatable setup](../docs/contributor-agreements-evidence/README.md).

This is a disposable Testnet demonstration, not production configuration. Production deployment and key custody are deferred.

### Historical Testnet deployment

The following record belongs to the previous set/freeze contract. It is retained as historical evidence and does **not** verify this replacement contract. The replacement deployment and live 2-of-3 evidence are linked above.

- Contract ID: [`CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3`](https://stellar.expert/explorer/testnet/contract/CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3)
- Deployment transaction: [`c313274d…b75d6`](https://stellar.expert/explorer/testnet/tx/c313274db1575c8c018dd2646e4e388e9a2794b0d21f738fbe55fc7e500b75d6)
- Verified publish/read-back transaction: [`960ccef9…9a98b`](https://stellar.expert/explorer/testnet/tx/960ccef9c9b5d2d7c9ed2b3721be3884ba464722278044fb32941a685059a98b)
- Full deployment record: [`deployments/stellar-testnet.json`](deployments/stellar-testnet.json)

The old read-back script, generated set/freeze binding and single-key registry publisher have been removed. Finalization runs through the contributor agreement API and the dedicated treasury signing flow. Historical split rows remain read-only financial evidence; new allocations use the explicit effective finalized agreement and its confirmed transaction evidence.

## Payout run funding

`payout-run` is an immutable coordinator configured with one existing earnings-settlement address. `fund(run_id, requests)` requires that settlement's treasury authorization and atomically invokes `settle` for up to ten complete earnings sources. Exact run retries are idempotent; a changed request under the same run ID fails. Each source is still validated and consumed by the original escrow, with its own finalized split, fee terms, claim deadline and beneficiary claims. The coordinator neither holds tokens nor signs claims. Existing escrow deployments need no migration. The application simulates and reserves the exact set before preparing one treasury transaction; it verifies the receipt ledger and funded state of every member before confirming the attempt.

## Prefunded earnings pool

`earnings-pool` is an additive immutable contract for new song purchases. Native buyer authorization pays USDC and records earnings against the registry's exact current finalized split in one atomic `buy` invocation. Gross proceeds enter the shared pool and the configured fee goes to treasury. There is no earnings registrar or per-purchase admin authorization. Each non-expiring claim requires its beneficiary. Order IDs prevent duplicate earning registration and changed order reuse; consumed claims cannot be replayed. Treasury-authorized `top_up` creates no earnings. Treasury-authorized `return_surplus` cannot reduce reserves below outstanding contributor obligations. Existing escrow payouts keep their own contracts, expiry rules and history. Pool/catalog checkout integration and exact receipts are covered by the dated local verification record.
