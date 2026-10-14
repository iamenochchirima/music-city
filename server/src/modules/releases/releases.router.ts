import { publicationService } from "../publication/publication.service.js";
import { Router } from "express";
import { ZodError } from "zod";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { releasesService } from "./releases.service.js";

const releasesRouter = Router();

releasesRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ items: await releasesService.listReleases() });
  }),
);

releasesRouter.get(
  "/mine",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await releasesService.listMyReleases(
        request.session!.walletAddress,
      ),
    });
  }),
);

releasesRouter.get(
  "/:releaseId/manage",
  requireSession,
  asyncHandler(async (request, response) => {
    const release = await releasesService.getManageRelease(
      request.session!.walletAddress,
      String(request.params.releaseId),
    );

    if (!release) {
      throw new HttpError(404, "Release not found");
    }

    response.json({ release });
  }),
);

releasesRouter.post(
  "/:releaseId/publication",
  requireSession,
  asyncHandler(async (request, response) => {
    const publication = await publicationService.request(
      request.session!.walletAddress,
      String(request.params.releaseId),
      request.body,
    );
    response
      .status(publication.state === "published" ? 200 : 202)
      .json({
        publication,
        release: await releasesService.getManageRelease(
          request.session!.walletAddress,
          String(request.params.releaseId),
        ),
      });
  }),
);
releasesRouter.delete(
  "/:releaseId/publication",
  requireSession,
  asyncHandler(async (request, response) => {
    await publicationService.cancel(
      request.session!.walletAddress,
      String(request.params.releaseId),
    );
    response.json({
      release: await releasesService.getManageRelease(
        request.session!.walletAddress,
        String(request.params.releaseId),
      ),
    });
  }),
);

releasesRouter.get(
  "/:releaseId",
  asyncHandler(async (request, response) => {
    response.json({
      release: await releasesService.getRelease(
        String(request.params.releaseId),
      ),
    });
  }),
);

releasesRouter.post(
  "/:releaseId/track-metadata",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const tracks = await releasesService.applyTrackMetadata(
        request.session!.walletAddress,
        String(request.params.releaseId),
        request.body,
      );
      response.json({ tracks });
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Track label update failed",
      );
    }
  }),
);

releasesRouter.post(
  "/",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const release = await releasesService.createRelease(
        request.session!.walletAddress,
        request.body,
      );

      response.status(201).json({ release });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Release creation failed",
      );
    }
  }),
);

releasesRouter.post(
  "/:releaseId/revision",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      response.json({
        release: await releasesService.beginRevision(
          request.session!.walletAddress,
          String(request.params.releaseId),
        ),
      });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Unable to start revision",
      );
    }
  }),
);

releasesRouter.put(
  "/:releaseId",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const release = await releasesService.updateRelease(
        request.session!.walletAddress,
        String(request.params.releaseId),
        request.body,
      );

      response.json({ release });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Release update failed",
      );
    }
  }),
);

releasesRouter.post(
  "/:releaseId/tracks",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const release = await releasesService.addTrackToRelease(
        request.session!.walletAddress,
        String(request.params.releaseId),
        request.body,
      );

      response.json({ release });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Add track to release failed",
      );
    }
  }),
);

releasesRouter.put(
  "/:releaseId/tracks/order",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const release = await releasesService.reorderReleaseTracks(
        request.session!.walletAddress,
        String(request.params.releaseId),
        request.body,
      );

      response.json({ release });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Release reorder failed",
      );
    }
  }),
);

releasesRouter.delete(
  "/:releaseId",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      await releasesService.deleteRelease(
        request.session!.walletAddress,
        String(request.params.releaseId),
      );

      response.status(204).send();
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Release deletion failed",
      );
    }
  }),
);

releasesRouter.delete(
  "/:releaseId/tracks/:trackId",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const release = await releasesService.removeTrackFromRelease(
        request.session!.walletAddress,
        String(request.params.releaseId),
        String(request.params.trackId),
      );

      response.json({ release });
    } catch (error) {
      if (error instanceof ZodError) {
        throw error;
      }

      throw new HttpError(
        400,
        error instanceof Error
          ? error.message
          : "Remove track from release failed",
      );
    }
  }),
);

export { releasesRouter };
