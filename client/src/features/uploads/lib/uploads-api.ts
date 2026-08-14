import type {
  CompleteUploadSessionInput,
  CreateUploadSessionInput,
  ReleaseDetail,
  TrackSummary,
  UploadSession,
} from "@music-city/shared";
import * as UpChunk from "@mux/upchunk";

import { httpClient } from "@/lib/api/http-client";

type UploadProgressCallback = (progress: number) => void;

export const uploadsApi = {
  async createSession(token: string, input: CreateUploadSessionInput) {
    const response = await httpClient.post<{ uploadSession: UploadSession }>(
      "/uploads/sessions",
      input,
      token,
    );

    return response.uploadSession;
  },

  async uploadFile(
    token: string,
    uploadSession: UploadSession,
    file: File,
    onProgress?: UploadProgressCallback,
  ) {
    if (uploadSession.provider === "mux") {
      await new Promise<void>((resolve, reject) => {
        const upload = UpChunk.createUpload({
          endpoint: uploadSession.uploadUrl,
          file,
          chunkSize: 5120,
          dynamicChunkSize: true,
        });

        upload.on("progress", (event) => {
          const percent = Math.max(
            0,
            Math.min(100, Math.round(event.detail)),
          );
          onProgress?.(percent);
        });

        upload.on("error", (error) => {
          reject(error.detail ?? new Error("Mux upload failed"));
        });

        upload.on("success", () => {
          onProgress?.(100);
          resolve();
        });
      });

      return undefined;
    }

    onProgress?.(0);

    // Upload through the API relay. The direct S3-compatible URL points at
    // Backblaze and requires a bucket CORS preflight from every web origin.
    // The relay keeps storage-provider CORS out of the browser path while
    // preserving the same presigned upload on the server.
    const response = await fetch(uploadSession.uploadUrl, {
      method: uploadSession.method,
      headers: {
        ...uploadSession.headers,
        Authorization: `Bearer ${token}`,
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error("File upload failed");
    }

    onProgress?.(100);
    return response.headers.get("etag") ?? undefined;
  },

  async cancelSession(token: string, uploadSessionId: string) {
    await httpClient.delete(`/uploads/sessions/${uploadSessionId}`, token);
  },

  async completeSession(
    token: string,
    uploadSessionId: string,
    input: CompleteUploadSessionInput,
  ) {
    const response = await httpClient.post<{
      track?: TrackSummary;
      release?: ReleaseDetail;
    }>(
      `/uploads/sessions/${uploadSessionId}/complete`,
      input,
      token,
    );

    return response;
  },
};
