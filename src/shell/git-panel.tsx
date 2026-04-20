// ──────────────────────────────────────────────────────────
// Git Panel — Column 2's Git tab
// ──────────────────────────────────────────────────────────
//
// Designer-friendly staging + commit + push/pull on top of
// libgit2 (via git2-rs in the Rust side). No file tree, no
// Monaco, no inline blame — just:
//
//   branch pill   [Pull ↓ N]   [Push ↑ M]
//   UNSTAGED  rows of files with Stage button + expandable diff
//   STAGED    rows with Unstage button + expandable diff
//   commit message textarea + Commit button
//   RECENT COMMITS — last 10, readonly
//
// Auth for push/pull falls through to the user's git credential
// helper (osxkeychain, ssh-agent, PAT in ~/.git-credentials).
// Phase 3 adds GitHub Device-Flow OAuth for first-time setup.
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  GitBranch,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  FilePlus,
  FileMinus,
  FileEdit,
  AlertTriangle,
  ArrowUpFromLine,
  ArrowDownToLine,
} from "lucide-react";
import {
  git,
  type GitStatus,
  type GitFileStatus,
  type GitCommit,
  type GitDiff,
} from "../native/tauri-events";

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function FileKindIcon({ kind }: { kind: GitFileStatus["kind"] }) {
  const common = { size: 12 };
  switch (kind) {
    case "untracked":
      return <FilePlus {...common} color="#50e3c2" />;
    case "added":
      return <FilePlus {...common} color="#50e3c2" />;
    case "modified":
      return <FileEdit {...common} color="#f5a623" />;
    case "deleted":
      return <FileMinus {...common} color="#ff6b6b" />;
    case "renamed":
      return <FileEdit {...common} color="#3b82f6" />;
    case "conflicted":
      return <AlertTriangle {...common} color="#ff6b6b" />;
    default:
      return <FileQuestion {...common} />;
  }
}

function DiffView({ diff }: { diff: GitDiff }) {
  return (
    <pre className="oc-git__diff">
      {diff.text || "(no changes)"}
      {diff.truncated && "\n… (truncated)"}
    </pre>
  );
}

function FileRow({
  file,
  expanded,
  onToggle,
  onAction,
  diff,
  busy,
}: {
  file: GitFileStatus;
  expanded: boolean;
  onToggle: () => void;
  onAction: () => void;
  diff: GitDiff | null;
  busy: boolean;
}) {
  return (
    <div className={`oc-git__file ${expanded ? "is-expanded" : ""}`}>
      <div className="oc-git__file-header">
        <button
          className="oc-git__caret"
          onClick={onToggle}
          title={expanded ? "Hide diff" : "Show diff"}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>
        <FileKindIcon kind={file.kind} />
        <span className="oc-git__file-path" title={file.path}>
          {file.path}
        </span>
        <span className={`oc-git__file-kind is-${file.kind}`}>{file.kind}</span>
        <button
          className="oc-git__file-action"
          onClick={onAction}
          disabled={busy}
          title={file.staged ? "Unstage" : "Stage"}
        >
          {file.staged ? <Minus size={12} /> : <Plus size={12} />}
        </button>
      </div>
      {expanded && diff && <DiffView diff={diff} />}
    </div>
  );
}

