import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const MAX_WRITES_PER_WINDOW = 30;

const buckets = new Map<string, { count: number; resetAt: number }>();

export const onboardingWriteRateLimit = (
  request: Request,
  response: Response,
  next: NextFunction,
) => {
  const key = request.session?.walletAddress ?? request.ip ?? "anonymous";
  const now = Date.now();
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_WRITES_PER_WINDOW) {
    response.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
    response.status(429).json({
      message: "Too many onboarding updates. Please try again shortly.",
    });
    return;
  }

  next();
};
