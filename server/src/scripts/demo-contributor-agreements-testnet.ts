import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Address, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder, scValToNative } from "@stellar/stellar-sdk";
import { Api, Server } from "@stellar/stellar-sdk/rpc";
import pg from "pg";

// This demonstration is restricted to disposable local data and fresh Testnet
// accounts. Private resumable state must live outside the repository.
const databaseUrl = process.env.AGREEMENTS_TEST_DATABASE_URL;
const statePath = process.env.AGREEMENTS_DEMO_STATE_PATH;
if (!databaseUrl || !statePath) throw new Error("Set AGREEMENTS_TEST_DATABASE_URL and AGREEMENTS_DEMO_STATE_PATH");
const database = new URL(databaseUrl);
if (!["localhost","127.0.0.1"].includes(database.hostname) || !database.pathname.endsWith("_test")) throw new Error("Use a disposable local database ending in _test");
const repoRoot = resolve(import.meta.dirname,"../../..");
if (resolve(statePath).startsWith(repoRoot+"/")) throw new Error("Private demo state must be outside the repository");
const probe = new pg.Client({ connectionString: databaseUrl });
await probe.connect(); await probe.query("SELECT 1"); await probe.end();
const rpcUrl = "https://soroban-testnet.stellar.org";
const horizonUrl = "https://horizon-testnet.stellar.org";
const rpc = new Server(rpcUrl);
const network = await rpc.getNetwork();
assert.equal(network.passphrase,Networks.TESTNET);
type State = { secrets: string[]; salt: string; trackId: string; ownerId: string; contributorId: string; agreementId?: string; contractId?: string; transactions: Record<string,{ xdr: string; hash: string }>; evidence: Record<string,unknown> };
let state: State;
try { state = JSON.parse(await readFile(statePath,"utf8")); }
catch(error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  state = { secrets: Array.from({ length: 5 },()=>Keypair.random().secret()),salt: randomBytes(32).toString("hex"),trackId: randomUUID(),ownerId: randomUUID(),contributorId: randomUUID(),transactions: {},evidence: {} };
}
const keys = state.secrets.map(secret => Keypair.fromSecret(secret));
const [treasury,signerB,signerC,owner,contributor] = keys as [Keypair,Keypair,Keypair,Keypair,Keypair];
const evidencePath = resolve(repoRoot,"docs/contributor-agreements-evidence/stellar-testnet.json");
async function save() {
  await mkdir(dirname(statePath!),{ recursive: true });
  await writeFile(statePath+".tmp",JSON.stringify(state,null,2),{ mode: 0o600 });
  await rename(statePath+".tmp",statePath!);
  await mkdir(dirname(evidencePath),{ recursive: true });
  await writeFile(evidencePath,JSON.stringify({ status: "in_progress",verifiedAt: new Date().toISOString(),network: network.passphrase,protocolVersion: network.protocolVersion,rpcUrl,treasuryAddress: treasury.publicKey(),signers: [treasury,signerB,signerC].map(k=>k.publicKey()),contributors: [owner,contributor].map(k=>k.publicKey()),trackId: state.trackId,agreementId: state.agreementId,contractId: state.contractId,...state.evidence },null,2)+"\n");
}
await save();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve,ms));
async function confirmed(hash: string) {
  for (let i=0;i<40;i++) {
    const result = await rpc.getTransaction(hash);
    if (result.status === Api.GetTransactionStatus.SUCCESS) return result;
    if (result.status === Api.GetTransactionStatus.FAILED) throw new Error(`Testnet transaction failed: ${hash}`);
    await delay(2000);
  }
  throw new Error(`Transaction outcome remains unknown; resume this same state to reconcile ${hash}`);
}
async function stage(name: string,operation: () => Promise<ReturnType<typeof Operation.uploadContractWasm>>,soroban: boolean) {
  let prepared = state.transactions[name];
  if (!prepared) {
    const account = await rpc.getAccount(treasury.publicKey());
    let tx = new TransactionBuilder(account,{ fee: BASE_FEE,networkPassphrase: Networks.TESTNET }).addOperation(await operation()).setTimeout(600).build();
    if (soroban) tx = await rpc.prepareTransaction(tx);
    tx.sign(treasury);
    prepared = { xdr: tx.toXDR(),hash: tx.hash().toString("hex") };
    state.transactions[name] = prepared;
    await save();
  }
  const previous = await rpc.getTransaction(prepared.hash);
  if (previous.status === Api.GetTransactionStatus.SUCCESS) {
    state.evidence[name] = { transactionHash: prepared.hash,ledger: previous.ledger,explorerUrl: `https://stellar.expert/explorer/testnet/tx/${prepared.hash}` };
    await save(); return previous;
  }
  if (previous.status === Api.GetTransactionStatus.FAILED) throw new Error(`Recorded ${name} transaction failed; inspect ${prepared.hash}`);
  const tx = TransactionBuilder.fromXDR(prepared.xdr,Networks.TESTNET);
  const sent = await rpc.sendTransaction(tx);
  if (sent.status === "ERROR") throw new Error(`${name} submission rejected: ${sent.errorResult?.result().switch().name}`);
  console.log(`${name}: submitted ${prepared.hash}`);
  const result = await confirmed(prepared.hash);
  state.evidence[name] = { transactionHash: prepared.hash,ledger: result.ledger,explorerUrl: `https://stellar.expert/explorer/testnet/tx/${prepared.hash}` };
  await save(); return result;
}
for (const key of [treasury,owner,contributor]) {
  const existing = await fetch(`${horizonUrl}/accounts/${key.publicKey()}`);
  if (existing.status === 404) {
    const funded = await fetch(`https://friendbot.stellar.org/?addr=${key.publicKey()}`);
    if (!funded.ok) throw new Error(`Friendbot funding failed: HTTP ${funded.status}`);
    console.log(`Funded fresh Testnet account ${key.publicKey()}`);
  } else if (!existing.ok) throw new Error(`Account lookup failed: HTTP ${existing.status}`);
}
const wasm = await readFile(resolve(repoRoot,"contracts/target/wasm32v1-none/release/royalty_split_registry.wasm"));
const uploaded = await stage("contractUpload",async()=>Operation.uploadContractWasm({ wasm }),true);
assert.ok(uploaded.returnValue);
const deployed = await stage("contractDeployment",async()=>Operation.createCustomContract({ address: Address.fromString(treasury.publicKey()),wasmHash: uploaded.returnValue!.bytes(),salt: Buffer.from(state.salt,"hex"),constructorArgs: [new Address(treasury.publicKey()).toScVal()] }),true);
assert.ok(deployed.returnValue);
state.contractId = scValToNative(deployed.returnValue) as string;
await save();
// Setup is the only operation signed by the initial single master key. It occurs
// before finalization and establishes three independent signers/threshold two.
if (!state.transactions.treasuryConfiguration) {
  const account = await rpc.getAccount(treasury.publicKey());
  const tx = new TransactionBuilder(account,{ fee: "300",networkPassphrase: Networks.TESTNET })
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: signerB.publicKey(),weight: 1 } }))
    .addOperation(Operation.setOptions({ signer: { ed25519PublicKey: signerC.publicKey(),weight: 1 } }))
    .addOperation(Operation.setOptions({ masterWeight: 1,lowThreshold: 2,medThreshold: 2,highThreshold: 2 })).setTimeout(600).build();
  tx.sign(treasury); state.transactions.treasuryConfiguration = { xdr: tx.toXDR(),hash: tx.hash().toString("hex") }; await save();
}
const setup = state.transactions.treasuryConfiguration!;
let setupResult = await rpc.getTransaction(setup.hash);
if (setupResult.status !== Api.GetTransactionStatus.SUCCESS) {
  const sent = await rpc.sendTransaction(TransactionBuilder.fromXDR(setup.xdr,Networks.TESTNET));
  if (sent.status === "ERROR") throw new Error(`Treasury setup rejected: ${sent.errorResult?.result().switch().name}`);
  setupResult = await confirmed(setup.hash);
}
assert.equal(setupResult.status,Api.GetTransactionStatus.SUCCESS);
state.evidence.treasuryConfiguration = { transactionHash: setup.hash,ledger: setupResult.ledger,threshold: 2 };
await save();

