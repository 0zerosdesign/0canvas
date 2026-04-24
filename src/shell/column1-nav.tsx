// ──────────────────────────────────────────────────────────
// Column 1 — Navigation
// ──────────────────────────────────────────────────────────
//
// Phase 1B-a: LOCALHOST is live.
// - New Chat + Skills are placeholders (Phase 1B-d/1B-e).
// - CHATS tree is placeholder (1B-e).
// - LOCALHOST polls `discover_localhost_services` every 5s.
//   Dev servers are clickable → sets project.devServerUrl so the
//   Column 3 source-node previews the user's app.
// - Profile row opens the Phase 1B-b menu (next sub-step).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageSquarePlus,
  PanelLeftClose,
  PanelLeftOpen,
  Circle,
  Database,
  Server,
  Globe,
  HelpCircle,
  Settings as SettingsIcon,
  LogOut,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  GitBranch,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  Pin,
  PinOff,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button, Input } from "../zeros/ui";
import { useWorkspace, type ChatThread } from "../zeros/store/store";
import { useAgentSessions, useChatSession } from "../zeros/agent/sessions-provider";
import { getDefaultAgentId } from "../zeros/panels/settings-page";
import {
  discoverLocalhostServices,
  openProjectFolder,
  openProjectFolderPath,
  git,
  openClonedProject,
  type LocalhostService,
} from "../native/native";
import { getSetting, setSetting } from "../native/settings";
import {
  loadRecentProjects,
  forgetProject,
  rememberProject,
  type RecentProject,
} from "../native/recent-projects";
import { useUpdater } from "../native/updater";

const DOCS_URL = "https://github.com/Withso/zeros#readme";
const COLLAPSE_KEY = "column-1-collapsed";
/** Per-folder expanded state for "show all chats beyond the first 5". */
const PROJECTS_EXPANDED_KEY = "column-1-projects-expanded";
/** Per-folder section collapsed state (workspace section chevron). */
const WORKSPACE_SECTIONS_COLLAPSED_KEY = "column-1-workspace-sections-collapsed";
/** List of folder paths the user has explicitly hidden via right-click.
 *  Hidden workspaces don't render in the sidebar; they re-appear if a
 *  new chat is created in that folder. */
const HIDDEN_WORKSPACES_KEY = "column-1-hidden-workspaces";
const LOCALHOST_COLLAPSED_KEY = "column-1-localhost-collapsed";

/** How many chats to show per project before collapsing behind "More".
 *  Matches Cursor's Agents Window behavior. */
const PROJECT_CHATS_VISIBLE = 5;

/** Max recent projects surfaced in the Open Workspace dropdown.
 *  Kept tight so the menu stays scannable — older workspaces live in
 *  the OS file system and are one "Open Folder…" away. */
const OPEN_WORKSPACE_RECENT_LIMIT = 6;

/** Visible rows in LOCALHOST before the list scrolls. Keeps the profile
 * footer pinned even when many dev servers are running. */
const LOCALHOST_VISIBLE_ROWS = 4;

const POLL_INTERVAL_MS = 5000;

/** URL that represents Zeros itself — never a valid preview target. */
function selfOrigin(): string {
  if (typeof window === "undefined") return "";
  // In dev mode this is http://localhost:5173 (Vite serving our own app).
  // In the release .app it's http://tauri.localhost or similar, and port
  // 5173 would be somebody else's dev server — no special handling needed.
  return window.location.origin.replace(/\/$/, "");
}

