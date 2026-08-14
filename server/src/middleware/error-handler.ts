import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { HttpError } from "../utils/http-error.js";
import { logger } from "../utils/logger.js";

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
) => {
  logger.error("Unhandled request error", {
    error: error.message,
    name: error.name,
    path: _request.path,
    method: _request.method,
    statusCode: error instanceof HttpError ? error.statusCode : 500,
  });

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof ZodError) {
    const fields = Object.fromEntries(
      error.issues.map((issue) => [
        issue.path.join(".") || "form",
        issue.message,
      ]),
    );
    response.status(400).json({
      error: "Please check the highlighted fields",
      fields,
    });
    return;
  }

  response.status(500).json({
    error: "Internal server error",
  });
};
