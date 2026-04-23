"use client";

import { useState, useCallback } from "react";
import type { InsightBlock } from "../types";

interface Props {
  blocks: InsightBlock[];
  onChange: (blocks: InsightBlock[]) => void;
}

const BLOCK_TYPES = [
  { value: "block_heading", label: "Heading", icon: "H" },
  { value: "block_rich_text", label: "Rich Text", icon: "T" },
  { value: "block_text", label: "Text", icon: "P" },
  { value: "block_code", label: "Code", icon: "</>" },
  { value: "block_table", label: "Table", icon: "=" },
  { value: "block_quote", label: "Quote", icon: '"' },
] as const;

function getBlockIcon(collection: string): string {
  return BLOCK_TYPES.find((t) => t.value === collection)?.icon || "?";
}

function getBlockLabel(collection: string): string {
  return BLOCK_TYPES.find((t) => t.value === collection)?.label || collection;
}

function getBlockPreviewText(block: InsightBlock): string {
  const d = block.data;
  if (d.title && typeof d.title === "string") return d.title;
  if (d.body && typeof d.body === "string") {
    // Strip HTML tags for preview
    return d.body.replace(/<[^>]*>/g, "").slice(0, 100);
  }
  if (d.code_content && typeof d.code_content === "string") return d.code_content.slice(0, 80);
  if (d.quote_text && typeof d.quote_text === "string") return d.quote_text.slice(0, 80);
  return "";
}

export function BlockEditor({ blocks, onChange }: Props) {
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addBlock = useCallback(
    (collection: string) => {
      const newBlock: InsightBlock = {
        id: crypto.randomUUID(),
        collection,
        sort: blocks.length + 1,
        data: getDefaultData(collection),
      };
      onChange([...blocks, newBlock]);
      setShowTypePicker(false);
      setEditingId(newBlock.id);
    },
    [blocks, onChange],
  );

  const updateBlock = useCallback(
    (id: string, data: Record<string, unknown>) => {
      onChange(blocks.map((b) => (b.id === id ? { ...b, data } : b)));
    },
    [blocks, onChange],
  );

  const removeBlock = useCallback(
    (id: string) => {
      const filtered = blocks.filter((b) => b.id !== id);
      onChange(filtered.map((b, i) => ({ ...b, sort: i + 1 })));
      if (editingId === id) setEditingId(null);
    },
    [blocks, onChange, editingId],
  );

  const moveBlock = useCallback(
    (id: string, direction: "up" | "down") => {
      const idx = blocks.findIndex((b) => b.id === id);
      if (idx < 0) return;
      const target = direction === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= blocks.length) return;
      const next = [...blocks];
      [next[idx], next[target]] = [next[target], next[idx]];
      onChange(next.map((b, i) => ({ ...b, sort: i + 1 })));
    },
    [blocks, onChange],
  );

  return (
    <div className="oai-block-editor">
      {blocks.length === 0 && (
        <div className="oai-block-editor__empty">No insight blocks yet</div>
      )}

      {blocks.map((block, idx) => (
        <div key={block.id} className="oai-block-item">
          <div className="oai-block-item__header">
            <span className="oai-block-item__type-icon">{getBlockIcon(block.collection)}</span>
            <span className="oai-block-item__type-label">{getBlockLabel(block.collection)}</span>
            <div className="oai-block-item__actions">
              <button
                type="button"
                className="oai-block-item__sort-btn"
                onClick={() => moveBlock(block.id, "up")}
                disabled={idx === 0}
                title="Move up"
              >
                &uarr;
              </button>
              <button
                type="button"
                className="oai-block-item__sort-btn"
                onClick={() => moveBlock(block.id, "down")}
                disabled={idx === blocks.length - 1}
                title="Move down"
              >
                &darr;
              </button>
              <button
                type="button"
                className="oai-block-item__edit-btn"
                onClick={() => setEditingId(editingId === block.id ? null : block.id)}
                title={editingId === block.id ? "Collapse" : "Edit"}
              >
                {editingId === block.id ? "−" : "✎"}
              </button>
              <button
                type="button"
                className="oai-block-item__delete-btn"
                onClick={() => removeBlock(block.id)}
                title="Delete"
              >
                &times;
              </button>
            </div>
          </div>

          {editingId === block.id ? (
            <div className="oai-block-item__editor">
              <BlockContentEditor
                collection={block.collection}
                data={block.data}
                onChange={(data) => updateBlock(block.id, data)}
              />
            </div>
          ) : (
            <div
              className="oai-block-item__preview"
              onClick={() => setEditingId(block.id)}
            >
              {getBlockPreviewText(block) || <span className="oai-text-muted">Empty block</span>}
            </div>
          )}
        </div>
      ))}

      <div className="oai-block-add">
        {showTypePicker ? (
          <div className="oai-block-type-picker">
            {BLOCK_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className="oai-block-type-picker__option"
                onClick={() => addBlock(type.value)}
              >
                <span className="oai-block-type-picker__icon">{type.icon}</span>
                {type.label}
              </button>
            ))}
            <button
              type="button"
              className="oai-block-type-picker__cancel"
              onClick={() => setShowTypePicker(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="oai-block-add__btn"
            onClick={() => setShowTypePicker(true)}
          >
            + Add Block
          </button>
        )}
      </div>
    </div>
  );
}

