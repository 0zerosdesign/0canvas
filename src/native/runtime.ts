// ──────────────────────────────────────────────────────────
// Zeros Native Runtime — unified façade for Tauri + Electron
// ──────────────────────────────────────────────────────────
//
// Every React call site that needs the desktop shell (git, keychain,
// terminal, folder dialogs, deep links, sidecar engine, etc.) goes
// through this module. It feature-detects which runtime is active and
// routes to the matching IPC layer with the same call shape on both
// sides, so components don't branch.
//
// Detection convention (matches both shells' injected globals):
//   Tauri    → `window.__TAURI_INTERNALS__` set by Tauri at webview boot
//   Electron → `window.__ZEROS_NATIVE__`    set by our preload script
//
// IMPORTANT: prefer calling `isNativeRuntime()` rather than either
// specific check — components should be runtime-agnostic. Use the
// runtime-specific helpers only when behaviour genuinely differs
// (e.g., Tauri's `@tauri-apps/plugin-notification` vs Electron's
// `Notification` API).
// ──────────────────────────────────────────────────────────

interface ZerosNativeBridge {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  on<T = unknown>(eventName: string, handler: (payload: T) => void): () => void;
}

declare global {
  interface Window {
    __ZEROS_NATIVE__?: ZerosNativeBridge;
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.__ZEROS_NATIVE__;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function isNativeRuntime(): boolean {
  return isElectron() || isTauri();
}

/** Short name of the active runtime for diagnostics / log lines. */
export function runtimeName(): "electron" | "tauri" | "browser" {
  if (isElectron()) return "electron";
  if (isTauri()) return "tauri";
  return "browser";
}

/** Call a native command. Errors from the underlying bridge surface
 *  via the promise rejection — callers handle them the same way they
 *  handled Tauri's `invoke()` rejections. */
export async function nativeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (isElectron()) {
    return window.__ZEROS_NATIVE__!.invoke<T>(cmd, args);
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<T>(cmd, args);
  }
  throw new Error(
    `[Zeros] nativeInvoke("${cmd}") called without a native runtime — ` +
      `this feature requires the Mac app`,
  );
}

/** Subscribe to a named event emitted from the main process.
 *  Returns an unsubscribe function. In browser-only dev mode, no-ops
 *  (returns a no-op unsubscribe) so callers don't need to guard. */
export async function nativeListen<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (isElectron()) {
    return window.__ZEROS_NATIVE__!.on<T>(event, handler);
  }
  if (isTauri()) {
    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<T>(event, (e) => handler(e.payload));
    return unlisten;
  }
  return () => {};
}
