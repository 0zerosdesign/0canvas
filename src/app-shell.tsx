// ──────────────────────────────────────────────────────────
// Zeros Mac App — Three-Column Shell
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
import { WorkspaceProvider, useWorkspace, type ChatThread } from "./zeros/store/store";
import { hydrateAiApiKey } from "./zeros/lib/openai";
import { BridgeProvider } from "./zeros/bridge/use-bridge";
import { SelectionSync } from "./zeros/acp/selection-sync";
import { AutoConnect } from "./zeros/engine/zeros-engine";
import { AcpSessionsProvider, useAcpSessions } from "./zeros/acp/sessions-provider";
import { loadCatalog } from "./zeros/acp/model-catalog";
import { injectStyles } from "./zeros/engine/zeros-styles";
import { Column1Nav } from "./shell/column1-nav";
import { Column2Workspace } from "./shell/column2-workspace";
import { Column3 } from "./shell/column3";
import { TitleBar } from "./shell/title-bar";
import { ActivityBar, type ActivityView } from "./shell/activity-bar";
import { SettingsPage } from "./zeros/panels/settings-page";
import { onProjectChanged } from "./native/native";
import { nativeInvoke } from "./native/runtime";
import { getSetting, setSetting } from "./native/settings";
import { rememberProject } from "./native/recent-projects";
import "./shell/app-shell.css";

const CHATS_STORAGE_KEY = "chats-v1";
const ACTIVE_CHAT_KEY = "active-chat-id";

// Inject the existing Zeros overlay CSS exactly once at module load.
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

/** Warm the model catalog on boot so the composer pill shows
 *  hot-updated models on first open. Failures are silent — the
 *  bundled fallback kicks in. */
function LoadModelCatalogOnBoot() {
  useEffect(() => {
    void loadCatalog();
  }, []);
  return null;
}

/**
 * Pre-warm the agent subprocesses referenced by existing chats so the
 * first `ensureSession` call doesn't pay the adapter-spawn + ACP
 * `initialize` round trip. Fires once on mount, fire-and-forget.
 *
 * Only warms unique agent ids; if the user has 10 Claude chats we warm
 * Claude once. Does NOT pre-create sessions — just the subprocess.
 */
function PreWarmAgents() {
  const { state } = useWorkspace();
  const sessions = useAcpSessions();
  const warmedRef = React.useRef(false);
  useEffect(() => {
    if (warmedRef.current) return;
    // Wait until the bridge is up — initAgent rejects otherwise.
    // A short delay also lets the registry preload from cache.
    const t = window.setTimeout(() => {
      if (warmedRef.current) return;
      const unique = new Set<string>();
      const active = state.chats.find((c) => c.id === state.activeChatId);
      if (active?.agentId) unique.add(active.agentId);
      for (const c of state.chats) if (c.agentId) unique.add(c.agentId);
      for (const id of unique) {
        void sessions.initAgent(id).catch(() => {
          /* warming failures are invisible — real session creation will
             surface actual errors */
        });
      }
      warmedRef.current = true;
    }, 800);
    return () => window.clearTimeout(t);
  }, [state.chats, state.activeChatId, sessions]);
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
    // Schema migrations — old chat records predate:
    //   - `folder`   (Stream 3, per-project grouping)
    //   - `agentId`  (Phase C, per-chat ACP binding)
    //   - `agentName`
    // Default missing fields rather than dropping old chats on the floor.
    const chats: ChatThread[] = raw.map((c) => ({
      ...c,
      folder: typeof c.folder === "string" ? c.folder : "",
      agentId: typeof (c as any).agentId === "string" ? (c as any).agentId : null,
      agentName: typeof (c as any).agentName === "string" ? (c as any).agentName : null,
      model: typeof (c as any).model === "string" ? (c as any).model : null,
      effort:
        (c as any).effort === "low" ||
        (c as any).effort === "medium" ||
        (c as any).effort === "high" ||
        (c as any).effort === "xhigh"
          ? (c as any).effort
          : "medium",
      permissionMode:
        (c as any).permissionMode === "full" ||
        (c as any).permissionMode === "auto-edit" ||
        (c as any).permissionMode === "ask" ||
        (c as any).permissionMode === "plan-only"
          ? (c as any).permissionMode
          : "ask",
    }));
    const storedActive = getSetting<string | null>(ACTIVE_CHAT_KEY, null);
    const storedStillValid =
      storedActive && chats.some((c) => c.id === storedActive)
        ? storedActive
        : null;
    // If the stored selection is stale (chat deleted, or this is a fresh
    // workspace-reload path where activeChatId wasn't persisted), fall back
    // to the most-recently-updated chat rather than showing the blank empty
    // composer — "I opened the app and my work is gone" is the worst UX.
    let activeChatId = storedStillValid;
    if (!activeChatId && chats.length > 0) {
      const mostRecent = [...chats].sort(
        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
      )[0];
      activeChatId = mostRecent?.id ?? null;
    }
    dispatch({ type: "HYDRATE_CHATS", chats, activeChatId });
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
        const root = await nativeInvoke<string | null>("get_engine_root");
        if (root) rememberProject(root);
      } catch {
        /* native runtime absent, or engine not ready yet */
      }
    })();

    onProjectChanged((payload) => {
      console.log("[Zeros] project changed", payload);
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

  // Settings takes the entire body (Cursor-style full-screen). The 3-col
  // shell hides while the user's in settings; a Back button returns them.
  if (state.activePage === "settings") {
    return (
      <div className="oc-app-root">
        <TitleBar />
        <div className="oc-app-body">
          <div data-Zeros-root="" className="oc-settings-root">
            <SettingsPage />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="oc-app-root">
      <TitleBar />
      <div className="oc-app-body">
        <ActivityBar active={activityView} onChange={setActivityView} />
        <div className="oc-app">
          <Column1Nav />
          <Column2Workspace />
          <Column3 />
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  return (
    <WorkspaceProvider>
      <BridgeProvider>
        <AutoConnect>
          <AcpSessionsProvider>
            <ForceDesignPageOnBoot />
            <HydrateAiApiKey />
            <LoadModelCatalogOnBoot />
            <PreWarmAgents />
            <ReloadOnProjectChange />
            <ChatsPersistence />
            <SelectionSync />
            <ShellRouter />
          </AcpSessionsProvider>
        </AutoConnect>
      </BridgeProvider>
    </WorkspaceProvider>
  );
}

export default AppShell;
