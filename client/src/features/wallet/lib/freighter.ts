import {
  getNetwork,
  requestAccess,
  signTransaction,
} from "@stellar/freighter-api";
import type { AuthSession } from "@music-city/shared";

import { authApi } from "@/features/auth/lib/auth-api";
import { clientEnv } from "@/lib/config/env";

const normalizeAddress = (address: string) => address.trim().toUpperCase();

const walletRequest = <T>(
  request: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  if (!signal) return request();
  if (signal.aborted) {
    return Promise.reject(
      signal.reason instanceof Error
        ? signal.reason
        : new Error("Freighter request was cancelled"),
    );
  }

  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error("Freighter request was cancelled"),
      );
    };

    signal.addEventListener("abort", onAbort, { once: true });
    let pending: Promise<T>;
    try {
      pending = request();
    } catch (error) {
      cleanup();
      reject(error);
      return;
    }

    pending.then(
      (result) => {
        cleanup();
        resolve(result);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error
    ? signal.reason
    : new Error("Freighter request was cancelled");
};

const throwWalletError = (error?: { message: string }) => {
  if (error) {
    throw new Error(error.message || "Freighter could not complete the request");
  }
};

export const verifyFreighterNetwork = async (signal?: AbortSignal) => {
  const result = await walletRequest(getNetwork, signal);
  throwWalletError(result.error);

  if (result.networkPassphrase !== clientEnv.stellarNetworkPassphrase) {
    throw new Error(
      "Freighter is connected to a different Stellar network. Switch it to the network used by Music City and try again.",
    );
  }
};

export async function signInWithFreighter(
  signal?: AbortSignal,
): Promise<AuthSession> {
  const account = await walletRequest(requestAccess, signal);
  throwWalletError(account.error);

  if (!account.address) {
    throw new Error("Freighter did not return an account address");
  }

  await verifyFreighterNetwork(signal);
  const challenge = await authApi.requestChallenge(account.address);
  throwIfAborted(signal);

  if (challenge.networkPassphrase !== clientEnv.stellarNetworkPassphrase) {
    throw new Error(
      "The server and Music City are configured for different Stellar networks",
    );
  }

  const signed = await walletRequest(
    () =>
      signTransaction(challenge.transaction, {
        address: account.address,
        networkPassphrase: challenge.networkPassphrase,
      }),
    signal,
  );
  throwWalletError(signed.error);

  if (
    !signed.signedTxXdr ||
    normalizeAddress(signed.signerAddress) !== normalizeAddress(account.address)
  ) {
    throw new Error("Freighter signed the challenge with a different account");
  }

  throwIfAborted(signal);
  const session = await authApi.verifyChallenge({
    transaction: signed.signedTxXdr,
  });
  throwIfAborted(signal);
  return session;
}

export async function signWithFreighter(
  transaction: string,
  accountAddress: string,
): Promise<string> {
  await verifyFreighterNetwork();
  const signed = await signTransaction(transaction, {
    address: accountAddress,
    networkPassphrase: clientEnv.stellarNetworkPassphrase,
  });
  throwWalletError(signed.error);

  if (
    !signed.signedTxXdr ||
    normalizeAddress(signed.signerAddress) !== normalizeAddress(accountAddress)
  ) {
    throw new Error("Freighter signed the transaction with a different account");
  }

  return signed.signedTxXdr;
}

export async function sendFreighterPayment(input: {
  accountAddress: string;
  destinationAddress: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string | null;
}) {
  const { sendFreighterPaymentTransaction } = await import(
    "./freighter-transactions"
  );
  return sendFreighterPaymentTransaction(input);
}

export async function addFreighterTrustline(input: {
  accountAddress: string;
  assetCode: string;
  assetIssuer: string;
}) {
  const { addFreighterTrustlineTransaction } = await import(
    "./freighter-transactions"
  );
  return addFreighterTrustlineTransaction(input);
}
