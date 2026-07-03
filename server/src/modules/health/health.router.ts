import { Router } from "express";

import { databaseService } from "../../services/database.service.js";
import { asyncHandler } from "../../utils/async-handler.js";

const healthRouter = Router();

healthRouter.get("/", (_request, response) => {
  response.json({
    ok: true,
    service: "music-city-server",
  });
});

healthRouter.get(
  "/ready",
  asyncHandler(async (_request, response) => {
    const report = await databaseService.getReadinessReport();
    response.status(report.ok ? 200 : 503).json(report);
  }),
);

export { healthRouter };
