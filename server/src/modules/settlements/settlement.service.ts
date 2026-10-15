import { indexedBatchReceipts } from "./chain-receipts.js";
import { randomUUID } from "node:crypto";
import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { Api } from "@stellar/stellar-sdk/rpc";
import {
  financialAttemptSchema,
  royaltyLedgerEntrySchema,
  settlementPreviewInputSchema,
  signedFinancialTransactionSchema,
  type FinancialAttempt,
  type SettlementBatch,
} from "@music-city/shared";
import type { PoolClient } from "pg";
import { databaseService } from "../../services/database.service.js";
import { HttpError } from "../../utils/http-error.js";
import { finalizedSplitsRepository } from "../agreements/effective-split.js";
import { agreementsChain } from "../agreements/agreements-chain.js";
import {
  collectTreasurySignatures,
  signedTreasuryTransaction,
  verifyTreasuryEnvelope,
} from "../agreements/treasury-signatures.js";
import {
  createSettlementPreview,
  assertConservation,
} from "./settlement-domain.js";
import {
  requireSettlementConfig,
  settlementChain,
  verifyChainBatch,
  type ChainBatch,
} from "./settlement-chain.js";
import {
  assertSourceAvailable,
  loadAttempt,
  loadBatch,
  saveAttempt,
  saveBatch,
  settlementEvent,
  settlementRepository,
} from "./settlement-repository.js";

