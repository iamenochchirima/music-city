import { reconcileAgreementFinalizations } from "../agreements/agreement-worker.js";
import { supportService } from "../support/support.service.js";
import { checkoutService } from "../payments/checkout.service.js";
import { indexSettlementEvents } from "./chain-events.js";
import { databaseService } from "../../services/database.service.js";
import { settlementService } from "./settlement.service.js";
import { logger } from "../../utils/logger.js";
export async function financialCycle() {
  await reconcileAgreementFinalizations();
  await supportService.cycle();
  await checkoutService.cycle();
  // A transaction advisory lock prevents overlapping scans across worker replicas.
  return databaseService.transaction(async (client) => {
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtext('music-city-financial-worker')) AS acquired",
    );
    if (!lock.rows[0].acquired) return;
    try {await indexSettlementEvents();} catch(error) {logger.error("Financial event index needs attention",{error:error instanceof Error?error.message:String(error)});}
    const attempts = await client.query(
      "SELECT id,batch_id FROM financial_attempts WHERE status IN ('awaiting_signatures','submitting','submitted') ORDER BY checked_at NULLS FIRST LIMIT 20",
    );
    const batches = await client.query(
      "SELECT id FROM settlement_batches WHERE state IN ('reserved','funded') ORDER BY checked_at NULLS FIRST LIMIT 20",
    );
    for (const row of attempts.rows) {
      try {
        const attempt = await settlementService.reconcile(row.id as string);
        if (["submitting", "submitted"].includes(attempt.status))
          await settlementService.submit(
            attempt.id,
            attempt.actor,
            attempt.kind !== "claim",
          );
      } catch (error) {
        await recordDiscrepancy(row.batch_id as string, error);
      }
      await client.query(
        "UPDATE financial_attempts SET checked_at=NOW() WHERE id=$1",
        [row.id],
      );
    }
    for (const row of batches.rows) {
      try {
        await settlementService.reconcileBatch(row.id as string);
      } catch (error) {
        await recordDiscrepancy(row.id as string, error);
      }
      await client.query(
        "UPDATE settlement_batches SET checked_at=NOW() WHERE id=$1",
        [row.id],
      );
    }
    try {await settlementService.refreshReconciliation();} catch(error) {logger.error("Global financial reconciliation needs attention",{error:error instanceof Error?error.message:String(error)});}
  });
}
async function recordDiscrepancy(id: string, error: unknown) {
  const message =
    error instanceof Error ? error.message : "Financial reconciliation failed";
  logger.error("Financial reconciliation needs attention", {
    batchId: id,
    error: message,
  });
  await databaseService.transaction(async (client) => {
    await client.query(
      "UPDATE settlement_batches SET payload=jsonb_set(payload,'{discrepancy}',to_jsonb($2::text)) WHERE id=$1 AND payload->>'discrepancy' IS DISTINCT FROM $2",
      [id, message],
    );
  });
}
