// ──────────────────────────────────────────────────────────
// DesignDead Engine — Main <DesignDead /> Component
// ──────────────────────────────────────────────────────────
//
// This is the component that consumers import:
//
//   import { DesignDead } from "@zerosdesign/design-dead";
//   <DesignDead />
//
// It wraps the entire DesignDead workspace (store, toolbar,
// panels, canvas) into a self-contained floating overlay that
// can be toggled with a keyboard shortcut or FAB button.
//
// Architecture:
//   - No server, no proxy, no iframe, no Figma dependency
//   - Inspects the current page DOM directly via dom-inspector.ts
//   - All UI is marked with data-designdead so the inspector skips it
//   - CSS is injected at runtime via designdead-styles.ts
//   - Works with ANY framework and ANY CSS setup
//
// ──────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from "react";
import { WorkspaceProvider, useWorkspace } from "../store";
import { injectStyles, removeStyles } from "./designdead-styles";
import { cleanup } from "./dom-inspector";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { LayersPanel } from "./layers-panel";
import { StylePanel } from "./style-panel";
import { LiveCanvas } from "./live-canvas";
import { AgentPanel } from "./agent-panel";
import { BrainstormPanel } from "./brainstorm-panel";
import { VersionManager } from "./version-manager";
import { CommandPalette } from "./command-palette";
import { FileMapPanel } from "./file-map-panel";
import { AnnotationOverlay } from "./annotation-overlay";

// ── Props ──────────────────────────────────────────────────

export interface DesignDeadProps {
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

  /** Optional callback when DesignDead opens/closes */
  onToggle?: (isOpen: boolean) => void;
}

// ── Position styles for the FAB button ─────────────────────

const POSITION_STYLES: Record<
  NonNullable<DesignDeadProps["position"]>,
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
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          color: "#888888",
          fontSize: "13px",
          fontFamily: "'Geist Sans', 'Inter', sans-serif",
        }}
      >
        Loading DesignDead...
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
  position: NonNullable<DesignDeadProps["position"]>;
  zIndex: number;
  shortcut: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Open DesignDead (Ctrl+Shift+${shortcut.toUpperCase()})`}
      data-designdead="toggle"
      style={{
        position: "fixed",
        ...POSITION_STYLES[position],
        zIndex,
        width: 44,
        height: 44,
        borderRadius: 12,
        border: "1px solid #222222",
        background: hovered ? "#1a1a1a" : "#0a0a0a",
        color: "#ededed",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        transform: hovered ? "scale(1.05)" : "scale(1)",
        fontFamily: "'Geist Sans', 'Inter', sans-serif",
        fontSize: 0,
        padding: 0,
        outline: "none",
      }}
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

// ── Main DesignDead Component ──────────────────────────────

export function DesignDead({
  position = "bottom-right",
  defaultOpen = false,
  theme = "dark",
  shortcut = "d",
  devOnly = true,
  zIndex = 2147483640,
  onToggle,
}: DesignDeadProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // ── Dev-only guard ─────────────────────────────────────
  // In production, hide DesignDead entirely if devOnly is true
  // Use globalThis to avoid TS2580 "Cannot find name 'process'" during DTS generation
  const _g = globalThis as Record<string, unknown>;
  const _proc = typeof _g["process"] === "object" ? (_g["process"] as Record<string, unknown>) : undefined;
  const _env = _proc && typeof _proc["env"] === "object" ? (_proc["env"] as Record<string, string>) : undefined;
  const isProduction = _env?.["NODE_ENV"] === "production";

  // ── Inject/remove styles ───────────────────────────────
  useEffect(() => {
    injectStyles();
    return () => {
      removeStyles();
      cleanup();
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

  // ── Dev-only: don't render in production ───────────────
  if (devOnly && isProduction) return null;

  // ── Closed state: show FAB button ──────────────────────
  if (!isOpen) {
    return (
      <ToggleButton
        position={position}
        zIndex={zIndex}
        shortcut={shortcut}
        onClick={toggle}
      />
    );
  }

  // ── Open state: full workspace overlay ─────────────────
  return (
    <div
      data-designdead-root=""
      data-designdead="root"
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        // Isolate our styles from the consumer's app
        isolation: "isolate",
      }}
    >
      <WorkspaceProvider>
        <AutoConnect>
          {/* Close button (top-right corner, always visible) */}
          <button
            onClick={toggle}
            data-designdead="close"
            title={`Close DesignDead (Ctrl+Shift+${shortcut.toUpperCase()})`}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: zIndex + 1,
              width: 28,
              height: 28,
              borderRadius: 8,
              border: "1px solid #333333",
              background: "#111111",
              color: "#888888",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontFamily: "'Geist Sans', sans-serif",
              transition: "all 0.15s ease",
              padding: 0,
              outline: "none",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.color = "#ededed";
              (e.target as HTMLElement).style.borderColor = "#555555";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.color = "#888888";
              (e.target as HTMLElement).style.borderColor = "#333333";
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <EngineWorkspace />
        </AutoConnect>
      </WorkspaceProvider>
    </div>
  );
}

// ── Default export for convenience ─────────────────────────
export default DesignDead;

// ── Engine Workspace Layout ────────────────────────────────
// Self-contained workspace layout (no react-router dependency).
// Mirrors the same panel arrangement as the docs site workspace
// but without any navigation links.

function EngineWorkspace() {
  const { state, dispatch } = useWorkspace();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === "k") {
          e.preventDefault();
          dispatch({ type: "TOGGLE_COMMAND_PALETTE" });
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);

  const showVersions =
    !state.idePanelOpen &&
    !state.brainstormMode &&
    !state.fileMapPanelOpen;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#000000",
        overflow: "hidden",
      }}
      data-designdead="workspace"
    >
      {/* Top toolbar */}
      <WorkspaceToolbar />

      {/* Main workspace */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left: Layers Panel */}
        {state.layersPanelOpen && (
          <div style={{ width: 260, flexShrink: 0, height: "100%", overflow: "hidden" }}>
            <LayersPanel />
          </div>
        )}

        {/* Center: Live Canvas + Annotation Overlay */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
          <LiveCanvas />
          <AnnotationOverlay />
        </div>

        {/* Right panels */}
        {state.stylePanelOpen && (
          <div style={{ width: 280, flexShrink: 0, height: "100%", overflow: "hidden" }}>
            <StylePanel />
          </div>
        )}

        {state.fileMapPanelOpen && !state.stylePanelOpen && (
          <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid #1a1a1a" }}>
            <FileMapPanel />
          </div>
        )}

        {state.idePanelOpen && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid #1a1a1a" }}>
            <AgentPanel />
          </div>
        )}

        {state.brainstormMode && !state.idePanelOpen && (
          <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid #1a1a1a" }}>
            <BrainstormPanel />
          </div>
        )}

        {showVersions && !state.stylePanelOpen && (
          <div style={{ width: 280, flexShrink: 0, borderLeft: "1px solid #1a1a1a", background: "#0a0a0a" }}>
            <VersionManager />
          </div>
        )}
      </div>

      {/* Command palette overlay */}
      {state.commandPaletteOpen && <CommandPalette />}
    </div>
  );
}