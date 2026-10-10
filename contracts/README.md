# Music City Smart Contracts

## Royalty Split Registry

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
