import {
  Account,
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";

import { env } from "../config/env.js";
import { treasuryConfigService } from "../services/treasury-config.service.js";

type CliOptions = {
  assetCode?: string;
  assetIssuer?: string;
  limit?: string;
};

const usage = `Usage:
  pnpm --filter server treasury:add-trustline [options]

Options:
  --asset-code <code>      Asset code to trust
  --asset-issuer <G...>    Asset issuer to trust
  --limit <amount>         Optional trustline limit

Defaults:
  asset code/issuer fall back to PLATFORM_SUBSCRIPTION_ASSET_CODE and PLATFORM_SUBSCRIPTION_ASSET_ISSUER.
`;

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const parseOptions = (args: string[]): CliOptions => {
  const options: CliOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (!arg) {
      continue;
    }

    if (arg === "--asset-code") {
      const value = args[index + 1];
      if (!value) {
        fail("Missing value for --asset-code");
      }
      options.assetCode = value.trim().toUpperCase();
      index += 1;
      continue;
    }

    if (arg === "--asset-issuer") {
      const value = args[index + 1];
      if (!value) {
        fail("Missing value for --asset-issuer");
      }
      options.assetIssuer = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--limit") {
      const value = args[index + 1];
      if (!value) {
        fail("Missing value for --limit");
      }
      options.limit = value.trim();
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }

    fail(`Unknown argument: ${arg}`);
  }

  return options;
};

const resolveAsset = (options: CliOptions) => {
  const assetCode = (options.assetCode ?? env.PLATFORM_SUBSCRIPTION_ASSET_CODE).trim().toUpperCase();
  const assetIssuer = (options.assetIssuer ?? env.PLATFORM_SUBSCRIPTION_ASSET_ISSUER ?? "").trim();

  if (!assetCode || assetCode === "XLM") {
    fail("Trustlines are only needed for non-native assets. Choose a token asset such as USDC.");
  }

  if (!assetIssuer) {
    fail(`Asset issuer is required for ${assetCode}.`);
  }

  return {
    assetCode,
    assetIssuer,
    asset: new Asset(assetCode, assetIssuer),
  };
};

const requireTreasuryWalletAddress = async () => {
  const treasuryWalletAddress = await treasuryConfigService.getConfiguredWalletAddress();

  if (!treasuryWalletAddress) {
    fail("No treasury wallet is configured.");
    throw new Error("unreachable");
  }

  return treasuryWalletAddress;
};

const requireTreasurySecret = () => {
  if (!env.STELLAR_TREASURY_SECRET) {
    fail("STELLAR_TREASURY_SECRET is not configured.");
    throw new Error("unreachable");
  }

  return env.STELLAR_TREASURY_SECRET;
};

const main = async () => {
  const options = parseOptions(process.argv.slice(2));
  await treasuryConfigService.ensureConsistency();

  const { assetCode, assetIssuer, asset } = resolveAsset(options);
  const treasuryWalletAddress = await requireTreasuryWalletAddress();
  const treasurySecret = requireTreasurySecret();
  const treasuryKeypair = Keypair.fromSecret(treasurySecret);

  if (treasuryKeypair.publicKey() !== treasuryWalletAddress) {
    fail("Treasury secret does not match the configured treasury wallet.");
  }

  const server = new Horizon.Server(env.STELLAR_HORIZON_URL);
  const treasuryAccount = await server.loadAccount(treasuryWalletAddress);

  const existingTrustline = treasuryAccount.balances.find(
    (balance) =>
      "asset_code" in balance &&
      "asset_issuer" in balance &&
      balance.asset_code === assetCode &&
      balance.asset_issuer === assetIssuer,
  );

  if (existingTrustline) {
    console.log(`Trustline already exists for ${assetCode}:${assetIssuer}`);
    return;
  }

  const transaction = new TransactionBuilder(
    new Account(treasuryWalletAddress, treasuryAccount.sequenceNumber()),
    {
      fee: BASE_FEE,
      networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE,
    },
  )
    .addOperation(
      Operation.changeTrust({
        asset,
        limit: options.limit,
      }),
    )
    .setTimeout(60)
    .build();

  transaction.sign(treasuryKeypair);

  const response = await server.submitTransaction(transaction);

  console.log(`Added trustline for ${assetCode}:${assetIssuer}`);
  console.log(`Treasury wallet: ${treasuryWalletAddress}`);
  console.log(`Transaction hash: ${response.hash}`);
};

void main().catch((error: unknown) => {
  if (error instanceof Error) {
    fail(error.message);
  }

  fail("Failed to add treasury trustline.");
});
