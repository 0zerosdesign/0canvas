import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Layers,
  Palette,
  Zap,
  MousePointer2,
  Command,
  Monitor,
  Tablet,
  Smartphone,
  FileCode,
  PenTool,
  Wifi,
  ListChecks,
  Globe,
  ChevronDown,
  Save,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { useWorkspace, DDProject } from "../store";
import { saveProject, getAllProjects, deleteProject as dbDeleteProject, type StoredProject } from "./variant-db";

const FONT = "'Geist Sans','Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
const MONO = "'Geist Mono','SF Mono','Fira Code',monospace";
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#1a1a1a",
  border: "#1e1e1e",
  borderLight: "#2a2a2a",
  fg: "#ededed",
  fgMuted: "#888888",
  fgDim: "#666666",
  accent: "#0070f3",
  green: "#50e3c2",
  orange: "#f5a623",
  purple: "#7928ca",
  pink: "#ff0080",
  red: "#ff4444",
};

interface WorkspaceToolbarProps {
  onNavigate?: (route: string) => void;
}

export function WorkspaceToolbar({ onNavigate }: WorkspaceToolbarProps = {}) {
  const { state, dispatch } = useWorkspace();

  const connectedIDEs = state.ides.filter((i) => i.status === "connected").length;
  const annotationCount = state.annotations.length;
  const pendingFeedback = state.feedbackItems.filter((f) => f.status === "pending").length;

  const handleSaveProject = useCallback(async () => {
    dispatch({ type: "SAVE_DD_PROJECT" });
    const storedProject: StoredProject = {
      ...state.ddProject,
      saved: true,
      updatedAt: Date.now(),
      variants: state.variants,
      feedbackItems: state.feedbackItems,
    };
    await saveProject(storedProject).catch(console.warn);
  }, [state.ddProject, state.variants, state.feedbackItems, dispatch]);

  const handleLoadProject = useCallback(async (project: StoredProject) => {
    dispatch({
      type: "LOAD_DD_PROJECT",
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        appUrl: project.appUrl,
        saved: project.saved,
      },
      variants: project.variants,
      feedbackItems: project.feedbackItems,
    });
  }, [dispatch]);

  return (
    <div
      style={{
        height: 48,
        borderBottom: `1px solid ${C.border}`,
        background: C.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontFamily: FONT,
        fontSize: 13,
        color: C.fg,
        flexShrink: 0,
      }}
    >
      {/* Left: Logo + Project */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: C.fg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.bg} strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: "-0.01em" }}>designdead</span>
        </div>

        <div style={{ width: 1, height: 20, background: C.border }} />

        <ProjectSwitcher
          currentProject={state.ddProject}
          onRename={(name) => dispatch({ type: "SET_DD_PROJECT_NAME", name })}
          onSave={handleSaveProject}
          onLoad={handleLoadProject}
        />

        {state.wsStatus === "connected" && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              color: C.green,
              background: "rgba(80,227,194,0.1)",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            <Wifi size={12} />
            MCP
          </span>
        )}

        <RouteSwitcher
          currentRoute={state.currentRoute}
          routeHistory={state.routeHistory}
          onNavigate={(route) => {
            dispatch({ type: "SET_CURRENT_ROUTE", route });
            dispatch({ type: "ADD_ROUTE_HISTORY", route });
            onNavigate?.(route);
          }}
        />
      </div>

      {/* Center: Panel toggles */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: C.surface,
          borderRadius: 8,
          padding: 3,
          border: `1px solid ${C.border}`,
        }}
      >
        <ToolbarBtn
          icon={<Layers size={14} />}
          label="Layers"
          active={state.layersPanelOpen}
          onClick={() => dispatch({ type: "TOGGLE_LAYERS_PANEL" })}
        />
        <ToolbarBtn
          icon={<MousePointer2 size={14} />}
          label="Inspect"
          active={state.inspectorMode}
          activeColor={C.accent}
          onClick={() => dispatch({ type: "TOGGLE_INSPECTOR" })}
        />
        <ToolbarBtn
          icon={<Palette size={14} />}
          label="Style"
          active={state.stylePanelOpen}
          onClick={() => dispatch({ type: "TOGGLE_STYLE_PANEL" })}
        />
        <ToolbarBtn
          icon={<FileCode size={14} />}
          label="Files"
          active={state.fileMapPanelOpen}
          activeColor={C.accent}
          onClick={() => dispatch({ type: "TOGGLE_FILE_MAP_PANEL" })}
        />
        <ToolbarBtn
          icon={<PenTool size={14} />}
          label="Annotate"
          active={state.annotationMode}
          activeColor={C.pink}
          badge={annotationCount > 0 ? annotationCount : undefined}
          badgeColor={C.pink}
          onClick={() => dispatch({ type: "TOGGLE_ANNOTATION_MODE" })}
        />
        <ToolbarBtn
          icon={<Zap size={14} />}
          label="IDE"
          active={state.idePanelOpen}
          activeColor={C.orange}
          dot={connectedIDEs > 0 ? C.green : undefined}
          onClick={() => dispatch({ type: "TOGGLE_IDE_PANEL" })}
        />
        <ToolbarBtn
          icon={<ListChecks size={14} />}
          label="Waitlist"
          active={state.waitlistOpen}
          activeColor={C.green}
          badge={pendingFeedback > 0 ? pendingFeedback : undefined}
          badgeColor={C.green}
          onClick={() => dispatch({ type: "SET_WAITLIST_OPEN", open: !state.waitlistOpen })}
        />
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: C.surface,
            borderRadius: 6,
            padding: 3,
            border: `1px solid ${C.border}`,
          }}
        >
          <ViewportBtn icon={<Monitor size={14} />} active />
          <ViewportBtn icon={<Tablet size={14} />} />
          <ViewportBtn icon={<Smartphone size={14} />} />
        </div>

        <div style={{ width: 1, height: 20, background: C.border }} />

        <CmdKButton onClick={() => dispatch({ type: "TOGGLE_COMMAND_PALETTE" })} />
      </div>
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  active,
  activeColor,
  badge,
  badgeColor,
  dot,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeColor?: string;
  badge?: number;
  badgeColor?: string;
  dot?: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = active ? (activeColor || C.fg) : hovered ? C.fg : C.fgMuted;
  const bg = active ? (activeColor ? `${activeColor}15` : C.surfaceHover) : hovered ? "rgba(255,255,255,0.04)" : "transparent";

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 10px",
        borderRadius: 6,
        fontSize: 12,
        fontFamily: FONT,
        fontWeight: 450,
        color,
        background: bg,
        border: "none",
        cursor: "pointer",
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
      {badge != null && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            background: badgeColor ? `${badgeColor}25` : "rgba(255,255,255,0.1)",
            color: badgeColor || C.fg,
            padding: "1px 5px",
            borderRadius: 4,
            lineHeight: "14px",
          }}
        >
          {badge}
        </span>
      )}
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: dot }} />
      )}
    </button>
  );
}

