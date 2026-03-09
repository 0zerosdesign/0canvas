import React, { useState, useRef, useEffect } from "react";
import type { DDProjectMeta, DDWorkspaceMeta } from "../../shared/types";
import type { DDPatch } from "../../shared/protocol";
import { postMessage } from "../vscode";

interface Props {
  project: DDProjectMeta;
  workspace: DDWorkspaceMeta;
  onPatch: (patch: DDPatch) => void;
}

export function ProjectHeader({ project, workspace, onPatch }: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(project.name);
  }, [project.name]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commitName = () => {
    setEditing(false);
    const trimmed = name.trim();
    if (trimmed && trimmed !== project.name) {
      onPatch({ op: "setProjectName", value: trimmed });
    } else {
      setName(project.name);
    }
  };

  const frameworkBadge = workspace.framework !== "unknown" ? workspace.framework : null;

  return (
    <header className="dd-header">
      <div className="dd-header-left">
        <svg className="dd-logo" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        {editing ? (
          <input
            ref={inputRef}
            className="dd-header-name-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") { setName(project.name); setEditing(false); }
            }}
          />
        ) : (
          <h1 className="dd-header-name" onDoubleClick={() => setEditing(true)} title="Double-click to rename">
            {project.name}
          </h1>
        )}
        {frameworkBadge && <span className="dd-badge dd-badge-framework">{frameworkBadge}</span>}
        <span className="dd-badge dd-badge-rev">rev {project.revision}</span>
      </div>

      <div className="dd-header-right">
        <span className="dd-meta">
          Updated {new Date(project.updatedAt).toLocaleString()}
        </span>
        <button
          className="dd-btn dd-btn-ghost"
          onClick={() => postMessage({ type: "openAsText" })}
          title="Open as raw JSON"
        >
          {"{ }"}
        </button>
      </div>
    </header>
  );
}
