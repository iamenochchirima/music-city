import { Router } from "express";

import { asyncHandler } from "../../utils/async-handler.js";
import { tokenService } from "../../services/token.service.js";
import { stellarAuthService } from "../../services/stellar-auth.service.js";

const authRouter = Router();

authRouter.get(
  "/challenge",
  asyncHandler(async (request, response) => {
    const account = String(request.query.account ?? "");
    const challenge = await stellarAuthService.createChallenge(account);

    response.json(challenge);
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
