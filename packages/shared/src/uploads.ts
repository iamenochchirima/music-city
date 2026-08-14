import { z } from "zod";

export const createUploadSessionSchema = z
  .object({
    trackId: z.string().min(1).optional(),
    releaseId: z.string().min(1).optional(),
    purpose: z.enum(["audio", "cover"]).default("audio"),
    fileName: z.string().min(1).max(180),
    contentType: z.string().min(1).max(120),
    sizeBytes: z.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (!value.trackId && !value.releaseId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Either trackId or releaseId is required",
      });
    }

    if (value.trackId && value.releaseId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either trackId or releaseId, not both",
      });
    }

    if (value.purpose === "audio" && !value.trackId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackId"],
        message: "Audio uploads require a trackId",
      });
    }

    if (value.purpose === "audio" && !value.contentType.startsWith("audio/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentType"],
        message: "Audio uploads must use an audio file type",
      });
    }

    const maxSizeBytes =
      value.purpose === "audio" ? 500 * 1024 * 1024 : 10 * 1024 * 1024;

    if (value.sizeBytes > maxSizeBytes) {
      context.addIssue({
        code: z.ZodIssueCode.too_big,
        path: ["sizeBytes"],
        maximum: maxSizeBytes,
        type: "number",
        inclusive: true,
        message:
          value.purpose === "audio"
            ? "Audio files must be 500 MB or smaller"
            : "Images must be 10 MB or smaller",
      });
    }

    if (value.purpose === "cover" && !value.contentType.startsWith("image/")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentType"],
        message: "Cover uploads must use an image content type",
      });
    }
  });
export type CreateUploadSessionInput = z.infer<typeof createUploadSessionSchema>;

export interface UploadSession {
  id: string;
  trackId?: string;
  releaseId?: string;
  purpose: "audio" | "cover";
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey?: string;
  remoteUploadId?: string;
  directUploadUrl?: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  provider: "local" | "s3" | "mux";
  expiresAt: string;
}

export const completeUploadSessionSchema = z.object({
  uploadSessionId: z.string().min(1),
  eTag: z.string().optional(),
});
export type CompleteUploadSessionInput = z.infer<
  typeof completeUploadSessionSchema
>;
