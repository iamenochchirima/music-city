import assert from "node:assert/strict";
import test from "node:test";
import { Account, Contract, Keypair, Networks, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import { env } from "../../config/env.js";
import { settlementChain } from "./settlement-chain.js";

test("live settlement events accept current RPC fields and retain receipt and identity checks", async (t) => {
  const before = { ...env };
  const contractId = "CAU2GOWTTF54DHUDEHVHSYMR6KZCT2BQK6ZVQ3KF5KIVDXJJHI4FBA43";
  Object.assign(env, {
    AGREEMENT_TREASURY_ADDRESS: Keypair.random().publicKey(),
    ROYALTY_REGISTRY_CONTRACT_ID: contractId,
    SETTLEMENT_CONTRACT_ID: contractId,
    SETTLEMENT_DEPLOYMENT_LEDGER: 100,
    STELLAR_NETWORK_PASSPHRASE: Networks.TESTNET,
    STELLAR_SETTLEMENT_ASSET_CODE: "USDC",
    STELLAR_SETTLEMENT_ASSET_ISSUER: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  });
  const tx = new TransactionBuilder(new Account(env.AGREEMENT_TREASURY_ADDRESS!, "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(contractId).call("settle", nativeToScVal(Buffer.alloc(32, 1))))
    .setTimeout(60).build();
  const hash = tx.hash().toString("hex");
  let event: Record<string, unknown> = {
    id: "0000000429496733696-0000000001", type: "contract", ledger: 101,
    ledgerClosedAt: "2026-10-29T10:08:20Z", contractId: new Contract(contractId),
    txHash: hash, topic: [nativeToScVal("music_city", { type: "symbol" }), nativeToScVal("settlement_funded", { type: "symbol" }), nativeToScVal(Buffer.alloc(32, 1))],
    value: nativeToScVal(100n),
  };
  let ledger = 101;
  let status = Api.GetTransactionStatus.SUCCESS;
  t.mock.method(Server.prototype, "getHealth", async () => ({ oldestLedger: 1, latestLedger: 101 }));
  t.mock.method(Server.prototype, "getEvents", async () => ({ events: [event], cursor: "cursor", latestLedger: 101 }));
  t.mock.method(Server.prototype, "getTransaction", async () => ({
    status, txHash: hash, ledger, envelopeXdr: tx.toEnvelope(),
    resultXdr: xdr.TransactionResult.fromXDR("AAAAAAAXL7MAAAAAAAAAAQAAAAAAAAAYAAAAABg3Jhil0bWOhU1dmq6hRuaboJ/C7sT+m1uHHCMdtLGiAAAAAA==", "base64"),
  }));
  try {
    const result = await settlementChain.events("rpc:previous");
    assert.equal(result.events.length, 1);
    assert.equal(result.events[0]!.transactionHash, hash);
    assert.equal(result.events[0]!.batchId, "01".repeat(32));
    event = { ...event, inSuccessfulContractCall: true };
    assert.equal((await settlementChain.events("rpc:previous")).events.length, 1);
    event = { ...event, inSuccessfulContractCall: false };
    await assert.rejects(settlementChain.events("rpc:previous"), /event identity/);
    delete event.inSuccessfulContractCall;
    event.type = "diagnostic";
    await assert.rejects(settlementChain.events("rpc:previous"), /event identity/);
    event.type = "contract";
    event.contractId = new Contract("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4");
    await assert.rejects(settlementChain.events("rpc:previous"), /event identity/);
    event.contractId = new Contract(contractId);
    ledger = 102;
    await assert.rejects(settlementChain.events("rpc:previous"), /ledgers differ/);
    ledger = 101;
    status = Api.GetTransactionStatus.FAILED as typeof status;
    await assert.rejects(settlementChain.events("rpc:previous"), /successful transaction receipt/);
  } finally {
    Object.assign(env, before);
  }
});
