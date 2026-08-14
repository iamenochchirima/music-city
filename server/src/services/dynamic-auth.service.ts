import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { profileCompletionSchema, type AuthSession } from "@music-city/shared";

import { env } from "../config/env.js";
import { usersService } from "../modules/users/users.service.js";
import { HttpError } from "../utils/http-error.js";

type DynamicVerifiedCredential = {
  address?: string;
  chain?: string;
  publicIdentifier?: string;
  public_identifier?: string;
  email?: string;
  walletName?: string;
  wallet_name?: string;
  signInEnabled?: boolean;
  sign_in_enabled?: boolean;
};

type DynamicJwtPayload = JWTPayload & {
  alias?: string;
  email?: string;
  environmentId?: string;
  environment_id?: string;
  scope?: string;
  verifiedCredentials?: DynamicVerifiedCredential[];
  verified_credentials?: DynamicVerifiedCredential[];
};

const DYNAMIC_TOKEN_SCOPE = "user:basic";

const logDynamicAuth = (_label: string, _payload?: Record<string, unknown>) => {};

const getJwksUrl = () => {
  if (env.DYNAMIC_JWKS_URL) {
    return env.DYNAMIC_JWKS_URL;
  }

  if (!env.DYNAMIC_ENVIRONMENT_ID) {
    throw new HttpError(501, "Dynamic environment is not configured");
  }

  return `https://app.dynamic.xyz/api/v0/sdk/${env.DYNAMIC_ENVIRONMENT_ID}/.well-known/jwks`;
};

const getExpectedIssuer = () => {
  if (!env.DYNAMIC_ENVIRONMENT_ID) {
    throw new HttpError(501, "Dynamic environment is not configured");
  }

  return [
    `app.dynamic.xyz/${env.DYNAMIC_ENVIRONMENT_ID}`,
    `https://app.dynamic.xyz/${env.DYNAMIC_ENVIRONMENT_ID}`,
    `app.dynamicauth.com/${env.DYNAMIC_ENVIRONMENT_ID}`,
    `https://app.dynamicauth.com/${env.DYNAMIC_ENVIRONMENT_ID}`,
  ];
};

const normalizeCredentialAddress = (credential: DynamicVerifiedCredential) =>
  credential.address ??
  credential.public_identifier ??
  credential.publicIdentifier ??
  "";

const isStellarCredential = (credential: DynamicVerifiedCredential) =>
  credential.chain?.toLowerCase().includes("stellar") &&
  normalizeCredentialAddress(credential).length > 0;

const findStellarWalletAddress = (
  payload: DynamicJwtPayload,
  requestedWalletAddress?: string,
) => {
  const credentials =
    payload.verified_credentials ?? payload.verifiedCredentials ?? [];
  const stellarCredentials = credentials.filter(isStellarCredential);
  const stellarAddresses = stellarCredentials.map(normalizeCredentialAddress);

  if (requestedWalletAddress) {
    const exactMatch = stellarCredentials.find(
      (credential) =>
        normalizeCredentialAddress(credential).toLowerCase() ===
        requestedWalletAddress.toLowerCase(),
    );

    if (!exactMatch) {
      throw new HttpError(
        403,
        `Requested Stellar wallet is not linked to this Dynamic user. Token Stellar addresses: ${
          stellarAddresses.length > 0 ? stellarAddresses.join(", ") : "none"
        }`,
      );
    }

    return normalizeCredentialAddress(exactMatch);
  }

  const primary = stellarAddresses[0];

  if (!primary) {
    throw new HttpError(403, "No Stellar wallet is linked to this account");
  }

  return primary;
};

const buildDisplayName = (
  _payload: DynamicJwtPayload,
  _walletAddress: string,
  existingDisplayName?: string,
) => {
  // A login identity is not a product display name. Leave this blank until
  // the user chooses one during onboarding instead of leaking their email.
  return existingDisplayName ?? "";
};

