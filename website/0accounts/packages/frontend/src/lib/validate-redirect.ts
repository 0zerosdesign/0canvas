// ============================================
// UTIL: validate-redirect
// PURPOSE: Validate product redirect URLs to prevent open-redirect attacks
//
// Any product that wants to redirect through accounts.zeros.design must use
// a URL on an allowlisted domain. Without this, an attacker could craft
//   https://accounts.zeros.design/login?redirect_url=https://evil.com
// and have the access_token + refresh_token delivered to evil.com in the
// URL hash after the user signs in.
// ============================================

/**
 * Validate a raw redirect URL from the URL query string.
 *
 * Returns the normalized URL (with any existing hash stripped) when the URL
 * is safe to redirect to, or null when it should be rejected.
 *
 * Allowlist:
 * - zeros.design and any *.zeros.design subdomain
 * - localhost and 127.0.0.1 (dev builds only, any port)
 *
 * Rejects:
 * - Non-http(s) protocols (javascript:, data:, file:, etc.)
 * - Protocol-relative URLs (//evil.com)
 * - URLs with userinfo (user:pass@host)
 * - Non-default ports outside of dev/localhost
 * - Non-https URLs in production
 * - URLs that fail to parse
 */
export function validateRedirectUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  // Reject protocol-relative URLs — new URL() would otherwise parse them
  // against a base and potentially produce a same-origin result.
  if (decoded.startsWith("//")) return null;

  let url: URL;
  try {
    url = new URL(decoded);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;

  const hostname = url.hostname.toLowerCase();
  const isDev = import.meta.env.DEV;

  const isZerosDomain =
    hostname === "zeros.design" || hostname.endsWith(".zeros.design");
  const isLocalhost =
    isDev && (hostname === "localhost" || hostname === "127.0.0.1");

  if (!isZerosDomain && !isLocalhost) return null;

  if (!isDev && url.protocol !== "https:") return null;

  // Non-default ports are only allowed for localhost dev servers.
  if (!isLocalhost && url.port !== "") return null;

  // Strip any existing hash — we'll be setting our own with the session tokens.
  url.hash = "";

  return url.toString();
}
