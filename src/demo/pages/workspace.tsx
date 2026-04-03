import React, { useEffect } from "react";
import { Link } from "react-router";
import { useWorkspace, WorkspaceProvider } from "../../0canvas/store/store";
import { injectStyles, removeStyles } from "../../0canvas/engine/0canvas-styles";
import { WorkspaceToolbar } from "../../0canvas/panels/workspace-toolbar";
import { LayersPanel } from "../../0canvas/panels/layers-panel";
import { StylePanel } from "../../0canvas/panels/style-panel";
import { AgentPanel } from "../../0canvas/panels/agent-panel";
import { BrainstormPanel } from "../../0canvas/panels/brainstorm-panel";
import { CommandPalette } from "../../0canvas/panels/command-palette";
import { FileMapPanel } from "../../0canvas/panels/file-map-panel";
import { AnnotationOverlay } from "../../0canvas/panels/annotation-overlay";

function WorkspaceInner() {
  const { state, dispatch } = useWorkspace();

  // Inject 0canvas CSS (scoped under [data-0canvas-root])
  useEffect(() => {
    injectStyles();
    return () => removeStyles();
  }, []);

  // Auto-connect project for testing
  useEffect(() => {
    if (!state.project) {
      dispatch({
        type: "CONNECT_PROJECT",
        project: {
          name: "ZeroCanvas Test Page",
          devServerUrl: window.location.origin,
          framework: "Engine Mode",
          status: "connected",
        },
      });
    }
  }, [state.project, dispatch]);

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

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" data-0canvas-root="" data-0canvas="workspace">
      {/* Back to docs link */}
      <div className="absolute top-[14px] right-[56px] z-50">
        <Link
          to="/"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-[var(--grey-800)] border border-[var(--grey-800)] text-muted-foreground hover:text-foreground hover:border-[var(--grey-700)] transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          Docs
        </Link>
      </div>

      {/* Top toolbar */}
      <WorkspaceToolbar />

      {/* Main workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Layers Panel */}
        {state.layersPanelOpen && (
          <div className="w-[260px] shrink-0 h-full overflow-hidden">
            <LayersPanel />
          </div>
        )}

        {/* Center: Annotation Overlay */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <AnnotationOverlay />
        </div>

        {/* Right panels */}
        {state.stylePanelOpen && (
          <div className="w-[280px] shrink-0 h-full overflow-hidden">
            <StylePanel />
          </div>
        )}

        {state.fileMapPanelOpen && (
          <div className="w-[280px] shrink-0 border-l border-border h-full overflow-hidden">
            <FileMapPanel />
          </div>
        )}

        {state.idePanelOpen && (
          <div className="w-[300px] shrink-0 border-l border-border">
            <AgentPanel />
          </div>
        )}

        {state.brainstormMode && !state.idePanelOpen && (
          <div className="w-[300px] shrink-0 border-l border-border">
            <BrainstormPanel />
          </div>
        )}
      </div>

      {/* Command palette overlay */}
      {state.commandPaletteOpen && <CommandPalette />}
    </div>
  );
}

export default function WorkspacePage() {
  return (
    <WorkspaceProvider>
      <WorkspaceInner />
    </WorkspaceProvider>
  );
}
