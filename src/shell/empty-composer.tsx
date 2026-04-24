// ──────────────────────────────────────────────────────────
// Empty-state composer — Column 2 landing when no chat active
// ──────────────────────────────────────────────────────────
//
// Shares the composer primitives (ModelPill / EffortPill /
// PermissionsPill / AgentPill / image attach / send) with
// AgentChat so the transition from "no chat yet" to "first turn"
// is visually identical — same box, same focus ring, same pill
// row. Only the meta row above the card differs: the empty
// state renders folder + branch chips there so the user can
// scope a brand-new chat before sending.
//
// On submit we create the ChatThread with the pills' values
// already set, then enqueue the text via ENQUEUE_CHAT_SUBMISSION
// so the freshly-mounted AgentChat flushes it the moment its
// session is ready.
//
// On mount we also pre-warm the default agent's subprocess so
// the first send lands on a hot adapter (no ~10 s cold-start
// while the user watches a spinner).
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  Send,
  X as XIcon,
} from "lucide-react";
import { Button, Textarea } from "../zeros/ui";
import {
  useWorkspace,
  type ChatEffort,
  type ChatPermissionMode,
  type ChatThread,
} from "../zeros/store/store";
import { useAgentSessions } from "../zeros/agent/sessions-provider";
import { getDefaultAgentId } from "../zeros/panels/settings-page";
import type { InitializeResponse } from "@agentclientprotocol/sdk";
import type { BridgeRegistryAgent } from "../zeros/bridge/messages";
import {
  BranchPill,
  EffortPill,
  ModelPill,
  PermissionsPill,
} from "../zeros/agent/composer-pills";
import { AgentPill } from "../zeros/agent/agent-pill";
import { ComposerStateChip } from "../zeros/agent/composer-state-chip";
import { ComposerConnectingOverlay } from "../zeros/agent/composer-connecting-overlay";
import { envForChatSettings } from "../zeros/agent/model-catalog";
import type { ContentBlock } from "@agentclientprotocol/sdk";
import {
  loadRecentProjects,
  type RecentProject,
} from "../native/recent-projects";
import { openProjectFolder, openProjectFolderPath } from "../native/native";

function folderBasename(path: string): string {
  if (!path) return "No project";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function tildePath(p: string): string {
  if (!p) return p;
  return p.replace(/^\/Users\/[^/]+\//, "~/").replace(/^\/home\/[^/]+\//, "~/");
}

async function resolveCurrentFolder(): Promise<string> {
  const { isNativeRuntime, nativeInvoke } = await import("../native/runtime");
  if (!isNativeRuntime()) return "";
  try {
    const root = await nativeInvoke<string | null>("get_engine_root");
    return root ?? "";
  } catch {
    return "";
  }
}

async function resolveBranch(cwd?: string): Promise<{
  branch: string | null;
  ahead: number;
  behind: number;
}> {
  const { isNativeRuntime, git } = await import("../native/native");
  if (!isNativeRuntime()) return { branch: null, ahead: 0, behind: 0 };
  try {
    const st = await git.status(cwd || undefined);
    return {
      branch: st.branch ?? null,
      ahead: st.ahead ?? 0,
      behind: st.behind ?? 0,
    };
  } catch {
    return { branch: null, ahead: 0, behind: 0 };
  }
}

interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  size: number;
}

function newChatId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Failed to read file"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read error"));
    reader.readAsDataURL(file);
  });
}

/** Clickable folder chip in the empty composer's meta row. Mirrors the
 *  workspace menu in Column 1 — lists recent projects, offers "Open
 *  Folder…". Switching a project triggers `openProjectFolderPath` which
 *  respawns the engine + reloads the webview (see ReloadOnProjectChange
 *  in app-shell.tsx), so the new composer snapshots the new root. */
