// ──────────────────────────────────────────────────────────
// ZeroCanvas Engine — Main <ZeroCanvas /> Component
// ──────────────────────────────────────────────────────────
//
// This is the component that consumers import:
//
//   import { ZeroCanvas } from "@zerosdesign/0canvas";
//   <ZeroCanvas />
//
// It wraps the entire ZeroCanvas workspace (store, toolbar,
// panels, canvas) into a self-contained floating overlay that
// can be toggled with a keyboard shortcut or FAB button.
//
// Architecture:
//   - No server, no proxy, no external dependency
//   - Inspects the current page DOM directly via dom-inspector.ts
//   - All UI is marked with data-0canvas so the inspector skips it
//   - CSS is injected at runtime via 0canvas-styles.ts
//   - Works with ANY framework and ANY CSS setup
//
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import ReactDOM from "react-dom";
import { WorkspaceProvider, useWorkspace } from "../store/store";
import { injectStyles, removeStyles } from "./0canvas-styles";
import { cleanup } from "../inspector/dom-inspector";
import { WorkspaceToolbar } from "../panels/workspace-toolbar";
import { LayersPanel } from "../panels/layers-panel";
import { StylePanel } from "../panels/style-panel";
import { VariantCanvas } from "../canvas/variant-canvas";
import { AppSidebar } from "../panels/app-sidebar";
import { SettingsPage } from "../panels/settings-page";
import { projectFileToState } from "../format/oc-project";
import {
  scheduleAutoSave,
  loadProjectFile,
  saveProjectFile,
  downloadProjectFile,
  importProjectFile,
  pushProjectToIDE,
  buildCurrentProjectFile,
} from "../format/oc-project-store";

// ── Props ──────────────────────────────────────────────────

export interface ZeroCanvasProps {
  /** Panel position for the toggle button. Default: "bottom-right" */
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";

  /** Start with the panel open. Default: false */
  defaultOpen?: boolean;

  /** Color theme. "auto" follows prefers-color-scheme. Default: "dark" */
  theme?: "dark" | "light" | "auto";

  /** Keyboard shortcut key (used with Ctrl+Shift+{key}). Default: "d" */
  shortcut?: string;

  /** Only show in development (process.env.NODE_ENV !== "production"). Default: true */
  devOnly?: boolean;

  /** CSS z-index for the overlay. Default: 2147483640 */
  zIndex?: number;

  /** Optional callback when ZeroCanvas opens/closes */
  onToggle?: (isOpen: boolean) => void;
}

// ── Position styles for the FAB button ─────────────────────

const POSITION_STYLES: Record<
  NonNullable<ZeroCanvasProps["position"]>,
  React.CSSProperties
> = {
  "bottom-right": { bottom: 20, right: 20 },
  "bottom-left": { bottom: 20, left: 20 },
  "top-right": { top: 20, right: 20 },
  "top-left": { top: 20, left: 20 },
};

// ── Auto-connect wrapper ───────────────────────────────────
// Sets up the project connection in engine mode (no onboarding)

function AutoConnect({ children }: { children: React.ReactNode }) {
  const { state, dispatch } = useWorkspace();

  useEffect(() => {
    if (!state.project) {
      dispatch({
        type: "CONNECT_PROJECT",
        project: {
          name: document.title || "Current Page",
          devServerUrl: window.location.origin,
          framework: "Engine Mode",
          status: "connected",
        },
      });
    }
  }, [state.project, dispatch]);

  if (!state.project) {
    return (
      <div className="oc-engine-loading">
        Loading ZeroCanvas...
      </div>
    );
  }

  return <>{children}</>;
}

// ── FAB Toggle Button ──────────────────────────────────────

function ToggleButton({
  position,
  zIndex,
  shortcut,
  onClick,
}: {
  position: NonNullable<ZeroCanvasProps["position"]>;
  zIndex: number;
  shortcut: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`Open ZeroCanvas (Ctrl+Shift+${shortcut.toUpperCase()})`}
      data-0canvas="toggle"
      className="oc-toggle-btn"
      style={{ ...POSITION_STYLES[position], zIndex }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    </button>
  );
}

// ── Main ZeroCanvas Component ──────────────────────────────

const IFRAME_GUARD =
  typeof window !== "undefined" && window.name === "0canvas-preview";

const IS_PRODUCTION = (() => {
  const _g = globalThis as Record<string, unknown>;
  const _proc = typeof _g["process"] === "object" ? (_g["process"] as Record<string, unknown>) : undefined;
  const _env = _proc && typeof _proc["env"] === "object" ? (_proc["env"] as Record<string, string>) : undefined;
  return _env?.["NODE_ENV"] === "production";
})();

