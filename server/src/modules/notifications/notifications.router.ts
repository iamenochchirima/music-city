import { Router } from "express";
import { z } from "zod";
import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { notificationsService } from "./notifications.service.js";
export const notificationsRouter = Router();
notificationsRouter.use(requireSession);
notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const before = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional()
      .parse(req.query.before);
    res.json(
      await notificationsService.list(req.session!.walletAddress, before),
    );
  }),
);
notificationsRouter.post(
  "/read",
  asyncHandler(async (req, res) => {
    await notificationsService.read(req.session!.walletAddress);
    res.sendStatus(204);
  }),
);
notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const id = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(req.params.id);
    await notificationsService.read(req.session!.walletAddress, id);
    res.sendStatus(204);
  }),
);
