import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";

export const IMAGE_WIDTHS = [96, 192, 384, 768, 1200, 1600] as const;
export const IMAGE_VERSION = "v1";

const validKey = (key: string) => key.length <= 1024 && /\.(png|jpe?g|webp)$/i.test(key) &&
  !key.startsWith("/") && !key.startsWith("masters/") && !key.startsWith("image-variants/") &&
  !/[\\\0%]/.test(key) && !key.split("/").some((part) => !part || part === "." || part === "..");
const signature = (key: string) => createHmac("sha256", env.PLAYBACK_TOKEN_SECRET)
  .update(`image:${IMAGE_VERSION}:${key}`).digest("hex").slice(0, 32);

export function imageToken(key: string) {
  if (!validKey(key)) throw new HttpError(400, "Invalid image key");
  return `${Buffer.from(key).toString("base64url")}.${signature(key)}`;
}
export function imageKey(token: string) {
  const match = /^([A-Za-z0-9_-]{1,1400})\.([a-f0-9]{32})$/.exec(token);
  if (!match) throw new HttpError(404, "Image not found");
  const key = Buffer.from(match[1], "base64url").toString("utf8");
  if (!validKey(key) || Buffer.from(key).toString("base64url") !== match[1] ||
    !timingSafeEqual(Buffer.from(match[2]), Buffer.from(signature(key)))) throw new HttpError(404, "Image not found");
  return key;
}
export const storedImageUrl = (key: string, width = 768) =>
  `${env.CLIENT_ORIGIN.replace(/\/$/, "")}/media/images/${IMAGE_VERSION}/${imageToken(key)}/${width}.webp`;