export function ZeroCanvas({
  position = "bottom-right",
  defaultOpen = false,
  theme = "dark",
  shortcut = "d",
  devOnly = true,
  zIndex = 2147483640,
  onToggle,
}: ZeroCanvasProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const portalRef = useRef<HTMLDivElement | null>(null);

  // ── Create/destroy a portal container on document.body ──
  useEffect(() => {
    const container = document.createElement("div");
    container.id = "0canvas-portal";
    container.setAttribute("data-0canvas", "portal");
    container.style.cssText = "position:relative;z-index:2147483640;pointer-events:none;";
    document.body.appendChild(container);
    portalRef.current = container;
    injectStyles();
    return () => {
      cleanup();
      portalRef.current = null;
      document.body.removeChild(container);
      setTimeout(removeStyles, 0);
    };
  }, []);

  // ── Toggle handler ─────────────────────────────────────
  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      onToggle?.(next);
      return next;
    });
  }, [onToggle]);

  // ── Keyboard shortcut: Ctrl+Shift+{key} ────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === shortcut.toLowerCase()
      ) {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut, toggle]);

  // Guards evaluated after all hooks (Rules of Hooks compliance)
  if (IFRAME_GUARD) return null;
  if (devOnly && IS_PRODUCTION) return null;
  if (!portalRef.current) return null;

  // ── Closed state: FAB button via portal ────────────────
  if (!isOpen) {
    return ReactDOM.createPortal(
      <ToggleButton
        position={position}
        zIndex={zIndex}
        shortcut={shortcut}
        onClick={toggle}
      />,
      portalRef.current,
    );
  }

  // ── Open state: full workspace overlay via portal ──────
  return ReactDOM.createPortal(
    <div
      data-0canvas-root=""
      data-0canvas="root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        isolation: "isolate",
        pointerEvents: "auto",
      }}
    >
      <WorkspaceProvider>
        <AutoConnect>
          <EngineWorkspace onClose={toggle} />
        </AutoConnect>
      </WorkspaceProvider>
    </div>,
    portalRef.current,
  );
}

// ── Default export for convenience ─────────────────────────
export default ZeroCanvas;

// ── Resizable panel hook ──────────────────────────────────

