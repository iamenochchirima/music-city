import { createHash, createHmac } from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { UploadSession } from "@music-city/shared";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const encodeRfc3986 = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );

const sha256Hex = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");

const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value, "utf8").digest();

const getSigningKey = (date: string, region: string, service: string) => {
  const kDate = hmac(`AWS4${env.STORAGE_SECRET_ACCESS_KEY ?? ""}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
};

const ensureParent = (filePath: string) => {
  mkdirSync(dirname(filePath), { recursive: true });
};

const localMediaPath = (storageKey: string) => join(process.cwd(), env.LOCAL_MEDIA_ROOT, storageKey);

const inferMimeType = (fileName: string) => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
};

const s3EndpointUrl = () => {
  if (!env.STORAGE_ENDPOINT) {
    throw new HttpError(500, "STORAGE_ENDPOINT is required for S3 storage");
  }

  return env.STORAGE_ENDPOINT.replace(/\/$/, "");
};

const buildS3PresignedUrl = ({
  method,
  storageKey,
  expiresInSeconds,
}: {
  method: "PUT" | "GET" | "DELETE";
  storageKey: string;
  expiresInSeconds: number;
}) => {
  if (
    !env.STORAGE_ACCESS_KEY_ID ||
    !env.STORAGE_SECRET_ACCESS_KEY ||
    !env.STORAGE_ENDPOINT
  ) {
    throw new HttpError(
      500,
      "S3-compatible storage credentials are not fully configured",
    );
  }

  const endpoint = new URL(s3EndpointUrl());
  const requestHost = env.STORAGE_PATH_STYLE
    ? endpoint.host
    : `${env.STORAGE_BUCKET}.${endpoint.host}`;
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const shortDate = amzDate.slice(0, 8);
  const credentialScope = `${shortDate}/${env.STORAGE_REGION}/s3/aws4_request`;
  const objectPath = env.STORAGE_PATH_STYLE
    ? `/${env.STORAGE_BUCKET}/${storageKey}`
    : `/${storageKey}`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${env.STORAGE_ACCESS_KEY_ID}/${credentialScope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresInSeconds),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalRequest = [
    method,
    objectPath,
    query.toString(),
    `host:${requestHost}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = createHmac(
    "sha256",
    getSigningKey(shortDate, env.STORAGE_REGION, "s3"),
  )
    .update(stringToSign, "utf8")
    .digest("hex");

  query.set("X-Amz-Signature", signature);

  const origin = env.STORAGE_PATH_STYLE
    ? endpoint.origin
    : `${endpoint.protocol}//${requestHost}`;
  const finalPath = env.STORAGE_PATH_STYLE ? objectPath : `/${storageKey}`;

  return `${origin}${finalPath}?${query.toString()}`;
};

export const storageService = {
  createUploadTarget(storageKey: string): Pick<
    UploadSession,
    "uploadUrl" | "method" | "headers" | "provider"
  > {
    if (env.STORAGE_PROVIDER === "local") {
      return {
        uploadUrl: `${env.APP_BASE_URL}/api/v1/uploads/content/${encodeURIComponent(
          storageKey,
        )}`,
        method: "PUT",
        headers: {},
        provider: "local",
      };
    }

    return {
      uploadUrl: buildS3PresignedUrl({
        method: "PUT",
        storageKey,
        expiresInSeconds: 900,
      }),
      method: "PUT",
      headers: {},
      provider: "s3",
    };
  },

  async uploadRemoteObject(
    uploadUrl: string,
    method: "PUT",
    body: Buffer,
    headers?: Record<string, string>,
  ) {
    const response = await fetch(uploadUrl, {
      method,
      headers,
      body,
    });

    if (!response.ok) {
      throw new HttpError(
        400,
        `Remote storage upload failed with status ${response.status}`,
      );
    }

    return {
      eTag: response.headers.get("etag") ?? undefined,
    };
  },

  async deleteObject(storageKey: string) {
    if (env.STORAGE_PROVIDER === "local") {
      const filePath = localMediaPath(storageKey);

      if (existsSync(filePath)) {
        rmSync(filePath, { force: true });
      }

      return;
    }

    const uploadUrl = buildS3PresignedUrl({
      method: "DELETE",
      storageKey,
      expiresInSeconds: 300,
    });

    const response = await fetch(uploadUrl, {
      method: "DELETE",
    });

    if (!response.ok && response.status !== 404) {
      throw new HttpError(
        400,
        `Remote storage delete failed with status ${response.status}`,
      );
    }
  },

  async saveLocalObject(storageKey: string, body: NodeJS.ReadableStream) {
    const filePath = localMediaPath(storageKey);
    ensureParent(filePath);

    await new Promise<void>((resolve, reject) => {
      const stream = createWriteStream(filePath);
      body.pipe(stream);
      body.on("error", reject);
      stream.on("error", reject);
      stream.on("finish", () => resolve());
    });

    return filePath;
  },

  localObjectExists(storageKey: string) {
    return existsSync(localMediaPath(storageKey));
  },

  async getObjectMetadata(storageKey: string, fallbackFileName?: string) {
    const filePath = localMediaPath(storageKey);
    const stats = await stat(filePath);

    return {
      sizeBytes: stats.size,
      contentType: inferMimeType(fallbackFileName ?? filePath),
      filePath,
    };
  },

  createReadStream(storageKey: string, start?: number, end?: number) {
    return createReadStream(localMediaPath(storageKey), {
      start,
      end,
    });
  },

  readObject(storageKey: string) {
    return readFileSync(localMediaPath(storageKey));
  },

  getLocalPath(storageKey: string) {
    return localMediaPath(storageKey);
  },

  getDownloadUrl(storageKey: string, provider = env.STORAGE_PROVIDER) {
    if (provider === "local") {
      return `${env.APP_BASE_URL}/api/v1/uploads/content/${encodeURIComponent(
        storageKey,
      )}`;
    }

    return buildS3PresignedUrl({
      method: "GET",
      storageKey,
      expiresInSeconds: 300,
    });
  },
};
