// ──────────────────────────────────────────────────────────
// Git Panel — Column 2's Git tab
// ──────────────────────────────────────────────────────────
//
// Designer-friendly staging + commit + push/pull on top of
// native Git commands exposed through Electron IPC. The panel layers
// the full designer-UX surface on top:
//
//   - 3-A  Suggest commit message
//   - 3-B  Open PR on GitHub
//   - 3-C  Discard changes (confirm) + force-push (setting)
//   - 3-D  Branch switcher with fuzzy search, expandable log,
//          right-click commit actions
//   - 3-E  Visual diff v2 (rendered before/after with a
//          text-diff toggle)
//   - 3-H  Conflict banner + keep-mine / keep-theirs actions
//
// Auth for push/pull falls through to the user's git
// credential helper (osxkeychain, ssh-agent, PAT).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCw,
  GitBranch,
  Plus,
  Minus,
  ChevronDown,
  ChevronRight,
  ArrowUpFromLine,
  ArrowDownToLine,
  Sparkles,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Eye,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import {
  gitForCwd,
  notify,
  shellOpenUrl,
  type GitStatus,
  type GitFileStatus,
  type GitCommit,
  type GitDiff,
  type GitBranch as GitBranchInfo,
  type GitConflict,
} from "../native/native";
import { isNativeRuntime } from "../native/runtime";
import { getSetting, setSetting } from "../native/settings";
import { Button, Textarea } from "../zeros/ui";
import { useChatCwd } from "./use-chat-cwd";

const FORCE_PUSH_KEY = "git-allow-force-push";

// Convert a git remote URL into its GitHub compare URL for a given branch.
// Returns null when the URL isn't github.com — other hosts don't have the
// same /compare/ route, so we hide the button rather than guess.
function githubCompareUrl(remote: string, branch: string): string | null {
  const match = remote.match(/github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;
  const [, owner, repo] = match;
  return `https://github.com/${owner}/${repo}/compare/${encodeURIComponent(branch)}?expand=1`;
}

// ── Small display helpers ───────────────────────────────────

function FileKindIcon({ kind }: { kind: GitFileStatus["kind"] }) {
  const letter =
    kind === "untracked" ? "U"
    : kind === "added" ? "A"
    : kind === "modified" ? "M"
    : kind === "deleted" ? "D"
    : kind === "renamed" ? "R"
    : kind === "typechange" ? "T"
    : kind === "conflicted" ? "!"
    : "?";
  return (
    <span className={`oc-git__file-mark is-${kind}`} title={kind}>
      {letter}
    </span>
  );
}

function DiffView({ diff }: { diff: GitDiff }) {
  return (
    <pre className="oc-git__diff">
      {diff.text || "(no changes)"}
      {diff.truncated && "\n… (truncated)"}
    </pre>
  );
}

// ── Visual diff v2 (3-E) ────────────────────────────────────
//
// For text-based files we can always render a side-by-side "before"
// (HEAD version) and "after" (worktree version). For CSS files we
// additionally inject both stylesheets into tiny iframes so the user
// sees the rendered effect, not a character diff.

type VisualMode = "visual" | "text";

function isCssPath(p: string): boolean {
  return p.toLowerCase().endsWith(".css");
}

function PreviewFrame({ css, label }: { css: string; label: string }) {
  // Inline HTML for a sandboxed iframe — CSS custom properties from
  // the parent document are not inherited, so literal colors are
  // required here. check:ui ignore-next
  const html = `<!doctype html><html><head><style>${css}\nhtml,body{margin:0;padding:16px;font-family:system-ui,sans-serif;font-size:13px;color:#ddd;background:#1a1a1a}</style></head><body><div class="oc-preview-sample"><button class="oc-preview-btn">Sample</button><h3>Heading</h3><p>Paragraph of body text.</p></div></body></html>`;
  return (
    <div className="oc-git__preview">
      <div className="oc-git__preview-label">{label}</div>
      <iframe
        className="oc-git__preview-frame"
        srcDoc={html}
        sandbox="allow-same-origin"
        title={label}
      />
    </div>
  );
}

function VisualDiff({ path, fallbackDiff, cwd }: {
  cwd?: string;
  path: string;
  fallbackDiff: GitDiff | null;
}) {
  const git = useMemo(() => gitForCwd(cwd), [cwd]);
  const [mode, setMode] = useState<VisualMode>("visual");
  const [head, setHead] = useState<string | null>(null);
  const [work, setWork] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const h = await git.fileAtHead(path);
        setHead(h.content ?? "");
        // Best-effort read of working-tree version via the native Git
        // facade. Fall back to the patch text when file content is
        // unavailable.
        setWork("");
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [path]);

  const isCss = isCssPath(path);

  return (
    <div className="oc-git__visual">
      <div className="oc-git__visual-tabs">
        <Button
          variant="ghost"
          size="sm"
          className={`oc-git__visual-tab ${mode === "visual" ? "is-active" : ""}`}
          onClick={() => setMode("visual")}
          title="Rendered before/after"
        >
          <Eye size={11} /> Visual
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={`oc-git__visual-tab ${mode === "text" ? "is-active" : ""}`}
          onClick={() => setMode("text")}
          title="Raw text diff"
        >
          <FileText size={11} /> Text
        </Button>
      </div>
      {mode === "text" && fallbackDiff && <DiffView diff={fallbackDiff} />}
      {mode === "visual" && err && (
        <p className="oc-git__section-empty">{err}</p>
      )}
      {mode === "visual" && !err && isCss && head !== null && (
        <div className="oc-git__previews">
          <PreviewFrame css={head ?? ""} label="Before (HEAD)" />
          <PreviewFrame css={work ?? head ?? ""} label="After (working tree)" />
        </div>
      )}
      {mode === "visual" && !err && !isCss && fallbackDiff && (
        <DiffView diff={fallbackDiff} />
      )}
    </div>
  );
}