async function sourceEntries(
  client: PoolClient,
  request: { trackId: string; sourceType: string; sourceId: string },
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `royalty-source:${request.sourceType}:${request.sourceId}`,
  ]);
  const rows = await client.query(
    "SELECT payload FROM royalty_ledger WHERE track_id=$1 AND source_type=$2 AND source_id=$3 ORDER BY id FOR UPDATE",
    [request.trackId, request.sourceType, request.sourceId],
  );
  return rows.rows.map((r) => royaltyLedgerEntrySchema.parse(r.payload));
}
async function preview(client: PoolClient, input: unknown) {
  const request = settlementPreviewInputSchema.parse(input);
  const entries = await sourceEntries(client, request);
  if (!entries.length)
    throw new HttpError(409, "No earnings found for this source");
  const split = (await finalizedSplitsRepository.list(request.trackId)).find(
    (s) => s.id === entries[0]!.splitId,
  );
  if (!split)
    throw new HttpError(
      409,
      "These earnings have no verified contributor-approved agreement",
    );
  const batch = createSettlementPreview(
    entries,
    split,
    settlementChain.config(),
    request.expiresAt,
  );
  await assertSourceAvailable(
    client,
    entries.map((e) => e.id),
  );
  const exact = await agreementsChain.getVersion(batch.trackId, batch.version);
  if (
    !exact ||
    exact.agreementId !== batch.agreementId ||
    exact.proposalHash !== batch.proposalHash ||
    JSON.stringify(exact.recipients) !==
      JSON.stringify(
        split.recipients.map((r) => ({
          walletAddress: r.walletAddress,
          role: r.role,
          shareBps: r.shareBps,
        })),
      )
  )
    throw new HttpError(
      409,
      "Captured agreement does not match its immutable finalized registry version",
    );
  await settlementChain.verifyConfiguration(batch.config);
  assertConservation(batch);
  return batch;
}
function authorizeAttempt(
  attempt: FinancialAttempt,
  actor: string,
  admin: boolean,
) {
  if (
    !admin &&
    (attempt.kind !== "claim" ||
      attempt.actor !== actor ||
      attempt.treasuryAddress !== actor)
  )
    throw new HttpError(403, "This withdrawal belongs to another wallet");
  if (admin && attempt.kind === "claim")
    throw new HttpError(
      403,
      "Creator withdrawals require the beneficiary's own session and wallet",
    );
}
export function signedFinancialTransaction(
  attempt: FinancialAttempt,
): Transaction {
  if (attempt.kind !== "claim") return signedTreasuryTransaction(attempt);
  const tx = TransactionBuilder.fromXDR(
    attempt.transaction,
    attempt.networkPassphrase,
  );
  const signer = attempt.treasuryAddress,
    signature = attempt.signatures[signer];
  if (
    !(tx instanceof Transaction) ||
    tx.hash().toString("hex") !== attempt.transactionHash ||
    attempt.signers.length !== 1 ||
    attempt.signers[0] !== signer ||
    attempt.signedBy.length !== 1 ||
    attempt.signedBy[0] !== signer ||
    !signature ||
    !Keypair.fromPublicKey(signer).verify(
      tx.hash(),
      Buffer.from(signature, "base64"),
    )
  )
    throw new HttpError(
      403,
      "The beneficiary must sign the exact prepared withdrawal",
    );
  tx.addSignature(signer, signature);
  return tx;
}
async function syncBatch(
  client: PoolClient,
  batch: SettlementBatch,
  actual: ChainBatch,
  actor: string,
  receipt?: FinancialAttempt,
) {
  verifyChainBatch(batch, actual);
  const indexed=await indexedBatchReceipts(client,batch,actual);
  const timestamp = new Date().toISOString();
  const allocations = batch.allocations.map((a) => {
    const c = actual.claims[a.index]!;
    const status =
      c.status[0] === "Claimed"
        ? ("claimed" as const)
        : c.status[0] === "Reclaimed"
          ? ("reclaimed" as const)
          : ("available" as const);
    const hash =
      receipt?.claimIndex === a.index && receipt.status === "confirmed"
        ? receipt.transactionHash
        : indexed.claims.get(a.index) ?? a.transactionHash;
    if(a.transactionHash && indexed.claims.has(a.index) && indexed.claims.get(a.index)!==a.transactionHash)throw new HttpError(409,"Withdrawal transaction evidence changed");
    return {
      ...a,
      status,
      updatedLedger: c.updated_ledger,
      ...(hash ? { transactionHash: hash } : {}),
    };
  });
  const next: SettlementBatch = {
    ...batch,
    allocations,
    state: allocations.every(
      (a) => a.status !== "available" || BigInt(a.amountUnits) === 0n,
    )
      ? "closed"
      : "funded",
    fundedLedger: actual.funded_ledger,
    updatedAt: timestamp,
  };
  if (receipt?.kind === "settle") next.fundingHash = receipt.transactionHash;
  else if(indexed.fundingHash) next.fundingHash=indexed.fundingHash;
  delete next.discrepancy;
  if (
    JSON.stringify({ ...next, updatedAt: batch.updatedAt }) ===
    JSON.stringify(batch)
  )
    return batch;
  await saveBatch(client, next);
  for (const a of allocations.filter((a) => a.status === "claimed")) {
    await client.query(
      "UPDATE royalty_ledger SET status='paid',payload=jsonb_set(jsonb_set(payload,'{status}','\"paid\"'),'{updatedAt}',to_jsonb($2::text)) WHERE id=ANY($1::text[]) AND status<>'paid'",
      [a.ledgerEntryIds, timestamp],
    );
  }
  await settlementEvent(client, batch.id, actor, "chain_state_reconciled", {
    fundedLedger: actual.funded_ledger,
    claimedUnits: actual.claimed.toString(),
    reclaimedUnits: actual.reclaimed.toString(),
    transactionHash: receipt?.transactionHash,
  });
  return next;
}
export const settlementService = {
  ...settlementRepository,
  async preview(input: unknown) {
    return databaseService.transaction((client) => preview(client, input));
  },
  async reserve(input: unknown, expectedId: string, actor: string) {
    return databaseService.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('music-city-settlement-reservation'))",
      );
      const existing = await client.query(
        "SELECT payload FROM settlement_batches WHERE id=$1",
        [expectedId],
      );
      if (existing.rows[0]) return existing.rows[0].payload as SettlementBatch;
      const batch = await preview(client, input);
      if (batch.id !== expectedId)
        throw new HttpError(
          409,
          "Earnings changed. Review the current preview before reserving",
        );
      await client.query(
        "INSERT INTO settlement_batches(id,source_key,agreement_id,version,state,payload) VALUES($1,$2,$3,$4,$5,$6)",
        [
          batch.id,
          batch.sourceKey,
          batch.agreementId,
          batch.version,
          batch.state,
          batch,
        ],
      );
      for (const a of batch.allocations)
        for (const id of a.ledgerEntryIds)
          await client.query(
            "INSERT INTO settlement_reservations(ledger_id,batch_id,allocation_index) VALUES($1,$2,$3)",
            [id, batch.id, a.index],
          );
      await settlementEvent(client, batch.id, actor, "source_reserved", {
        sourceKey: batch.sourceKey,
        ledgerIds: batch.allocations.flatMap((a) => a.ledgerEntryIds),
        fundedUnits: batch.fundedUnits,
      });
      return batch;
    });
  },
  async prepare(
    batchId: string,
    kind: "settle" | "claim" | "reclaim" | "maintain",
    actor: string,
    index?: number,
  ) {
    return databaseService.transaction(async (client) => {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext('music-city-agreement-treasury'))",
      );
      const batch = await loadBatch(client, batchId);
      requireSettlementConfig(batch.config);
      const allocation =
        index === undefined ? undefined : batch.allocations[index];
      if (kind === "claim" && (!allocation || allocation.beneficiary !== actor))
        throw new HttpError(403, "This claim belongs to another wallet");
      if ((kind === "claim" || kind === "reclaim") && !allocation)
        throw new HttpError(404, "Claim not found");
      const existing = await client.query(
        "SELECT payload FROM financial_attempts WHERE batch_id=$1 AND payload->>'kind'=$2 AND COALESCE(payload->>'claimIndex','')=$3 AND status IN ('awaiting_signatures','submitting','submitted','confirmed') ORDER BY payload->>'createdAt' DESC LIMIT 1",
        [batchId, kind, index?.toString() ?? ""],
      );
      if (
        existing.rows[0] &&
        (kind !== "maintain" || existing.rows[0].payload.status !== "confirmed")
      )
        return financialAttemptSchema.parse(existing.rows[0].payload);
      if (kind === "settle" && batch.state !== "reserved")
        throw new HttpError(409, "This settlement is already funded");
      if (
        (kind === "claim" || kind === "reclaim") &&
        (batch.state !== "funded" || allocation?.status !== "available")
      )
        throw new HttpError(409, "This claim is not available");
      if (kind === "claim" && Date.parse(batch.expiresAt) <= Date.now())
        throw new HttpError(409, "This claim has expired");
      if (kind === "reclaim" && Date.parse(batch.expiresAt) > Date.now())
        throw new HttpError(
          409,
          "Recovery is available after the claim expires",
        );
      const source = kind === "claim" ? actor : batch.config.treasuryAddress;
      const busy = await client.query(
        "SELECT id FROM financial_attempts WHERE source_address=$1 AND status IN ('awaiting_signatures','submitting','submitted') UNION ALL SELECT id FROM agreement_finalizations WHERE treasury_address=$1 AND status IN ('awaiting_signatures','submitting','submitted')",
        [source],
      );
      if (busy.rowCount)
        throw new HttpError(
          409,
          "Wait for this wallet's outstanding transaction before preparing another",
        );
      const prepared = await settlementChain.prepare(batch, kind, index);
      const timestamp = new Date().toISOString();
      const attempt = financialAttemptSchema.parse({
        id: randomUUID(),
        batchId,
        claimIndex: index,
        actor,
        ...prepared,
        kind: prepared.kind ?? kind,
        status: "awaiting_signatures",
        signatures: {},
        signedBy: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      await saveAttempt(client, attempt, true);
      await settlementEvent(client, batchId, actor, "transaction_prepared", {
        attemptId: attempt.id,
        claimIndex: index,
        transactionHash: attempt.transactionHash,
      });
      return attempt;
    });
  },
  async addSignature(id: string, actor: string, input: unknown, admin = false) {
    const request = signedFinancialTransactionSchema.parse(input);
    return databaseService.transaction(async (client) => {
      const a = await loadAttempt(client, id);
      authorizeAttempt(a, actor, admin);
      const batch = await loadBatch(client, a.batchId);
      requireSettlementConfig(batch.config);
      const next = collectTreasurySignatures(a, request.signedTransaction);
      await saveAttempt(client, next);
      await settlementEvent(client, a.batchId, actor, "signature_recorded", {
        attemptId: id,
        signedBy: next.signedBy,
      });
      return next;
    });
  },
  async submit(id: string, actor: string, admin = false) {
    const { attempt, shouldSubmit } = await databaseService.transaction(
      async (client) => {
        const a = await loadAttempt(client, id);
        authorizeAttempt(a, actor, admin);
        if (["confirmed", "failed", "expired"].includes(a.status))
          return { attempt: a, shouldSubmit: false };
        if (
          a.submissionCount >= 3 ||
          (a.lastSubmittedAt &&
            Date.parse(a.lastSubmittedAt) > Date.now() - 30000)
        )
          return { attempt: a, shouldSubmit: false };
        const batch = await loadBatch(client, a.batchId);
        requireSettlementConfig(batch.config);
        signedFinancialTransaction(a);
        if (Date.parse(a.expiresAt) <= Date.now())
          return { attempt: a, shouldSubmit: false };
        const evidence =
          a.kind === "restore"
            ? { signers: await settlementChain.treasurySigners(batch.config) }
            : await settlementChain.verifyConfiguration(batch.config);
        if (
          a.kind !== "claim" &&
          JSON.stringify(evidence.signers) !== JSON.stringify(a.signers)
        )
          throw new HttpError(409, "The treasury signer configuration changed");
        const next = {
          ...a,
          status: "submitting" as const,
          submissionCount: a.submissionCount + 1,
          lastSubmittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await saveAttempt(client, next);
        await settlementEvent(
          client,
          a.batchId,
          actor,
          "submission_requested",
          {
            attemptId: id,
            transactionHash: a.transactionHash,
          },
        );
        return { attempt: next, shouldSubmit: true };
      },
    );
    if (shouldSubmit) {
      try {
        await settlementChain.send(signedFinancialTransaction(attempt));
      } catch (error) {
        await databaseService.transaction(async (client) => {
          const current = await loadAttempt(client, id);
          if (current.status === "submitting")
            await saveAttempt(client, {
              ...current,
              error:
                "Submission outcome unknown. The backend is checking the original transaction.",
              updatedAt: new Date().toISOString(),
            });
        });
      }
    }
    return this.reconcile(id);
  },
  async reconcile(id: string) {
    return databaseService.transaction(async (client) => {
      const a = await loadAttempt(client, id);
      if (["confirmed", "failed", "expired"].includes(a.status)) return a;
      const batch = await loadBatch(client, a.batchId);
      requireSettlementConfig(batch.config);
      const result = await settlementChain.status(a.transactionHash);
      const now = new Date().toISOString();
      if (
        result.status !== Api.GetTransactionStatus.NOT_FOUND &&
        result.txHash !== a.transactionHash
      )
        throw new HttpError(
          409,
          "RPC returned a different financial transaction",
        );
      if (result.status === Api.GetTransactionStatus.SUCCESS) {
        const envelope = TransactionBuilder.fromXDR(
          result.envelopeXdr,
          a.networkPassphrase,
        );
        const signatures = verifyTreasuryEnvelope(a, envelope.toXDR());
        if (Object.keys(signatures).length < (a.kind === "claim" ? 1 : 2))
          throw new HttpError(
            409,
            "Confirmed financial transaction lacks the required wallet signatures",
          );
        const actual =
          a.kind === "restore" ? null : await settlementChain.getBatch(batch);
        if (
          (a.kind !== "restore" && !actual) ||
          (a.kind === "claim" &&
            actual?.claims[a.claimIndex!]?.status[0] !== "Claimed") ||
          (a.kind === "reclaim" &&
            actual?.claims[a.claimIndex!]?.status[0] !== "Reclaimed")
        )
          throw new HttpError(
            409,
            "Confirmed transaction has no matching funded settlement or claim outcome",
          );
        if((a.kind==="settle" && actual?.funded_ledger!==result.ledger) || ((a.kind==="claim" || a.kind==="reclaim") && actual?.claims[a.claimIndex!]?.updated_ledger!==result.ledger)) throw new HttpError(409,"The financial receipt ledger does not match the on-chain settlement transition");
        const next: FinancialAttempt = {
          ...a,
          status: "confirmed",
          signatures,
          signedBy: Object.keys(signatures).sort(),
          ledger: result.ledger,
          feeCharged: result.resultXdr.feeCharged().toString(),
          updatedAt: now,
        };
        delete next.error;
        await saveAttempt(client, next);
        if (actual) await syncBatch(client, batch, actual, "worker", next);
        await settlementEvent(
          client,
          batch.id,
          "worker",
          "transaction_confirmed",
          {
            attemptId: id,
            transactionHash: a.transactionHash,
            ledger: result.ledger,
            feeCharged: next.feeCharged,
          },
        );
        return next;
      }
      const expired =
        result.status === Api.GetTransactionStatus.NOT_FOUND &&
        result.latestLedgerCloseTime > Date.parse(a.expiresAt) / 1000 &&
        result.oldestLedgerCloseTime <= Date.parse(a.createdAt) / 1000;
      if (result.status === Api.GetTransactionStatus.FAILED || expired) {
        const actual =
          a.kind === "restore" ? null : await settlementChain.getBatch(batch);
        const effect =
          actual &&
          (a.kind === "settle" ||
            ((a.kind === "claim" || a.kind === "reclaim") &&
              actual?.claims[a.claimIndex!]?.status[0] !== "Available"));
        if (expired && effect)
          throw new HttpError(
            409,
            "A financial outcome exists but its original transaction is unresolved. Do not retry",
          );
        const next: FinancialAttempt = {
          ...a,
          status: expired ? "expired" : "failed",
          error: expired
            ? "Transaction expired without inclusion. Prepare a fresh transaction to retry."
            : "Stellar rejected this transaction. No transfer completed.",
          updatedAt: now,
        };
        if (result.status === Api.GetTransactionStatus.FAILED) {
          next.ledger = result.ledger;
          next.feeCharged = result.resultXdr.feeCharged().toString();
        }
        await saveAttempt(client, next);
        await settlementEvent(
          client,
          batch.id,
          "worker",
          "transaction_terminal",
          {
            attemptId: id,
            status: next.status,
            transactionHash: a.transactionHash,
            feeCharged: next.feeCharged,
          },
        );
        return next;
      }
      const pending: FinancialAttempt = {
        ...a,
        status:
          a.status === "awaiting_signatures"
            ? "awaiting_signatures"
            : "submitted",
        updatedAt: now,
      };
      await saveAttempt(client, pending);
      return pending;
    });
  },
  async latestReconciliation() {
    const config=settlementChain.config();
    return databaseService.transaction(async client=>{
      const row=(await client.query("SELECT payload,error,updated_at FROM settlement_reconciliation_snapshots WHERE network_passphrase=$1 AND contract_id=$2",[config.networkPassphrase,config.contractId])).rows[0];
      return {snapshot:row?.payload??null,error:row?.error??null,stale:!row || !!row.error || Date.now()-new Date(row.updated_at).getTime()>120000};
    });
  },
  async refreshReconciliation() {
    const config=settlementChain.config();
    try {
      const report=await this.reconciliationReport();
      await databaseService.transaction(client=>client.query("INSERT INTO settlement_reconciliation_snapshots(network_passphrase,contract_id,payload) VALUES($1,$2,$3) ON CONFLICT(network_passphrase,contract_id) DO UPDATE SET payload=EXCLUDED.payload,error=NULL,updated_at=NOW()",[config.networkPassphrase,config.contractId,report]));
      return report;
    } catch(error) {
      await databaseService.transaction(client=>client.query("INSERT INTO settlement_reconciliation_snapshots(network_passphrase,contract_id,error) VALUES($1,$2,$3) ON CONFLICT(network_passphrase,contract_id) DO UPDATE SET error=EXCLUDED.error,updated_at=NOW()",[config.networkPassphrase,config.contractId,error instanceof Error?error.message:"Financial reconciliation failed"]));
      throw error;
    }
  },
  async reconciliationReport() {
    const config = settlementChain.config();
    await settlementChain.verifyConfiguration(config);
    const batches = await settlementRepository.list();
    let funded = 0n,
      claimed = 0n,
      reclaimed = 0n,
      open = 0n;
    const discrepancies: { batchId: string; message: string }[] = [];
    const eventIndex=await databaseService.transaction(async client=>{
      const cursor=(await client.query("SELECT indexed_ledger,caught_up,checked_at,error FROM settlement_chain_cursors WHERE network_passphrase=$1 AND contract_id=$2",[config.networkPassphrase,config.contractId])).rows[0];
      const unknown=await client.query("SELECT DISTINCT e.batch_id FROM settlement_chain_events e LEFT JOIN settlement_batches b ON b.id=e.batch_id WHERE e.network_passphrase=$1 AND e.contract_id=$2 AND b.id IS NULL",[config.networkPassphrase,config.contractId]);
      return {cursor,unknownBatchIds:unknown.rows.map(r=>String(r.batch_id))};
    });
    if(!eventIndex.cursor?.caught_up || eventIndex.cursor.error || Date.now()-new Date(eventIndex.cursor.checked_at).getTime()>120000) discrepancies.push({batchId:"event-index",message:eventIndex.cursor?.error??"Financial event indexing is incomplete or has stopped updating"});
    for(const id of eventIndex.unknownBatchIds)discrepancies.push({batchId:id,message:"On-chain settlement activity is missing from the application ledger"});

    for (const batch of batches) {
      try {
        const actual = await settlementChain.getBatch(batch);
        if (!actual) {
          if (batch.state !== "reserved")
            throw new Error("Funded settlement state is unavailable");
          continue;
        }
        verifyChainBatch(batch, actual);
        const indexed=await databaseService.transaction(client=>indexedBatchReceipts(client,batch,actual));
        if(!indexed.fundingHash) discrepancies.push({batchId:batch.id,message:"The funding receipt has not been independently indexed"});
        for(const [index,claim] of actual.claims.entries())if(claim.status[0]!=="Available" && !indexed.claims.has(index)) discrepancies.push({batchId:batch.id,message:`The receipt for claim ${index} has not been independently indexed`});
        funded += actual.funded;
        claimed += actual.claimed;
        reclaimed += actual.reclaimed;
        open += actual.funded - actual.claimed - actual.reclaimed;
      } catch (error) {
        discrepancies.push({
          batchId: batch.id,
          message:
            error instanceof Error
              ? error.message
              : "Unable to verify settlement",
        });
      }
    }
    const unresolved=await databaseService.transaction(async client=>(await client.query("SELECT batch_id,transaction_hash FROM financial_attempts WHERE status IN ('submitting','submitted') AND (payload->>'expiresAt')::timestamptz<NOW() AND payload->>'networkPassphrase'=$1",[config.networkPassphrase])).rows);
    for(const attempt of unresolved)discrepancies.push({batchId:String(attempt.batch_id),message:`Expired transaction outcome remains unresolved: ${attempt.transaction_hash}`});
    const balance = await settlementChain.escrowBalance(config);
    if (balance < open)
      discrepancies.push({
        batchId: "escrow",
        message: "Escrow token balance is below verified open obligations",
      });
    if(balance>open)discrepancies.push({batchId:"escrow",message:"Escrow contains USDC not accounted for by tracked open claims"});
    const fees=await databaseService.transaction(async client=>{
      const rows=await client.query("SELECT transaction_hash,payload->>'feeCharged' AS fee FROM financial_attempts WHERE status IN ('confirmed','failed') AND payload->>'networkPassphrase'=$1 AND payload->>'feeCharged' IS NOT NULL UNION ALL SELECT transaction_hash,payload->'payload'->'receipt'->>'feeCharged' AS fee FROM settlement_chain_events WHERE network_passphrase=$1 AND contract_id=$2",[config.networkPassphrase,config.contractId]);
      const values=new Map<string,bigint>();
      for(const row of rows.rows){if(row.fee===null)throw new HttpError(409,"A financial event lacks its transaction fee receipt");const fee=BigInt(row.fee);if(values.has(row.transaction_hash)&&values.get(row.transaction_hash)!==fee)throw new HttpError(409,"Conflicting network fee evidence");values.set(row.transaction_hash,fee);}
      return [...values.values()].reduce((n,fee)=>n+fee,0n);
    });
    return {
      checkedAt: new Date().toISOString(),
      config,
      fundedUnits: funded.toString(),
      claimedUnits: claimed.toString(),
      reclaimedUnits: reclaimed.toString(),
      openUnits: open.toString(),
      escrowBalanceUnits: balance.toString(),
      surplusUnits: (balance > open ? balance - open : 0n).toString(),
      networkFeeXlmUnits: fees.toString(),
      discrepancies,
      eventIndex:{indexedLedger:eventIndex.cursor?.indexed_ledger ? Number(eventIndex.cursor.indexed_ledger) : undefined,caughtUp:eventIndex.cursor?.caught_up??false,checkedAt:eventIndex.cursor?.checked_at ? new Date(eventIndex.cursor.checked_at).toISOString() : undefined,unknownBatchIds:eventIndex.unknownBatchIds},
      ok: discrepancies.length === 0,
    };
  },
  async reconcileBatch(id: string) {
    return databaseService.transaction(async (client) => {
      const batch = await loadBatch(client, id);
      const actual = await settlementChain.getBatch(batch);
      if (!actual) {
        if (batch.state !== "reserved")
          throw new HttpError(
            409,
            "Funded contract state is unavailable. Restore and reconcile before proceeding",
          );
        return batch;
      }
      return syncBatch(client, batch, actual, "worker");
    });
  },
};
