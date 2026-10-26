import { afterEach, expect, it, vi } from "vitest";
import type { UploadSession } from "@music-city/shared";
import { uploadsApi } from "./uploads-api";

afterEach(() => vi.unstubAllGlobals());
const session = {
  provider: "s3",
  uploadUrl: "http://localhost/upload",
  method: "PUT",
  headers: {},
  contentType: "audio/wav",
} as UploadSession;

function transport(status: number, body = "") {
  const headers: Record<string, string> = {};
  class Request {
    status = status;
    responseText = body;
    upload: {
      onprogress?: (event: {
        lengthComputable: boolean;
        loaded: number;
        total: number;
      }) => void;
    } = {};
    onload?: () => void;
    open = vi.fn();
    setRequestHeader = (name: string, value: string) => {
      headers[name] = value;
    };
    getResponseHeader = () => "etag";
    send = () => {
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 50,
        total: 100,
      });
      this.upload.onprogress?.({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      });
      this.onload?.();
    };
  }
  vi.stubGlobal("XMLHttpRequest", Request);
  return headers;
}

it("sends the canonical type and reports progress before the storage acknowledgement", async () => {
  const headers = transport(204);
  const progress = vi.fn();
  const result = await uploadsApi.uploadFile(
    "token",
    session,
    new File(["audio"], "song.wav", { type: "application/octet-stream" }),
    progress,
  );
  expect(headers["Content-Type"]).toBe("audio/wav");
  expect(result).toBe("etag");
  expect(progress.mock.calls.map(([value]) => value)).toEqual([0, 50, 99, 100]);
});

it("preserves the server's validation error", async () => {
  transport(
    400,
    JSON.stringify({
      error: "Uploaded file type does not match the upload session",
    }),
  );
  await expect(
    uploadsApi.uploadFile("token", session, new File(["bad"], "song.wav")),
  ).rejects.toThrow("Uploaded file type does not match the upload session");
});
