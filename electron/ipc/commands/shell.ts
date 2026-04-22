// ──────────────────────────────────────────────────────────
// IPC commands: shell / system helpers
// ──────────────────────────────────────────────────────────
//
// Ports the shell commands in src-tauri/src/lib.rs:
//   shell_open_url          — open an http(s) URL in default browser
//   reveal_in_finder        — Finder highlight a path
//   open_in_terminal        — launch Terminal.app at a directory
//   open_install_terminal   — run a whitelisted shell command in Terminal
//
// Electron provides `shell.openExternal` and `shell.showItemInFolder`
// built-in, so the first two collapse to one-liners. Terminal.app
// integration keeps the same osascript approach as the Rust side so
// the user sees output in a real terminal window and any shell env
// (nvm, pyenv, asdf) applies.
// ──────────────────────────────────────────────────────────

import { shell } from "electron";
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import type { CommandHandler } from "../router";

/** Open an external http(s) URL in the user's default browser.
 *  Scheme allowlist matches Rust — prevents a rogue caller from
 *  triggering `open -a ...` or `file://` style actions. */
export const shellOpenUrl: CommandHandler = async (args) => {
  const url = typeof args.url === "string" ? args.url : "";
  const lower = url.toLowerCase();
  if (!(lower.startsWith("http://") || lower.startsWith("https://"))) {
    throw new Error("only http(s) URLs are allowed");
  }
  await shell.openExternal(url);
};

/** Reveal a path in macOS Finder. */
export const revealInFinder: CommandHandler = (args) => {
  const p = typeof args.path === "string" ? args.path : "";
  if (!p) throw new Error("reveal_in_finder: missing path");
  if (!existsSync(p)) throw new Error(`path does not exist: ${p}`);
  shell.showItemInFolder(p);
};

/** Launch macOS Terminal.app at the given directory.
 *  Same osascript-free path as Rust — `open -a Terminal <dir>`.
 *  Validates the path exists and is a directory first so Finder
 *  doesn't pop an error dialog for a stale recent-projects entry. */
export const openInTerminal: CommandHandler = (args) => {
  const p = typeof args.path === "string" ? args.path : "";
  if (!p) throw new Error("open_in_terminal: missing path");
  if (!existsSync(p)) throw new Error(`path does not exist: ${p}`);
  if (!statSync(p).isDirectory()) throw new Error(`not a directory: ${p}`);

  return new Promise<void>((resolve, reject) => {
    const child = spawn("open", ["-a", "Terminal", p], {
      stdio: "ignore",
      detached: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};

/** Run a Zeros-registry install command in a real Terminal window.
 *
 *  The caller passes the raw shell line (e.g. `npm install -g <pkg>`
 *  or `curl -fsSL https://... | sh`). We don't parse or rewrite it —
 *  but we DO enforce the same character allowlist as Rust so a
 *  compromised registry can't exfil data via `; curl ...`.
 *
 *  Allowed: alphanumeric, space, and: - _ . / : @ = | + ,
 */
export const openInstallTerminal: CommandHandler = (args) => {
  const command = typeof args.command === "string" ? args.command : "";
  if (!command || command.length > 512) {
    throw new Error("invalid install command");
  }
  // Build the same allowlist regex as Rust's `allowed` closure in
  // lib.rs:144. Any character outside this set rejects the command.
  if (!/^[A-Za-z0-9 \-_./:@=|+,]+$/.test(command)) {
    throw new Error("install command contains disallowed characters");
  }

  // Escape for AppleScript embedding — same order as Rust: backslash,
  // then double-quote.
  const escaped = command.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `tell application "Terminal"
    activate
    do script "${escaped}"
end tell`;

  return new Promise<void>((resolve, reject) => {
    const child = spawn("osascript", ["-e", script], {
      stdio: "ignore",
      detached: true,
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
};