function useResizable(initial: number, min: number, max: number) {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(initial);

  const onMouseDown = useCallback((e: ReactMouseEvent, direction: 1 | -1) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (ev.clientX - startX.current) * direction;
      setWidth(Math.min(max, Math.max(min, startW.current + delta)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";
  }, [width, min, max]);

  return { width, onMouseDown };
}

// ── Engine Workspace Layout ────────────────────────────────
// Self-contained workspace layout (no react-router dependency).
// Mirrors the same panel arrangement as the docs site workspace
// but without any navigation links.

function EngineWorkspace({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useWorkspace();
  const iframeNavRef = React.useRef<((route: string) => void) | null>(null);
  const lastPollRef = useRef<number>(0);

  const layers = useResizable(260, 180, 480);
  const style = useResizable(280, 200, 500);

  // ── Load .0c project file from IndexedDB on mount ──
  useEffect(() => {
    (async () => {
      try {
        const file = await loadProjectFile(state.ocProject.id);
        if (file) {
          const { project, variants, feedbackItems } = projectFileToState(file);
          dispatch({ type: "LOAD_FROM_OC_FILE", file, project, variants, feedbackItems });
        }
      } catch { /* no saved file yet */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save .0c project file on state changes ──
  useEffect(() => {
    scheduleAutoSave(
      state.ocProject,
      state.variants,
      state.feedbackItems,
      state.currentRoute,
      state.ocProjectFile,
    );
  }, [
    state.ocProject,
    state.variants,
    state.feedbackItems,
    state.currentRoute,
    state.ocProjectFile,
  ]);

  // ── Export .0c file ──
  const handleExportDD = useCallback(async () => {
    try {
      const file = await buildCurrentProjectFile(
        state.ocProject,
        state.variants,
        state.feedbackItems,
        state.currentRoute,
      );
      downloadProjectFile(file);
    } catch (err) {
      console.warn("[DD] Export failed:", err);
    }
  }, [state.ocProject, state.variants, state.feedbackItems, state.currentRoute]);

  // ── Import .0c file ──
  const handleImportDD = useCallback(async () => {
    const file = await importProjectFile();
    if (file) {
      const { project, variants, feedbackItems } = projectFileToState(file);
      dispatch({ type: "LOAD_FROM_OC_FILE", file, project, variants, feedbackItems });
    }
  }, [dispatch]);

  // ── Push to IDE ──
  const handlePushToIDE = useCallback(async () => {
    const port = state.wsPort || 24192;
    const file = await buildCurrentProjectFile(
      state.ocProject,
      state.variants,
      state.feedbackItems,
      state.currentRoute,
    );
    const ok = await pushProjectToIDE(file, port);
    if (ok) {
      dispatch({ type: "SET_OC_PROJECT_FILE", file });
    }
  }, [state.ocProject, state.variants, state.feedbackItems, state.currentRoute, state.wsPort, dispatch]);

  // ── Auto-connect IDE + MCP bridge on mount ──
  // Reads globals injected by the Vite plugin for instant connection,
  // then validates with a health check. Falls back to health-check-only
  // if no Vite plugin is installed.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    const injectedPort = typeof w.__ZEROCANVAS_MCP_PORT__ === "number" ? w.__ZEROCANVAS_MCP_PORT__ as number : null;
    const injectedIDE = typeof w.__ZEROCANVAS_IDE__ === "string" ? w.__ZEROCANVAS_IDE__ as string : null;
    const port = injectedPort || 24192;

    // If the Vite plugin injected IDE info, connect immediately (no network wait)
    if (injectedIDE) {
      dispatch({ type: "UPDATE_IDE_STATUS", id: injectedIDE, status: "connected" });
    }
    if (injectedPort) {
      dispatch({ type: "WS_SET_PORT", port: injectedPort });
    }

    // Verify bridge is actually reachable, and pick up IDE from server if not injected
    const detect = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          dispatch({ type: "WS_STATUS_UPDATE", status: "connected" });
          dispatch({ type: "WS_SET_PORT", port });
          // Server-side IDE detection (fallback if Vite plugin didn't inject)
          if (data.ide && !injectedIDE) {
            dispatch({ type: "UPDATE_IDE_STATUS", id: data.ide, status: "connected" });
          }
        }
      } catch { /* bridge offline — IDE may still be correct from injected globals */ }
    };
    detect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── MCP Bridge Polling ──
  // Listens for events from AI agents (like pushed changes)
  useEffect(() => {
    const poll = async () => {
      const port = state.wsPort || 24192;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/poll?since=${lastPollRef.current}`);
        if (res.ok) {
          const data = await res.json();
          let hasUpdates = false;

          if (data.resolved && data.resolved.length > 0) {
            dispatch({ type: "MARK_FEEDBACK_SENT", ids: data.resolved });
            hasUpdates = true;
          }

          if (data.pushed && data.pushed.length > 0) {
            for (const change of data.pushed) {
              dispatch({
                type: "UPDATE_VARIANT",
                id: change.variantId,
                updates: {
                  modifiedHtml: change.html,
                  ...(change.css !== undefined && { modifiedCss: change.css }),
                },
              });
            }
            hasUpdates = true;
          }

          if (hasUpdates) {
            lastPollRef.current = Date.now();
          }
        }
      } catch { /* bridge offline */ }
    };

    poll();
    const interval = setInterval(poll, 2000);
    const onFocus = () => poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [state.wsPort, dispatch]);

  const handleNavigate = useCallback((route: string) => {
    iframeNavRef.current?.(route);
  }, []);

  return (
    <div className="oc-app-shell" data-0canvas="workspace">
      {/* Far-left sidebar */}
      <AppSidebar onClose={onClose} />

      {/* Page content */}
      {state.activePage === "design" ? (
        <div className="oc-workspace">
          {/* Top toolbar */}
          <WorkspaceToolbar onNavigate={handleNavigate} />

          {/* Main workspace */}
          <div className="oc-workspace-main">
            {/* Left: Layers Panel + resize handle */}
            {state.layersPanelOpen && (
              <>
                <div className="oc-panel-slot" style={{ width: layers.width }}>
                  <LayersPanel />
                </div>
                <div className="oc-resize-handle" onMouseDown={(e) => layers.onMouseDown(e, 1)}>
                  <span className="oc-resize-line" />
                </div>
              </>
            )}

            {/* Center: Variant Canvas */}
            <div className="oc-workspace-center">
              <VariantCanvas onNavigateRef={iframeNavRef} />
            </div>

            {/* Right: Style Panel */}
            {state.stylePanelOpen && (
              <>
                <div className="oc-resize-handle" onMouseDown={(e) => style.onMouseDown(e, -1)}>
                  <span className="oc-resize-line" />
                </div>
                <div className="oc-panel-slot" style={{ width: style.width }}>
                  <StylePanel />
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <SettingsPage />
      )}
    </div>
  );
}