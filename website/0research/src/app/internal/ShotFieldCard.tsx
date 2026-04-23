import { useState, useCallback, useRef } from "react";
import { ArrowUpRight, Repeat2, Check } from "lucide-react";
import type { FeedField } from "./types";

interface Props {
  field: FeedField;
  isPushed: boolean;
  isRegenerating: boolean;
  chatMode?: "create" | "ask";
  onRegenerate?: (field: FeedField) => void;
  onPush?: (field: FeedField) => void;
  revealDelay?: number;
}

function renderInlineMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

function renderFieldContent(field: FeedField): string {
  // M2M fields: render as pill-like list with new/existing differentiation
  if (field.kind === "m2m" && field.items) {
    return field.items.map((i) => {
      const cls = i.isNew ? "oai-field-card__pill oai-field-card__pill--new" : "oai-field-card__pill";
      const badge = i.isNew ? ' <span class="oai-field-card__new-badge">NEW</span>' : "";
      return `<span class="${cls}">${escapeHtml(i.name)}${badge}</span>`;
    }).join(" ");
  }
  // Tags: render as keywords
  if (field.kind === "tags" && field.tags) {
    return field.tags.map((t) => `<span class="oai-field-card__pill">${escapeHtml(t)}</span>`).join(" ");
  }
  // Blocks: render full content preview with inline markdown
  if (field.kind === "blocks" && field.blocks) {
    return field.blocks.map((block) => {
      const d = block.data;
      switch (block.collection) {
        case "block_heading": {
          const level = (d.level as string) || "h3";
          const tag = level === "h2" ? "h3" : level === "h3" ? "h4" : "h5";
          return `<${tag} class="oai-block-preview__heading">${escapeHtml((d.title as string) || "")}</${tag}>`;
        }
        case "block_rich_text":
        case "block_text": {
          const body = (d.body as string) || "";
          const lines = body.split("\n").filter((l) => l.trim());
          const isList = lines.length > 1 && lines.every((l) => /^\s*[-*]\s/.test(l));
          if (isList) {
            const items = lines.map((l) => `<li>${renderInlineMarkdown(l.replace(/^\s*[-*]\s/, ""))}</li>`).join("");
            return `<ul class="oai-block-preview__list">${items}</ul>`;
          }
          return `<p class="oai-block-preview__text">${renderInlineMarkdown(body)}</p>`;
        }
        case "block_code":
          return `<pre class="oai-block-preview__code"><code>${escapeHtml((d.code as string) || "")}</code></pre>`;
        case "block_quote":
          return `<blockquote class="oai-block-preview__quote">${renderInlineMarkdown((d.body as string) || "")}</blockquote>`;
        default:
          return "";
      }
    }).join("");
  }
  // Richtext: render HTML directly
  if (field.kind === "richtext") {
    return field.content;
  }
  const text = field.content;
  if (text.includes("\n-") || text.startsWith("-")) {
    const items = text
      .split("\n")
      .filter((l) => l.trim().startsWith("-"))
      .map((l) => `<li>${renderInlineMarkdown(l.replace(/^\s*-\s*/, ""))}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  }
  return `<p>${renderInlineMarkdown(text)}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function ShotFieldCard({
  field,
  isRegenerating,
  chatMode,
  onRegenerate,
  onPush,
  revealDelay,
}: Props) {
  const [showCheck, setShowCheck] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handlePush = useCallback(() => {
    if (!onPush) return;
    onPush(field);
    setShowCheck(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShowCheck(false), 2500);
  }, [field, onPush]);

  const showActions = chatMode !== "ask" && (!!onRegenerate || !!onPush);

  return (
    <div
      className={`oai-field-card ${revealDelay !== undefined ? "oai-field-card--revealing" : ""}`}
      style={revealDelay !== undefined ? { animationDelay: `${revealDelay}ms` } : undefined}
    >
      <div className="oai-field-card__header">
        <span className="oai-field-card__label">{field.label}</span>
        {showActions && <div className="oai-field-card__actions">
          <button
            className="oai-field-card__btn"
            onClick={() => onRegenerate?.(field)}
            disabled={isRegenerating || !onRegenerate || field.key === "applications"}
            title={`Regenerate ${field.label}`}
            type="button"
          >
            <Repeat2 size={14} />
          </button>
          <button
            className={`oai-field-card__btn ${showCheck ? "oai-field-card__btn--pushed" : ""}`}
            onClick={handlePush}
            disabled={!onPush}
            title={`Push ${field.label} to output`}
            type="button"
          >
            {showCheck ? <Check size={14} /> : <ArrowUpRight size={14} />}
          </button>
        </div>}
      </div>
      <div
        className="oai-field-card__content"
        dangerouslySetInnerHTML={{ __html: renderFieldContent(field) }}
      />
    </div>
  );
}
