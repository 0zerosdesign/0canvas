// ──────────────────────────────────────────────────────────
// IPC commands: keychain — port of src-tauri/src/secrets.rs
// ──────────────────────────────────────────────────────────
//
// keytar is the npm-standard wrapper around:
//   macOS   → Keychain (Security.framework) — same backing store as
//             the Rust security-framework crate, so entries saved by
//             the Tauri build are readable here and vice versa.
//   Windows → Credential Manager (DPAPI)
//   Linux   → Secret Service (GNOME Keyring / KDE Wallet)
//
// Service name matches Rust exactly:
//   Prod (app.isPackaged)          → "Zeros"
//   Dev  (electron .)              → "Zeros Dev"
// Any keys you saved under Tauri's "Zeros"/"Zeros Dev" service carry
// over transparently to the Electron build — no migration needed.
// ──────────────────────────────────────────────────────────

import { app } from "electron";
import keytar from "keytar";
import type { CommandHandler } from "../router";

function service(): string {
  return app.isPackaged ? "Zeros" : "Zeros Dev";
}

export const keychainSet: CommandHandler = async (args) => {
  const account = String(args.account ?? "");
  const value = String(args.value ?? "");
  if (!account) throw new Error("keychain set failed: missing account");
  try {
    await keytar.setPassword(service(), account, value);
  } catch (err) {
    throw new Error(
      `keychain set failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

export const keychainGet: CommandHandler = async (args) => {
  const account = String(args.account ?? "");
  if (!account) throw new Error("keychain get failed: missing account");
  try {
    const v = await keytar.getPassword(service(), account);
    // keytar returns null when not found — matches Rust's Ok(None)
    // on errSecItemNotFound (-25300).
    return v;
  } catch (err) {
    throw new Error(
      `keychain get failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

export const keychainDelete: CommandHandler = async (args) => {
  const account = String(args.account ?? "");
  if (!account) throw new Error("keychain delete failed: missing account");
  try {
    // keytar returns `true` on deletion, `false` if it didn't exist.
    // Rust treats -25300 as "already absent → Ok(())"; we silently
    // accept either outcome to match.
    await keytar.deletePassword(service(), account);
  } catch (err) {
    throw new Error(
      `keychain delete failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};
