"use client";

import { useStellarAuthorization } from "@/features/wallet/lib/use-stellar-authorization";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDynamicContext, useUserWallets } from "@dynamic-labs/sdk-react-core";
import type { WalletAccount, WalletBalance } from "@music-city/shared";
import {
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  X,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { walletApi } from "@/features/wallet/lib/wallet-api";
import { WalletRampActivity } from "@/features/ramps/wallet-ramp-activity";
import {
  resolveStellarWallet,
} from "@/features/wallet/lib/resolve-stellar-wallet";
import { clientEnv } from "@/lib/config/env";

const formatBalance = (amount: string) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 7,
  }).format(Number(amount));

const formatMetricBalance = (amount?: string) => {
  if (!amount) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(Number(amount));
};

const shortenAddress = (value: string) => `${value.slice(0, 6)}...${value.slice(-6)}`;

const assetLabel = (balance: WalletBalance) =>
  balance.isNative ? "XLM" : `${balance.assetCode} token`;

const buildTokenAddress = (balance: WalletBalance) =>
  balance.isNative ? undefined : `${balance.assetCode}:${balance.assetIssuer ?? ""}`;

const findBalance = (account: WalletAccount | null, assetCode: string) =>
  account?.balances.find((balance) => balance.assetCode === assetCode) ?? null;

const describeWalletError = (caughtError: unknown, fallback: string) => {
  if (!(caughtError instanceof Error)) {
    return fallback;
  }

  const candidate = caughtError as Error & {
    response?: {
      data?: {
        detail?: string;
        extras?: {
          result_codes?: {
            transaction?: string;
            operations?: string[];
          };
        };
      };
    };
    cause?: {
      response?: {
        data?: {
          detail?: string;
          extras?: {
            result_codes?: {
              transaction?: string;
              operations?: string[];
            };
          };
        };
      };
    };
  };

  const payload = candidate.response?.data ?? candidate.cause?.response?.data;
  const transactionCode = payload?.extras?.result_codes?.transaction;
  const operationCode = payload?.extras?.result_codes?.operations?.[0];
  const detail = payload?.detail?.trim();

  if (operationCode === "op_low_reserve") {
    return "Your wallet needs more free XLM reserve before it can add another trustline.";
  }

  if (operationCode === "op_already_exists") {
    return "This wallet already has the USDC trustline. Refresh the wallet balances.";
  }

  if (operationCode === "op_no_issuer") {
    return "The configured USDC issuer was not found on the selected Stellar network.";
  }

  if (operationCode === "op_invalid_limit") {
    return "The trustline limit is invalid for this asset.";
  }

  if (transactionCode || operationCode) {
    return `Stellar rejected the transaction: ${[transactionCode, operationCode]
      .filter(Boolean)
      .join(" / ")}.`;
  }

  if (detail) {
    return detail;
  }

  if (caughtError.message.trim()) {
    return caughtError.message;
  }

  return fallback;
};

