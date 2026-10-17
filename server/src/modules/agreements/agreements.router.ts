import { z } from "zod";
import { Router } from "express";
import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { agreementsService } from "./agreements.service.js";

function versionedBody(body: unknown) {
  const { expectedVersion, expectedHash, ...input } = z
    .object({
      expectedVersion: z.number().int().positive(),
      expectedHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .passthrough()
    .parse(body);
  return { expectedVersion, expectedHash, input };
}
export const agreementsRouter = Router();
agreementsRouter.use(requireSession);
agreementsRouter.get(
  "/contributors",
  asyncHandler(async (req, res) => {
    res.json({
      items: await agreementsService.contributors(String(req.query.q ?? "")),
    });
  }),
);
agreementsRouter.get(
  "/track/:trackId",
  asyncHandler(async (req, res) => {
    res.json({
      id: await agreementsService.forTrack(
        req.session!.walletAddress,
        String(req.params.trackId),
      ),
    });
  }),
);
agreementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({
      items: await agreementsService.list(req.session!.walletAddress),
    });
  }),
);
agreementsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json({
        version: await agreementsService.create(
          req.session!.walletAddress,
          req.body,
        ),
      });
  }),
);
agreementsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(
      await agreementsService.get(
        String(req.params.id),
        req.session!.walletAddress,
      ),
    );
  }),
);
agreementsRouter.put(
  "/:id/draft",
  asyncHandler(async (req, res) => {
    const { expectedVersion, expectedHash, input } = versionedBody(req.body);
    res.json({
      version: await agreementsService.edit(
        String(req.params.id),
        req.session!.walletAddress,
        input,
        expectedVersion,
        expectedHash,
      ),
    });
  }),
);
agreementsRouter.post(
  "/:id/submit",
  asyncHandler(async (req, res) => {
    const { expectedVersion, expectedHash } = versionedBody(req.body);
    res.json({
      version: await agreementsService.submit(
        String(req.params.id),
        req.session!.walletAddress,
        expectedVersion,
        expectedHash,
      ),
    });
  }),
);
agreementsRouter.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const { expectedVersion, expectedHash } = versionedBody(req.body);
    res.json({
      version: await agreementsService.cancel(
        String(req.params.id),
        req.session!.walletAddress,
        expectedVersion,
        expectedHash,
      ),
    });
  }),
);
agreementsRouter.post(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    const { expectedVersion, expectedHash, input } = versionedBody(req.body);
    res
      .status(201)
      .json({
        version: await agreementsService.revise(
          String(req.params.id),
          req.session!.walletAddress,
          input,
          expectedVersion,
          expectedHash,
        ),
      });
  }),
);
agreementsRouter.post(
  "/:id/challenges",
  asyncHandler(async (req, res) => {
    res
      .status(201)
      .json(
        await agreementsService.challenge(
          String(req.params.id),
          req.session!.walletAddress,
          req.body,
        ),
      );
  }),
);
agreementsRouter.post(
  "/:id/responses",
  asyncHandler(async (req, res) => {
    res.json({
      version: await agreementsService.respond(
        String(req.params.id),
        req.session!.walletAddress,
        req.body,
      ),
    });
  }),
);
