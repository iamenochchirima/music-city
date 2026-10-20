import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  useDynamicContext,
  useUserWallets,
} from "@dynamic-labs/sdk-react-core";
import type { FinancialAttempt, SettlementBatch } from "@music-city/shared";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { httpClient } from "@/lib/api/http-client";
import { clientEnv } from "@/lib/config/env";
import {
  resolveStellarWallet,
} from "@/features/wallet/lib/resolve-stellar-wallet";
import { Button } from "@/components/ui/button";
import { StudioPageHeader } from "@/components/studio/page-header";
const money = (units: string) => {
  const n = BigInt(units);
  return `${n / 10000000n}.${(n % 10000000n).toString().padStart(7, "0").replace(/0+$/, "") || "00"}`;
};
type EarningsBatch = SettlementBatch & { trackTitle?: string | null };
type Detail = { batch: SettlementBatch; attempts: FinancialAttempt[] };
export function CreatorClaims() {
  const authorizeWallet = useStellarAuthorization();
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const wallets = useUserWallets();
  const [items, setItems] = useState<EarningsBatch[]>([]),
    [attempts, setAttempts] = useState<FinancialAttempt[]>([]);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [loading, setLoading] = useState(true);
  const [review, setReview] = useState<{
    batch: SettlementBatch;
    index: number;
  } | null>(null);
  const [pendingUnits, setPendingUnits] = useState("0");
  const token = session?.token;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const load = useCallback(async () => {
    if (!token) return;
    const [response, balances] = await Promise.all([
      httpClient.get<{ items: EarningsBatch[] }>("/settlements", token),
      httpClient.get<{ pendingUnits: string }>("/settlements/balances", token),
    ]);
    const details = await Promise.all(
      response.items.map((b) =>
        httpClient.get<Detail>(`/settlements/${b.id}`, token),
      ),
    );
    if (tokenRef.current !== token) return;
    setPendingUnits(balances.pendingUnits);
    setItems(response.items);
    setAttempts(details.flatMap((d) => d.attempts));
  }, [token]);
  useEffect(() => {
    setItems([]);
    setPendingUnits("0");
    setAttempts([]);
    setReview(null);
    setLoading(true);
    let active = true;
    const update = () =>
      load()
        .catch((e) => {
          if (active)
            setError(
              e instanceof Error ? e.message : "Could not load earnings",
            );
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    void update();
    const timer = setInterval(() => {
      void update();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);
  async function claim() {
    if (!review || !session) return;
    const { batch, index } = review;
    setBusy(`${batch.id}:${index}`);
    setError(null);
    try {
      if (batch.config.networkPassphrase !== clientEnv.stellarNetworkPassphrase)
        throw new Error(
          "Your wallet and claim must use the same Stellar network",
        );
      const wallet = resolveStellarWallet(
        session.walletAddress,
        primaryWallet,
        wallets,
      );
      if (!wallet || wallet.address !== session.walletAddress)
        throw new Error("Connect your signed-in Stellar wallet to claim");
      const { attempt } = await httpClient.post<{ attempt: FinancialAttempt }>(
        `/settlements/${batch.id}/claims/${index}/prepare`,
        {},
        token,
      );
      if (
        attempt.networkPassphrase !== batch.config.networkPassphrase ||
        attempt.treasuryAddress !== session.walletAddress
      )
        throw new Error(
          "Withdrawal wallet or network changed. Review this claim again",
        );
      if (attempt.status === "awaiting_signatures") {
        await authorizeWallet(wallet);
        const signedTransaction = await wallet.signTransaction(
          attempt.transaction,
        );
        await httpClient.post(
          `/settlements/attempts/${attempt.id}/signatures`,
          { signedTransaction },
          token,
        );
        await httpClient.post(
          `/settlements/attempts/${attempt.id}/submit`,
          {},
          token,
        );
      }
      setReview(null);
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Claim cancelled or unavailable. Your available balance is unchanged.",
      );
    } finally {
      setBusy(null);
    }
  }
  const claims = items.flatMap((batch) =>
    batch.allocations
      .filter(
        (a) =>
          a.beneficiary === session?.walletAddress &&
          BigInt(a.amountUnits) > 0n,
      )
      .map((a) => ({ batch, allocation: a })),
  );
  const available = claims
    .filter(
      ({ batch, allocation: a }) =>
        a.status === "available" && Date.parse(batch.expiresAt) > Date.now(),
    )
    .reduce((n, { allocation: a }) => n + BigInt(a.amountUnits), 0n);
  const pending = BigInt(pendingUnits);
  if (!session) return null;
  return (
    <section className="space-y-5">
      <StudioPageHeader
        title="Your earnings"
        eyebrow="Revenue"
        description="Claim your USDC when it is ready."
      />
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm"
        >
          <p>{error}</p>
          <a className="mt-2 inline-block underline" href="/account">
            Open wallet settings
          </a>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground">Available</p>
          <p className="mt-2 text-2xl font-semibold">
            {money(available.toString())} <span className="text-sm">USDC</span>
          </p>
        </div>
        <div className="rounded-xl border border-border p-5">
          <p className="text-sm text-muted-foreground">Payment pending</p>
          <p className="mt-2 text-2xl font-semibold">
            {money(pending.toString())} <span className="text-sm">USDC</span>
          </p>
        </div>
      </div>
      {loading ? (
        <p
          role="status"
          className="flex items-center gap-2 text-muted-foreground"
        >
          <Loader2 className="size-4 animate-spin" />
          Loading earnings
        </p>
      ) : !claims.length ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          Your earnings will appear here when they’re ready.
        </p>
      ) : (
        <div className="space-y-3">
          {claims.map(({ batch, allocation: a }) => {
            const attempt = a.status!=="available" ? undefined : attempts
              .filter((t) => t.batchId === batch.id && t.claimIndex === a.index)
              .find((t) => ["submitting", "submitted"].includes(t.status));
            const expired =
              a.status === "available" &&
              Date.parse(batch.expiresAt) <= Date.now();
            return (
              <article
                key={`${batch.id}:${a.index}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border p-5"
              >
                <div>
                  {batch.trackTitle && (
                    <p className="mb-1 text-sm text-muted-foreground">
                      {batch.trackTitle}
                    </p>
                  )}
                  <p className="text-lg font-semibold">
                    {money(a.amountUnits)} USDC
                  </p>
                  {a.status !== "claimed" && <p className="mt-1 text-sm text-muted-foreground">
                    {a.status === "reclaimed"
                        ? "Claim period ended"
                        : expired
                          ? "Claim expired"
                          : a.status === "pending"
                            ? "Payment pending"
                            : `Claim by ${new Date(batch.expiresAt).toLocaleString()}`}
                  </p>}
                </div>
                {attempt ? (
                  <span
                    role="status"
                    className="flex items-center gap-2 text-sm"
                  >
                    <Loader2 className="size-4 animate-spin" />
                    Confirming withdrawal
                  </span>
                ) : a.status === "available" && !expired ? (
                  <Button
                    disabled={!!busy || !!batch.discrepancy}
                    onClick={() => {
                      setReview({ batch, index: a.index });
                      setError(null);
                    }}
                  >
                    Claim USDC
                  </Button>
                ) : a.status === "claimed" ? (
                  <span className="flex items-center gap-2 text-sm text-emerald-400">
                    <CheckCircle2 className="size-4" />
                    Received
                  </span>
                ) : null}
                {a.transactionHash && (
                  <a
                    className="text-sm underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://stellar.expert/explorer/${batch.config.networkPassphrase.includes("Test SDF") ? "testnet" : "public"}/tx/${a.transactionHash}`}
                  >
                    View receipt
                  </a>
                )}
                {batch.discrepancy && (
                  <p role="status" className="w-full text-sm text-amber-300">
                    We’re checking this payment. Claiming is temporarily unavailable.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      {review && (
        <section
          aria-label="Review withdrawal"
          className="space-y-4 rounded-xl border border-primary/40 bg-primary/5 p-5"
        >
          <h3 className="text-lg font-semibold">
            Claim {money(review.batch.allocations[review.index]!.amountUnits)}{" "}
            USDC
          </h3>
          <p className="text-sm text-muted-foreground">
            To your connected Stellar wallet. Confirm below to sign this withdrawal.
          </p>
          <p className="break-all font-mono text-xs">{session.walletAddress}</p>
          <div className="flex flex-wrap gap-3">
            <Button disabled={!!busy} onClick={() => void claim()}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Waiting for wallet
                </>
              ) : (
                "Sign and claim"
              )}
            </Button>
            <Button
              variant="outline"
              disabled={!!busy}
              onClick={() => setReview(null)}
            >
              Cancel
            </Button>
          </div>
        </section>
      )}
    </section>
  );
}
