import { useMemo } from "react";
import type { ChatMessage as ChatMessageType } from "./types";
import type { FeedField } from "./types";
import { parseFeedFields, parseRegeneratedField } from "./parseFields";
import { ShotFieldCard } from "./ShotFieldCard";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '<code class="oai-inline-code">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "<em>$1</em>");
}

function renderTextBlock(text: string): string {
  return text
    .split("\n\n")
    .map((block) => {
      block = block.trim();
      if (!block) return "";

      const headerMatch = block.match(/^(#{1,3})\s+(.+)/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        return `<h${level}>${renderInline(headerMatch[2])}</h${level}>`;
      }

      const lines = block.split("\n");
      const isBulletList = lines.every(
        (l) => /^\s*[-*]\s/.test(l) || !l.trim(),
      );
      if (isBulletList && lines.some((l) => /^\s*[-*]\s/.test(l))) {
        const items = lines
          .filter((l) => /^\s*[-*]\s/.test(l))
          .map(
            (l) =>
              `<li>${renderInline(l.replace(/^\s*[-*]\s/, ""))}</li>`,
          );
        return `<ul>${items.join("")}</ul>`;
      }

      const isNumberedList = lines.every(
        (l) => /^\s*\d+\.\s/.test(l) || !l.trim(),
      );
      if (isNumberedList && lines.some((l) => /^\s*\d+\.\s/.test(l))) {
        const items = lines
          .filter((l) => /^\s*\d+\.\s/.test(l))
          .map(
            (l) =>
              `<li>${renderInline(l.replace(/^\s*\d+\.\s/, ""))}</li>`,
          );
        return `<ol>${items.join("")}</ol>`;
      }

      return `<p>${renderInline(block.replace(/\n/g, "<br/>"))}</p>`;
    })
    .filter(Boolean)
    .join("");
}

function renderMarkdown(text: string): string {
  const segments: { type: "text" | "code"; content: string; lang?: string }[] =
    [];
  let remaining = text;

  while (remaining.length > 0) {
    const codeStart = remaining.indexOf("```");
    if (codeStart === -1) {
      segments.push({ type: "text", content: remaining });
      break;
    }

    if (codeStart > 0) {
      segments.push({ type: "text", content: remaining.slice(0, codeStart) });
    }

    remaining = remaining.slice(codeStart + 3);
    const langEnd = remaining.indexOf("\n");
    const lang = langEnd > -1 ? remaining.slice(0, langEnd).trim() : "";
    if (langEnd > -1) remaining = remaining.slice(langEnd + 1);

    const codeEnd = remaining.indexOf("```");
    if (codeEnd === -1) {
      segments.push({ type: "code", content: remaining, lang });
      break;
    }

    segments.push({ type: "code", content: remaining.slice(0, codeEnd), lang });
    remaining = remaining.slice(codeEnd + 3);
  }

  return segments
    .map((seg) => {
      if (seg.type === "code") {
        const langTag = seg.lang
          ? `<div class="oai-code-lang">${escapeHtml(seg.lang)}</div>`
          : "";
        return `<div class="oai-code-block">${langTag}<pre><code>${escapeHtml(seg.content)}</code></pre></div>`;
      }
      return renderTextBlock(seg.content);
    })
    .join("");
}

interface Props {
  message: ChatMessageType;
  isStreaming?: boolean;
  chatMode?: "create" | "ask";
  pushedFields?: Set<string>;
  regeneratingField?: string | null;
  onRegenerate?: (field: FeedField) => void;
  onPush?: (field: FeedField) => void;
  fieldOverrides?: Map<string, string>;
}

export function ChatMessage({
  message,
  isStreaming,
  chatMode,
  pushedFields,
  regeneratingField,
  onRegenerate,
  onPush,
  fieldOverrides,
}: Props) {
  const isUser = message.role === "user";

  // Parse shot fields from assistant messages (memoized)
  // Parse field cards from assistant messages — works for both modes
  // In Ask mode, push/regenerate buttons are disabled (callbacks are undefined)
  // but previous Create mode outputs still show as field cards
  const shotFields = useMemo(() => {
    if (isUser || isStreaming) return null;
    return parseFeedFields(message.content);
  }, [message.content, isUser, isStreaming]);

  // Parse regenerated single-field messages
  const regenField = useMemo(() => {
    if (isUser || isStreaming || shotFields) return null;
    return parseRegeneratedField(message.content);
  }, [message.content, isUser, isStreaming, shotFields]);

  // Apply field overrides from regeneration
  const effectiveFields = useMemo(() => {
    if (!shotFields || !fieldOverrides) return shotFields;
    return shotFields.map((f) => {
      const override = fieldOverrides.get(f.key);
      return override ? { ...f, content: override } : f;
    });
  }, [shotFields, fieldOverrides]);

  // Render as field cards if parsed successfully (regardless of mode)
  // In Ask mode, push/regenerate callbacks may be undefined — buttons are hidden
  if (effectiveFields) {
    return (
      <div className="oai-msg oai-msg--assistant">
        <div className="oai-msg__label">0internal</div>
        <div className="oai-shot-fields">
          {effectiveFields.map((field, idx) => (
            <ShotFieldCard
              key={field.key}
              field={field}
              isPushed={pushedFields?.has(field.key) ?? false}
              isRegenerating={regeneratingField === field.key}
              chatMode={chatMode}
              onRegenerate={onRegenerate}
              onPush={onPush}
              revealDelay={idx * 100}
            />
          ))}
        </div>
      </div>
    );
  }

  // Render regenerated field as a single field card
  if (regenField) {
    return (
      <div className="oai-msg oai-msg--assistant">
        <div className="oai-msg__label">0internal</div>
        <div className="oai-shot-fields">
          <ShotFieldCard
            field={regenField}
            isPushed={pushedFields?.has(regenField.key) ?? false}
            isRegenerating={regeneratingField === regenField.key}
            chatMode={chatMode}
            onRegenerate={onRegenerate}
            onPush={onPush}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`oai-msg oai-msg--${message.role}`}>
      <div className="oai-msg__label">{isUser ? "You" : "0internal"}</div>
      <div className="oai-msg__bubble">
        {isUser && message.images && message.images.length > 0 && (
          <div className="oai-msg__images">
            {message.images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Attachment ${i + 1}`}
                className="oai-msg__image"
              />
            ))}
          </div>
        )}
        {isUser ? (
          <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
        ) : (
          <div
            className="oai-md"
            dangerouslySetInnerHTML={{
              __html:
                renderMarkdown(message.content) +
                (isStreaming ? '<span class="oai-cursor"></span>' : ""),
            }}
          />
        )}
      </div>
    </div>
  );
}
