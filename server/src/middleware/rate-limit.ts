import type { Request, RequestHandler } from "express";

import { HttpError } from "../utils/http-error.js";

type RateLimitOptions = {
  bucketName: string;
  maxRequests: number;
  windowMs: number;
  key?: (request: Request) => string;
};

type BucketEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, BucketEntry>();

const defaultKey = (request: Request) =>
  request.session?.walletAddress ??
  request.adminSession?.adminId ??
  request.ip ??
  "anonymous";

export const createRateLimit = ({
  bucketName,
  maxRequests,
  windowMs,
  key = defaultKey,
}: RateLimitOptions): RequestHandler => {
  return (request, response, next) => {
    const subject = key(request);
    const bucketKey = `${bucketName}:${subject}`;
    const now = Date.now();
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(bucketKey, {
        count: 1,
        resetAt,
      });
      response.setHeader("X-RateLimit-Limit", String(maxRequests));
      response.setHeader("X-RateLimit-Remaining", String(Math.max(maxRequests - 1, 0)));
      response.setHeader("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
      next();
      return;
    }

    if (current.count >= maxRequests) {
      response.setHeader("Retry-After", String(Math.max(Math.ceil((current.resetAt - now) / 1000), 1)));
      next(new HttpError(429, "Too many analytics requests"));
      return;
    }

    current.count += 1;
    buckets.set(bucketKey, current);
    response.setHeader("X-RateLimit-Limit", String(maxRequests));
    response.setHeader(
      "X-RateLimit-Remaining",
      String(Math.max(maxRequests - current.count, 0)),
    );
    response.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
    next();
  };
};
