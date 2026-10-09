"use client";

import { isStellarWallet } from "@dynamic-labs/stellar";
import type { Wallet } from "@dynamic-labs/sdk-react-core";
import type { StellarWallet } from "@dynamic-labs/stellar";

import { clientEnv } from "@/lib/config/env";

const normalizeAddress = (value?: string | null) => value?.trim().toLowerCase() ?? "";

const stellarTestnetNetwork = {
  chainId: "TESTNET",
  networkId: "TESTNET",
  name: "Stellar Testnet",
  rpcUrls: [clientEnv.stellarHorizonUrl],
  vanityName: "Stellar Testnet",
};

export const resolveStellarWallet = (
  sessionWalletAddress: string | null | undefined,
  primaryWallet: Wallet | null | undefined,
  userWallets: Wallet[] | null | undefined,
): StellarWallet | null => {
  const sessionAddress = normalizeAddress(sessionWalletAddress);

  if (
    primaryWallet &&
    isStellarWallet(primaryWallet) &&
    (!sessionAddress || normalizeAddress(primaryWallet.address) === sessionAddress)
  ) {
    return primaryWallet;
  }

  for (const wallet of userWallets ?? []) {
    if (
      isStellarWallet(wallet) &&
      (!sessionAddress || normalizeAddress(wallet.address) === sessionAddress)
    ) {
      return wallet;
    }
  }

  return null;
};

export const ensureActiveStellarAccount = async (wallet: StellarWallet) => {
  const connector = wallet.connector as {
    setActiveAccountAddress?: (address: string) => void;
    getWalletClientByAddress?: (args: { accountAddress: string }) => Promise<unknown>;
    validateActiveWallet?: (address: string) => Promise<void>;
    selectedNetwork?: {
      chainId: string | number;
      networkId: string | number;
      name?: string;
      rpcUrls?: string[];
      vanityName?: string;
    };
    stellarNetworks?: Array<{
      chainId: string | number;
      networkId: string | number;
      name?: string;
      rpcUrls?: string[];
      vanityName?: string;
    }>;
  };

  connector.stellarNetworks = [stellarTestnetNetwork];
  connector.selectedNetwork = stellarTestnetNetwork;
  connector.setActiveAccountAddress?.(wallet.address);

  if (connector.getWalletClientByAddress) {
    await connector.getWalletClientByAddress({ accountAddress: wallet.address });
  }

  if (connector.validateActiveWallet) {
    await connector.validateActiveWallet(wallet.address);
  }
};