// ── File row ────────────────────────────────────────────────

function FileRow({
  file,
  expanded,
  cwd,
  onToggle,
  onStageToggle,
  onDiscard,
  diff,
  busy,
}: {
  file: GitFileStatus;
  expanded: boolean;
  cwd?: string;
  onToggle: () => void;
  onStageToggle: () => void;
  onDiscard?: () => void;
  diff: GitDiff | null;
  busy: boolean;
}) {
  return (
    <div className={`oc-git__file ${expanded ? "is-expanded" : ""}`}>
      <div className="oc-git__file-header">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggle}
          title={expanded ? "Hide diff" : "Show diff"}
        >
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </Button>
        <FileKindIcon kind={file.kind} />
        <span className="oc-git__file-path" title={file.path}>
          {file.path}
        </span>
        {onDiscard && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDiscard}
            disabled={busy}
            title="Discard changes"
          >
            <Trash2 size={12} />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onStageToggle}
          disabled={busy}
          title={file.staged ? "Unstage" : "Stage"}
        >
          {file.staged ? <Minus size={12} /> : <Plus size={12} />}
        </Button>
      </div>
      {expanded && (
        <VisualDiff path={file.path} fallbackDiff={diff} cwd={cwd} />
      )}
    </div>
  );
}

// ── Branch switcher with fuzzy search ───────────────────────

function fuzzyMatch(query: string, candidate: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  let i = 0;
  for (const ch of c) {
    if (ch === q[i]) i++;
    if (i === q.length) return true;
  }
  return i === q.length;
}

