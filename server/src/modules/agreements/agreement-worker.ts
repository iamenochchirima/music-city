import { databaseService } from "../../services/database.service.js";
import { logger } from "../../utils/logger.js";
import { finalizationService } from "./finalization.service.js";

export async function reconcileAgreementFinalizations() {
  const attempts = await databaseService.transaction(
    async (client) =>
      (
        await client.query<{ id: string; agreement_id: string }>(
          "SELECT id,agreement_id FROM agreement_finalizations WHERE status IN ('awaiting_signatures','submitting','submitted') ORDER BY checked_at NULLS FIRST,id LIMIT 20",
        )
      ).rows,
  );
  for (const attempt of attempts) {
    try {
      // Stamp before reconciliation because a confirmed financial record cannot be changed.
      await databaseService.transaction(async (client) => {
        await client.query(
          "UPDATE agreement_finalizations SET checked_at=NOW() WHERE id=$1 AND status IN ('awaiting_signatures','submitting','submitted')",
          [attempt.id],
        );
      });
      const current = await finalizationService.reconcile(
        attempt.agreement_id,
        attempt.id,
        "worker:agreements",
      );
      // Only resume transactions whose submission was explicitly authorized by an operator.
      if (["submitting", "submitted"].includes(current.status))
        await finalizationService.submit(
          attempt.agreement_id,
          attempt.id,
          "worker:agreements",
        );
    } catch (error) {
      logger.error("Agreement confirmation pending", {
        attemptId: attempt.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
