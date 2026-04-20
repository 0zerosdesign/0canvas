// ──────────────────────────────────────────────────────────
// 0canvas Mac App — Three-Column Shell
// ──────────────────────────────────────────────────────────
//
// Layout (Phase 1A-1 scaffold — column 1 and column 2 are
// placeholders that will be populated in Phase 1B and 1C):
//
//   ┌──────────┬──────────────────┬──────────────────────┐
//   │ Column 1 │ Column 2         │ Column 3             │
//   │ Nav      │ Agent Workspace  │ Design Canvas        │
//   │ (240px)  │ (440px)          │ (fills remaining)    │
//   │          │                  │                      │
//   │ stub     │ tab bar stub     │ <EngineWorkspace />  │
//   └──────────┴──────────────────┴──────────────────────┘
//
// Column 3 mounts the existing workspace unchanged —
// 100% feature parity is the Phase 1A exit criterion.
// ──────────────────────────────────────────────────────────

import React, { useEffect } from "react";
import { WorkspaceProvider, useWorkspace } from "./0canvas/store/store";
import { BridgeProvider } from "./0canvas/bridge/use-bridge";
import { AutoConnect, EngineWorkspace } from "./0canvas/engine/0canvas-engine";
import { injectStyles } from "./0canvas/engine/0canvas-styles";
import { Column1Nav } from "./shell/column1-nav";
import { Column2Workspace } from "./shell/column2-workspace";
import "./shell/app-shell.css";

// Inject the existing 0canvas overlay CSS exactly once at module load.
// The workspace panels inside Column 3 rely on it.
injectStyles();

/**
 * Force the design page on first mount. Page state may persist between
 * sessions via the workspace store; in the Mac app we always want Design
 * to be the landing view — Themes / Settings are secondary surfaces the
 * user navigates to explicitly.
 */
function ForceDesignPageOnBoot() {
  const { dispatch } = useWorkspace();
  useEffect(() => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "design" });
  }, [dispatch]);
  return null;
}

export function AppShell() {
  return (
    <WorkspaceProvider>
      <BridgeProvider>
        <AutoConnect>
          <ForceDesignPageOnBoot />
          <div className="oc-app">
            <Column1Nav />
            <Column2Workspace />
            <div className="oc-column-3">
              {/* onClose omitted — Mac app has no overlay to close,
                  so the AppSidebar's X button is hidden entirely. */}
              <EngineWorkspace />
            </div>
          </div>
        </AutoConnect>
      </BridgeProvider>
    </WorkspaceProvider>
  );
}

export default AppShell;
