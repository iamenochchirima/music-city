import { Keypair, StrKey } from "@stellar/stellar-sdk";

import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import { databaseService } from "./database.service.js";

const TREASURY_SETTINGS_KEY = "treasury_wallet_settings";

const normalizeWalletAddress = (value?: string) => value?.trim() ?? "";

const getEnvTreasuryWalletAddress = () =>
  normalizeWalletAddress(env.STELLAR_TREASURY_ADDRESS);

const getSecretTreasuryWalletAddress = () => {
  if (!env.STELLAR_TREASURY_SECRET) {
    return "";
  }

  return Keypair.fromSecret(env.STELLAR_TREASURY_SECRET).publicKey();
};

const getStoredTreasuryWalletAddress = async () => {
  const settings = await databaseService.findSetting<{ walletAddress?: string }>(
    TREASURY_SETTINGS_KEY,
  );

  return normalizeWalletAddress(settings?.walletAddress);
};

const assertValidWalletAddress = (walletAddress: string, label: string) => {
  if (walletAddress && !StrKey.isValidEd25519PublicKey(walletAddress)) {
    throw new Error(`${label} is not a valid Stellar public key`);
  }
};

const buildMismatchMessage = (
  leftLabel: string,
  rightLabel: string,
  walletAddress: string,
) =>
  `${leftLabel} does not match ${rightLabel}. Configure a single treasury wallet before continuing. Expected ${walletAddress}.`;

export const treasuryConfigService = {
  async getConfiguredWalletAddress() {
    const storedWalletAddress = await getStoredTreasuryWalletAddress();
    const envWalletAddress = getEnvTreasuryWalletAddress();
    return storedWalletAddress || envWalletAddress;
  },

  async ensureConsistency() {
    const storedWalletAddress = await getStoredTreasuryWalletAddress();
    const envWalletAddress = getEnvTreasuryWalletAddress();
    const secretWalletAddress = getSecretTreasuryWalletAddress();
    const effectiveWalletAddress = storedWalletAddress || envWalletAddress;

    assertValidWalletAddress(storedWalletAddress, "Stored treasury wallet address");
    assertValidWalletAddress(envWalletAddress, "STELLAR_TREASURY_ADDRESS");
    assertValidWalletAddress(secretWalletAddress, "STELLAR_TREASURY_SECRET public key");

    if (storedWalletAddress && envWalletAddress && storedWalletAddress !== envWalletAddress) {
      throw new Error(
        buildMismatchMessage(
          "Admin treasury wallet setting",
          "STELLAR_TREASURY_ADDRESS",
          envWalletAddress,
        ),
      );
    }

    if (secretWalletAddress && !effectiveWalletAddress) {
      throw new Error(
        "STELLAR_TREASURY_SECRET is configured but no treasury wallet address is configured.",
      );
    }

    if (envWalletAddress && secretWalletAddress && envWalletAddress !== secretWalletAddress) {
      throw new Error(
        buildMismatchMessage(
          "STELLAR_TREASURY_SECRET public key",
          "STELLAR_TREASURY_ADDRESS",
          envWalletAddress,
        ),
      );
    }

    if (
      storedWalletAddress &&
      secretWalletAddress &&
      storedWalletAddress !== secretWalletAddress
    ) {
      throw new Error(
        buildMismatchMessage(
          "STELLAR_TREASURY_SECRET public key",
          "the admin treasury wallet setting",
          secretWalletAddress,
        ),
      );
    }
  },

  async assertWalletAddressCanBeConfigured(walletAddress: string) {
    const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
    const envWalletAddress = getEnvTreasuryWalletAddress();
    const secretWalletAddress = getSecretTreasuryWalletAddress();

    if (!normalizedWalletAddress) {
      if (envWalletAddress || secretWalletAddress) {
        throw new HttpError(
          409,
          "Treasury wallet cannot be cleared while STELLAR_TREASURY_ADDRESS or STELLAR_TREASURY_SECRET is configured.",
        );
      }

      return;
    }

    if (envWalletAddress && normalizedWalletAddress !== envWalletAddress) {
      throw new HttpError(
        409,
        buildMismatchMessage(
          "Admin treasury wallet setting",
          "STELLAR_TREASURY_ADDRESS",
          envWalletAddress,
        ),
      );
    }

    if (secretWalletAddress && normalizedWalletAddress !== secretWalletAddress) {
      throw new HttpError(
        409,
        buildMismatchMessage(
          "Admin treasury wallet setting",
          "STELLAR_TREASURY_SECRET public key",
          secretWalletAddress,
        ),
      );
    }
  },
};
