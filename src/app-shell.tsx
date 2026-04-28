// ──────────────────────────────────────────────────────────
// Zeros Mac App — Three-Column Shell
// ──────────────────────────────────────────────────────────
//
// Layout: the Electron shell wraps the agent sidebar, chat workspace,
// and right-side work surface:
//
//   ┌──────────┬──────────────────┬──────────────────────┐
//   │ Column 1 │ Column 2         │ Column 3             │
//   │ Nav      │ Agent Workspace  │ Design Canvas        │
//   │ (240px)  │ (440px)          │ (fills remaining)    │
//   │          │                  │                      │
//   │ chats    │ chat/mission     │ tabs + workspace     │
//   └──────────┴──────────────────┴──────────────────────┘
//
// Column 3 mounts the design workspace beside native-adjacent tools
// such as Git, Terminal, Env, and Todo.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useRef } from "react";
import { WorkspaceProvider, useWorkspace, type ChatThread } from "./zeros/store/store";
import { hydrateAiApiKey } from "./zeros/lib/openai";
import { BridgeProvider, useBridge, useExtensionConnected } from "./zeros/bridge/use-bridge";
import { SelectionSync } from "./zeros/agent/selection-sync";
import { AutoConnect } from "./zeros/engine/zeros-engine";
import { AgentSessionsProvider, useAgentSessions } from "./zeros/agent/sessions-provider";
import { loadCatalog } from "./zeros/agent/model-catalog";
import { injectStyles } from "./zeros/engine/zeros-styles";
import { Column1Nav } from "./shell/column1-nav";
import { Column2Workspace } from "./shell/column2-workspace";
import { Column3 } from "./shell/column3";
import { TitleBar } from "./shell/title-bar";
import { SettingsPage } from "./zeros/panels/settings-page";
import { onProjectChanged } from "./native/native";
import { loadStickyDefaults, saveStickyDefaults } from "./shell/empty-composer";
import { getSetting, setSetting } from "./native/settings";
import { rememberProject } from "./native/recent-projects";
import {
  dbListChats,
  dbReplaceAllChats,
  type ChatRowWire,
} from "./zeros/agent/agent-history-client";
import "./shell/app-shell.css";

const CHATS_STORAGE_KEY = "chats-v1";
// Secondary, never-wiped snapshot of the chat list. If the primary key
// ever shows up empty (corrupt localStorage, accidental reducer wipe, a
// dev reload that races with hydrate, an origin change), we can still
// recover the user's sidebar from this. Only updated on writes that
// *have* chats, so a legitimate empty primary never stomps the backup.
const CHATS_BACKUP_KEY = "chats-v1-backup";
// Tombstone flag — true when the most recent write left the primary
// list intentionally empty (user deleted/archived all chats). Tells
// hydrate "don't second-guess this; do NOT restore from backup".
// Without it, the safety net resurrects every chat the user just
// removed on the next reload.
const CHATS_TOMBSTONE_KEY = "chats-v1-cleared";
const ACTIVE_CHAT_KEY = "active-chat-id";

// Inject the design workspace CSS exactly once at module load.
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
 * Pre-warm agent subprocesses so the first real session isn't paying
 * cold-start cost (CLI discovery + adapter spawn + agent initialize
 * handshake). Runs once the bridge reports ENGINE_READY and warms, in
 * priority order:
 *
 *   1. the active chat's agent (user is about to talk to it)
 *   2. the rest of the agents currently attached to any chat
 *   3. every enabled registry agent (first-run: all of them)
 *
 * Everything is fire-and-forget — a real session creation will still
 * surface the agent's own error. Idempotent: initAgent in the session
 * manager no-ops when the subprocess is already alive.
 */
