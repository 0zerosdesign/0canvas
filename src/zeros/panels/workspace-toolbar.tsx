import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Palette,
  Droplets,
  MessageCircle,
  PenTool,
  ChevronDown,
  Save,
  Trash2,
  Download,
  Upload,
} from "lucide-react";
import { useWorkspace, OCProject } from "../store/store";
import {
  saveProject,
  getAllProjects,
  deleteProject as dbDeleteProject,
  type StoredProject,
  downloadProjectFile,
  importProjectFile,
  buildCurrentProjectFile,
} from "../../native/storage";
import { projectFileToState } from "../format/oc-project";
import { Button, Input } from "../ui";

interface WorkspaceToolbarProps {
  onNavigate?: (route: string) => void;
}

export function WorkspaceToolbar({ onNavigate }: WorkspaceToolbarProps = {}) {
  const { state, dispatch } = useWorkspace();

  const handleSaveProject = useCallback(async () => {
    dispatch({ type: "SAVE_OC_PROJECT" });
    const storedProject: StoredProject = {
      ...state.ocProject,
      saved: true,
      updatedAt: Date.now(),
      variants: state.variants,
      feedbackItems: state.feedbackItems,
    };
    await saveProject(storedProject).catch(console.warn);
  }, [state.ocProject, state.variants, state.feedbackItems, dispatch]);

  const handleLoadProject = useCallback(async (project: StoredProject) => {
    dispatch({
      type: "LOAD_OC_PROJECT",
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

  const handleExportDD = useCallback(async () => {
    try {
      const file = await buildCurrentProjectFile(
        state.ocProject,
        state.variants,
        state.feedbackItems,
        state.currentRoute,
      );
      downloadProjectFile(file);
    } catch (err) {
      console.warn("[DD] Export failed:", err);
    }
  }, [state.ocProject, state.variants, state.feedbackItems, state.currentRoute]);

  const handleImportDD = useCallback(async () => {
    const file = await importProjectFile();
    if (file) {
      const { project, variants, feedbackItems } = projectFileToState(file);
      dispatch({ type: "LOAD_FROM_OC_FILE", file, project, variants, feedbackItems });
    }
  }, [dispatch]);

  return (
    <div className="oc-toolbar" data-tauri-drag-region>
      {/* Left: Logo + Project */}
      <div className="oc-toolbar-section" data-tauri-drag-region>
        <div className="oc-toolbar-logo">
          <div className="oc-toolbar-logo-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--surface-0)" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="oc-toolbar-logo-text">Zeros</span>
        </div>

        <div className="oc-toolbar-divider" />

        <ProjectSwitcher
          currentProject={state.ocProject}
          onRename={(name) => dispatch({ type: "SET_OC_PROJECT_NAME", name })}
          onSave={handleSaveProject}
          onLoad={handleLoadProject}
        />

      </div>

      {/* Center: Mode toggles (mutually exclusive) */}
      <div className="oc-toolbar-group is-pill">
        <ToolbarBtn
          icon={<MessageCircle size={14} />}
          label="Feedback"
          active={!state.themeMode && state.designMode === "feedback"}
          badge={state.feedbackItems.filter(f => f.status === "pending").length || undefined}
          onClick={() => { if (state.themeMode) dispatch({ type: "TOGGLE_THEME_MODE" }); dispatch({ type: "SET_DESIGN_MODE", mode: "feedback" }); }}
        />
        <ToolbarBtn
          icon={<PenTool size={14} />}
          label="Style"
          active={!state.themeMode && state.designMode === "style"}
          onClick={() => { if (state.themeMode) dispatch({ type: "TOGGLE_THEME_MODE" }); dispatch({ type: "SET_DESIGN_MODE", mode: "style" }); }}
        />
        <ToolbarBtn
          icon={<Droplets size={14} />}
          label="Theme"
          active={state.themeMode}
          badge={state.themeChanges.length || undefined}
          onClick={() => dispatch({ type: "TOGGLE_THEME_MODE" })}
        />
      </div>

      {/* Right: Actions */}
      <div className="oc-toolbar-section-actions">
        {/* .0c file actions */}
        <div className="oc-toolbar-group is-pill-sm">
          <ToolbarBtn
            icon={<Download size={14} />}
            label=".0c"
            active={false}
            onClick={handleExportDD}
          />
          <ToolbarBtn
            icon={<Upload size={14} />}
            label="Import"
            active={false}
            onClick={handleImportDD}
          />
        </div>
      </div>
    </div>
  );
}

function ToolbarBtn({
  icon,
  label,
  active,
  badge,
  dot,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: number;
  dot?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={`oc-toolbar-btn ${active ? "is-active" : ""}`}
    >
      {icon}
      {label}
      {badge != null && (
        <span className="oc-toolbar-badge">{badge}</span>
      )}
      {dot && <span className="oc-toolbar-conn-dot" />}
    </Button>
  );
}


function ProjectSwitcher({
  currentProject,
  onRename,
  onSave,
  onLoad,
}: {
  currentProject: OCProject;
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
    <div ref={dropdownRef} className="relative">
      <div
        className="oc-toolbar-project-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span
          className={`oc-toolbar-project-dot ${currentProject.saved ? "is-saved" : "is-unsaved"}`}
        />
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); e.stopPropagation(); }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="oc-toolbar-project-input"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className="oc-toolbar-project-name"
            title="Double-click to rename"
          >
            {currentProject.name}
          </span>
        )}
        {!currentProject.saved && (
          <span className="oc-toolbar-project-unsaved">unsaved</span>
        )}
        <ChevronDown size={10} style={{ opacity: 0.5, color: "var(--text-muted)" }} />
      </div>

      {open && (
        <div data-Zeros="project-dropdown" className="oc-toolbar-dropdown" style={{ width: 260 }}>
          <div className="oc-toolbar-dropdown-inputrow">
            <Button
              variant="primary"
              size="sm"
              onClick={(e) => { e.stopPropagation(); onSave(); setOpen(false); }}
              className="oc-toolbar-project-save-btn"
            >
              <Save size={12} />
              Save Project
            </Button>
          </div>

          <div className="oc-toolbar-dropdown-list is-tall">
            {projects.length === 0 ? (
              <div className="oc-toolbar-dropdown-empty">
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
  return (
    <div
      className={`oc-toolbar-project-item ${active ? "is-active" : ""}`}
      onClick={onLoad}
    >
      <div className="flex-1 min-h-0">
        <div className="oc-toolbar-project-item-name">
          {project.name}
        </div>
        <div className="oc-toolbar-project-item-meta">
          {project.variants.length} variants · {project.feedbackItems.length} feedback
        </div>
      </div>
      {!active && (
        <Button
          variant="destructive"
          size="icon-sm"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="oc-toolbar-project-delete"
        >
          <Trash2 size={12} />
        </Button>
      )}
    </div>
  );
}
