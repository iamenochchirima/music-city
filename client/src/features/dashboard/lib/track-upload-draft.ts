import { z } from "zod";
import { trackCreditRoleSchema } from "@music-city/shared";

const draftText = {
  savedAt: z.number().finite(), title: z.string(), artistName: z.string(), genre: z.string(),
  isExplicit: z.boolean(), featuredArtists: z.array(z.string()),
};
export const trackUploadDraftSchema = z.object({
  ...draftText, version: z.literal(2), stepId: z.enum(["basics", "media", "credits", "review"]),
  credits: z.array(z.object({ role: trackCreditRoleSchema, name: z.string(), artistId: z.string().optional() })),
  isrc: z.string(), recordLabel: z.string(),
});
export type StoredTrackDraft = z.infer<typeof trackUploadDraftSchema>;

// One-time data conversion. Remove this v1 conversion after the rollout's seven-day draft lifetime.
const previousDraftSchema = z.object({ ...draftText, version: z.literal(1), stepIndex: z.number().int().min(0).max(2) });
export function restoreTrackUploadDraft(input: unknown, now = Date.now()): StoredTrackDraft | null {
  let result = trackUploadDraftSchema.safeParse(input);
  if (!result.success) {
    const old = previousDraftSchema.safeParse(input);
    if (!old.success) return null;
    const { stepIndex, ...text } = old.data;
    result = trackUploadDraftSchema.safeParse({ ...text, version: 2, stepId: ["basics", "media", "review"][stepIndex], credits: [], isrc: "", recordLabel: "" });
  }
  if (!result.success || result.data.savedAt > now || now - result.data.savedAt >= 7 * 24 * 60 * 60 * 1000) return null;
  return result.data;
}
