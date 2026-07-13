"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { walletApi } from "@/features/wallet/lib/wallet-api";
import {
  ensureActiveStellarAccount,
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
        await ensureActiveStellarAccount(stellarWallet);
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
    <Card className="border-white/10 bg-white/5 text-white shadow-none">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Wallet className="size-5 text-emerald-300" />
              <CardTitle className="text-2xl">Wallet</CardTitle>
            </div>
            <p className="text-sm text-slate-400">
              Track your Stellar balances, send funds, and copy your receive address.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
            disabled={isLoading}
            onClick={() => void load()}
          >
            {isLoading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Receive</p>
              <p className="font-medium text-white">
                {session?.walletAddress ? shortenAddress(session.walletAddress) : "Wallet unavailable"}
              </p>
            </div>
            <Button
              type="button"
              className="rounded-full bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300"
              onClick={() => void handleCopyAddress()}
            >
              {copied ? <Check className="mr-2 size-4" /> : <Copy className="mr-2 size-4" />}
              {copied ? "Copied" : "Copy address"}
            </Button>
          </div>
          <p className="mt-3 break-all text-sm text-slate-300">{session?.walletAddress}</p>
        </div>

        {error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        {!isLoading && account && !account.exists ? (
          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            This Stellar address is not funded on the current network yet, so balances and sends stay unavailable until it receives its first deposit.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4">
          <div>
            <p className="text-base font-medium text-white">Need test tokens?</p>
            <p className="mt-1 max-w-md text-sm leading-6 text-slate-300">
              Copy your wallet address above, then fund it with testnet XLM through
              Stellar Lab. Test tokens have no real-world value.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/15 hover:text-white"
          >
            <a
              href="https://lab.stellar.org/account/fund"
              target="_blank"
              rel="noreferrer"
            >
              Open testnet faucet
              <ExternalLink className="ml-2 size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Assets</p>
            <p className="mt-2 text-3xl font-semibold text-white">
              {account?.balances.length ?? 0}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">XLM</p>
            <p className="mt-2 break-all text-[2rem] font-semibold leading-none text-white sm:text-3xl">
              {formatMetricBalance(xlmBalance?.amount)}
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">USDC</p>
            <p className="mt-2 break-all text-[2rem] font-semibold leading-none text-white sm:text-3xl">
              {formatMetricBalance(usdcBalance?.amount)}
            </p>
          </div>
        </div>

        {!hasUsdcTrustline ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <div>
              <p className="text-base font-medium text-white">Enable testnet USDC</p>
              <p className="mt-1 text-sm text-slate-300">
                Add the Stellar trustline once, then you can receive faucet USDC directly in this wallet.
              </p>
              {isAddingUsdcTrustline ? (
                <p className="mt-3 text-sm text-emerald-100">
                  Waiting for wallet approval to add the {clientEnv.stellarTestnetUsdcCode} trustline.
                </p>
              ) : null}
              {isTrustlineApprovalSlow ? (
                <p className="mt-2 text-xs text-emerald-100/80">
                  If nothing popped up, unlock your connected wallet or reopen the Dynamic wallet prompt, then try again.
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              className="rounded-full bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300"
              disabled={!account?.exists || isAddingUsdcTrustline}
              onClick={() => void handleAddUsdcTrustline()}
            >
              {isAddingUsdcTrustline ? (
                <LoaderCircle className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              Add USDC trustline
            </Button>
          </div>
        ) : (
          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
            <p className="text-sm font-medium text-white">Testnet USDC is enabled</p>
            <p className="mt-1 text-sm text-slate-400">
              Your wallet already trusts {clientEnv.stellarTestnetUsdcCode}, so the faucet can send it here immediately.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/10 bg-slate-950/70 p-4">
          <div>
            <p className="text-base font-medium text-white">Send funds</p>
            <p className="mt-1 text-sm text-slate-400">
              Open the transfer form only when you need to move XLM or tokens out.
            </p>
          </div>
          <Button
            type="button"
            className="rounded-full bg-emerald-400 px-4 text-slate-950 hover:bg-emerald-300"
            disabled={!account?.exists || !canSend}
            onClick={() => setIsSendModalOpen(true)}
          >
            <Send className="mr-2 size-4" />
            Send
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-white">Balances</p>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
              Spendable first
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
              Loading wallet balances...
            </div>
          ) : account?.balances.length ? (
            account.balances.map((balance) => (
              <div
                key={balance.assetKey}
                className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-slate-950/70 p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-base font-medium text-white">{assetLabel(balance)}</p>
                    {balance.assetCode === "USDC" ? (
                      <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[11px] uppercase tracking-[0.18em] text-emerald-200">
                        Stablecoin
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-slate-400">
                    {balance.isNative
                      ? "Native Stellar lumens"
                      : balance.assetIssuer
                        ? `Issuer ${shortenAddress(balance.assetIssuer)}`
                        : "Issued asset"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-white">
                    {formatBalance(balance.amount)} {balance.assetCode}
                  </p>
                  <p className="text-sm text-slate-400">
                    Spendable {formatBalance(balance.availableAmount)}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
              No Stellar balances found yet.
            </div>
          )}
        </div>

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
