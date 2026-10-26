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
          const percent = Math.max(0, Math.min(100, Math.round(event.detail)));
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

    return new Promise<string | undefined>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open(uploadSession.method, uploadSession.uploadUrl);
      for (const [name, value] of Object.entries({
        ...uploadSession.headers,
        Authorization: `Bearer ${token}`,
        "Content-Type": uploadSession.contentType,
      })) {
        request.setRequestHeader(name, value);
      }
      request.upload.onprogress = (event) => {
        if (event.lengthComputable)
          onProgress?.(
            Math.min(99, Math.round((event.loaded / event.total) * 100)),
          );
      };
      request.onerror = () =>
        reject(
          new Error("Upload interrupted. Check your connection and try again."),
        );
      request.onabort = () =>
        reject(new Error("Upload cancelled. Choose the file again to retry."));
      request.onload = () => {
        if (request.status < 200 || request.status >= 300) {
          let message = "Couldn't upload this file. Please try again.";
          try {
            const body = JSON.parse(request.responseText);
            if (typeof body.error === "string") message = body.error;
          } catch {
            /* A proxy may return a non-JSON error response. */
          }
          reject(new Error(message));
          return;
        }
        onProgress?.(100);
        resolve(request.getResponseHeader("etag") ?? undefined);
      };
      request.send(file);
    });
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
    }>(`/uploads/sessions/${uploadSessionId}/complete`, input, token);

    return response;
  },
};
