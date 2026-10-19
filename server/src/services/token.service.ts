import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

import {
  adminSessionSchema,
  authSessionSchema,
  type AdminSession,
  type AuthSession,
} from "@music-city/shared";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

export const tokenService = {
  createGuestIdentity() {
    const guestId = randomUUID();
    return {
      guestId,
      token: jwt.sign({ guestId, purpose: "guest-playback" }, env.PLAYBACK_TOKEN_SECRET, { expiresIn: "30d" }),
    };
  },

  verifyGuestIdentity(token: string) {
    try {
      const decoded = jwt.verify(token, env.PLAYBACK_TOKEN_SECRET) as { guestId?: string; purpose?: string };
      if (decoded.purpose !== "guest-playback" || typeof decoded.guestId !== "string") {
        throw new Error("Invalid guest identity");
      }
      return decoded.guestId;
    } catch {
      throw new HttpError(401, "Invalid or expired guest identity");
    }
  },

  issueSession(session: Omit<AuthSession, "token">) {
    return jwt.sign(session, env.JWT_SECRET, { expiresIn: "1d" });
  },

  verifySession(token: string) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      return authSessionSchema.parse(decoded);
    } catch {
      throw new HttpError(401, "Invalid or expired session");
    }
  },

  issueAdminSession(session: Omit<AdminSession, "token">) {
    return jwt.sign(session, env.ADMIN_JWT_SECRET, { expiresIn: "12h" });
  },

  verifyAdminSession(token: string) {
    try {
      const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);
      return adminSessionSchema.parse(decoded);
    } catch {
      throw new HttpError(401, "Invalid or expired admin session");
    }
  },

  issuePlaybackToken(payload: { playbackSessionId: string; trackId: string; guestIdHash?: string }) {
    return jwt.sign(payload, env.PLAYBACK_TOKEN_SECRET, { expiresIn: "24h" });
  },

  verifyPlaybackToken(token: string) {
    try {
      return jwt.verify(token, env.PLAYBACK_TOKEN_SECRET) as {
        playbackSessionId: string;
        trackId: string;
        guestIdHash?: string;
      };
    } catch {
      throw new HttpError(401, "Invalid or expired playback token");
    }
  },
};
