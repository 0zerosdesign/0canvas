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
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";
import { useWorkspace, type ChatThread } from "../0canvas/store/store";
import {
  discoverLocalhostServices,
  openProjectFolder,
  openProjectFolderPath,
  type LocalhostService,
} from "../native/tauri-events";
import { getSetting, setSetting } from "../native/settings";
import {
  loadRecentProjects,
  forgetProject,
  type RecentProject,
} from "../native/recent-projects";

const DOCS_URL = "https://github.com/zerosdesign/0canvas#readme";
const COLLAPSE_KEY = "column-1-collapsed";
const FOLDERS_COLLAPSED_KEY = "column-1-folders-collapsed";

const POLL_INTERVAL_MS = 5000;

/** URL that represents 0canvas itself — never a valid preview target. */
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
        // disabled — clicking it would nest 0canvas inside 0canvas.
        const marked = raw.map((s) =>
          s.url === self && s.kind === "dev-server"
            ? { ...s, kind: "engine" as const, label: "0canvas (self)" }
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
    <button
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
    </button>
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
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    getSetting<boolean>(COLLAPSE_KEY, false),
  );
  const [foldersCollapsed, setFoldersCollapsed] = useState<Record<string, boolean>>(() =>
    getSetting<Record<string, boolean>>(FOLDERS_COLLAPSED_KEY, {}),
  );

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

  const handleNewChat = useCallback(async () => {
    const folder = await getCurrentProjectFolder();
    const chat: ChatThread = {
      id: newChatId(),
      folder,
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: "ADD_CHAT", chat });
  }, [dispatch]);

  const handleSelectChat = (id: string) => {
    dispatch({ type: "SET_ACTIVE_CHAT", id });
  };

  const handleDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    dispatch({ type: "DELETE_CHAT", id });
  };

  const grouped = React.useMemo(() => groupChatsByFolder(state.chats), [state.chats]);
  const folderKeys = React.useMemo(
    () => Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b)),
    [grouped],
  );

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
      console.warn("[0canvas] could not open project:", err);
      forgetProject(path);
      workspaceMenu.refresh();
    }
  };

  const handleOpenFolder = async () => {
    workspaceMenu.setOpen(false);
    try {
      await openProjectFolder();
    } catch (err) {
      console.warn("[0canvas] open folder failed:", err);
    }
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
      <div className="oc-column-1__header">
        <div className="oc-column-1__brand">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {!collapsed && <span className="oc-column-1__brand-name">0canvas</span>}
        </div>
        <button
          className="oc-column-1__collapse"
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="oc-column-1__actions">
        <button
          className="oc-column-1__action"
          onClick={handleNewChat}
          title={collapsed ? "New Chat" : undefined}
        >
          <MessageSquarePlus size={16} />
          {!collapsed && <span>New Chat</span>}
        </button>
        <button
          className="oc-column-1__action"
          disabled
          title={collapsed ? "Skills (later phase)" : undefined}
        >
          <Sparkles size={16} />
          {!collapsed && <span>Skills</span>}
        </button>
      </div>

      {/* Phase 2-D: Workspace Manager — current project + recents dropdown */}
      <div className="oc-column-1__workspace" ref={workspaceMenu.rootRef}>
        <button
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
        </button>

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
                      <button
                        className={`oc-column-1__workspace-pick ${isCurrent ? "is-current" : ""}`}
                        onClick={() => !isCurrent && handlePickProject(p.path)}
                        disabled={isCurrent}
                        title={p.path}
                      >
                        <Folder size={14} className="oc-column-1__workspace-item-icon" />
                        <span className="oc-column-1__workspace-item-name">{p.name}</span>
                        <span className="oc-column-1__workspace-item-path">{p.path}</span>
                      </button>
                      {!isCurrent && (
                        <button
                          className="oc-column-1__workspace-forget"
                          onClick={(e) => handleForgetProject(e, p.path)}
                          title="Remove from recent"
                          aria-label="Remove from recent"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <button
              className="oc-column-1__workspace-open"
              onClick={handleOpenFolder}
            >
              <FolderPlus size={13} />
              <span>Open Folder…</span>
            </button>
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
                  return (
                    <div key={folder} className="oc-column-1__folder">
                      <button
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
                      </button>
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
                              <button
                                className="oc-column-1__chat-delete"
                                onClick={(e) => handleDeleteChat(e, chat.id)}
                                title="Delete chat"
                                aria-label="Delete chat"
                              >
                                <Trash2 size={10} />
                              </button>
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

          <section className="oc-column-1__section">
            <h3 className="oc-column-1__section-title">
              LOCALHOST
              <span className="oc-column-1__section-badge">{services.length}</span>
            </h3>
            {services.length === 0 ? (
              <p className="oc-column-1__placeholder">
                No dev servers detected. Start your app's dev server (e.g. <code>pnpm dev</code>)
                and this list will update within a few seconds.
              </p>
            ) : (
              <div className="oc-column-1__services">
                {services.map((s) => (
                  <ServiceRow
                    key={s.port}
                    service={s}
                    isActive={s.url === currentUrl}
                    onSelect={() => handleSelect(s)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <div className="oc-column-1__spacer" />

      <footer className="oc-column-1__footer" ref={profileMenu.rootRef}>
        {profileMenu.open && (
          <div className="oc-column-1__menu" role="menu">
            <button
              className="oc-column-1__menu-item"
              role="menuitem"
              onClick={handleOpenDocs}
            >
              <HelpCircle size={14} />
              <span>How to</span>
            </button>
            <button
              className="oc-column-1__menu-item"
              role="menuitem"
              onClick={handleGoToSettings}
            >
              <SettingsIcon size={14} />
              <span>Settings</span>
            </button>
            <button
              className="oc-column-1__menu-item is-danger"
              role="menuitem"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        )}
        <button
          className={`oc-column-1__profile ${profileMenu.open ? "is-open" : ""}`}
          onClick={() => profileMenu.setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={profileMenu.open}
          title={collapsed ? "Profile" : undefined}
        >
          <div className="oc-column-1__avatar">0</div>
          {!collapsed && <span>Profile</span>}
        </button>
      </footer>
    </aside>
  );
}
