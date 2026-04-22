// ──────────────────────────────────────────────────────────
// Zeros Electron — preload script
// ──────────────────────────────────────────────────────────
//
// Phase 0: empty stub. Phase 1 will expose a
// `window.electron.invoke(cmd, args)` bridge via contextBridge
// so the renderer can talk to the main process IPC router.
// ──────────────────────────────────────────────────────────

// Intentional. Keeps the file a TS module.
export {};

// eslint-disable-next-line no-console
console.log("[Zeros] preload loaded (Phase 0 stub)");