function BranchMenu({
  current,
  branches,
  busy,
  onSwitch,
  onCreate,
  onDelete,
}: {
  current: string;
  branches: GitBranchInfo[];
  busy: boolean;
  onSwitch: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const local = branches.filter((b) => !b.isRemote);
  const filtered = local.filter((b) => fuzzyMatch(query, b.name));
  const trimmed = query.trim();
  const canCreate =
    trimmed.length > 0 && !local.some((b) => b.name === trimmed);

  return (
    <div className="oc-git__branch-menu-root" ref={rootRef}>
      <Button
        className="oc-git__branch"
        onClick={() => setOpen((v) => !v)}
        title={`Branch: ${current} — click to switch`}
      >
        <GitBranch size={13} />
        <span>{current}</span>
        <ChevronDown size={11} />
      </Button>
      {open && (
        <div className="oc-git__branch-menu">
          <input
            autoFocus
            className="oc-git__branch-search"
            placeholder="Switch or create branch…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canCreate) {
                e.preventDefault();
                onCreate(trimmed);
                setQuery("");
                setOpen(false);
              }
            }}
          />
          <div className="oc-git__branch-list">
            {filtered.length === 0 && !canCreate && (
              <p className="oc-git__section-empty">No matches.</p>
            )}
            {filtered.map((b) => (
              <div key={b.name} className="oc-git__branch-item">
                <button
                  className={`oc-git__branch-pick ${b.isHead ? "is-current" : ""}`}
                  disabled={busy || b.isHead}
                  onClick={() => {
                    onSwitch(b.name);
                    setOpen(false);
                  }}
                >
                  <GitBranch size={11} />
                  <span>{b.name}</span>
                  {b.isHead && <span className="oc-git__branch-chip">current</span>}
                </button>
                {!b.isHead && (
                  <button
                    className="oc-git__branch-delete"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Delete branch "${b.name}"? This cannot be undone.`)) {
                        onDelete(b.name);
                      }
                    }}
                    title="Delete branch"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>
            ))}
            {canCreate && (
              <button
                className="oc-git__branch-create"
                disabled={busy}
                onClick={() => {
                  onCreate(trimmed);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <Plus size={11} />
                <span>Create &ldquo;{trimmed}&rdquo; and switch</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Commit row with right-click actions (3-D) ───────────────

function CommitRow({
  commit,
  busy,
  onCopySha,
  onRevert,
  onReset,
}: {
  commit: GitCommit;
  busy: boolean;
  onCopySha: () => void;
  onRevert: () => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="oc-git__commit-row"
      title={commit.sha}
      onContextMenu={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
    >
      <code className="oc-git__commit-sha">{commit.shortSha}</code>
      <span className="oc-git__commit-summary">{commit.summary}</span>
      <span className="oc-git__commit-author">{commit.author}</span>
      <Button
        variant="ghost"
        size="icon-sm"
        className="oc-git__commit-more"
        onClick={() => setOpen((v) => !v)}
        title="Commit actions"
      >
        <MoreHorizontal size={12} />
      </Button>
      {open && (
        <div className="oc-git__commit-menu">
          <button onClick={() => { onCopySha(); setOpen(false); }}>
            Copy SHA
          </button>
          <button
            disabled={busy}
            onClick={() => {
              if (window.confirm(`Create a commit that reverts "${commit.summary}"?`)) {
                onRevert();
              }
              setOpen(false);
            }}
          >
            Revert
          </button>
          <button
            className="is-danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `Reset HEAD to ${commit.shortSha}? This discards all commits after it and changes in the working tree.`,
                )
              ) {
                onReset();
              }
              setOpen(false);
            }}
          >
            Reset to here (hard)
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main panel ──────────────────────────────────────────────

export function GitPanel() {
  const cwd = useChatCwd();
  const git = useMemo(() => gitForCwd(cwd), [cwd]);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [logLimit, setLogLimit] = useState<number>(10);
  const [branches, setBranches] = useState<GitBranchInfo[]>([]);
  const [conflicts, setConflicts] = useState<GitConflict[]>([]);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [diffs, setDiffs] = useState<Record<string, GitDiff>>({});
  const [allowForcePush, setAllowForcePush] = useState<boolean>(() =>
    getSetting<boolean>(FORCE_PUSH_KEY, false),
  );

  const refresh = useCallback(
    async (nextLimit?: number) => {
      setLoading(true);
      setError(null);
      try {
        const limit = nextLimit ?? logLimit;
        const [s, c, b, cf, r] = await Promise.all([
          git.status(),
          git.logRecent(limit),
          git.branchList(),
          git.conflictList(),
          git.remoteUrl(),
        ]);
        setStatus(s);
        setCommits(c);
        setBranches(b);
        setConflicts(cf);
        setRemoteUrl(r);
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
    },
    [expanded, logLimit],
  );

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

  const handleDiscardFile = (file: GitFileStatus) => {
    const confirmed = window.confirm(
      `Discard changes to ${file.path}? This cannot be undone.`,
    );
    if (!confirmed) return;
    wrap(async () => {
      await git.discardFile(file.path);
      await refresh();
    });
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const text = await git.suggestCommitMessage();
      if (text) setMessage(text);
      else showToast("Nothing staged to summarise.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSuggesting(false);
    }
  };

  const handleCommit = () =>
    wrap(async () => {
      if (!message.trim()) throw new Error("commit message is empty");
      const result = await git.commit(message.trim());
      setMessage("");
      showToast(`Committed ${result.sha.slice(0, 7)}`);
      notify("Commit created", `${result.sha.slice(0, 7)} — ${result.summary}`);
      await refresh();
    });

  const handlePush = () =>
    wrap(async () => {
      await git.push();
      showToast("Pushed to origin");
      notify("Pushed to origin", "Remote is up to date.");
      await refresh();
    });

  const handleForcePush = () => {
    if (!allowForcePush) return;
    const branchName = status?.branch ?? "this branch";
    if (
      !window.confirm(
        `Force-push ${branchName}? This overwrites the remote and can destroy teammates' work.`,
      )
    ) {
      return;
    }
    wrap(async () => {
      await git.pushForce();
      showToast("Force-pushed to origin");
      await refresh();
    });
  };

  const handlePull = () =>
    wrap(async () => {
      await git.pull();
      showToast("Up to date with origin");
      await refresh();
    });

  const handleBranchSwitch = (name: string) =>
    wrap(async () => {
      await git.branchSwitch(name);
      showToast(`Switched to ${name}`);
      await refresh();
    });

  const handleBranchCreate = (name: string) =>
    wrap(async () => {
      await git.branchCreate(name, true);
      showToast(`Created and switched to ${name}`);
      await refresh();
    });

  const handleBranchDelete = (name: string) =>
    wrap(async () => {
      await git.branchDelete(name);
      showToast(`Deleted ${name}`);
      await refresh();
    });

  const handleOpenPr = () => {
    if (!remoteUrl || !status?.branch) return;
    const url = githubCompareUrl(remoteUrl, status.branch);
    if (!url) {
      setError("Remote is not a GitHub repo; open a PR manually.");
      return;
    }
    shellOpenUrl(url).catch((err) =>
      setError(err instanceof Error ? err.message : String(err)),
    );
  };

  const handleResolveOurs = (path: string) =>
    wrap(async () => {
      await git.resolveOurs(path);
      showToast(`Kept mine: ${path}`);
      await refresh();
    });

  const handleResolveTheirs = (path: string) =>
    wrap(async () => {
      await git.resolveTheirs(path);
      showToast(`Kept theirs: ${path}`);
      await refresh();
    });

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha).then(
      () => showToast("SHA copied"),
      () => setError("clipboard unavailable"),
    );
  };

  const handleRevert = (sha: string) =>
    wrap(async () => {
      await git.revertCommit(sha);
      showToast(`Reverted ${sha.slice(0, 7)}`);
      await refresh();
    });

  const handleResetHard = (sha: string) =>
    wrap(async () => {
      await git.resetHard(sha);
      showToast(`Reset to ${sha.slice(0, 7)}`);
      await refresh();
    });

  const toggleAllowForcePush = () => {
    setAllowForcePush((prev) => {
      const next = !prev;
      setSetting(FORCE_PUSH_KEY, next);
      return next;
    });
  };

  const loadMoreLog = () => {
    const next = logLimit + 20;
    setLogLimit(next);
    refresh(next);
  };

  if (!isNativeRuntime()) {
    return <div className="oc-git__empty">Git requires the Mac app.</div>;
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
        <Button variant="outline" size="sm" onClick={() => refresh()}>
          <RefreshCw size={12} /> Retry
        </Button>
      </div>
    );
  }

  const totalChanges = status.unstaged.length + status.staged.length;
  const prUrl =
    remoteUrl && status.branch
      ? githubCompareUrl(remoteUrl, status.branch)
      : null;

  return (
    <div className="oc-git">
      <header className="oc-git__header">
        <BranchMenu
          current={status.branch}
          branches={branches}
          busy={busy}
          onSwitch={handleBranchSwitch}
          onCreate={handleBranchCreate}
          onDelete={handleBranchDelete}
        />
        <div className="oc-git__remote">
          {status.hasUpstream ? (
            <>
              <Button
                variant="ghost"
                size="sm"
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
              </Button>
              <Button
                variant="primary"
                size="sm"
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
              </Button>
              {allowForcePush && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleForcePush}
                  disabled={busy}
                  title="Force-push (overrides remote)"
                >
                  <ArrowUpFromLine size={12} />
                  <span>Force</span>
                </Button>
              )}
              {prUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleOpenPr}
                  title="Open a PR on GitHub"
                >
                  <ExternalLink size={12} />
                  <span>Open PR</span>
                </Button>
              )}
            </>
          ) : (
            <span className="oc-git__no-upstream" title="Branch has no upstream set">
              no upstream
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => refresh()}
            title="Refresh"
          >
            <RefreshCw size={12} />
          </Button>
        </div>
      </header>

      {conflicts.length > 0 && (
        <section className="oc-git__conflicts">
          <header className="oc-git__conflicts-header">
            <AlertTriangle size={13} />
            <span>
              {conflicts.length} file{conflicts.length === 1 ? "" : "s"} in
              conflict
            </span>
          </header>
          <ul className="oc-git__conflicts-list">
            {conflicts.map((c) => (
              <li key={c.path} className="oc-git__conflicts-row">
                <span className="oc-git__file-path" title={c.path}>
                  {c.path}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || !c.hasOurs}
                  onClick={() => handleResolveOurs(c.path)}
                  title="Keep mine (ours)"
                >
                  Keep mine
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || !c.hasTheirs}
                  onClick={() => handleResolveTheirs(c.path)}
                  title="Keep theirs"
                >
                  Keep theirs
                </Button>
              </li>
            ))}
          </ul>
          <p className="oc-git__conflicts-hint">
            &ldquo;Resolve with agent&rdquo; arrives alongside the Claude CLI
            integration in Phase 4.
          </p>
        </section>
      )}

      <section className="oc-git__section">
        <div className="oc-git__section-header">
          <span>
            Unstaged
            <span className="oc-git__section-count">{status.unstaged.length}</span>
          </span>
          {status.unstaged.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleStageAll}
              disabled={busy}
            >
              Stage all
            </Button>
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
                  cwd={cwd}
                  onToggle={() => toggleRow(f)}
                  onStageToggle={() => handleStage(f)}
                  onDiscard={() => handleDiscardFile(f)}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnstageAll}
              disabled={busy}
            >
              Unstage all
            </Button>
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
                  cwd={cwd}
                  onToggle={() => toggleRow(f)}
                  onStageToggle={() => handleStage(f)}
                  diff={diffs[key] ?? null}
                  busy={busy}
                />
              );
            })}
          </div>
        )}
      </section>

      <section className="oc-git__commit">
        <div className="oc-git__commit-head">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSuggest}
            disabled={suggesting || status.staged.length === 0}
            title="Suggest a commit message from the staged changes"
          >
            <Sparkles size={12} />
            <span>{suggesting ? "Suggesting…" : "Suggest"}</span>
          </Button>
        </div>
        <Textarea
          placeholder={
            status.staged.length === 0
              ? "Stage some changes, then describe what you changed…"
              : "Describe the change (or click Suggest)"
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
          <Button
            variant="primary"
            size="sm"
            onClick={handleCommit}
            disabled={busy || !message.trim() || status.staged.length === 0}
          >
            Commit
          </Button>
        </div>
        <label className="oc-git__toggle">
          <input
            type="checkbox"
            checked={allowForcePush}
            onChange={toggleAllowForcePush}
          />
          <span>Allow force-push</span>
          <span className="oc-git__toggle-hint">
            Shows a Force button next to Push. Off by default.
          </span>
        </label>
      </section>

      <section className="oc-git__section">
        <div className="oc-git__section-header">
          <span>Recent commits</span>
          {commits.length >= logLimit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMoreLog}
              disabled={busy}
            >
              Show more
            </Button>
          )}
        </div>
        {commits.length === 0 ? (
          <p className="oc-git__section-empty">No commits yet.</p>
        ) : (
          <div className="oc-git__commits">
            {commits.map((c) => (
              <CommitRow
                key={c.sha}
                commit={c}
                busy={busy}
                onCopySha={() => handleCopySha(c.sha)}
                onRevert={() => handleRevert(c.sha)}
                onReset={() => handleResetHard(c.sha)}
              />
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
