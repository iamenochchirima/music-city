import assert from "node:assert/strict";
import test from "node:test";
import {
  Account,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import type { SettlementConfig } from "@music-city/shared";
import type { ChainBatch } from "./settlement-chain.js";
import {
  loadHistoricalSettlementEvents,
  shouldBackfillSettlementEvents,
} from "./settlement-event-archive.js";

const contractId = "CAU2GOWTTF54DHUDEHVHSYMR6KZCT2BQK6ZVQ3KF5KIVDXJJHI4FBA43";
const batchBytes = Buffer.alloc(32, 1);
const sourceId = Buffer.alloc(32, 2);
const proposalHash = Buffer.alloc(32, 3);
const receiptResultXdr = "AAAAAAAXL7MAAAAAAAAAAQAAAAAAAAAYAAAAABg3Jhil0bWOhU1dmq6hRuaboJ/C7sT+m1uHHCMdtLGiAAAAAA==";

function fixture() {
  const config: SettlementConfig = {
    contractId,
    registryId: "CB2RE3YAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA2BD",
    assetContractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    treasuryAddress: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    networkPassphrase: Networks.TESTNET,
    assetCode: "USDC",
    assetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  };
  const initiator = Keypair.random().publicKey();
  const tx = new TransactionBuilder(new Account(initiator, "1"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      new Contract(contractId).call(
        "settle",
        nativeToScVal(batchBytes, { type: "bytes" }),
      ),
    )
    .setTimeout(30)
    .build();
  const envelope = tx.toXDR();
  const txHash = tx.hash().toString("hex");
  const batch: ChainBatch = {
    request: {
      batch_id: batchBytes,
      source_id: sourceId,
      track_id: "track",
      agreement_id: "agreement",
      version: 1,
      proposal_hash: proposalHash,
      gross_amount: 100n,
      fee_bps: 100,
      expires_at: 1_800_000_000n,
    },
    claims: [],
    funded: 100n,
    claimed: 0n,
    reclaimed: 0n,
    funded_ledger: 1,
  };
  const eventValue = nativeToScVal(
    {
      amount: 100n,
      expires_at: batch.request.expires_at,
      proposal_hash: proposalHash,
      source_id: sourceId,
    },
    {
      type: {
        amount: ["symbol", "i128"],
        expires_at: ["symbol", "u64"],
        proposal_hash: ["symbol", "bytes"],
        source_id: ["symbol", "bytes"],
      },
    },
  );
  const event = {
    id: "4294967297-0002",
    contract: contractId,
    initiator,
    ts: 1_800_000_000,
    topicsXdr: [
      nativeToScVal("music_city").toXDR("base64"),
      nativeToScVal("settlement_funded").toXDR("base64"),
      nativeToScVal(batchBytes, { type: "bytes" }).toXDR("base64"),
    ],
    bodyXdr: eventValue.toXDR("base64"),
  };
  const horizonTransaction = {
    hash: txHash,
    paging_token: "4294967296",
    ledger: 1,
    successful: true,
    source_account: initiator,
    fee_charged: "1519539",
    envelope_xdr: envelope,
    result_xdr: receiptResultXdr,
  };
  const operation = {
    type: "invoke_host_function",
    function: "HostFunctionTypeHostFunctionTypeInvokeContract",
    parameters: [
      { value: nativeToScVal(contractId, { type: "address" }).toXDR("base64") },
      { value: nativeToScVal("settle", { type: "symbol" }).toXDR("base64") },
    ],
  };
  const fetcher = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    let body: unknown;
    if (url.pathname.endsWith(`/contract/${contractId}`)) {
      body = { contract: contractId, events: 1 };
    } else if (url.pathname.endsWith(`/contract/${contractId}/events`)) {
      body = { _embedded: { records: [event] } };
    } else if (url.pathname === "/ledgers/1/transactions") {
      body = { _embedded: { records: [horizonTransaction] } };
    } else if (url.pathname.endsWith(`/transactions/${txHash}/operations`)) {
      body = { _embedded: { records: [operation] } };
    } else {
      throw new Error(`Unexpected test URL: ${url}`);
    }
    return new Response(JSON.stringify(body), { status: 200 });
  };
  return {
    config,
    event,
    batch,
    fetcher,
    readBatch: async (id: string) => (id === batchBytes.toString("hex") ? batch : null),
  };
}

test("legacy event cursors trigger one archive catch-up before RPC polling", () => {
  assert.equal(shouldBackfillSettlementEvents(100, 200), true);
  assert.equal(shouldBackfillSettlementEvents(100, 200, "legacy-cursor"), true);
  assert.equal(shouldBackfillSettlementEvents(100, 200, "rpc:new-cursor"), false);
  assert.equal(shouldBackfillSettlementEvents(200, 200, "legacy-cursor"), false);
});

test("historical settlement backfill verifies transaction, fee, contract call, and chain state", async () => {
  const state = fixture();
  const events = await loadHistoricalSettlementEvents(
    state.config,
    "https://horizon.testnet",
    2,
    state.readBatch,
    state.fetcher,
  );
  assert.equal(events.length, 1);
  assert.equal(events[0]!.id, "0000000004294967296-0000000002");
  assert.equal(events[0]!.transactionHash.length, 64);
  assert.equal(events[0]!.ledger, 1);
  assert.equal(events[0]!.batchId, batchBytes.toString("hex"));
  assert.equal(events[0]!.payload.receipt.feeCharged, "1519539");
  assert.equal(events[0]!.payload.receipt.ledger, 1);
});

test("historical backfill refuses an event whose body differs from contract state", async () => {
  const state = fixture();
  state.event.bodyXdr = nativeToScVal(
    {
      amount: 99n,
      expires_at: state.batch.request.expires_at,
      proposal_hash: proposalHash,
      source_id: sourceId,
    },
    {
      type: {
        amount: ["symbol", "i128"],
        expires_at: ["symbol", "u64"],
        proposal_hash: ["symbol", "bytes"],
        source_id: ["symbol", "bytes"],
      },
    },
  ).toXDR("base64");
  await assert.rejects(
    loadHistoricalSettlementEvents(
      state.config,
      "https://horizon.testnet",
      2,
      state.readBatch,
      state.fetcher,
    ),
    /funding event differs from contract state/,
  );
});

test("historical backfill refuses an event whose transaction initiator differs", async () => {
  const state = fixture();
  const mismatchedInitiator: typeof fetch = async (input) => {
    const response = await state.fetcher(input);
    const url = new URL(String(input));
    if (url.pathname !== "/ledgers/1/transactions") return response;
    const result = (await response.json()) as {
      _embedded: { records: { source_account: string }[] };
    };
    result._embedded.records[0]!.source_account = Keypair.random().publicKey();
    return new Response(JSON.stringify(result), { status: 200 });
  };
  await assert.rejects(
    loadHistoricalSettlementEvents(
      state.config,
      "https://horizon.testnet",
      2,
      state.readBatch,
      mismatchedInitiator,
    ),
    /no matching successful transaction/,
  );
});

test("historical backfill refuses an event if the explorer total is incomplete", async () => {
  const state = fixture();
  const incomplete = async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith(`/contract/${contractId}`))
      return new Response(JSON.stringify({ contract: contractId, events: 2 }), { status: 200 });
    return state.fetcher(input);
  };
  await assert.rejects(
    loadHistoricalSettlementEvents(
      state.config,
      "https://horizon.testnet",
      2,
      state.readBatch,
      incomplete,
    ),
    /event count does not reconcile/,
  );
});
