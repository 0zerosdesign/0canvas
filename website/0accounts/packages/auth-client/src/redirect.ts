// ============================================
// MODULE: Redirect Helpers
// PURPOSE: Handle redirects to/from accounts.zeros.design for auth
// USED BY: Products that don't have their own auth pages
// ============================================

import { ACCOUNTS_LOGIN_URL } from "./config.js";

// WORKFLOW: redirectToLogin
// TRIGGERED BY: Product detects no session and autoRedirect is true
// WHAT IT DOES: Redirects the browser to accounts.zeros.design/login with return URL
export function redirectToLogin(
  productId: string,
  loginUrl?: string,
  returnUrl?: string,
): void {
  const base = loginUrl || ACCOUNTS_LOGIN_URL;
  // IMPORTANT: Use pathname + search only — never include hash fragments.
  // Hash may contain #access_token from a previous auth attempt.
  // Including it in redirect_url creates an infinite loop.
  const redirect =
    returnUrl || window.location.origin + window.location.pathname + window.location.search;
  const url = `${base}?product_id=${encodeURIComponent(productId)}&redirect_url=${encodeURIComponent(redirect)}`;
  window.location.href = url;
}

// WORKFLOW: getRedirectParams
// TRIGGERED BY: accounts.zeros.design after login completes
// WHAT IT DOES: Extracts redirect_url and product_id from URL search params
export function getRedirectParams(): {
  redirectUrl: string | null;
  productId: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    redirectUrl: params.get("redirect_url"),
    productId: params.get("product_id"),
  };
}

// WORKFLOW: isAuthenticated
// TRIGGERED BY: Quick check without async — reads localStorage directly
// WHAT IT DOES: Returns true if a Supabase session token exists in localStorage
export function isAuthenticated(): boolean {
  try {
    const key = Object.keys(localStorage).find((k) =>
      k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!key) return false;
    const data = localStorage.getItem(key);
    return !!data && data !== "null";
  } catch {
    return false;
  }
}
