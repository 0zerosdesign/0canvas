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
import { ScrollArea } from "../ui/scroll-area";
import { BridgeProvider, useBridge } from "../bridge/use-bridge";
import { injectStyles, removeStyles } from "./0canvas-styles";
import { cleanup } from "../inspector";
import { WorkspaceToolbar } from "../panels/workspace-toolbar";
import { StylePanel } from "../panels/style-panel";
import { VariantCanvas } from "../canvas/variant-canvas";
import { AppSidebar } from "../panels/app-sidebar";
import { SettingsPage } from "../panels/settings-page";
import { ThemesPage } from "../themes/themes-page";
import { ThemeModePanel } from "../themes/theme-mode-panel";
import { AIChatPanel } from "../panels/ai-chat-panel";
import { CommandPalette } from "../panels/command-palette";
import { InlineEdit } from "../panels/inline-edit";
import { VisualDiff } from "../panels/visual-diff";
import { projectFileToState } from "../format/oc-project";
import {
  scheduleAutoSave,
  loadProjectFile,
  saveProjectFile,
  downloadProjectFile,
  importProjectFile,
  buildCurrentProjectFile,
  setBridgeSender,
} from "../../native/storage";

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
        <BridgeProvider>
          <AutoConnect>
            <EngineWorkspace onClose={toggle} />
          </AutoConnect>
        </BridgeProvider>
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
  const bridge = useBridge();
  const iframeNavRef = React.useRef<((route: string) => void) | null>(null);

  const style = useResizable(280, 200, 500);

  // ── Wire bridge sender for filesystem sync ──
  useEffect(() => {
    if (bridge) {
      setBridgeSender((msg) => bridge.send(msg as any));
    }
    return () => setBridgeSender(null);
  }, [bridge]);

  // ── Keyboard shortcuts ──────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+/ or Ctrl+/ → Command Palette
      if (meta && e.key === "/") {
        e.preventDefault();
        dispatch({ type: "SHOW_COMMAND_PALETTE", show: !state.showCommandPalette });
        return;
      }

      // Cmd+K or Ctrl+K → Inline Edit (requires selected element)
      if (meta && e.key === "k") {
        e.preventDefault();
        if (state.selectedElementId) {
          dispatch({ type: "SHOW_INLINE_EDIT", show: !state.showInlineEdit });
        }
        return;
      }

      // Escape → close overlays in priority order
      if (e.key === "Escape") {
        if (state.showCommandPalette) {
          e.preventDefault();
          dispatch({ type: "SHOW_COMMAND_PALETTE", show: false });
          return;
        }
        if (state.showVisualDiff) {
          e.preventDefault();
          dispatch({ type: "SHOW_VISUAL_DIFF", diff: null });
          return;
        }
        // InlineEdit handles its own Escape
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch, state.showCommandPalette, state.showInlineEdit, state.showVisualDiff, state.selectedElementId]);

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
    // Warn if current project has data
    if (state.variants.length > 0 || state.feedbackItems.length > 0) {
      const confirmed = window.confirm(
        "Importing will replace the current project data. This cannot be undone. Continue?"
      );
      if (!confirmed) return;
    }

    const file = await importProjectFile();
    if (file) {
      const { project, variants, feedbackItems } = projectFileToState(file);
      dispatch({ type: "LOAD_FROM_OC_FILE", file, project, variants, feedbackItems });
    }
  }, [dispatch, state.variants.length, state.feedbackItems.length]);

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
            {/* Center: Variant Canvas */}
            <div className="oc-workspace-center">
              <VariantCanvas onNavigateRef={iframeNavRef} />
            </div>

            {/* Right panel — switches based on designMode */}
            {!state.themeMode && (
              <>
                <div className="oc-resize-handle" onMouseDown={(e) => style.onMouseDown(e, -1)}>
                  <span className="oc-resize-line" />
                </div>
                <div className="oc-panel-slot" style={{ width: style.width }}>
                  {state.designMode === "style" ? (
                    <StylePanel />
                  ) : state.designMode === "ai" ? (
                    <AIChatPanel />
                  ) : (
                    /* Feedback panel */
                    <div className="oc-panel">
                      <div className="oc-panel-header">
                        <span className="oc-panel-title">Feedback</span>
                        <span className="oc-style-prop-count">
                          {state.feedbackItems.filter(f => f.status === "pending").length} pending
                        </span>
                      </div>
                      <ScrollArea className="oc-panel-body">
                        {state.feedbackItems.length === 0 ? (
                          <div className="oc-panel-empty">
                            <p>No feedback yet.</p>
                            <p className="oc-style-sub-hint">Click elements in the preview to add annotations.</p>
                          </div>
                        ) : (
                          <div style={{ padding: "4px 10px" }}>
                            {state.feedbackItems.map((item) => (
                              <div key={item.id} className="oc-feedback-item">
                                <div className="oc-feedback-item-header">
                                  <span className="oc-feedback-badge" data-intent={item.intent}>{item.intent}</span>
                                  <span className="oc-feedback-badge" data-severity={item.severity}>{item.severity}</span>
                                </div>
                                <span className="oc-feedback-selector">{item.elementSelector}</span>
                                <p className="oc-feedback-comment">{item.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Theme Mode Panel (overrides both style/feedback when active) */}
            {state.themeMode && (
              <>
                <div className="oc-resize-handle" onMouseDown={(e) => style.onMouseDown(e, -1)}>
                  <span className="oc-resize-line" />
                </div>
                <div className="oc-panel-slot" style={{ width: style.width }}>
                  <ThemeModePanel />
                </div>
              </>
            )}
          </div>
        </div>
      ) : state.activePage === "themes" ? (
        <ThemesPage />
      ) : (
        <SettingsPage />
      )}

      {/* ── Global overlays ──────────────────────────────── */}

      {/* Command Palette (Cmd+/) */}
      {state.showCommandPalette && (
        <CommandPalette onClose={() => dispatch({ type: "SHOW_COMMAND_PALETTE", show: false })} />
      )}

      {/* Inline Edit (Cmd+K) */}
      {state.showInlineEdit && state.selectedElementId && (
        <InlineEdit />
      )}

      {/* Visual Diff */}
      {state.showVisualDiff && (
        <VisualDiff
          before={state.showVisualDiff.before}
          after={state.showVisualDiff.after}
          variantName={state.showVisualDiff.variantName}
          onClose={() => dispatch({ type: "SHOW_VISUAL_DIFF", diff: null })}
        />
      )}
    </div>
  );
}