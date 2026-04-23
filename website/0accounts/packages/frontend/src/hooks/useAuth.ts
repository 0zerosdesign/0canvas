// ============================================
// HOOK: useAuth
// PURPOSE: Manages Supabase auth session lifecycle
// USED IN: App.tsx (initialization), auth pages, ProtectedRoute
// ============================================

import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../store";
import { getSupabaseClient } from "../supabase/client";
import { verifyToken, getProfile } from "../api/accounts";
import { validateRedirectUrl } from "../lib/validate-redirect";
import type { AuthSession } from "../types";

const AUTH_SESSION_KEY = "0accounts-auth-session";

export function useAuth() {
  const {
    authSession,
    authChecking,
    setAuthSession,
    setAuthChecking,
    setProfile,
    clearAuth,
  } = useAppStore();

  // WORKFLOW: initAuth
  // TRIGGERED BY: App mount
  // WHAT IT DOES:
  // 1. Checks for existing Supabase session
  // 2. Restores session from localStorage if available
  // 3. Verifies token with 0accounts backend
  // 4. Fetches full profile
  const initAuth = useCallback(async () => {
    setAuthChecking(true);

    // If we're on the login page with a redirect_url, a product sent the user
    // here to sign in fresh. Clear any stale session BEFORE checking auth
    // to prevent the onAuthStateChange handler from auto-redirecting back.
    const isLoginWithRedirect =
      window.location.pathname === "/login" &&
      new URLSearchParams(window.location.search).has("redirect_url");

    if (isLoginWithRedirect) {
      try {
        const supabase = getSupabaseClient();
        await supabase.auth.signOut({ scope: "local" });
        localStorage.removeItem(AUTH_SESSION_KEY);
        console.log("[initAuth] Cleared stale session for product login redirect");
      } catch { /* ignore */ }
      setAuthChecking(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        const authSession: AuthSession = {
          accessToken: session.access_token,
          refreshToken: session.refresh_token || "",
          userId: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
          isAdmin: false,
        };

        // Verify with 0accounts backend and get profile
        try {
          const verifyResult = await verifyToken(session.access_token);
          if (verifyResult.valid) {
            authSession.isAdmin = verifyResult.user.is_admin;
          }
        } catch {
          // Backend may be unreachable — continue with local session
        }

        setAuthSession(authSession);
        localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));

        // Fetch full profile
        try {
          const profile = await getProfile(session.access_token);
          setProfile(profile);
        } catch {
          // Profile fetch failed — user can still use the app
        }
      } else {
        // Try restoring from localStorage
        const saved = localStorage.getItem(AUTH_SESSION_KEY);
        if (saved) {
          try {
            const restored: AuthSession = JSON.parse(saved);
            setAuthSession(restored);
          } catch {
            localStorage.removeItem(AUTH_SESSION_KEY);
          }
        }
      }
    } catch {
      // Auth check failed — user is not logged in
    } finally {
      setAuthChecking(false);
    }
  }, [setAuthSession, setAuthChecking, setProfile]);

  // WORKFLOW: handleSignIn
  // TRIGGERED BY: LoginPage after successful supabase.auth.signInWithPassword()
  // WHAT IT DOES: Stores session and fetches profile
  const handleSignIn = useCallback(
    async (session: { access_token: string; refresh_token: string; user: { id: string; email?: string; user_metadata?: { name?: string } } }) => {
      const authSession: AuthSession = {
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        userId: session.user.id,
        email: session.user.email || "",
        name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
        isAdmin: false,
      };

      setAuthSession(authSession);
      localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(authSession));

      // Verify with backend
      try {
        const verifyResult = await verifyToken(session.access_token);
        if (verifyResult.valid) {
          authSession.isAdmin = verifyResult.user.is_admin;
          setAuthSession({ ...authSession });
        }
      } catch {
        // Continue without backend verification
      }

      // Fetch profile
      try {
        const profile = await getProfile(session.access_token);
        setProfile(profile);
      } catch {
        // Profile fetch failed
      }
    },
    [setAuthSession, setProfile],
  );

  // WORKFLOW: handleSignOut
  // TRIGGERED BY: User clicks sign out
  // WHAT IT DOES: Signs out of Supabase, clears local state
  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    localStorage.removeItem(AUTH_SESSION_KEY);
    clearAuth();
  }, [clearAuth]);

  // Track whether a fresh login just happened (form submit or Google OAuth return).
  // This prevents auto-redirecting on stale cached sessions.
  const freshLoginRef = useRef(false);

  // Exposed so LoginPage can flag a fresh login before Supabase fires SIGNED_IN
  const markFreshLogin = useCallback(() => { freshLoginRef.current = true; }, []);

  // Listen for Supabase auth state changes (token refresh, etc.)
  useEffect(() => {
    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          clearAuth();
          localStorage.removeItem(AUTH_SESSION_KEY);
        } else if (event === "SIGNED_IN" && session) {
          // Handles Google OAuth callback or email verification redirect
          const newSession: AuthSession = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token || "",
            userId: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
            isAdmin: false,
          };
          setAuthSession(newSession);
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(newSession));

          // Only redirect back to a product if this was a FRESH login
          // (user explicitly signed in via form or Google OAuth).
          // Do NOT redirect on stale cached sessions — that causes instant
          // bounce-back without showing the login form.
          if (freshLoginRef.current) {
            freshLoginRef.current = false;
            const params = new URLSearchParams(window.location.search);
            // Validate before redirecting — an attacker who controls redirect_url
            // could otherwise exfiltrate the session tokens via the URL hash.
            const pendingRedirect = validateRedirectUrl(params.get("redirect_url"));
            if (pendingRedirect) {
              const target = new URL(pendingRedirect);
              target.hash = `access_token=${session.access_token}&refresh_token=${session.refresh_token}&token_type=bearer&type=signup`;
              window.location.href = target.toString();
            }
          }
        } else if (event === "TOKEN_REFRESHED" && session) {
          const updated: AuthSession = {
            accessToken: session.access_token,
            refreshToken: session.refresh_token || "",
            userId: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.name || "",
            isAdmin: authSession?.isAdmin || false,
          };
          setAuthSession(updated);
          localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updated));
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [authSession?.isAdmin, clearAuth, setAuthSession]);

  return {
    authSession,
    authChecking,
    initAuth,
    handleSignIn,
    handleSignOut,
    markFreshLogin,
  };
}
