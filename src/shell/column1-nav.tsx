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
  Sparkles,
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
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import { Button, Input } from "../zeros/ui";
import { useWorkspace, type ChatThread } from "../zeros/store/store";
import { getDefaultAgentId } from "../zeros/panels/settings-page";
import { useBridge } from "../zeros/bridge/use-bridge";
import type {
  AcpAgentsListMessage,
  BridgeRegistryAgent,
} from "../zeros/bridge/messages";
import {
  discoverLocalhostServices,
  openProjectFolder,
  openProjectFolderPath,
  git,
  openClonedProject,
  type LocalhostService,
} from "../native/tauri-events";
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
const FOLDERS_COLLAPSED_KEY = "column-1-folders-collapsed";
const LOCALHOST_COLLAPSED_KEY = "column-1-localhost-collapsed";

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
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return "";
  }
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const root = await invoke<string | null>("get_engine_root");
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

  // Re-read the recent-projects list every time the menu opens so we
  // pick up the rememberProject() side-effect from ReloadOnProjectChange.
  useEffect(() => {
    if (!open) return;
    setRecents(loadRecentProjects());
    getCurrentProjectFolder().then(setCurrentRoot);
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
  const [foldersCollapsed, setFoldersCollapsed] = useState<Record<string, boolean>>(() =>
    getSetting<Record<string, boolean>>(FOLDERS_COLLAPSED_KEY, {}),
  );
  const [localhostCollapsed, setLocalhostCollapsed] = useState<boolean>(() =>
    getSetting<boolean>(LOCALHOST_COLLAPSED_KEY, false),
  );

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

  const toggleFolder = (folder: string) => {
    setFoldersCollapsed((prev) => {
      const next = { ...prev, [folder]: !prev[folder] };
      setSetting(FOLDERS_COLLAPSED_KEY, next);
      return next;
    });
  };

  const bridge = useBridge();

  const handleNewChat = useCallback(async () => {
    const folder = await getCurrentProjectFolder();

    // Resolve the default agent. User preference wins; otherwise pick
    // the first installed agent in the registry; otherwise leave it
    // unset and let the Chat tab prompt the user to pick one.
    let agentId = getDefaultAgentId();
    let agentName: string | null = null;
    if (bridge) {
      try {
        const resp = await bridge.request<AcpAgentsListMessage>(
          { type: "ACP_LIST_AGENTS" },
          10_000,
        );
        const found =
          (agentId && resp.agents.find((a) => a.id === agentId)) ||
          resp.agents.find((a) => a.installed) ||
          null;
        if (found) {
          agentId = found.id;
          agentName = found.name;
        }
      } catch {
        /* registry unreachable — chat is still usable; header will prompt */
      }
    }

    const chat: ChatThread = {
      id: newChatId(),
      folder,
      agentId,
      agentName,
      model: null,
      effort: "medium",
      permissionMode: "ask",
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: "ADD_CHAT", chat });
  }, [dispatch, bridge]);

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

  const grouped = React.useMemo(() => groupChatsByFolder(state.chats), [state.chats]);
  // Current-project folder first, "" (No project) second, others
  // alphabetical. Keeps the active project's chats prominent even
  // when the user has threads from many repos.
  const folderKeys = React.useMemo(() => {
    const keys = Array.from(grouped.keys());
    const currentRoot = workspaceMenu.currentRoot;
    return keys.sort((a, b) => {
      if (a === currentRoot && b !== currentRoot) return -1;
      if (b === currentRoot && a !== currentRoot) return 1;
      if (a === "" && b !== "") return -1;
      if (b === "" && a !== "") return 1;
      return a.localeCompare(b);
    });
  }, [grouped, workspaceMenu.currentRoot]);

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
  const handlePickProject = async (path: string) => {
    workspaceMenu.setOpen(false);
    try {
      await openProjectFolderPath(path);
      // ReloadOnProjectChange triggers a window.location.reload()
      // once Rust emits project-changed, so no state cleanup needed.
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
      await openProjectFolder();
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

  const handleForgetProject = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    forgetProject(path);
    workspaceMenu.refresh();
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

      <div className="oc-column-1__actions">
        <Button
          variant="ghost"
          className="oc-column-1__action"
          onClick={handleNewChat}
          title={collapsed ? "New Chat (⌘N)" : "⌘N"}
        >
          <MessageSquarePlus size={16} />
          {!collapsed && <span>New Chat</span>}
        </Button>
        <Button
          variant="ghost"
          className="oc-column-1__action"
          disabled
          title={collapsed ? "Skills (later phase)" : undefined}
        >
          <Sparkles size={16} />
          {!collapsed && <span>Skills</span>}
        </Button>
      </div>

      {/* Phase 2-D: Workspace Manager — current project + recents dropdown */}
      <div className="oc-column-1__workspace" ref={workspaceMenu.rootRef}>
        <Button
          variant="ghost"
          className={`oc-column-1__action oc-column-1__workspace-btn ${
            workspaceMenu.open ? "is-open" : ""
          }`}
          onClick={() => workspaceMenu.setOpen(!workspaceMenu.open)}
          title={collapsed ? "Workspace" : undefined}
        >
          <FolderOpen size={16} />
          {!collapsed && (
            <>
              <span className="oc-column-1__workspace-name">
                {folderBasename(workspaceMenu.currentRoot || state.project?.name || "")}
              </span>
              <ChevronDown size={12} className="oc-column-1__workspace-caret" />
            </>
          )}
        </Button>

        {workspaceMenu.open && (
          <div className={`oc-column-1__workspace-menu ${collapsed ? "is-collapsed" : ""}`}>
            {workspaceMenu.recents.length === 0 ? (
              <p className="oc-column-1__workspace-empty">No recent projects.</p>
            ) : (
              <ul className="oc-column-1__workspace-list">
                {workspaceMenu.recents.map((p) => {
                  const isCurrent = p.path === workspaceMenu.currentRoot;
                  return (
                    <li key={p.path} className="oc-column-1__workspace-item">
                      <Button
                        variant="ghost"
                        className={`oc-column-1__workspace-pick ${isCurrent ? "is-current" : ""}`}
                        onClick={() => !isCurrent && handlePickProject(p.path)}
                        disabled={isCurrent}
                        title={p.path}
                      >
                        <Folder size={14} className="oc-column-1__workspace-item-icon" />
                        <span className="oc-column-1__workspace-item-name">{p.name}</span>
                        <span className="oc-column-1__workspace-item-path">{p.path}</span>
                      </Button>
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="oc-column-1__workspace-forget"
                          onClick={(e) => handleForgetProject(e, p.path)}
                          title="Remove from recent"
                          aria-label="Remove from recent"
                        >
                          <X size={10} />
                        </Button>
                      )}
                    </li>
                  );
                })}
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

      {!collapsed && (
        <>
          <section className="oc-column-1__section oc-column-1__chats">
            <h3 className="oc-column-1__section-title">
              CHATS
              {state.chats.length > 0 && (
                <span className="oc-column-1__section-badge">{state.chats.length}</span>
              )}
            </h3>
            {state.chats.length === 0 ? (
              <p className="oc-column-1__placeholder">
                Click <strong>New Chat</strong> to start a conversation. Chats are grouped by project.
              </p>
            ) : (
              <div className="oc-column-1__folders">
                {folderKeys.map((folder) => {
                  const chats = grouped.get(folder) ?? [];
                  const isCollapsed = foldersCollapsed[folder] === true;
                  const isCurrent = folder !== "" && folder === workspaceMenu.currentRoot;
                  return (
                    <div
                      key={folder}
                      className={`oc-column-1__folder ${isCurrent ? "is-current" : ""}`}
                    >
                      <Button
                        variant="ghost"
                        className="oc-column-1__folder-header"
                        onClick={() => toggleFolder(folder)}
                        title={folder || "Not associated with a project"}
                      >
                        {isCollapsed ? (
                          <ChevronRight size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                        <Folder size={12} />
                        <span className="oc-column-1__folder-name">
                          {folderBasename(folder)}
                        </span>
                        <span className="oc-column-1__folder-count">{chats.length}</span>
                      </Button>
                      {!isCollapsed && (
                        <div className="oc-column-1__chat-list">
                          {chats.map((chat) => (
                            <div
                              key={chat.id}
                              className={`oc-column-1__chat ${
                                state.activeChatId === chat.id ? "is-active" : ""
                              }`}
                              onClick={() => handleSelectChat(chat.id)}
                              title={chat.title}
                            >
                              <MessageSquare size={12} />
                              <span className="oc-column-1__chat-title">{chat.title}</span>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="oc-column-1__chat-delete"
                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                title="Delete chat"
                                aria-label="Delete chat"
                              >
                                <Trash2 size={10} />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </>
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
                      ? `calc(${LOCALHOST_VISIBLE_ROWS} * 30px)`
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
    </aside>
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
