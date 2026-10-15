import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import {
  Address,
  Asset,
  BASE_FEE,
  Contract,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  nativeToScVal,
  scValToNative,
  type Transaction,
} from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import type { FinancialAttempt, SettlementBatch } from "@music-city/shared";
const databaseUrl = process.env.SETTLEMENTS_TEST_DATABASE_URL,
  statePath = process.env.SETTLEMENTS_DEMO_STATE_PATH;
if (!databaseUrl || !statePath)
  throw new Error(
    "Set SETTLEMENTS_TEST_DATABASE_URL and SETTLEMENTS_DEMO_STATE_PATH",
  );
const dbUrl = new URL(databaseUrl);
if (
  !["localhost", "127.0.0.1"].includes(dbUrl.hostname) ||
  !dbUrl.pathname.endsWith("_test")
)
  throw new Error(
    "Use a disposable local Testnet demonstration database ending in _test",
  );
const root = resolve(import.meta.dirname, "../../..");
if (resolve(statePath).startsWith(root + "/"))
  throw new Error("Private state must remain outside the repository");
const evidenceDir = resolve(root, "docs/settlement-evidence");
await mkdir(evidenceDir, { recursive: true });
// Reuse the agreement demonstration's actual consent, threshold configuration, and registry.
await new Promise<void>((fulfill, reject) => {
  const child = spawn(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve(import.meta.dirname, "demo-contributor-agreements-testnet.ts"),
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        AGREEMENTS_TEST_DATABASE_URL: databaseUrl,
        AGREEMENTS_DEMO_STATE_PATH: statePath,
        AGREEMENTS_DEMO_INITIAL_ONLY: "true",
        AGREEMENTS_DEMO_EVIDENCE_PATH: resolve(
          evidenceDir,
          "agreements-testnet.json",
        ),
      },
    },
  );
  child.on("error", reject);
  child.on("exit", (code) =>
    code === 0
      ? fulfill()
      : reject(new Error(`Agreement bootstrap exited ${code}`)),
  );
});
type State = {
  secrets: string[];
  trackId: string;
  agreementId: string;
  contractId: string;
  transactions: Record<string, { xdr: string; hash: string }>;
  evidence: Record<string, unknown>;
  settlementContractId?: string;
  settlementDeploymentLedger?: number;
  settlementSalt?: string;
  sources?: Record<string, string>;
  batchIds?: Record<string, string>;
};
const state: State = JSON.parse(await readFile(statePath, "utf8"));
const [treasury, signerB, _signerC, owner, contributor] = state.secrets.map(
  (s) => Keypair.fromSecret(s),
) as [Keypair, Keypair, Keypair, Keypair, Keypair];
const rpc = new Server("https://soroban-testnet.stellar.org", {
    timeout: 30000,
  }),
  network = Networks.TESTNET;
assert.equal((await rpc.getNetwork()).passphrase, network);
const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  asset = new Asset("USDC", issuer),
  assetId = asset.contractId(network);
