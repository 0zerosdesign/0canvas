// ──────────────────────────────────────────────────────────
// UnknownMessage — fallback for kinds we don't render yet
// ──────────────────────────────────────────────────────────
//
// New in Phase 0. The pre-refactor MessageView had a binary
// if/else (text → bubble, else → ToolCallCard) which silently
// dropped any future message kind. As we add tool-specific
// renderers (bash, edit, read, …) and engine events evolve,
// this card guarantees nothing falls through unseen.
//
// Visual: single-line muted card. Conductor-style restraint —
// dim, dense, non-intrusive. All values come from tokens.css
// so the card inherits the dark theme without inline colors.
//
// ──────────────────────────────────────────────────────────

import { memo, useState } from "react";
import { ChevronRight, HelpCircle } from "lucide-react";
import type { AgentMessage } from "../use-agent-session";
import type { RendererContext } from "./types";

interface Props {
  message: AgentMessage;
  ctx: RendererContext;
}

export const UnknownMessage = memo(function UnknownMessage({ message }: Props) {
  const [expanded, setExpanded] = useState(false);
  const kind = (message as { kind?: string }).kind ?? "unknown";
  const preview = previewFor(message);

  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
        margin: "var(--space-2) 0",
        fontSize: "var(--text-12)",
        color: "var(--text-muted)",
        lineHeight: "var(--leading-snug)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: 0,
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <ChevronRight
          style={{
            width: "var(--icon-sm)",
            height: "var(--icon-sm)",
            transform: expanded ? "rotate(90deg)" : "rotate(0)",
            transition: `transform var(--dur-fast) var(--ease-standard)`,
            color: "var(--text-placeholder)",
          }}
        />
        <HelpCircle
          style={{
            width: "var(--icon-sm)",
            height: "var(--icon-sm)",
            color: "var(--text-placeholder)",
          }}
        />
        <span style={{ fontWeight: "var(--weight-control)" }}>
          Unrecognized event
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            color: "var(--text-placeholder)",
            padding: "0 var(--space-2)",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-xs)",
          }}
        >
          {kind}
        </span>
        {preview && !expanded && (
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--text-placeholder)",
            }}
          >
            {preview}
          </span>
        )}
      </button>
      {expanded && (
        <pre
          style={{
            marginTop: "var(--space-2)",
            padding: "var(--space-3)",
            background: "var(--surface-0)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-11)",
            color: "var(--text-muted)",
            overflow: "auto",
            maxHeight: "240px",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {safeStringify(message)}
        </pre>
      )}
    </div>
  );
});

function previewFor(message: AgentMessage): string {
  // Best-effort one-liner. The whole point of this renderer is that we
  // don't trust the shape, so probe a few common fields rather than
  // type-narrowing.
  const m = message as unknown as Record<string, unknown>;
  if (typeof m.text === "string") return m.text.slice(0, 120);
  if (typeof m.title === "string") return m.title.slice(0, 120);
  if (typeof m.id === "string") return m.id;
  return "";
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
