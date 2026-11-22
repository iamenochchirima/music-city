import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes } from "node:crypto";
import {
  Address,
  Asset,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  scValToNative,
} from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";

const statePath = "/tmp/opencode/prod-contributor-deploy.json";
const treasury = process.env.TREASURY_ADDRESS!;
const assetIssuer = process.env.ASSET_ISSUER!;
assert.ok(treasury && assetIssuer, "TREASURY_ADDRESS and ASSET_ISSUER are required");

const network = Networks.TESTNET;
const rpc = new Server("https://soroban-testnet.stellar.org", { timeout: 30000 });
assert.equal((await rpc.getNetwork()).passphrase, network);

type State = {
  deployerSecret: string;
  registrarSecret: string;
  salts: { registry: string; settlement: string };
  transactions: Record<string, { xdr: string; hash: string }>;
  registryId?: string;
  contractId?: string;
  deploymentLedger?: number;
};

let state: State;
try {
  state = JSON.parse(await readFile(statePath, "utf8"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  state = {
    deployerSecret: Keypair.random().secret(),
    registrarSecret: Keypair.random().secret(),
    salts: {
      registry: randomBytes(32).toString("hex"),
      settlement: randomBytes(32).toString("hex"),
    },
    transactions: {},
  };
}

async function save() {
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(`${statePath}.tmp`, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(`${statePath}.tmp`, statePath);
}
await save();

const deployer = Keypair.fromSecret(state.deployerSecret);
const registrar = Keypair.fromSecret(state.registrarSecret);
console.log("deployer:", deployer.publicKey());
console.log("registrar:", registrar.publicKey());

const account = await fetch(`https://horizon-testnet.stellar.org/accounts/${deployer.publicKey()}`);
if (account.status === 404) {
  const funded = await fetch(`https://friendbot.stellar.org?addr=${deployer.publicKey()}`);
  if (!funded.ok) throw new Error("Friendbot funding failed");
  await new Promise((resolve) => setTimeout(resolve, 3000));
} else if (!account.ok) {
  throw new Error("Unable to inspect deployer account");
}

async function stage(name: string, ops: Parameters<TransactionBuilder["addOperation"]>[0][], soroban = false) {
  let stored = state.transactions[name];
  if (!stored) {
    let builder = new TransactionBuilder(await rpc.getAccount(deployer.publicKey()), {
      fee: BASE_FEE,
      networkPassphrase: network,
    });
    for (const op of ops) builder = builder.addOperation(op);
    let tx = builder.setTimeout(600).build();
    if (soroban) tx = await rpc.prepareTransaction(tx);
    tx.sign(deployer);
    stored = { xdr: tx.toXDR(), hash: tx.hash().toString("hex") };
    state.transactions[name] = stored;
    await save();
  }
  let status = await rpc.getTransaction(stored.hash);
  if (status.status === Api.GetTransactionStatus.FAILED) {
    throw new Error(`Retained ${name} failed; inspect ${stored.hash}`);
  }
  if (status.status === Api.GetTransactionStatus.NOT_FOUND) {
    const sent = await rpc.sendTransaction(TransactionBuilder.fromXDR(stored.xdr, network));
    if (sent.status === "ERROR") {
      throw new Error(`${name} rejected: ${sent.errorResult?.result().switch().name}`);
    }
  }
  for (let i = 0; i < 60 && status.status === Api.GetTransactionStatus.NOT_FOUND; i++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = await rpc.getTransaction(stored.hash);
  }
  if (status.status !== Api.GetTransactionStatus.SUCCESS) {
    throw new Error(`Retained ${name} not confirmed; resume this same state`);
  }
  console.log(`${name}: confirmed ${stored.hash}`);
  return status;
}

const root = "/home/enoch/aworkspace/clients/music-city";
const registryWasm = await readFile(`${root}/contracts/target/wasm32v1-none/release/contributor_registry.wasm`);
const settlementWasm = await readFile(`${root}/contracts/target/wasm32v1-none/release/earnings_settlement.wasm`);
const asset = new Asset("USDC", assetIssuer);
const assetId = asset.contractId(network);

const registryUpload = await stage("registryUpload", [Operation.uploadContractWasm({ wasm: registryWasm })], true);
const registryDeploy = await stage(
  "registryDeploy",
  [
    Operation.createCustomContract({
      address: new Address(deployer.publicKey()),
      wasmHash: registryUpload.returnValue!.bytes(),
      salt: Buffer.from(state.salts.registry, "hex"),
      constructorArgs: [new Address(treasury).toScVal(), new Address(registrar.publicKey()).toScVal()],
    }),
  ],
  true,
);
state.registryId = scValToNative(registryDeploy.returnValue!) as string;
await save();
console.log("registry:", state.registryId);

const settlementUpload = await stage("settlementUpload", [Operation.uploadContractWasm({ wasm: settlementWasm })], true);
const settlementDeploy = await stage(
  "settlementDeploy",
  [
    Operation.createCustomContract({
      address: new Address(deployer.publicKey()),
      wasmHash: settlementUpload.returnValue!.bytes(),
      salt: Buffer.from(state.salts.settlement, "hex"),
      constructorArgs: [
        new Address(treasury).toScVal(),
        new Address(state.registryId).toScVal(),
        new Address(assetId).toScVal(),
      ],
    }),
  ],
  true,
);
state.contractId = scValToNative(settlementDeploy.returnValue!) as string;
state.deploymentLedger = settlementDeploy.ledger;
await save();

console.log(
  JSON.stringify(
    {
      registryId: state.registryId,
      contractId: state.contractId,
      deploymentLedger: state.deploymentLedger,
      treasury,
      registrar: registrar.publicKey(),
      assetId,
      transactions: state.transactions,
    },
    null,
    2,
  ),
);
