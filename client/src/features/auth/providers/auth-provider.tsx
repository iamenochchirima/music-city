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
import {
  getAuthToken,
  useDynamicContext,
  useDynamicModals,
} from "@dynamic-labs/sdk-react-core";
import { toast } from "sonner";

import type { AuthSession } from "@music-city/shared";

import { usersApi } from "@/features/users/lib/users-api";
import { clientEnv } from "@/lib/config/env";
import { authApi } from "../lib/auth-api";

type AuthContextValue = {
  session: AuthSession | null;
  isLoading: boolean;
  error: string | null;
  connectWallet: () => Promise<void>;
  refreshSessionProfile: () => Promise<void>;
  logout: () => Promise<void>;
};

const AUTH_STORAGE_KEY = "music-city-auth-session";
const DYNAMIC_FAILED_SYNC_KEY = "music-city-dynamic-failed-sync-key";
const DYNAMIC_SYNC_RETRY_COUNT = 12;
const DYNAMIC_SYNC_RETRY_DELAY_MS = 250;

export const DYNAMIC_AUTH_SUCCESS_EVENT = "music-city:dynamic-auth-success";
export const DYNAMIC_AUTH_FAILURE_EVENT = "music-city:dynamic-auth-failure";
export const DYNAMIC_AUTH_CANCEL_EVENT = "music-city:dynamic-auth-cancel";

const AuthContext = createContext<AuthContextValue | null>(null);

const redactToken = (token?: string | null) =>
  token ? `${token.slice(0, 10)}...${token.slice(-6)} (${token.length})` : null;

const logDynamicAuth = (_label: string, _payload?: Record<string, unknown>) => {};

const readStoredSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
};

const persistSession = (session: AuthSession | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
};

const readFailedSyncKey = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(DYNAMIC_FAILED_SYNC_KEY);
};

const persistFailedSyncKey = (syncKey: string | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!syncKey) {
    window.localStorage.removeItem(DYNAMIC_FAILED_SYNC_KEY);
    return;
  }

  window.localStorage.setItem(DYNAMIC_FAILED_SYNC_KEY, syncKey);
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const redirectToLandingPage = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.location.assign("/");
};

const isStellarAddress = (value?: string | null) =>
  typeof value === "string" && value.startsWith("G");

type DynamicCredentialLike = {
  address?: string | null;
  publicIdentifier?: string | null;
  public_identifier?: string | null;
  chain?: string | null;
};

const normalizeCredentialAddress = (credential: DynamicCredentialLike) =>
  credential.address ??
  credential.publicIdentifier ??
  credential.public_identifier ??
  "";

const findStellarCredentialAddress = (
  user:
    | {
        verifiedCredentials?: DynamicCredentialLike[];
      }
    | null
    | undefined,
) =>
  normalizeCredentialAddress(
    user?.verifiedCredentials?.find(
      (credential) =>
        credential.chain?.toLowerCase().includes("stellar") &&
        normalizeCredentialAddress(credential),
    ) ?? {},
  ) || undefined;

const useBaseSessionState = () => {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastSyncedKeyRef = useRef<string | null>(null);
  const failedSyncKeyRef = useRef<string | null>(null);
  const syncInFlightRef = useRef(false);
  const autoProfileRefreshTokenRef = useRef<string | null>(null);

  useEffect(() => {
    setSession(readStoredSession());
    failedSyncKeyRef.current = readFailedSyncKey();
    setIsLoading(false);
  }, []);

  const clearSession = useCallback(() => {
    setSession(null);
    setError(null);
    persistSession(null);
    lastSyncedKeyRef.current = null;
    failedSyncKeyRef.current = null;
    syncInFlightRef.current = false;
    autoProfileRefreshTokenRef.current = null;
    persistFailedSyncKey(null);
  }, []);

  return {
    session,
    setSession,
    isLoading,
    setIsLoading,
    error,
    setError,
    clearSession,
    lastSyncedKeyRef,
    failedSyncKeyRef,
    syncInFlightRef,
    autoProfileRefreshTokenRef,
  };
};

const FallbackAuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    session,
    setSession,
    isLoading,
    error,
    setError,
    clearSession,
    autoProfileRefreshTokenRef,
  } = useBaseSessionState();

  const refreshSessionProfile = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    const profile = await usersApi.getMe(session.token);

    if (!profile) {
      return;
    }

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
      profileCompletion:
        onboarding?.profileCompletion ?? session.profileCompletion,
    };

    setSession(nextSession);
    persistSession(nextSession);
  }, [session, setSession]);

  useEffect(() => {
    if (
      !session?.token ||
      autoProfileRefreshTokenRef.current === session.token
    ) {
      return;
    }

    autoProfileRefreshTokenRef.current = session.token;

    void refreshSessionProfile().catch(() => {
      autoProfileRefreshTokenRef.current = null;
    });
  }, [
    autoProfileRefreshTokenRef,
    refreshSessionProfile,
    session?.token,
  ]);

  const connectWallet = useCallback(async () => {
    const message =
      "Dynamic is not configured. Set VITE_DYNAMIC_ENVIRONMENT_ID first.";

    setError(message);
    toast.error(message);
  }, [setError]);

  const logout = useCallback(async () => {
    clearSession();
    redirectToLandingPage();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      error,
      connectWallet,
      refreshSessionProfile,
      logout,
    }),
    [connectWallet, error, isLoading, logout, refreshSessionProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const DynamicAuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    sdkHasLoaded,
    user,
    userWithMissingInfo,
    primaryWallet,
    showAuthFlow,
    setShowAuthFlow,
    handleLogOut,
  } = useDynamicContext();
  const { setShowLinkNewWalletModal } = useDynamicModals();
  const {
    session,
    setSession,
    isLoading,
    setIsLoading,
    error,
    setError,
    clearSession,
    lastSyncedKeyRef,
    failedSyncKeyRef,
    syncInFlightRef,
    autoProfileRefreshTokenRef,
  } = useBaseSessionState();
  const userRef = useRef(user);
  const primaryWalletRef = useRef(primaryWallet);

  useEffect(() => {
    userRef.current = user;
    logDynamicAuth("user changed", {
      sdkHasLoaded,
      hasUser: Boolean(user),
      userId: user?.userId ?? null,
      email: user?.email ?? null,
      verifiedCredentials: user?.verifiedCredentials?.map((credential) => ({
        chain: credential.chain ?? null,
        hasAddress: Boolean(normalizeCredentialAddress(credential)),
        addressPrefix: normalizeCredentialAddress(credential).slice(0, 8) || null,
      })),
    });
  }, [user]);

  useEffect(() => {
    primaryWalletRef.current = primaryWallet;
    logDynamicAuth("primary wallet changed", {
      hasPrimaryWallet: Boolean(primaryWallet),
      address: primaryWallet?.address ?? null,
      connectorName: primaryWallet?.connector?.name ?? null,
      chain: primaryWallet?.chain ?? null,
    });
  }, [primaryWallet]);

  const refreshSessionProfile = useCallback(async () => {
    if (!session?.token) {
      return;
    }

    const profile = await usersApi.getMe(session.token);

    if (!profile) {
      return;
    }

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
      profileCompletion:
        onboarding?.profileCompletion ?? session.profileCompletion,
    };

    setSession(nextSession);
    persistSession(nextSession);
  }, [session, setSession]);

  useEffect(() => {
    if (
      !session?.token ||
      autoProfileRefreshTokenRef.current === session.token
    ) {
      return;
    }

    autoProfileRefreshTokenRef.current = session.token;

    void refreshSessionProfile().catch(() => {
      autoProfileRefreshTokenRef.current = null;
    });
  }, [
    autoProfileRefreshTokenRef,
    refreshSessionProfile,
    session?.token,
  ]);

  const waitForDynamicWalletAddress = useCallback(async () => {
    for (let attempt = 0; attempt < DYNAMIC_SYNC_RETRY_COUNT; attempt += 1) {
      const address = primaryWalletRef.current?.address;

      logDynamicAuth("wallet wait attempt", {
        attempt: attempt + 1,
        hasAddress: Boolean(address),
        address,
      });

      if (address) {
        return address;
      }

      await delay(DYNAMIC_SYNC_RETRY_DELAY_MS);
    }

    return null;
  }, []);

  const resolveRequestedWalletAddress = useCallback(
    (address: string | null) => {
      if (isStellarAddress(address)) {
        return address;
      }

      return findStellarCredentialAddress(userRef.current) ?? undefined;
    },
    [],
  );

  const waitForDynamicToken = useCallback(async () => {
    for (let attempt = 0; attempt < DYNAMIC_SYNC_RETRY_COUNT; attempt += 1) {
      const token = getAuthToken();

      logDynamicAuth("token wait attempt", {
        attempt: attempt + 1,
        token: redactToken(token),
      });

      if (token) {
        return token;
      }

      await delay(DYNAMIC_SYNC_RETRY_DELAY_MS);
    }

    return null;
  }, []);

  const syncDynamicSession = useCallback(async () => {
    logDynamicAuth("sync requested", {
      sdkHasLoaded,
      syncInFlight: syncInFlightRef.current,
      hasUser: Boolean(userRef.current),
      hasSession: Boolean(session),
      showAuthFlow,
    });

    if (!sdkHasLoaded) {
      logDynamicAuth("sync skipped: sdk not loaded");
      return;
    }

    if (syncInFlightRef.current) {
      logDynamicAuth("sync skipped: already in flight");
      return;
    }

    const currentUser = userRef.current;
    const stellarCredentialAddress = findStellarCredentialAddress(currentUser);

    logDynamicAuth("sync user snapshot", {
      userId: currentUser?.userId ?? null,
      email: currentUser?.email ?? null,
      userWithMissingInfo: Boolean(userWithMissingInfo),
      stellarCredentialAddress,
      verifiedCredentialCount: currentUser?.verifiedCredentials?.length ?? 0,
      verifiedCredentials: currentUser?.verifiedCredentials?.map((credential) => ({
        chain: credential.chain ?? null,
        hasAddress: Boolean(normalizeCredentialAddress(credential)),
        addressPrefix: normalizeCredentialAddress(credential).slice(0, 8) || null,
      })),
    });

    if (!currentUser) {
      logDynamicAuth("sync stopped: no current user");
      setIsLoading(false);
      return;
    }

    if (userWithMissingInfo && !stellarCredentialAddress) {
      const message =
        "Dynamic login is incomplete. No Stellar wallet credential is present in the verified token yet.";

      setError(message);
      setIsLoading(false);
      logDynamicAuth("sync stopped: missing Stellar credential", { message });
      return;
    }

    syncInFlightRef.current = true;
    const walletAddress = await waitForDynamicWalletAddress();
    const requestedWalletAddress =
      resolveRequestedWalletAddress(walletAddress) ?? stellarCredentialAddress;

    if (!walletAddress && !requestedWalletAddress) {
      logDynamicAuth(
        "sync continuing without client wallet address; backend will inspect token",
      );
    }

    const dynamicToken = await waitForDynamicToken();

    if (!dynamicToken) {
      logDynamicAuth("sync stopped: no token after wait");
      setError("Dynamic login succeeded, but no Dynamic auth token is available yet.");
      setIsLoading(false);
      syncInFlightRef.current = false;
      return;
    }

    const syncKey = `${currentUser.userId ?? currentUser.email ?? "user"}:${
      walletAddress ?? requestedWalletAddress ?? "token-only"
    }`;

    logDynamicAuth("sync key resolved", {
      syncKey,
      walletAddress,
      requestedWalletAddress,
      lastSyncedKey: lastSyncedKeyRef.current,
      failedSyncKey: failedSyncKeyRef.current,
      dynamicToken: redactToken(dynamicToken),
    });

    if (
      lastSyncedKeyRef.current === syncKey &&
      (!walletAddress || session?.walletAddress === walletAddress)
    ) {
      logDynamicAuth("sync skipped: already synced", {
        syncKey,
        sessionWallet: session?.walletAddress ?? null,
      });
      setIsLoading(false);
      return;
    }

    if (failedSyncKeyRef.current === syncKey) {
      logDynamicAuth("sync skipped: cached failed sync key", { syncKey });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      logDynamicAuth("backend session request", {
        requestedWalletAddress,
        token: redactToken(dynamicToken),
      });
      const verifiedSession = await authApi.createDynamicSession(
        requestedWalletAddress ? { walletAddress: requestedWalletAddress } : {},
        dynamicToken,
      );

      logDynamicAuth("backend session success", {
        walletAddress: verifiedSession.walletAddress,
        displayName: verifiedSession.displayName,
        onboardingStatus: verifiedSession.onboardingStatus,
      });
      setSession(verifiedSession);
      persistSession(verifiedSession);
      lastSyncedKeyRef.current = syncKey;
      failedSyncKeyRef.current = null;
      persistFailedSyncKey(null);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Social login session failed";

      if (
        message.includes("Requested Stellar wallet is not linked to this Dynamic user") ||
        message.includes("No Stellar wallet is linked to this account")
      ) {
        failedSyncKeyRef.current = syncKey;
        persistFailedSyncKey(syncKey);
      }
      logDynamicAuth("backend session failed", {
        message,
        syncKey,
      });
      setError(message);
      toast.error(message);
    } finally {
      syncInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [
    lastSyncedKeyRef,
    failedSyncKeyRef,
    sdkHasLoaded,
    session?.walletAddress,
    setError,
    setIsLoading,
    setSession,
    resolveRequestedWalletAddress,
    syncInFlightRef,
    waitForDynamicToken,
    waitForDynamicWalletAddress,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleAuthSuccess = () => {
      logDynamicAuth("event: auth success");
      failedSyncKeyRef.current = null;
      persistFailedSyncKey(null);
      setError(null);
      setIsLoading(true);
      void syncDynamicSession();
    };

    const handleAuthStop = () => {
      logDynamicAuth("event: auth stopped");
      setIsLoading(false);
    };

    window.addEventListener(DYNAMIC_AUTH_SUCCESS_EVENT, handleAuthSuccess);
    window.addEventListener(DYNAMIC_AUTH_FAILURE_EVENT, handleAuthStop);
    window.addEventListener(DYNAMIC_AUTH_CANCEL_EVENT, handleAuthStop);

    return () => {
      window.removeEventListener(DYNAMIC_AUTH_SUCCESS_EVENT, handleAuthSuccess);
      window.removeEventListener(DYNAMIC_AUTH_FAILURE_EVENT, handleAuthStop);
      window.removeEventListener(DYNAMIC_AUTH_CANCEL_EVENT, handleAuthStop);
    };
  }, [setError, setIsLoading, syncDynamicSession]);

  useEffect(() => {
    if (!sdkHasLoaded) {
      return;
    }

    if (user && showAuthFlow) {
      logDynamicAuth("closing auth flow after Dynamic user resolved", {
        userId: user.userId ?? null,
      });
      setShowAuthFlow(false);
    }

    if (user && !session) {
      logDynamicAuth("effect sync trigger", {
        reason: "user without app session",
        userId: user.userId ?? null,
        primaryWalletAddress: primaryWallet?.address ?? null,
      });
      setIsLoading(true);
      void syncDynamicSession();
      return;
    }

    if (!showAuthFlow) {
      setIsLoading(false);
    }
  }, [
    primaryWallet?.address,
    sdkHasLoaded,
    session,
    setIsLoading,
    setShowAuthFlow,
    showAuthFlow,
    syncDynamicSession,
    user,
  ]);

  useEffect(() => {
    if (!sdkHasLoaded || showAuthFlow || user) {
      return;
    }

    clearSession();
    setIsLoading(false);
  }, [clearSession, sdkHasLoaded, setIsLoading, showAuthFlow, user]);

  const connectWallet = useCallback(async () => {
    logDynamicAuth("connect requested", {
      sdkHasLoaded,
      hasUser: Boolean(user),
      showAuthFlow,
      environmentId: clientEnv.dynamicEnvironmentId,
    });
    setError(null);
    setIsLoading(true);
    if (user) {
      setShowLinkNewWalletModal(true);
      return;
    }

    setShowAuthFlow(true);
  }, [setError, setIsLoading, setShowAuthFlow, setShowLinkNewWalletModal, user]);

  const logout = useCallback(async () => {
    clearSession();
    await handleLogOut();
    redirectToLandingPage();
  }, [clearSession, handleLogOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      error,
      connectWallet,
      refreshSessionProfile,
      logout,
    }),
    [connectWallet, error, isLoading, logout, refreshSessionProfile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  if (!clientEnv.isDynamicConfigured) {
    return <FallbackAuthProvider>{children}</FallbackAuthProvider>;
  }

  return <DynamicAuthProvider>{children}</DynamicAuthProvider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }

  return context;
};
