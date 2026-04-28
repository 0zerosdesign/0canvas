// ──────────────────────────────────────────────────────────
// Project-context chip — Phase 1 §2.9.5
// ──────────────────────────────────────────────────────────
//
// Sits in the chat header. Surfaces the project-context files
// the active agent is loading at this cwd — CLAUDE.md / AGENTS.md
// / GEMINI.md / .cursor/rules/* etc. — so the user can see
// "what does the agent know before I send my prompt?"
//
// Click expands a popover listing each file with size, mtime,
// short preview, and an Open-in-editor action. Read-only.
//
// File resolution lives main-side (electron/ipc/commands/agent-
// context.ts) — walking cwd → parents → home is filesystem-
// shaped work that has no business in the renderer.
// ──────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileText, FolderOpen } from "lucide-react";

import {
  loadAgentContextFiles,
  type AgentContextFile,
  type AgentContextResult,
} from "../../native/native";

interface Props {
  agentId: string | null | undefined;
  cwd: string | null | undefined;
}

export function ProjectContextChip({ agentId, cwd }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AgentContextResult | null>(null);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Re-fetch on agent / cwd change. The fetch is debounced via the
  // single-pending guard below; rapid switching between chats
  // doesn't fire a stale callback.
  useEffect(() => {
    let cancelled = false;
    if (!agentId || !cwd) {
      setData(null);
      return;
    }
    setLoading(true);
    loadAgentContextFiles({ agentId, cwd })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, cwd]);

  // Close on outside click + Escape (fix #5 — keyboard-only users
  // were trapped because the only dismissal was a mouse-anywhere-else
  // gesture).
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const node = popoverRef.current;
      if (!node) return;
      if (!node.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const files = data?.files ?? [];
  const count = files.length;

  // No agent / no cwd / nothing found → render nothing. The chip is
  // a discovery affordance; an empty chip would just be confusing
  // chrome.
  if (!agentId || !cwd) return null;
  if (!loading && count === 0) return null;

  const label = loading ? "…" : `${count} context file${count === 1 ? "" : "s"}`;

  return (
    <div className="oc-agent-context-chip-wrap" ref={popoverRef}>
      <button
        type="button"
        className="oc-agent-context-chip"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title="Project context files the agent is loading at this cwd"
      >
        <FileText className="w-3 h-3" />
        <span>{label}</span>
        <ChevronDown className="w-3 h-3 oc-agent-context-chip-caret" />
      </button>
      {open && count > 0 && (
        <div className="oc-agent-context-popover" role="dialog">
          <div className="oc-agent-context-popover-head">
            Files {agentId} loads at this cwd
          </div>
          <div className="oc-agent-context-popover-body">
            {files.map((f) => (
              <ContextFileRow key={f.path} file={f} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ContextFileRow({ file }: { file: AgentContextFile }) {
  const sizeLabel = useMemo(() => formatSize(file.size), [file.size]);
  const scopeLabel = useMemo(() => {
    if (file.scope === "user") return "global";
    if (file.scope === "parent") return "parent";
    return "project";
  }, [file.scope]);

  const onOpen = () => {
    // The renderer has no direct "open in editor" affordance; we
    // copy the path to the clipboard so the user can paste it into
    // their editor of choice. A future revision can wire this to
    // `shell.openPath(file.path)` once the IPC surface for that
    // exists.
    void navigator.clipboard?.writeText(file.path);
  };

  return (
    <div className="oc-agent-context-file">
      <div className="oc-agent-context-file-head">
        <span className="oc-agent-context-file-name">{file.filename}</span>
        <span className="oc-agent-context-file-scope">{scopeLabel}</span>
        <span className="oc-agent-context-file-size">{sizeLabel}</span>
        <button
          type="button"
          className="oc-agent-context-file-open"
          title={`Copy path: ${file.path}`}
          onClick={onOpen}
        >
          <FolderOpen className="w-3 h-3" />
        </button>
      </div>
      <div className="oc-agent-context-file-path" title={file.path}>
        {file.path}
      </div>
      {file.preview && (
        <div className="oc-agent-context-file-preview">{file.preview}</div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
