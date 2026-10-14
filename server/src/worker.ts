import { databaseService } from "./services/database.service.js";
import { mediaWorker } from "./modules/publication/media-worker.js";
import { logger } from "./utils/logger.js";
await databaseService.initialize();
let stopped = false;
process.on("SIGTERM", () => {
  stopped = true;
});
process.on("SIGINT", () => {
  stopped = true;
});
logger.info("Music City media worker started");
let scanAt = 0;
while (!stopped) {
  try {
    if (Date.now() >= scanAt) {
      await mediaWorker.scan();
      scanAt = Date.now() + 10000;
    }
    if (await mediaWorker.runOne()) continue;
  } catch (error) {
    logger.error("Media worker cycle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await databaseService.close();
