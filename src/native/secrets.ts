// ──────────────────────────────────────────────────────────
// Phase 2-C — Keychain-backed secrets API
// ──────────────────────────────────────────────────────────
//
// Reads/writes values in the macOS login keychain via the Rust
// commands in src-tauri/src/secrets.rs. Outside Tauri (e.g. pnpm
// dev in a plain browser), everything falls back to localStorage
// under the same key so the dev harness keeps working, but the
// Mac build always wins because isTauriWebview() returns true.
//
// Call sites: store.tsx (api key load), Settings page (api key save),
// anywhere else secrets live. Never write API keys to settings.json
// or localStorage on the Mac build — this wrapper is the one path.
// ──────────────────────────────────────────────────────────

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

const FALLBACK_PREFIX = "oc-secret-";

function fallbackKey(account: string): string {
  return `${FALLBACK_PREFIX}${account}`;
}

export async function setSecret(account: string, value: string): Promise<void> {
  if (!isTauriWebview()) {
    try {
      localStorage.setItem(fallbackKey(account), value);
    } catch {
      /* storage disabled */
    }
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("keychain_set", { account, value });
}

export async function getSecret(account: string): Promise<string | null> {
  if (!isTauriWebview()) {
    try {
      return localStorage.getItem(fallbackKey(account));
    } catch {
      return null;
    }
  }
  const { invoke } = await import("@tauri-apps/api/core");
  const result = await invoke<string | null>("keychain_get", { account });
  return result ?? null;
}

export async function deleteSecret(account: string): Promise<void> {
  if (!isTauriWebview()) {
    try {
      localStorage.removeItem(fallbackKey(account));
    } catch {
      /* storage disabled */
    }
    return;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke<void>("keychain_delete", { account });
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
