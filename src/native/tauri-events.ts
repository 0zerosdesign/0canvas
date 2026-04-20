// ──────────────────────────────────────────────────────────
// Tauri ↔ Webview event bridge
// ──────────────────────────────────────────────────────────
//
// A thin adapter that wires Tauri's event system to the React
// app without forcing every component to know about Tauri. If
// we're running in `pnpm dev` (plain Vite, no Tauri), these
// functions no-op silently so the same code runs in both modes.
//
// ──────────────────────────────────────────────────────────

export type ProjectChangedPayload = {
  root: string;
  port: number;
};

export type LocalhostService = {
  port: number;
  url: string;
  kind: "dev-server" | "database" | "engine" | "unknown";
  label: string;
};

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Probe common dev-server / database / engine ports on 127.0.0.1 and
 * return whatever responded. Safe to call repeatedly; each call takes
 * roughly 100–200 ms even on a cold machine (closed TCP ports return
 * "connection refused" instantly; open ones complete the connect).
 */
export async function discoverLocalhostServices(): Promise<LocalhostService[]> {
  if (!isTauriWebview()) return [];
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LocalhostService[]>("discover_localhost_services");
}

/**
 * Subscribe to the Rust-emitted `project-changed` event (fired when the
 * user picks a new folder via File > Open Folder). Returns an unsubscribe
 * function; safe to call in both Tauri and plain-browser builds.
 */
export async function onProjectChanged(
  handler: (payload: ProjectChangedPayload) => void,
): Promise<() => void> {
  if (!isTauriWebview()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const unlisten = await listen<ProjectChangedPayload>("project-changed", (e) => {
    handler(e.payload);
  });
  return unlisten;
}

/**
 * Invoke the Rust `open_project_folder` command from the webview. Phase 1B's
 * Workspace Manager route will call this from its "Open Folder" button; the
 * native File menu already calls the same command on click.
 */
export async function openProjectFolder(): Promise<ProjectChangedPayload | null> {
  if (!isTauriWebview()) {
    // No Tauri API available in the browser-only Vite harness; treat as a
    // soft cancel rather than an error.
    return null;
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<ProjectChangedPayload | null>("open_project_folder");
}
