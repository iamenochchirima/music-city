import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Account, Keypair, Networks, Operation, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import type { AgreementFinalization, AgreementVersion, FinalizedAgreementSplit } from "@music-city/shared";

const testUrl = process.env.AGREEMENTS_TEST_DATABASE_URL;
test("PostgreSQL finalization transaction lifecycle (network boundary mocked)", { skip: !testUrl }, async t => {
  const url = new URL(testUrl!);
  assert.ok(["localhost","127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"));
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";
  const { databaseService: db } = await import("../../services/database.service.js");
  const { agreementsService: agreements } = await import("./agreements.service.js");
  const { finalizationService: finalizations } = await import("./finalization.service.js");
  const { agreementsChain: chain } = await import("./agreements-chain.js");
  const { signedTreasuryTransaction } = await import("./treasury-signatures.js");
  const { finalizedSplitsRepository } = await import("./effective-split.js");
  const { royaltiesService } = await import("../royalties/royalties.service.js");
  const owner = Keypair.random(), contributor = Keypair.random();
  const signers = [Keypair.random(),Keypair.random(),Keypair.random()];
  const config = { treasuryAddress: signers[0]!.publicKey(),contractId: "isolated-test-registry",networkPassphrase: Networks.TESTNET };
  const evidence = { ...config,signers: signers.map(k => k.publicKey()).sort(),threshold: 2,account: { account_id: config.treasuryAddress,thresholds: { low_threshold: 2,med_threshold: 2,high_threshold: 2 },signers: signers.map(k => ({ key: k.publicKey(),type: "ed25519_public_key",weight: 1 })) } };
  const original = { ...chain };
  const ownerId = randomUUID(), admin = `admin:${randomUUID()}`;
  let sequence = 100;
  const pending = (): Api.GetMissingTransactionResponse => ({ status: Api.GetTransactionStatus.NOT_FOUND,txHash: "0".repeat(64),latestLedger: 100,latestLedgerCloseTime: Math.floor(Date.now()/1000),oldestLedger: 1,oldestLedgerCloseTime: Math.floor(Date.now()/1000)-1000 });
  function resetNetwork() {
    chain.config = () => config;
    chain.treasuryEvidence = async () => evidence;
    chain.getLatest = async () => null;
    chain.getVersion = async () => null;
    chain.prepare = async () => {
      const tx = new TransactionBuilder(new Account(config.treasuryAddress,String(sequence++)),{ fee: "100",networkPassphrase: config.networkPassphrase })
        .addOperation(Operation.manageData({ name: "network-boundary-test",value: randomUUID() })).setTimeout(600).build();
      return { ...evidence,transaction: tx.toXDR(),transactionHash: tx.hash().toString("hex"),expiresAt: new Date(Number(tx.timeBounds!.maxTime)*1000).toISOString() };
    };
    chain.send = async tx => ({ status: "PENDING",hash: tx.hash().toString("hex"),latestLedger: 100,latestLedgerCloseTime: Math.floor(Date.now()/1000) });
    chain.status = async () => pending();
  }
  const terms = { recipients: [{ walletAddress: owner.publicKey(),role: "artist",shareBps: 7000 },{ walletAddress: contributor.publicKey(),role: "producer",shareBps: 3000 }],terms: "Finalization integration" };
  function sign(xdr: string,key: Keypair) { const tx = TransactionBuilder.fromXDR(xdr,Networks.TESTNET); tx.sign(key); return tx.toXDR(); }
  async function ready() {
    const trackId = randomUUID();
    await db.transaction(client => client.query("INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'draft','unpublished',$3)",[trackId,ownerId,{}]));
    const draft = await agreements.create(owner.publicKey(),{ trackId,...terms });
    const id = draft.proposal.agreementId;
    await agreements.submit(id,owner.publicKey());
    for (const key of [owner,contributor]) {
      const challenge = await agreements.challenge(id,key.publicKey(),{ action: "accept" });
      await agreements.respond(id,key.publicKey(),{ challengeId: challenge.id,signedTransaction: sign(challenge.transaction,key) });
    }
    return (await agreements.get(id,owner.publicKey())).versions[0]!;
  }
  async function twoSignatures(version: AgreementVersion) {
    const id = version.proposal.agreementId;
    const prepared = await finalizations.prepare(id,admin);
    await finalizations.addSignatures(id,prepared.id,admin,{ signedTransaction: sign(prepared.transaction,signers[0]!) });
    return finalizations.addSignatures(id,prepared.id,admin,{ signedTransaction: sign(prepared.transaction,signers[1]!) });
  }
  function publish(version: AgreementVersion,attempt: AgreementFinalization) {
    const record: FinalizedAgreementSplit = { agreementId: version.proposal.agreementId,version: version.proposal.version,recipients: version.proposal.recipients,proposalHash: version.proposalHash,previousFinalizedHash: attempt.previousFinalizedHash,finalizedLedger: 101 };
    chain.getVersion = async () => record;
    chain.getLatest = async () => record;
    const returnValue = nativeToScVal({ agreement_id: record.agreementId,version: nativeToScVal(record.version,{ type: "u32" }),proposal_hash: Buffer.from(record.proposalHash,"hex"),previous_finalized_hash: Buffer.from(record.previousFinalizedHash,"hex"),recipients: xdr.ScVal.scvVec(record.recipients.map(r => nativeToScVal({ wallet: r.walletAddress,role: r.role,share_bps: r.shareBps },{ type: { wallet: ["symbol","address"],role: ["symbol","string"],share_bps: ["symbol","u32"] } }))),finalized_ledger: nativeToScVal(101,{ type: "u32" }) });
    chain.status = async () => ({ status: Api.GetTransactionStatus.SUCCESS,txHash: attempt.transactionHash,ledger: 101,createdAt: Math.floor(Date.now()/1000),latestLedger: 101,latestLedgerCloseTime: Math.floor(Date.now()/1000),oldestLedger: 1,oldestLedgerCloseTime: Math.floor(Date.now()/1000)-1000,applicationOrder: 1,feeBump: false,envelopeXdr: signedTreasuryTransaction(attempt).toEnvelope(),returnValue } as Awaited<ReturnType<typeof chain.status>>);
    return record;
  }
  async function fail(attempt: AgreementFinalization) {
    chain.status = async () => ({ ...pending(),status: Api.GetTransactionStatus.FAILED,txHash: attempt.transactionHash,ledger: 101 } as Awaited<ReturnType<typeof chain.status>>);
    return finalizations.reconcile(attempt.agreementId,attempt.id,admin);
  }
  try {
    await db.initialize({ repair: false });
    await db.transaction(async client => {
      for (const [key,id] of [[owner,ownerId],[contributor,randomUUID()]] as const) await client.query("INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist',$3)",[id,key.publicKey(),{}]);
    });
    resetNetwork();
    await t.test("concurrent preparation is idempotent and one signer cannot submit", async () => {
      const v = await ready(), id = v.proposal.agreementId;
      const [first,second] = await Promise.all([finalizations.prepare(id,admin),finalizations.prepare(id,admin)]);
      assert.equal(first.id,second.id);
      await finalizations.addSignatures(id,first.id,admin,{ signedTransaction: sign(first.transaction,signers[0]!) });
      await assert.rejects(finalizations.submit(id,first.id,admin),/Two independent/);
      assert.equal((await agreements.get(id,owner.publicKey())).effectiveVersion,null);
      const other = await ready();
      await assert.rejects(finalizations.prepare(other.proposal.agreementId,admin),/outstanding/);
      await fail(first); resetNetwork();
    });
    await t.test("uncertain submission is persisted and confirmed evidence advances effective version once", async () => {
      const v = await ready(), id = v.proposal.agreementId, attempt = await twoSignatures(v);
      const historicalId = randomUUID();
      await db.transaction(client => client.query("INSERT INTO royalty_splits(id,track_id,version,status,registry_chain,payload) VALUES($1,$2,17,'active','stellar',$3)",[historicalId,v.proposal.trackId,{ id: historicalId,trackId: v.proposal.trackId,version: 17,status: "active",registryKind: "offchain",recipients: [{ walletAddress: contributor.publicKey(),chain: "stellar",role: "producer",shareBps: 10000 }],totalBps: 10000,createdAt: new Date().toISOString(),updatedAt: new Date().toISOString() }]));
      assert.equal(await finalizedSplitsRepository.effective(v.proposal.trackId),null);
      const payment = { id: randomUUID(),intentId: randomUUID(),walletAddress: owner.publicKey(),productType: "track_purchase" as const,trackId: v.proposal.trackId,txHash: "local-payment-evidence",amount: "100.0000000",assetCode: "XLM",status: "confirmed" as const,confirmedAt: new Date().toISOString(),createdAt: new Date().toISOString() };
      await assert.rejects(royaltiesService.ensureTrackPurchaseLedgerEntries(payment),/confirmed effective/);
      chain.send = async () => { throw new Error("Connection lost after submission"); };
      const uncertain = await finalizations.submit(id,attempt.id,admin);
      assert.equal(uncertain.status,"submitted"); assert.match(uncertain.error!,/Connection lost/);
      assert.equal((await agreements.get(id,owner.publicKey())).effectiveVersion,null);
      publish(v,attempt);
      const [confirmed,repeated] = await Promise.all([finalizations.reconcile(id,attempt.id,admin),finalizations.reconcile(id,attempt.id,admin)]);
      assert.equal(confirmed.status,"confirmed"); assert.equal(repeated.status,"confirmed");
      const detail = await agreements.get(id,owner.publicKey());
      assert.equal(detail.effectiveVersion,1); assert.equal(detail.versions[0]!.state,"finalized");
      assert.equal(detail.events.filter(e => e.action === "finalized").length,1);
      assert.equal(detail.finalizations[0]!.signedBy.length,2);
      const effective = await finalizedSplitsRepository.effective(v.proposal.trackId);
      assert.equal(effective?.agreementId,id); assert.equal(effective?.proposalHash,v.proposalHash);
      const history = await royaltiesService.listTrackSplits(v.proposal.trackId);
      assert.equal(history.items.find(split => split.id === historicalId)?.historical,true);
      assert.equal(history.items.find(split => split.id === historicalId)?.status,"active");
      const entries = await royaltiesService.ensureTrackPurchaseLedgerEntries(payment);
      assert.equal(entries.length,2);
      assert.ok(entries.every(entry => entry.splitId === effective!.id));
      assert.equal(entries.find(entry => entry.recipientWalletAddress === owner.publicKey())?.grossAmount,"70.0000000");
      assert.equal(entries.find(entry => entry.recipientWalletAddress === contributor.publicKey())?.grossAmount,"30.0000000");
      await assert.rejects(db.transaction(client => client.query("UPDATE agreement_finalizations SET payload=jsonb_set(payload,'{ledger}','999') WHERE id=$1",[attempt.id])));
      await assert.rejects(db.transaction(client => client.query("DELETE FROM agreement_finalizations WHERE id=$1",[attempt.id])));
      await assert.rejects(db.transaction(client => client.query("UPDATE contributor_agreements SET effective_version=NULL WHERE id=$1",[id])));
      await assert.rejects(db.transaction(client => client.query("UPDATE agreement_versions SET state='ready',payload=jsonb_set(payload,'{state}','\"ready\"') WHERE agreement_id=$1",[id])));
      resetNetwork();
      const revision = await agreements.revise(id,owner.publicKey(),{ ...terms,terms: "New consent required",resolution: "Amend commercial terms" });
      assert.equal(revision.responses.length,0); assert.equal((await agreements.get(id,owner.publicKey())).effectiveVersion,1);
      assert.equal((await finalizedSplitsRepository.effective(v.proposal.trackId))?.id,effective?.id);
      await assert.rejects(finalizations.prepare(id,admin),/fully accepted/);
      await agreements.submit(id,owner.publicKey());
      for (const key of [owner,contributor]) {
        const challenge = await agreements.challenge(id,key.publicKey(),{ action: "accept" });
        await agreements.respond(id,key.publicKey(),{ challengeId: challenge.id,signedTransaction: sign(challenge.transaction,key) });
      }
      chain.getLatest = async () => ({ agreementId: id,version: 1,proposalHash: v.proposalHash,previousFinalizedHash: "0".repeat(64),recipients: v.proposal.recipients,finalizedLedger: 101 });
      const revisedReady = (await agreements.get(id,owner.publicKey())).versions[1]!;
      const amendedAttempt = await twoSignatures(revisedReady);
      assert.equal(amendedAttempt.previousFinalizedHash,v.proposalHash);
      publish(revisedReady,amendedAttempt);
      await finalizations.reconcile(id,amendedAttempt.id,admin);
      const amended = await agreements.get(id,owner.publicKey());
      assert.equal(amended.effectiveVersion,2);
      assert.equal(amended.versions[0]!.proposalHash,v.proposalHash);
      assert.equal(amended.versions[0]!.state,"finalized");
      assert.equal(amended.versions[1]!.state,"finalized");
      assert.equal((await finalizedSplitsRepository.effective(v.proposal.trackId))?.version,2);
      const preservedEntries = await royaltiesService.ensureTrackPurchaseLedgerEntries(payment);
      assert.ok(preservedEntries.every(entry => entry.splitId === effective!.id));
      resetNetwork();
    });
    await t.test("mismatched publication rolls back finalization without changing the effective split", async () => {
      resetNetwork(); const v = await ready(), attempt = await twoSignatures(v);
      const record = publish(v,attempt); chain.getVersion = async () => ({ ...record,proposalHash: "b".repeat(64) });
      await assert.rejects(finalizations.reconcile(attempt.agreementId,attempt.id,admin),/does not match/);
      assert.equal((await agreements.get(attempt.agreementId,owner.publicKey())).effectiveVersion,null);
      await fail(attempt); resetNetwork();
    });
    await t.test("failed transactions release the attempt and return to ready for a fresh exact transaction", async () => {
      const v = await ready(), attempt = await twoSignatures(v);
      assert.equal((await fail(attempt)).status,"failed"); resetNetwork();
      const next = await finalizations.prepare(attempt.agreementId,admin);
      assert.notEqual(next.id,attempt.id); assert.notEqual(next.transactionHash,attempt.transactionHash);
      assert.equal(next.signedBy.length,0); await fail(next); resetNetwork();
    });
    await t.test("an expired envelope only releases its gate when retained ledger history proves no inclusion", async () => {
      const v = await ready(), attempt = await twoSignatures(v);
      const expiry = Math.floor(new Date(attempt.expiresAt).getTime()/1000);
      chain.status = async () => ({ ...pending(),latestLedgerCloseTime: expiry+100,oldestLedgerCloseTime: expiry+50 });
      assert.equal((await finalizations.reconcile(attempt.agreementId,attempt.id,admin)).status,"awaiting_signatures");
      chain.status = async () => ({ ...pending(),latestLedgerCloseTime: expiry+100 });
      assert.equal((await finalizations.reconcile(attempt.agreementId,attempt.id,admin)).status,"expired");
      assert.equal((await agreements.get(attempt.agreementId,owner.publicKey())).versions[0]!.state,"ready"); resetNetwork();
    });
    await t.test("a forged ready flag without contributor signatures cannot prepare", async () => {
      const v = await ready(), id = v.proposal.agreementId;
      await db.transaction(client => client.query("UPDATE agreement_versions SET payload=jsonb_set(payload,'{responses}','[]') WHERE agreement_id=$1",[id]));
      await assert.rejects(finalizations.prepare(id,admin),/Every required contributor/);
      const attemptCount = await db.transaction(client => client.query("SELECT COUNT(*) FROM agreement_finalizations WHERE agreement_id=$1",[id]));
      assert.equal(attemptCount.rows[0].count,"0");
    });
    await t.test("a dispute racing preparation produces one serialized valid outcome", async () => {
      resetNetwork(); const v = await ready(), id = v.proposal.agreementId;
      const challenge = await agreements.challenge(id,contributor.publicKey(),{ action: "dispute",reason: "Ownership needs review" });
      const results = await Promise.allSettled([
        agreements.respond(id,contributor.publicKey(),{ challengeId: challenge.id,signedTransaction: sign(challenge.transaction,contributor) }),
        finalizations.prepare(id,admin),
      ]);
      assert.equal(results.filter(r => r.status === "fulfilled").length,1);
      const current = (await agreements.get(id,owner.publicKey())).versions[0]!;
      assert.equal((await agreements.get(id,owner.publicKey())).effectiveVersion,null);
      if (current.state === "disputed") {
        await assert.rejects(finalizations.prepare(id,admin),/fully accepted/);
      } else {
        assert.equal(current.state,"finalizing");
        const result = results[1]!;
        assert.equal(result.status,"fulfilled");
        if (result.status === "fulfilled") await fail(result.value as AgreementFinalization);
      }
    });
    await t.test("admin resolution preserves the disputed proposal and leaves new submission under owner control", async () => {
      resetNetwork(); const v = await ready(), id = v.proposal.agreementId;
      const challenge = await agreements.challenge(id,contributor.publicKey(),{ action: "dispute",reason: "Attribution needs correction" });
      await agreements.respond(id,contributor.publicKey(),{ challengeId: challenge.id,signedTransaction: sign(challenge.transaction,contributor) });
      const next = await finalizations.resolveDispute(id,admin,{ resolution: "Owner and contributor agreed to review the attribution and issue a fresh proposal." });
      assert.equal(next.state,"draft"); assert.equal(next.responses.length,0); assert.equal(next.proposal.previousHash,v.proposalHash);
      assert.equal(next.proposal.ownerWallet,owner.publicKey());
      const detail = await agreements.get(id,owner.publicKey());
      assert.equal(detail.effectiveVersion,null); assert.equal(detail.versions[0]!.state,"disputed");
      assert.equal(detail.versions[0]!.responses.length,3);
      assert.equal(detail.events.find(e => e.action === "dispute_resolution_recorded")?.actor_wallet,admin);
      await assert.rejects(agreements.submit(id,contributor.publicKey()));
      await assert.rejects(finalizations.prepare(id,admin),/fully accepted/);
      await assert.rejects(finalizations.resolveDispute(id,admin,{ resolution: "Repeat" }),/Only disputed/);
      await agreements.submit(id,owner.publicKey());
      await assert.rejects(finalizations.prepare(id,admin),/fully accepted/);
    });
  } finally { Object.assign(chain,original); await db.close(); }
});
