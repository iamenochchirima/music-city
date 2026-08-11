# Music City Smart Contracts

## Royalty Split Registry

The `royalty-split-registry` Soroban contract is the canonical rights anchor for Music City track royalty splits. Revenue accounting and payouts remain in the application backend.

### Commands

```bash
pnpm contract:test
pnpm contract:build
```

The optimized WASM is written to:

```text
contracts/target/wasm32v1-none/release/royalty_split_registry.wasm
```

### Contract methods

- `__constructor(admin)` configures the only account allowed to publish or freeze splits.
- `set_track_split(track_id, version, recipients, metadata_hash)` publishes the next immutable split version.
- `get_track_split(track_id)` reads the latest version.
- `get_track_split_version(track_id, version)` reads a historical version.
- `freeze_track_split(track_id, version)` permanently prevents new versions for the track.
- `admin()` returns the configured administrator.

Each published split must have 1–20 unique recipients and total exactly 10,000 basis points.

### Stellar Testnet deployment

- Contract ID: [`CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3`](https://stellar.expert/explorer/testnet/contract/CD2ONBXRTTPKFHNOI2BV3UYUZOOC75R5LPUPCLSRDZHUWM5OAQVACNF3)
- Deployment transaction: [`c313274d…b75d6`](https://stellar.expert/explorer/testnet/tx/c313274db1575c8c018dd2646e4e388e9a2794b0d21f738fbe55fc7e500b75d6)
- Verified publish/read-back transaction: [`960ccef9…9a98b`](https://stellar.expert/explorer/testnet/tx/960ccef9c9b5d2d7c9ed2b3721be3884ba464722278044fb32941a685059a98b)
- Full deployment record: [`deployments/stellar-testnet.json`](deployments/stellar-testnet.json)

Run the live read-back check with:

```bash
pnpm --filter server royalty:verify-soroban
```
