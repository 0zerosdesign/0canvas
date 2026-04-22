// ──────────────────────────────────────────────────────────
// Phase 2-C — Keychain-backed secrets API
// ──────────────────────────────────────────────────────────
//
// Reads/writes values in the macOS login keychain via the native
// shell (Tauri: src-tauri/src/secrets.rs, Electron: keytar in the
// main process). Outside a native runtime (e.g. `pnpm dev` in a
// plain browser), everything falls back to localStorage under the
// same key so the dev harness keeps working — the Mac build always
// wins because `isNativeRuntime()` returns true.
//
// Call sites: store.tsx (api key load), Settings page (api key save),
// anywhere else secrets live. Never write API keys to settings.json
// or localStorage on the Mac build — this wrapper is the one path.
// ──────────────────────────────────────────────────────────

import { isNativeRuntime, nativeInvoke } from "./runtime";

const FALLBACK_PREFIX = "oc-secret-";

function fallbackKey(account: string): string {
  return `${FALLBACK_PREFIX}${account}`;
}

export async function setSecret(account: string, value: string): Promise<void> {
  if (!isNativeRuntime()) {
    try {
      localStorage.setItem(fallbackKey(account), value);
    } catch {
      /* storage disabled */
    }
    return;
  }
  await nativeInvoke<void>("keychain_set", { account, value });
}

export async function getSecret(account: string): Promise<string | null> {
  if (!isNativeRuntime()) {
    try {
      return localStorage.getItem(fallbackKey(account));
    } catch {
      return null;
    }
  }
  const result = await nativeInvoke<string | null>("keychain_get", { account });
  return result ?? null;
}

export async function deleteSecret(account: string): Promise<void> {
  if (!isNativeRuntime()) {
    try {
      localStorage.removeItem(fallbackKey(account));
    } catch {
      /* storage disabled */
    }
    return;
  }
  await nativeInvoke<void>("keychain_delete", { account });
}

// ── Well-known account names ────────────────────────────────
// Keep these centralised so all callers agree on the same slot
// (mis-typing "anthropic-key" vs "anthropic-api-key" would silently
// split reads from writes).
export const SECRET_ACCOUNTS = {
  OPENAI_API_KEY: "openai-api-key",
  ANTHROPIC_API_KEY: "anthropic-api-key",
  GITHUB_PAT: "github-pat",
} as const;
