import { StrKey } from "@stellar/stellar-sdk";

import { env } from "../config/env.js";
import { databaseService } from "./database.service.js";

const TREASURY_SETTINGS_KEY = "treasury_wallet_settings";

const normalizeWalletAddress = (value?: string) => value?.trim() ?? "";

const getEnvTreasuryWalletAddress = () =>
  normalizeWalletAddress(env.STELLAR_TREASURY_ADDRESS);

const getStoredTreasuryWalletAddress = async () => {
  const settings = await databaseService.findSetting<{
    walletAddress?: string;
  }>(TREASURY_SETTINGS_KEY);

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

    assertValidWalletAddress(
      storedWalletAddress,
      "Stored treasury wallet address",
    );
    assertValidWalletAddress(envWalletAddress, "STELLAR_TREASURY_ADDRESS");

    if (
      storedWalletAddress &&
      envWalletAddress &&
      storedWalletAddress !== envWalletAddress
    ) {
      throw new Error(
        buildMismatchMessage(
          "Admin treasury wallet setting",
          "STELLAR_TREASURY_ADDRESS",
          envWalletAddress,
        ),
      );
    }
  },
};
