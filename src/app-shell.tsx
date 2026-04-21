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
import { SelectionSync } from "./0canvas/acp/selection-sync";
import { AutoConnect, EngineWorkspace } from "./0canvas/engine/0canvas-engine";
import { injectStyles } from "./0canvas/engine/0canvas-styles";
import { Column1Nav } from "./shell/column1-nav";
import { Column2Workspace } from "./shell/column2-workspace";
import { TitleBar } from "./shell/title-bar";
import { ActivityBar, type ActivityView } from "./shell/activity-bar";
import { StatusBar } from "./shell/status-bar";
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
    const raw = getSetting<ChatThread[]>(CHATS_STORAGE_KEY, []);
    // Schema migration (Stream 3): ensure every chat has a `folder`
    // field. Chats persisted before the project-grouping work don't
    // carry one; default them to "" so they fall under the ambient
    // "No project" header rather than crashing the group function.
    const chats: ChatThread[] = raw.map((c) => ({
      ...c,
      folder: typeof c.folder === "string" ? c.folder : "",
    }));
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
 * Settings renders inside Column 3 like any other page. The 3-column
 * shell stays visible so nav and chat remain reachable; Settings
 * supplies its own horizontal tabs at the top of Col 3 matching the
 * Design / Themes tab pattern. activePage drives which component
 * mounts inside Col 3.
 */
function ShellRouter() {
  const { state } = useWorkspace();
  // Activity-bar selected view. Currently wired for visual state only —
  // Col 1 still renders its full tree inside the sidebar slot. Future
  // migration will swap this to filter what appears in the sidebar.
  const [activityView, setActivityView] = React.useState<ActivityView>("chats");
  return (
    <div className="oc-app-root">
      <TitleBar />
      <div className="oc-app-body">
        <ActivityBar active={activityView} onChange={setActivityView} />
        <div className="oc-app">
          <Column1Nav />
          <Column2Workspace />
          <div className="oc-column-3" data-0canvas-root="">
            {state.activePage === "settings" ? <SettingsPage /> : <EngineWorkspace />}
          </div>
        </div>
      </div>
      <StatusBar />
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
          <SelectionSync />
          <ShellRouter />
        </AutoConnect>
      </BridgeProvider>
    </WorkspaceProvider>
  );
}

export default AppShell;