export function GitPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [diffs, setDiffs] = useState<Record<string, GitDiff>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c] = await Promise.all([git.status(), git.logRecent(10)]);
      setStatus(s);
      setCommits(c);
      // Refresh any already-open diffs so they reflect the new state.
      const open = Array.from(expanded);
      if (open.length > 0) {
        const next: Record<string, GitDiff> = {};
        for (const key of open) {
          const [pathPart, stagedPart] = key.split("::");
          try {
            const d = await git.diffFile(pathPart, stagedPart === "staged");
            next[key] = d;
          } catch {
            /* silent: diff may disappear after stage/unstage */
          }
        }
        setDiffs((prev) => ({ ...prev, ...next }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [expanded]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (text: string, ms = 2500) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), ms);
  };

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleRow = async (file: GitFileStatus) => {
    const key = `${file.path}::${file.staged ? "staged" : "unstaged"}`;
    const isOpen = expanded.has(key);
    const next = new Set(expanded);
    if (isOpen) {
      next.delete(key);
      setExpanded(next);
      return;
    }
    next.add(key);
    setExpanded(next);
    // Lazy-load the diff.
    if (!diffs[key]) {
      try {
        const d = await git.diffFile(file.path, file.staged);
        setDiffs((prev) => ({ ...prev, [key]: d }));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const handleStage = (file: GitFileStatus) =>
    wrap(async () => {
      if (file.staged) await git.unstageFile(file.path);
      else await git.stageFile(file.path);
      await refresh();
    });

  const handleStageAll = () =>
    wrap(async () => {
      await git.stageAll();
      await refresh();
    });

  const handleUnstageAll = () =>
    wrap(async () => {
      await git.unstageAll();
      await refresh();
    });

  const handleCommit = () =>
    wrap(async () => {
      if (!message.trim()) {
        throw new Error("commit message is empty");
      }
      const result = await git.commit(message.trim());
      setMessage("");
      showToast(`Committed ${result.sha.slice(0, 7)}`);
      await refresh();
    });

  const handlePush = () =>
    wrap(async () => {
      await git.push();
      showToast("Pushed to origin");
      await refresh();
    });

  const handlePull = () =>
    wrap(async () => {
      await git.pull();
      showToast("Up to date with origin");
      await refresh();
    });

  if (!isTauriWebview()) {
    return (
      <div className="oc-git__empty">Git requires the Mac app.</div>
    );
  }

  if (loading && !status) {
    return <div className="oc-git__empty">Loading git status…</div>;
  }

  if (!status || !status.branch) {
    return (
      <div className="oc-git__empty">
        <p>This folder isn't a git repository.</p>
        <p className="oc-git__hint">
          Run <code>git init</code> in the Terminal tab to start tracking
          changes.
        </p>
        <button className="oc-git__refresh-btn" onClick={refresh}>
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  const totalChanges = status.unstaged.length + status.staged.length;

  return (
    <div className="oc-git">
      <header className="oc-git__header">
        <div className="oc-git__branch">
          <GitBranch size={13} />
          <span>{status.branch}</span>
        </div>
        <div className="oc-git__remote">
          {status.hasUpstream ? (
            <>
              <button
                className="oc-git__btn"
                onClick={handlePull}
                disabled={busy || status.behind === 0}
                title={
                  status.behind === 0
                    ? "Up to date"
                    : `Pull ${status.behind} commit${status.behind === 1 ? "" : "s"}`
                }
              >
                <ArrowDownToLine size={12} />
                <span>Pull</span>
                {status.behind > 0 && (
                  <span className="oc-git__badge">{status.behind}</span>
                )}
              </button>
              <button
                className="oc-git__btn is-primary"
                onClick={handlePush}
                disabled={busy || status.ahead === 0}
                title={
                  status.ahead === 0
                    ? "Nothing to push"
                    : `Push ${status.ahead} commit${status.ahead === 1 ? "" : "s"}`
                }
              >
                <ArrowUpFromLine size={12} />
                <span>Push</span>
                {status.ahead > 0 && (
                  <span className="oc-git__badge">{status.ahead}</span>
                )}
              </button>
            </>
          ) : (
            <span className="oc-git__no-upstream" title="Branch has no upstream set">
              no upstream
            </span>
          )}
          <button
            className="oc-git__icon-btn"
            onClick={refresh}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </header>

      <section className="oc-git__section">
        <div className="oc-git__section-header">
          <span>
            Unstaged
            <span className="oc-git__section-count">{status.unstaged.length}</span>
          </span>
          {status.unstaged.length > 0 && (
            <button
              className="oc-git__section-action"
              onClick={handleStageAll}
              disabled={busy}
            >
              Stage all
            </button>
          )}
        </div>
        {status.unstaged.length === 0 ? (
          <p className="oc-git__section-empty">No unstaged changes.</p>
        ) : (
          <div className="oc-git__files">
            {status.unstaged.map((f) => {
              const key = `${f.path}::unstaged`;
              return (
                <FileRow
                  key={key}
                  file={f}
                  expanded={expanded.has(key)}
                  onToggle={() => toggleRow(f)}
                  onAction={() => handleStage(f)}
                  diff={diffs[key] ?? null}
                  busy={busy}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="oc-git__section">
        <div className="oc-git__section-header">
          <span>
            Staged
            <span className="oc-git__section-count">{status.staged.length}</span>
          </span>
          {status.staged.length > 0 && (
            <button
              className="oc-git__section-action"
              onClick={handleUnstageAll}
              disabled={busy}
            >
              Unstage all
            </button>
          )}
        </div>
        {status.staged.length === 0 ? (
          <p className="oc-git__section-empty">Nothing staged.</p>
        ) : (
          <div className="oc-git__files">
            {status.staged.map((f) => {
              const key = `${f.path}::staged`;
              return (
                <FileRow
                  key={key}
                  file={f}
                  expanded={expanded.has(key)}
                  onToggle={() => toggleRow(f)}
                  onAction={() => handleStage(f)}
                  diff={diffs[key] ?? null}
                  busy={busy}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="oc-git__commit">
        <textarea
          className="oc-git__message"
          placeholder={
            status.staged.length === 0
              ? "Stage some changes, then describe what you changed…"
              : "Describe the change"
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (status.staged.length > 0 && message.trim()) handleCommit();
            }
          }}
          rows={3}
        />
        <div className="oc-git__commit-actions">
          <span className="oc-git__commit-hint">
            {totalChanges > 0
              ? `${totalChanges} changed file${totalChanges === 1 ? "" : "s"}`
              : "Clean working tree"}
          </span>
          <button
            className="oc-git__btn is-primary"
            onClick={handleCommit}
            disabled={busy || !message.trim() || status.staged.length === 0}
          >
            Commit
          </button>
        </div>
      </section>

      <section className="oc-git__section">
        <div className="oc-git__section-header">
          <span>Recent commits</span>
        </div>
        {commits.length === 0 ? (
          <p className="oc-git__section-empty">No commits yet.</p>
        ) : (
          <div className="oc-git__commits">
            {commits.map((c) => (
              <div key={c.sha} className="oc-git__commit-row" title={c.sha}>
                <code className="oc-git__commit-sha">{c.shortSha}</code>
                <span className="oc-git__commit-summary">{c.summary}</span>
                <span className="oc-git__commit-author">{c.author}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && (
        <div className="oc-git__error" role="alert">
          {error}
        </div>
      )}
      {toast && <div className="oc-git__toast">{toast}</div>}
    </div>
  );
}