Object.assign(process.env,{ DATABASE_URL: databaseUrl,NODE_ENV: "test",STELLAR_NETWORK_PASSPHRASE: Networks.TESTNET,STELLAR_HORIZON_URL: horizonUrl,STELLAR_SOROBAN_RPC_URL: rpcUrl,AGREEMENT_TREASURY_ADDRESS: treasury.publicKey(),ROYALTY_REGISTRY_CONTRACT_ID: state.contractId });
const { databaseService: db } = await import("../services/database.service.js");
const { agreementsService: agreements } = await import("../modules/agreements/agreements.service.js");
const { finalizationService: finalizations } = await import("../modules/agreements/finalization.service.js");
const { agreementsChain: chain } = await import("../modules/agreements/agreements-chain.js");
const { finalizedSplitsRepository } = await import("../modules/agreements/effective-split.js");
function sign(xdr: string,key: Keypair) { const tx = TransactionBuilder.fromXDR(xdr,Networks.TESTNET); tx.sign(key); return tx.toXDR(); }
const terms = { recipients: [{ walletAddress: owner.publicKey(),role: "artist",shareBps: 7000 },{ walletAddress: contributor.publicKey(),role: "producer",shareBps: 3000 }],terms: "Testnet demonstration: 70/30 master royalties" };
const admin = "admin:testnet-demonstration";
try {
  await db.initialize({ repair: false });
  const treasuryEvidence = await chain.treasuryEvidence();
  assert.equal(treasuryEvidence.signers.length,3); state.evidence.verifiedTreasury = treasuryEvidence.account; await save();
  await db.transaction(async client => {
    const timestamp = new Date().toISOString();
    for (const [key,id,name] of [[owner,state.ownerId,"Testnet artist A"],[contributor,state.contributorId,"Testnet producer B"]] as const) {
      const profile = { id,walletAddress: key.publicKey(),displayName: name,email: "",primaryIntent: "artist",artistAccess: true,onboardingStatus: "complete",onboardingStep: "complete",onboardingVersion: 1,onboardingCompletedAt: timestamp,location: "",genres: [],favoriteArtistIds: [],interestedInLocalMusic: true,notificationPreferences: { releaseNotifications: true,artistUpdates: true,productUpdates: false },bio: "Testnet demonstration account",socialLinks: {},verified: false,createdAt: timestamp,updatedAt: timestamp };
      await client.query("INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist',$3) ON CONFLICT(id) DO NOTHING",[id,key.publicKey(),profile]);
    }
    const track = { id: state.trackId,title: "Contributor agreement Testnet demonstration",artistId: state.ownerId,artistName: "Testnet artist A",genre: "Soul",runtime: "3:00",priceLabel: "Testnet demo",status: "draft",visibility: "unpublished",plays: 0,likes: 0,createdAt: timestamp,updatedAt: timestamp };
    await client.query("INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'draft','unpublished',$3) ON CONFLICT(id) DO NOTHING",[state.trackId,state.ownerId,track]);
  });
  if (!state.agreementId) {
    const existing = (await agreements.list(owner.publicKey())).find(item => item.current.proposal.trackId === state.trackId);
    state.agreementId = existing?.id ?? (await agreements.create(owner.publicKey(),{ trackId: state.trackId,...terms })).proposal.agreementId;
    await save();
  }
  const id = state.agreementId;
  async function current() { const detail = await agreements.get(id,owner.publicKey()); return detail.versions.find(v=>v.proposal.version===detail.currentVersion)!; }
  async function accept(key: Keypair) {
    const version = await current(); if (version.responses.some(response=>response.walletAddress===key.publicKey() && response.action==="accept")) return;
    const challenge = await agreements.challenge(id,key.publicKey(),{ action: "accept" });
    await agreements.respond(id,key.publicKey(),{ challengeId: challenge.id,signedTransaction: sign(challenge.transaction,key) });
  }
  async function finalize(label: string,probeOneSigner = false) {
    let attempt = await finalizations.prepare(id,admin);
    if (attempt.status !== "confirmed") {
      if (attempt.status === "awaiting_signatures") {
        if (probeOneSigner && !state.evidence.oneSignerRejected) {
          const one = TransactionBuilder.fromXDR(attempt.transaction,Networks.TESTNET); one.sign(treasury);
          const rejected = await rpc.sendTransaction(one);
          assert.equal(rejected.status,"ERROR"); assert.equal(rejected.errorResult?.result().switch().name,"txBadAuth");
          state.evidence.oneSignerRejected = { transactionHash: attempt.transactionHash,result: "txBadAuth",publication: await chain.getVersion(state.trackId,attempt.version) }; await save();
        }
        for (const key of [treasury,signerB]) attempt = await finalizations.addSignatures(id,attempt.id,admin,{ signedTransaction: sign(attempt.transaction,key) });
        attempt = await finalizations.submit(id,attempt.id,admin);
      }
      for (let i=0;i<40 && attempt.status!=="confirmed";i++) {
        if (["failed","expired"].includes(attempt.status)) throw new Error(`Finalization ${attempt.status}: ${attempt.error}`);
        await delay(2000); attempt = await finalizations.reconcile(id,attempt.id,admin);
      }
      assert.equal(attempt.status,"confirmed","Resume this same state to reconcile an uncertain finalization");
    }
    const published = await chain.getVersion(state.trackId,attempt.version);
    assert.equal(published?.proposalHash,attempt.proposalHash);
    state.evidence[label] = { version: attempt.version,proposalHash: attempt.proposalHash,previousFinalizedHash: attempt.previousFinalizedHash,transactionHash: attempt.transactionHash,signedBy: attempt.signedBy,ledger: attempt.ledger,explorerUrl: attempt.explorerUrl,published };
    await save(); console.log(`${label}: confirmed ${attempt.transactionHash}`);
  }
  let version = await current();
  if (version.proposal.version===1 && version.state!=="finalized") {
    if (version.state==="draft") await agreements.submit(id,owner.publicKey());
    await accept(owner);
    if (!(await current()).responses.some(response=>response.walletAddress===contributor.publicKey())) {
      await assert.rejects(finalizations.prepare(id,admin),/fully accepted/);
      state.evidence.missingContributorBlocksFinalization = true; await save();
    }
    await accept(contributor); await finalize("initialFinalization",true);
  }
  version = await current();
  if (version.proposal.version===1) {
    await agreements.revise(id,owner.publicKey(),{ ...terms,terms: "Testnet amendment: updated master agreement",resolution: "Review updated terms with fresh signatures" });
    assert.equal((await finalizedSplitsRepository.effective(state.trackId))?.version,1);
    state.evidence.amendmentPreservesEffectiveVersion = true; await save();
  }
  version = await current();
  if (version.proposal.version===2 && version.state!=="disputed") {
    if (version.state==="draft") await agreements.submit(id,owner.publicKey());
    const challenge = await agreements.challenge(id,contributor.publicKey(),{ action: "dispute",reason: "Review the revised attribution before approving" });
    await agreements.respond(id,contributor.publicKey(),{ challengeId: challenge.id,signedTransaction: sign(challenge.transaction,contributor) });
  }
  version = await current();
  if (version.proposal.version===2) {
    await assert.rejects(finalizations.prepare(id,admin),/fully accepted/);
    state.evidence.disputeBlocksFinalization = { version: 2,proposalHash: version.proposalHash,effectiveVersion: (await finalizedSplitsRepository.effective(state.trackId))?.version };
    await save(); await finalizations.resolveDispute(id,admin,{ resolution: "Attribution reviewed; owner must submit a fresh proposal for both wallets to approve" });
  }
  version = await current();
  if (version.state==="draft") await agreements.submit(id,owner.publicKey());
  if (version.state!=="finalized") { await accept(owner); await accept(contributor); }
  await finalize("amendmentFinalization");
  const detail = await agreements.get(id,owner.publicKey());
  assert.equal(detail.effectiveVersion,3); assert.equal(detail.versions[0]!.state,"finalized"); assert.equal(detail.versions[1]!.state,"disputed");
  state.evidence.status = "verified"; state.evidence.versionHistory = detail.versions; state.evidence.events = detail.events; await save();
  console.log(`Testnet demonstration verified. Public evidence: ${evidencePath}`);
} finally { await db.close(); }
