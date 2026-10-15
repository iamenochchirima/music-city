import { databaseService } from "./services/database.service.js";
import { settlementChain } from "./modules/settlements/settlement-chain.js";
import { financialCycle } from "./modules/settlements/financial-worker.js";
import { logger } from "./utils/logger.js";
await databaseService.initialize();
await settlementChain.verifyConfiguration();
settlementChain.eventStartLedger();
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
logger.info("Music City financial reconciliation worker started");
while (!stopped) {
  try {
    await financialCycle();
  } catch (error) {
    logger.error("Financial worker cycle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
}
await databaseService.close();
