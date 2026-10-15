import { useEffect, useRef, useState } from "react";
import {
  useDynamicContext,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import type { SupportPayment, SupportRecipient } from "@music-city/shared";
import { prepareSupportSchema } from "@music-city/shared";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { useAuth } from "@/hooks/use-auth";
import { clientEnv } from "@/lib/config/env";
import { resolveStellarWallet } from "@/features/wallet/lib/resolve-stellar-wallet";
import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";
import { supportApi, supportAmount, supportReceiptUrl } from "./support-api";

export function SupportDialog({
  recipient,
  initialPayment,
  onClose,
}: {
  recipient: SupportRecipient;
  initialPayment?: SupportPayment;
  onClose: () => void;
}) {
  const { session, connectWallet } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const wallets = useUserWallets();
  const authorize = useStellarAuthorization();
  const [amount, setAmount] = useState("5");
  const [payment, setPayment] = useState<SupportPayment | null>(
    initialPayment ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [walletSigning, setWalletSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useRef(crypto.randomUUID());
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (!session?.token || payment?.status !== "submitting") return;
    let alive = true;
    const timer = setInterval(() => {
      void supportApi
        .get(session.token!, payment.id)
        .then((p) => {
          if (alive) setPayment(p);
        })
        .catch(() => {});
    }, 4000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [payment?.id, payment?.status, session?.token]);
  async function review() {
    if (!session?.token) {
      await connectWallet();
      return;
    }
    setError(null);
    const parsed = prepareSupportSchema.safeParse({
      target: recipient.target,
      amount,
      requestKey: requestKey.current,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter an amount");
      return;
    }
    setBusy(true);
    try {
      setPayment(await supportApi.prepare(session.token, parsed.data));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not prepare support. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function sign() {
    if (!payment || !session?.token) return;
    setBusy(true);
    setError(null);
    try {
      if (
        payment.sender !== session.walletAddress ||
        payment.networkPassphrase !== clientEnv.stellarNetworkPassphrase
      )
        throw new Error("Connect the wallet and network used for this payment");
      const wallet = resolveStellarWallet(
        session.walletAddress,
        primaryWallet,
        wallets,
      );
      if (!wallet)
        throw new Error("Connect your Stellar wallet to send support");
      setWalletSigning(true);
      await authorize(wallet);
      const signed = await wallet.signTransaction(payment.transaction);
      setWalletSigning(false);
      const authorized = await supportApi.authorize(
        session.token,
        payment.id,
        signed,
      );
      if (active.current) setPayment(authorized);
      const submitted = await supportApi.submit(session.token, payment.id);
      if (active.current) setPayment(submitted);
    } catch (e) {
      // Authorization may have committed even if its HTTP response was lost.
      try {
        const current = await supportApi.get(session.token, payment.id);
        if (active.current) setPayment(current);
      } catch {}
      setError(
        e instanceof Error && /cancel|closed/i.test(e.message)
          ? "Signing cancelled. Nothing was submitted by this attempt."
          : e instanceof Error
            ? e.message
            : "Could not send support. Check Support history before trying again.",
      );
    } finally {
      setWalletSigning(false);
      setBusy(false);
    }
  }
  async function close() {
    if (busy) return;
    if (payment?.status === "prepared" && session?.token) {
      setBusy(true);
      try {
        await supportApi.cancel(session.token, payment.id);
        onClose();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not cancel. Check Support history.",
        );
      } finally {
        setBusy(false);
      }
    } else onClose();
  }
  return (
    <Dialog
      title={`Support ${recipient.name}`}
      busy={busy}
      suspended={walletSigning}
      onClose={() => void close()}
    >
      {!payment ? (
        <>
          <div className="flex gap-2">
            {[1, 5, 10].map((value) => (
              <Button
                key={value}
                variant={amount === String(value) ? "default" : "outline"}
                onClick={() => setAmount(String(value))}
                disabled={busy}
              >
                {value} USDC
              </Button>
            ))}
          </div>
          <FormField id="support-amount" label="Amount (USDC)">
            <Input
              inputMode="decimal"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value)}
            />
          </FormField>
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-3xl font-semibold">
            {supportAmount(payment.amount)}{" "}
            <span className="text-base">USDC</span>
          </p>
          <p>To {payment.recipient.name}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {payment.recipient.walletAddress}
          </p>
          {payment.status === "prepared" && (
            <p className="text-sm text-muted-foreground">
              Sent directly to their wallet. Network fee paid separately.
            </p>
          )}
          {payment.status === "submitting" && (
            <p role="status" className="flex items-center gap-2">
              <LoaderCircle className="size-4 animate-spin" />
              Confirming payment
            </p>
          )}
          {payment.status === "confirmed" && (
            <>
              <p role="status" className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="size-4" />
                Support sent
              </p>
              <a
                className="text-sm underline"
                href={supportReceiptUrl(payment)}
                target="_blank"
                rel="noreferrer"
              >
                View receipt
              </a>
            </>
          )}
          {["expired", "failed", "cancelled"].includes(payment.status) && (
            <p role="status">
              {payment.status === "cancelled"
                ? "Cancelled"
                : payment.status === "expired"
                  ? "Payment expired"
                  : "Payment failed"}
            </p>
          )}
        </div>
      )}
      {(error || payment?.error) && (
        <div role="alert" className="space-y-2 text-sm text-destructive">
          <p>{error ?? payment?.error}</p>
          <a href="/account/support" className="underline">
            Support history
          </a>
          <span className="px-2">·</span>
          <a href="/account" className="underline">
            Open wallet
          </a>
        </div>
      )}
      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <Button variant="outline" disabled={busy} onClick={() => void close()}>
          {!payment || payment.status === "prepared" ? "Cancel" : "Close"}
        </Button>
        {!payment && (
          <Button disabled={busy} onClick={() => void review()}>
            {busy
              ? "Checking wallet..."
              : session
                ? "Review support"
                : "Sign in to support"}
          </Button>
        )}
        {payment?.status === "prepared" && (
          <Button disabled={busy} onClick={() => void sign()}>
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Waiting for wallet
              </>
            ) : (
              "Sign and send"
            )}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
