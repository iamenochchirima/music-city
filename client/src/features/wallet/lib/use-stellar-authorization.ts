import { useCallback } from "react";
import { useStepUpAuthentication } from "@dynamic-labs/sdk-react-core";
import { TokenScope } from "@dynamic-labs/sdk-api-core";
import type { StellarWallet } from "@dynamic-labs/stellar";
import { ensureActiveStellarAccount } from "./resolve-stellar-wallet";

/** Custom signing actions must request the provider's scoped authorization. */
export function useStellarAuthorization() {
  const { isStepUpRequired, promptStepUpAuth } = useStepUpAuthentication();
  return useCallback(async (wallet: StellarWallet) => {
    await ensureActiveStellarAccount(wallet);
    if (await isStepUpRequired({ scope: TokenScope.Walletsign })) {
      try {
        // The SDK stores the scoped token and resolves without a return value.
        await promptStepUpAuth({ requestedScopes: [TokenScope.Walletsign] });
      } catch (error) {
        if (error instanceof Error && /reauthentication flow closed|cancel/i.test(error.message)) {
          throw new Error("Wallet authorization cancelled");
        }
        throw error;
      }
    }
  }, [isStepUpRequired, promptStepUpAuth]);
}
