import {
  Account,
  Asset,
  BASE_FEE,
  Keypair,
  Operation,
  StrKey,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { env } from "../../config/env.js";
import { databaseService } from "../../services/database.service.js";
import { walletService } from "../wallet/wallet.service.js";
import { HttpError } from "../../utils/http-error.js";

const TREASURY_SETTINGS_KEY = "treasury_wallet_settings";
const DECIMAL_SCALE = 10_000_000n;

const toBaseUnits = (amount: string) => {
  const [whole, fraction = ""] = amount.split(".");
  const paddedFraction = `${fraction}0000000`.slice(0, 7);
  return BigInt(whole || "0") * DECIMAL_SCALE + BigInt(paddedFraction || "0");
};

const fromBaseUnits = (value: bigint) => {
  const whole = value / DECIMAL_SCALE;
  const fraction = (value % DECIMAL_SCALE).toString().padStart(7, "0");
  return `${whole.toString()}.${fraction}`;
};

const buildAsset = (assetCode?: string, assetIssuer?: string) => {
  if (!assetCode || assetCode.toUpperCase() === "XLM") {
    return Asset.native();
  }

  if (!assetIssuer) {
    throw new HttpError(400, `Asset issuer is required for ${assetCode} payouts`);
  }

  return new Asset(assetCode, assetIssuer);
};

const toBalanceKey = (assetCode?: string, assetIssuer?: string) =>
  !assetCode || assetCode.toUpperCase() === "XLM"
    ? "native"
    : `${assetCode}:${assetIssuer ?? ""}`;

const getTreasuryWalletAddress = async () => {
  const settings = await databaseService.findSetting<{ walletAddress?: string }>(
    TREASURY_SETTINGS_KEY,
  );
  const walletAddress = settings?.walletAddress?.trim() || env.STELLAR_TREASURY_ADDRESS?.trim();

  if (!walletAddress) {
    throw new HttpError(500, "Stellar treasury wallet is not configured");
  }

  return walletAddress;
};

const getTreasuryKeypair = async () => {
  if (!env.STELLAR_TREASURY_SECRET) {
    throw new HttpError(
      501,
      "STELLAR_TREASURY_SECRET is not configured for automatic payouts",
    );
  }

  const keypair = Keypair.fromSecret(env.STELLAR_TREASURY_SECRET);
  const configuredAddress = await getTreasuryWalletAddress();

  if (keypair.publicKey() !== configuredAddress) {
    throw new HttpError(
      500,
      "STELLAR_TREASURY_SECRET does not match the configured treasury wallet",
    );
  }

  return keypair;
};

export const stellarPayoutService = {
  async getTreasuryWalletAddress() {
    return getTreasuryWalletAddress();
  },

  async getTreasuryWalletAccount(walletAddress?: string) {
    return walletService.getWalletAccount(walletAddress ?? (await getTreasuryWalletAddress()));
  },

  async submitPayment(input: {
    recipientWalletAddress: string;
    amount: string;
    assetCode?: string;
    assetIssuer?: string;
    memoText?: string;
  }) {
    if (!StrKey.isValidEd25519PublicKey(input.recipientWalletAddress)) {
      throw new HttpError(400, "Recipient wallet is not a valid Stellar address");
    }

    const treasuryKeypair = await getTreasuryKeypair();
    const treasuryAddress = treasuryKeypair.publicKey();
    const treasuryAccount = await walletService.getWalletAccount(treasuryAddress);

    if (!treasuryAccount.exists || !treasuryAccount.sequence) {
      throw new HttpError(500, "Treasury wallet account could not be loaded from Horizon");
    }

    const assetKey = toBalanceKey(input.assetCode, input.assetIssuer);
    const matchingBalance = treasuryAccount.balances.find(
      (balance) => balance.assetKey === assetKey,
    );

    if (!matchingBalance) {
      throw new HttpError(400, `Treasury wallet does not hold payout asset ${assetKey}`);
    }

    if (toBaseUnits(matchingBalance.availableAmount) < toBaseUnits(input.amount)) {
      throw new HttpError(400, `Treasury wallet has insufficient available balance for ${assetKey}`);
    }

    const asset = buildAsset(input.assetCode, input.assetIssuer);
    const source = new Account(treasuryAddress, treasuryAccount.sequence);
    const transaction = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination: input.recipientWalletAddress,
          asset,
          amount: input.amount,
        }),
      )
      .setTimeout(60)
      .build();

    transaction.sign(treasuryKeypair);

    const response = await fetch(`${env.STELLAR_HORIZON_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        tx: transaction.toXDR(),
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new HttpError(
        502,
        `Stellar payout submission failed: ${detail.slice(0, 300)}`,
      );
    }

    const payload = (await response.json()) as {
      hash?: string;
      successful?: boolean;
    };

    if (!payload.hash || payload.successful === false) {
      throw new HttpError(502, "Stellar payout submission did not return a confirmed tx hash");
    }

    return {
      txHash: payload.hash,
      amount: fromBaseUnits(toBaseUnits(input.amount)),
      assetCode: input.assetCode,
      assetIssuer: input.assetIssuer,
      treasuryWalletAddress: treasuryAddress,
    };
  },

  async getTransactionStatus(txHash: string) {
    const response = await fetch(
      `${env.STELLAR_HORIZON_URL}/transactions/${encodeURIComponent(txHash)}`,
      {
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (response.status === 404) {
      return {
        found: false,
        successful: false,
      };
    }

    if (!response.ok) {
      throw new HttpError(502, "Unable to reconcile Stellar payout right now");
    }

    const payload = (await response.json()) as {
      hash?: string;
      successful?: boolean;
      created_at?: string;
    };

    return {
      found: true,
      successful: payload.successful === true,
      txHash: payload.hash ?? txHash,
      createdAt: payload.created_at,
    };
  },
};