// ── Block Content Editors ─────────────────────────────────────────

function getDefaultData(collection: string): Record<string, unknown> {
  switch (collection) {
    case "block_heading":
      return { title: "", level: "h3" };
    case "block_rich_text":
      return { body: "", title: "" };
    case "block_text":
      return { body: "" };
    case "block_code":
      return { code: "", language: "typescript", title: "" };
    case "block_table":
      return { table_data: [], title: "" };
    case "block_quote":
      return { body: "", attribution: "" };
    default:
      return {};
  }
}

function BlockContentEditor({
  collection,
  data,
  onChange,
}: {
  collection: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const update = (key: string, value: unknown) => onChange({ ...data, [key]: value });

  switch (collection) {
    case "block_heading":
      return (
        <div className="oai-block-content">
          <input
            className="oai-block-content__input"
            value={(data.title as string) || ""}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Heading text..."
          />
          <select
            className="oai-block-content__select"
            value={(data.level as string) || "h3"}
            onChange={(e) => update("level", e.target.value)}
          >
            <option value="h2">H2</option>
            <option value="h3">H3</option>
            <option value="h4">H4</option>
          </select>
        </div>
      );

    case "block_rich_text":
      return (
        <div className="oai-block-content">
          <input
            className="oai-block-content__input"
            value={(data.title as string) || ""}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Section title (optional)..."
          />
          <textarea
            className="oai-block-content__textarea"
            value={(data.body as string) || ""}
            onChange={(e) => update("body", e.target.value)}
            placeholder="Rich text content..."
            rows={4}
          />
        </div>
      );

    case "block_text":
      return (
        <textarea
          className="oai-block-content__textarea"
          value={(data.body as string) || ""}
          onChange={(e) => update("body", e.target.value)}
          placeholder="Text content..."
          rows={3}
        />
      );

    case "block_code":
      return (
        <div className="oai-block-content">
          <div className="oai-block-content__row">
            <input
              className="oai-block-content__input"
              value={(data.title as string) || ""}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Code title (optional)..."
            />
            <input
              className="oai-block-content__input oai-block-content__input--short"
              value={(data.language as string) || ""}
              onChange={(e) => update("language", e.target.value)}
              placeholder="Language..."
            />
          </div>
          <textarea
            className="oai-block-content__textarea oai-block-content__textarea--code"
            value={(data.code as string) || ""}
            onChange={(e) => update("code", e.target.value)}
            placeholder="Code content..."
            rows={5}
          />
        </div>
      );

    case "block_quote":
      return (
        <div className="oai-block-content">
          <textarea
            className="oai-block-content__textarea"
            value={(data.body as string) || ""}
            onChange={(e) => update("body", e.target.value)}
            placeholder="Quote text..."
            rows={2}
          />
          <input
            className="oai-block-content__input"
            value={(data.attribution as string) || ""}
            onChange={(e) => update("attribution", e.target.value)}
            placeholder="Attribution..."
          />
        </div>
      );

    case "block_table":
      return (
        <div className="oai-block-content">
          <input
            className="oai-block-content__input"
            value={(data.title as string) || ""}
            onChange={(e) => update("title", e.target.value)}
            placeholder="Table title..."
          />
          <textarea
            className="oai-block-content__textarea"
            value={
              Array.isArray(data.table_data)
                ? JSON.stringify(data.table_data, null, 2)
                : ""
            }
            onChange={(e) => {
              try {
                update("table_data", JSON.parse(e.target.value));
              } catch {
                // Allow editing even with invalid JSON
              }
            }}
            placeholder='[{"col_1": "Header1", "col_2": "Header2"}, {"col_1": "Data1", "col_2": "Data2"}]'
            rows={4}
          />
        </div>
      );

    default:
      return (
        <textarea
          className="oai-block-content__textarea"
          value={JSON.stringify(data, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              /* noop */
            }
          }}
          rows={3}
        />
      );
  }
}