function WorkspacePill({ folder }: { folder: string }) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setRecents(loadRecentProjects());
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

  const handlePick = async (path: string) => {
    setOpen(false);
    try {
      await openProjectFolderPath(path);
      /* ReloadOnProjectChange will reload the webview on project-changed */
    } catch (err) {
      console.warn("[Zeros] could not open project:", err);
    }
  };

  const handleOpenFolder = async () => {
    setOpen(false);
    try {
      await openProjectFolder();
    } catch (err) {
      console.warn("[Zeros] open folder failed:", err);
    }
  };

  return (
    <div
      ref={rootRef}
      className="oc-empty-composer__workspace-root"
    >
      <button
        type="button"
        className="oc-empty-composer__folder oc-empty-composer__folder--button"
        onClick={() => setOpen((v) => !v)}
        title={folder || "Open a project folder"}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FolderOpen size={12} />
        <span>{folderBasename(folder)}</span>
        <ChevronDown size={10} />
      </button>
      {open && (
        <div
          className="oc-empty-composer__workspace-menu"
          role="menu"
        >
          {recents.length > 0 && (
            <>
              <div className="oc-empty-composer__workspace-section">
                Recent projects
              </div>
              {recents.map((p) => {
                const isCurrent = p.path === folder;
                return (
                  <button
                    key={p.path}
                    type="button"
                    className={`oc-empty-composer__workspace-item ${isCurrent ? "is-current" : ""}`}
                    onClick={() => !isCurrent && void handlePick(p.path)}
                    disabled={isCurrent}
                  >
                    <Folder size={12} />
                    <span className="oc-empty-composer__workspace-item-name">
                      {p.name}
                    </span>
                    <span className="oc-empty-composer__workspace-item-path">
                      {tildePath(p.path)}
                    </span>
                    {isCurrent && <Check size={11} />}
                  </button>
                );
              })}
              <div className="oc-empty-composer__workspace-sep" aria-hidden />
            </>
          )}
          <button
            type="button"
            className="oc-empty-composer__workspace-open"
            onClick={handleOpenFolder}
          >
            <FolderPlus size={12} />
            <span>Open Folder…</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function EmptyComposer() {
  const { state, dispatch } = useWorkspace();
  const sessions = useAgentSessions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [folder, setFolder] = useState<string>("");
  const [branch, setBranch] = useState<string | null>(null);
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [agent, setAgent] = useState<BridgeRegistryAgent | null>(null);
  const [initialize, setInitialize] = useState<InitializeResponse | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [effort, setEffort] = useState<ChatEffort>("medium");
  const [permissionMode, setPermissionMode] =
    useState<ChatPermissionMode>("ask");
  const [submitting, setSubmitting] = useState(false);
  const [noAgentHint, setNoAgentHint] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Stable speculative chat id — created once on mount and reused for
  // the speculative session + the eventual ADD_CHAT dispatch. This is
  // what makes the EmptyComposer → AgentChat handoff instant: the session
  // keyed under this id is already `ready` by the time ADD_CHAT fires,
  // so AgentChat mounts on a hot session and the first prompt sends
  // immediately (no queue, no lost message).
  const specChatIdRef = useRef<string>(newChatId());
  // True once we've committed to creating the chat (user hit send).
  // Prevents the on-unmount cleanup from wiping the session we're
  // about to hand off to AgentChat.
  const submittedRef = useRef(false);

  // The live speculative session from the provider.
  const specSession = sessions.sessions[specChatIdRef.current] ?? null;
  const rawStatus = specSession?.status ?? "idle";
  // Close the render-gap between "agent picked" and "ensureSession
  // patched the slot to warming". Without this the textarea briefly
  // ends up disabled with no overlay, which looks like a dead UI.
  // `idle` + no agent = genuinely idle (show nothing, allow nothing).
  // `idle` + agent = we're about to warm; render as `warming`.
  const sessionStatus = rawStatus === "idle" && agent ? "warming" : rawStatus;

  // Resolve folder + branch for the meta row. The store's
  // `newAgentFolder` override wins — it's set when the user clicks
  // "+" on a secondary workspace in Column 1, and scopes this
  // composer (and the chat it creates) to that folder instead of
  // the engine root. Empty / null falls back to the engine root.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const scoped = state.newAgentFolder;
      const f = scoped ?? (await resolveCurrentFolder());
      if (cancelled) return;
      setFolder(f);
      const b = await resolveBranch(f || undefined);
      if (cancelled) return;
      setBranch(b.branch);
      setAhead(b.ahead);
      setBehind(b.behind);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.newAgentFolder]);

  // Resolve a default agent on mount. We don't warm yet — the agent
  // chosen here feeds the speculative-session effect below.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const configuredId = getDefaultAgentId();
        const list = await sessions.listAgents();
        if (cancelled) return;
        const installed = list.filter((a) => a.installed === true);
        const chosen =
          (configuredId && installed.find((a) => a.id === configuredId)) ||
          installed[0] ||
          null;
        if (!cancelled) setAgent(chosen ?? null);
      } catch {
        /* registry unreachable — surfaces on submit */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessions]);

  // Speculative session: the moment the user has an agent + folder
  // resolved, ask the provider to create a real session keyed by our
  // stable specChatId. When they submit, we just ADD_CHAT with that
  // same id — the session is already warm (or `failed` / `auth-required`
  // with a clear affordance). Fetches initialize for the ModelPill on
  // success.
  useEffect(() => {
    if (!agent) return;
    const specChatId = specChatIdRef.current;
    const env = envForChatSettings({
      agentId: agent.id,
      initialize,
      model,
      effort,
    });
    void sessions
      .ensureSession(specChatId, agent.id, {
        agentName: agent.name,
        cwd: folder || undefined,
        env,
        force: true,
      })
      .catch(() => {
        /* slot's failure/error fields carry the diagnosis — the
           overlay + chip read those via sessionStatus. */
      });
    // Intentionally only fires on agent/cwd change — model/effort drift
    // respawns the subprocess at send-time (envForChatSettings reflects
    // that automatically).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent?.id, folder]);

  // Once the speculative session reaches `ready`, cache its
  // InitializeResponse so the ModelPill can list agent-advertised models.
  useEffect(() => {
    if (sessionStatus !== "ready") return;
    if (!specSession?.initialize) return;
    setInitialize(specSession.initialize);
  }, [sessionStatus, specSession?.initialize]);

  // Abandon the speculative session if the user navigates away without
  // submitting. Prevents a slow-moving subprocess pool from accumulating
  // orphan sessions per "started typing but left" cycle.
  useEffect(() => {
    return () => {
      if (submittedRef.current) return;
      sessions.reset(specChatIdRef.current);
    };
  }, [sessions]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if ((text.length === 0 && attachments.length === 0) || submitting) return;
    // Gate by session state — the new flow refuses to submit unless the
    // speculative session reached `ready`. The UI already disables the
    // button in that state; this is belt-and-suspenders.
    if (sessionStatus !== "ready") return;
    if (!agent) {
      setNoAgentHint(true);
      return;
    }
    setSubmitting(true);
    setNoAgentHint(false);

    const specChatId = specChatIdRef.current;
    const snapshotText = text;
    const snapshotAttachments = attachments;

    // Mark submitted BEFORE dispatch so the unmount-cleanup effect
    // doesn't tear down the session between ADD_CHAT and sendPrompt.
    submittedRef.current = true;

    const chat: ChatThread = {
      id: specChatId,
      folder,
      agentId: agent.id,
      agentName: agent.name,
      model,
      effort,
      permissionMode,
      title:
        snapshotText.length > 40
          ? `${snapshotText.slice(0, 40).trimEnd()}…`
          : snapshotText || "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    dispatch({ type: "ADD_CHAT", chat });
    dispatch({ type: "SET_ACTIVE_CHAT", id: specChatId });

    // Direct send — session is already `ready` on this chatId, no
    // queue required. AgentChat will mount and see a hot streaming
    // session. First message flows immediately.
    const blocks: ContentBlock[] = snapshotAttachments.map((a) => ({
      type: "image" as const,
      mimeType: a.mimeType,
      data: a.data,
    }));
    void sessions
      .sendPrompt(specChatId, snapshotText, snapshotText, blocks)
      .catch(() => {
        /* status carries the error for AgentChat to render */
      });

    setInput("");
    setAttachments([]);
    setSubmitting(false);
  }, [
    input,
    attachments,
    agent,
    folder,
    model,
    effort,
    permissionMode,
    submitting,
    sessionStatus,
    sessions,
    dispatch,
  ]);

  const handleGoToAgentSettings = () => {
    dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" });
  };

  const handleAgentChange = useCallback((a: BridgeRegistryAgent) => {
    // The speculative-session effect picks this up and force-rebuilds
    // the session under the new agent. We just clear the model/init
    // caches — ensureSession will repopulate them when ready.
    setAgent(a);
    setInitialize(null);
    setModel(null);
  }, []);

  const handleImageChoose = () => fileInputRef.current?.click();
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const additions: Attachment[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const data = await readFileAsBase64(file);
        additions.push({
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          mimeType: file.type,
          data,
          size: file.size,
        });
      } catch {
        /* skip unreadable files */
      }
    }
    if (additions.length > 0) {
      setAttachments((prev) => [...prev, ...additions]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const canSend =
    (input.trim().length > 0 || attachments.length > 0) &&
    !submitting &&
    sessionStatus === "ready";
  const agentName = agent?.name ?? null;

  const branchLabel = useMemo(() => branch ?? null, [branch]);

  return (
    <div className="oc-empty-composer-wrap">
      <div className="oc-empty-composer" role="region" aria-label="Start a new chat">
        <div className="oc-acp-composer-card">
          <ComposerConnectingOverlay
            status={sessionStatus}
            agentId={agent?.id ?? null}
            agentName={agentName}
            agentIconUrl={agent?.icon ?? null}
            hidden={sessionStatus === "ready" || sessionStatus === "idle"}
          />
          <Textarea
            ref={textareaRef}
            className="oc-acp-composer-input"
            placeholder={
              sessionStatus === "ready"
                ? "Plan, Build, / for commands, @ for context"
                : ""
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            aria-label="Message"
            disabled={sessionStatus !== "ready"}
          />

          {attachments.length > 0 && (
            <div className="oc-acp-attachments" role="list">
              {attachments.map((a) => (
                <div key={a.id} className="oc-acp-attachment" role="listitem">
                  <span className="oc-acp-attachment-name" title={a.name}>
                    {a.name}
                  </span>
                  <button
                    type="button"
                    className="oc-acp-attachment-x"
                    onClick={() => removeAttachment(a.id)}
                    title="Remove attachment"
                    aria-label="Remove attachment"
                  >
                    <XIcon size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="oc-acp-composer-toolbar">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              onClick={handleImageChoose}
              title="Attach image"
              aria-label="Attach image"
            >
              <ImagePlus size={13} />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => void handleImageFiles(e.target.files)}
            />
            <ModelPill
              agentId={agent?.id ?? null}
              initialize={initialize}
              value={model}
              onChange={setModel}
            />
            <EffortPill value={effort} onChange={setEffort} />
            <PermissionsPill
              availableModes={[]}
              currentModeId={null}
              onAgentModeChange={() => {
                /* no live session yet — mode is applied when the chat
                   binds its first session */
              }}
              value={permissionMode}
              onChange={setPermissionMode}
            />
            <div className="oc-acp-toolbar-spacer" />
            <Button
              variant="primary"
              size="icon-sm"
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSend}
              title="Send (Enter)"
            >
              <Send size={13} />
            </Button>
          </div>
        </div>

        <div className="oc-acp-composer-footer">
          <AgentPill
            selectedId={agent?.id ?? null}
            selectedName={agentName}
            onSelect={handleAgentChange}
          />
          <ComposerStateChip
            status={sessionStatus}
            agentName={agentName}
            onAction={handleGoToAgentSettings}
          />
          <WorkspacePill folder={folder} />
          <BranchPill
            branch={branchLabel}
            ahead={ahead}
            behind={behind}
            cwd={folder || undefined}
            onSwitched={(name) => {
              setBranch(name);
              setAhead(0);
              setBehind(0);
            }}
          />
        </div>

        {noAgentHint && (
          <div className="oc-empty-composer__hint" role="status">
            <span>
              No active agents. Install and log in to one from Settings →
              Agents to send this message.
            </span>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={handleGoToAgentSettings}
            >
              Open Agent Settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
