// ──────────────────────────────────────────────────────────
// MentionPicker — autocomplete popover for the ACP composer
// ──────────────────────────────────────────────────────────
//
// Dumb list + keyboard nav. Parent owns the composer text, detects the
// trigger, and passes us the filtered items. On pick we call back with
// the chosen item; parent handles text splicing.
// ──────────────────────────────────────────────────────────

import React, { useEffect, useRef } from "react";
import {
  MousePointer2,
  Palette,
  Layers,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { MentionItem, MentionKind } from "./mentions";
import { Button } from "../ui";

interface MentionPickerProps {
  items: MentionItem[];
  highlightIndex: number;
  onHover: (index: number) => void;
  onPick: (item: MentionItem) => void;
}

const KIND_ICON: Record<MentionKind, LucideIcon> = {
  selection: MousePointer2,
  token: Palette,
  variant: Layers,
  feedback: MessageCircle,
};

const KIND_LABEL: Record<MentionKind, string> = {
  selection: "Selection",
  token: "Token",
  variant: "Variant",
  feedback: "Feedback",
};

export function MentionPicker({
  items,
  highlightIndex,
  onHover,
  onPick,
}: MentionPickerProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the active item scrolled into view as the highlight moves.
  useEffect(() => {
    const node = listRef.current?.children[highlightIndex] as
      | HTMLElement
      | undefined;
    if (node) {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  if (items.length === 0) {
    return (
      <div className="oc-acp-menu">
        <div className="oc-acp-menu-empty">No matches.</div>
      </div>
    );
  }

  return (
    <div className="oc-acp-menu">
      <div className="oc-acp-menu-head">
        Mention · {items.length} result{items.length === 1 ? "" : "s"}
      </div>
      <div ref={listRef} className="oc-acp-menu-list">
        {items.map((item, i) => {
          const Icon = KIND_ICON[item.kind];
          const active = i === highlightIndex;
          return (
            <Button
              key={item.id}
              variant="ghost"
              type="button"
              onMouseEnter={() => onHover(i)}
              onMouseDown={(e) => {
                // mousedown (not click) so we beat the textarea blur.
                e.preventDefault();
                onPick(item);
              }}
              className={`oc-acp-menu-item ${
                active ? "oc-acp-menu-item-active" : ""
              }`}
            >
              <Icon className="oc-acp-menu-item-icon w-3.5 h-3.5" />
              <div className="min-w-0 flex-1">
                <div className="oc-acp-menu-item-label">{item.label}</div>
                {item.hint && (
                  <div className="oc-acp-menu-item-hint">{item.hint}</div>
                )}
              </div>
              <span className="oc-acp-menu-item-kind">
                {KIND_LABEL[item.kind]}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
