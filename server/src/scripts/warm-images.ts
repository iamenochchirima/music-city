import { databaseService } from "../services/database.service.js";
import { imagesService } from "../modules/images/images.service.js";
import { IMAGE_WIDTHS, imageToken } from "../modules/images/image-url.js";

const keys = new Set<string>();
function collect(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [field, item] of Object.entries(value)) {
    if (["coverStorageKey", "profileImageStorageKey", "headerImageStorageKey"].includes(field) && typeof item === "string") {
      imageToken(item);
      keys.add(item);
    } else if (item && typeof item === "object") collect(item);
  }
}
try {
  for (const table of ["tracks", "releases", "users"] as const) {
    for (const row of await databaseService.listPayloads<unknown>(table)) collect(row);
  }
  let variants = 0;
  let bytes = 0;
  const failures: string[] = [];
  for (const [index, key] of [...keys].entries()) {
    try {
      for (const width of IMAGE_WIDTHS) { bytes += (await imagesService.getVariant(key, width)).length; variants++; }
      console.log(JSON.stringify({ image: index + 1, total: keys.size, ok: true }));
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Image preparation failed";
      failures.push(reason);
      console.log(JSON.stringify({ image: index + 1, total: keys.size, ok: false, reason }));
    }
  }
  console.log(JSON.stringify({ images: keys.size, variants, bytes, failures: failures.length }));
  if (failures.length) process.exitCode = 1;
} finally { await databaseService.close(); }
