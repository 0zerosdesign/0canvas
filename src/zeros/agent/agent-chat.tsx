// ──────────────────────────────────────────────────────────
// AgentChat — messages + tool cards + permission modal + composer
// ──────────────────────────────────────────────────────────
//
// The chat surface for an in-flight ACP session. It's driven entirely
// by the state the useAgentSession hook exposes — this component does
// not store message state of its own, which keeps us honest about
// what the protocol says vs. what we invent.
//
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace, findBySelector, type ChatThread } from "../store/store";
import { flashElement } from "../inspector";
import {
  collectMentions,
  detectMentionTrigger,
  expandMentionsInText,
  filterMentions,
  type MentionItem,
} from "./mentions";
import { MentionPicker } from "./mention-picker";
import {
  detectSlashTrigger,
  filterSlashCommands,
  SlashCommandPicker,
} from "./slash-command-picker";
import {
  Bot,
  Loader2,
  Send,
  Square,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  AlertCircle,
  Palette,
  Target,
  FileText,
  MessageSquare,
  Zap,
  MousePointer2,
  GitBranch,
  Layers,
} from "lucide-react";
import type {
  PlanEntry,
  RequestPermissionRequest,
  RequestPermissionOutcome,
} from "@agentclientprotocol/sdk";
import type {
  AgentMessage,
  AgentSessionControls,
  AgentSessionState,
  AgentToolMessage,
} from "./use-agent-session";
import { Button, Textarea } from "../ui";
import {
  ModelPill,
  EffortPill,
  PermissionsPill,
  BranchPill,
  ContextPill,
} from "./composer-pills";
import { AgentPill } from "./agent-pill";
import { SummaryHandoffPill } from "./summary-handoff-pill";
import { ComposerStateChip } from "./composer-state-chip";
import { ComposerConnectingOverlay } from "./composer-connecting-overlay";
import { useAgentsSnapshot } from "./agents-cache";
import { FolderOpen } from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import type { BridgeRegistryAgent } from "../bridge/messages";

// Error classification is handled by sessions-provider's AgentFailure
// pipeline; the UI now branches on session.status directly (warming /
// ready / reconnecting / auth-required / failed). No more regex
// helpers leaking timeout strings into the banner.

interface AgentChatProps {
  session: AgentSessionState & AgentSessionControls;
  onBack: () => void;
  /** Optional right-aligned header slot (e.g. a "+ new chat" picker).
   *  When provided the default back button is hidden and the slot
   *  takes over header actions. Keeps the component reusable between
   *  the AgentMode picker flow (needs "back") and the Column-2 chat
   *  flow (needs "+ new"). */
  headerActions?: React.ReactNode;
  /** When this chat is backed by a ChatThread in the store (Column 2
   *  flow), the composer shows model/effort/permissions pills and
   *  persists changes. Picker/beta flows pass no chatId and get a
   *  minimal composer. */
  chatId?: string;
}

