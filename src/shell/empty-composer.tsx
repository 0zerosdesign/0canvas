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
import { useAgentSessions } from "../zeros/agent/sessions-hooks";
import { useBridgeStatus } from "../zeros/bridge/use-bridge";
import { getDefaultAgentId } from "../zeros/panels/settings-page";
import type { InitializeResponse } from "../zeros/bridge/agent-events";
import type { BridgeRegistryAgent } from "../zeros/bridge/messages";
import {
  BranchPill,
  EffortPill,
  ModelPill,
  PermissionsPill,
} from "../zeros/agent/composer-pills";
import { AgentPill } from "../zeros/agent/agent-pill";
import { ComposerStateChip } from "../zeros/agent/composer-state-chip";
import { envForChatSettings } from "../zeros/agent/model-catalog";
import type { ContentBlock } from "../zeros/bridge/agent-events";
import {
  loadRecentProjects,
  type RecentProject,
} from "../native/recent-projects";
import { openProjectFolder, openProjectFolderPath } from "../native/native";
import { getSetting, setSetting } from "../native/settings";

/** Sticky last-used picker state. The empty composer seeds itself
 *  from this on mount so "+ New Agent" reliably picks up where the
 *  user's previous chat left off — same agent, model, effort,
 *  permission mode, and (when no per-workspace override is set)
 *  folder. Updated:
 *    - whenever the user submits a new chat from this composer
 *    - whenever the active chat changes (a small effect in app-shell
 *      mirrors the active chat's settings here, so opening a chat
 *      from the sidebar also refreshes the next-time defaults)
 */
const STICKY_DEFAULTS_KEY = "new-agent-sticky-defaults";

export interface StickyDefaults {
  agentId: string | null;
  folder: string | null;
  model: string | null;
  effort: ChatEffort;
  permissionMode: ChatPermissionMode;
}

const STICKY_FALLBACK: StickyDefaults = {
  agentId: null,
  folder: null,
  model: null,
  effort: "medium",
  permissionMode: "ask",
};

export function loadStickyDefaults(): StickyDefaults {
  const raw = getSetting<Partial<StickyDefaults> | null>(
    STICKY_DEFAULTS_KEY,
    null,
  );
  if (!raw || typeof raw !== "object") return STICKY_FALLBACK;
  return {
    agentId: typeof raw.agentId === "string" ? raw.agentId : null,
    folder: typeof raw.folder === "string" ? raw.folder : null,
    model: typeof raw.model === "string" ? raw.model : null,
    effort:
      raw.effort === "low" ||
      raw.effort === "medium" ||
      raw.effort === "high" ||
      raw.effort === "xhigh"
        ? raw.effort
        : "medium",
    permissionMode:
      raw.permissionMode === "full" ||
      raw.permissionMode === "auto-edit" ||
      raw.permissionMode === "ask" ||
      raw.permissionMode === "plan-only"
        ? raw.permissionMode
        : "ask",
  };
}

export function saveStickyDefaults(d: StickyDefaults): void {
  setSetting(STICKY_DEFAULTS_KEY, d);
}

