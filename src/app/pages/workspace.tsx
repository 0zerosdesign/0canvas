import React, { useEffect } from "react";
import { Link } from "react-router";
import { useWorkspace, WorkspaceProvider } from "../store";
import { WorkspaceToolbar } from "../components/workspace-toolbar";
import { LayersPanel } from "../components/layers-panel";
import { StylePanel } from "../components/style-panel";
import { LiveCanvas } from "../components/live-canvas";
import { AgentPanel } from "../components/agent-panel";
import { BrainstormPanel } from "../components/brainstorm-panel";
import { VersionManager } from "../components/version-manager";
import { CommandPalette } from "../components/command-palette";
import { FileMapPanel } from "../components/file-map-panel";
import { AnnotationOverlay } from "../components/annotation-overlay";

function WorkspaceInner() {
  const { state, dispatch } = useWorkspace();

  // Auto-connect project for testing
  useEffect(() => {
    if (!state.project) {
      dispatch({
        type: "CONNECT_PROJECT",
        project: {
          name: "DesignDead Test Page",
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

  // Determine right panel
  const showVersions =
    !state.idePanelOpen &&
    !state.brainstormMode &&
    !state.fileMapPanelOpen;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden" data-designdead="workspace">
      {/* Back to docs link */}
      <div className="absolute top-[14px] right-[56px] z-50">
        <Link
          to="/"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] bg-[#111111] border border-[#222222] text-muted-foreground hover:text-foreground hover:border-[#333333] transition-all"
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

        {/* Center: Live Canvas + Annotation Overlay */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <LiveCanvas />
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

        {showVersions && !state.stylePanelOpen && (
          <div className="w-[280px] shrink-0 border-l border-border bg-[#0a0a0a]">
            <VersionManager />
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