function PreWarmAgents() {
  const { state } = useWorkspace();
  const sessions = useAgentSessions();
  const warmedRef = React.useRef(false);
  const engineReady = useExtensionConnected();

  const warmAll = React.useCallback(async () => {
    try {
      const registry = await sessions.listAgents();
      const persisted = readEnabledAgentIds();
      const isEnabled = (id: string) =>
        persisted === null ? true : persisted.includes(id);

      const order: string[] = [];
      const active = state.chats.find((c) => c.id === state.activeChatId);
      if (active?.agentId) order.push(active.agentId);
      for (const c of state.chats) {
        if (c.agentId && !order.includes(c.agentId)) order.push(c.agentId);
      }
      for (const a of registry) {
        if (isEnabled(a.id) && !order.includes(a.id)) order.push(a.id);
      }

      await Promise.all(
        order.map((id) =>
          sessions.initAgent(id).catch(() => {
            /* silent */
          }),
        ),
      );
    } catch {
      /* registry unreachable — real session flow still recovers */
    }
  }, [sessions, state.chats, state.activeChatId]);

  // Initial boot warm — fires once as soon as the engine is reachable.
  useEffect(() => {
    if (!engineReady || warmedRef.current) return;
    warmedRef.current = true;
    void warmAll();
  }, [engineReady, warmAll]);

  // Re-warm on window focus. If the user was backgrounded long enough
  // for the sidecar watchdog to cycle the engine (or for an agent to
  // self-exit on idle), this makes everything hot again before they
  // click anything. Throttled so rapid focus/blur doesn't hammer.
  useEffect(() => {
    if (!engineReady) return;
    let lastRun = 0;
    const onFocus = () => {
      const now = Date.now();
      if (now - lastRun < 10_000) return;
      lastRun = now;
      void warmAll();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [engineReady, warmAll]);

  return null;
}

/** Read the persisted enabled-agents list synchronously so PreWarmAgents
 *  can decide which agents are visible without mounting the hook. Returns
 *  null on first run (all agents enabled by default). */
function readEnabledAgentIds(): string[] | null {
  try {
    const raw = localStorage.getItem("zeros.agent.enabledAgents");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ids?: unknown };
    if (Array.isArray(parsed?.ids)) {
      return parsed.ids.filter((x): x is string => typeof x === "string");
    }
  } catch {
    /* corrupt localStorage — fall through to default-on */
  }
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

/** Translate a renderer-side ChatThread to the SQLite wire shape. The
 *  wire form keeps every field a plain JSON-safe value so the IPC
 *  envelope doesn't need a custom serializer. */
function threadToRow(c: ChatThread): ChatRowWire {
  return {
    id: c.id,
    folder: c.folder ?? "",
    agentId: c.agentId ?? null,
    agentName: c.agentName ?? null,
    model: c.model ?? null,
    effort: c.effort,
    permissionMode: c.permissionMode,
    title: c.title ?? "",
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    sessionId: c.sessionId ?? null,
    pinned: !!c.pinned,
    archived: !!c.archived,
    sourceChatId: c.sourceChatId ?? null,
  };
}

function rowToThread(r: ChatRowWire): ChatThread {
  const validEffort = ["low", "medium", "high", "xhigh"] as const;
  const validMode = ["full", "auto-edit", "ask", "plan-only"] as const;
  type Effort = (typeof validEffort)[number];
  type Mode = (typeof validMode)[number];
  const effort: Effort = (validEffort as readonly string[]).includes(r.effort)
    ? (r.effort as Effort)
    : "medium";
  const permissionMode: Mode = (validMode as readonly string[]).includes(
    r.permissionMode,
  )
    ? (r.permissionMode as Mode)
    : "ask";
  return {
    id: r.id,
    folder: r.folder,
    agentId: r.agentId,
    agentName: r.agentName,
    model: r.model,
    effort,
    permissionMode,
    title: r.title,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    sessionId: r.sessionId ?? undefined,
    pinned: r.pinned,
    archived: r.archived,
    sourceChatId: r.sourceChatId ?? undefined,
  };
}

/**
 * Hydrate the chat list from settings on mount; save back on every
 * change. Kept separate from the UI components so Column 1 and the
 * Chat panel can both render off the same store-backed list without
 * re-implementing persistence.
 *
 * Storage layering (post-migration):
 *   - SQLite (`chats` table) is the durable source of truth. Survives
 *     a localStorage wipe, no 5–10 MB origin quota.
 *   - localStorage (`oc-chats-v1` + backup + tombstone) is a sync-boot
 *     cache so the sidebar paints without a round-trip on cold start.
 *
 * On boot we hydrate sync from LS, then if LS was empty (and the user
 * didn't intentionally clear), we async-fetch from SQLite and re-hydrate
 * if rows are there. On every state.chats mutation we mirror the list
 * to SQLite so the durable copy stays current.
 */
function ChatsPersistence() {
  const { state, dispatch } = useWorkspace();
  const hydrated = React.useRef(false);

  // Hydrate once.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let raw = getSetting<ChatThread[]>(CHATS_STORAGE_KEY, []);
    // Recovery path: if the primary list is empty but the backup has
    // entries, restore from backup. Protects against the "my chats
    // disappeared after a UI change" class of bugs, where an
    // unrelated reducer or origin change wiped `chats-v1` while the
    // backup survived. Suppressed when the tombstone says the empty
    // state is intentional (user cleared everything) — otherwise
    // deleted chats come back on every reload.
    if (!Array.isArray(raw) || raw.length === 0) {
      const tombstoned = getSetting<boolean>(CHATS_TOMBSTONE_KEY, false);
      if (!tombstoned) {
        const backup = getSetting<ChatThread[]>(CHATS_BACKUP_KEY, []);
        if (Array.isArray(backup) && backup.length > 0) {
          console.warn(
            `[Zeros] primary chats empty — restored ${backup.length} from backup`,
          );
          raw = backup;
        }
      }
    }
    // Schema migrations — old chat records predate:
    //   - `folder`   (Stream 3, per-project grouping)
    //   - `agentId`  (per-chat agent binding)
    //   - `agentName`
    //   - `sessionId` (replaces the one-shot `resumeSessionId` — old
    //                  records that still carry resumeSessionId get
    //                  promoted so existing chats keep their disk link)
    // Default missing fields rather than dropping old chats on the floor.
    const chats: ChatThread[] = raw.map((c) => {
      const legacyResume = (c as any).resumeSessionId;
      return ({
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
      pinned: typeof (c as any).pinned === "boolean" ? (c as any).pinned : false,
      archived:
        typeof (c as any).archived === "boolean" ? (c as any).archived : false,
      sessionId:
        typeof (c as any).sessionId === "string"
          ? (c as any).sessionId
          : typeof legacyResume === "string"
            ? legacyResume
            : undefined,
    });
    });
    // Three distinct cases for the persisted active-chat-id — we must
    // not collapse them, or the workspace-swap flow glitches:
    //   - absent   → fresh app, pick most-recently-touched as a friendly default
    //   - "null"   → user explicitly cleared (e.g., picked a new workspace,
    //                 clicked "New Agent"). Honor the intent: land on the
    //                 EmptyComposer. Do NOT auto-pick a chat, or the
    //                 Column 3 panel flashes in and out.
    //   - "<id>"   → restore if still valid; else fall back to most-recent.
    const rawActive = (() => {
      try {
        return localStorage.getItem(`oc-${ACTIVE_CHAT_KEY}`);
      } catch {
        return null;
      }
    })();
    // Most-recent fallback skips archived chats — landing on an
    // archived chat would silently confuse the user.
    const liveChats = chats.filter((c) => !c.archived);
    const mostRecentLive = (): string | null =>
      liveChats.length > 0
        ? [...liveChats].sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
          )[0]?.id ?? null
        : null;
    let activeChatId: string | null;
    if (rawActive === null) {
      // Key absent — fresh app run / post-clear-storage. Land the user
      // on their most-recent chat so "I reopened the app and my work
      // is gone" doesn't happen.
      activeChatId = mostRecentLive();
    } else {
      let parsed: string | null = null;
      try {
        parsed = JSON.parse(rawActive) as string | null;
      } catch {
        parsed = null;
      }
      if (parsed === null) {
        // Explicit clear — empty composer is the intent.
        activeChatId = null;
      } else if (chats.some((c) => c.id === parsed && !c.archived)) {
        activeChatId = parsed;
      } else {
        // Stale or archived selection — chat was deleted/archived between runs.
        activeChatId = mostRecentLive();
      }
    }
    dispatch({ type: "HYDRATE_CHATS", chats, activeChatId });

    // Async recovery: if the LS list ended up empty (and the user
    // didn't intentionally clear), fall through to SQLite. This is
    // how the user recovers their sidebar after a DevTools storage
    // wipe — LS is the fast cache, SQLite is the durable store.
    // If both are empty we stay on the empty composer (true fresh
    // start), which is the explicit user requirement here.
    if (chats.length === 0) {
      const tombstoned = getSetting<boolean>(CHATS_TOMBSTONE_KEY, false);
      if (!tombstoned) {
        void (async () => {
          try {
            const rows = await dbListChats();
            if (rows.length === 0) return;
            const recovered = rows.map(rowToThread);
            console.warn(
              `[Zeros] LS chats empty — recovered ${recovered.length} from SQLite`,
            );
            // Reuse the same active-chat policy: empty composer if
            // active was explicitly null, else most-recent live chat.
            const live = recovered.filter((c) => !c.archived);
            const fallbackActive =
              live.length > 0
                ? [...live].sort(
                    (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
                  )[0]?.id ?? null
                : null;
            const nextActive =
              rawActive === null
                ? fallbackActive
                : (() => {
                    try {
                      const parsed = JSON.parse(rawActive!) as string | null;
                      if (parsed === null) return null;
                      return live.some((c) => c.id === parsed)
                        ? parsed
                        : fallbackActive;
                    } catch {
                      return fallbackActive;
                    }
                  })();
            dispatch({
              type: "HYDRATE_CHATS",
              chats: recovered,
              activeChatId: nextActive,
            });
          } catch (err) {
            console.warn("[Zeros] SQLite chat recovery failed:", err);
          }
        })();
      }
    } else {
      // First boot after upgrade: LS already had chats, SQLite is
      // empty. Backfill SQLite so the durable copy catches up. The
      // mirror effect below would do this on the next mutation, but
      // a fresh-installed user could go a long time before any
      // mutation — better to seed up front.
      void (async () => {
        try {
          const rows = await dbListChats();
          if (rows.length === 0) {
            await dbReplaceAllChats(chats.map(threadToRow));
          }
        } catch (err) {
          console.warn("[Zeros] SQLite chat backfill failed:", err);
        }
      })();
    }
  }, [dispatch]);

  // Persist on change (after hydration).
  //
  // Tombstone discipline: the previous version set the tombstone the
  // moment state.chats was empty for any reason — a single transient
  // empty during workspace swap or a reducer hiccup blocked backup
  // recovery on next mount and visibly wiped the sidebar. Two guards
  // now prevent that:
  //
  //   1. We require a non-empty → empty *transition*. Empty→empty is a
  //      no-op so genuinely fresh installs don't keep rewriting the
  //      tombstone (and don't accidentally set it if the initial reducer
  //      state slips out before hydrate).
  //   2. After the transition, we wait 5 seconds before writing the
  //      tombstone. If chats become non-empty again in that window
  //      (transient hiccup), the timer is cancelled. Only intentional
  //      "user cleared everything and walked away" sticks.
  //
  // Backup updates remain immediate — they're additive and never
  // destructive, so writing them on every non-empty render is fine.
  const prevChatsLengthRef = useRef<number | null>(null);
  const tombstoneTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated.current) return;
    setSetting(CHATS_STORAGE_KEY, state.chats);
    // Mirror to SQLite — durable copy that survives an LS wipe. Fire-
    // and-forget; the LS write above is the renderer's instant ack,
    // SQLite catches up on the next event loop tick. If the IPC fails
    // (rare; only if main is mid-shutdown), the next mutation retries
    // the full list — there's no per-row drift to repair.
    void dbReplaceAllChats(state.chats.map(threadToRow)).catch((err) => {
      console.warn("[Zeros] SQLite chat mirror failed:", err);
    });
    if (state.chats.length > 0) {
      setSetting(CHATS_BACKUP_KEY, state.chats);
      setSetting(CHATS_TOMBSTONE_KEY, false);
      if (tombstoneTimerRef.current !== null) {
        window.clearTimeout(tombstoneTimerRef.current);
        tombstoneTimerRef.current = null;
      }
      prevChatsLengthRef.current = state.chats.length;
      return;
    }
    // state.chats.length === 0 below.
    const prev = prevChatsLengthRef.current;
    prevChatsLengthRef.current = 0;
    if (prev === null || prev === 0) {
      // Empty → empty. Either initial render before hydrate, or a real
      // fresh install. Don't touch the tombstone — leaving it false
      // means a future write that genuinely transitions non-empty →
      // empty will set it correctly, and a future hydrate sees backup
      // recovery available.
      return;
    }
    // Non-empty → empty. Schedule a tombstone write after the debounce.
    // Cancelled in the non-empty branch above if chats reappear.
    if (tombstoneTimerRef.current === null) {
      tombstoneTimerRef.current = window.setTimeout(() => {
        setSetting(CHATS_TOMBSTONE_KEY, true);
        tombstoneTimerRef.current = null;
      }, 5000);
    }
  }, [state.chats]);

  useEffect(() => {
    if (!hydrated.current) return;
    setSetting(ACTIVE_CHAT_KEY, state.activeChatId);
    // Mirror the active chat's picker state into the sticky-defaults
    // store so the next "+ New Agent" lands with the same agent /
    // folder / model / effort / permission mode the user is currently
    // working in. Skipped when activeChatId is null (e.g. user just
    // clicked New Agent itself) — we want the prior sticky to drive
    // that empty state, not the absence of a chat.
    if (state.activeChatId) {
      const active = state.chats.find((c) => c.id === state.activeChatId);
      if (active) {
        saveStickyDefaults({
          agentId: active.agentId,
          folder: active.folder || null,
          model: active.model,
          effort: active.effort,
          permissionMode: active.permissionMode,
        });
      }
    }
  }, [state.activeChatId, state.chats]);

  return null;
}

