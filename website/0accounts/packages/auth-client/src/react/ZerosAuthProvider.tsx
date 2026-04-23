// ============================================
// COMPONENT: ZerosAuthProvider
// PURPOSE: React context provider that manages auth state for any zeros product
// USED IN: Root of every zeros product (App.tsx or main.tsx)
//
// SESSION RESTORE STRATEGY (anti-flicker, matches 0colors pattern):
//   Stage 1 (sync): Immediately restore session + user from localStorage on mount.
//                    This prevents any flash of "not authenticated" or "access denied".
//   Stage 2 (async): Verify with Supabase + 0accounts in background.
//                     If session is invalid, clear it. If valid, silently update.
// ============================================

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ZerosAuthConfig, ZerosSession, ZerosUser } from "../types.js";
import { resolveConfig, SESSION_STORAGE_KEY } from "../config.js";
import { getSupabase } from "../client.js";
import { getSession, onAuthStateChange, signOut as authSignOut } from "../auth.js";
import { verifyWithAccounts } from "../api.js";
import { redirectToLogin } from "../redirect.js";

// --- CONTEXT TYPE ---

export interface ZerosAuthContextValue {
  session: ZerosSession | null;
  user: ZerosUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  redirectToLogin: () => void;
  refreshSession: () => Promise<void>;
}

export const ZerosAuthContext = createContext<ZerosAuthContextValue | null>(null);

// --- STORAGE KEYS ---

/** Supabase's own session storage (access_token, refresh_token, user) */
const SUPABASE_SESSION_KEY = SESSION_STORAGE_KEY;

/** Our verified user cache (includes isAdmin, role — survives page navigations) */
const VERIFIED_USER_KEY = "zeros-verified-user";

// --- HELPERS ---

/** Save verified user to localStorage for instant restore on next page load. */
function cacheVerifiedUser(user: ZerosUser): void {
  try {
    localStorage.setItem(VERIFIED_USER_KEY, JSON.stringify(user));
  } catch { /* storage full or blocked */ }
}

/** Read cached verified user from localStorage (synchronous). */
function restoreVerifiedUser(): ZerosUser | null {
  try {
    const raw = localStorage.getItem(VERIFIED_USER_KEY);
    if (!raw || raw === "null") return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Clear cached verified user (on sign-out). */
function clearVerifiedUser(): void {
  try {
    localStorage.removeItem(VERIFIED_USER_KEY);
  } catch { /* ignore */ }
}

/** Read Supabase session from localStorage (synchronous — no network call). */
function restoreSessionFromStorage(cachedUser: ZerosUser | null): ZerosSession | null {
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_KEY);
    if (!raw || raw === "null") return null;
    const data = JSON.parse(raw);
    if (data?.access_token && data?.user) {
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || "",
        userId: data.user.id,
        email: data.user.email || "",
        name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "",
        // Restore isAdmin from cached verified user (instant, no API call needed)
        isAdmin: cachedUser?.isAdmin ?? false,
        expiresAt: data.expires_at || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// --- COMPONENT ---

interface ZerosAuthProviderProps {
  config: ZerosAuthConfig;
  children: React.ReactNode;
}

export function ZerosAuthProvider({ config, children }: ZerosAuthProviderProps) {
  const resolvedConfig = useMemo(() => resolveConfig(config), [config]);

  // Stage 1: Sync restore from localStorage — prevents auth AND admin flash
  const cachedUser = useMemo(() => restoreVerifiedUser(), []);
  const cachedSession = useMemo(() => restoreSessionFromStorage(cachedUser), []);

  const [session, setSession] = useState<ZerosSession | null>(cachedSession);
  const [user, setUser] = useState<ZerosUser | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedSession);

  // Prevent double-init in React Strict Mode
  const initRef = useRef(false);

  // Initialize Supabase client
  useEffect(() => {
    getSupabase(resolvedConfig.supabaseUrl, resolvedConfig.supabaseAnonKey);
  }, [resolvedConfig.supabaseUrl, resolvedConfig.supabaseAnonKey]);

  // Verify session with 0accounts and update user/admin flag
  const verifySession = useCallback(
    async (currentSession: ZerosSession) => {
      try {
        const verified = await verifyWithAccounts(
          currentSession.accessToken,
          resolvedConfig.productId,
          resolvedConfig.accountsApiUrl,
        );
        if (verified?.valid) {
          setUser(verified.user);
          // Cache for instant restore on next page load
          cacheVerifiedUser(verified.user);
          setSession((prev) =>
            prev ? { ...prev, isAdmin: verified.user.isAdmin } : prev,
          );
        }
      } catch {
        // Verification failed — session is still valid locally, just unverified
      }
    },
    [resolvedConfig],
  );

  // Stage 2: Async verification with Supabase + 0accounts
  const initAuth = useCallback(async () => {
    if (initRef.current) return;
    initRef.current = true;

    try {
      const currentSession = await getSession();

      if (currentSession) {
        setSession(currentSession);
        setLoading(false);
        await verifySession(currentSession);
      } else if (cachedSession) {
        // localStorage had a session but Supabase says no — session expired
        setSession(null);
        setUser(null);
        clearVerifiedUser();
        setLoading(false);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [resolvedConfig, verifySession, cachedSession]);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Listen for ongoing auth state changes
  useEffect(() => {
    const { unsubscribe } = onAuthStateChange((event, newSession) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        clearVerifiedUser();
      } else if (event === "TOKEN_REFRESHED" && newSession) {
        setSession((prev) => ({
          ...newSession,
          isAdmin: prev?.isAdmin ?? false,
        }));
      } else if (event === "SIGNED_IN" && newSession) {
        setSession(newSession);
        setLoading(false);
        verifySession(newSession);
      }
    });
    return unsubscribe;
  }, [resolvedConfig, verifySession]);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setUser(null);
    clearVerifiedUser();
  }, []);

  const handleRedirectToLogin = useCallback(() => {
    redirectToLogin(resolvedConfig.productId, resolvedConfig.loginUrl);
  }, [resolvedConfig]);

  const handleRefreshSession = useCallback(async () => {
    const currentSession = await getSession();
    if (currentSession) {
      setSession(currentSession);
    }
  }, []);

  const value = useMemo<ZerosAuthContextValue>(
    () => ({
      session,
      user,
      loading,
      isAuthenticated: !!session,
      signOut: handleSignOut,
      redirectToLogin: handleRedirectToLogin,
      refreshSession: handleRefreshSession,
    }),
    [session, user, loading, handleSignOut, handleRedirectToLogin, handleRefreshSession],
  );

  return (
    <ZerosAuthContext.Provider value={value}>
      {children}
    </ZerosAuthContext.Provider>
  );
}