export function AgentChat({ session, onBack, headerActions, chatId }: AgentChatProps) {
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionHighlight, setMentionHighlight] = useState(0);
  // Legacy in-flight queue for non-ready status — kept as a stub so
  // render sites that reference `queuedPreview` don't crash. No code
  // sets this anymore: EmptyComposer's new speculative-session flow
  // means the session is already ready on mount. External flows
  // (inline-edit, feedback) use the pendingChatSubmission store path
  // and don't touch this ref.
  const queuedPreview: string | null = null;
  // Elapsed time since the session entered "warming" / "reconnecting".
  // No longer drives user-visible copy (state chip owns that) — kept
  // only for the occasional slow-cold-start diagnostic.
  const [startingElapsed, setStartingElapsed] = useState(0);
  useEffect(() => {
    if (session.status !== "warming" && session.status !== "reconnecting") {
      setStartingElapsed(0);
      return;
    }
    const started = Date.now();
    const id = window.setInterval(() => {
      setStartingElapsed(Date.now() - started);
    }, 500);
    return () => window.clearInterval(id);
  }, [session.status]);
  // Persistent receipts for apply_change tool calls. Keyed by toolCallId.
  // Captured at first observation of the tool (before the write lands) so
  // "before" still reflects the pre-change value when the card re-renders
  // in its completed state.
  const [applyReceipts, setApplyReceipts] = useState<
    Record<string, { before: string | null; selector: string; property: string; after: string }>
  >({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { state: workspaceState, dispatch } = useWorkspace();
  const agentsList = useAgentsSnapshot();
  const followedToolsRef = useRef<Set<string>>(new Set());

  // Chat-thread-backed composer settings. When `chatId` is absent
  // (picker/beta flows) this returns null and the pills render stubs.
  const chatThread = chatId
    ? workspaceState.chats.find((c) => c.id === chatId) ?? null
    : null;
  const updateChatSettings = useCallback(
    (
      updates: Partial<
        Pick<ChatThread, "model" | "effort" | "permissionMode" | "agentId" | "agentName">
      >,
    ) => {
      if (!chatId) return;
      dispatch({ type: "UPDATE_CHAT_SETTINGS", id: chatId, updates });
    },
    [chatId, dispatch],
  );

  /** Agent switch = open a new chat bound to the target agent,
   *  remembering the source chat so the summary-handoff pill can offer
   *  to bring context across. Stays in place for "select the current
   *  agent" (no-op). */
  const handleAgentSwitch = useCallback(
    (a: BridgeRegistryAgent) => {
      if (!chatThread) return;
      if (a.id === chatThread.agentId) return;
      const newId = `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newChat: ChatThread = {
        id: newId,
        folder: chatThread.folder,
        agentId: a.id,
        agentName: a.name,
        model: null,
        effort: chatThread.effort,
        permissionMode: chatThread.permissionMode,
        title: "New chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sourceChatId: chatThread.id,
      };
      dispatch({ type: "ADD_CHAT", chat: newChat });
      dispatch({ type: "SET_ACTIVE_CHAT", id: newId });
    },
    [chatThread, dispatch],
  );

  // Git status for the below-composer footer. Workspace is shown as a
  // read-only label (project scope is pinned to the chat's folder for
  // the whole conversation); branch stays switchable so a mid-chat
  // "test this on feature/x" is one click away.
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const [gitAhead, setGitAhead] = useState<number>(0);
  const [gitBehind, setGitBehind] = useState<number>(0);
  const chatFolder = chatThread?.folder || undefined;
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const { isNativeRuntime, git } = await import("../../native/native");
      if (!isNativeRuntime()) return;
      try {
        const st = await git.status(chatFolder);
        if (cancelled) return;
        setGitBranch(st.branch ?? null);
        setGitAhead(st.ahead ?? 0);
        setGitBehind(st.behind ?? 0);
      } catch {
        /* not a git repo, or engine not up yet */
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [session.sessionId, chatFolder]);

  const folderLabel = useMemo(() => {
    if (!chatFolder) return null;
    const parts = chatFolder.split("/").filter(Boolean);
    return parts[parts.length - 1] || chatFolder;
  }, [chatFolder]);

  // ── Mention picker plumbing ───────────────────────────────
  const mentionTrigger = detectMentionTrigger(input, caret);
  const allMentions = useMemo(
    () => collectMentions(workspaceState),
    [workspaceState],
  );
  const filteredMentions: MentionItem[] = useMemo(
    () =>
      mentionTrigger
        ? filterMentions(allMentions, mentionTrigger.query)
        : [],
    [allMentions, mentionTrigger],
  );
  const pickerOpen = !!mentionTrigger && filteredMentions.length >= 0;

  // Clamp highlight when the filter result list changes underneath us.
  useEffect(() => {
    if (!pickerOpen) {
      setMentionHighlight(0);
      return;
    }
    setMentionHighlight((h) =>
      Math.min(Math.max(h, 0), Math.max(filteredMentions.length - 1, 0)),
    );
  }, [filteredMentions, pickerOpen]);

  // ── Slash-command picker plumbing ─────────────────────────
  // Mutually exclusive with mention picker by caret position (mentions
  // need a word-boundary '@', slash commands only trigger at prompt start).
  const slashTrigger = detectSlashTrigger(input, caret);
  const filteredCommands = useMemo(
    () =>
      slashTrigger
        ? filterSlashCommands(session.availableCommands, slashTrigger.query)
        : [],
    [session.availableCommands, slashTrigger],
  );
  const slashPickerOpen =
    !!slashTrigger && session.availableCommands.length > 0;
  const [slashHighlight, setSlashHighlight] = useState(0);
  useEffect(() => {
    if (!slashPickerOpen) {
      setSlashHighlight(0);
      return;
    }
    setSlashHighlight((h) =>
      Math.min(Math.max(h, 0), Math.max(filteredCommands.length - 1, 0)),
    );
  }, [filteredCommands, slashPickerOpen]);

  const insertSlashCommand = (
    cmd: { name: string; input?: unknown | null },
  ) => {
    if (!slashTrigger) return;
    // Replace the "/<query>" segment with "/<name> " and park the caret
    // after it, so the user either hits Enter (no-arg commands) or types
    // args (commands with `input`).
    const after = input.slice(slashTrigger.end);
    // Avoid doubling the space if they've already typed one.
    const sep = after.startsWith(" ") || after.length === 0 ? "" : " ";
    const nextText = `/${cmd.name}${sep}${after}`;
    const nextCaret = 1 + cmd.name.length + sep.length;
    setInput(nextText);
    setSlashHighlight(0);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  };

  const insertMention = (item: MentionItem) => {
    if (!mentionTrigger) return;
    const before = input.slice(0, mentionTrigger.start);
    const after = input.slice(mentionTrigger.end);
    // Append a space after the token so further typing doesn't extend it.
    const nextText = `${before}${item.token} ${after}`;
    const nextCaret = (before + item.token + " ").length;
    setInput(nextText);
    setMentionHighlight(0);
    // Reset caret after React commits the value change.
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  };

  // Auto-scroll on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages, session.pendingPermission, session.status]);

  // ⌘K — focus the composer from anywhere in the app. Cursor-style
  // shortcut; scoped to avoid clobbering ⌘K inside native inputs.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      textareaRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Follow-along — when the agent calls apply_change or get_element_styles
  // with a selector, jump the canvas to that element and flash it. Same
  // pass also captures the pre-change CSS value for apply_change so the
  // card can render a proper before→after receipt once the write lands.
  // Fires once per tool call id; repeated status updates don't re-flash
  // and don't overwrite the captured "before".
  useEffect(() => {
    const receiptsToAdd: Record<
      string,
      { before: string | null; selector: string; property: string; after: string }
    > = {};
    for (const m of session.messages) {
      if (m.kind !== "tool") continue;
      if (followedToolsRef.current.has(m.toolCallId)) continue;
      const design = matchDesignTool(m.title);
      if (!design) continue;
      const input = m.rawInput as
        | { selector?: string; property?: string; value?: string }
        | undefined;
      const selector = input?.selector;
      if (!selector) continue;
      const target = findBySelector(workspaceState.elements, selector);
      if (!target) continue;
      followedToolsRef.current.add(m.toolCallId);
      dispatch({ type: "SELECT_ELEMENT", id: target.id, source: "panel" });
      try {
        flashElement(target.id);
      } catch {
        /* overlay not ready */
      }
      // Snapshot a receipt for apply_change only — reads don't mutate.
      if (
        /apply_change/.test(m.title) &&
        input?.property &&
        input?.value !== undefined
      ) {
        const before = lookupCurrentValue(
          workspaceState.elements,
          selector,
          input.property,
        );
        receiptsToAdd[m.toolCallId] = {
          before: before ?? null,
          selector,
          property: input.property,
          after: input.value,
        };
      }
    }
    if (Object.keys(receiptsToAdd).length > 0) {
      setApplyReceipts((prev) => ({ ...prev, ...receiptsToAdd }));
    }
  }, [session.messages, workspaceState.elements, dispatch]);

  // Attachments for the next prompt — ACP image ContentBlocks queued by
  // the paperclip/image button. Cleared on send or manual dismissal.
  const [attachments, setAttachments] = useState<
    Array<{ id: string; name: string; mimeType: string; data: string; size: number }>
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Send is enabled the moment there's content. Native runtime: the
  // session reaches `ready` quickly enough that gating the button is
  // user-hostile. We only block on `pendingPermission` (a modal flow)
  // and `streaming` (the agent is still mid-turn).
  const canSend =
    session.status !== "streaming" &&
    !session.pendingPermission &&
    (input.trim().length > 0 || attachments.length > 0);

  const handleSend = async (override?: string) => {
    const rawText = override ?? input;
    const displayText = rawText.trim();
    if (session.pendingPermission) return;
    if (displayText.length === 0 && attachments.length === 0) return;
    // If the session bounced to warming / reconnecting, kick a fresh
    // ensureSession and wait for it before sending. Bails on terminal
    // statuses (failed / auth-required) — those need user action.
    if (session.status !== "ready") {
      if (session.status === "failed" || session.status === "auth-required") return;
      const targetAgentId = session.agentId ?? chatThread?.agentId;
      if (!targetAgentId) return;
      try {
        await session.startSession(targetAgentId);
      } catch {
        return;
      }
    }
    const wireText = expandMentionsInText(displayText, workspaceState);
    const extraBlocks = attachments.map((a) => ({
      type: "image" as const,
      mimeType: a.mimeType,
      data: a.data,
    }));
    // Auto-title from the first user message. Only runs once per chat:
    // we overwrite "New chat" (the seeded default) but never touch a
    // title the user or a previous send already set. Trimmed to ~40
    // chars with an ellipsis so the sidebar and title bar stay tidy.
    if (chatId && chatThread && chatThread.title === "New chat" && displayText) {
      const preview =
        displayText.length > 40
          ? `${displayText.slice(0, 40).trimEnd()}…`
          : displayText;
      dispatch({ type: "UPDATE_CHAT_TITLE", id: chatId, title: preview });
    }
    if (override === undefined) {
      setInput("");
    }
    setAttachments([]);
    session.sendPrompt(wireText, displayText, extraBlocks).catch(() => {
      /* error surfaces via session.error */
    });
  };

  // (Previous local queue flush effect removed — EmptyComposer now
  // sends via a speculative session that is ready at submit time,
  // so there's nothing to flush locally.)

  // Phase 2-B handoff: InlineEdit, feedback pill, and the empty-state
  // composer all funnel AI requests through the ACP chat now. When the
  // pending submission targets this chat (or we're the only live one)
  // and the session is ready, send it and clear the queue.
  const pendingSub = workspaceState.pendingChatSubmission;
  useEffect(() => {
    if (!pendingSub) return;
    if (!chatId) return;
    // Only the active chat consumes the pending submission. The store
    // already routes by activeChatId at enqueue time; this guard is a
    // belt-and-suspenders check against double-sends if two chats are
    // ever mounted simultaneously.
    if (workspaceState.activeChatId !== chatId) return;
    if (session.status !== "ready" || session.pendingPermission) return;
    handleSend(pendingSub.text);
    dispatch({ type: "CONSUME_CHAT_SUBMISSION", id: pendingSub.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSub, session.status, session.pendingPermission, chatId, workspaceState.activeChatId]);

  /** Read a File into a base64 data payload (sans the `data:...;base64,`
   *  prefix — ACP's image block wants the raw base64 + a separate
   *  mimeType field). */
  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const handleImageChoose = () => fileInputRef.current?.click();
  const handleImageFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const additions: typeof attachments = [];
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
        /* silently skip files that fail to read */
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
    // Slash-command picker intercepts nav keys when open. Takes priority
    // over the mention picker, but in practice the two never both open
    // because their triggers are mutually exclusive by caret position.
    if (slashPickerOpen && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashHighlight((h) => (h + 1) % filteredCommands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashHighlight(
          (h) => (h - 1 + filteredCommands.length) % filteredCommands.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertSlashCommand(filteredCommands[slashHighlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Move caret past the command-name segment to close the picker.
        const ta = textareaRef.current;
        if (ta && slashTrigger) {
          const end = slashTrigger.end;
          ta.setSelectionRange(end, end);
          setCaret(end);
        }
        return;
      }
    }

    // Mention picker intercepts nav keys + Enter when open.
    if (pickerOpen && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionHighlight((h) => (h + 1) % filteredMentions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionHighlight(
          (h) => (h - 1 + filteredMentions.length) % filteredMentions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredMentions[mentionHighlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        // Close the picker by moving caret past the trigger.
        if (mentionTrigger) {
          const ta = textareaRef.current;
          if (ta) {
            const end = mentionTrigger.end;
            ta.setSelectionRange(end, end);
            // Fake a non-mention caret position. Typing a space is the
            // universal escape; drop one in to terminate the trigger.
            setInput((prev) =>
              prev.slice(0, end) + " " + prev.slice(end),
            );
            setCaret(end + 1);
          }
        }
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
  };

  const handleCaretSync = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    setCaret(ta.selectionStart ?? 0);
  };

  return (
    <div className="oc-acp-surface">
      <header className="oc-acp-subheader">
        {!headerActions && (
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={onBack}
            title="Back to agents"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </Button>
        )}
        <Bot
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: "var(--accent-hover)" }}
        />
        <div className="min-w-0 flex-1">
          <div className="oc-acp-subheader-title">
            {chatThread?.title ?? session.agentName ?? session.agentId ?? "ACP"}
          </div>
          <div className="oc-acp-subheader-sub">
            {session.agentName && (
              <span className="oc-acp-subheader-agent">{session.agentName}</span>
            )}
            <span className="oc-acp-subheader-status">
              {session.status === "streaming" && "streaming…"}
              {session.status !== "streaming" && session.lastStopReason
                ? session.lastStopReason
                : session.status === "ready"
                ? "ready"
                : session.status === "warming"
                ? "connecting…"
                : session.status === "reconnecting"
                ? "reconnecting…"
                : session.status === "auth-required"
                ? "sign in required"
                : ""}
            </span>
          </div>
        </div>
        {headerActions}
      </header>

      {session.status === "failed" && session.error && (
        <div className="oc-acp-error">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <div className="min-w-0" style={{ flex: 1 }}>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {session.error}
            </div>
          </div>
        </div>
      )}

      {session.plan.length > 0 && <PlanPanel entries={session.plan} />}

      {chatThread?.sourceChatId && session.messages.length === 0 && chatId && (
        <SummaryHandoffPill
          chatId={chatId}
          sourceChatId={chatThread.sourceChatId}
          onInsert={(text) => {
            setInput((prev) => (prev ? `${text}\n\n${prev}` : text));
            // Give React a tick to flush the textarea, then focus.
            window.setTimeout(() => textareaRef.current?.focus(), 0);
          }}
        />
      )}

      <div ref={scrollRef} className="oc-acp-body">
        <div className="oc-acp-messages">
          {/* Warming/reconnecting state is now surfaced by the compact
              chip in the composer's pill row — keep the message area
              empty so the user can still see the transcript area. */}
          {session.messages.length === 0 &&
            session.status === "ready" &&
            !session.error &&
            !queuedPreview && (
              <div className="oc-acp-empty-muted">
                Session ready. Ask the agent anything.
              </div>
            )}
          {session.messages.map((m) => (
            <MessageView key={m.id} message={m} applyReceipts={applyReceipts} />
          ))}
          {queuedPreview && (
            <div className="oc-acp-msg oc-acp-msg-user oc-acp-msg-queued">
              <div className="oc-acp-msg-content">
                {queuedPreview}
                <div className="oc-acp-msg-queued-hint">
                  <Clock className="w-3 h-3" /> queued — sending when the session connects
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {session.pendingPermission && (
        <PermissionBar
          request={session.pendingPermission.request}
          workspaceElements={workspaceState.elements}
          onRespond={(outcome) =>
            session.respondToPermission({ outcome })
          }
        />
      )}

      <div className="oc-acp-composer">
        {slashPickerOpen && (
          <SlashCommandPicker
            commands={filteredCommands}
            highlightIndex={slashHighlight}
            onHover={setSlashHighlight}
            onPick={insertSlashCommand}
          />
        )}
        {pickerOpen && !slashPickerOpen && (
          <MentionPicker
            items={filteredMentions}
            highlightIndex={mentionHighlight}
            onHover={setMentionHighlight}
            onPick={insertMention}
          />
        )}
        {attachments.length > 0 && (
          <div className="oc-acp-attachments" role="list">
            {attachments.map((a) => (
              <div key={a.id} className="oc-acp-attachment" role="listitem">
                <Palette className="w-3 h-3" />
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
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="oc-acp-composer-card">
          <ComposerConnectingOverlay
            status={session.status}
            agentId={session.agentId ?? chatThread?.agentId ?? null}
            agentName={session.agentName ?? chatThread?.agentName ?? null}
            agentIconUrl={
              agentsList?.find((a) => a.id === (session.agentId ?? chatThread?.agentId))?.icon ?? null
            }
            hidden={input.length > 0 || !!queuedPreview}
          />
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleCaretSync}
            onClick={handleCaretSync}
            onSelect={handleCaretSync}
            rows={1}
            placeholder={
              session.status === "streaming"
                ? "Agent is responding…"
                : 'Type your message… "/" for commands, "@" for files'
            }
            className="oc-acp-composer-input"
          />
          <div className="oc-acp-composer-toolbar">
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              title="Attach image"
              onClick={handleImageChoose}
            >
              <ImageIcon size={13} />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => void handleImageFiles(e.target.files)}
            />
            {chatThread && (
              <>
                <ModelPill
                  agentId={chatThread.agentId}
                  initialize={session.initialize}
                  value={chatThread.model}
                  onChange={(v) => updateChatSettings({ model: v })}
                />
                <EffortPill
                  value={chatThread.effort}
                  onChange={(v) => updateChatSettings({ effort: v })}
                />
                <PermissionsPill
                  availableModes={session.availableModes}
                  currentModeId={session.currentModeId}
                  onAgentModeChange={(modeId) => {
                    void session.setMode?.(modeId);
                  }}
                  value={chatThread.permissionMode}
                  onChange={(v) => updateChatSettings({ permissionMode: v })}
                />
              </>
            )}
            <div className="oc-acp-toolbar-spacer" />
            {session.status === "streaming" ? (
              <Button
                variant="destructive"
                size="icon-sm"
                type="button"
                onClick={() => session.cancel()}
                title="Cancel current turn"
              >
                <Square className="w-3 h-3" />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="icon-sm"
                type="button"
                onClick={() => handleSend()}
                disabled={!canSend}
                title="Send (Enter)"
              >
                <Send className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
        {chatThread && (
          <div className="oc-acp-composer-footer">
            <AgentPill
              selectedId={chatThread.agentId}
              selectedName={chatThread.agentName}
              showOpenInNewTabHint
              onSelect={handleAgentSwitch}
            />
            <ComposerStateChip
              status={session.status}
              agentName={session.agentName ?? chatThread.agentName}
              onAction={() =>
                dispatch({ type: "SET_ACTIVE_PAGE", page: "settings" })
              }
            />
            {folderLabel && (
              <span
                className="oc-acp-chat-workspace"
                title={chatThread.folder || "No project"}
              >
                <FolderOpen size={11} />
                <span>{folderLabel}</span>
              </span>
            )}
            <BranchPill
              branch={gitBranch}
              ahead={gitAhead}
              behind={gitBehind}
              cwd={chatFolder}
              onSwitched={(name) => {
                setGitBranch(name);
                setGitAhead(0);
                setGitBehind(0);
              }}
            />
            <div className="oc-acp-toolbar-spacer" />
            <ContextPill usage={session.usage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Design-audits pill — collapsed quick-launch for a11y/token audits

// ──────────────────────────────────────────────────────────
// PlanPanel — collapsible todo list from ACP `plan` notifications
// ──────────────────────────────────────────────────────────

function PlanPanel({ entries }: { entries: PlanEntry[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const done = entries.filter((e) => e.status === "completed").length;
  return (
    <div className="oc-acp-plan">
      <button
        type="button"
        className="oc-acp-plan-head"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="oc-acp-plan-title">Plan</span>
        <span className="oc-acp-plan-count">
          {done}/{entries.length}
        </span>
      </button>
      {!collapsed && (
        <ul className="oc-acp-plan-list">
          {entries.map((e, i) => (
            <li
              key={i}
              className={`oc-acp-plan-item oc-acp-plan-item-${e.status}`}
            >
              <span className="oc-acp-plan-bullet" aria-hidden>
                {e.status === "completed"
                  ? "✓"
                  : e.status === "in_progress"
                  ? "⋯"
                  : "○"}
              </span>
              <span className="oc-acp-plan-desc">{e.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// MessageView
// ──────────────────────────────────────────────────────────

type ApplyReceipt = {
  before: string | null;
  selector: string;
  property: string;
  after: string;
};

function MessageView({
  message,
  applyReceipts,
}: {
  message: AgentMessage;
  applyReceipts: Record<string, ApplyReceipt>;
}) {
  if (message.kind === "text") {
    // No role icon — Cursor-style "flat text for assistant, subtle
    // bubble for user" reads cleaner than twin avatar columns.
    const roleClass = `oc-acp-msg oc-acp-msg-${message.role}`;
    return (
      <div className={roleClass}>
        <div className="oc-acp-msg-content">{message.text}</div>
      </div>
    );
  }

  return (
    <ToolCallCard
      tool={message}
      receipt={applyReceipts[message.toolCallId] ?? null}
    />
  );
}

// ──────────────────────────────────────────────────────────
// Design-aware tool-card metadata
// ──────────────────────────────────────────────────────────
//
// The 5 design tools are exposed to the agent via the auto-attached
// Zeros MCP server (src/engine/index.ts registerMcpServer). Agents
// surface them through ACP ToolCall; their titles vary per agent — we
// match on substring to stay forgiving.
//
// This table is the ONLY place the chat UI hardcodes design-tool knowledge;
// the registry and protocol remain agent-agnostic.

export interface PermissionPrompt {
  /** Short sentence the designer reads first. */
  headline: string;
  /** Optional secondary body (multi-line, subtitle-style). */
  body?: string;
  /** When the tool will mutate state, a before→after pair we can render. */
  diff?: {
    before?: string;
    after: string;
  };
  /** Risk level — tints the bar. Reads are "low", writes are "high". */
  risk: "low" | "high";
}

type DesignToolEntry = {
  match: RegExp;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  summarize?: (input: unknown) => string | null;
  /** Designer-facing permission prompt. Null = use default handling. */
  describePermission?: (
    input: unknown,
    ctx: { currentValueForSelector: (sel: string, prop: string) => string | undefined },
  ) => PermissionPrompt | null;
};

const DESIGN_TOOLS: Array<DesignToolEntry> = [
  {
    match: /(^|_)get_selection$|get_selection\b/,
    icon: MousePointer2,
    label: "Read current selection",
    describePermission: () => ({
      headline: "Read your current canvas selection",
      body: "The agent will see the selector, tag, class list and computed styles. No changes.",
      risk: "low",
    }),
  },
  {
    match: /(^|_)list_tokens$|list_tokens\b/,
    icon: Palette,
    label: "Read design tokens",
    describePermission: () => ({
      headline: "Read all design tokens",
      body: "The agent will see every CSS custom property defined in your theme files.",
      risk: "low",
    }),
  },
  {
    match: /(^|_)get_element_styles$|get_element_styles\b/,
    icon: Target,
    label: "Inspect element",
    summarize: (input) => {
      const sel = (input as { selector?: string })?.selector;
      return sel ? sel : null;
    },
    describePermission: (input) => {
      const sel = (input as { selector?: string })?.selector;
      return {
        headline: sel
          ? `Inspect styles on ${sel}`
          : "Inspect an element's styles",
        body: "The agent will read the CSS source locations and computed rules. No changes.",
        risk: "low",
      };
    },
  },
  {
    match: /(^|_)read_design_state$|read_design_state\b/,
    icon: FileText,
    label: "Read design state",
    describePermission: () => ({
      headline: "Read the full design state",
      body: "The agent will see the contents of every .0c project file — variants, metadata, feedback. No changes.",
      risk: "low",
    }),
  },
  {
    match: /(^|_)get_feedback$|get_feedback\b/,
    icon: MessageSquare,
    label: "Read feedback",
    describePermission: () => ({
      headline: "Read pending feedback items",
      body: "The agent will see every feedback item still in the pending state. No changes.",
      risk: "low",
    }),
  },
  {
    match: /(^|_)apply_change$|apply_change\b/,
    icon: Zap,
    label: "Apply CSS change",
    summarize: (input) => {
      const obj = input as { selector?: string; property?: string; value?: string };
      if (!obj?.selector || !obj?.property) return null;
      return `${obj.selector} { ${obj.property}: ${obj.value ?? "…"} }`;
    },
    describePermission: (input, ctx) => {
      const obj = input as { selector?: string; property?: string; value?: string };
      if (!obj?.selector || !obj?.property) return null;
      const before = ctx.currentValueForSelector(obj.selector, obj.property);
      const after = obj.value ?? "";
      return {
        headline: `Apply CSS change to ${obj.selector}`,
        body: `Writes to the CSS source file for this selector. Hot-reloads the canvas on save.`,
        diff: { before, after: `${obj.property}: ${after};` },
        risk: "high",
      };
    },
  },
];

function matchDesignTool(title: string): DesignToolEntry | null {
  for (const entry of DESIGN_TOOLS) {
    if (entry.match.test(title)) return entry;
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Subagent detection (Phase 5)
// ──────────────────────────────────────────────────────────
//
// The ACP `SpawnAgentTool` call shows up in the stream as a regular
// ToolCall. claude-agent-sdk's built-in is "Task"; other agents name it
// differently. Match permissively by title or by rawInput having a
// subagent_type key.

const SUBAGENT_TITLE_PATTERN = /^(task|spawn_?agent|delegate|subagent)$/i;

export interface SubagentInfo {
  /** Which subagent role the parent agent is invoking, if declared. */
  subagentType?: string;
  /** One-line description of the job the parent handed off. */
  description?: string;
}

function matchSubagent(tool: AgentToolMessage): SubagentInfo | null {
  if (SUBAGENT_TITLE_PATTERN.test(tool.title)) {
    const input = tool.rawInput as
      | { subagent_type?: string; description?: string; prompt?: string }
      | undefined;
    return {
      subagentType: input?.subagent_type,
      description:
        input?.description ??
        (typeof input?.prompt === "string" ? input.prompt.slice(0, 160) : undefined),
    };
  }
  const input = tool.rawInput as
    | { subagent_type?: string; description?: string }
    | undefined;
  if (input && typeof input.subagent_type === "string") {
    return {
      subagentType: input.subagent_type,
      description: input.description,
    };
  }
  return null;
}

/**
 * Camel-case / style-object lookup of a CSS property on a workspace element
 * matched by its canonical selector. Used only for the before→after in the
 * apply_change permission prompt; failures return undefined.
 */
function lookupCurrentValue(
  elements: import("../store/store").ElementNode[],
  selector: string,
  property: string,
): string | undefined {
  const target = findBySelector(elements, selector);
  if (!target) return undefined;
  // Styles are stored camel-case on the workspace element; ACP tools pass
  // either form. Probe both.
  const camel = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return target.styles[property] ?? target.styles[camel];
}

function ToolCallCard({
  tool,
  receipt,
}: {
  tool: AgentToolMessage;
  receipt: ApplyReceipt | null;
}) {
  const design = matchDesignTool(tool.title);
  const subagent = !design ? matchSubagent(tool) : null;
  const Icon = design?.icon ?? (subagent ? GitBranch : Wrench);
  const label = design?.label
    ?? (subagent
      ? subagent.subagentType
        ? `Delegated to ${subagent.subagentType}`
        : "Subagent delegation"
      : tool.title);
  const summary =
    design?.summarize?.(tool.rawInput) ?? subagent?.description ?? null;
  // Persistent receipt only for apply_change that has both a captured before
  // snapshot and a completed or failed status — we don't clutter pending
  // cards with a diff that isn't final yet.
  const hasReceipt =
    !!receipt &&
    /apply_change/.test(tool.title) &&
    (tool.status === "completed" || tool.status === "failed");
  const sourcePath = tool.locations?.[0]?.path;
  const sourceLine = tool.locations?.[0]?.line;
  const cardClass = design
    ? "oc-acp-tool oc-acp-tool-design"
    : subagent
    ? "oc-acp-tool oc-acp-tool-subagent"
    : "oc-acp-tool";
  const vendorLabel = design
    ? "Zeros"
    : subagent
    ? "Subagent"
    : null;

  const statusIcon =
    tool.status === "completed" ? (
      <CheckCircle2
        className="w-3.5 h-3.5"
        style={{ color: "var(--text-success)" }}
      />
    ) : tool.status === "failed" ? (
      <XCircle
        className="w-3.5 h-3.5"
        style={{ color: "var(--text-critical)" }}
      />
    ) : tool.status === "in_progress" ? (
      <Loader2
        className="w-3.5 h-3.5 animate-spin"
        style={{ color: "var(--text-muted)" }}
      />
    ) : (
      <Clock
        className="w-3.5 h-3.5"
        style={{ color: "var(--text-placeholder)" }}
      />
    );

  return (
    <div className={cardClass}>
      <div className="oc-acp-tool-head">
        <Icon className="oc-acp-tool-icon w-3.5 h-3.5" />
        <div className="oc-acp-tool-body">
          <div className="oc-acp-tool-title">
            {label}
            {vendorLabel && (
              <span className="oc-acp-tool-vendor">{vendorLabel}</span>
            )}
          </div>
          {!hasReceipt && summary ? (
            <div className="oc-acp-tool-summary">{summary}</div>
          ) : !hasReceipt && tool.toolKind ? (
            <div className="oc-acp-tool-kind">{tool.toolKind}</div>
          ) : null}
        </div>
        <div className="oc-acp-tool-status">{statusIcon}</div>
      </div>
      {hasReceipt && receipt && (
        <ApplyChangeReceipt
          receipt={receipt}
          status={tool.status}
          sourcePath={sourcePath}
          sourceLine={sourceLine}
        />
      )}
      {!hasReceipt && tool.content && tool.content.length > 0 && (
        <div className="oc-acp-tool-content">
          <ToolContentView content={tool.content} />
        </div>
      )}
    </div>
  );
}

function ApplyChangeReceipt({
  receipt,
  status,
  sourcePath,
  sourceLine,
}: {
  receipt: ApplyReceipt;
  status: AgentToolMessage["status"];
  sourcePath?: string;
  sourceLine?: number | null;
}) {
  const failed = status === "failed";
  return (
    <div className="oc-acp-receipt">
      <div className="oc-acp-receipt-head">
        <span className="oc-acp-receipt-selector">{receipt.selector}</span>
        <span className="oc-acp-receipt-tag">
          {failed ? "not applied" : "updated"}
        </span>
      </div>
      <div className="oc-acp-receipt-diff">
        <div className="oc-acp-receipt-row oc-acp-receipt-row-before">
          <span className="oc-acp-receipt-sign">−</span>
          <span className="oc-acp-receipt-value">
            {receipt.before !== null && receipt.before !== "" ? (
              `${receipt.property}: ${receipt.before};`
            ) : (
              <span className="oc-acp-receipt-value-unset">(unset)</span>
            )}
          </span>
        </div>
        <div
          className={`oc-acp-receipt-row ${
            failed ? "oc-acp-receipt-row-failed" : "oc-acp-receipt-row-after"
          }`}
        >
          <span className="oc-acp-receipt-sign">+</span>
          <span className="oc-acp-receipt-value">
            {receipt.property}: {receipt.after};
          </span>
        </div>
      </div>
      {sourcePath && (
        <div className="oc-acp-receipt-source">
          {sourcePath}
          {sourceLine ? `:${sourceLine}` : ""}
        </div>
      )}
    </div>
  );
}

function ToolContentView({
  content,
}: {
  content: NonNullable<AgentToolMessage["content"]>;
}) {
  return (
    <div>
      {content.map((block, i) => {
        if (block.type === "content" && block.content.type === "text") {
          return <pre key={i}>{block.content.text}</pre>;
        }
        if (block.type === "diff") {
          return (
            <div key={i} className="oc-acp-tool-content-diff">
              <span className="oc-acp-mono">diff:</span>
              {block.path}
            </div>
          );
        }
        return (
          <div key={i} className="oc-acp-tool-content-diff">
            [{block.type} block]
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PermissionBar — renders the ACP permission options verbatim
// ──────────────────────────────────────────────────────────

function PermissionBar({
  request,
  workspaceElements,
  onRespond,
}: {
  request: RequestPermissionRequest;
  workspaceElements: import("../store/store").ElementNode[];
  onRespond: (outcome: RequestPermissionOutcome) => void;
}) {
  const rawTitle = request.toolCall.title ?? request.toolCall.kind ?? "Tool call";
  const matched = matchDesignTool(rawTitle);
  const prompt = matched?.describePermission?.(request.toolCall.rawInput, {
    currentValueForSelector: (sel, prop) =>
      lookupCurrentValue(workspaceElements, sel, prop),
  }) ?? null;

  const risk = prompt?.risk ?? "high";
  const barClass = `oc-acp-perm oc-acp-perm-${risk}`;
  const Icon = matched?.icon ?? AlertCircle;

  const headline =
    prompt?.headline ??
    `Agent wants to run: ${rawTitle}`;
  const body =
    prompt?.body ??
    "Review before allowing. Credentials and filesystem writes depend on your response.";

  return (
    <div className={barClass}>
      <div className="oc-acp-perm-head">
        <Icon className="oc-acp-perm-icon w-3.5 h-3.5" />
        <div className="min-w-0 flex-1">
          <div className="oc-acp-perm-title">{headline}</div>
          <div className="oc-acp-perm-body">{body}</div>
          {prompt?.diff && (
            <div className="oc-acp-perm-diff">
              {prompt.diff.before !== undefined && (
                <div className="oc-acp-receipt-row oc-acp-receipt-row-before">
                  <span className="oc-acp-receipt-sign">−</span>
                  <span className="oc-acp-receipt-value">
                    {prompt.diff.before || (
                      <span className="oc-acp-receipt-value-unset">(unset)</span>
                    )}
                  </span>
                </div>
              )}
              <div className="oc-acp-receipt-row oc-acp-receipt-row-after">
                <span className="oc-acp-receipt-sign">+</span>
                <span className="oc-acp-receipt-value">{prompt.diff.after}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="oc-acp-perm-actions">
        {request.options.map((opt) => {
          const variant =
            opt.kind === "allow_always" || opt.kind === "allow_once"
              ? "allow"
              : opt.kind === "reject_always" || opt.kind === "reject_once"
              ? "reject"
              : "neutral";
          return (
            <Button
              key={opt.optionId}
              variant="ghost"
              size="sm"
              type="button"
              onClick={() =>
                onRespond({ outcome: "selected", optionId: opt.optionId })
              }
              className={`oc-acp-perm-btn oc-acp-perm-btn-${variant}`}
            >
              {friendlyOptionLabel(opt.name, opt.kind)}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={() => onRespond({ outcome: "cancelled" })}
          className="oc-acp-perm-btn oc-acp-perm-btn-cancel"
        >
          Cancel turn
        </Button>
      </div>
    </div>
  );
}

/**
 * Agents produce option names with varying verbosity ("Allow once",
 * "reject_once", "Yes, always"). Normalise the most common variants to
 * a consistent two-word designer label without throwing away anything
 * that's already clearer than our default.
 */
function friendlyOptionLabel(name: string, kind: string | null | undefined): string {
  const trimmed = name.trim();
  // If the agent bothered to spell something out, keep it.
  if (trimmed.length > 0 && !/^allow_(once|always)$|^reject_(once|always)$/i.test(trimmed)) {
    return trimmed;
  }
  switch (kind) {
    case "allow_once":
      return "Allow once";
    case "allow_always":
      return "Always allow";
    case "reject_once":
      return "Block";
    case "reject_always":
      return "Always block";
    default:
      return trimmed || "OK";
  }
}
