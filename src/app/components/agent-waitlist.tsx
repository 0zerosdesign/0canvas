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
import { useWorkspace, FeedbackItem, WSLogEntry } from "../store";
import { copyToClipboard } from "./clipboard";

const MCP_PORT = 24192;

const INTENT_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  fix: { icon: <Bug style={{ width: 10, height: 10 }} />, color: "#ff4444" },
  change: { icon: <Pencil style={{ width: 10, height: 10 }} />, color: "#ff9500" },
  question: { icon: <HelpCircle style={{ width: 10, height: 10 }} />, color: "#0070f3" },
  approve: { icon: <ThumbsUp style={{ width: 10, height: 10 }} />, color: "#50e3c2" },
};

const SEVERITY_COLORS: Record<string, string> = {
  blocking: "#ff4444",
  important: "#ff9500",
  suggestion: "#0070f3",
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
        lines.push(`# DesignDead Feedback — Variant: "${variant.name}" (${items.length} items)`);
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
        lines.push(`# DesignDead Feedback — Main App (${items.length} items)`);
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
      const res = await fetch(`http://127.0.0.1:${port}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) {
        bridgeSuccess = true;
        const entry: WSLogEntry = {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          direction: "sent",
          method: "feedback",
          summary: `Sent ${items.length} feedback items to MCP bridge`,
        };
        dispatch({ type: "WS_LOG", entry });
      }
    } catch { /* bridge not running */ }

    copyToClipboard(md);

    dispatch({ type: "MARK_FEEDBACK_SENT", ids });
    setSelectedIds(new Set());

    setSendStatus(bridgeSuccess ? "sent-bridge" : "sent-clipboard");
    setTimeout(() => setSendStatus("idle"), 4000);
  }, [selectedIds, pendingItems, state.wsPort, generateBatchMarkdown, dispatch]);

  if (!state.waitlistOpen) return null;

  return (
    <div
      data-designdead="agent-waitlist"
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        fontFamily: "'Geist Sans', 'Inter', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          background: "#0a0a0a",
          borderTop: "1px solid #1a1a1a",
          maxHeight: expanded ? 340 : 36,
          transition: "max-height 0.2s ease",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 12px",
            height: 36,
            flexShrink: 0,
            cursor: "pointer",
            borderBottom: expanded ? "1px solid #1a1a1a" : "none",
          }}
          onClick={() => setExpanded((e) => !e)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#ededed", fontWeight: 500 }}>
              Waitlist {activeVariantId !== "main" ? `— ${state.variants.find(v => v.id === activeVariantId)?.name || "Variant"}` : "— Main App"}
            </span>
            {pendingItems.length > 0 && (
              <span
                style={{
                  background: "#0070f3",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "0 6px",
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                {pendingItems.length}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {expanded && pendingItems.length > 0 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                  style={toolBtnStyle}
                  title={selectedIds.size === pendingItems.length ? "Deselect all" : "Select all"}
                >
                  {selectedIds.size === pendingItems.length
                    ? <CheckSquare style={{ width: 12, height: 12 }} />
                    : <Square style={{ width: 12, height: 12 }} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                  style={toolBtnStyle}
                  title="Copy for agent"
                >
                  {copied
                    ? <Check style={{ width: 12, height: 12, color: "#50e3c2" }} />
                    : <Copy style={{ width: 12, height: 12 }} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleSend(); }}
                  disabled={sendStatus === "sending"}
                  style={{
                    ...toolBtnStyle,
                    background: sendStatus === "sending" ? "#333" : "#0070f3",
                    color: "#fff",
                    borderColor: sendStatus === "sending" ? "#333" : "#0070f3",
                    cursor: sendStatus === "sending" ? "wait" : "pointer",
                  }}
                  title="Send to agent (copies to clipboard + pushes to MCP bridge)"
                >
                  <Send style={{ width: 11, height: 11 }} />
                  <span style={{ fontSize: 10 }}>{sendStatus === "sending" ? "Sending..." : "Send"}</span>
                </button>
              </>
            )}
            {expanded
              ? <ChevronDown style={{ width: 14, height: 14, color: "#666" }} />
              : <ChevronUp style={{ width: 14, height: 14, color: "#666" }} />}
          </div>
        </div>

        {/* Send status toast */}
        {sendStatus === "sent-bridge" && (
          <div style={{ padding: "8px 12px", background: "#50e3c2" + "15", borderBottom: "1px solid #50e3c2" + "30", display: "flex", alignItems: "center", gap: 8 }}>
            <Wifi style={{ width: 12, height: 12, color: "#50e3c2", flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#50e3c2" }}>
              Sent to MCP bridge &amp; copied to clipboard. Your AI agent can now pick it up.
            </span>
          </div>
        )}
        {sendStatus === "sent-clipboard" && (
          <div style={{ padding: "8px 12px", background: "#ff9500" + "15", borderBottom: "1px solid #ff9500" + "30", display: "flex", alignItems: "center", gap: 8 }}>
            <Clipboard style={{ width: 12, height: 12, color: "#ff9500", flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: "#ff9500" }}>
              Copied to clipboard! Paste in Cursor chat. For auto-sync, run: <code style={{ fontFamily: "'SF Mono',monospace", background: "#222", padding: "1px 4px", borderRadius: 3 }}>npx @zerosdesign/design-dead mcp</code>
            </span>
          </div>
        )}

        {/* Items list */}
        {expanded && (
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
            {pendingItems.length === 0 ? (
              <div style={{ padding: "24px 16px", textAlign: "center", color: "#444", fontSize: 11 }}>
                No feedback yet. Inspect an element and add feedback to build your waitlist.
              </div>
            ) : (
              Array.from(grouped.entries()).map(([selector, items]) => (
                <div key={selector} style={{ marginBottom: 2 }}>
                  <div style={{ padding: "4px 12px", fontSize: 9, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em" }}>
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
  const intentCfg = INTENT_CONFIG[item.intent] || INTENT_CONFIG.fix;
  const sevColor = SEVERITY_COLORS[item.severity] || "#888";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "6px 12px",
        background: selected ? "#0070f3" + "08" : "transparent",
        borderLeft: `2px solid ${selected ? "#0070f3" : "transparent"}`,
        transition: "background 0.1s",
      }}
    >
      <button
        onClick={onToggle}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 2, color: selected ? "#0070f3" : "#444", flexShrink: 0 }}
      >
        {selected
          ? <CheckSquare style={{ width: 13, height: 13 }} />
          : <Square style={{ width: 13, height: 13 }} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              padding: "1px 6px",
              borderRadius: 4,
              background: intentCfg.color + "18",
              color: intentCfg.color,
              fontSize: 9,
              fontWeight: 500,
            }}
          >
            {intentCfg.icon}
            {item.intent}
          </span>
          <span
            style={{
              padding: "1px 5px",
              borderRadius: 4,
              background: sevColor + "18",
              color: sevColor,
              fontSize: 9,
            }}
          >
            {item.severity}
          </span>
        </div>
        <p style={{ color: "#ccc", fontSize: 11, lineHeight: "1.4", margin: 0, wordBreak: "break-word" }}>
          {item.comment}
        </p>
      </div>

      <button
        onClick={onDelete}
        style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "#444", flexShrink: 0, marginTop: 2 }}
        title="Remove"
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

const toolBtnStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  padding: "3px 8px",
  borderRadius: 5,
  border: "1px solid #1a1a1a",
  background: "#111",
  color: "#888",
  cursor: "pointer",
  fontSize: 10,
  fontFamily: "inherit",
};