function folderBasename(path: string): string {
  if (!path) return "No project";
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

function tildePath(p: string): string {
  if (!p) return p;
  return p.replace(/^\/Users\/[^/]+\//, "~/").replace(/^\/home\/[^/]+\//, "~/");
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

  // Read once on mount. The sticky defaults reflect either the user's
  // most recent chat (mirrored from active-chat changes) or their
  // most recent submit from this composer.
  const stickyRef = useRef<StickyDefaults>(loadStickyDefaults());
  const sticky = stickyRef.current;

  const [input, setInput] = useState("");
  const [folder, setFolder] = useState<string>("");
  const [branch, setBranch] = useState<string | null>(null);
  const [ahead, setAhead] = useState(0);
  const [behind, setBehind] = useState(0);
  const [agent, setAgent] = useState<BridgeRegistryAgent | null>(null);
  // Full registry (installed + uninstalled) — drives the
  // "No agent CLI detected" empty state so the user can see
  // exactly which CLIs Zeros supports and how to install one.
  // Distinct from `agent` (the single picked agent) because we
  // need the zero-installed case to render a *list* of options,
  // not just block on a null pointer.
  const [registryLoaded, setRegistryLoaded] = useState(false);
  const [initialize, setInitialize] = useState<InitializeResponse | null>(null);
  const [model, setModel] = useState<string | null>(sticky.model);
  const [effort, setEffort] = useState<ChatEffort>(sticky.effort);
  const [permissionMode, setPermissionMode] =
    useState<ChatPermissionMode>(sticky.permissionMode);
  const [submitting, setSubmitting] = useState(false);
  const [noAgentHint, setNoAgentHint] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // The empty composer no longer creates a speculative session. The new
  // flow on Send is:
  //   1. ADD_CHAT + SET_ACTIVE_CHAT     — workspace adopts the new chat
  //   2. ENQUEUE_CHAT_SUBMISSION         — text waits in the store queue
  //   3. AgentChat mounts → ensureSession → consumes the queue when ready
  //
  // This eliminates the closure-stale-state and unmount-cleanup races
  // that made Send silently drop messages. The speculative-session
  // pattern was an attempt to make the handoff "instant", but it
  // introduced too many race conditions to be worth the few-hundred-ms
  // win. The new flow is racy-by-construction-impossible.
  const sessionStatus: "idle" | "warming" = "idle";

  // Resolve folder + branch for the meta row.
  // Priority order:
  //   1. state.newAgentFolder       — explicit "+ on workspace" scope
  //   2. sticky.folder              — last-used folder from the user's
  //                                    previous chat / submit
  //   3. (empty)                    — fresh start, user picks via the chip
  //
  // We intentionally do NOT fall back to the engine root: the engine
  // always boots into *some* directory (the dev cwd, or the sentinel
  // ~/.zeros/default-project for end users), and using that as the
  // composer's folder hides the "no project picked yet" state behind a
  // confusing default. When sticky and scope are both absent we leave
  // the chip empty so the user explicitly picks.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const scoped = state.newAgentFolder;
      const f = scoped ?? sticky.folder ?? "";
      if (cancelled) return;
      setFolder(f);
      // Skip the branch probe when there's no folder — git.status on a
      // non-project would just throw and `branch` stays null anyway.
      if (!f) {
        setBranch(null);
        setAhead(0);
        setBehind(0);
        return;
      }
      const b = await resolveBranch(f);
      if (cancelled) return;
      setBranch(b.branch);
      setAhead(b.ahead);
      setBehind(b.behind);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.newAgentFolder, sticky.folder]);

  // Resolve the agent list + default agent on mount. Uninstalled
  // agents are retained in state so the "no CLI detected" empty
  // state can render install hints. Re-run this effect via the
  // `registryVersion` bump so the Refresh button in that empty
  // state can re-probe PATH without reloading the whole window.
  const [registryVersion, setRegistryVersion] = useState(0);
  const refreshAgents = useCallback(() => {
    setRegistryVersion((v) => v + 1);
  }, []);

  // Auto-refresh the registry when the bridge reconnects. Without
  // this the empty state can get stuck showing "No coding-agent CLI
  // detected" after a project switch / engine respawn — listAgents
  // fired against the disconnected bridge, returned empty (or
  // queue-full-rejected), and there's no automatic re-probe. The
  // registryVersion bump piggybacks on the existing effect.
  const bridgeStatus = useBridgeStatus();
  const lastBridgeStatusRef = useRef(bridgeStatus);
  useEffect(() => {
    const prev = lastBridgeStatusRef.current;
    lastBridgeStatusRef.current = bridgeStatus;
    if (prev !== "connected" && bridgeStatus === "connected") {
      refreshAgents();
    }
  }, [bridgeStatus, refreshAgents]);
  // Depend on the stable function ref, NOT the whole `sessions` ctx —
  // ctx is a fresh object on every session-state update, so the old
  // `[sessions, registryVersion]` dep made this effect re-fire on every
  // AGENT_SESSION_UPDATE notification (i.e. every streaming chunk).
  // Each re-fire calls listAgents() which spawns 7 `--version` probes
  // on the engine. With slow Node-based CLIs that ignored SIGTERM
  // during their import phase, those subprocesses piled up to 200+
  // live processes and ~10GB of RAM in a few minutes.
  const listAgentsFn = sessions.listAgents;
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const configuredId = getDefaultAgentId();
        // force:true so Refresh actually re-probes PATH instead of
        // returning a cached (possibly stale) installed set.
        const list = await listAgentsFn(registryVersion > 0);
        if (cancelled) return;
        // Default-agent selection — match isRunnableAgent in agent-pill:
        // authentication is the strongest evidence the agent works (you
        // can't authenticate without invoking the binary), and the
        // install probe is unreliable in packaged Electron because
        // shell PATH inheritance often misses Homebrew / asdf / fnm /
        // volta / npm-global shims. Trust auth, fall back to install
        // only for no-auth-required agents.
        const runnable = list.filter(
          (a) =>
            a.authenticated === true ||
            (!a.authBinary && a.installed === true),
        );
        // Priority: sticky (the user's last-used agent) > configured
        // global default > first runnable. Sticky wins because the
        // user's "what I just used" is a stronger personal signal
        // than a global default.
        const chosen =
          (sticky.agentId && runnable.find((a) => a.id === sticky.agentId)) ||
          (configuredId && runnable.find((a) => a.id === configuredId)) ||
          runnable[0] ||
          null;
        setAgent(chosen ?? null);
        setRegistryLoaded(true);
      } catch {
        // Registry unreachable — we still mark loaded so the empty
        // state renders a usable "check your connection / install"
        // card instead of an eternal spinner.
        if (!cancelled) setRegistryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listAgentsFn, registryVersion]);

  // Fetch the agent's InitializeResponse once per agent so the ModelPill
  // can list advertised models. In the native runtime initialize is
  // synthesized — no subprocess spawned — so this is essentially free.
  // Failures (auth-required) are swallowed; the chat-side flow surfaces
  // them when the user actually starts a session.
  useEffect(() => {
    if (!agent) return;
    let cancelled = false;
    void sessions
      .initAgent(agent.id)
      .then((init) => {
        if (cancelled) return;
        setInitialize(init);
      })
      .catch(() => {
        /* model picker stays on built-in defaults */
      });
    return () => {
      cancelled = true;
    };
  }, [agent?.id, sessions]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if ((text.length === 0 && attachments.length === 0) || submitting) return;
    if (!agent) {
      setNoAgentHint(true);
      return;
    }
    setSubmitting(true);
    setNoAgentHint(false);

    // Race-free new-chat flow:
    //   1. Generate the chatId
    //   2. ADD_CHAT + SET_ACTIVE_CHAT — workspace mounts AgentChat
    //   3. ENQUEUE_CHAT_SUBMISSION — text + attachments wait in the store
    //   4. AgentChat's useEffect on `pendingChatSubmission` consumes the
    //      queue once the session reaches `ready`
    // No speculative session, no closure-stale slot reads, no unmount
    // cleanup race. The text either lands or surfaces a real failure
    // status (auth-required / failed) inside the new chat view.
    const newId = newChatId();
    const chat: ChatThread = {
      id: newId,
      folder,
      agentId: agent.id,
      agentName: agent.name,
      model,
      effort,
      permissionMode,
      title:
        text.length > 40
          ? `${text.slice(0, 40).trimEnd()}…`
          : text || "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Stamp the picker state so the next "+ New Agent" defaults to
    // exactly what the user just used here.
    saveStickyDefaults({
      agentId: agent.id,
      folder: folder || null,
      model,
      effort,
      permissionMode,
    });
    dispatch({ type: "ADD_CHAT", chat });
    dispatch({ type: "SET_ACTIVE_CHAT", id: newId });
    dispatch({
      type: "ENQUEUE_CHAT_SUBMISSION",
      submission: {
        id: newId,
        text,
        source: "manual",
      },
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

  // Send is enabled the moment there's content. handleSubmit awaits the
  // in-flight ensureSession when the session isn't ready yet, so the
  // user no longer has to wait visibly for "Connecting…" to clear.
  const canSend =
    (input.trim().length > 0 || attachments.length > 0) && !submitting;
  const agentName = agent?.name ?? null;

  const branchLabel = useMemo(() => branch ?? null, [branch]);

  // Empty composer no longer creates a speculative session, so there's
  // no "Connecting to <agent>…" overlay to coordinate with. The
  // placeholder is the only visible affordance.
  const placeholder = "Plan, Build, / for commands, @ for context";

  return (
    <div className="oc-empty-composer-wrap">
      <div className="oc-empty-composer" role="region" aria-label="Start a new chat">
        <div className="oc-agent-composer-card">
          <Textarea
            ref={textareaRef}
            className="oc-agent-composer-input"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            aria-label="Message"
          />

          {attachments.length > 0 && (
            <div className="oc-agent-attachments" role="list">
              {attachments.map((a) => (
                <div key={a.id} className="oc-agent-attachment" role="listitem">
                  <span className="oc-agent-attachment-name" title={a.name}>
                    {a.name}
                  </span>
                  <button
                    type="button"
                    className="oc-agent-attachment-x"
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

          <div className="oc-agent-composer-toolbar">
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
            <div className="oc-agent-toolbar-spacer" />
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

        <div className="oc-agent-composer-footer">
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

