import { profileCompletionSchema, verifyChallengeSchema } from "@music-city/shared";
import { randomBytes } from "node:crypto";
import {
  Keypair,
  StrKey,
  TransactionBuilder,
  BASE_FEE,
  Networks,
  Operation,
  Account,
} from "@stellar/stellar-sdk";

import { env } from "../config/env.js";
import { usersService } from "../modules/users/users.service.js";
import { HttpError } from "../utils/http-error.js";

const nonceForAccount = (account: string) => {
  const nonce = randomBytes(24).toString("base64url");
  return `${account.slice(0, 8)}:${nonce}`;
};

export const stellarAuthService = {
  createChallenge(account: string) {
    if (!StrKey.isValidEd25519PublicKey(account)) {
      throw new HttpError(400, "Invalid Stellar account");
    }

    if (!env.STELLAR_SEP10_SECRET) {
      throw new HttpError(
        501,
        "SEP-10 signing key is not configured on the server",
      );
    }

    const signer = Keypair.fromSecret(env.STELLAR_SEP10_SECRET);
    const source = new Account(signer.publicKey(), "-1");
    const challenge = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE || Networks.TESTNET,
      timebounds: {
        minTime: 0,
        maxTime: Math.floor(Date.now() / 1000) + 300,
      },
    })
      .addOperation(
        Operation.manageData({
          name: `${env.STELLAR_HOME_DOMAIN} auth`,
          value: nonceForAccount(account),
          source: account,
        }),
      )
      .build();

    challenge.sign(signer);

    return {
      transaction: challenge.toXDR(),
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    };
  },

  async verifyChallenge(transaction: string) {
    const parsed = verifyChallengeSchema.parse({ transaction });

    if (!env.STELLAR_SEP10_SECRET) {
      throw new HttpError(
        501,
        "SEP-10 signing key is not configured on the server",
      );
    }

    const signer = Keypair.fromSecret(env.STELLAR_SEP10_SECRET);
    const tx = TransactionBuilder.fromXDR(
      parsed.transaction,
      env.STELLAR_NETWORK_PASSPHRASE,
    );

    const operation = tx.operations[0];
    const source = operation.source;

    if (!source || !StrKey.isValidEd25519PublicKey(source)) {
      throw new HttpError(400, "Signed challenge is missing a valid source");
    }

    const signedByServer = tx.signatures.some((signature) => {
      try {
        return signer.verify(tx.hash(), signature.signature());
      } catch {
        return false;
      }
    });

    if (!signedByServer) {
      throw new HttpError(401, "Challenge was not signed by the server");
    }

    const accountKeypair = Keypair.fromPublicKey(source);
    const signedByUser = tx.signatures.some((signature) => {
      try {
        return accountKeypair.verify(tx.hash(), signature.signature());
      } catch {
        return false;
      }
    });

    if (!signedByUser) {
      throw new HttpError(401, "Challenge was not signed by the wallet owner");
    }

    const profile = await usersService.getProfile(source);

    return {
      walletAddress: source,
      email: profile?.email ?? "",
      displayName: profile?.displayName ?? "",
      primaryIntent: profile?.primaryIntent ?? "listener",
      artistAccess: profile?.artistAccess ?? false,
      onboardingStatus: profile?.onboardingStatus ?? "required",
      onboardingStep: profile?.onboardingStep ?? "identity",
      onboardingVersion: profile?.onboardingVersion ?? 1,
      onboardingCompletedAt: profile?.onboardingCompletedAt,
      profileCompletion: profile
        ? (await usersService.getOnboardingState(source))!.profileCompletion
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
  },
};
