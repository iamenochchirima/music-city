import { createHash } from "node:crypto";
import sharp from "sharp";
import { storageService } from "../../services/storage.service.js";
import { HttpError } from "../../utils/http-error.js";
import { IMAGE_VERSION, IMAGE_WIDTHS } from "./image-url.js";

const pending = new Map<string, Promise<Buffer>>();
const sourceTasks = new Map<string, Promise<Buffer>>();
const sources = new Map<string, { bytes: Buffer; expires: number }>();
const memory = new Map<string, Buffer>();
let sourceBytes = 0;
let outputBytes = 0;
let processing = 0;
const waiting: Array<() => void> = [];

function rememberOutput(key: string, bytes: Buffer) {
  if (memory.has(key)) return;
  memory.set(key, bytes); outputBytes += bytes.length;
  for (const [id, value] of memory) {
    if (outputBytes <= 32 * 1024 * 1024) break;
    memory.delete(id); outputBytes -= value.length;
  }
}
async function sourceImage(key: string) {
  const cached = sources.get(key);
  if (cached && cached.expires > Date.now()) return cached.bytes;
  if (cached) { sources.delete(key); sourceBytes -= cached.bytes.length; }
  let task = sourceTasks.get(key);
  if (!task) {
    task = storageService.readStoredObject(key).then((bytes) => {
      sources.set(key, { bytes, expires: Date.now() + 5 * 60 * 1000 });
      sourceBytes += bytes.length;
      for (const [id, value] of sources) {
        if (sourceBytes <= 64 * 1024 * 1024) break;
        sources.delete(id); sourceBytes -= value.bytes.length;
      }
      return bytes;
    }).finally(() => sourceTasks.delete(key));
    sourceTasks.set(key, task);
  }
  return task;
}
async function processImage(key: string, width: number) {
  if (processing >= 2) {
    if (waiting.length >= 40) throw new HttpError(503, "Image preparation is busy. Try again shortly.");
    await new Promise<void>((resolve) => waiting.push(resolve));
  } else processing++;
  try {
    const bytes = await sourceImage(key);
    try {
      const image = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
      const metadata = await image.metadata();
      if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) throw new Error("Unsupported image format");
      return await image.rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer();
    } catch { throw new HttpError(422, "This file cannot be processed as an image"); }
  } finally {
    const next = waiting.shift();
    if (next) next(); else processing--;
  }
}

export const imagesService = {
  async getVariant(key: string, width: number) {
    if (!(IMAGE_WIDTHS as readonly number[]).includes(width)) throw new HttpError(400, "Unsupported image size");
    const digest = createHash("sha256").update(key).digest("hex");
    const variantKey = `image-variants/${IMAGE_VERSION}/${digest}/${width}.webp`;
    const cached = memory.get(variantKey);
    if (cached) return cached;
    let task = pending.get(variantKey);
    if (!task) {
      task = (async () => {
        try {
          const existing = await storageService.readStoredObject(variantKey, 5 * 1024 * 1024);
          rememberOutput(variantKey, existing);
          return existing;
        } catch (error) {
          if (!(error instanceof HttpError && error.statusCode === 404) && (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        const bytes = await processImage(key, width);
        await storageService.putStoredObject(variantKey, bytes, "image/webp");
        rememberOutput(variantKey, bytes);
        return bytes;
      })().finally(() => pending.delete(variantKey));
      pending.set(variantKey, task);
    }
    return task;
  },
};
