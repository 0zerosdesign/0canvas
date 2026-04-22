// ──────────────────────────────────────────────────────────
// Zeros Native Runtime — Electron IPC façade
// ──────────────────────────────────────────────────────────
//
// Every React call site that needs the desktop shell (git,
// keychain, terminal, folder dialogs, deep links, sidecar engine,
// etc.) goes through this module. Feature-detects whether we're
// running inside the packaged Electron app vs a plain browser
// (`pnpm dev`) and routes IPC accordingly.
//
// Detection: `window.__ZEROS_NATIVE__` is set by the preload
// script (electron/preload.ts). When present, we're running
// inside Electron's renderer and all native commands are
// available. When absent, we're in a browser-only Vite dev
// harness — read-style façade functions return empty / null,
// write-style ones throw "requires the Mac app".
//
// The `isNativeRuntime()` alias survives from the dual-runtime
// era (Tauri + Electron) so existing call sites keep working. In
// practice it's now a synonym for `isElectron()`.
// ──────────────────────────────────────────────────────────

interface ZerosNativeBridge {
  invoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T>;
  on<T = unknown>(eventName: string, handler: (payload: T) => void): () => void;
}

declare global {
  interface Window {
    __ZEROS_NATIVE__?: ZerosNativeBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.__ZEROS_NATIVE__;
}

/** Back-compat alias — same semantics as isElectron() now that
 *  Tauri is removed. Kept so existing call sites keep compiling;
 *  prefer isElectron() in new code. */
export function isNativeRuntime(): boolean {
  return isElectron();
}

/** Short name of the active runtime for diagnostics / log lines. */
export function runtimeName(): "electron" | "browser" {
  return isElectron() ? "electron" : "browser";
}

/** Call a native command. Errors from the underlying bridge
 *  surface via the promise rejection — callers handle them the
 *  same way they did under Tauri's `invoke()`. */
export async function nativeInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (isElectron()) {
    return window.__ZEROS_NATIVE__!.invoke<T>(cmd, args);
  }
  throw new Error(
    `[Zeros] nativeInvoke("${cmd}") called without a native runtime — ` +
      `this feature requires the Mac app`,
  );
}

/** Subscribe to a named event emitted from the main process.
 *  Returns an unsubscribe function. In browser-only dev mode
 *  no-ops (returns a no-op unsubscribe) so callers don't need
 *  to guard. */
export async function nativeListen<T = unknown>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (isElectron()) {
    return window.__ZEROS_NATIVE__!.on<T>(event, handler);
  }
  return () => {};
}
