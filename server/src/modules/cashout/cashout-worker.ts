import { createCashOutChain, verifySavedCashOutEnvelope } from "./cashout-chain.js";
import { createCashOutEnvelopeCipher } from "./cashout-envelope.js";
import { createRampRepository } from "../ramps/ramp.repository.js";
import { rampSandboxConfigSchema } from "../ramps/sandbox-config.js";
import { databaseService } from "../../services/database.service.js";
import { logger } from "../../utils/logger.js";

type Repository = Pick<ReturnType<typeof createRampRepository>, "leaseCashOut" | "claimCashOutSubmission" | "markCashOutUnknown" | "recordCashOutReceipt" | "expireCashOutAttempt" | "releaseCashOut">;
type Chain = ReturnType<typeof createCashOutChain>;
type Cipher = ReturnType<typeof createCashOutEnvelopeCipher>;
type ErrorCode = "chain_check_failed" | "submission_unknown" | "history_unavailable" | null;

export async function reconcileCashOut(repository: Repository, chain: Chain, cipher: Cipher) {
  const attempt = await repository.leaseCashOut();
  if (!attempt) return;
  let errorCode: ErrorCode = null;
  try {
    // Read the closed ledger first, then look for the retained transaction hash.
    const ledger = await chain.ledger();
    const receipt = await chain.receipt(attempt.transactionHash);
    if (receipt) {
      await repository.recordCashOutReceipt(attempt.id, attempt.token, receipt);
    } else if (Date.parse(ledger.closed_at) > Date.parse(attempt.expiresAt)) {
      const coverage = await chain.historyCoverage();
      if (attempt.preparedLedger === null || coverage.start > attempt.preparedLedger || coverage.latest < ledger.sequence ||
          Date.parse(coverage.latestClosedAt) < Date.parse(ledger.closed_at)) {
        await repository.markCashOutUnknown(attempt.id, attempt.token);
        errorCode = "history_unavailable";
      } else {
        await repository.expireCashOutAttempt(attempt.id, attempt.token, ledger, coverage.start);
      }
    } else {
      const signed = cipher.decrypt(attempt.orderId, attempt.id, attempt.transactionHash, attempt.encryptedEnvelope);
      verifySavedCashOutEnvelope(attempt, signed);
      if (await repository.claimCashOutSubmission(attempt.id, attempt.token)) {
        try { await chain.submit(signed); }
        catch { errorCode = "submission_unknown"; }
      }
      await repository.markCashOutUnknown(attempt.id, attempt.token);
    }
  } catch {
    errorCode = "chain_check_failed";
    try { await repository.markCashOutUnknown(attempt.id, attempt.token); } catch { /* A newer lease owns the attempt. */ }
  } finally {
    await repository.releaseCashOut(attempt.id, attempt.token, errorCode);
  }
}

export async function cashOutCycle() {
  const config = rampSandboxConfigSchema.parse(process.env);
  if (config.RAMPS_SANDBOX_ENABLED !== "true" || !config.RAMPS_CASHOUT_ENCRYPTION_KEY) return;
  try {
    await reconcileCashOut(createRampRepository(databaseService), createCashOutChain(), createCashOutEnvelopeCipher(Buffer.from(config.RAMPS_CASHOUT_ENCRYPTION_KEY, "hex")));
  } catch { logger.error("Cash-out reconciliation needs attention", { code: "cashout_cycle_failed" }); }
}
