import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/async-handler.js";
import { requireSession } from "../../middleware/require-session.js";
import { supportService as support } from "./support.service.js";
export const supportRouter = Router();
supportRouter.get(
  "/recipients/artists/:id",
  asyncHandler(async (req, res) => {
    res.json({
      recipient: await support.artistRecipient(String(req.params.id)),
    });
  }),
);
supportRouter.get(
  "/recipients/tracks/:id",
  asyncHandler(async (req, res) => {
    res.json({ items: await support.trackRecipients(String(req.params.id)) });
  }),
);
supportRouter.use(requireSession);
supportRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ items: await support.list(req.session!.walletAddress) });
  }),
);
supportRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    res.status(201).json({
      payment: await support.prepare(req.session!.walletAddress, req.body),
    });
  }),
);
supportRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json({
      payment: await support.get(
        req.session!.walletAddress,
        String(req.params.id),
      ),
    });
  }),
);
supportRouter.post(
  "/:id/authorize",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ signedTransaction: z.string().min(1).max(20000) })
      .strict()
      .parse(req.body);
    res.json({
      payment: await support.authorize(
        req.session!.walletAddress,
        String(req.params.id),
        body.signedTransaction,
      ),
    });
  }),
);
supportRouter.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    res.json({
      payment: await support.submit(
        req.session!.walletAddress,
        String(req.params.id),
      ),
    });
  }),
);
supportRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    res.json({
      payment: await support.cancel(
        req.session!.walletAddress,
        String(req.params.id),
      ),
    });
  }),
);
