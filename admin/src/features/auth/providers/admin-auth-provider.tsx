import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  AdminAccount,
  AdminBootstrapStatus,
  AdminLoginInput,
  AdminSession,
  BootstrapAdminInput,
} from "@music-city/shared";

import { adminApi } from "@/features/auth/lib/admin-api";
import { ApiClientError } from "@/lib/api/http-client";

type StoredAdminSession = {
  admin: AdminAccount;
  session: AdminSession;
};

type AdminAuthContextValue = {
  admin: AdminAccount | null;
  session: AdminSession | null;
  bootstrapRequired: boolean | null;
  isLoading: boolean;
  login: (input: AdminLoginInput) => Promise<void>;
  bootstrapAdmin: (input: BootstrapAdminInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshBootstrapStatus: () => Promise<AdminBootstrapStatus>;
  refreshSession: () => Promise<void>;
};

const ADMIN_STORAGE_KEY = "music-city-admin-session";

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const readStoredSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(ADMIN_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as StoredAdminSession;
  } catch {
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    return null;
  }
};

const persistStoredSession = (value: StoredAdminSession | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!value) {
    window.localStorage.removeItem(ADMIN_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(value));
};

const isAuthError = (error: unknown) =>
  error instanceof ApiClientError &&
  (error.status === 401 || error.status === 403);

export const AdminAuthProvider = ({ children }: { children: ReactNode }) => {
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [bootstrapRequired, setBootstrapRequired] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuthResponse = useCallback(
    (payload: { admin: AdminAccount; session: AdminSession }) => {
      if (!payload.session.token) {
        throw new Error("Admin session response did not include a token");
      }

      setAdmin(payload.admin);
      setSession(payload.session);
      setBootstrapRequired(false);
      persistStoredSession(payload);
    },
    [],
  );

  const clearSession = useCallback(() => {
    setAdmin(null);
    setSession(null);
    persistStoredSession(null);
  }, []);

  const refreshBootstrapStatus = useCallback(async () => {
    const status = await adminApi.getBootstrapStatus();
    setBootstrapRequired(status.bootstrapRequired);
    return status;
  }, []);

  const refreshSession = useCallback(async () => {
    const token = readStoredSession()?.session?.token;

    if (!token) {
      clearSession();
      return;
    }

    try {
      const payload = await adminApi.getMe(token);
      applyAuthResponse(payload);
    } catch (error) {
      if (isAuthError(error)) {
        clearSession();
        throw error;
      }

      setBootstrapRequired(false);
    }
  }, [applyAuthResponse, clearSession]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const stored = readStoredSession();

      if (stored?.session?.token) {
        setAdmin(stored.admin);
        setSession(stored.session);
      }

      try {
        if (stored?.session?.token) {
          const payload = await adminApi.getMe(stored.session.token);

          if (!cancelled) {
            applyAuthResponse(payload);
          }
        } else {
          const status = await adminApi.getBootstrapStatus();

          if (!cancelled) {
            setBootstrapRequired(status.bootstrapRequired);
          }
        }
      } catch (error) {
        if (!cancelled) {
          if (isAuthError(error)) {
            clearSession();
            const status = await adminApi.getBootstrapStatus().catch(() => null);
            setBootstrapRequired(status?.bootstrapRequired ?? true);
          } else if (stored?.session?.token) {
            setBootstrapRequired(false);
          } else {
            const status = await adminApi.getBootstrapStatus().catch(() => null);
            setBootstrapRequired(status?.bootstrapRequired ?? true);
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void boot();

    return () => {
      cancelled = true;
    };
  }, [applyAuthResponse, clearSession]);

  const login = useCallback(
    async (input: AdminLoginInput) => {
      const payload = await adminApi.login(input);
      applyAuthResponse(payload);
    },
    [applyAuthResponse],
  );

  const bootstrapAdmin = useCallback(
    async (input: BootstrapAdminInput) => {
      const payload = await adminApi.bootstrap(input);
      applyAuthResponse(payload);
    },
    [applyAuthResponse],
  );

  const logout = useCallback(async () => {
    clearSession();
    const status = await adminApi.getBootstrapStatus().catch(() => null);
    setBootstrapRequired(status?.bootstrapRequired ?? false);
  }, [clearSession]);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      admin,
      session,
      bootstrapRequired,
      isLoading,
      login,
      bootstrapAdmin,
      logout,
      refreshBootstrapStatus,
      refreshSession,
    }),
    [
      admin,
      session,
      bootstrapRequired,
      isLoading,
      login,
      bootstrapAdmin,
      logout,
      refreshBootstrapStatus,
      refreshSession,
    ],
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used within an AdminAuthProvider");
  }

  return context;
};
