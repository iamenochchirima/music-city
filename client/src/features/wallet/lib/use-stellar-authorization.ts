import { useCallback, useEffect, useRef } from "react";
import { useDynamicContext, useStepUpAuthentication } from "@dynamic-labs/sdk-react-core";
import { TokenScope } from "@dynamic-labs/sdk-api-core";
import type { StellarWallet } from "@dynamic-labs/stellar";
import { ensureActiveStellarAccount } from "./resolve-stellar-wallet";

function waitForAuthorization({
  prompt,
  isRequired,
  closePrompt,
  signal,
}: {
  prompt: Promise<unknown>;
  isRequired: () => Promise<boolean>;
  closePrompt: () => void;
  signal: AbortSignal;
}) {
  return new Promise<void>((resolve, reject) => {
    let finished = false;
    let pollTimer: ReturnType<typeof setTimeout>;
    const finish = (error?: unknown) => {
      if (finished) return false;
      finished = true;
      clearTimeout(pollTimer);
      clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve();
      return true;
    };
    const cancel = () => finish(new Error("Wallet authorization cancelled"));
    const timeout = setTimeout(() => {
      if (finish(new Error("Wallet authorization timed out. Please try signing again."))) {
        closePrompt();
      }
    }, 120_000);
    const poll = async () => {
      try {
        // OAuth can grant the scoped token without settling the SDK modal promise.
        const required = await isRequired();
        if (!required && finish()) closePrompt();
      } catch {
        // A failed readiness check never authorizes signing.
      }
      if (!finished) pollTimer = setTimeout(poll, 1_000);
    };
    signal.addEventListener("abort", cancel, { once: true });
    // Keep both handlers attached even if polling wins, including modal-close rejection.
    void prompt.then(() => finish(), (error) => finish(error));
    if (signal.aborted) cancel();
    if (!finished) pollTimer = setTimeout(poll, 1_000);
  });
}

/** Custom signing actions must request the provider's scoped authorization. */
export function useStellarAuthorization() {
  const { isStepUpRequired, promptStepUpAuth } = useStepUpAuthentication();
  const { setShowAuthFlow, primaryWallet } = useDynamicContext();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [primaryWallet?.address]);
  return useCallback(async (wallet: StellarWallet) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const requireActiveRequest = () => {
      if (controller.signal.aborted) throw new Error("Wallet authorization cancelled");
    };
    try {
      await ensureActiveStellarAccount(wallet);
      requireActiveRequest();
      const required = await isStepUpRequired({ scope: TokenScope.Walletsign });
      requireActiveRequest();
      if (required) {
        await waitForAuthorization({
          prompt: promptStepUpAuth({ requestedScopes: [TokenScope.Walletsign] }),
          isRequired: () => isStepUpRequired({ scope: TokenScope.Walletsign }),
          closePrompt: () => setShowAuthFlow(false),
          signal: controller.signal,
        });
      }
      requireActiveRequest();
    } catch (error) {
      if (error instanceof Error && /reauthentication flow closed|cancel/i.test(error.message)) {
        throw new Error("Wallet authorization cancelled");
      }
      throw error;
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [isStepUpRequired, promptStepUpAuth, setShowAuthFlow]);
}
