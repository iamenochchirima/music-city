"use client";

import type { ReactNode } from "react";

import { ThemeProvider } from "@/components/common/theme-provider";
import { AuthProvider } from "@/features/auth/providers/auth-provider";
import { OnboardingGate } from "@/features/onboarding/components/onboarding-gate";
import { GlobalPlaybackProvider } from "@/features/playback/providers/global-playback-provider";

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <AuthProvider>
      <GlobalPlaybackProvider>
        {children}
        <OnboardingGate />
      </GlobalPlaybackProvider>
    </AuthProvider>
  </ThemeProvider>
);
