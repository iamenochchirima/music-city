# Contributor agreements verification

The 2 October 2026 run used a disposable local PostgreSQL database and fresh Stellar Testnet accounts. [stellar-testnet.json](stellar-testnet.json) contains public account configuration, contributor signatures, canonical versions, transaction hashes, ledgers, contract read-back and audit history. Private signing keys are excluded.

The initial 70/30 agreement confirmed in [ledger 4987564](https://stellar.expert/explorer/testnet/tx/303c0d66841f228142387e9a548682d9731852b233cdedfa300a7af2b9ef1361). Its amendment confirmed in [ledger 4987566](https://stellar.expert/explorer/testnet/tx/bd05104c12f0cc5df4caede9dde2b9ad2b23640627cc29072b29d93d994d22f4). Version 2 remains disputed; version 3 required both contributors to sign new challenges. An attempt before the second contributor accepted was blocked. Sending the prepared finalization with one treasury signer returned `txBadAuth` and no publication. Two distinct signatures succeeded.

The deployed replacement contract is [CA6D67SDN2LB4QNFQQIRMT5DL5WWU4WZ6ZNAL2H2Q26254YVONEZKLQF](https://stellar.expert/explorer/testnet/contract/CA6D67SDN2LB4QNFQQIRMT5DL5WWU4WZ6ZNAL2H2Q26254YVONEZKLQF). This disposable treasury is separate from the project's existing receiving wallet and production data.

## Repeat the demonstration

Use an empty disposable **local** PostgreSQL database whose name ends in `_test`. Build the shared package and contract first:

```sh
pnpm --filter @music-city/shared build
rustup target add wasm32v1-none
pnpm contract:build

AGREEMENTS_TEST_DATABASE_URL=postgres://postgres:LOCAL_TEST_PASSWORD@127.0.0.1:5447/agreements_testnet_test \
AGREEMENTS_DEMO_STATE_PATH=/tmp/music-city-testnet-demo/state.json \
pnpm --filter server agreements:demo:testnet
```

The script generates five fresh keypairs, funds the treasury and two contributors through Friendbot, uploads and deploys the registry, configures three treasury signers of weight one and all thresholds at two, and runs the actual application services against the local database and official Testnet RPC/Horizon. It verifies signatures and on-chain results without mocking the network. Initial single-master signing is used only for contract/account bootstrap before the threshold is established.

The state file contains private disposable Testnet keys and prepared transactions, is written with mode `0600`, and must stay outside the repository. Keep the same database and state path when resuming an interrupted run. The script persists exact transaction XDR/hash before submission and checks that same transaction rather than creating a replacement on an uncertain outcome. Resumption needs those transactions to remain in RPC history; if evidence is unavailable or an envelope fails, it stops explicitly. Do not erase state to retry an uncertain submission. For an independent new run, use a new empty database and new state path.

The public JSON record is updated during the run and has `status: verified` only after both finalized versions, the preserved dispute and effective version are checked. A new run replaces that public record; keep the corresponding screenshots and document links aligned if replacing the recorded demonstration.

## Automated verification

```sh
pnpm --filter client --filter admin test
pnpm --filter server test
AGREEMENTS_TEST_DATABASE_URL=postgres://postgres:LOCAL_TEST_PASSWORD@127.0.0.1:5447/agreements_test \
pnpm --filter server exec tsx --test --test-concurrency=1 \
  src/modules/agreements/agreements.integration.test.ts \
  src/modules/agreements/finalization.integration.test.ts
pnpm contract:test
pnpm typecheck
pnpm build
```

The database tests refuse remote connections or database names without `_test`. They use real PostgreSQL transactions and generated Ed25519 signatures. Finalization integration tests mock only the RPC boundary to exercise failure, concurrency and reconciliation. The live demonstration separately verifies actual chain authorization.

Creator/admin component tests render the production components with mocked HTTP and wallet transports. They verify review, cancellation, error handling, response actions, signature collection, permissions and status/history. They do not prove real Freighter browser-extension signing. That authenticated creator browser check remains a milestone gate.

## Browser evidence

- [Creator provider unavailable](creator-provider-unavailable.png): historical screenshot of Dynamic's initialization failure, which led to the direct Freighter wallet path; successful extension signing remains unverified.
- [Admin confirmed Testnet publication](admin-testnet-finalized.png): accepted 70/30 proposal, two signers, ledger and explorer link, read through the real local API/database.
- [Admin Testnet version history](admin-testnet-history.png): finalized versions 1/3 and preserved disputed version 2 with fresh consent and audit events.
- [Dispute review](admin-dispute.png) and [resolution](admin-resolution.png): earlier disposable local fixtures exercising admin resolution into an unsigned owner-controlled draft.

Production migration/deployment, treasury custody and broad hardening remain later work. These results do not claim completion of the settlement or direct-support milestones, or all of SOW Deliverable 2.