function ViewportBtn({ icon, active }: { icon: React.ReactNode; active?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 5,
        borderRadius: 5,
        background: active ? C.surfaceHover : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        color: active ? C.fg : C.fgMuted,
        border: "none",
        cursor: "pointer",
        transition: "all 0.15s ease",
      }}
    >
      {icon}
    </button>
  );
}

function CmdKButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${hovered ? C.borderLight : C.border}`,
        background: "transparent",
        cursor: "pointer",
        color: C.fgMuted,
        fontFamily: FONT,
        fontSize: 12,
        transition: "all 0.15s ease",
      }}
    >
      <Command size={12} />
      <span style={{ fontSize: 11, fontWeight: 500 }}>K</span>
    </button>
  );
}

function RouteSwitcher({
  currentRoute,
  routeHistory,
  onNavigate,
}: {
  currentRoute: string;
  routeHistory: string[];
  onNavigate: (route: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [customRoute, setCustomRoute] = useState("");
  const [hovered, setHovered] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleGo = () => {
    const route = customRoute.trim();
    if (!route) return;
    onNavigate(route.startsWith("/") ? route : `/${route}`);
    setCustomRoute("");
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 12,
          fontFamily: FONT,
          background: C.surface,
          border: `1px solid ${hovered ? C.borderLight : C.border}`,
          color: C.fgMuted,
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <Globe size={12} />
        <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {currentRoute}
        </span>
        <ChevronDown size={10} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <div
          data-designdead="route-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            width: 240,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            zIndex: 100,
            overflow: "hidden",
            fontFamily: FONT,
          }}
        >
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={customRoute}
                onChange={(e) => setCustomRoute(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGo()}
                placeholder="/path..."
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.fg,
                  fontSize: 12,
                  fontFamily: MONO,
                  outline: "none",
                }}
              />
              <button
                onClick={handleGo}
                style={{
                  padding: "6px 14px",
                  background: C.accent,
                  border: "none",
                  borderRadius: 6,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                Go
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 180, overflowY: "auto" }}>
            {routeHistory.map((route) => (
              <RouteItem
                key={route}
                route={route}
                active={route === currentRoute}
                onClick={() => {
                  onNavigate(route);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RouteItem({ route, active, onClick }: { route: string; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        width: "100%",
        padding: "8px 14px",
        background: active ? `${C.accent}12` : hovered ? "rgba(255,255,255,0.03)" : "transparent",
        border: "none",
        borderLeft: `2px solid ${active ? C.accent : "transparent"}`,
        color: active ? C.accent : hovered ? C.fg : C.fgMuted,
        fontSize: 12,
        textAlign: "left",
        cursor: "pointer",
        fontFamily: MONO,
        transition: "all 0.1s ease",
      }}
    >
      {route}
    </button>
  );
}

function ProjectSwitcher({
  currentProject,
  onRename,
  onSave,
  onLoad,
}: {
  currentProject: DDProject;
  onRename: (name: string) => void;
  onSave: () => void;
  onLoad: (project: StoredProject) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentProject.name);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setName(currentProject.name);
  }, [currentProject.name]);

  useEffect(() => {
    if (!open) return;
    getAllProjects().then(setProjects).catch(() => {});
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleRename = () => {
    if (name.trim()) onRename(name.trim());
    setEditing(false);
  };

  const handleDelete = async (id: string) => {
    await dbDeleteProject(id).catch(console.warn);
    setProjects((p) => p.filter((proj) => proj.id !== id));
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          borderRadius: 6,
          background: C.surface,
          border: `1px solid ${C.border}`,
          cursor: "pointer",
        }}
        onClick={() => setOpen((o) => !o)}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: currentProject.saved ? C.green : "#f5a623",
          }}
        />
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            style={{
              width: 100,
              padding: "1px 4px",
              background: "#111",
              border: "1px solid #333",
              borderRadius: 3,
              color: C.fg,
              fontSize: 12,
              fontFamily: FONT,
              outline: "none",
            }}
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.fg }}
            title="Double-click to rename"
          >
            {currentProject.name}
          </span>
        )}
        {!currentProject.saved && (
          <span style={{ fontSize: 9, color: "#f5a623", fontStyle: "italic" }}>unsaved</span>
        )}
        <ChevronDown size={10} style={{ opacity: 0.5, color: C.fgMuted }} />
      </div>

      {open && (
        <div
          data-designdead="project-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            width: 260,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
            zIndex: 100,
            overflow: "hidden",
            fontFamily: FONT,
          }}
        >
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", gap: 6 }}>
            <button
              onClick={(e) => { e.stopPropagation(); onSave(); setOpen(false); }}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                padding: "6px 0",
                background: C.accent,
                border: "none",
                borderRadius: 6,
                color: "#fff",
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              <Save size={12} />
              Save Project
            </button>
          </div>

          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {projects.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: C.fgDim, fontSize: 11 }}>
                No saved projects
              </div>
            ) : (
              projects.map((proj) => (
                <ProjectItem
                  key={proj.id}
                  project={proj}
                  active={proj.id === currentProject.id}
                  onLoad={() => { onLoad(proj); setOpen(false); }}
                  onDelete={() => handleDelete(proj.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectItem({
  project,
  active,
  onLoad,
  onDelete,
}: {
  project: StoredProject;
  active: boolean;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 14px",
        background: active ? `${C.accent}12` : hovered ? "rgba(255,255,255,0.03)" : "transparent",
        borderLeft: `2px solid ${active ? C.accent : "transparent"}`,
        cursor: "pointer",
        transition: "all 0.1s ease",
      }}
      onClick={onLoad}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: active ? C.accent : C.fg, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project.name}
        </div>
        <div style={{ fontSize: 9, color: C.fgDim, marginTop: 2 }}>
          {project.variants.length} variants · {project.feedbackItems.length} feedback
        </div>
      </div>
      {hovered && !active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: C.red }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
}