function useLocalhostServices() {
  const [services, setServices] = useState<LocalhostService[]>([]);

  useEffect(() => {
    let cancelled = false;
    const self = selfOrigin();

    const poll = async () => {
      try {
        const raw = await discoverLocalhostServices();
        // Mark our own dev-server URL as "self" so it renders
        // disabled — clicking it would nest Zeros inside Zeros.
        const marked = raw.map((s) =>
          s.url === self && s.kind === "dev-server"
            ? { ...s, kind: "engine" as const, label: "Zeros (self)" }
            : s,
        );
        if (!cancelled) setServices(marked);
      } catch {
        // Silent — probe failures are expected on plain-browser dev.
      }
    };

    poll();
    const id = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return services;
}

function ServiceIcon({ kind }: { kind: LocalhostService["kind"] }) {
  const common = { size: 12 };
  switch (kind) {
    case "dev-server":
      return <Globe {...common} />;
    case "database":
      return <Database {...common} />;
    case "engine":
      return <Server {...common} />;
    default:
      return <Circle {...common} />;
  }
}

function ServiceRow({
  service,
  isActive,
  onSelect,
}: {
  service: LocalhostService;
  isActive: boolean;
  onSelect: () => void;
}) {
  const clickable = service.kind === "dev-server";
  return (
    <Button
      variant="ghost"
      className={`oc-column-1__service ${isActive ? "is-active" : ""} ${
        clickable ? "" : "is-disabled"
      }`}
      onClick={clickable ? onSelect : undefined}
      title={clickable ? `Use ${service.url} as preview` : service.label}
      disabled={!clickable}
    >
      <span className="oc-column-1__service-icon">
        <ServiceIcon kind={service.kind} />
      </span>
      <span className="oc-column-1__service-port">:{service.port}</span>
      <span className="oc-column-1__service-label">{service.label}</span>
    </Button>
  );
}

// ── Chat helpers ─────────────────────────────────────────

function folderBasename(folder: string): string {
  if (!folder) return "No project";
  const parts = folder.split("/").filter(Boolean);
  return parts[parts.length - 1] || folder;
}

/** Project group label — `parent/basename` when the parent adds signal,
 * bare basename otherwise. We skip generic parents ("Users", "home")
 * because `/Users/arunrajkumar/Documents/0kit` → "Users/0kit" would be
 * misleading. A two-segment suffix like "Documents/0kit" matches
 * Cursor's `org/repo` cadence closely enough for local folders. */
function folderLabel(folder: string): string {
  if (!folder) return "No project";
  const parts = folder.split("/").filter(Boolean);
  if (parts.length === 0) return folder;
  const basename = parts[parts.length - 1]!;
  const parent = parts[parts.length - 2];
  if (!parent || parent === "Users" || parent === "home" || parts.length < 3) {
    return basename;
  }
  return `${parent}/${basename}`;
}

/** Replace `/Users/<me>/` or `/home/<me>/` with `~/` for compact display
 * in the recents list. Best-effort — no $HOME lookup from the renderer. */
function tildePath(path: string): string {
  if (!path) return path;
  return path
    .replace(/^\/Users\/[^/]+\//, "~/")
    .replace(/^\/home\/[^/]+\//, "~/");
}

/** Short "3m" / "2h" / "4d" / "Apr 12" stamp for the chat row. Anything
 * under a minute reads as "now" so we don't flicker every second. */
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d`;
  if (diff < 30 * 86_400_000) return `${Math.floor(diff / (7 * 86_400_000))}w`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Derived indicator state for the chat-row leading slot. We surface
 *  *actionable* states only — everything else reads as a subtle grey
 *  dot so the sidebar doesn't become a lava-lamp of colours.
 *
 *  Priority (first match wins):
 *    waiting  → agent is blocked on a permission prompt
 *    working  → agent is mid-turn (spinner)
 *    idle     → default (subtle grey dot)
 *
 *  Starting/ready/error/done intentionally fall through to `idle`: a
 *  chat that just finished a turn or is warming up doesn't need a
 *  different colour — the user can tell from the row's contents. */
type ChatDotStatus = "idle" | "working" | "waiting";

function chatDotStatus(session: {
  status:
    | "idle"
    | "warming"
    | "ready"
    | "streaming"
    | "reconnecting"
    | "auth-required"
    | "failed";
  pendingPermission: unknown;
}): ChatDotStatus {
  if (session.pendingPermission) return "waiting";
  if (session.status === "streaming") return "working";
  return "idle";
}

function groupChatsByFolder(chats: ChatThread[]): Map<string, ChatThread[]> {
  const map = new Map<string, ChatThread[]>();
  for (const chat of chats) {
    const list = map.get(chat.folder) ?? [];
    list.push(chat);
    map.set(chat.folder, list);
  }
  // Sort each folder's chats by updatedAt desc.
  for (const list of map.values()) {
    list.sort((a, b) => b.updatedAt - a.updatedAt);
  }
  return map;
}

async function getCurrentProjectFolder(): Promise<string> {
  const { isNativeRuntime, nativeInvoke } = await import("../native/runtime");
  if (!isNativeRuntime()) return "";
  try {
    const root = await nativeInvoke<string | null>("get_engine_root");
    return root ?? "";
  } catch {
    return "";
  }
}

function newChatId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function useProfileMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, rootRef };
}

// Phase 2-D: state for the recent-projects dropdown. Same click-outside
// + Esc pattern as the profile menu; different scope so opening one
// doesn't close the other.
function useWorkspaceMenu() {
  const [open, setOpen] = useState(false);
  const [currentRoot, setCurrentRoot] = useState<string>("");
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  // `currentRoot` is fetched once on mount — a project swap triggers a
  // window.location.reload via ReloadOnProjectChange, so this effect runs
  // on every project change for free. Previously this was gated on `open`,
  // which meant Column 1's "current workspace" grouping didn't know the
  // active folder until the user clicked the dropdown.
  useEffect(() => {
    getCurrentProjectFolder().then(setCurrentRoot);
  }, []);

  // Re-read the recent-projects list every time the menu opens so we
  // pick up the rememberProject() side-effect from ReloadOnProjectChange.
  useEffect(() => {
    if (!open) return;
    setRecents(loadRecentProjects());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const refresh = () => setRecents(loadRecentProjects());

  return { open, setOpen, rootRef, currentRoot, recents, refresh };
}

export function Column1Nav() {
  const { state, dispatch } = useWorkspace();
  const services = useLocalhostServices();
  const currentUrl = state.project?.devServerUrl ?? "";
  const profileMenu = useProfileMenu();
  const workspaceMenu = useWorkspaceMenu();
  const updater = useUpdater();
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    getSetting<boolean>(COLLAPSE_KEY, false),
  );
  // Local filter over the recent-projects dropdown. Reset each time the
  // dropdown reopens so the user always lands on the full list.
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  useEffect(() => {
    if (!workspaceMenu.open) setWorkspaceQuery("");
  }, [workspaceMenu.open]);
  // Per-folder "show all chats beyond the first 5" toggle. Default false
  // means newest 5 shown, "More" button appears when there are more.
  const [projectsExpanded, setProjectsExpanded] = useState<Record<string, boolean>>(() =>
    getSetting<Record<string, boolean>>(PROJECTS_EXPANDED_KEY, {}),
  );
  // Per-folder section collapse state — the whole workspace list body
  // folds up when clicked. Inverts for the current engine root (opens
  // by default) so the user immediately sees the active project's chats.
  const [sectionsCollapsed, setSectionsCollapsed] = useState<
    Record<string, boolean>
  >(() =>
    getSetting<Record<string, boolean>>(WORKSPACE_SECTIONS_COLLAPSED_KEY, {}),
  );
  // Folders the user explicitly hid via the workspace context menu. A
  // fresh chat in that folder lifts the hide automatically (see the
  // auto-reveal effect below).
  const [hiddenWorkspaces, setHiddenWorkspaces] = useState<string[]>(() =>
    getSetting<string[]>(HIDDEN_WORKSPACES_KEY, []),
  );
  const [localhostCollapsed, setLocalhostCollapsed] = useState<boolean>(() =>
    getSetting<boolean>(LOCALHOST_COLLAPSED_KEY, false),
  );

  const toggleSectionCollapsed = (folder: string) => {
    setSectionsCollapsed((prev) => {
      const next = { ...prev, [folder]: !prev[folder] };
      setSetting(WORKSPACE_SECTIONS_COLLAPSED_KEY, next);
      return next;
    });
  };

  const hideWorkspace = (folder: string) => {
    setHiddenWorkspaces((prev) => {
      if (prev.includes(folder)) return prev;
      const next = [...prev, folder];
      setSetting(HIDDEN_WORKSPACES_KEY, next);
      return next;
    });
  };

  const unhideWorkspace = (folder: string) => {
    setHiddenWorkspaces((prev) => {
      if (!prev.includes(folder)) return prev;
      const next = prev.filter((f) => f !== folder);
      setSetting(HIDDEN_WORKSPACES_KEY, next);
      return next;
    });
  };

  /** Right-click context menu anchored at the pointer. Closes on
   *  outside click, Escape, or menu-item selection. Only ever one
   *  open at a time — reopening on a different workspace replaces
   *  the previous position. */
  const [contextMenu, setContextMenu] = useState<{
    folder: string;
    x: number;
    y: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        contextMenuRef.current.contains(e.target as Node)
      ) {
        return;
      }
      setContextMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const openWorkspaceContextMenu = (
    folder: string,
    e: React.MouseEvent,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ folder, x: e.clientX, y: e.clientY });
  };

  const toggleLocalhost = () => {
    setLocalhostCollapsed((prev) => {
      const next = !prev;
      setSetting(LOCALHOST_COLLAPSED_KEY, next);
      return next;
    });
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      setSetting(COLLAPSE_KEY, next);
      return next;
    });
  };

  const toggleProjectExpanded = (folder: string) => {
    setProjectsExpanded((prev) => {
      const next = { ...prev, [folder]: !prev[folder] };
      setSetting(PROJECTS_EXPANDED_KEY, next);
      return next;
    });
  };

  const sessions = useAgentSessions();

  // Top-level "New Agent": deselect any chat and clear the folder
  // override so the EmptyComposer resolves to the engine root.
  //
  // Warm the default agent's subprocess while the user is still typing
  // their prompt, so first-turn latency is near-zero instead of paying
  // the ~10 s Claude initialize handshake at Enter-time.
  const handleNewChat = useCallback(() => {
    dispatch({ type: "SET_NEW_AGENT_FOLDER", folder: null });
    dispatch({ type: "SET_ACTIVE_CHAT", id: null });
    const defaultId = getDefaultAgentId();
    if (defaultId) {
      void sessions.initAgent(defaultId).catch(() => {
        /* warming is opportunistic */
      });
    }
  }, [dispatch, sessions]);

  // Per-workspace "+" now also opens the empty-state composer (instead
  // of eagerly creating a chat), but with the composer *pre-scoped* to
  // that workspace. `state.newAgentFolder` carries the scope; the
  // EmptyComposer reads it, falls back to the engine root when null.
  // Column 3 auto-collapses whenever activeChatId is null, so this
  // always lands the user on the centered new-agent surface.
  const handleNewChatInFolder = useCallback(
    (folder: string) => {
      dispatch({ type: "SET_NEW_AGENT_FOLDER", folder });
      dispatch({ type: "SET_ACTIVE_CHAT", id: null });
      const defaultId = getDefaultAgentId();
      if (defaultId) {
        void sessions.initAgent(defaultId).catch(() => {
          /* warming is opportunistic */
        });
      }
    },
    [dispatch, sessions],
  );

  // ⌘N — new chat from anywhere. Skipped when focus is inside an
  // editable surface (input, textarea, contenteditable) so we don't
  // override browser/native "new line" behavior in those contexts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "n") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      void handleNewChat();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleNewChat]);

  const handleSelectChat = (id: string) => {
    dispatch({ type: "SET_ACTIVE_CHAT", id });
  };

  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: "DELETE_CHAT", id });
  };

  const handleTogglePin = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: "TOGGLE_PIN_CHAT", id });
  };

  // Pinned chats surface at the top of the sidebar in their own section,
  // independent of project grouping. Folder groups only show non-pinned
  // chats so a chat never appears twice in the list.
  const pinnedChats = React.useMemo(
    () =>
      state.chats
        .filter((c) => c.pinned)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [state.chats],
  );
  const unpinnedChats = React.useMemo(
    () => state.chats.filter((c) => !c.pinned),
    [state.chats],
  );
  const grouped = React.useMemo(
    () => groupChatsByFolder(unpinnedChats),
    [unpinnedChats],
  );
  // Single ordered folder list for the sidebar. Current engine root
  // first, then the ambient "no project" bucket if present, then every
  // other folder alphabetically by basename. The current root is
  // *always* surfaced — even if it has no chats yet — so the user can
  // land on the empty state and get started.
  const folderKeys = React.useMemo(() => {
    const currentRoot = workspaceMenu.currentRoot;
    const keys = new Set<string>(grouped.keys());
    if (currentRoot) keys.add(currentRoot);
    const hidden = new Set(hiddenWorkspaces);
    const filtered = Array.from(keys).filter(
      (k) => !hidden.has(k) || k === currentRoot,
    );
    return filtered.sort((a, b) => {
      if (a === currentRoot && b !== currentRoot) return -1;
      if (b === currentRoot && a !== currentRoot) return 1;
      if (a === "" && b !== "") return -1;
      if (b === "" && a !== "") return 1;
      return folderBasename(a).localeCompare(folderBasename(b));
    });
  }, [grouped, hiddenWorkspaces, workspaceMenu.currentRoot]);

  // Auto-reveal: if a folder is hidden but now has chats, unhide it. A
  // new chat in a hidden folder always wins — the user's latest action
  // is a stronger signal than the prior "hide".
  useEffect(() => {
    if (hiddenWorkspaces.length === 0) return;
    const toUnhide = hiddenWorkspaces.filter((f) => grouped.has(f));
    if (toUnhide.length === 0) return;
    setHiddenWorkspaces((prev) => {
      const next = prev.filter((f) => !toUnhide.includes(f));
      setSetting(HIDDEN_WORKSPACES_KEY, next);
      return next;
    });
  }, [grouped, hiddenWorkspaces]);

  const filteredRecents = React.useMemo(() => {
    const q = workspaceQuery.trim().toLowerCase();
    const base = workspaceMenu.recents;
    const matched = q
      ? base.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.path.toLowerCase().includes(q),
        )
      : base;
    // Cap the visible list so the Open Workspace menu doesn't grow
    // unboundedly. The underlying recent-projects file retains more,
    // but this is "what do you most likely want right now".
    return matched.slice(0, OPEN_WORKSPACE_RECENT_LIMIT);
  }, [workspaceQuery, workspaceMenu.recents]);

  /**
   * Per-workspace section render. One section per folder, with:
   *   - Header: chevron (toggle collapse), name (truncate), "+" new chat,
   *     and a context menu (right-click) with "Remove from sidebar".
   *   - Body: first 5 chats visible; "Show more" expands to the full
   *     list, capped at ~10 rows of height with scroll beyond that.
   *     Empty-state message when the workspace has zero chats.
   */
  const renderFolderSection = (args: {
    folder: string;
    chats: ChatThread[];
    isShowingAll: boolean;
    isCollapsed: boolean;
    isCurrent: boolean;
    activeChatId: string | null;
    onSelectChat: (id: string) => void;
    onDeleteChat: (e: React.MouseEvent, id: string) => void;
    onTogglePin: (e: React.MouseEvent, id: string) => void;
    onToggleShowAll: (folder: string) => void;
    onToggleSection: (folder: string) => void;
    onOpenContextMenu: (folder: string, e: React.MouseEvent) => void;
    onNewInFolder: (folder: string) => void;
  }): React.ReactNode => {
    const {
      folder,
      chats,
      isShowingAll,
      isCollapsed,
      isCurrent,
      activeChatId,
      onSelectChat,
      onDeleteChat,
      onTogglePin,
      onToggleShowAll,
      onToggleSection,
      onOpenContextMenu,
      onNewInFolder,
    } = args;
    const visibleChats =
      isShowingAll || chats.length <= PROJECT_CHATS_VISIBLE
        ? chats
        : chats.slice(0, PROJECT_CHATS_VISIBLE);
    const hiddenCount = chats.length - visibleChats.length;
    return (
      <div
        key={folder}
        className={`oc-column-1__project ${isCurrent ? "is-current" : ""} ${isCollapsed ? "is-collapsed" : ""}`}
      >
        <div
          className="oc-column-1__project-header"
          onContextMenu={(e) => {
            // Current root can't be removed (it's the engine root). Hide
            // is only meaningful for secondary workspaces in the list.
            if (isCurrent) return;
            onOpenContextMenu(folder, e);
          }}
        >
          <span
            className="oc-column-1__project-name"
            title={folder || "Not associated with a project"}
          >
            {folderLabel(folder)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="oc-column-1__project-chevron"
            onClick={() => onToggleSection(folder)}
            title={isCollapsed ? "Expand workspace" : "Collapse workspace"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </Button>
          <div className="oc-column-1__project-header-spacer" />
          <Button
            variant="ghost"
            size="icon-sm"
            className="oc-column-1__project-add"
            onClick={() => onNewInFolder(folder)}
            title={`New chat in ${folderBasename(folder)}`}
            aria-label={`New chat in ${folderBasename(folder)}`}
          >
            <Plus size={12} />
          </Button>
        </div>
        {!isCollapsed && (
          <div
            className={`oc-column-1__chat-list ${isShowingAll ? "is-scroll" : ""}`}
          >
            {chats.length === 0 ? (
              <div className="oc-column-1__project-empty">No agents</div>
            ) : (
              <>
                {visibleChats.map((chat) => (
                  <ChatRow
                    key={chat.id}
                    chat={chat}
                    isActive={activeChatId === chat.id}
                    onSelect={onSelectChat}
                    onDelete={onDeleteChat}
                    onTogglePin={onTogglePin}
                  />
                ))}
                {hiddenCount > 0 && !isShowingAll && (
                  <Button
                    variant="ghost"
                    className="oc-column-1__project-more"
                    onClick={() => onToggleShowAll(folder)}
                  >
                    <MoreHorizontal size={12} />
                    <span>Show more ({hiddenCount})</span>
                  </Button>
                )}
                {isShowingAll && chats.length > PROJECT_CHATS_VISIBLE && (
                  <Button
                    variant="ghost"
                    className="oc-column-1__project-more"
                    onClick={() => onToggleShowAll(folder)}
                  >
                    <MoreHorizontal size={12} />
                    <span>Show less</span>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const handleSelect = (service: LocalhostService) => {
    if (!state.project) return;
    dispatch({
      type: "CONNECT_PROJECT",
      project: { ...state.project, devServerUrl: service.url },
    });
  };

  const handleOpenDocs = () => {
    profileMenu.setOpen(false);
    try {
      window.open(DOCS_URL, "_blank", "noopener,noreferrer");
    } catch {
      // Graceful fallthrough; native-shell-open lands in Phase 1C.
    }
  };

  const handleGoToSettings = () => {
    profileMenu.setOpen(false);
    dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" });
  };

  const handleLogout = () => {
    profileMenu.setOpen(false);
    // No auth yet — Phase 5 (distribution) wires Dev-ID license + GitHub
    // Device-Flow auth. For now this is a visible affordance that no-ops.
  };

  // ── Workspace Manager handlers ──────────────────────────

  /** Pre-reload intent: clear the persisted active-chat id so when the
   *  webview reloads into the newly-picked workspace, hydrate doesn't
   *  restore a chat from the previous project. The user lands on the
   *  EmptyComposer with the new workspace pre-scoped, ready to start
   *  a fresh agent conversation — the "wherever you are, it takes you
   *  to the new agent window" behavior. */
  const clearActiveChatBeforeSwap = () => {
    dispatch({ type: "SET_ACTIVE_CHAT", id: null });
    setSetting("active-chat-id", null);
  };

  const handlePickProject = async (path: string) => {
    workspaceMenu.setOpen(false);
    // Picking the workspace you're already in is a no-op at the
    // engine level — skip the respawn + reload and just land on the
    // new-agent window. The chat list for this workspace is already
    // visible in the sidebar; the user's intent is "start fresh".
    if (path === workspaceMenu.currentRoot) {
      dispatch({ type: "SET_NEW_AGENT_FOLDER", folder: null });
      clearActiveChatBeforeSwap();
      return;
    }
    try {
      await openProjectFolderPath(path);
      // Engine is mid-respawn; `project-changed` fires in a moment and
      // ReloadOnProjectChange reloads the webview. Clear the active
      // chat *now* so the reload lands on the EmptyComposer scoped to
      // the new workspace, not a stale chat from the previous one.
      dispatch({ type: "SET_NEW_AGENT_FOLDER", folder: null });
      clearActiveChatBeforeSwap();
    } catch (err) {
      // Path went missing — drop it from the list so the user doesn't
      // keep hitting the same ghost entry.
      console.warn("[Zeros] could not open project:", err);
      forgetProject(path);
      workspaceMenu.refresh();
    }
  };

  const handleOpenFolder = async () => {
    workspaceMenu.setOpen(false);
    try {
      // openProjectFolder() returns the chosen project's payload, or
      // null if the user cancelled the native Finder dialog. We must
      // NOT clear the active chat before the dialog closes — doing so
      // would flash the EmptyComposer behind the open picker, even
      // when the user is just browsing and plans to cancel.
      const result = await openProjectFolder();
      if (result) {
        dispatch({ type: "SET_NEW_AGENT_FOLDER", folder: null });
        clearActiveChatBeforeSwap();
      }
    } catch (err) {
      console.warn("[Zeros] open folder failed:", err);
    }
  };

  // Phase 3-F — clone modal state lives at this level so the button in
  // the workspace dropdown can open it while the menu closes normally.
  const [showClone, setShowClone] = useState(false);

  const handleOpenClone = () => {
    workspaceMenu.setOpen(false);
    setShowClone(true);
  };

  return (
    <aside
      className={`oc-column-1 ${collapsed ? "is-collapsed" : ""}`}
      aria-label="Navigation"
      data-collapsed={collapsed}
    >
      <div className="oc-column-1__header" data-tauri-drag-region>
        <div className="oc-column-1__brand" data-tauri-drag-region>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {!collapsed && <span className="oc-column-1__brand-name">Zeros</span>}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="oc-column-1__collapse"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </Button>
      </div>

      {/* Workspace Manager sits at the top — switching the project
          context is the primary navigation action, so it's the first
          control the user sees. The button label is always "Open
          Workspace" (matches Cursor), and the dropdown contains the
          recents list + Open Folder + Clone from URL so the user can
          identify which project they're currently in from the
          dropdown's is-current highlight, not from the button itself. */}
      <div className="oc-column-1__workspace" ref={workspaceMenu.rootRef}>
        <Button
          variant="ghost"
          className={`oc-column-1__action oc-column-1__workspace-btn ${
            workspaceMenu.open ? "is-open" : ""
          }`}
          onClick={() => workspaceMenu.setOpen(!workspaceMenu.open)}
          title={
            collapsed
              ? "Open Workspace"
              : workspaceMenu.currentRoot || "Open a project folder"
          }
        >
          <FolderOpen size={16} />
          {!collapsed && (
            <>
              <span className="oc-column-1__workspace-name">Open Workspace</span>
              <ChevronDown size={12} className="oc-column-1__workspace-caret" />
            </>
          )}
        </Button>

        {workspaceMenu.open && (
          <div className={`oc-column-1__workspace-menu ${collapsed ? "is-collapsed" : ""}`}>
            {workspaceMenu.recents.length > 0 && (
              <div className="oc-column-1__workspace-search">
                <Search
                  size={12}
                  className="oc-column-1__workspace-search-icon"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  className="oc-column-1__workspace-search-input"
                  placeholder="Search projects…"
                  value={workspaceQuery}
                  onChange={(e) => setWorkspaceQuery(e.target.value)}
                  autoFocus
                  spellCheck={false}
                  aria-label="Search recent projects"
                />
              </div>
            )}
            {workspaceMenu.recents.length === 0 ? (
              <p className="oc-column-1__workspace-empty">No recent projects.</p>
            ) : filteredRecents.length === 0 ? (
              <p className="oc-column-1__workspace-empty">
                No projects match "{workspaceQuery.trim()}".
              </p>
            ) : (
              <ul className="oc-column-1__workspace-list">
                {filteredRecents.map((p) => (
                  <li key={p.path} className="oc-column-1__workspace-item">
                    <Button
                      variant="ghost"
                      className="oc-column-1__workspace-pick"
                      onClick={() => handlePickProject(p.path)}
                      title={p.path}
                    >
                      <Folder
                        size={12}
                        className="oc-column-1__workspace-item-icon"
                      />
                      <span className="oc-column-1__workspace-item-path">
                        {tildePath(p.path)}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="ghost"
              className="oc-column-1__workspace-open"
              onClick={handleOpenFolder}
            >
              <FolderPlus size={13} />
              <span>Open Folder…</span>
            </Button>
            <Button
              variant="ghost"
              className="oc-column-1__workspace-open"
              onClick={handleOpenClone}
            >
              <GitBranch size={13} />
              <span>Clone from URL…</span>
            </Button>
          </div>
        )}
      </div>

      <div className="oc-column-1__actions">
        <Button
          variant="ghost"
          className="oc-column-1__action"
          onClick={handleNewChat}
          title={collapsed ? "New Agent (⌘N)" : undefined}
        >
          <MessageSquarePlus size={16} />
          {!collapsed && (
            <>
              <span>New Agent</span>
              <kbd className="oc-column-1__kbd" aria-hidden="true">⌘N</kbd>
            </>
          )}
        </Button>
      </div>

      {!collapsed && (folderKeys.length > 0 || pinnedChats.length > 0) && (
        <section className="oc-column-1__section oc-column-1__chats">
          <div className="oc-column-1__folders">
            {pinnedChats.length > 0 && (() => {
              // Pinned renders as a regular workspace section (same
              // chevron, same spacing, no extra separator). Key is a
              // sentinel string so it doesn't collide with folder
              // paths; collapse/expand state is persisted under that
              // same key in the sections-collapsed map.
              const PINNED_KEY = "__pinned__";
              const isPinnedCollapsed =
                sectionsCollapsed[PINNED_KEY] === true;
              return (
                <div
                  key={PINNED_KEY}
                  className={`oc-column-1__project ${isPinnedCollapsed ? "is-collapsed" : ""}`}
                >
                  <div className="oc-column-1__project-header">
                    <span className="oc-column-1__project-name">
                      Pinned
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="oc-column-1__project-chevron"
                      onClick={() => toggleSectionCollapsed(PINNED_KEY)}
                      title={
                        isPinnedCollapsed
                          ? "Expand pinned"
                          : "Collapse pinned"
                      }
                      aria-expanded={!isPinnedCollapsed}
                    >
                      {isPinnedCollapsed ? (
                        <ChevronRight size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </Button>
                  </div>
                  {!isPinnedCollapsed && (
                    <div className="oc-column-1__chat-list">
                      {pinnedChats.map((chat) => (
                        <ChatRow
                          key={chat.id}
                          chat={chat}
                          isActive={state.activeChatId === chat.id}
                          onSelect={handleSelectChat}
                          onDelete={handleDeleteChat}
                          onTogglePin={handleTogglePin}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
            {folderKeys.map((folder) => {
              const isCurrent =
                folder !== "" && folder === workspaceMenu.currentRoot;
              // Default-collapsed for non-current workspaces so the
              // active project's chats dominate; the user can expand
              // any section and the choice persists.
              const isCollapsed =
                folder in sectionsCollapsed
                  ? sectionsCollapsed[folder]
                  : !isCurrent && folder !== "";
              return renderFolderSection({
                folder,
                chats: grouped.get(folder) ?? [],
                isShowingAll: projectsExpanded[folder] === true,
                isCollapsed,
                isCurrent,
                activeChatId: state.activeChatId,
                onSelectChat: handleSelectChat,
                onDeleteChat: handleDeleteChat,
                onTogglePin: handleTogglePin,
                onToggleShowAll: toggleProjectExpanded,
                onToggleSection: toggleSectionCollapsed,
                onOpenContextMenu: openWorkspaceContextMenu,
                onNewInFolder: handleNewChatInFolder,
              });
            })}
          </div>
        </section>
      )}

      <div className="oc-column-1__spacer" />

      {!collapsed && (
        <section className="oc-column-1__section oc-column-1__localhost">
          <Button
            variant="ghost"
            className="oc-column-1__section-header"
            onClick={toggleLocalhost}
            aria-expanded={!localhostCollapsed}
            title={localhostCollapsed ? "Expand localhost" : "Collapse localhost"}
          >
            {localhostCollapsed ? (
              <ChevronRight size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
            <span className="oc-column-1__section-title-text">LOCALHOST</span>
            <span className="oc-column-1__section-badge">{services.length}</span>
          </Button>
          {!localhostCollapsed && (
            services.length === 0 ? (
              <p className="oc-column-1__placeholder">
                No dev servers detected. Start your app's dev server
                (e.g. <code>pnpm dev</code>) and this list will update within a few seconds.
              </p>
            ) : (
              <div
                className="oc-column-1__services"
                style={{
                  maxHeight:
                    services.length > LOCALHOST_VISIBLE_ROWS
                      ? `calc(${LOCALHOST_VISIBLE_ROWS} * var(--h-control-lg))`
                      : undefined,
                  overflowY: services.length > LOCALHOST_VISIBLE_ROWS ? "auto" : undefined,
                }}
              >
                {services.map((s) => (
                  <ServiceRow
                    key={s.port}
                    service={s}
                    isActive={s.url === currentUrl}
                    onSelect={() => handleSelect(s)}
                  />
                ))}
              </div>
            )
          )}
        </section>
      )}

      <footer className="oc-column-1__footer" ref={profileMenu.rootRef}>
        {profileMenu.open && (
          <div className="oc-column-1__menu" role="menu">
            <Button
              variant="ghost"
              className="oc-column-1__menu-item"
              role="menuitem"
              onClick={handleOpenDocs}
            >
              <HelpCircle size={14} />
              <span>How to</span>
            </Button>
            <Button
              variant="ghost"
              className="oc-column-1__menu-item"
              role="menuitem"
              onClick={handleGoToSettings}
            >
              <SettingsIcon size={14} />
              <span>Settings</span>
            </Button>
            <Button
              variant="ghost"
              className="oc-column-1__menu-item is-danger"
              role="menuitem"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </Button>
          </div>
        )}
        <div className="oc-column-1__profile-row">
          <Button
            variant="ghost"
            className={`oc-column-1__profile ${profileMenu.open ? "is-open" : ""}`}
            onClick={() => profileMenu.setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={profileMenu.open}
            title={collapsed ? "Profile" : undefined}
          >
            <div className="oc-column-1__avatar">0</div>
            {!collapsed && <span>Profile</span>}
          </Button>
          <UpdatePill updater={updater} collapsed={collapsed} />
        </div>
      </footer>
      {showClone && <CloneModal onClose={() => setShowClone(false)} />}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="oc-column-1__context-menu"
          role="menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className="oc-column-1__context-menu-item is-danger"
            onClick={() => {
              hideWorkspace(contextMenu.folder);
              setContextMenu(null);
            }}
          >
            <Trash2 size={12} />
            <span>Remove from sidebar</span>
          </button>
        </div>
      )}
    </aside>
  );
}

// ── Chat row ──────────────────────────────────────────────
//
// Extracted as a component so useChatSession() can run per-row — the
// hook reads this chat's ACP session state (streaming / pendingPermission
// / failed) and maps it to a dot color class. Keeps the list virtualizable
// later: each row owns its own subscription and only re-renders when its
// own session state changes.

function ChatRow({
  chat,
  isActive,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  chat: ChatThread;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onTogglePin: (e: React.MouseEvent, id: string) => void;
}) {
  const session = useChatSession(chat.id);
  const status = chatDotStatus({
    status: session.status,
    pendingPermission: session.pendingPermission,
  });
  const pinned = chat.pinned === true;

  // Indicator slot rules (priority top-down):
  //   - streaming        → spinner (live work outranks everything)
  //   - pending permission → amber alert (user action required)
  //   - hovered + pinned → clickable PinOff button (unpin affordance)
  //   - hovered + unpinned → clickable Pin button (pin affordance)
  //   - rest             → subtle grey dot (Cursor-style neutral)
  //
  // The pin affordance lives in the dot's slot so pinned chats still
  // read as "just a chat" when the list is idle — the pin only surfaces
  // when the user is aiming at the row.
  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTogglePin(e, chat.id);
  };

  const renderIndicator = () => {
    if (status === "working") {
      return <Loader2 size={10} className="oc-column-1__chat-spinner" />;
    }
    if (status === "waiting") {
      return <AlertCircle size={10} className="oc-column-1__chat-alert" />;
    }
    return (
      <>
        <span className="oc-column-1__chat-dot" aria-hidden="true" />
        <button
          type="button"
          className="oc-column-1__chat-pin-toggle"
          onClick={handlePinClick}
          title={pinned ? "Unpin" : "Pin to top"}
          aria-label={pinned ? "Unpin chat" : "Pin chat"}
        >
          {pinned ? (
            <PinOff size={11} strokeWidth={2} />
          ) : (
            <Pin size={11} strokeWidth={2} />
          )}
        </button>
      </>
    );
  };

  return (
    <div
      className={`oc-column-1__chat is-${status} ${
        isActive ? "is-active" : ""
      } ${pinned ? "is-pinned" : ""}`}
      onClick={() => onSelect(chat.id)}
      title={chat.title}
    >
      <span className="oc-column-1__chat-indicator">
        {renderIndicator()}
      </span>
      <span className="oc-column-1__chat-title">{chat.title}</span>
      <span className="oc-column-1__chat-time" aria-hidden="true">
        {relativeTime(chat.updatedAt)}
      </span>
      <div
        className="oc-column-1__chat-actions"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="icon-sm"
          className="oc-column-1__chat-delete"
          onClick={(e) => onDelete(e, chat.id)}
          title="Delete chat"
          aria-label="Delete chat"
        >
          <Trash2 size={10} />
        </Button>
      </div>
    </div>
  );
}

// ── Auto-updater pill ─────────────────────────────────────
//
// Cursor-style affordance: invisible while no update is pending,
// becomes a small blue "Update" pill when one is available. Click
// starts the download; the pill shows progress then "Restart".
// Collapsed rail: renders as a small dot on the top-right of the
// profile avatar so the user still sees the signal.

function UpdatePill({
  updater,
  collapsed,
}: {
  updater: ReturnType<typeof useUpdater>;
  collapsed: boolean;
}) {
  const { status, install } = updater;

  if (status.kind === "idle" || status.kind === "checking") return null;

  if (collapsed) {
    const title =
      status.kind === "available"
        ? `Update ${status.version} available`
        : status.kind === "downloading"
          ? `Downloading update…`
          : status.kind === "ready"
            ? `Update ready — click to restart`
            : `Update error`;
    return (
      <Button
        variant="ghost"
        className={`oc-column-1__update-dot is-${status.kind}`}
        onClick={() => {
          if (status.kind === "available" || status.kind === "ready") {
            void install();
          }
        }}
        title={title}
        aria-label={title}
      />
    );
  }

  if (status.kind === "available") {
    return (
      <Button
        variant="primary"
        className="oc-column-1__update-pill"
        onClick={() => void install()}
        title={`Update to ${status.version}`}
      >
        Update
      </Button>
    );
  }

  if (status.kind === "downloading") {
    const pct =
      status.total && status.total > 0
        ? Math.min(100, Math.round((status.downloaded / status.total) * 100))
        : undefined;
    return (
      <Button
        variant="primary"
        className="oc-column-1__update-pill is-downloading"
        disabled
        title="Downloading update…"
      >
        {pct != null ? `${pct}%` : "…"}
      </Button>
    );
  }

  if (status.kind === "ready") {
    return (
      <Button
        variant="primary"
        className="oc-column-1__update-pill is-ready"
        onClick={() => void install()}
        title="Restart to apply update"
      >
        Restart
      </Button>
    );
  }

  // status.kind === "error"
  return (
    <Button
      variant="primary"
      className="oc-column-1__update-pill is-error"
      onClick={() => void updater.checkNow()}
      title={status.message}
    >
      Retry
    </Button>
  );
}

// ── Phase 3-F — clone modal ───────────────────────────────
//
// Minimal form: URL + destination folder. The destination must not
// already exist (libgit2 clones into an empty path). We default the
// folder name from the URL's last segment when the user pastes the
// URL first. On success we rememberProject() + openClonedProject()
// so the app swaps into the newly cloned repo immediately.

function defaultFolderNameFrom(url: string): string {
  const trimmed = url.trim().replace(/\.git$/i, "");
  const parts = trimmed.split(/[\\/:]/).filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function CloneModal({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [dest, setDest] = useState("");
  const [userEditedDest, setUserEditedDest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    if (userEditedDest) return;
    const name = defaultFolderNameFrom(url);
    setDest(name ? `/Users/${"{"}you${"}"}/Projects/${name}` : "");
  }, [url, userEditedDest]);

  const handleClone = async () => {
    setErr(null);
    const trimmedUrl = url.trim();
    const trimmedDest = dest.trim();
    if (!trimmedUrl) {
      setErr("Enter a git URL.");
      return;
    }
    if (!trimmedDest.startsWith("/")) {
      setErr("Destination must be an absolute path starting with /.");
      return;
    }
    setBusy(true);
    try {
      const cloned = await git.clone(trimmedUrl, trimmedDest);
      rememberProject(cloned);
      await openClonedProject(cloned);
      // openClonedProject emits project-changed → the shell reloads.
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="oc-clone-modal-backdrop" onClick={onClose}>
      <div className="oc-clone-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Clone a repository</h2>
        <label>
          Git URL
          <Input
            autoFocus
            placeholder="https://github.com/owner/repo.git"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Destination folder (absolute path)
          <Input
            placeholder="/Users/you/Projects/repo"
            value={dest}
            onChange={(e) => {
              setUserEditedDest(true);
              setDest(e.target.value);
            }}
            disabled={busy}
          />
        </label>
        {busy && (
          <p className="oc-clone-modal__progress">Cloning… this can take a while.</p>
        )}
        {err && <div className="oc-clone-modal__err">{err}</div>}
        <div className="oc-clone-modal__actions">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleClone}
            disabled={busy || !url.trim() || !dest.trim()}
          >
            {busy ? "Cloning…" : "Clone"}
          </Button>
        </div>
      </div>
    </div>
  );
}
