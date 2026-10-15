import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  Account,
  Asset,
  Keypair,
  Networks,
  Operation,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import type {
  FinancialAttempt,
  FinalizedAgreementSplit,
  SettlementBatch,
} from "@music-city/shared";
const url = process.env.SETTLEMENTS_TEST_DATABASE_URL;
test(
  "PostgreSQL settlement lifecycle with real signatures and mocked chain transport",
  { skip: !url },
  async (t) => {
    const target = new URL(url!);
    assert.ok(
      ["localhost", "127.0.0.1"].includes(target.hostname) &&
        target.pathname.endsWith("_test"),
    );
    process.env.DATABASE_URL = url;
    process.env.NODE_ENV = "test";
    const { env } = await import("../../config/env.js");
    const { databaseService: db } = await import(
      "../../services/database.service.js"
    );
    const { agreementsService: agreements } = await import(
      "../agreements/agreements.service.js"
    );
    const { finalizationService: finalizations } = await import(
      "../agreements/finalization.service.js"
    );
    const { agreementsChain: registry } = await import(
      "../agreements/agreements-chain.js"
    );
    const { signedTreasuryTransaction } = await import(
      "../agreements/treasury-signatures.js"
    );
    const { settlementChain: chain } = await import("./settlement-chain.js");
    const { settlementService: s, signedFinancialTransaction } = await import(
      "./settlement.service.js"
    );
    const { royaltiesService: royalties } = await import(
      "../royalties/royalties.service.js"
    );
    const { royaltiesRepository } = await import(
      "../royalties/royalties.repository.js"
    );
    const { finalizedSplitsRepository } = await import(
      "../agreements/effective-split.js"
    );
    const originalRegistry = { ...registry },
      originalChain = { ...chain },
      originalEnv = { ...env };
    const keys = [Keypair.random(), Keypair.random()],
      signers = [Keypair.random(), Keypair.random(), Keypair.random()];
    const issuer = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    let sequence = 100;
    const ownerId = randomUUID();
    env.AGREEMENT_TREASURY_ADDRESS = signers[0]!.publicKey();
    env.ROYALTY_REGISTRY_CONTRACT_ID = StrKey.encodeContract(
      Buffer.alloc(32, 1),
    );
    env.SETTLEMENT_CONTRACT_ID = StrKey.encodeContract(Buffer.alloc(32, 2));
    env.STELLAR_SETTLEMENT_ASSET_CODE = "USDC";
    env.STELLAR_SETTLEMENT_ASSET_ISSUER = issuer;
    env.SETTLEMENT_DEPLOYMENT_LEDGER=100;
    const config = registry.config();
    const evidence = {
      ...config,
      signers: signers.map((k) => k.publicKey()).sort(),
      threshold: 2,
      account: {
        account_id: config.treasuryAddress,
        thresholds: { low_threshold: 2, med_threshold: 2, high_threshold: 2 },
        signers: signers.map((k) => ({
          key: k.publicKey(),
          type: "ed25519_public_key",
          weight: 1,
        })),
      },
    };
    const records = new Map<string, FinalizedAgreementSplit>();
    const batches = new Map<
      string,
      import("./settlement-chain.js").ChainBatch
    >();
    const fundedHashes=new Map<string,string>(),consumedHashes=new Map<string,string>();
    const results = new Map<string, Awaited<ReturnType<typeof chain.status>>>();
    const pending = (): Api.GetMissingTransactionResponse => ({
      status: Api.GetTransactionStatus.NOT_FOUND,
      txHash: "0".repeat(64),
      latestLedger: 100,
      latestLedgerCloseTime: Math.floor(Date.now() / 1000),
      oldestLedger: 1,
      oldestLedgerCloseTime: Math.floor(Date.now() / 1000) - 10000,
    });
    function prepared(source: string) {
      const tx = new TransactionBuilder(
        new Account(source, String(sequence++)),
        { fee: "100", networkPassphrase: Networks.TESTNET },
      )
        .addOperation(
          Operation.manageData({
            name: "mocked-network-boundary",
            value: randomUUID(),
          }),
        )
        .setTimeout(600)
        .build();
      return {
        transaction: tx.toXDR(),
        transactionHash: tx.hash().toString("hex"),
        expiresAt: new Date(
          Number(tx.timeBounds!.maxTime) * 1000,
        ).toISOString(),
      };
    }
    function sign(value: string, key: Keypair) {
      const tx = TransactionBuilder.fromXDR(value, Networks.TESTNET);
      tx.sign(key);
      return tx.toXDR();
    }
    async function approvedSource() {
      const trackId = randomUUID();
      await db.transaction((c) =>
        c.query(
          "INSERT INTO tracks(id,artist_id,status,visibility,payload) VALUES($1,$2,'draft','unpublished',$3)",
          [trackId, ownerId, {}],
        ),
      );
      const draft = await agreements.create(keys[0]!.publicKey(), {
        trackId,
        recipients: keys.map((k, i) => ({
          walletAddress: k.publicKey(),
          role: i === 0 ? "artist" : "producer",
          shareBps: i === 0 ? 7000 : 3000,
        })),
        terms: "Isolated settlement fixture",
      });
      const id = draft.proposal.agreementId;
      await agreements.submit(id, keys[0]!.publicKey());
      for (const key of keys) {
        const challenge = await agreements.challenge(id, key.publicKey(), {
          action: "accept",
        });
        await agreements.respond(id, key.publicKey(), {
          challengeId: challenge.id,
          signedTransaction: sign(challenge.transaction, key),
        });
      }
      const version = (await agreements.get(id, keys[0]!.publicKey()))
        .versions[0]!;
      const p = await finalizations.prepare(id, "admin:test");
      let a = p;
      for (const key of signers.slice(0, 2))
        a = await finalizations.addSignatures(id, p.id, "admin:test", {
          signedTransaction: sign(p.transaction, key),
        });
      const record: FinalizedAgreementSplit = {
        agreementId: id,
        version: 1,
        proposalHash: version.proposalHash,
        previousFinalizedHash: "0".repeat(64),
        recipients: version.proposal.recipients,
        finalizedLedger: 101,
      };
      records.set(trackId, record);
      const returned = nativeToScVal({
        agreement_id: id,
        version: nativeToScVal(1, { type: "u32" }),
        proposal_hash: Buffer.from(record.proposalHash, "hex"),
        previous_finalized_hash: Buffer.alloc(32),
        recipients: xdr.ScVal.scvVec(
          record.recipients.map((r) =>
            nativeToScVal(
              { wallet: r.walletAddress, role: r.role, share_bps: r.shareBps },
              {
                type: {
                  wallet: ["symbol", "address"],
                  role: ["symbol", "string"],
                  share_bps: ["symbol", "u32"],
                },
              },
            ),
          ),
        ),
        finalized_ledger: nativeToScVal(101, { type: "u32" }),
      });
      registry.status = async () =>
        ({
          ...pending(),
          status: Api.GetTransactionStatus.SUCCESS,
          txHash: a.transactionHash,
          ledger: 101,
          createdAt: Math.floor(Date.now() / 1000),
          applicationOrder: 1,
          feeBump: false,
          envelopeXdr: signedTreasuryTransaction(a).toEnvelope(),
          returnValue: returned,
        }) as Awaited<ReturnType<typeof registry.status>>;
      await finalizations.reconcile(id, a.id, "admin:test");
      const split = (await finalizedSplitsRepository.effective(trackId))!;
      const sourceId = randomUUID(),
        stamp = new Date().toISOString();
      // Gross allocations are seeded as synthetic earnings after real agreement-service consent.
      for (const r of split.recipients)
        await royaltiesRepository.upsertLedgerEntry({
          id: randomUUID(),
          trackId,
          splitId: split.id,
          sourceType: "manual_adjustment",
          sourceId,
          recipientWalletAddress: r.walletAddress,
          recipientChain: "stellar",
          recipientRole: r.role,
          status: "approved",
          grossAmount: r.shareBps === 7000 ? "70" : "30",
          netAmount: r.shareBps === 7000 ? "70" : "30",
          feeBps: 0,
          assetCode: "USDC",
          assetIssuer: issuer,
          createdAt: stamp,
          updatedAt: stamp,
        });
      return {
        trackId,
        sourceType: "manual_adjustment",
        sourceId,
        expiresAt: new Date(
          Math.floor((Date.now() + 86400000) / 1000) * 1000,
        ).toISOString(),
      };
    }
    async function failingAudit(
      action: "source_reserved" | "transaction_confirmed",
      work: () => Promise<void>,
    ) {
      await db.transaction(async (c) => {
        await c.query(
          `CREATE FUNCTION settlement_deliberate_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='${action}' THEN RAISE EXCEPTION 'deliberate settlement audit failure'; END IF; RETURN NEW; END $$`,
        );
        await c.query(
          "CREATE TRIGGER settlement_deliberate_audit_failure BEFORE INSERT ON settlement_events FOR EACH ROW EXECUTE FUNCTION settlement_deliberate_audit_failure()",
        );
      });
      try {
        await work();
      } finally {
        await db.transaction(async (c) => {
          await c.query(
            "DROP TRIGGER settlement_deliberate_audit_failure ON settlement_events",
          );
          await c.query("DROP FUNCTION settlement_deliberate_audit_failure()");
        });
      }
    }
    async function fund(batch: SettlementBatch) {
      const a = await s.prepare(batch.id, "settle", "admin:test");
      for (const key of signers.slice(0, 2))
        await s.addSignature(
          a.id,
          "admin:test",
          { signedTransaction: sign(a.transaction, key) },
          true,
        );
      await s.submit(a.id, "admin:test", true);
      const stored = (await s.detail(batch.id)).attempts.find(
        (x) => x.id === a.id,
      )!;
      const actual = {
        request: {
          batch_id: Buffer.from(batch.id, "hex"),
          source_id: Buffer.from(batch.sourceKey, "hex"),
          track_id: batch.trackId,
          agreement_id: batch.agreementId,
          version: batch.version,
          proposal_hash: Buffer.from(batch.proposalHash, "hex"),
          gross_amount: BigInt(batch.grossUnits),
          fee_bps: batch.feeBps,
          expires_at: BigInt(Date.parse(batch.expiresAt) / 1000),
        },
        claims: batch.allocations.map((r) => ({
          beneficiary: r.beneficiary,
          amount: BigInt(r.amountUnits),
          status: ["Available"],
          updated_ledger: 102,
        })),
        funded: BigInt(batch.fundedUnits),
        claimed: 0n,
        reclaimed: 0n,
        funded_ledger: 102,
      };
      batches.set(batch.id, actual);fundedHashes.set(batch.id,stored.transactionHash);
      success(stored);
      await s.reconcile(a.id);
      return stored;
    }
    function success(a: FinancialAttempt) {
      results.set(a.transactionHash, {
        ...pending(),
        status: Api.GetTransactionStatus.SUCCESS,
        txHash: a.transactionHash,
        ledger: 102,
        createdAt: Math.floor(Date.now() / 1000),
        applicationOrder: 1,
        feeBump: false,
        envelopeXdr: signedFinancialTransaction(a).toEnvelope(),
        resultXdr: { feeCharged: () => ({ toString: () => "100" }) },
      } as Awaited<ReturnType<typeof chain.status>>);
    }
    try {
      await db.initialize({ repair: false });
      await db.transaction(async (c) => {
        for (const [i, key] of keys.entries())
          await c.query(
            "INSERT INTO users(id,wallet_address,primary_intent,payload) VALUES($1,$2,'artist',$3)",
            [i === 0 ? ownerId : randomUUID(), key.publicKey(), {}],
          );
      });
      registry.treasuryEvidence = async () => evidence;
      registry.getLatest = async (track) => records.get(track) ?? null;
      registry.getVersion = async (track) => records.get(track) ?? null;
      registry.prepare = async () => ({
        ...evidence,
        ...prepared(config.treasuryAddress),
      });
      chain.verifyConfiguration = async () => evidence;
      chain.treasurySigners = async () => evidence.signers;
      chain.escrowBalance = async () =>
        Array.from(batches.values()).reduce(
          (n, b) => n + b.funded - b.claimed - b.reclaimed,
          0n,
        );
      chain.getBatch = async (b) => batches.get(b.id) ?? null;
      chain.readiness = async () => ({ nativeAvailableUnits: 100000000000n });
      chain.prepare = async (b, kind, index) => ({
        kind: undefined,
        treasuryAddress:
          kind === "claim"
            ? b.allocations[index!]!.beneficiary
            : config.treasuryAddress,
        networkPassphrase: Networks.TESTNET,
        signers:
          kind === "claim"
            ? [b.allocations[index!]!.beneficiary]
            : evidence.signers,
        ...prepared(
          kind === "claim"
            ? b.allocations[index!]!.beneficiary
            : config.treasuryAddress,
        ),
      });
      chain.send = async (tx) => ({
        status: "PENDING",
        hash: tx.hash().toString("hex"),
        latestLedger: 100,
        latestLedgerCloseTime: Math.floor(Date.now() / 1000),
      });
      chain.status = async (hash) => results.get(hash) ?? pending();
    chain.events=async()=>{
      const events:Awaited<ReturnType<typeof chain.events>>["events"]=[];
      for(const [id,b] of batches){
        const hash=fundedHashes.get(id);if(!hash)continue;
        const topics=[nativeToScVal("music_city",{type:"symbol"}),nativeToScVal("settlement_funded",{type:"symbol"}),nativeToScVal(Buffer.from(id,"hex"))];
        const value=nativeToScVal({amount:nativeToScVal(b.funded,{type:"i128"}),source_id:b.request.source_id,proposal_hash:b.request.proposal_hash,expires_at:nativeToScVal(b.request.expires_at,{type:"u64"})});
        events.push({id:`${id}-funding`,transactionHash:hash,ledger:b.funded_ledger,batchId:id,type:"settlement_funded",payload:{topics:topics.map(v=>v.toXDR("base64")),value:value.toXDR("base64"),ledgerClosedAt:new Date(0).toISOString(),receipt:{ledger:b.funded_ledger,feeCharged:"100",envelope:"mocked-network-boundary"}}});
        for(const [index,c] of b.claims.entries()){
          const hash=consumedHashes.get(`${id}:${index}`);if(!hash)continue;
          const topics=[nativeToScVal("music_city",{type:"symbol"}),nativeToScVal("claim_consumed",{type:"symbol"}),nativeToScVal(Buffer.from(id,"hex")),nativeToScVal(index,{type:"u32"})];
          const value=nativeToScVal({amount:nativeToScVal(c.amount,{type:"i128"}),beneficiary:nativeToScVal(c.beneficiary,{type:"address"}),status:xdr.ScVal.scvVec(c.status.map(v=>nativeToScVal(v,{type:"symbol"})))});
          events.push({id:`${id}-claim-${index}`,transactionHash:hash,ledger:c.updated_ledger,batchId:id,type:"claim_consumed",payload:{topics:topics.map(v=>v.toXDR("base64")),value:value.toXDR("base64"),ledgerClosedAt:new Date(0).toISOString(),receipt:{ledger:c.updated_ledger,feeCharged:"100",envelope:"mocked-network-boundary"}}});
        }
      }
      return {cursor:"mock-cursor",latestLedger:102,caughtUp:true,events};
    };

      let batch: SettlementBatch;
      await t.test(
        "concurrent source reservation consumes each earnings entry once",
        async () => {
          const source = await approvedSource();
          const preview = await s.preview(source);
          const [first, second] = await Promise.all([
            s.reserve(source, preview.id, "admin:test"),
            s.reserve(source, preview.id, "admin:test"),
          ]);
          assert.equal(first.id, second.id);
          batch = first;
          assert.equal(first.fundedUnits, "1000000000");
          await assert.rejects(s.preview(source), /already reserved/);
          const counts = await db.transaction((c) =>
            c.query(
              "SELECT count(*)::int AS count FROM settlement_reservations WHERE batch_id=$1",
              [batch.id],
            ),
          );
          assert.equal(counts.rows[0].count, 2);
        },
      );
      await t.test(
        "immutable reservations prevent reallocation, deletion and old executor consumption",
        async () => {
          const id = batch!.allocations[0]!.ledgerEntryIds[0];
          await assert.rejects(
            db.transaction((c) =>
              c.query(
                "DELETE FROM settlement_reservations WHERE ledger_id=$1",
                [id],
              ),
            ),
            /append-only/,
          );
          await assert.rejects(
            db.transaction((c) =>
              c.query(
                "UPDATE royalty_ledger SET payload=jsonb_set(payload,'{netAmount}','\"999\"') WHERE id=$1",
                [id],
              ),
            ),
            /reallocated/,
          );
          await assert.rejects(
            db.transaction((c) =>
              c.query(
                "INSERT INTO royalty_payouts(id,recipient_wallet_address,status,payout_rail,payload) VALUES($1,$2,'pending','stellar',$3)",
                [randomUUID(), keys[0]!.publicKey(), { ledgerEntryIds: [id] }],
              ),
            ),
            /threshold-authorized/,
          );
        },
      );
      await t.test(
        "one signer cannot fund and cancelled signing does not move money",
        async () => {
          const a = await s.prepare(batch!.id, "settle", "admin:test");
          await s.addSignature(
            a.id,
            "admin:test",
            { signedTransaction: sign(a.transaction, signers[0]!) },
            true,
          );
          await assert.rejects(
            s.submit(a.id, "admin:test", true),
            /Two independent/,
          );
          assert.equal((await s.detail(batch!.id)).batch.state, "reserved");
        },
      );
      await t.test(
        "funding confirmation is idempotent and does not mark creators paid",
        async () => {
          const status=chain.status;
          chain.status=async hash=>{const result=await status(hash);return result.status===Api.GetTransactionStatus.SUCCESS ? {...result,ledger:result.ledger+1}:result;};
          try{await assert.rejects(fund(batch!),/receipt ledger/);assert.equal((await s.detail(batch!.id)).batch.state,"reserved");}finally{chain.status=status;}
          const a=(await s.detail(batch!.id)).attempts.find(a=>a.kind==="settle")!;
          await s.reconcile(a.id);await s.reconcile(a.id);
          const detail = await s.detail(batch!.id);
          assert.equal(detail.batch.state, "funded");
          assert.ok(
            detail.batch.allocations.every((a) => a.status === "available"),
          );
          const entries = await royalties.listTrackLedgerEntries(
            batch!.trackId,
          );
          assert.ok(entries.every((e) => e.status === "approved"));
          assert.equal(
            detail.events.filter((e) => e.action === "transaction_confirmed")
              .length,
            1,
          );
        },
      );
      await t.test(
        "outsider sessions, changed destinations and unsigned claims fail",
        async () => {
          await assert.rejects(
            s.prepare(batch!.id, "claim", Keypair.random().publicKey(), 0),
            /another wallet/,
          );
          const a = await s.prepare(
            batch!.id,
            "claim",
            batch!.allocations[0]!.beneficiary,
            0,
          );
          await assert.rejects(s.submit(a.id, a.actor), /beneficiary/);
          const wrong = keys.find((k) => k.publicKey() !== a.actor)!;
          await assert.rejects(
            s.addSignature(a.id, a.actor, {
              signedTransaction: sign(a.transaction, wrong),
            }),
            /outside/,
          );
          assert.equal(
            (await s.detail(batch!.id)).batch.allocations[0]!.status,
            "available",
          );
        },
      );
      await t.test(
        "uncertain submission retains the original hash and verified claim marks only its earnings paid",
        async () => {
          const actor = batch!.allocations[0]!.beneficiary;
          const a = await s.prepare(batch!.id, "claim", actor, 0);
          const key = keys.find((k) => k.publicKey() === actor)!;
          const signed = await s.addSignature(a.id, actor, {
            signedTransaction: sign(a.transaction, key),
          });
          chain.send = async () => {
            throw new Error("network timeout after submission");
          };
          const pending = await s.submit(a.id, actor);
          assert.equal(pending.status, "submitted");
          assert.equal(pending.transactionHash, a.transactionHash);
          assert.equal(
            (await s.prepare(batch!.id, "claim", actor, 0)).id,
            a.id,
          );
          const actual = batches.get(batch!.id)!;
          actual.claims[0]!.status = ["Claimed"];
          actual.claimed = actual.claims[0]!.amount;consumedHashes.set(`${batch!.id}:0`,signed.transactionHash);
          success(signed);
          await failingAudit("transaction_confirmed", async () => {
            await assert.rejects(
              s.reconcile(a.id),
              /deliberate settlement audit failure/,
            );
            const failedCommit = await s.detail(batch!.id);
            assert.equal(
              failedCommit.batch.allocations[0]!.status,
              "available",
            );
            assert.equal(
              failedCommit.attempts.find((x) => x.id === a.id)!.status,
              "submitted",
            );
            assert.ok(
              (await royalties.listTrackLedgerEntries(batch!.trackId)).every(
                (e) => e.status === "approved",
              ),
            );
          });
          await s.reconcile(a.id);
          await s.reconcile(a.id);
          const d = await s.detail(batch!.id);
          assert.equal(d.batch.allocations[0]!.status, "claimed");
          assert.equal(
            d.batch.allocations[0]!.transactionHash,
            a.transactionHash,
          );
          const entries = await royalties.listTrackLedgerEntries(
            batch!.trackId,
          );
          assert.equal(entries.filter((e) => e.status === "paid").length, 1);
        },
      );
      await t.test(
        "funded totals, terms, finalized evidence and event history cannot be rewritten",
        async () => {
          await assert.rejects(
            db.transaction((c) =>
              c.query(
                "UPDATE settlement_batches SET payload=jsonb_set(payload,'{fundedUnits}','\"1\"') WHERE id=$1",
                [batch!.id],
              ),
            ),
            /immutable/,
          );
          await assert.rejects(
            db.transaction((c) =>
              c.query("DELETE FROM settlement_events WHERE batch_id=$1", [
                batch!.id,
              ]),
            ),
            /append-only/,
          );
          await assert.rejects(
            db.transaction((c) =>
              c.query("DELETE FROM financial_attempts WHERE batch_id=$1", [
                batch!.id,
              ]),
            ),
            /append-only/,
          );
          const d = await s.detail(batch!.id);
          assert.equal(d.batch.fundedUnits, "1000000000");
        },
      );
      await t.test(
        "worker confirms durable maintenance without rewriting terminal evidence",
        async () => {
          const { financialCycle } = await import("./financial-worker.js");
          const a = await s.prepare(batch!.id, "maintain", "admin:test");
          for (const key of signers.slice(0, 2))
            await s.addSignature(
              a.id,
              "admin:test",
              { signedTransaction: sign(a.transaction, key) },
              true,
            );
          await s.submit(a.id, "admin:test", true);
          const stored = (await s.detail(batch!.id)).attempts.find(
            (x) => x.id === a.id,
          )!;
          success(stored);
          await financialCycle();
          assert.equal(
            (await s.detail(batch!.id)).attempts.find((x) => x.id === a.id)!
              .status,
            "confirmed",
          );
          await financialCycle();
          const report = await s.reconciliationReport();
          assert.equal(report.ok, true);
          assert.equal(report.fundedUnits, "1000000000");
          assert.equal(report.openUnits, batch!.allocations[1]!.amountUnits);
          assert.equal(report.claimedUnits, batch!.allocations[0]!.amountUnits);
          assert.equal(report.networkFeeXlmUnits, "300");
        },
      );
      await t.test(
        "restoration requires two signatures and never consumes a claim",
        async () => {
          const prepare = chain.prepare;
          chain.prepare = async (...args) => ({
            ...(await prepare(...args)),
            kind: "restore",
          });
          try {
            const a = await s.prepare(batch!.id, "maintain", "admin:test");
            assert.equal(a.kind, "restore");
            await s.addSignature(
              a.id,
              "admin:test",
              { signedTransaction: sign(a.transaction, signers[0]!) },
              true,
            );
            await assert.rejects(
              s.submit(a.id, "admin:test", true),
              /Two independent/,
            );
            const signedAttempt = await s.addSignature(
              a.id,
              "admin:test",
              { signedTransaction: sign(a.transaction, signers[1]!) },
              true,
            );
            success(signedAttempt);
            const confirmed = await s.submit(a.id, "admin:test", true);
            assert.equal(confirmed.status, "confirmed");
            const b = (await s.detail(batch!.id)).batch;
            assert.equal(
              b.allocations.filter((a) => a.status === "available").length,
              1,
            );
          } finally {
            chain.prepare = prepare;
          }
        },
      );
      await t.test(
        "concurrent earnings recognition is atomic and reserves complete sources",
        async () => {
          const sourceId = randomUUID();
          let built = 0;
          const source = await royalties.listTrackLedgerEntries(batch!.trackId);
          const build = async () => {
            built++;
            return source.map((e) => ({
              ...e,
              id: randomUUID(),
              sourceId,
              status: "approved" as const,
            }));
          };
          const [a, b] = await Promise.all([
            royaltiesRepository.recognizeSource(
              "manual_adjustment",
              sourceId,
              build,
            ),
            royaltiesRepository.recognizeSource(
              "manual_adjustment",
              sourceId,
              build,
            ),
          ]);
          assert.equal(built, 1);
          assert.deepEqual(
            a.map((e) => e.id).sort(),
            b.map((e) => e.id).sort(),
          );
          assert.equal(a.length, 2);
          assert.equal(
            (await s.balances(batch!.allocations[0]!.beneficiary)).pendingUnits,
            batch!.allocations[0]!.amountUnits,
          );
          await assert.rejects(
            royaltiesRepository.recognizeSource(
              "manual_adjustment",
              randomUUID(),
              async () => {
                throw new Error("deliberate allocation failure");
              },
            ),
            /deliberate/,
          );
          const late = { ...source[0]!, id: randomUUID() };
          await assert.rejects(
            royaltiesRepository.upsertLedgerEntry(late),
            /additional ledger/,
          );
        },
      );
      await t.test(
        "pruned transaction history cannot release an uncertain withdrawal",
        async () => {
          const index = batch!.allocations.findIndex(
            (a) => a.beneficiary !== batch!.allocations[0]!.beneficiary,
          );
          const actor = batch!.allocations[index]!.beneficiary;
          const key = keys.find((k) => k.publicKey() === actor)!;
          const a = await s.prepare(batch!.id, "claim", actor, index);
          await s.addSignature(a.id, actor, {
            signedTransaction: sign(a.transaction, key),
          });
          await s.submit(a.id, actor);
          results.set(a.transactionHash, {
            ...pending(),
            latestLedgerCloseTime: Date.parse(a.expiresAt) / 1000 + 100,
            oldestLedgerCloseTime: Date.parse(a.createdAt) / 1000 + 50,
          });
          assert.equal((await s.reconcile(a.id)).status, "submitted");
          assert.equal(
            (await s.prepare(batch!.id, "claim", actor, index)).id,
            a.id,
          );
          const originalNow = Date.now,
            originalSend = chain.send;
          let resubmissions = 0;
          Date.now = () => originalNow() + 60000;
          chain.send = async (tx) => {
            assert.equal(tx.hash().toString("hex"), a.transactionHash);
            resubmissions++;
            return {
              status: "PENDING",
              hash: a.transactionHash,
              latestLedger: 100,
              latestLedgerCloseTime: Math.floor(originalNow() / 1000),
            };
          };
          try {
            for (let retry = 0; retry < 4; retry++) await s.submit(a.id, actor);
            assert.equal(resubmissions, 2);
            assert.equal(
              (await s.detail(batch!.id)).attempts.find((x) => x.id === a.id)!
                .submissionCount,
              3,
            );
          } finally {
            Date.now = originalNow;
            chain.send = originalSend;
          }
        },
      );
      await t.test(
        "reservation audit failure rolls back the entire batch and all source reservations",
        async () => {
          const source = await approvedSource();
          const p = await s.preview(source);
          await failingAudit("source_reserved", async () => {
            await assert.rejects(
              s.reserve(source, p.id, "admin:test"),
              /deliberate settlement audit failure/,
            );
            const count = await db.transaction((c) =>
              c.query(
                "SELECT (SELECT count(*) FROM settlement_batches WHERE id=$1)::int AS batches,(SELECT count(*) FROM settlement_reservations WHERE batch_id=$1)::int AS reservations",
                [p.id],
              ),
            );
            assert.deepEqual(count.rows[0], { batches: 0, reservations: 0 });
          });
          assert.equal((await s.reserve(source, p.id, "admin:test")).id, p.id);
        },
      );
      await t.test("historical pending payouts remain unchanged and block new settlement",async()=>{
        const source=await approvedSource();const entries=await royaltiesRepository.listLedgerEntriesBySource("manual_adjustment",source.sourceId);const stamp=new Date().toISOString();
        const payout={id:randomUUID(),recipientWalletAddress:entries[0]!.recipientWalletAddress,recipientChain:"stellar" as const,payoutRail:"stellar" as const,status:"submitted" as const,amount:entries[0]!.netAmount,assetCode:"USDC",assetIssuer:issuer,txHash:"b".repeat(64),ledgerEntryIds:entries.map(e=>e.id),createdAt:stamp,updatedAt:stamp};
        await royaltiesRepository.upsertPayout(payout);await assert.rejects(s.preview(source),/historical payout activity/);
        const retained=await db.transaction(c=>c.query("SELECT payload FROM royalty_payouts WHERE id=$1",[payout.id]));assert.deepEqual(retained.rows[0].payload,payout);
      });
      await t.test("the durable event index rejects edits and reports untracked on-chain batches",async()=>{
        const {indexSettlementEvents}=await import("./chain-events.js");
        await indexSettlementEvents();await indexSettlementEvents();
        await assert.rejects(db.transaction(c=>c.query("DELETE FROM settlement_chain_events")),/append-only/);
        const original=batches.get(batch!.id)!;const id="f".repeat(64);
        batches.set(id,{...original,claimed:original.funded,reclaimed:0n,claims:original.claims.map(c=>({...c,status:["Claimed"]})),request:{...original.request,batch_id:Buffer.from(id,"hex"),source_id:Buffer.from("e".repeat(64),"hex")}});fundedHashes.set(id,"d".repeat(64));
        await indexSettlementEvents();const report=await s.reconciliationReport();assert.equal(report.ok,false);assert.ok(report.discrepancies.some(d=>d.batchId===id));assert.equal(report.escrowBalanceUnits,report.openUnits);
        const checkpoint=await db.transaction(c=>c.query("SELECT deployment_ledger,cursor,caught_up FROM settlement_chain_cursors"));assert.equal(checkpoint.rows[0].cursor,"mock-cursor");assert.equal(checkpoint.rows[0].caught_up,true);
      });
    } finally {
      Object.assign(registry, originalRegistry);
      Object.assign(chain, originalChain);
      Object.assign(env, originalEnv);
      await db.close();
    }
  },
);
