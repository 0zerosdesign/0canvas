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
import { WorkspaceProvider, useWorkspace, type ChatThread } from "./0canvas/store/store";
import { BridgeProvider } from "./0canvas/bridge/use-bridge";
import { AutoConnect, EngineWorkspace } from "./0canvas/engine/0canvas-engine";
import { injectStyles } from "./0canvas/engine/0canvas-styles";
import { Column1Nav } from "./shell/column1-nav";
import { Column2Workspace } from "./shell/column2-workspace";
import { onProjectChanged } from "./native/tauri-events";
import { getSetting, setSetting } from "./native/settings";
import "./shell/app-shell.css";

const CHATS_STORAGE_KEY = "chats-v1";
const ACTIVE_CHAT_KEY = "active-chat-id";

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

/**
 * Hydrate the chat list from settings on mount; save back on every
 * change. Kept separate from the UI components so Column 1 and the
 * Chat panel can both render off the same store-backed list without
 * re-implementing persistence.
 */
function ChatsPersistence() {
  const { state, dispatch } = useWorkspace();
  const hydrated = React.useRef(false);

  // Hydrate once.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    const chats = getSetting<ChatThread[]>(CHATS_STORAGE_KEY, []);
    const activeChatId = getSetting<string | null>(ACTIVE_CHAT_KEY, null);
    const stillActive =
      activeChatId && chats.some((c) => c.id === activeChatId)
        ? activeChatId
        : null;
    dispatch({ type: "HYDRATE_CHATS", chats, activeChatId: stillActive });
  }, [dispatch]);

  // Persist on change (after hydration).
  useEffect(() => {
    if (!hydrated.current) return;
    setSetting(CHATS_STORAGE_KEY, state.chats);
  }, [state.chats]);

  useEffect(() => {
    if (!hydrated.current) return;
    setSetting(ACTIVE_CHAT_KEY, state.activeChatId);
  }, [state.activeChatId]);

  return null;
}

/**
 * When the user picks a new project folder via File > Open Folder, the Rust
 * side respawns the engine and emits `project-changed`. Phase 1A-2c uses
 * the simplest possible refresh: reload the webview so Column 3's workspace
 * re-reads the new project's .0c files from scratch. Phase 1B replaces this
 * with in-place state swap via the Workspace Manager route.
 */
function ReloadOnProjectChange() {
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    onProjectChanged((payload) => {
      console.log("[0canvas] project changed", payload);
      window.location.reload();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, []);
  return null;
}

export function AppShell() {
  return (
    <WorkspaceProvider>
      <BridgeProvider>
        <AutoConnect>
          <ForceDesignPageOnBoot />
          <ReloadOnProjectChange />
          <ChatsPersistence />
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
