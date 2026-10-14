import { mediaWorker } from "../publication/media-worker.js";
import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { mediaService } from "./media.service.js";

const mediaRouter = Router();

mediaRouter.post(
  "/webhooks/mux",
  asyncHandler(async (request, response) => {
    if (!request.rawBody) {
      throw new HttpError(400, "Webhook body is missing");
    }

    const headers = new Headers();

    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === "string") {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(","));
      }
    }

    const event = await mediaService.unwrapMuxWebhook(request.rawBody, headers);
    await mediaWorker.receive(event);

    response.json({
      received: true,
      eventType: event.type,
    });
  }),
);

export { mediaRouter };
