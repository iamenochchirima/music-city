import { databaseService } from "./services/database.service.js";
import { settlementChain } from "./modules/settlements/settlement-chain.js";
import { financialCycle } from "./modules/settlements/financial-worker.js";
import { logger } from "./utils/logger.js";
import { errorMessage } from "./utils/error-message.js";
await databaseService.initialize();
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
logger.info("Music City financial reconciliation worker started");
let settlementReady = false;
let nextSettlementCheckAt = 0;
let settlementCheck: Promise<void> | null = null;
function checkSettlementReadiness() {
  if (settlementCheck || Date.now() < nextSettlementCheckAt) return;
  nextSettlementCheckAt = Date.now() + 60_000;
  settlementCheck = (async () => {
    try {
      await settlementChain.verifyConfiguration();
      settlementChain.eventStartLedger();
      settlementReady = true;
      logger.info("Settlement reconciliation is ready");
    } catch (error) {
      settlementReady = false;
      logger.error(
        "Settlement reconciliation is unavailable; independent ramp and cash-out jobs continue",
        { error: errorMessage(error, "Settlement configuration is unavailable") },
      );
    }
  })().finally(() => {
    settlementCheck = null;
  });
}
while (!stopped) {
  checkSettlementReadiness();
  try {
    await financialCycle({ settlementReady });
  } catch (error) {
    logger.error("Financial worker cycle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
await settlementCheck;
await databaseService.close();
