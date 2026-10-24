import { createHash } from "node:crypto";
import { Router } from "express";
import { asyncHandler } from "../../utils/async-handler.js";
import { imageKey } from "./image-url.js";
import { imagesService } from "./images.service.js";

export const imagesRouter = Router();
imagesRouter.use((_request, response, next) => { response.set("Cache-Control", "no-store"); next(); });
imagesRouter.get("/v1/:token/:width.webp", asyncHandler(async (request, response) => {
  const key = imageKey(String(request.params.token));
  const bytes = await imagesService.getVariant(key, Number(request.params.width));
  const etag = `"${createHash("sha256").update(bytes).digest("hex")}"`;
  response.set({
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=31536000, immutable",
    "CDN-Cache-Control": "public, max-age=31536000",
    "Vercel-CDN-Cache-Control": "public, max-age=31536000",
    "Vercel-Cache-Tag": `image-${createHash("sha256").update(key).digest("hex")}`,
    "Cross-Origin-Resource-Policy": "cross-origin",
    "ETag": etag,
  });
  if (request.headers["if-none-match"] === etag) { response.status(304).end(); return; }
  response.set("Content-Length", String(bytes.length));
  response.end(bytes);
}));
