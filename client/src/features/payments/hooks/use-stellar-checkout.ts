"use client";

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  useDynamicContext,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import type { CheckoutAttempt, PaymentIntentRecord } from "@music-city/shared";
import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";
import { resolveStellarWallet } from "@/features/wallet/lib/resolve-stellar-wallet";
import { useAuth } from "@/hooks/use-auth";
import { clientEnv } from "@/lib/config/env";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { paymentsApi } from "../lib/payments-api";

type Checkout = (intent: PaymentIntentRecord) => Promise<string>;
type Pending = { intent: PaymentIntentRecord; attempt: CheckoutAttempt };
const StellarCheckoutContext = createContext<Checkout | null>(null);

export const useStellarCheckout = () => {
  const checkout = useContext(StellarCheckoutContext);
  return useCallback(
    async (intent: PaymentIntentRecord) => {
      if (!checkout)
        throw new Error(
          "Wallet payments require a configured Dynamic provider.",
        );
      return checkout(intent);
    },
    [checkout],
  );
};

export const StellarCheckoutProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const authorizeWallet = useStellarAuthorization();
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [walletSigning, setWalletSigning] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const completion = useRef<{
    resolve: (hash: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const starting = useRef(false);

  const finish = useCallback((attempt: CheckoutAttempt) => {
    if (attempt.status === "confirmed") {
      completion.current?.resolve(attempt.transactionHash);
    } else if (["failed", "expired"].includes(attempt.status)) {
      completion.current?.reject(
        new Error(attempt.error ?? "Payment did not complete"),
      );
    } else return false;
    completion.current = null;
    setPending(null);
    return true;
  }, []);

  useEffect(() => {
    if (
      !pending ||
      !session?.token ||
      busy ||
      (pending.attempt.status !== "submitting" && !uncertain)
    )
      return;
    const token = session.token;
    let stopped = false;
    let fetching = false;
    const poll = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const current = await paymentsApi.getCheckout(
          token,
          pending.attempt.id,
        );
        if (!stopped) {
          setUncertain(false);
          setError(null);
        }
        if (!stopped && !finish(current))
          setPending((value) =>
            value?.attempt.id === current.id
              ? { ...value, attempt: current }
              : value,
          );
      } catch {
        if (!stopped)
          setError("Waiting for confirmation. Your payment is being tracked.");
      } finally {
        fetching = false;
      }
    };
    const timer = setInterval(() => void poll(), 2500);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [
    pending?.attempt.id,
    pending?.attempt.status,
    session?.token,
    finish,
    uncertain,
    busy,
  ]);

  const checkout = useCallback(
    async (intent: PaymentIntentRecord): Promise<string> => {
      if (
        !session?.token ||
        intent.walletAddress !== session.walletAddress ||
        intent.networkPassphrase !== clientEnv.stellarNetworkPassphrase
      ) {
        throw new Error("Connect the wallet and network used for this payment");
      }
      if (starting.current || completion.current)
        throw new Error("Finish your current payment first");
      starting.current = true;
      try {
        const attempt = await paymentsApi.prepareCheckout(
          session.token,
          intent.id,
        );
        if (attempt.status === "confirmed") return attempt.transactionHash;
        if (["failed", "expired"].includes(attempt.status))
          throw new Error(attempt.error ?? "Payment did not complete");
        setError(null);
        setUncertain(false);
        return await new Promise<string>((resolve, reject) => {
          completion.current = { resolve, reject };
          setPending({ intent, attempt });
        });
      } finally {
        starting.current = false;
      }
    },
    [session?.token, session?.walletAddress],
  );

  async function sign() {
    if (
      !pending ||
      !session?.token ||
      uncertain ||
      pending.attempt.status !== "prepared"
    )
      return;
    setBusy(true);
    setError(null);
    try {
      const wallet = resolveStellarWallet(
        session.walletAddress,
        primaryWallet,
        userWallets,
      );
      if (!wallet)
        throw new Error("Connect your Stellar wallet to complete this payment");
      setWalletSigning(true);
      await authorizeWallet(wallet);
      const signed = await wallet.signTransaction(pending.attempt.transaction);
      setWalletSigning(false);
      setUncertain(true);
      const authorized = await paymentsApi.authorizeCheckout(
        session.token,
        pending.attempt.id,
        signed,
      );
      setUncertain(false);
      setPending({ ...pending, attempt: authorized });
      const submitted = await paymentsApi.submitCheckout(
        session.token,
        pending.attempt.id,
      );
      if (!finish(submitted)) setPending({ ...pending, attempt: submitted });
    } catch (cause) {
      try {
        const current = await paymentsApi.getCheckout(
          session.token,
          pending.attempt.id,
        );
        setUncertain(false);
        if (!finish(current)) setPending({ ...pending, attempt: current });
      } catch {}
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not authorize this payment. Try again.",
      );
    } finally {
      setWalletSigning(false);
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    completion.current?.reject(
      new Error(
        pending?.attempt.status === "submitting" || uncertain
          ? "Your payment is processing. It will finish automatically."
          : "Payment cancelled",
      ),
    );
    completion.current = null;
    setPending(null);
  }
  return createElement(
    StellarCheckoutContext.Provider,
    { value: checkout },
    children,
    pending &&
      createElement(Dialog, {
        title: uncertain
          ? "Checking payment"
          : pending.attempt.status === "submitting"
            ? "Confirming payment"
            : "Review payment",
        onClose: close,
        busy,
        suspended: walletSigning,
        children: createElement(
          "div",
          { className: "space-y-5" },
          createElement(
            "p",
            { className: "text-2xl font-semibold" },
            `${pending.intent.amount} ${pending.intent.assetCode}`,
          ),
          createElement(
            "p",
            { className: "text-sm text-muted-foreground" },
            "Network fee is paid separately in XLM.",
          ),
          pending.attempt.status === "submitting" || uncertain
            ? createElement(
                "div",
                {
                  role: "status",
                  className: "flex items-center gap-3 text-sm",
                },
                createElement("span", {
                  "aria-hidden": true,
                  className:
                    "size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none",
                }),
                "Waiting for confirmation…",
              )
            : createElement(
                Button,
                {
                  onClick: () => void sign(),
                  disabled: busy,
                  className: "w-full",
                },
                busy ? "Authorizing…" : "Confirm and pay",
              ),
          error &&
            createElement(
              "p",
              { role: "alert", className: "text-sm text-destructive" },
              error,
            ),
          createElement(
            "details",
            { className: "text-xs text-muted-foreground" },
            createElement(
              "summary",
              { className: "cursor-pointer" },
              "Payment details",
            ),
            createElement(
              "dl",
              { className: "mt-3 space-y-2 break-all" },
              createElement("dt", null, "To"),
              createElement("dd", null, pending.intent.destinationAddress),
              createElement("dt", null, "Order"),
              createElement("dd", null, pending.intent.id),
              createElement("dt", null, "Transaction"),
              createElement("dd", null, pending.attempt.transactionHash),
            ),
          ),
          createElement(
            Button,
            {
              variant: "ghost",
              onClick: close,
              disabled: busy,
              className: "w-full",
            },
            pending.attempt.status === "submitting" || uncertain
              ? "Continue browsing"
              : "Cancel",
          ),
        ),
      }),
  );
};
