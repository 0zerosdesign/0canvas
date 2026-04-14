// ──────────────────────────────────────────────────────────
// AI Chat Panel — Variant-aware AI design agent
// ──────────────────────────────────────────────────────────
//
// Sends the FULL variant HTML + CSS to the AI.
// AI rewrites the HTML/CSS → variant updates live in iframe.
// Designer fine-tunes with style editor.
//
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, Square, Check, AlertCircle, Undo2, ArrowRight, X } from "lucide-react";
import { useWorkspace, findElement } from "../store/store";
import { useBridge, useBridgeStatus, useExtensionConnected } from "../bridge/use-bridge";
import type { BridgeMessage } from "../bridge/messages";
import { streamChat, isAiConfigured, type OpenAIMessage } from "../lib/openai";
import { applyStyle, flashElement } from "../inspector";
import { ScrollArea } from "../ui/scroll-area";

// ── Diff / pending changes types ─────────────────────────

interface PendingCssChange {
  property: string;
  oldValue: string;
  newValue: string;
  checked: boolean;
}

interface PendingVariantRewrite {
  html: string;
  css?: string;
}

interface StreamAppliedEntry {
  property: string;
  camelProp: string;
  oldValue: string;
  newValue: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  pending?: boolean;
  applied?: boolean;
  appliedChanges?: string[];
}

const VARIANT_SYSTEM_PROMPT = `You are the AI design agent for 0canvas. You redesign UI components.

You receive a component's HTML. Redesign it as requested.

CRITICAL RULES:
1. Return ONLY the component HTML in this exact block:

\`\`\`html-apply
<div class="component">
  <!-- your redesigned HTML here -->
</div>
\`\`\`

2. Use INLINE STYLES on elements (style="..."). Do NOT return a separate CSS block.
   The variant renders in an isolated iframe — inline styles are the most reliable.
3. Keep it SHORT. Only return the component HTML, not a full page.
4. Do NOT include <html>, <head>, <body>, <style>, or <script> tags.
5. Do NOT return any framework CSS (Tailwind utilities, ReactFlow, etc).
6. Use modern CSS in inline styles: flexbox, grid, border-radius, box-shadow, gradients.
7. Be creative and make it look POLISHED and PROFESSIONAL.
8. Use a cohesive color palette. Prefer subtle shadows, rounded corners, good spacing.
9. Keep the same general content/text but redesign the visual presentation.
10. Brief description of changes (1-2 sentences), then the html-apply block. Nothing else.`;

const ELEMENT_SYSTEM_PROMPT = `You are the AI design agent for 0canvas — a visual design tool on production code.
The designer selects elements and asks you to make visual changes.

When making CSS changes, return a css-apply block:

\`\`\`css-apply
property: value;
\`\`\`

The system auto-applies these to the selected element. Be concise.`;

// ── Diff View: per-property accept/reject ────────────────

function DiffView({
  changes,
  onToggle,
  onApplySelected,
  onApplyAll,
  onReject,
}: {
  changes: PendingCssChange[];
  onToggle: (index: number) => void;
  onApplySelected: () => void;
  onApplyAll: () => void;
  onReject: () => void;
}) {
  const checkedCount = changes.filter((c) => c.checked).length;
  return (
    <div className="oc-ai-diff">
      <div className="oc-ai-diff-title">Proposed Changes</div>
      {changes.map((change, i) => (
        <label key={i} className="oc-ai-diff-row">
          <input
            type="checkbox"
            checked={change.checked}
            onChange={() => onToggle(i)}
            className="oc-ai-diff-check"
          />
          <span className="oc-ai-diff-prop">{change.property}:</span>
          <span className="oc-ai-diff-old">{change.oldValue || "(none)"}</span>
          <ArrowRight size={10} className="oc-ai-diff-arrow" />
          <span className="oc-ai-diff-new">{change.newValue}</span>
        </label>
      ))}
      <div className="oc-ai-diff-actions">
        <button className="oc-ai-diff-btn oc-ai-diff-apply" onClick={onApplySelected} disabled={checkedCount === 0}>
          Apply{checkedCount < changes.length ? ` (${checkedCount})` : " Selected"}
        </button>
        <button className="oc-ai-diff-btn oc-ai-diff-all" onClick={onApplyAll}>
          Apply All
        </button>
        <button className="oc-ai-diff-btn oc-ai-diff-reject" onClick={onReject}>
          Reject
        </button>
      </div>
    </div>
  );
}

