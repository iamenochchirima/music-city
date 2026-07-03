import { createApp } from "./app/create-app.js";
import { env } from "./config/env.js";
import { databaseService } from "./services/database.service.js";
import { logger } from "./utils/logger.js";

await databaseService.initialize();
const app = createApp();

app.listen(env.PORT, () => {
  logger.info("music-city server listening", {
    port: env.PORT,
    clientOrigin: env.CLIENT_ORIGIN,
    adminClientOrigin: env.ADMIN_CLIENT_ORIGIN,
  });
});
