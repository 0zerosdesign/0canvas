import React, { useEffect } from "react";
import { useWorkspace } from "../store";
import { WorkspaceToolbar } from "../components/workspace-toolbar";
import { LayersPanel } from "../components/layers-panel";
import { StylePanel } from "../components/style-panel";
import { PreviewCanvas } from "../components/preview-canvas";
import { AgentPanel } from "../components/agent-panel";
import { BrainstormPanel } from "../components/brainstorm-panel";
import { VersionManager } from "../components/version-manager";
import { CommandPalette } from "../components/command-palette";
import { FileMapPanel } from "../components/file-map-panel";
import { AnnotationOverlay } from "../components/annotation-overlay";

function WorkspaceInner() {
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

  // Determine right panel
  const showVersions =
    !state.idePanelOpen &&
    !state.brainstormMode &&
    !state.fileMapPanelOpen;

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
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

        {/* Center: Preview Canvas + Annotation Overlay */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          <PreviewCanvas />
          <AnnotationOverlay />
        </div>

        {/* Right panels */}
        {state.stylePanelOpen && (
          <div className="w-[280px] shrink-0 h-full overflow-hidden">
            <StylePanel />
          </div>
        )}

        {state.fileMapPanelOpen && !state.stylePanelOpen && (
          <div className="w-[280px] shrink-0 border-l border-border">
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
  return <WorkspaceInner />;
}