export const dynamicAuthService = {
  async createSession(dynamicToken: string, requestedWalletAddress?: string) {
    if (!env.DYNAMIC_ENVIRONMENT_ID) {
      throw new HttpError(501, "Dynamic environment is not configured");
    }

    logDynamicAuth("create session start", {
      environmentId: env.DYNAMIC_ENVIRONMENT_ID,
      jwksUrl: getJwksUrl(),
      requestedWalletAddress,
      tokenPreview: `${dynamicToken.slice(0, 10)}...${dynamicToken.slice(-6)} (${dynamicToken.length})`,
    });

    let payload: DynamicJwtPayload;

    try {
      const jwks = createRemoteJWKSet(new URL(getJwksUrl()));
      const verified = await jwtVerify(dynamicToken, jwks, {
        issuer: getExpectedIssuer(),
      });

      payload = verified.payload as DynamicJwtPayload;
      logDynamicAuth("token verified", {
        issuer: payload.iss,
        subject: payload.sub,
        audience: payload.aud,
        scope: payload.scope,
        environmentId: payload.environment_id ?? payload.environmentId,
        email: payload.email,
        alias: payload.alias,
        verifiedCredentialCount:
          (payload.verified_credentials ?? payload.verifiedCredentials ?? []).length,
        verifiedCredentials: (
          payload.verified_credentials ??
          payload.verifiedCredentials ??
          []
        ).map((credential) => ({
          chain: credential.chain ?? null,
          hasAddress: Boolean(normalizeCredentialAddress(credential)),
          addressPrefix: normalizeCredentialAddress(credential).slice(0, 8) || null,
          email: credential.email ?? null,
          walletName: credential.wallet_name ?? credential.walletName ?? null,
        })),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown verification failure";
      logDynamicAuth("token verification failed", { detail });
      throw new HttpError(
        401,
        `Invalid or expired Dynamic auth token: ${detail}`,
      );
    }

    const payloadEnvironmentId =
      payload.environment_id ?? payload.environmentId;

    if (payloadEnvironmentId !== env.DYNAMIC_ENVIRONMENT_ID) {
      logDynamicAuth("environment mismatch", {
        payloadEnvironmentId,
        expectedEnvironmentId: env.DYNAMIC_ENVIRONMENT_ID,
      });
      throw new HttpError(401, "Dynamic auth token is for a different environment");
    }

    if (!payload.scope?.split(" ").includes(DYNAMIC_TOKEN_SCOPE)) {
      logDynamicAuth("scope missing", {
        scope: payload.scope,
        requiredScope: DYNAMIC_TOKEN_SCOPE,
      });
      throw new HttpError(
        403,
        "Dynamic auth token is missing the user:basic scope required for a completed login",
      );
    }

    const walletAddress = findStellarWalletAddress(payload, requestedWalletAddress);
    logDynamicAuth("wallet resolved", {
      walletAddress,
      requestedWalletAddress,
    });
    const profile = await usersService.getProfile(walletAddress);

    const session: Omit<AuthSession, "token"> = {
      walletAddress,
      email: profile?.email ?? payload.email ?? "",
      displayName: buildDisplayName(payload, walletAddress, profile?.displayName),
      primaryIntent: profile?.primaryIntent ?? "listener",
      artistAccess: profile?.artistAccess ?? false,
      onboardingStatus: profile?.onboardingStatus ?? "required",
      onboardingStep: profile?.onboardingStep ?? "identity",
      onboardingVersion: profile?.onboardingVersion ?? 1,
      onboardingCompletedAt: profile?.onboardingCompletedAt,
      profileCompletion: profile
        ? (await usersService.getOnboardingState(walletAddress))!.profileCompletion
        : profileCompletionSchema.parse({
            percentage: 0,
            completed: [],
            missing: [
              "display_name",
              "email",
              "location",
              "genres",
              "favorites",
              "local_music",
              "notification_preferences",
              "profile_image",
            ],
            requiredComplete: false,
          }),
    };

    logDynamicAuth("session payload built", {
      walletAddress: session.walletAddress,
      displayName: session.displayName,
      primaryIntent: session.primaryIntent,
      onboardingStatus: session.onboardingStatus,
    });

    return session;
  },
};
