// ============================================================
// TitleBar — macOS traffic-light row + window title.
//
// Cursor 3 / Agents Window chrome. Height = --titlebar-h (36px).
// Drag region covers the whole bar except interactive children.
// Center: project name + branch chip. Right: ⌘K hint.
//
// NEVER add functional controls here other than the command
// palette shortcut.
// ============================================================
import React from "react";
import { GitBranch, Command } from "lucide-react";
import { useWorkspace } from "../zeros/store/store";
import { Kbd } from "../zeros/ui";

export function TitleBar() {
  const { state } = useWorkspace();
  const project = (state as any).project ?? null;
  const projectName =
    project?.name || project?.root?.split(/[/\\]/).pop() || "Zeros";
  const branch = (project?.git as any)?.branch || "";

  return (
    <header className="oc-titlebar" data-tauri-drag-region>
      <span className="oc-titlebar__lights" aria-hidden="true" />
      <div className="oc-titlebar__center" data-tauri-drag-region>
        <span className="oc-titlebar__project">{projectName}</span>
        {branch ? (
          <span className="oc-titlebar__branch">
            <GitBranch size={12} />
            {branch}
          </span>
        ) : null}
      </div>
      <div className="oc-titlebar__right">
        <span className="oc-titlebar__hint" aria-hidden="true">
          <Command size={12} />
          <Kbd>K</Kbd>
        </span>
      </div>
    </header>
  );
}
