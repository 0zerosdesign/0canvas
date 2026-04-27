// ──────────────────────────────────────────────────────────
// AgentChat — messages + tool cards + permission modal + composer
// ──────────────────────────────────────────────────────────
//
// The chat surface for an in-flight agent session. It's driven entirely
// by the state the useAgentSession hook exposes — this component does
// not store message state of its own, which keeps us honest about
// what the protocol says vs. what we invent.
//
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  Send,
  Square,
  ArrowLeft,
  Clock,
  AlertCircle,
  Palette,
  Layers,
} from "lucide-react";
import type {
  PlanEntry,
  RequestPermissionRequest,
  RequestPermissionOutcome,
} from "../bridge/agent-events";
import type {
  AgentSessionControls,
  AgentSessionState,
  AgentTextMessage,
} from "./use-agent-session";
import {
  MessageView,
  matchDesignTool,
  lookupCurrentValue,
  ErrorCard,
  type ApplyReceipt,
  type RendererContext,
} from "./renderers";
import { ActivityHUD } from "./activity-hud";
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
import { useAgentsSnapshot } from "./agents-cache";
import { FolderOpen } from "lucide-react";
import { Image as ImageIcon } from "lucide-react";
import type { BridgeRegistryAgent } from "../bridge/messages";
import { useStickyBottom, nextTextMessageTarget } from "./use-sticky-bottom";
import {
  TurnContainer,
  TurnPromptHeader,
  groupMessagesIntoTurns,
  turnKey,
} from "./turn-container";
import { JumpPills } from "./jump-pills";
import { useSessionsStore } from "./sessions-store";

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
  // Persistent receipts for apply_change tool calls. Keyed by toolCallId.
  // Captured at first observation of the tool (before the write lands) so
  // "before" still reflects the pre-change value when the card re-renders
  // in its completed state.
  const [applyReceipts, setApplyReceipts] = useState<
    Record<string, ApplyReceipt>
  >({});
  // Stable ctx object for MessageView memoization. Without useMemo, every
  // parent re-render hands a new ref to every message and the per-message
  // memo can never short-circuit.
  //
  // isStreaming + lastMessageId let in-flight-aware renderers (ThinkingBlock
  // shimmer, future activity HUD) detect "am I the active in-flight message"
  // without each renderer reaching back into session state.
  //
  // activeTurnStartedAt = createdAt of the last user message. Drives the
  // "am I in the current turn?" check so ThinkingBlock can persist its
  // shimmer for the whole turn rather than only the sub-second window
  // where the thought is literally the last message in the array.
  const lastMessageId =
    session.messages.length > 0
      ? session.messages[session.messages.length - 1].id
      : null;
  const activeTurnStartedAt = useMemo(() => {
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.kind === "text" && (m as AgentTextMessage).role === "user") {
        return m.createdAt;
      }
    }
    return 0;
  }, [session.messages]);
  // Stage 4.2 mergeKey collapse — for each mergeKey group, the latest
  // message renders as the primary card; predecessors get filtered out
  // of the timeline and surface as "+N more" history under the primary.
  // The store keeps every message; shadowing is purely render-time.
  const { visibleMessages, mergeSiblings } = useMemo(() => {
    const groups = new Map<string, import("./use-agent-session").AgentToolMessage[]>();
    for (const m of session.messages) {
      if (m.kind !== "tool") continue;
      const tool = m as import("./use-agent-session").AgentToolMessage;
      if (!tool.mergeKey) continue;
      const arr = groups.get(tool.mergeKey) ?? [];
      arr.push(tool);
      groups.set(tool.mergeKey, arr);
    }
    const shadowed = new Set<string>();
    const siblingsByPrimaryId = new Map<
      string,
      import("./use-agent-session").AgentToolMessage[]
    >();
    for (const arr of groups.values()) {
      if (arr.length < 2) continue;
      const primary = arr[arr.length - 1];
      siblingsByPrimaryId.set(primary.toolCallId, arr.slice(0, -1));
      for (let i = 0; i < arr.length - 1; i++) shadowed.add(arr[i].id);
    }
    const visible =
      shadowed.size === 0
        ? session.messages
        : session.messages.filter((m) => !shadowed.has(m.id));
    return { visibleMessages: visible, mergeSiblings: siblingsByPrimaryId };
  }, [session.messages]);
  const isStreaming = session.status === "streaming";
  // Stage 4.3 — QuestionCard's submit hook. Routes through
  // session.sendPrompt today (see RendererContext doc); same callsite
  // when adapters gain a native tool_result write-back path.
  const respondToQuestion = useCallback(
    (text: string) => {
      session.sendPrompt(text, text).catch(() => {
        /* error surfaces via session.error */
      });
    },
    [session],
  );
  const messageCtx: RendererContext = useMemo(
    () => ({
      applyReceipts,
      isStreaming,
      lastMessageId,
      activeTurnStartedAt,
      mergeSiblings,
      respondToQuestion,
    }),
    [
      applyReceipts,
      isStreaming,
      lastMessageId,
      activeTurnStartedAt,
      mergeSiblings,
      respondToQuestion,
    ],
  );
  // Scroll + active-prompt elements tracked via state so the
  // sticky-bottom hook + JumpPills re-run when they mount. Plain
  // useRef wouldn't trigger a re-render on .current changes.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [activePromptEl, setActivePromptEl] = useState<HTMLDivElement | null>(
    null,
  );
  // Imperative ref kept for legacy call sites that read scrollRef.current
  // (the keybind handler, follow-along effect). Mirrors `scrollEl`.
  const scrollRef = useRef<HTMLDivElement | null>(null);
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

  // Per-chat scroll memory (Phase 1 §2.5.8). The consumer owns
  // initial scroll position on mount: snap to bottom by default
  // (chat convention — "open chat, see latest"), OR restore the
  // saved position when the user is swapping back into a chat
  // they were reading mid-transcript. AgentChat is remounted per
  // chatId at the parent (column2-chat-view via key=chatId), so
  // a layout-effect on [scrollEl, chatId] runs once at mount and
  // never re-fires for the same chat.
  //
  // useLayoutEffect (not useEffect) so the initial position is set
  // before paint — no flicker from "render at scrollTop=0, then jump
  // to saved or bottom on next frame." The sticky-bottom hook below
  // explicitly skips its first content-run for the same reason.
  const setScrollPosition = useSessionsStore((s) => s.setScrollPosition);
  useLayoutEffect(() => {
    if (!scrollEl) return;
    if (chatId) {
      const saved = useSessionsStore.getState().scrollPositions[chatId];
      if (saved !== undefined && saved >= 0) {
        scrollEl.scrollTop = saved;
        return;
      }
    }
    // No saved position OR no chatId (picker/beta flows) → snap to
    // bottom so the user sees the latest message immediately.
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }, [scrollEl, chatId]);
  // Save on scroll — the store's identity-stable setter no-ops when
  // the value is unchanged. Scroll events are already throttled by
  // the browser; no extra rAF needed.
  useEffect(() => {
    if (!scrollEl || !chatId) return;
    const onScroll = () => setScrollPosition(chatId, scrollEl.scrollTop);
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl, chatId, setScrollPosition]);

  // Sticky-bottom auto-scroll with unstick-on-user-scroll. Replaces
  // the Phase 0 "snap to bottom on every change" reflex. See
  // use-sticky-bottom.ts for the rationale. The hook skips its first
  // content-run so the restore effect above takes precedence on mount.
  const { isAtBottom, jumpToBottom } = useStickyBottom(
    scrollEl,
    [session.messages, session.pendingPermission, session.status],
  );

  // Group flat message list into turns for the §2.5.1 per-turn
  // structure. Each turn = user prompt + subsequent events until
  // the next user prompt. Memoized so unrelated state changes
  // (composer typing, etc.) don't re-group.
  const turns = useMemo(
    () => groupMessagesIntoTurns(visibleMessages),
    [visibleMessages],
  );

  // Callback ref factory for the scroll container — sets both the
  // state-tracked element (for hooks that need re-render on mount)
  // and the legacy imperative ref (read by the keybind handler).
  const setScrollContainer = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollEl(node);
  }, []);

  // ⌘K — focus the composer from anywhere in the app. Cursor-style
  // shortcut; scoped to avoid clobbering ⌘K inside native inputs.
  // ⌘↑ / ⌘↓ — jump-by-text-message: walks user prompts and final
  // assistant text, skipping tool-call + thinking chunks. Solves the
  // "where did I ask?" problem during long Claude runs (roadmap §2.5.7).
  // ⌘Home / ⌘End — first/last message. All gated on the textarea
  // not being focused so plain typing keeps native behavior.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;

      // ⌘K is composer-focus; allowed even when in an input
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      // Skip jump-by-message bindings while typing — preserves
      // native cursor/selection behavior in the textarea.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;

      const el = scrollRef.current;
      if (!el) return;

      if (e.key === "ArrowUp") {
        const top = nextTextMessageTarget(el, { direction: "up" });
        if (top !== null) {
          e.preventDefault();
          el.scrollTo({ top, behavior: "smooth" });
        }
        return;
      }
      if (e.key === "ArrowDown") {
        const top = nextTextMessageTarget(el, { direction: "down" });
        if (top !== null) {
          e.preventDefault();
          el.scrollTo({ top, behavior: "smooth" });
        }
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        el.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        return;
      }
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

  // Attachments for the next prompt — image ContentBlocks queued by
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
  // composer all funnel AI requests through the agent chat now. When the
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
   *  prefix — the wire image block wants the raw base64 + a separate
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
    <div className="oc-agent-surface">
      <header className="oc-agent-subheader">
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
          <div className="oc-agent-subheader-title">
            {chatThread?.title ?? session.agentName ?? session.agentId ?? "Agent"}
          </div>
          <div className="oc-agent-subheader-sub">
            {session.agentName && (
              <span className="oc-agent-subheader-agent">{session.agentName}</span>
            )}
            <span className="oc-agent-subheader-status">
              {session.status === "streaming"
                ? "streaming…"
                : session.lastStopReason
                ? session.lastStopReason
                : session.status === "auth-required"
                ? "sign in required"
                : ""}
            </span>
          </div>
        </div>
        {headerActions}
      </header>

      {session.status === "failed" && session.error && (
        <ErrorCard
          error={session.error}
          failure={session.failure}
          onReset={() => session.reset()}
        />
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

      <div ref={setScrollContainer} className="oc-agent-body" style={{ position: "relative" }}>
        <div className="oc-agent-messages">
          {/* Warming/reconnecting state is now surfaced by the compact
              chip in the composer's pill row — keep the message area
              empty so the user can still see the transcript area. */}
          {session.messages.length === 0 &&
            session.status === "ready" &&
            !session.error &&
            !queuedPreview && (
              <div className="oc-agent-empty-muted">
                Session ready. Ask the agent anything.
              </div>
            )}
          {turns.map((turn, i) => {
            const isActive = i === turns.length - 1;
            return (
              <TurnContainer key={turnKey(turn)} turn={turn} isActive={isActive}>
                {turn.userPrompt && (
                  <TurnPromptHeader sticky={isActive}>
                    <div ref={isActive ? setActivePromptEl : null}>
                      <MessageView
                        message={turn.userPrompt}
                        ctx={messageCtx}
                      />
                    </div>
                  </TurnPromptHeader>
                )}
                {turn.events.map((m) => (
                  <MessageView key={m.id} message={m} ctx={messageCtx} />
                ))}
              </TurnContainer>
            );
          })}
          {queuedPreview && (
            <div className="oc-agent-msg oc-agent-msg-user oc-agent-msg-queued">
              <div className="oc-agent-msg-content">
                {queuedPreview}
                <div className="oc-agent-msg-queued-hint">
                  <Clock className="w-3 h-3" /> queued — sending when the session connects
                </div>
              </div>
            </div>
          )}
        </div>
        <JumpPills
          scrollEl={scrollEl}
          promptEl={activePromptEl}
          isAtBottom={isAtBottom}
          jumpToBottom={jumpToBottom}
        />
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

      <ActivityHUD
        messages={session.messages}
        isStreaming={session.status === "streaming"}
      />

      <div className="oc-agent-composer">
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
          <div className="oc-agent-attachments" role="list">
            {attachments.map((a) => (
              <div key={a.id} className="oc-agent-attachment" role="listitem">
                <Palette className="w-3 h-3" />
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
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="oc-agent-composer-card">
          {/* The "Connecting to {agent}…" overlay was an legacy
              reassurance for the ~10s handshake. Native adapters
              spawn in <500ms — surfacing the state in the textarea
              just covers the placeholder and nothing else. The
              ComposerStateChip in the footer still handles
              actionable states (auth-required / failed). */}
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
            className="oc-agent-composer-input"
          />
          <div className="oc-agent-composer-toolbar">
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
            <div className="oc-agent-toolbar-spacer" />
            {session.status === "streaming" ? (
              // Explicit "Stop" label rather than icon-only — the
              // square-icon-on-blue version was being missed during
              // long runs (users typed "stop" into the composer
              // thinking they had to message the agent to halt it).
              // Labeled + destructive variant + sized like a real
              // primary action so it reads as the obvious affordance.
              <Button
                variant="destructive"
                size="sm"
                type="button"
                onClick={() => session.cancel()}
                title="Stop the agent (cancel this turn)"
              >
                <Square className="w-3 h-3" />
                <span style={{ marginLeft: 6 }}>Stop</span>
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
          <div className="oc-agent-composer-footer">
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
                className="oc-agent-chat-workspace"
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
            <div className="oc-agent-toolbar-spacer" />
            <ContextPill usage={session.usage} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Design-audits pill — collapsed quick-launch for a11y/token audits

// ──────────────────────────────────────────────────────────
// PlanPanel — collapsible todo list from agent `plan` notifications
// ──────────────────────────────────────────────────────────

function PlanPanel({ entries }: { entries: PlanEntry[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const done = entries.filter((e) => e.status === "completed").length;
  return (
    <div className="oc-agent-plan">
      <button
        type="button"
        className="oc-agent-plan-head"
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="oc-agent-plan-title">Plan</span>
        <span className="oc-agent-plan-count">
          {done}/{entries.length}
        </span>
      </button>
      {!collapsed && (
        <ul className="oc-agent-plan-list">
          {entries.map((e, i) => (
            <li
              key={i}
              className={`oc-agent-plan-item oc-agent-plan-item-${e.status}`}
            >
              <span className="oc-agent-plan-bullet" aria-hidden>
                {e.status === "completed"
                  ? "✓"
                  : e.status === "in_progress"
                  ? "⋯"
                  : "○"}
              </span>
              <span className="oc-agent-plan-desc">{e.content}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// PermissionBar — renders the permission options verbatim
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
  const barClass = `oc-agent-perm oc-agent-perm-${risk}`;
  const Icon = matched?.icon ?? AlertCircle;

  const headline =
    prompt?.headline ??
    `Agent wants to run: ${rawTitle}`;
  const body =
    prompt?.body ??
    "Review before allowing. Credentials and filesystem writes depend on your response.";

  return (
    <div className={barClass}>
      <div className="oc-agent-perm-head">
        <Icon className="oc-agent-perm-icon w-3.5 h-3.5" />
        <div className="min-w-0 flex-1">
          <div className="oc-agent-perm-title">{headline}</div>
          <div className="oc-agent-perm-body">{body}</div>
          {prompt?.diff && (
            <div className="oc-agent-perm-diff">
              {prompt.diff.before !== undefined && (
                <div className="oc-agent-receipt-row oc-agent-receipt-row-before">
                  <span className="oc-agent-receipt-sign">−</span>
                  <span className="oc-agent-receipt-value">
                    {prompt.diff.before || (
                      <span className="oc-agent-receipt-value-unset">(unset)</span>
                    )}
                  </span>
                </div>
              )}
              <div className="oc-agent-receipt-row oc-agent-receipt-row-after">
                <span className="oc-agent-receipt-sign">+</span>
                <span className="oc-agent-receipt-value">{prompt.diff.after}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="oc-agent-perm-actions">
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
              className={`oc-agent-perm-btn oc-agent-perm-btn-${variant}`}
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
          className="oc-agent-perm-btn oc-agent-perm-btn-cancel"
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