function VariantDiffView({
  onApply,
  onReject,
}: {
  onApply: () => void;
  onReject: () => void;
}) {
  return (
    <div className="oc-ai-diff">
      <div className="oc-ai-diff-title">Redesign variant?</div>
      <div className="oc-ai-diff-actions">
        <button className="oc-ai-diff-btn oc-ai-diff-apply" onClick={onApply}>
          Apply
        </button>
        <button className="oc-ai-diff-btn oc-ai-diff-reject" onClick={onReject}>
          Reject
        </button>
      </div>
    </div>
  );
}

export function AIChatPanel() {
  const { state, dispatch } = useWorkspace();
  const bridge = useBridge();
  const bridgeStatus = useBridgeStatus();
  const extensionConnected = useExtensionConnected();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [variantHistory, setVariantHistory] = useState<{ html: string; css: string }[]>([]);
  const [pendingCssChanges, setPendingCssChanges] = useState<PendingCssChange[] | null>(null);
  const [pendingVariant, setPendingVariant] = useState<PendingVariantRewrite | null>(null);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamAppliedRef = useRef<StreamAppliedEntry[]>([]);

  const aiSettings = state.aiSettings;
  const isLocalAI = aiSettings.provider === "chatgpt" || aiSettings.provider === "openai";
  const isIDE = aiSettings.provider === "ide";
  const isBridgeConnected = bridgeStatus === "connected" && extensionConnected;

  // Get active variant
  const activeVariant = state.activeVariantId
    ? state.variants.find((v) => v.id === state.activeVariantId)
    : null;

  const selectedElement = state.selectedElementId
    ? findElement(state.elements, state.selectedElementId)
    : null;

  // Determine context mode
  const hasVariant = !!activeVariant;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, pendingCssChanges, pendingVariant]);

  // ── Parse and apply AI response ─────────────────────────

  const applyVariantRewrite = useCallback((content: string): string[] => {
    if (!activeVariant) return [];
    const changes: string[] = [];

    const htmlMatch = content.match(/```html-apply\s*\n([\s\S]*?)```/);
    const cssMatch = content.match(/```css-apply\s*\n([\s\S]*?)```/);

    if (htmlMatch) {
      // Save current state for undo
      setVariantHistory((prev) => [
        ...prev.slice(-9), // keep last 10
        {
          html: activeVariant.modifiedHtml || activeVariant.html,
          css: activeVariant.modifiedCss || activeVariant.css,
        },
      ]);

      const updates: Record<string, unknown> = {
        modifiedHtml: htmlMatch[1].trim(),
      };
      changes.push("Design updated");

      if (cssMatch) {
        updates.modifiedCss = cssMatch[1].trim();
      }

      dispatch({ type: "UPDATE_VARIANT", id: activeVariant.id, updates });
    }

    return changes;
  }, [activeVariant, dispatch]);

  const handleUndo = useCallback(() => {
    if (!activeVariant || variantHistory.length === 0) return;
    const prev = variantHistory[variantHistory.length - 1];
    setVariantHistory((h) => h.slice(0, -1));
    dispatch({
      type: "UPDATE_VARIANT",
      id: activeVariant.id,
      updates: { modifiedHtml: prev.html, modifiedCss: prev.css },
    });
    setMessages((msgs) => [...msgs, {
      id: `sys-${Date.now()}`, role: "assistant", content: "Reverted to previous design.",
      timestamp: Date.now(),
    }]);
  }, [activeVariant, variantHistory, dispatch]);

  // ── Diff accept/reject handlers ───────────────────────────

  const handleToggleCssChange = useCallback((index: number) => {
    setPendingCssChanges((prev) => {
      if (!prev) return prev;
      return prev.map((c, i) => i === index ? { ...c, checked: !c.checked } : c);
    });
  }, []);

  const handleApplySelectedCss = useCallback(() => {
    if (!pendingCssChanges || !selectedElement) return;
    const applied: string[] = [];
    for (const change of pendingCssChanges) {
      if (!change.checked) {
        // Revert streamed preview for unchecked properties
        const entry = streamAppliedRef.current.find((e) => e.property === change.property);
        if (entry) {
          applyStyle(selectedElement.id, change.property, change.oldValue);
          dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: entry.camelProp, value: change.oldValue });
        }
      } else {
        // Ensure it's applied in the store (was already applied via stream preview)
        const camelProp = change.property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        applyStyle(selectedElement.id, change.property, change.newValue);
        dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: camelProp, value: change.newValue });
        applied.push(`${change.property}: ${change.newValue}`);
      }
    }
    flashElement(selectedElement.id);
    setMessages((prev) => [...prev, {
      id: `applied-${Date.now()}`, role: "assistant",
      content: "Changes applied.", timestamp: Date.now(),
      applied: true, appliedChanges: applied,
    }]);
    setPendingCssChanges(null);
    setPendingContent(null);
    streamAppliedRef.current = [];
  }, [pendingCssChanges, selectedElement, dispatch]);

  const handleApplyAllCss = useCallback(() => {
    if (!pendingCssChanges || !selectedElement) return;
    const applied: string[] = [];
    for (const change of pendingCssChanges) {
      const camelProp = change.property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      applyStyle(selectedElement.id, change.property, change.newValue);
      dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: camelProp, value: change.newValue });
      applied.push(`${change.property}: ${change.newValue}`);
    }
    flashElement(selectedElement.id);
    setMessages((prev) => [...prev, {
      id: `applied-${Date.now()}`, role: "assistant",
      content: "All changes applied.", timestamp: Date.now(),
      applied: true, appliedChanges: applied,
    }]);
    setPendingCssChanges(null);
    setPendingContent(null);
    streamAppliedRef.current = [];
  }, [pendingCssChanges, selectedElement, dispatch]);

  const handleRejectCss = useCallback(() => {
    // Revert all streamed preview changes
    if (selectedElement && streamAppliedRef.current.length > 0) {
      for (const entry of streamAppliedRef.current) {
        applyStyle(selectedElement.id, entry.property, entry.oldValue);
        dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: entry.camelProp, value: entry.oldValue });
      }
    }
    setMessages((prev) => [...prev, {
      id: `rejected-${Date.now()}`, role: "assistant",
      content: "Changes rejected.", timestamp: Date.now(),
    }]);
    setPendingCssChanges(null);
    setPendingContent(null);
    streamAppliedRef.current = [];
  }, [selectedElement, dispatch]);

  const handleApplyVariant = useCallback(() => {
    if (!pendingVariant || !activeVariant || !pendingContent) return;
    // Save for undo
    setVariantHistory((prev) => [
      ...prev.slice(-9),
      {
        html: activeVariant.modifiedHtml || activeVariant.html,
        css: activeVariant.modifiedCss || activeVariant.css,
      },
    ]);
    const updates: Record<string, unknown> = { modifiedHtml: pendingVariant.html };
    if (pendingVariant.css) updates.modifiedCss = pendingVariant.css;
    dispatch({ type: "UPDATE_VARIANT", id: activeVariant.id, updates });
    setMessages((prev) => [...prev, {
      id: `applied-${Date.now()}`, role: "assistant",
      content: "Variant redesign applied.", timestamp: Date.now(),
      applied: true, appliedChanges: ["Design updated"],
    }]);
    setPendingVariant(null);
    setPendingContent(null);
  }, [pendingVariant, pendingContent, activeVariant, dispatch]);

  const handleRejectVariant = useCallback(() => {
    setMessages((prev) => [...prev, {
      id: `rejected-${Date.now()}`, role: "assistant",
      content: "Variant redesign rejected.", timestamp: Date.now(),
    }]);
    setPendingVariant(null);
    setPendingContent(null);
  }, []);

  const applyElementStyles = useCallback((content: string): string[] => {
    if (!selectedElement) return [];
    const applied: string[] = [];

    // Match ```css-apply ... ``` or ```css ... ```
    const cssApplyRegex = /```css-apply\s*\n([\s\S]*?)```/g;
    const cssRegex = /```css\s*\n([\s\S]*?)```/g;

    const blocks: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = cssApplyRegex.exec(content)) !== null) blocks.push(match[1]);
    if (blocks.length === 0) {
      while ((match = cssRegex.exec(content)) !== null) {
        if (!match[1].includes("{")) blocks.push(match[1]);
      }
    }

    for (const block of blocks) {
      for (const line of block.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
        const propMatch = trimmed.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
        if (propMatch) {
          const [, property, value] = propMatch;
          const camelProp = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
          applyStyle(selectedElement.id, property, value);
          dispatch({ type: "UPDATE_STYLE", elementId: selectedElement.id, property: camelProp, value });
          applied.push(`${property}: ${value}`);
        }
      }
    }

    // Flash the element to visualize the change
    if (applied.length > 0 && selectedElement) {
      flashElement(selectedElement.id);
    }

    return applied;
  }, [selectedElement, dispatch]);

  // IDE agent responses — show diff instead of auto-applying
  useEffect(() => {
    if (!bridge) return;
    return bridge.on("AI_CHAT_RESPONSE", (msg: BridgeMessage) => {
      const resp = msg as any;
      const content = resp.message || "";
      setStreaming(false);

      // Mark message as done
      setMessages((prev) =>
        prev.map((m) => m.pending ? { ...m, content, pending: false } : m)
      );

      if (activeVariant) {
        const htmlMatch = content.match(/```html-apply\s*\n([\s\S]*?)```/);
        const cssMatch = content.match(/```css-apply\s*\n([\s\S]*?)```/);
        if (htmlMatch) {
          setPendingVariant({
            html: htmlMatch[1].trim(),
            css: cssMatch ? cssMatch[1].trim() : undefined,
          });
          setPendingContent(content);
        }
      } else if (selectedElement) {
        // Parse css-apply blocks into pending changes for diff view
        const cssApplyRegex = /```css-apply\s*\n([\s\S]*?)```/g;
        const blocks: string[] = [];
        let match: RegExpExecArray | null;
        while ((match = cssApplyRegex.exec(content)) !== null) blocks.push(match[1]);

        const changes: PendingCssChange[] = [];
        const applied: StreamAppliedEntry[] = [];
        for (const block of blocks) {
          for (const line of block.split("\n")) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
            const propMatch = trimmed.match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
            if (propMatch) {
              const [, property, value] = propMatch;
              const camelProp = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
              // Apply for preview
              const oldVal = applyStyle(selectedElement.id, property, value) || "";
              applied.push({ property, camelProp, oldValue: oldVal, newValue: value });
              changes.push({ property, oldValue: oldVal, newValue: value, checked: true });
            }
          }
        }
        if (changes.length > 0) {
          streamAppliedRef.current = applied;
          setPendingCssChanges(changes);
          setPendingContent(content);
        }
      }
    });
  }, [bridge, activeVariant, selectedElement]);

  // ── Send message ────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const query = input.trim();
    if (!query || streaming) return;

    setMessages((prev) => [...prev, {
      id: `user-${Date.now()}`, role: "user", content: query, timestamp: Date.now(),
    }]);
    setInput("");
    setStreaming(true);

    // ── Build context based on mode ──
    let systemPrompt: string;
    let contextBlock: string;

    if (hasVariant && activeVariant) {
      const variantHtml = activeVariant.modifiedHtml || activeVariant.html;

      // Only send the component HTML — NOT the page CSS (too large, confuses the AI)
      // Truncate if extremely long
      const htmlForAI = variantHtml.length > 3000
        ? variantHtml.slice(0, 3000) + "\n<!-- truncated -->"
        : variantHtml;

      systemPrompt = VARIANT_SYSTEM_PROMPT;
      contextBlock = `\n\nComponent: "${activeVariant.name}" (${activeVariant.sourceType})
Viewport: ${activeVariant.sourceViewportWidth || 560}px

Current HTML:
\`\`\`html
${htmlForAI}
\`\`\``;
    } else if (selectedElement) {
      systemPrompt = ELEMENT_SYSTEM_PROMPT;
      contextBlock = `\nSelected: \`${selectedElement.selector}\` (<${selectedElement.tag}>)
Classes: ${selectedElement.classes.join(" ")}
Styles:\n${Object.entries(selectedElement.styles)
        .map(([k, v]) => `  ${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
        .slice(0, 20).join("\n")}`;
    } else {
      systemPrompt = ELEMENT_SYSTEM_PROMPT;
      contextBlock = "\nNo element or variant selected.";
    }

    // ── Local AI ──
    if (isLocalAI && isAiConfigured(aiSettings)) {
      const assistantMsgId = `ai-${Date.now()}`;
      setMessages((prev) => [...prev, {
        id: assistantMsgId, role: "assistant", content: "", timestamp: Date.now(), pending: true,
      }]);

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const openaiMessages: OpenAIMessage[] = [
          { role: "system", content: systemPrompt + contextBlock },
          ...messages.filter((m) => !m.pending).map((m) => ({
            role: m.role as "user" | "assistant", content: m.content,
          })),
          { role: "user", content: query },
        ];

        let accumulated = "";
        const streamApplied: StreamAppliedEntry[] = [];

        for await (const chunk of streamChat({
          settings: aiSettings, messages: openaiMessages, signal: controller.signal,
        })) {
          accumulated += chunk;

          // ── C3: Streaming visual preview for CSS properties ──
          // Apply CSS properties incrementally as they stream in
          if (selectedElement && !hasVariant) {
            const cssMatch = accumulated.match(/```css-apply\s*\n([\s\S]*?)(?:```|$)/);
            if (cssMatch) {
              const lines = cssMatch[1].split("\n");
              for (let i = streamApplied.length; i < lines.length; i++) {
                const propMatch = lines[i].trim().match(/^([\w-]+)\s*:\s*(.+?)\s*;?\s*$/);
                if (propMatch) {
                  const [, prop, val] = propMatch;
                  const camelProp = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
                  const oldVal = applyStyle(selectedElement.id, prop, val) || "";
                  streamApplied.push({ property: prop, camelProp, oldValue: oldVal, newValue: val });
                }
              }
            }
          }

          setMessages((prev) =>
            prev.map((m) => m.id === assistantMsgId ? { ...m, content: accumulated } : m)
          );
        }

        // ── C2: Show diff view instead of auto-applying ──
        // Mark message as done (no longer pending)
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, pending: false } : m)
        );

        if (hasVariant) {
          // Variant rewrite: show apply/reject (no per-property diff)
          const htmlMatch = accumulated.match(/```html-apply\s*\n([\s\S]*?)```/);
          const cssMatch = accumulated.match(/```css-apply\s*\n([\s\S]*?)```/);
          if (htmlMatch) {
            setPendingVariant({
              html: htmlMatch[1].trim(),
              css: cssMatch ? cssMatch[1].trim() : undefined,
            });
            setPendingContent(accumulated);
          }
        } else if (selectedElement && streamApplied.length > 0) {
          // CSS changes: show per-property diff with checkboxes
          streamAppliedRef.current = streamApplied;
          setPendingCssChanges(
            streamApplied.map((entry) => ({
              property: entry.property,
              oldValue: entry.oldValue,
              newValue: entry.newValue,
              checked: true,
            }))
          );
          setPendingContent(accumulated);
        } else if (selectedElement) {
          // Fallback: try applying if streaming didn't catch any (e.g. plain css blocks)
          const applied = applyElementStyles(accumulated);
          if (applied.length > 0) {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantMsgId
                ? { ...m, applied: true, appliedChanges: applied }
                : m
              )
            );
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error
          ? err.name === "AbortError" ? "Stopped." : err.message
          : "Unknown error";
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, content: errMsg, pending: false } : m)
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
      return;
    }

    // ── IDE Agent ──
    if (isIDE && bridge) {
      setMessages((prev) => [...prev, {
        id: `ai-${Date.now()}`, role: "assistant", content: "Sending to agent...",
        timestamp: Date.now(), pending: true,
      }]);
      bridge.send({ type: "AI_CHAT_REQUEST", query,
        selector: selectedElement?.selector, styles: selectedElement?.styles,
        route: state.currentRoute,
      } as any);
      setTimeout(() => {
        setStreaming((c) => {
          if (c) { setMessages((p) => p.map((m) => m.pending ? { ...m, content: "Sent to IDE agent.", pending: false } : m)); return false; }
          return c;
        });
      }, 10000);
      return;
    }

    setMessages((prev) => [...prev, {
      id: `ai-${Date.now()}`, role: "assistant",
      content: "No AI configured. Go to Settings → AI Settings.", timestamp: Date.now(),
    }]);
    setStreaming(false);
  }, [input, streaming, messages, selectedElement, activeVariant, hasVariant, aiSettings, isLocalAI, isIDE, bridge, state.currentRoute, applyVariantRewrite, applyElementStyles]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const providerLabel = aiSettings.provider === "chatgpt" ? "ChatGPT" : aiSettings.provider === "openai" ? "OpenAI" : "IDE";

  return (
    <div className="oc-panel" data-0canvas="ai-chat">
      {/* Header */}
      <div className="oc-panel-header">
        <div className="oc-ai-header">
          <Sparkles size={14} className="oc-ai-icon" />
          <span className="oc-panel-title">AI</span>
          <span className="oc-ai-provider-tag">{providerLabel}</span>
        </div>
        <div className="oc-ai-header-actions">
          {variantHistory.length > 0 && (
            <button className="oc-panel-btn" onClick={handleUndo} title="Undo last AI change">
              <Undo2 size={12} />
            </button>
          )}
          <span className="oc-ai-provider-tag">{aiSettings.model}</span>
        </div>
      </div>

      {/* Context badge */}
      <div className="oc-ai-context">
        {hasVariant && activeVariant ? (
          <span className="oc-ai-context-badge oc-ai-context-variant">
            Variant: {activeVariant.name} ({activeVariant.sourceType})
          </span>
        ) : selectedElement ? (
          <span className="oc-ai-context-badge">
            &lt;{selectedElement.tag}&gt; {selectedElement.selector}
          </span>
        ) : (
          <span className="oc-ai-context-badge oc-ai-context-none">
            No element or variant selected
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="oc-panel-body">
        <div className="oc-ai-messages" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="oc-ai-empty">
              <Bot size={24} className="oc-ai-empty-icon" />
              {hasVariant ? (
                <>
                  <p>Redesign this variant with AI.</p>
                  <p className="oc-ai-empty-hint">
                    Try: "make it minimal and dark", "redesign as a pricing card", "add a gradient background"
                  </p>
                </>
              ) : (
                <>
                  <p>Select an element or variant.</p>
                  <p className="oc-ai-empty-hint">
                    Fork a component into a variant, then ask AI to redesign it.
                  </p>
                </>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`oc-ai-msg oc-ai-msg-${msg.role}`}>
              <div className="oc-ai-msg-icon">
                {msg.role === "user" ? <User size={12} /> : <Bot size={12} />}
              </div>
              <div className="oc-ai-msg-content">
                {msg.pending && !msg.content ? (
                  <span className="oc-ai-pending">
                    <Loader2 size={12} className="oc-ai-spinner" /> Thinking...
                  </span>
                ) : (
                  <>
                    <span style={{ whiteSpace: "pre-wrap" }}>
                      {/* Show text without code blocks for cleaner display */}
                      {msg.content
                        .replace(/```html-apply\s*\n[\s\S]*?```/g, "")
                        .replace(/```css-apply\s*\n[\s\S]*?```/g, "")
                        .trim() || (msg.applied ? "Changes applied." : msg.content)}
                    </span>
                    {msg.applied && msg.appliedChanges && msg.appliedChanges.length > 0 && (
                      <div className="oc-ai-applied">
                        <Check size={11} />
                        <span>{msg.appliedChanges.join(" + ")}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {/* ── C2: Diff view for pending CSS changes ── */}
          {pendingCssChanges && pendingCssChanges.length > 0 && (
            <DiffView
              changes={pendingCssChanges}
              onToggle={handleToggleCssChange}
              onApplySelected={handleApplySelectedCss}
              onApplyAll={handleApplyAllCss}
              onReject={handleRejectCss}
            />
          )}

          {/* ── C2: Diff view for pending variant rewrite ── */}
          {pendingVariant && (
            <VariantDiffView
              onApply={handleApplyVariant}
              onReject={handleRejectVariant}
            />
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="oc-ai-input-row">
        <input
          className="oc-ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={hasVariant ? "Redesign this variant..." : "Select a variant or element"}
          disabled={streaming}
          data-0canvas="ai-input"
        />
        {streaming ? (
          <button className="oc-ai-send-btn oc-ai-stop-btn" onClick={handleStop} title="Stop">
            <Square size={12} />
          </button>
        ) : (
          <button className="oc-ai-send-btn" onClick={handleSend} disabled={!input.trim()} title="Send">
            <Send size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
