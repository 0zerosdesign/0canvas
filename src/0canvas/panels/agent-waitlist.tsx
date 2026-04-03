// ──────────────────────────────────────────────────────────
// Agent Waitlist — Bottom drawer showing queued feedback
// ──────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Copy,
  Check,
  Send,
  CheckSquare,
  Square,
  Bug,
  Pencil,
  HelpCircle,
  ThumbsUp,
  X,
  Clipboard,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useWorkspace, FeedbackItem, WSLogEntry } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";

const MCP_PORT = 24192;

/** Semantic status colors using design-token hex values */
const INTENT_COLOR: Record<string, string> = {
  fix: "#EF4444",
  change: "#F59E0B",
  question: "#2563EB",
  approve: "#10B981",
};

const INTENT_ICON: Record<string, React.ReactNode> = {
  fix: <Bug style={{ width: 10, height: 10 }} />,
  change: <Pencil style={{ width: 10, height: 10 }} />,
  question: <HelpCircle style={{ width: 10, height: 10 }} />,
  approve: <ThumbsUp style={{ width: 10, height: 10 }} />,
};

const SEVERITY_COLOR: Record<string, string> = {
  blocking: "#EF4444",
  important: "#F59E0B",
  suggestion: "#2563EB",
};

export function AgentWaitlist() {
  const { state, dispatch } = useWorkspace();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent-bridge" | "sent-clipboard">("idle");

  const activeVariantId = state.activeVariantId || "main";

  const pendingItems = useMemo(
    () => state.feedbackItems.filter((f) => f.status === "pending" && f.variantId === activeVariantId),
    [state.feedbackItems, activeVariantId]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, FeedbackItem[]>();
    for (const item of pendingItems) {
      const key = item.elementSelector;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [pendingItems]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map((f) => f.id)));
    }
  };

  const generateBatchMarkdown = useCallback(
    (items: FeedbackItem[]): string => {
      const isVariant = activeVariantId !== "main";
      const variant = isVariant ? state.variants.find((v) => v.id === activeVariantId) : null;
      const lines: string[] = [];

      if (isVariant && variant) {
        lines.push(`# ZeroCanvas Feedback — Variant: "${variant.name}" (${items.length} items)`);
        lines.push("");
        lines.push("## IMPORTANT: This feedback is for a VARIANT (sandbox copy), NOT the main application.");
        lines.push("Do NOT modify the main app source code. Apply these changes to the variant HTML/CSS below.");
        lines.push("");
        lines.push(`- **Variant ID:** ${variant.id}`);
        lines.push(`- **Source type:** ${variant.sourceType}`);
        if (variant.sourceSelector) lines.push(`- **Forked from:** \`${variant.sourceSelector}\``);
        if (variant.sourcePageRoute) lines.push(`- **Source route:** ${variant.sourcePageRoute}`);
        lines.push("");
        lines.push("### Current Variant HTML");
        lines.push("```html");
        const html = variant.modifiedHtml || variant.html;
        lines.push(html.length > 8000 ? html.slice(0, 8000) + "\n<!-- truncated -->" : html);
        lines.push("```");
        if (variant.css) {
          lines.push("");
          lines.push("### Current Variant CSS");
          lines.push("```css");
          const css = variant.modifiedCss || variant.css;
          lines.push(css.length > 4000 ? css.slice(0, 4000) + "\n/* truncated */" : css);
          lines.push("```");
        }
        lines.push("");
      } else {
        lines.push(`# ZeroCanvas Feedback — Main App (${items.length} items)`);
        lines.push("");
        lines.push("This feedback is for the main application. Modify the source code directly.");
        lines.push("");
      }

      lines.push("## Feedback Items");
      lines.push("");

      items.forEach((item, i) => {
        const intentLabel = item.intent.toUpperCase();
        const sevLabel = item.severity.toUpperCase();
        lines.push(`### ${i + 1}. ${item.elementSelector} [${intentLabel} - ${sevLabel}]`);
        lines.push(`- **Selector:** \`${item.elementSelector}\``);
        lines.push(`- **Tag:** ${item.elementTag} | **Classes:** ${item.elementClasses.join(", ") || "(none)"}`);
        if (item.computedStyles) {
          const styleStr = Object.entries(item.computedStyles)
            .slice(0, 8)
            .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
            .join("; ");
          if (styleStr) lines.push(`- **Computed:** ${styleStr}`);
        }
        lines.push(`- **Feedback:** ${item.comment}`);
        lines.push("");
      });

      if (isVariant) {
        lines.push("## Instructions");
        lines.push("Please output the modified HTML and CSS for this variant based on the feedback above.");
        lines.push("");
        lines.push(`**CRITICAL - When calling 0canvas_push_changes, you MUST use this exact variantId:** \`${variant!.id}\``);
        lines.push("(Do NOT use the variant name. Use the ID above exactly.)");
        lines.push("");
        lines.push("**The MCP Flow (Automatic):** If you have the MCP server running (`npx @zerosdesign/0canvas mcp`), call the `0canvas_push_changes` tool with variantId, html, and css. The ZeroCanvas UI will update the variant preview within 2 seconds.");
        lines.push("");
        lines.push("Do NOT change the main application source files.");
      }

      return lines.join("\n");
    },
    [activeVariantId, state.variants]
  );

  const handleCopy = useCallback(() => {
    const items =
      selectedIds.size > 0
        ? pendingItems.filter((f) => selectedIds.has(f.id))
        : pendingItems;
    const md = generateBatchMarkdown(items);
    copyToClipboard(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [selectedIds, pendingItems, generateBatchMarkdown]);

  const handleSend = useCallback(async () => {
    const items =
      selectedIds.size > 0
        ? pendingItems.filter((f) => selectedIds.has(f.id))
        : pendingItems;

    if (items.length === 0) return;
    setSendStatus("sending");

    const md = generateBatchMarkdown(items);
    const ids = items.map((f) => f.id);
    let bridgeSuccess = false;

    const port = state.wsPort || MCP_PORT;
    try {
      const [feedbackRes] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/api/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
          signal: AbortSignal.timeout(3000),
        }),
        fetch(`http://127.0.0.1:${port}/api/variants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variants: state.variants }),
          signal: AbortSignal.timeout(2000),
        }),
        fetch(`http://127.0.0.1:${port}/api/project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project: state.ocProject }),
          signal: AbortSignal.timeout(2000),
        }),
      ]);
      if (feedbackRes.ok) {
        bridgeSuccess = true;
        const entry: WSLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          direction: "sent",
          method: "feedback",
          summary: `Sent ${items.length} feedback items, ${state.variants.length} variants to MCP bridge`,
        };
        dispatch({ type: "WS_LOG", entry });
      }
    } catch { /* bridge not running */ }

    copyToClipboard(md);

    dispatch({ type: "MARK_FEEDBACK_SENT", ids });
    setSelectedIds(new Set());

    setSendStatus(bridgeSuccess ? "sent-bridge" : "sent-clipboard");
    setTimeout(() => setSendStatus("idle"), 4000);
  }, [selectedIds, pendingItems, state.wsPort, state.variants, state.ocProject, generateBatchMarkdown, dispatch]);

  if (!state.waitlistOpen) return null;

  return (
    <div data-0canvas="agent-waitlist" className="oc-waitlist">
      <div
        className={`oc-waitlist-inner${expanded ? "" : " is-collapsed"}`}
        style={{ maxHeight: expanded ? 340 : undefined }}
      >
        {/* Header bar */}
        <div
          className={`oc-waitlist-header${expanded ? " is-expanded" : ""}`}
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="oc-waitlist-header-left">
            <span className="oc-waitlist-title">
              Waitlist {activeVariantId !== "main" ? `— ${state.variants.find(v => v.id === activeVariantId)?.name || "Variant"}` : "— Main App"}
            </span>
            {pendingItems.length > 0 && (
              <span className="oc-waitlist-badge">
                {pendingItems.length}
              </span>
            )}
          </div>
          <div className="oc-waitlist-header-right">
            {expanded && pendingItems.length > 0 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                  className="oc-waitlist-btn"
                  title={selectedIds.size === pendingItems.length ? "Deselect all" : "Select all"}
                >
                  {selectedIds.size === pendingItems.length
                    ? <CheckSquare style={{ width: 12, height: 12 }} />
                    : <Square style={{ width: 12, height: 12 }} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                  className="oc-waitlist-btn"
                  title="Copy for agent"
                >
                  {copied
                    ? <Check style={{ width: 12, height: 12, color: "#10B981" }} />
                    : <Copy style={{ width: 12, height: 12 }} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  disabled={sendStatus === "sending"}
                  className={`oc-waitlist-btn${sendStatus === "sending" ? " is-sending" : " is-send"}`}
                  title="Send to agent (copies to clipboard + pushes to MCP bridge)"
                >
                  <Send style={{ width: 11, height: 11 }} />
                  <span>{sendStatus === "sending" ? "Sending..." : "Send"}</span>
                </button>
              </>
            )}
            {expanded
              ? <ChevronDown className="oc-waitlist-chevron" style={{ width: 14, height: 14 }} />
              : <ChevronUp className="oc-waitlist-chevron" style={{ width: 14, height: 14 }} />}
          </div>
        </div>

        {/* Send status toast */}
        {sendStatus === "sent-bridge" && (
          <div className="oc-waitlist-toast is-bridge">
            <Wifi style={{ width: 12, height: 12, color: "#10B981", flexShrink: 0 }} />
            <span className="oc-waitlist-toast-text" style={{ color: "#10B981" }}>
              Sent to MCP bridge &amp; copied to clipboard. Your AI agent can now pick it up.
            </span>
          </div>
        )}
        {sendStatus === "sent-clipboard" && (
          <div className="oc-waitlist-toast is-clipboard">
            <Clipboard style={{ width: 12, height: 12, color: "#F59E0B", flexShrink: 0 }} />
            <span className="oc-waitlist-toast-text" style={{ color: "#F59E0B" }}>
              Copied to clipboard! Paste in Cursor chat. For auto-sync, run: <code className="oc-waitlist-toast-code">npx @zerosdesign/0canvas mcp</code>
            </span>
          </div>
        )}

        {/* Items list */}
        {expanded && (
          <div className="oc-waitlist-list">
            {pendingItems.length === 0 ? (
              <div className="oc-waitlist-empty">
                No feedback yet. Inspect an element and add feedback to build your waitlist.
              </div>
            ) : (
              Array.from(grouped.entries()).map(([selector, items]) => (
                <div key={selector} className="oc-waitlist-group">
                  <div className="oc-waitlist-group-label">
                    {selector}
                  </div>
                  {items.map((item) => (
                    <FeedbackRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.has(item.id)}
                      onToggle={() => toggleSelect(item.id)}
                      onDelete={() => dispatch({ type: "REMOVE_FEEDBACK", id: item.id })}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedbackRow({
  item,
  selected,
  onToggle,
  onDelete,
}: {
  item: FeedbackItem;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const intentColor = INTENT_COLOR[item.intent] || INTENT_COLOR.fix;
  const intentIcon = INTENT_ICON[item.intent] || INTENT_ICON.fix;
  const sevColor = SEVERITY_COLOR[item.severity] || "#888";

  return (
    <div className={`oc-waitlist-item${selected ? " is-selected" : ""}`}>
      <button
        onClick={onToggle}
        className={`oc-waitlist-item-check${selected ? " is-selected" : ""}`}
      >
        {selected
          ? <CheckSquare style={{ width: 13, height: 13 }} />
          : <Square style={{ width: 13, height: 13 }} />}
      </button>

      <div className="oc-waitlist-item-body">
        <div className="oc-waitlist-item-meta">
          <span
            className="oc-waitlist-intent"
            style={{ background: intentColor + "18", color: intentColor }}
          >
            {intentIcon}
            {item.intent}
          </span>
          <span
            className="oc-waitlist-severity"
            style={{ background: sevColor + "18", color: sevColor }}
          >
            {item.severity}
          </span>
        </div>
        <p className="oc-waitlist-comment">
          {item.comment}
        </p>
      </div>

      <button
        onClick={onDelete}
        className="oc-waitlist-item-delete"
        title="Remove"
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}
