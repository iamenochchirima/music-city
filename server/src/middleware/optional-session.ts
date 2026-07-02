import type { NextFunction, Request, Response } from "express";

import { tokenService } from "../services/token.service.js";

const readBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
};

export const optionalSession = (
  request: Request,
  _response: Response,
  next: NextFunction,
) => {
  const token = readBearerToken(request.headers.authorization);

  if (!token) {
    next();
    return;
  }

  try {
    request.session = tokenService.verifySession(token);
  } catch {
    request.session = undefined;
  }

  next();
};
