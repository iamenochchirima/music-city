import { Router } from "express";

import { dynamicSessionRequestSchema } from "@music-city/shared";

import { asyncHandler } from "../../utils/async-handler.js";
import { dynamicAuthService } from "../../services/dynamic-auth.service.js";
import { tokenService } from "../../services/token.service.js";
import { stellarAuthService } from "../../services/stellar-auth.service.js";

const authRouter = Router();

authRouter.get(
  "/challenge",
  asyncHandler(async (request, response) => {
    const account = String(request.query.account ?? "");
    const challenge = stellarAuthService.createChallenge(account);

    response.json(challenge);
  }),
);

authRouter.post(
  "/dynamic/session",
  asyncHandler(async (request, response) => {
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      response.status(401).json({ message: "Missing Dynamic auth token" });
      return;
    }

    const payload = dynamicSessionRequestSchema.parse(request.body ?? {});
    const session = await dynamicAuthService.createSession(
      token,
      payload.walletAddress,
    );
    const issuedToken = tokenService.issueSession(session);

    response.json({
      session: {
        ...session,
        token: issuedToken,
      },
    });
  }),
);

authRouter.post(
  "/verify",
  asyncHandler(async (request, response) => {
    const session = await stellarAuthService.verifyChallenge(
      request.body.transaction,
    );
    const token = tokenService.issueSession(session);

    response.json({
      session: {
        ...session,
        token,
      },
    });
  }),
);

export { authRouter };
