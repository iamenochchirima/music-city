import { createApp } from "./app/create-app.js";
import { env } from "./config/env.js";
import { databaseService } from "./services/database.service.js";

await databaseService.initialize();
const app = createApp();

app.listen(env.PORT, () => {
  console.log(`music-city server listening on port ${env.PORT}`);
});
