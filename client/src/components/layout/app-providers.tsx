"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import {
  DynamicContextProvider,
  DynamicMultiWalletPromptsWidget,
} from "@dynamic-labs/sdk-react-core";
import { DynamicWaasStellarConnectors } from "@dynamic-labs/stellar";

import { ThemeProvider } from "@/components/common/theme-provider";
import {
  AuthProvider,
  DYNAMIC_AUTH_CANCEL_EVENT,
  DYNAMIC_AUTH_FAILURE_EVENT,
  DYNAMIC_AUTH_SUCCESS_EVENT,
} from "@/features/auth/providers/auth-provider";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";
import { GlobalPlaybackProvider } from "@/features/playback/providers/global-playback-provider";
import { clientEnv } from "@/lib/config/env";

const dispatchDynamicEvent = (name: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent(name));
};

export const AppProviders = ({ children }: { children: ReactNode }) => {
  const [redirectOrigin, setRedirectOrigin] = useState<string | null>(null);

  useEffect(() => {
    const origin = window.location.origin;
    setRedirectOrigin(origin);
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {clientEnv.isDynamicConfigured ? (
        redirectOrigin ? (
          <DynamicContextProvider
            settings={{
              environmentId: clientEnv.dynamicEnvironmentId,
              redirectUrl: redirectOrigin,
            walletConnectors: [
              EthereumWalletConnectors,
              DynamicWaasStellarConnectors,
            ],
            social: {
              strategy: "redirect",
            },
            events: {
              onAuthSuccess: (_args) => {
                dispatchDynamicEvent(DYNAMIC_AUTH_SUCCESS_EVENT);
              },
              onAuthFailure: (_args) => {
                dispatchDynamicEvent(DYNAMIC_AUTH_FAILURE_EVENT);
              },
              onAuthFlowCancel: () => {
                dispatchDynamicEvent(DYNAMIC_AUTH_CANCEL_EVENT);
              },
            },
            }}
          >
            <AuthProvider>
              <GlobalPlaybackProvider>
                {children}
                <OnboardingGate />
              </GlobalPlaybackProvider>
            </AuthProvider>
            <DynamicMultiWalletPromptsWidget />
          </DynamicContextProvider>
        ) : null
      ) : (
        <AuthProvider>
          <GlobalPlaybackProvider>
            {children}
            <OnboardingGate />
          </GlobalPlaybackProvider>
        </AuthProvider>
      )}
    </ThemeProvider>
  );
};
