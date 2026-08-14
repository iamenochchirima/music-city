import type { UploadSession } from "@music-city/shared";

import { databaseService } from "../../services/database.service.js";

export const uploadsRepository = {
  async findById(id: string) {
    return databaseService.findPayloadById<UploadSession>("upload_sessions", id);
  },

  async upsert(session: UploadSession) {
    await databaseService.upsertUploadSession(
      session.id,
      session.trackId ?? null,
      session.releaseId ?? null,
      session.provider,
      session.expiresAt,
      session,
    );
    return session;
  },

  async delete(id: string) {
    await databaseService.deletePayloadById("upload_sessions", id);
  },
};
