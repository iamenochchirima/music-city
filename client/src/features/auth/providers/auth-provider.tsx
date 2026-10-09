"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import type { AuthSession } from "@music-city/shared";

import { usersApi } from "@/features/users/lib/users-api";
import { bindReferralWallet, clearReferral } from "@/features/referrals/referral-storage";
import { signInWithFreighter } from "@/features/wallet/lib/freighter";

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  walletSignInTimedOut: boolean;
  connectWallet: () => Promise<void>;
  refreshSessionProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AUTH_STORAGE_KEY = "music-city-auth-session";
const WALLET_SIGN_IN_TIMEOUT_MS = 30_000;
const WALLET_SIGN_IN_TIMEOUT_MESSAGE =
  "Freighter did not respond in time. Check that the extension is available and close any pending wallet prompt, then reload this page to try again.";
const AuthContext = createContext<AuthContextValue | null>(null);

const readStoredSession = () => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const persistSession = (session: AuthSession | null) => {
  if (typeof window === "undefined") return;
  if (session) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  }
};

const redirectToLandingPage = () => {
  if (typeof window !== "undefined") window.location.assign("/");
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [walletSignInTimedOut, setWalletSignInTimedOut] = useState(false);
  const profileRefreshTokenRef = useRef<string | null>(null);
  const walletSignInInProgressRef = useRef(false);
  const walletSignInControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setSession(readStoredSession());
    setIsLoading(false);
  }, []);

  useEffect(
    () => () => {
      walletSignInControllerRef.current?.abort(
        new Error("Wallet sign-in was interrupted"),
      );
    },
    [],
  );

  const refreshSessionProfile = useCallback(async () => {
    if (!session?.token) return;

    const profile = await usersApi.getMe(session.token);
    if (!profile) return;
    const onboarding = await usersApi.getOnboardingState(session.token);
    const nextSession: AuthSession = {
      ...session,
      email: profile.email,
      displayName: profile.displayName,
      primaryIntent: profile.primaryIntent,
      artistAccess: profile.artistAccess,
      profileImageUrl: profile.profileImageUrl,
      headerImageUrl: profile.headerImageUrl,
      onboardingStatus: profile.onboardingStatus,
      onboardingStep: profile.onboardingStep,
      onboardingVersion: profile.onboardingVersion,
      onboardingCompletedAt: profile.onboardingCompletedAt,
      profileCompletion: onboarding?.profileCompletion ?? session.profileCompletion,
    };
    setSession(nextSession);
    persistSession(nextSession);
  }, [session]);

  useEffect(() => {
    if (!session?.token || profileRefreshTokenRef.current === session.token) return;
    profileRefreshTokenRef.current = session.token;
    void refreshSessionProfile().catch(() => {
      profileRefreshTokenRef.current = null;
    });
  }, [refreshSessionProfile, session?.token]);

  const connectWallet = useCallback(async () => {
    if (walletSignInInProgressRef.current || walletSignInTimedOut) return;

    const controller = new AbortController();
    walletSignInControllerRef.current = controller;
    walletSignInInProgressRef.current = true;
    const timeoutId = window.setTimeout(() => {
      controller.abort(new Error(WALLET_SIGN_IN_TIMEOUT_MESSAGE));
    }, WALLET_SIGN_IN_TIMEOUT_MS);

    setError(null);
    setIsLoading(true);
    try {
      const nextSession = await signInWithFreighter(controller.signal);
      bindReferralWallet(nextSession.walletAddress);
      setSession(nextSession);
      persistSession(nextSession);
      profileRefreshTokenRef.current = nextSession.token ?? null;
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Stellar wallet sign-in failed";
      if (controller.signal.aborted) setWalletSignInTimedOut(true);
      setError(message);
      toast.error(message);
    } finally {
      window.clearTimeout(timeoutId);
      if (walletSignInControllerRef.current === controller) {
        walletSignInControllerRef.current = null;
      }
      walletSignInInProgressRef.current = false;
      setIsLoading(false);
    }
  }, [walletSignInTimedOut]);

  const logout = useCallback(async () => {
    clearReferral();
    setSession(null);
    setError(null);
    profileRefreshTokenRef.current = null;
    persistSession(null);
    redirectToLandingPage();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      error,
      walletSignInTimedOut,
      connectWallet,
      refreshSessionProfile,
      logout,
    }),
    [
      connectWallet,
      error,
      isLoading,
      logout,
      refreshSessionProfile,
      session,
      walletSignInTimedOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuthContext must be used within AuthProvider");
  return context;
};
