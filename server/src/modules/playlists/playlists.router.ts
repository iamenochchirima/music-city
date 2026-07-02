import { Router } from "express";

import { requireSession } from "../../middleware/require-session.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { HttpError } from "../../utils/http-error.js";
import { playlistsService } from "./playlists.service.js";

const playlistsRouter = Router();

playlistsRouter.get(
  "/",
  asyncHandler(async (_request, response) => {
    response.json({ items: await playlistsService.listPlaylists() });
  }),
);

playlistsRouter.get(
  "/mine",
  requireSession,
  asyncHandler(async (request, response) => {
    response.json({
      items: await playlistsService.listMyPlaylists(request.session!.walletAddress),
    });
  }),
);

playlistsRouter.get(
  "/:playlistId/manage",
  requireSession,
  asyncHandler(async (request, response) => {
    const playlist = await playlistsService.getManagePlaylist(
      request.session!.walletAddress,
      String(request.params.playlistId),
    );

    if (!playlist) {
      throw new HttpError(404, "Playlist not found");
    }

    response.json({ playlist });
  }),
);

playlistsRouter.get(
  "/:playlistId",
  asyncHandler(async (request, response) => {
    response.json({
      playlist: await playlistsService.getPlaylist(String(request.params.playlistId)),
    });
  }),
);

playlistsRouter.post(
  "/",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const playlist = await playlistsService.createPlaylist(
        request.session!.walletAddress,
        request.body,
      );

      response.status(201).json({ playlist });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Playlist creation failed",
      );
    }
  }),
);

playlistsRouter.put(
  "/:playlistId",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const playlist = await playlistsService.updatePlaylist(
        request.session!.walletAddress,
        String(request.params.playlistId),
        request.body,
      );

      response.json({ playlist });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Playlist update failed",
      );
    }
  }),
);

playlistsRouter.post(
  "/:playlistId/tracks",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const playlist = await playlistsService.addTrackToPlaylist(
        request.session!.walletAddress,
        String(request.params.playlistId),
        request.body,
      );

      response.json({ playlist });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Add track to playlist failed",
      );
    }
  }),
);

playlistsRouter.put(
  "/:playlistId/tracks/order",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const playlist = await playlistsService.reorderPlaylistTracks(
        request.session!.walletAddress,
        String(request.params.playlistId),
        request.body,
      );

      response.json({ playlist });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Playlist reorder failed",
      );
    }
  }),
);

playlistsRouter.delete(
  "/:playlistId/tracks/:trackId",
  requireSession,
  asyncHandler(async (request, response) => {
    try {
      const playlist = await playlistsService.removeTrackFromPlaylist(
        request.session!.walletAddress,
        String(request.params.playlistId),
        String(request.params.trackId),
      );

      response.json({ playlist });
    } catch (error) {
      throw new HttpError(
        400,
        error instanceof Error ? error.message : "Remove track from playlist failed",
      );
    }
  }),
);

export { playlistsRouter };