export const WalletOverviewCard = () => {
  const authorizeWallet = useStellarAuthorization();
  const [searchParams] = useSearchParams();
  const { session } = useAuth();
  const { primaryWallet } = useDynamicContext();
  const userWallets = useUserWallets();
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAddingUsdcTrustline, setIsAddingUsdcTrustline] = useState(false);
  const [isTrustlineApprovalSlow, setIsTrustlineApprovalSlow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedAssetKey, setSelectedAssetKey] = useState("");
  const trustlineApprovalTimerRef = useRef<number | null>(null);

  const load = async () => {
    if (!session?.token) {
      setAccount(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const nextAccount = await walletApi.getMe(session.token);
      setAccount(nextAccount);
    } catch (caughtError) {
      setAccount(null);
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load wallet.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [session?.token]);

  useEffect(() => {
    return () => {
      if (trustlineApprovalTimerRef.current) {
        window.clearTimeout(trustlineApprovalTimerRef.current);
      }
    };
  }, []);

  const spendableBalances = useMemo(
    () =>
      (account?.balances ?? []).filter((balance) => Number(balance.availableAmount) > 0),
    [account?.balances],
  );

  useEffect(() => {
    if (spendableBalances.length === 0) {
      setSelectedAssetKey("");
      return;
    }

    if (!spendableBalances.some((balance) => balance.assetKey === selectedAssetKey)) {
      setSelectedAssetKey(spendableBalances[0]!.assetKey);
    }
  }, [selectedAssetKey, spendableBalances]);

  const selectedBalance = useMemo(
    () =>
      spendableBalances.find((balance) => balance.assetKey === selectedAssetKey) ?? null,
    [selectedAssetKey, spendableBalances],
  );
  const stellarWallet = resolveStellarWallet(
    session?.walletAddress,
    primaryWallet,
    userWallets,
  );
  const xlmBalance = findBalance(account, "XLM");
  const usdcBalance = findBalance(account, "USDC");
  const hasUsdcTrustline = Boolean(
    account?.balances.some(
      (balance) =>
        balance.assetCode === clientEnv.stellarTestnetUsdcCode &&
        balance.assetIssuer === clientEnv.stellarTestnetUsdcIssuer,
    ),
  );
  const canSend =
    Boolean(stellarWallet?.address) &&
    spendableBalances.length > 0;

  const handleCopyAddress = async () => {
    if (!session?.walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(session.walletAddress);
      setCopied(true);
      toast.success("Wallet address copied.");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Unable to copy your wallet address.");
    }
  };

  const handleSend = async () => {
    if (!stellarWallet) {
      toast.error("Connect a Stellar wallet first.");
      return;
    }

    if (!selectedBalance) {
      toast.error("Choose an asset with a spendable balance first.");
      return;
    }

    if (!recipient.trim() || !amount.trim()) {
      toast.error("Enter a recipient and amount first.");
      return;
    }

    try {
      setIsSending(true);
      await stellarWallet.connector.connect();
      await authorizeWallet(stellarWallet);
      const txHash = await stellarWallet.sendBalance({
        amount: amount.trim(),
        toAddress: recipient.trim(),
        token: buildTokenAddress(selectedBalance)
          ? {
              address: buildTokenAddress(selectedBalance)!,
            }
          : undefined,
      });

      toast.success(
        `Transfer submitted${typeof txHash === "string" ? `: ${shortenAddress(txHash)}` : "."}`,
      );
      setRecipient("");
      setAmount("");
      await load();
    } catch (caughtError) {
      toast.error(describeWalletError(caughtError, "Unable to send funds."));
    } finally {
      setIsSending(false);
    }
  };

  const handleAddUsdcTrustline = async () => {
    if (!stellarWallet) {
      toast.error("Connect a Stellar wallet first.");
      return;
    }

    if (!account?.exists) {
      toast.error("Fund this wallet with testnet XLM before adding a trustline.");
      return;
    }

    setIsAddingUsdcTrustline(true);
    setIsTrustlineApprovalSlow(false);

    trustlineApprovalTimerRef.current = window.setTimeout(() => {
      setIsTrustlineApprovalSlow(true);
    }, 5000);

    void stellarWallet
      .connector.connect()
      .then(async () => {
        await authorizeWallet(stellarWallet);
        return stellarWallet.addTrustline({
          assetCode: clientEnv.stellarTestnetUsdcCode,
          assetIssuer: clientEnv.stellarTestnetUsdcIssuer,
        });
      })
      .then(async (txHash: string) => {
        toast.success(
          `USDC trustline added${typeof txHash === "string" ? `: ${shortenAddress(txHash)}` : "."}`,
        );
        await load();
      })
      .catch((caughtError: unknown) => {
        toast.error(
          describeWalletError(caughtError, "Unable to add the USDC trustline."),
        );
      })
      .finally(() => {
        if (trustlineApprovalTimerRef.current) {
          window.clearTimeout(trustlineApprovalTimerRef.current);
          trustlineApprovalTimerRef.current = null;
        }
        setIsAddingUsdcTrustline(false);
        setIsTrustlineApprovalSlow(false);
      });
  };

  const closeSendModal = () => {
    if (isSending) {
      return;
    }

    setIsSendModalOpen(false);
  };

  return (
    <Card className="border-white/10 bg-transparent text-white shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Wallet</CardTitle>
          <Button type="button" variant="ghost" size="icon" aria-label="Refresh wallet" disabled={isLoading} onClick={()=>void load()}>
            {isLoading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            <div><dt className="text-sm text-slate-400">Spendable USDC</dt><dd className="mt-1 break-all text-2xl font-semibold" aria-label={isLoading ? "Loading USDC balance" : undefined}>{isLoading || !account ? "—" : formatMetricBalance(usdcBalance?.availableAmount)}</dd></div>
            <div><dt className="text-sm text-slate-400">XLM</dt><dd className="mt-1 break-all text-2xl font-semibold" aria-label={isLoading ? "Loading XLM balance" : undefined}>{isLoading || !account ? "—" : formatMetricBalance(xlmBalance?.amount)}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!session?.walletAddress} onClick={()=>void handleCopyAddress()}>
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}{copied ? "Copied" : "Copy address"}
            </Button>
            <Button type="button" disabled={!account?.exists || !canSend} onClick={()=>setIsSendModalOpen(true)}><Send className="mr-2 size-4" />Send</Button>
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
        {!isLoading && account && !account.exists && <p role="alert" className="text-sm text-amber-200">Fund this wallet before receiving or sending assets.</p>}
        {!isLoading && account && !hasUsdcTrustline ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <div className="text-sm"><p>Enable USDC to receive payments.</p>{isAddingUsdcTrustline && <p role="status" className="mt-1 text-slate-400">Waiting for wallet approval…</p>}{isTrustlineApprovalSlow && <p className="mt-1 text-slate-400">Open your wallet prompt to approve.</p>}</div>
          <Button type="button" variant="outline" disabled={!account.exists || isAddingUsdcTrustline} onClick={()=>void handleAddUsdcTrustline()}>{isAddingUsdcTrustline ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}Add USDC trustline</Button>
        </div> : !isLoading && account ? <p className="text-xs text-emerald-300">USDC ready to receive</p> : null}

        <details className="border-t border-white/10 pt-3 text-sm">
          <summary className="w-fit cursor-pointer text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">Wallet details</summary>
          <div className="mt-4 space-y-4">
            <p className="break-all text-xs text-slate-400">{session?.walletAddress ?? "Wallet unavailable"}</p>
            {isLoading ? <p className="text-slate-400">Loading wallet balances…</p> : account?.balances.length ? <dl className="divide-y divide-white/10">{account.balances.map(balance=><div key={balance.assetKey} className="flex flex-wrap items-center justify-between gap-2 py-3"><dt title={balance.assetIssuer}>{assetLabel(balance)}</dt><dd className="text-right"><p>{formatBalance(balance.amount)} {balance.assetCode}</p><p className="text-xs text-slate-400">Spendable {formatBalance(balance.availableAmount)}</p></dd></div>)}</dl> : <p className="text-slate-400">No balances found.</p>}
            {clientEnv.stellarNetworkPassphrase==="Test SDF Network ; September 2015" && <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-400">Stellar Testnet. Test tokens have no real-world value.</p><a href="https://lab.stellar.org/account/fund" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300 hover:underline">Open testnet faucet<ExternalLink className="size-3" aria-hidden="true" /></a></div>}
          </div>
        </details>
        {session?.token && <details open={searchParams.has("ramp")} className="border-t border-white/10 pt-3 text-sm"><summary className="w-fit cursor-pointer text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">Funding, cash-out and transactions</summary><div className="mt-4"><WalletRampActivity key={session.token} token={session.token}
          walletXlm={account?.balances.find(balance => balance.isNative)?.availableAmount ?? "0"}
        spendableUsdc={account?.balances.find(balance=>balance.assetCode==="USDC" && balance.assetIssuer===clientEnv.stellarTestnetUsdcIssuer)?.availableAmount ?? "0"}
          sign={stellarWallet ? async(transaction)=>{await authorizeWallet(stellarWallet);return stellarWallet.signTransaction(transaction);} : undefined}
        /></div></details>}

        {isSendModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-[#090d1d] p-6 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Send className="size-4 text-emerald-300" />
                    <p className="text-base font-medium text-white">Send from wallet</p>
                  </div>
                  <p className="text-sm text-slate-400">
                    Transfer funds from your connected Stellar wallet without leaving the account page.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-white/10 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
                  onClick={closeSendModal}
                  aria-label="Close send modal"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="wallet-asset">Asset</Label>
                  <select
                    id="wallet-asset"
                    className="flex h-10 w-full rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300"
                    value={selectedAssetKey}
                    onChange={(event) => setSelectedAssetKey(event.target.value)}
                    disabled={!canSend || isSending}
                  >
                    {spendableBalances.length === 0 ? (
                      <option value="">No spendable asset</option>
                    ) : (
                      spendableBalances.map((balance) => (
                        <option key={balance.assetKey} value={balance.assetKey}>
                          {balance.assetCode} · {formatBalance(balance.availableAmount)} available
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="wallet-recipient">Recipient address</Label>
                  <Input
                    id="wallet-recipient"
                    value={recipient}
                    onChange={(event) => setRecipient(event.target.value)}
                    placeholder="G..."
                    className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                    disabled={!canSend || isSending}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="wallet-amount">Amount</Label>
                  <Input
                    id="wallet-amount"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="border-white/10 bg-slate-950 text-white placeholder:text-slate-500"
                    disabled={!canSend || isSending}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
                  <p>
                    {selectedBalance
                      ? `Sending ${selectedBalance.assetCode} from your connected Stellar wallet.`
                      : "Choose a spendable asset to unlock sending."}
                  </p>
                  <Button
                    type="button"
                    className="rounded-full bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300"
                    disabled={!canSend || !account?.exists || isSending}
                    onClick={() => void handleSend()}
                  >
                    {isSending ? (
                      <LoaderCircle className="mr-2 size-4 animate-spin" />
                    ) : (
                      <ArrowUpRight className="mr-2 size-4" />
                    )}
                    Send
                  </Button>
                </div>

                <p className="text-xs text-slate-500">
                  Transfers here are standard wallet-to-wallet Stellar sends. If the destination needs a memo, complete that transfer from the wallet directly instead.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
