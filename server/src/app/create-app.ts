import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "../config/env.js";
import { errorHandler } from "../middleware/error-handler.js";
import { notFoundHandler } from "../middleware/not-found.js";
import { apiRouter } from "../routes/index.js";
import { logger } from "../utils/logger.js";

export const createApp = () => {
  const app = express();
  const allowedOrigins = [env.CLIENT_ORIGIN, env.ADMIN_CLIENT_ORIGIN].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        logger.warn("Blocked request due to disallowed CORS origin", { origin });
        callback(new Error("Origin not allowed by CORS"));
      },
      credentials: true,
      exposedHeaders: ["ETag"],
    }),
  );
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(
    express.json({
      verify: (request, _response, buffer) => {
        (request as express.Request).rawBody = buffer.toString("utf8");
      },
    }),
  );
  app.use(cookieParser());

  app.use("/api/v1", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
