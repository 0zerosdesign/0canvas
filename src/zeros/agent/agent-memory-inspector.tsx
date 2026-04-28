// ──────────────────────────────────────────────────────────
// Agent memory inspector — Phase 1 §2.9.6
// ──────────────────────────────────────────────────────────
//
// Surfaces what each agent has remembered across sessions. Mounts
// in Settings → Agents below the agent list. Mirrors the slash-
// command UIs (Claude `/memory`, Codex `/memories`, Gemini
// `/memory list`) that our wrapper bypasses since we don't run
// the TUI.
//
// Read-only in v1. Each agent is its own collapsible card —
// expand to see the file list + previews; click a row to copy
// its full path. Cursor renders a "Open in browser" link instead
// of a file list (server-side memories).
// ──────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, FolderOpen } from "lucide-react";

import {
  loadAgentMemoryFiles,
  type AgentMemoryFile,
  type AgentMemoryResult,
} from "../../native/native";

interface Props {
  /** All discoverable agents from the registry. We list one card
   *  per agent regardless of memory state — agents without a
   *  documented memory location render a one-liner explaining
   *  that, which is more honest than hiding them. */
  agents: Array<{ id: string; name: string }>;
  /** Project root we're inspecting memory FOR. Mostly relevant
   *  for Claude's per-project memory; Gemini / Codex memory is
   *  user-global and ignores cwd. */
  cwd: string | null | undefined;
}

export function AgentMemoryInspector({ agents, cwd }: Props) {
  if (agents.length === 0) {
    return (
      <div className="oc-agent-mem-empty">
        No agents available — check the list above.
      </div>
    );
  }
  return (
    <div className="oc-agent-mem">
      <div className="oc-agent-mem-head">
        <div className="oc-agent-mem-title">Agent memory</div>
        <div className="oc-agent-mem-sub">
          What each agent has captured about your work — Claude /memory, Codex
          /memories, Gemini /memory add, etc.
        </div>
      </div>
      <div className="oc-agent-mem-body">
        {agents.map((a) => (
          <AgentMemoryCard
            key={a.id}
            agentId={a.id}
            agentName={a.name}
            cwd={cwd ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function AgentMemoryCard({
  agentId,
  agentName,
  cwd,
}: {
  agentId: string;
  agentName: string;
  cwd: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<AgentMemoryResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Load on first expand only — saves IPC chatter when the user
  // is just scanning the agent list.
  useEffect(() => {
    if (!open || data || loading) return;
    let cancelled = false;
    setLoading(true);
    loadAgentMemoryFiles({ agentId, cwd: cwd ?? undefined })
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch(() => {
        if (cancelled) return;
        setData({ agentId, cwd: cwd ?? null, files: [], unsupported: true });
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, data, loading, agentId, cwd]);

  const fileCount = data?.files.length ?? 0;
  const headerSummary = useMemo(() => {
    if (!data) return open ? "loading…" : "click to load";
    if (data.deepLink) return data.deepLink.label;
    if (data.unsupported) return "memory inspection not available";
    if (fileCount === 0) return "no memory yet";
    return `${fileCount} file${fileCount === 1 ? "" : "s"}`;
  }, [data, fileCount, open]);

  return (
    <div className="oc-agent-mem-card">
      <button
        type="button"
        className="oc-agent-mem-card-head"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 oc-agent-mem-caret" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 oc-agent-mem-caret" />
        )}
        <span className="oc-agent-mem-card-name">{agentName}</span>
        <span className="oc-agent-mem-card-summary">{headerSummary}</span>
      </button>
      {open && data && (
        <div className="oc-agent-mem-card-body">
          {data.deepLink ? (
            <DeepLinkRow url={data.deepLink.url} label={data.deepLink.label} />
          ) : data.unsupported ? (
            <div className="oc-agent-mem-note">
              {agentName} doesn't expose a documented memory location at the
              moment. We'll surface it here when it does.
            </div>
          ) : data.files.length === 0 ? (
            <div className="oc-agent-mem-note">
              No memory files captured yet at{" "}
              <code>{cwd ?? "(no project)"}</code>.
            </div>
          ) : (
            data.files.map((f) => <MemoryFileRow key={f.path} file={f} />)
          )}
        </div>
      )}
    </div>
  );
}

function DeepLinkRow({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="oc-agent-mem-deeplink"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      <span>{label}</span>
    </a>
  );
}

function MemoryFileRow({ file }: { file: AgentMemoryFile }) {
  const onCopy = () => void navigator.clipboard?.writeText(file.path);
  const sizeLabel = useMemo(() => formatSize(file.size), [file.size]);
  const ageLabel = useMemo(() => formatAge(file.mtime), [file.mtime]);

  return (
    <div className="oc-agent-mem-file">
      <div className="oc-agent-mem-file-head">
        <span className="oc-agent-mem-file-name">{file.filename}</span>
        <span className="oc-agent-mem-file-scope">{file.scope}</span>
        <span className="oc-agent-mem-file-meta">
          {sizeLabel} · {ageLabel}
        </span>
        <button
          type="button"
          className="oc-agent-mem-file-copy"
          title={`Copy path: ${file.path}`}
          onClick={onCopy}
        >
          <FolderOpen className="w-3 h-3" />
        </button>
      </div>
      <div className="oc-agent-mem-file-path" title={file.path}>
        {file.path}
      </div>
      {file.preview && (
        <div className="oc-agent-mem-file-preview">{file.preview}</div>
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatAge(mtimeMs: number): string {
  const diff = Date.now() - mtimeMs;
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