const publicEvidence: Record<string, unknown> = {
  status: "in_progress",
  network,
  assetCode: "USDC",
  assetIssuer: issuer,
  assetContractId: assetId,
  treasuryAddress: treasury.publicKey(),
  registryId: state.contractId,
  trackId: state.trackId,
  agreementId: state.agreementId,
  claimMechanism:
    "Soroban escrow, contract ID + batch ID + recipient index. Not native balance IDs.",
  walletEvidence:
    "Generated disposable keys exercise real Testnet transactions. Dynamic browser wallet verification is separate.",
};
try {
  const previous = JSON.parse(
    await readFile(resolve(evidenceDir, "stellar-testnet.json"), "utf8"),
  );
  if (
    previous.registryId === state.contractId &&
    previous.treasuryAddress === treasury.publicKey()
  )
    Object.assign(publicEvidence, previous);
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
}
async function save() {
  await writeFile(statePath + ".tmp", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
  await rename(statePath + ".tmp", statePath!);
  await writeFile(
    resolve(evidenceDir, "stellar-testnet.json"),
    JSON.stringify(
      {
        ...publicEvidence,
        verifiedAt: new Date().toISOString(),
        settlementContractId: state.settlementContractId,
      },
      null,
      2,
    ) + "\n",
  );
}
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function wait(hash: string) {
  for (let i = 0; i < 30; i++) {
    const r = await rpc.getTransaction(hash);
    if (r.status === Api.GetTransactionStatus.SUCCESS) return r;
    if (r.status === Api.GetTransactionStatus.FAILED)
      throw new Error(`Transaction failed ${hash}`);
    await delay(2000);
  }
  throw new Error(
    `Unknown transaction outcome. Resume the same private state: ${hash}`,
  );
}
async function stage(
  name: string,
  source: Keypair,
  operation: Parameters<TransactionBuilder["addOperation"]>[0],
  soroban = false,
  threshold = false,
) {
  let stored = state.transactions[name];
  if (!stored) {
    let tx = new TransactionBuilder(await rpc.getAccount(source.publicKey()), {
      fee: BASE_FEE,
      networkPassphrase: network,
    })
      .addOperation(operation)
      .setTimeout(600)
      .build();
    if (soroban) tx = await rpc.prepareTransaction(tx);
    tx.sign(source);
    if (threshold) tx.sign(signerB);
    stored = { xdr: tx.toXDR(), hash: tx.hash().toString("hex") };
    state.transactions[name] = stored;
    await save();
  }
  let result = await rpc.getTransaction(stored.hash);
  if (result.status !== Api.GetTransactionStatus.SUCCESS) {
    if (result.status === Api.GetTransactionStatus.FAILED)
      throw new Error(
        `${name} already failed. Inspect original transaction ${stored.hash}`,
      );
    const sent = await rpc.sendTransaction(
      TransactionBuilder.fromXDR(stored.xdr, network),
    );
    if (sent.status === "ERROR")
      throw new Error(
        `${name} rejected: ${sent.errorResult?.result().switch().name}`,
      );
    result = await wait(stored.hash);
  }
  publicEvidence[name] = {
    transactionHash: stored.hash,
    ledger: result.ledger,
    explorerUrl: `https://stellar.expert/explorer/testnet/tx/${stored.hash}`,
  };
  await save();
  return result;
}
for (const key of [treasury, owner, contributor])
  await stage(
    `trustline-${key.publicKey()}`,
    key,
    Operation.changeTrust({ asset }),
    false,
    key === treasury,
  );
const paths = new URL(
  "https://horizon-testnet.stellar.org/paths/strict-receive",
);
paths.search = new URLSearchParams({
  source_assets: "native",
  destination_asset_type: "credit_alphanum4",
  destination_asset_code: "USDC",
  destination_asset_issuer: issuer,
  destination_amount: "200",
}).toString();
if (!state.transactions.demoUSDC) {
  const response = await fetch(paths);
  if (!response.ok)
    throw new Error("Cannot discover Testnet USDC funding path");
  const records = (await response.json()) as {
    _embedded: {
      records: {
        source_amount: string;
        path: { asset_code: string; asset_issuer: string }[];
      }[];
    };
  };
  const route = records._embedded.records.find((r) => r.path.length === 0);
  if (!route)
    throw new Error("No direct Testnet XLM to Circle USDC route available");
  await stage(
    "demoUSDC",
    treasury,
    Operation.pathPaymentStrictReceive({
      sendAsset: Asset.native(),
      sendMax: (
        Math.ceil(Number(route.source_amount) * 1.1 * 1e7) / 1e7
      ).toFixed(7),
      destination: treasury.publicKey(),
      destAsset: asset,
      destAmount: "200",
      path: [],
    }),
    false,
    true,
  );
} else
  await stage(
    "demoUSDC",
    treasury,
    Operation.manageData({ name: "unused", value: null }),
    false,
    true,
  );
const wasm = await readFile(
  resolve(
    root,
    "contracts/target/wasm32v1-none/release/earnings_settlement.wasm",
  ),
);
const upload = await stage(
  "settlementContractUpload",
  treasury,
  Operation.uploadContractWasm({ wasm }),
  true,
  true,
);
assert.equal(
  createHash("sha256").update(wasm).digest("hex"),
  upload.returnValue!.bytes().toString("hex"),
  "Deployed settlement WASM must match this checkout",
);
publicEvidence.wasmSha256 = createHash("sha256").update(wasm).digest("hex");
state.settlementSalt ??= randomBytes(32).toString("hex");
await save();
const deployed = await stage(
  "settlementContractDeployment",
  treasury,
  Operation.createCustomContract({
    address: Address.fromString(treasury.publicKey()),
    wasmHash: upload.returnValue!.bytes(),
    salt: Buffer.from(state.settlementSalt, "hex"),
    constructorArgs: [
      new Address(treasury.publicKey()).toScVal(),
      new Address(state.contractId).toScVal(),
      new Address(assetId).toScVal(),
    ],
  }),
  true,
  true,
);
state.settlementContractId = scValToNative(deployed.returnValue!);
state.settlementDeploymentLedger=deployed.ledger;
await save();
Object.assign(process.env, {
  DATABASE_URL: databaseUrl,
  NODE_ENV: "test",
  STELLAR_NETWORK_PASSPHRASE: network,
  STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  STELLAR_SOROBAN_RPC_URL: "https://soroban-testnet.stellar.org",
  AGREEMENT_TREASURY_ADDRESS: treasury.publicKey(),
  ROYALTY_REGISTRY_CONTRACT_ID: state.contractId,
  SETTLEMENT_CONTRACT_ID: state.settlementContractId,
  SETTLEMENT_DEPLOYMENT_LEDGER:String(deployed.ledger),
  STELLAR_SETTLEMENT_ASSET_CODE: "USDC",
  STELLAR_SETTLEMENT_ASSET_ISSUER: issuer,
});
const { databaseService: db } = await import("../services/database.service.js");
const { settlementService: s } = await import(
  "../modules/settlements/settlement.service.js"
);
const { settlementChain: chain, settlementRequest } = await import(
  "../modules/settlements/settlement-chain.js"
);
const { finalizedSplitsRepository: splits } = await import(
  "../modules/agreements/effective-split.js"
);
const { agreementsService: agreements } = await import(
  "../modules/agreements/agreements.service.js"
);
const { finalizationService: finalizations } = await import(
  "../modules/agreements/finalization.service.js"
);
const { royaltiesRepository: ledger } = await import(
  "../modules/royalties/royalties.repository.js"
);
function signed(xdr: string, key: Keypair) {
  const tx = TransactionBuilder.fromXDR(xdr, network);
  tx.sign(key);
  return tx.toXDR();
}
async function finish(a: FinancialAttempt) {
  for (let i = 0; i < 30 && a.status !== "confirmed"; i++) {
    if (["failed", "expired"].includes(a.status))
      throw new Error(`${a.kind} ${a.status}: ${a.error}`);
    await delay(2000);
    a = await s.reconcile(a.id);
  }
  assert.equal(a.status, "confirmed");
  return a;
}
async function treasuryAction(
  batch: SettlementBatch,
  kind: "settle" | "reclaim",
  index?: number,
) {
  let a = await s.prepare(
    batch.id,
    kind,
    "admin:testnet-settlement-demo",
    index,
  );
  if (a.status === "awaiting_signatures") {
    for (const key of [treasury, signerB])
      a = await s.addSignature(
        a.id,
        a.actor,
        { signedTransaction: signed(a.transaction, key) },
        true,
      );
    a = await s.submit(a.id, a.actor, true);
  }
  return finish(a);
}
try {
  await db.initialize({ repair: false });
  publicEvidence.configuration = await chain.verifyConfiguration();
  state.sources ??= {};
  state.batchIds ??= {};
  let batch: SettlementBatch;
  if (!state.batchIds.initial) {
    const split = (await splits.list(state.trackId)).find(
      (s) => s.version === 1,
    )!;
    assert.ok(split);
    const sourceId = (state.sources.initial ??= randomUUID());
    await save();
    const existing = await ledger.listLedgerEntriesBySource(
      "manual_adjustment",
      sourceId,
    );
    if (!existing.length) {
      for (const recipient of split.recipients) {
        const amount = recipient.shareBps === 7000 ? "70" : "30",
          stamp = new Date().toISOString();
        await ledger.upsertLedgerEntry({
          id: randomUUID(),
          trackId: state.trackId,
          splitId: split.id,
          sourceType: "manual_adjustment",
          sourceId,
          recipientWalletAddress: recipient.walletAddress,
          recipientRole: recipient.role,
          recipientChain: "stellar",
          status: "approved",
          grossAmount: amount,
          netAmount: amount,
          feeBps: 0,
          assetCode: "USDC",
          assetIssuer: issuer,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }
    const preview = await s.preview({
      trackId: state.trackId,
      sourceType: "manual_adjustment",
      sourceId,
      expiresAt: new Date(
        Math.floor((Date.now() + 720000) / 1000) * 1000,
      ).toISOString(),
    });
    batch = await s.reserve(
      {
        trackId: preview.trackId,
        sourceType: preview.sourceType,
        sourceId,
        expiresAt: preview.expiresAt,
      },
      preview.id,
      "admin:testnet-settlement-demo",
    );
    state.batchIds.initial = batch.id;
    await save();
  } else batch = (await s.detail(state.batchIds.initial)).batch;
  const funded = await treasuryAction(batch, "settle");
  publicEvidence.funding = funded;
  await save();
  await s.reconcileBatch(batch.id);
  batch = (await s.detail(batch.id)).batch;
  const index = batch.allocations.findIndex(
    (a) => a.beneficiary === owner.publicKey(),
  );
  let claim = await s.prepare(batch.id, "claim", owner.publicKey(), index);
  if (claim.status === "awaiting_signatures") {
    claim = await s.addSignature(claim.id, owner.publicKey(), {
      signedTransaction: signed(claim.transaction, owner),
    });
    claim = await s.submit(claim.id, owner.publicKey());
  }
  claim = await finish(claim);
  publicEvidence.creatorClaim = claim;
  await save();
  const actual = await chain.getBatch(batch);
  assert.ok(actual);
  assert.equal(actual.claimed, 700000000n);

  // Amend only future earnings. The already funded first batch remains bound to version one.
  let detail = await agreements.get(state.agreementId, owner.publicKey());
  let version = detail.versions.find(
    (v) => v.proposal.version === detail.currentVersion,
  )!;
  if (version.proposal.version === 1) {
    await agreements.revise(state.agreementId, owner.publicKey(), {
      recipients: [
        { walletAddress: owner.publicKey(), role: "artist", shareBps: 5000 },
        {
          walletAddress: contributor.publicKey(),
          role: "producer",
          shareBps: 5000,
        },
      ],
      terms: "Synthetic Testnet earnings: amended 50/50 split",
      resolution: "Both contributors agree to divide future earnings equally",
    });
    detail = await agreements.get(state.agreementId, owner.publicKey());
    version = detail.versions.find(
      (v) => v.proposal.version === detail.currentVersion,
    )!;
  }
  if (version.state === "draft")
    await agreements.submit(state.agreementId, owner.publicKey());
  if (version.state !== "finalized") {
    for (const key of [owner, contributor]) {
      detail = await agreements.get(state.agreementId, owner.publicKey());
      version = detail.versions.find(
        (v) => v.proposal.version === detail.currentVersion,
      )!;
      if (
        !version.responses.some(
          (r) => r.walletAddress === key.publicKey() && r.action === "accept",
        )
      ) {
        const challenge = await agreements.challenge(
          state.agreementId,
          key.publicKey(),
          { action: "accept" },
        );
        await agreements.respond(state.agreementId, key.publicKey(), {
          challengeId: challenge.id,
          signedTransaction: signed(challenge.transaction, key),
        });
      }
    }
    let finalization = await finalizations.prepare(
      state.agreementId,
      "admin:testnet-settlement-demo",
    );
    if (finalization.status === "awaiting_signatures") {
      for (const key of [treasury, signerB])
        finalization = await finalizations.addSignatures(
          state.agreementId,
          finalization.id,
          "admin:testnet-settlement-demo",
          { signedTransaction: signed(finalization.transaction, key) },
        );
      finalization = await finalizations.submit(
        state.agreementId,
        finalization.id,
        "admin:testnet-settlement-demo",
      );
    }
    for (let i = 0; i < 30 && finalization.status !== "confirmed"; i++) {
      await delay(2000);
      finalization = await finalizations.reconcile(
        state.agreementId,
        finalization.id,
        "admin:testnet-settlement-demo",
      );
    }
    assert.equal(finalization.status, "confirmed");
    publicEvidence.amendmentFinalization = finalization;
    await save();
  }
  let amended: SettlementBatch;
  if (!state.batchIds.amended) {
    const split = (await splits.effective(state.trackId))!;
    assert.equal(split.version, 2);
    const sourceId = (state.sources.amended ??= randomUUID());
    await save();
    if (
      !(await ledger.listLedgerEntriesBySource("manual_adjustment", sourceId))
        .length
    ) {
      for (const recipient of split.recipients) {
        const stamp = new Date().toISOString();
        await ledger.upsertLedgerEntry({
          id: randomUUID(),
          trackId: state.trackId,
          splitId: split.id,
          sourceType: "manual_adjustment",
          sourceId,
          recipientWalletAddress: recipient.walletAddress,
          recipientRole: recipient.role,
          recipientChain: "stellar",
          status: "approved",
          grossAmount: "50",
          netAmount: "50",
          feeBps: 0,
          assetCode: "USDC",
          assetIssuer: issuer,
          createdAt: stamp,
          updatedAt: stamp,
        });
      }
    }
    const preview = await s.preview({
      trackId: state.trackId,
      sourceType: "manual_adjustment",
      sourceId,
      expiresAt: new Date(
        Math.floor((Date.now() + 86400000) / 1000) * 1000,
      ).toISOString(),
    });
    amended = await s.reserve(
      {
        trackId: preview.trackId,
        sourceType: preview.sourceType,
        sourceId,
        expiresAt: preview.expiresAt,
      },
      preview.id,
      "admin:testnet-settlement-demo",
    );
    state.batchIds.amended = amended.id;
    await save();
  } else amended = (await s.detail(state.batchIds.amended)).batch;
  const amendedFunding = await treasuryAction(amended, "settle");
  publicEvidence.amendedFunding = amendedFunding;
  await s.reconcileBatch(amended.id);
  for (const key of [owner, contributor]) {
    const index = amended.allocations.findIndex(
      (a) => a.beneficiary === key.publicKey(),
    );
    let a = await s.prepare(amended.id, "claim", key.publicKey(), index);
    if (a.status === "awaiting_signatures") {
      a = await s.addSignature(a.id, key.publicKey(), {
        signedTransaction: signed(a.transaction, key),
      });
      a = await s.submit(a.id, key.publicKey());
    }
    await finish(a);
  }
  const unchanged = await chain.getBatch(batch);
  assert.ok(unchanged);
  assert.equal(unchanged.request.version, 1);
  assert.equal(
    unchanged.claims.find((a) => a.beneficiary === owner.publicKey())!.amount,
    700000000n,
  );
  publicEvidence.amendedBatch = await s.detail(amended.id);
  publicEvidence.amendmentPreservesExistingClaims = true;
  // Independently simulate duplicate batch and source identities against the deployed contract.
  for (const [name, request] of [
    ["duplicateBatch", amended],
    ["duplicateSource", { ...amended, id: "a".repeat(64) }],
  ] as const) {
    const tx = new TransactionBuilder(
      await rpc.getAccount(treasury.publicKey()),
      { fee: BASE_FEE, networkPassphrase: network },
    )
      .addOperation(
        new Contract(state.settlementContractId!).call(
          "settle",
          settlementRequest(request),
        ),
      )
      .setTimeout(60)
      .build();
    const result = await rpc.simulateTransaction(tx);
    assert.ok(Api.isSimulationError(result));
    assert.ok(
      result.error.includes(
        `Error(Contract, #${name === "duplicateBatch" ? 2 : 3})`,
      ),
    );
    publicEvidence[name] = { rejected: true, error: result.error };
  }
  const repeatedClaimTx = new TransactionBuilder(
    await rpc.getAccount(owner.publicKey()),
    { fee: BASE_FEE, networkPassphrase: network },
  )
    .addOperation(
      new Contract(state.settlementContractId!).call(
        "claim",
        nativeToScVal(Buffer.from(batch.id, "hex")),
        nativeToScVal(index, { type: "u32" }),
      ),
    )
    .setTimeout(60)
    .build();
  const repeatedClaim = await rpc.simulateTransaction(repeatedClaimTx);
  assert.ok(Api.isSimulationError(repeatedClaim));
  assert.match(repeatedClaim.error, /Error\(Contract, #7\)/);
  publicEvidence.repeatedClaim = { rejected: true, error: repeatedClaim.error };
  const previousMaintenance=publicEvidence.maintenance as FinancialAttempt|undefined;
  let maintenance=previousMaintenance ? (await s.detail(amended.id)).attempts.find(a=>a.id===previousMaintenance.id&&a.kind==="maintain") : undefined;
  maintenance ??= await s.prepare(amended.id,"maintain","admin:testnet-settlement-demo");
  if (maintenance.status === "awaiting_signatures") {
    for (const key of [treasury, signerB])
      maintenance = await s.addSignature(
        maintenance.id,
        maintenance.actor,
        { signedTransaction: signed(maintenance.transaction, key) },
        true,
      );
    maintenance = await s.submit(maintenance.id, maintenance.actor, true);
  }
  publicEvidence.maintenance = await finish(maintenance);
  await save();
  const other = batch.allocations.findIndex(
    (a) => a.beneficiary === contributor.publicKey(),
  );
  if (Date.parse(batch.expiresAt) > Date.now()) {
    await assert.rejects(
      s.prepare(batch.id, "reclaim", "admin:testnet-settlement-demo", other),
      /after the claim expires/,
    );
    publicEvidence.earlyReclaimRejected = true;
  }
  publicEvidence.initialBatch = await s.detail(batch.id);
  publicEvidence.status = "funded_and_claimed_expiry_pending";
  await save();
  console.log(
    `70 USDC claimed on Testnet. Expiry recovery becomes available at ${batch.expiresAt}. Resume this same state after expiry.`,
  );
  if (Date.parse(batch.expiresAt) > Date.now()) {
    process.exitCode = 0;
  } else {
    const reclaimed = await treasuryAction(batch, "reclaim", other);
    publicEvidence.expiryRecovery = reclaimed;
    const final = await chain.getBatch(batch);
    assert.ok(final);
    assert.equal(final.claimed, 700000000n);
    assert.equal(final.reclaimed, 300000000n);
    publicEvidence.finalBatch = await s.detail(batch.id);
    publicEvidence.status =
      "service_testnet_lifecycle_verified_browser_pending";
    const {indexSettlementEvents}=await import("../modules/settlements/chain-events.js");await indexSettlementEvents();
    publicEvidence.reconciliation = await s.reconciliationReport();
    assert.equal((publicEvidence.reconciliation as { ok: boolean }).ok, true);
    assert.equal(await chain.escrowBalance(), 0n);
    const eventResult=await rpc.getEvents({startLedger:funded.ledger!,filters:[{type:"contract",contractIds:[state.settlementContractId!]}],limit:1000});
    function evidenceValue(value:unknown):unknown {if(typeof value==="bigint")return value.toString();if(Buffer.isBuffer(value)||value instanceof Uint8Array)return Buffer.from(value).toString("hex");if(Array.isArray(value))return value.map(evidenceValue);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,evidenceValue(v)]));return value;}
    publicEvidence.contractEvents=eventResult.events.map(e=>({id:e.id,ledger:e.ledger,closedAt:e.ledgerClosedAt,transactionHash:e.txHash,inSuccessfulContractCall:e.inSuccessfulContractCall,topics:e.topic.map(t=>evidenceValue(scValToNative(t))),data:evidenceValue(scValToNative(e.value))}));
    assert.equal(eventResult.events.filter(e=>e.txHash===funded.transactionHash).length,1);
    assert.equal(eventResult.events.filter(e=>e.txHash===reclaimed.transactionHash).length,1);
    publicEvidence.claimIds=[batch,amended].flatMap(b=>b.allocations.map(a=>({id:`${state.settlementContractId}:${b.id}:${a.index}`,batchId:b.id,index:a.index,beneficiary:a.beneficiary,amountUnits:a.amountUnits})));
    await save();
  }
} finally {
  await db.close();
}
