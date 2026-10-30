import { notificationWorker } from "./modules/notifications/notification-worker.js";
import { emailConfigurationError } from "./modules/notifications/email-adapter.js";
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
logger.info("Music City media and notification worker started");
const emailError = emailConfigurationError();
if (emailError) logger.warn(emailError);
let scanAt = 0;
while (!stopped) {
  let notificationRan = false;
  try {
    notificationRan = await notificationWorker.runOne();
  } catch (error) {
    logger.error("Notification worker cycle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    if (Date.now() >= scanAt) {
      await mediaWorker.scan();
      scanAt = Date.now() + 10000;
    }
    const mediaRan = await mediaWorker.runOne();
    if (notificationRan || mediaRan) continue;
  } catch (error) {
    logger.error("Media worker cycle failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
await databaseService.close();
