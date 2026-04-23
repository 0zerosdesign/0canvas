// ============================================
// HOOK: useOAuthCallback
// PURPOSE: Handle the hash-fragment OAuth callback from accounts.zeros.design
//
// When a user signs in on accounts.zeros.design, they're redirected back to
// the product with `#access_token=...&refresh_token=...` in the URL hash.
// Supabase's built-in `detectSessionInUrl` fails silently on this pattern,
// so each product has had to parse the hash manually and call
// `supabase.auth.setSession()`.
//
// This hook centralizes that logic so products don't have to copy it.
// ============================================

import { useEffect, useState } from "react";
import { getSupabase } from "../client.js";

interface HashTokens {
  access_token: string;
  refresh_token: string;
}

function parseHashTokens(): HashTokens | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token")) return null;

  const params = new URLSearchParams(hash.substring(1));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (!access_token || !refresh_token) {
    console.warn("[auth] Hash has access_token but missing refresh_token", {
      hasAccess: !!access_token,
      hasRefresh: !!refresh_token,
      hash: hash.substring(0, 100),
    });
    return null;
  }

  return { access_token, refresh_token };
}

/**
 * Parse tokens from the URL hash (if present) and establish a Supabase
 * session. Returns `true` once the callback has been handled (or if there
 * was nothing to handle), so callers can gate their initial render on it.
 *
 * Typical usage:
 * ```tsx
 * export default function App() {
 *   const ready = useOAuthCallback();
 *   if (!ready) return <LoadingSpinner />;
 *   return <AppRoutes />;
 * }
 * ```
 */
export function useOAuthCallback(): boolean {
  const [ready, setReady] = useState(() => {
    return (
      typeof window === "undefined" ||
      !window.location.hash.includes("access_token")
    );
  });

  useEffect(() => {
    if (ready) return;

    const tokens = parseHashTokens();
    if (!tokens) {
      console.error(
        "[auth] Cannot establish session — missing refresh_token in hash",
      );
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      setReady(true);
      return;
    }

    let cancelled = false;

    async function establishSession() {
      console.log("[auth] Tokens found in URL hash, establishing session...");

      const supabase = getSupabase();
      const { data, error } = await supabase.auth.setSession({
        access_token: tokens!.access_token,
        refresh_token: tokens!.refresh_token,
      });

      // Always clean up the hash so the tokens don't linger in browser
      // history or get copy-pasted into chat.
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );

      if (error) {
        console.error("[auth] setSession failed:", error.message);
      } else if (data.session) {
        console.log("[auth] Session established!", {
          userId: data.session.user?.id,
          email: data.session.user?.email,
        });
      } else {
        console.warn("[auth] setSession returned no error but no session either");
      }

      if (!cancelled) setReady(true);
    }

    establishSession();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  return ready;
}
