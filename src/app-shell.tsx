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
import { hydrateAiApiKey } from "./0canvas/lib/openai";
import { BridgeProvider } from "./0canvas/bridge/use-bridge";
import { AutoConnect, EngineWorkspace } from "./0canvas/engine/0canvas-engine";
import { injectStyles } from "./0canvas/engine/0canvas-styles";
import { Column1Nav } from "./shell/column1-nav";
import { Column2Workspace } from "./shell/column2-workspace";
import { SettingsPage } from "./0canvas/panels/settings-page";
import { onProjectChanged } from "./native/tauri-events";
import { getSetting, setSetting } from "./native/settings";
import { rememberProject } from "./native/recent-projects";
import { invoke } from "@tauri-apps/api/core";
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
 * Phase 2-C: pull the OpenAI api key from the macOS keychain and merge
 * it into AiSettings. The initial store value is synchronous and comes
 * from localStorage without the secret; this effect fills it in a tick
 * later. Any save from the Settings page persists the key back to the
 * keychain, so subsequent reloads find it here.
 */
function HydrateAiApiKey() {
  const { state, dispatch } = useWorkspace();
  useEffect(() => {
    let cancelled = false;
    hydrateAiApiKey(state.aiSettings).then((hydrated) => {
      if (cancelled) return;
      if (hydrated.apiKey && hydrated.apiKey !== state.aiSettings.apiKey) {
        dispatch({ type: "SET_AI_SETTINGS", settings: hydrated });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
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

    // Seed the recent-projects list with whatever the engine is pointed
    // at right now (Finder launch, CWD default, etc.) so the dropdown
    // has at least one entry on first run.
    (async () => {
      try {
        const root = await invoke<string | null>("get_engine_root");
        if (root) rememberProject(root);
      } catch {
        /* not running under Tauri, or engine not ready yet */
      }
    })();

    onProjectChanged((payload) => {
      console.log("[0canvas] project changed", payload);
      rememberProject(payload.root);
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

/**
 * Settings is a full-page destination — not a column-3 tab. When
 * activePage === "settings" we cover the 3-column shell entirely and
 * render SettingsPage at the viewport root. The page provides its own
 * "Back to app" control that flips activePage back to "design".
 */
function ShellRouter() {
  const { state } = useWorkspace();
  if (state.activePage === "settings") {
    return (
      <div className="oc-settings-fullscreen" data-0canvas-root="">
        <SettingsPage />
      </div>
    );
  }
  return (
    <div className="oc-app">
      <Column1Nav />
      <Column2Workspace />
      <div className="oc-column-3" data-0canvas-root="">
        {/* data-0canvas-root scopes the engine's injected CSS
            (all rules are prefixed with [data-0canvas-root]).
            onClose is omitted — the Mac app has no overlay
            to close, so AppSidebar's X button is hidden. */}
        <EngineWorkspace />
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <WorkspaceProvider>
      <BridgeProvider>
        <AutoConnect>
          <ForceDesignPageOnBoot />
          <HydrateAiApiKey />
          <ReloadOnProjectChange />
          <ChatsPersistence />
          <ShellRouter />
        </AutoConnect>
      </BridgeProvider>
    </WorkspaceProvider>
  );
}

export default AppShell;