/**
 * When the user picks a new project folder, the Electron main process
 * respawns the local engine on a fresh port and emits `project-changed`.
 *
 * In-place swap (no webview reload):
 *   1. Drop every in-memory session — they reference the dead engine's
 *      sessionIds. The persistent chat.sessionId on disk lets us
 *      replay history on the user's next chat-open.
 *   2. Force the bridge client to re-resolve the engine port and open a
 *      fresh socket. Pending RPCs reject with a soft-fail — upstream
 *      retry loops handle it.
 *   3. Bump projectGeneration in the store. Project-scoped consumers
 *      (column 1's currentRoot probe, file tree, terminal) rerun their
 *      effects against the new root.
 *
 * Generation guard: any late callback from the old engine is dropped
 * because (a) the websocket is closed, so events stop arriving, and
 * (b) the in-memory sessionId → chatId map was wiped by disposeAll().
 */
function ReloadOnProjectChange() {
  const sessions = useAgentSessions();
  const bridge = useBridge();
  const { dispatch } = useWorkspace();

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    // Recent projects are populated only by explicit user action
    // (Open Folder, Clone, picking a workspace from the dropdown). We
    // intentionally do NOT auto-seed from the engine root on boot —
    // the engine always boots into *some* cwd (the dev repo, or the
    // sentinel ~/.zeros/default-project for end users), and seeding
    // that into recents resurrects entries the user just cleared.
    // Fresh start = empty recents until the user picks a folder.

    onProjectChanged((payload) => {
      console.log("[Zeros] project changed", payload);
      rememberProject(payload.root);
      sessions.disposeAll();
      // Clear just the folder hint on the sticky defaults — the user
      // explicitly switched workspaces, so the next "+ New Agent"
      // should default to the new engine root, not the old workspace.
      // Agent / model / effort / permission carry over, since those
      // are about how the user likes to work, not where.
      saveStickyDefaults({ ...loadStickyDefaults(), folder: null });
      dispatch({ type: "BUMP_PROJECT_GENERATION" });
      // Fire-and-forget — the bridge will set status to "connecting"
      // immediately and any consumer waiting on a connected status
      // sees the update through useBridgeStatus.
      void bridge?.forceReconnect();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [sessions, bridge, dispatch]);
  return null;
}

/**
 * Settings renders inside Column 3 like any other page. The 3-column
 * shell stays visible so nav and chat remain reachable; Settings
 * supplies its own horizontal tabs at the top of Col 3 matching the
 * Design / Themes tab pattern. activePage drives which component
 * mounts inside Col 3.
 */
const COL3_COLLAPSED_KEY = "column-3-collapsed";

function ShellRouter() {
  const { state } = useWorkspace();

  // Column 3 collapse. When collapsed, the design/IDE panel is hidden and
  // Column 2 expands to fill the remaining width with its chat content
  // centered — Cursor's ⌥⌘B "Show/Hide Panel" behaviour.
  const [col3CollapsedPref, setCol3CollapsedPref] = React.useState<boolean>(
    () => getSetting<boolean>(COL3_COLLAPSED_KEY, false),
  );
  // New-agent window rule: whenever there's no active chat (empty
  // composer showing, either from "New Agent" or after Open Workspace
  // picked a new folder), the panel is force-collapsed regardless of
  // the user's preference. The chat input gets the whole column, the
  // way it does in Cursor's new-agent flow. As soon as a chat is
  // active again, the user's persisted preference takes over.
  const col3Collapsed = col3CollapsedPref || state.activeChatId === null;
  const toggleCol3 = React.useCallback(() => {
    setCol3CollapsedPref((prev) => {
      const next = !prev;
      setSetting(COL3_COLLAPSED_KEY, next);
      return next;
    });
  }, []);

  // ⌥⌘B anywhere toggles Column 3. Skipped inside editable surfaces so
  // we don't steal from native text-input bindings (if any use ⌥⌘B).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== "b") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      e.preventDefault();
      toggleCol3();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCol3]);

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
        <div className={`oc-app ${col3Collapsed ? "is-col3-collapsed" : ""}`}>
          <Column1Nav />
          <Column2Workspace
            col3Collapsed={col3Collapsed}
            onExpandCol3={toggleCol3}
          />
          {!col3Collapsed && <Column3 onCollapse={toggleCol3} />}
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
          <AgentSessionsProvider>
            <ForceDesignPageOnBoot />
            <HydrateAiApiKey />
            <LoadModelCatalogOnBoot />
            <PreWarmAgents />
            <ReloadOnProjectChange />
            <ChatsPersistence />
            <SelectionSync />
            <ShellRouter />
          </AgentSessionsProvider>
        </AutoConnect>
      </BridgeProvider>
    </WorkspaceProvider>
  );
}

export default AppShell;
