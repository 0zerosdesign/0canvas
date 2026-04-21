// ──────────────────────────────────────────────────────────
// AcpChat — messages + tool cards + permission modal + composer
// ──────────────────────────────────────────────────────────
//
// The chat surface for an in-flight ACP session. It's driven entirely
// by the state the useAcpSession hook exposes — this component does
// not store message state of its own, which keeps us honest about
// what the protocol says vs. what we invent.
//
// ──────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace, findBySelector } from "../store/store";
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
  Bot,
  User as UserIcon,
  Loader2,
  Send,
  Square,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Wrench,
  Brain,
  AlertCircle,
  Info,
  Palette,
  Target,
  FileText,
  MessageSquare,
  Zap,
  MousePointer2,
} from "lucide-react";
import type {
  RequestPermissionRequest,
  RequestPermissionOutcome,
} from "@agentclientprotocol/sdk";
import type {
  AcpMessage,
  AcpSessionControls,
  AcpSessionState,
  AcpToolMessage,
} from "./use-acp-session";
import { Button, Textarea } from "../ui";

interface AcpChatProps {
  session: AcpSessionState & AcpSessionControls;
  onBack: () => void;
}

export function AcpChat({ session, onBack }: AcpChatProps) {
  const [input, setInput] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionHighlight, setMentionHighlight] = useState(0);
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
  const followedToolsRef = useRef<Set<string>>(new Set());

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

  const canSend =
    session.status === "ready" &&
    !session.pendingPermission &&
    input.trim().length > 0;

  const handleSend = () => {
    if (!canSend) return;
    const displayText = input.trim();
    const wireText = expandMentionsInText(displayText, workspaceState);
    setInput("");
    session.sendPrompt(wireText, displayText).catch(() => {
      /* error surfaces via session.error */
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={onBack}
          title="Back to agents"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <Bot
          className="w-3.5 h-3.5 flex-shrink-0"
          style={{ color: "var(--text-primary-light)" }}
        />
        <div className="min-w-0 flex-1">
          <div className="oc-acp-subheader-title">
            {session.agentName ?? session.agentId ?? "ACP"}
          </div>
          <div className="oc-acp-subheader-sub">
            {session.sessionId
              ? `session ${session.sessionId.slice(0, 8)}…`
              : "no session"}
            {session.status === "streaming" && " · streaming"}
            {session.lastStopReason && session.status !== "streaming"
              ? ` · ${session.lastStopReason}`
              : ""}
          </div>
        </div>
      </header>

      {session.error && (
        <div className="oc-acp-error">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <div className="min-w-0">
            <div className="oc-acp-error-title">Error</div>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {session.error}
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="oc-acp-body">
        <div className="oc-acp-messages">
          {session.status === "starting" && (
            <div className="oc-acp-empty-muted">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Starting session with {session.agentName ?? session.agentId}...
            </div>
          )}
          {session.messages.length === 0 &&
            session.status === "ready" &&
            !session.error && (
              <div className="oc-acp-empty-muted">
                Session ready. Ask the agent anything.
              </div>
            )}
          {session.messages.map((m) => (
            <MessageView key={m.id} message={m} applyReceipts={applyReceipts} />
          ))}
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
        <div className="oc-acp-composer-row">
          {pickerOpen && (
            <MentionPicker
              items={filteredMentions}
              highlightIndex={mentionHighlight}
              onHover={setMentionHighlight}
              onPick={insertMention}
            />
          )}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onKeyUp={handleCaretSync}
            onClick={handleCaretSync}
            onSelect={handleCaretSync}
            rows={2}
            placeholder={
              session.status === "ready"
                ? "Message the agent... @ for tokens, variants, feedback"
                : session.status === "streaming"
                ? "Agent is responding..."
                : session.status === "starting"
                ? "Starting session..."
                : "Waiting for session..."
            }
            className="oc-acp-input"
            disabled={session.status === "starting"}
          />
          {session.status === "streaming" ? (
            <Button
              variant="destructive"
              size="sm"
              type="button"
              onClick={() => session.cancel()}
              className="oc-acp-stop-btn"
              title="Cancel current turn"
            >
              <Square className="w-3 h-3" /> Stop
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className="oc-acp-send-btn"
              title="Send (Enter)"
            >
              <Send className="w-3 h-3" /> Send
            </Button>
          )}
        </div>
        <div className="oc-acp-composer-hint">
          <Info className="w-3 h-3" />
          Credentials stay with the agent CLI. 0canvas never touches your tokens.
        </div>
      </div>
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
  message: AcpMessage;
  applyReceipts: Record<string, ApplyReceipt>;
}) {
  if (message.kind === "text") {
    const Icon =
      message.role === "user"
        ? UserIcon
        : message.role === "thought"
        ? Brain
        : Bot;
    const roleClass = `oc-acp-msg oc-acp-msg-${message.role}`;

    return (
      <div className={roleClass}>
        <div className="oc-acp-msg-icon">
          <Icon className="w-3.5 h-3.5" />
        </div>
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
// 0canvas MCP server (src/engine/index.ts registerMcpServer). Agents
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
  tool: AcpToolMessage;
  receipt: ApplyReceipt | null;
}) {
  const design = matchDesignTool(tool.title);
  const Icon = design?.icon ?? Wrench;
  const label = design?.label ?? tool.title;
  const summary = design?.summarize?.(tool.rawInput) ?? null;
  // Persistent receipt only for apply_change that has both a captured before
  // snapshot and a completed or failed status — we don't clutter pending
  // cards with a diff that isn't final yet.
  const hasReceipt =
    !!receipt &&
    /apply_change/.test(tool.title) &&
    (tool.status === "completed" || tool.status === "failed");
  const sourcePath = tool.locations?.[0]?.path;
  const sourceLine = tool.locations?.[0]?.line;

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
        style={{ color: "var(--text-hint)" }}
      />
    );

  return (
    <div className={`oc-acp-tool ${design ? "oc-acp-tool-design" : ""}`}>
      <div className="oc-acp-tool-head">
        <Icon className="oc-acp-tool-icon w-3.5 h-3.5" />
        <div className="oc-acp-tool-body">
          <div className="oc-acp-tool-title">
            {label}
            {design && <span className="oc-acp-tool-vendor">0canvas</span>}
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
  status: AcpToolMessage["status"];
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
  content: NonNullable<AcpToolMessage["content"]>;
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
