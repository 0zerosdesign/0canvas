// ──────────────────────────────────────────────────────────
// design-tools — Zeros' MCP tools, matched by title
// ──────────────────────────────────────────────────────────
//
// Extracted from agent-chat.tsx (Phase 0) so the design-tool
// card and PermissionBar can share the same matching logic.
// Originally lived inline; moving it here keeps agent-chat
// focused on the chat shell and lets each renderer pull only
// the metadata it needs.
//
// The list itself is unchanged from the original — same regex,
// same icons, same labels — just a new home. New design tools
// land by appending an entry here and writing nothing else.
//
// ──────────────────────────────────────────────────────────

import type { ComponentType } from "react";
import {
  FileText,
  MessageSquare,
  MousePointer2,
  Palette,
  Target,
  Zap,
} from "lucide-react";
import type { ElementNode } from "../../store/store";
import { findBySelector } from "../../store/store";

/** Designer-facing prompt the PermissionBar renders. Each design tool
 *  builds one of these from the agent's rawInput; non-design tools
 *  fall back to the protocol-default prompt. */
export interface PermissionPrompt {
  /** Short sentence the designer reads first. */
  headline: string;
  /** Optional secondary body (multi-line, subtitle-style). */
  body?: string;
  /** When the tool will mutate state, a before→after pair we render. */
  diff?: {
    before?: string;
    after: string;
  };
  /** Risk level — tints the bar. Reads are "low", writes are "high". */
  risk: "low" | "high";
}

export interface DesignToolEntry {
  match: RegExp;
  icon: ComponentType<{ className?: string }>;
  label: string;
  summarize?: (input: unknown) => string | null;
  describePermission?: (
    input: unknown,
    ctx: {
      currentValueForSelector: (sel: string, prop: string) => string | undefined;
    },
  ) => PermissionPrompt | null;
}

export const DESIGN_TOOLS: DesignToolEntry[] = [
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
        headline: sel ? `Inspect styles on ${sel}` : "Inspect an element's styles",
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
        body: "Writes to the CSS source file for this selector. Hot-reloads the canvas on save.",
        diff: { before, after: `${obj.property}: ${after};` },
        risk: "high",
      };
    },
  },
];

export function matchDesignTool(title: string): DesignToolEntry | null {
  for (const entry of DESIGN_TOOLS) {
    if (entry.match.test(title)) return entry;
  }
  return null;
}

/** Camel-case / style-object lookup of a CSS property on a workspace
 *  element matched by its canonical selector. Used only for the
 *  before→after in the apply_change permission prompt; failures
 *  return undefined. */
export function lookupCurrentValue(
  elements: ElementNode[],
  selector: string,
  property: string,
): string | undefined {
  const target = findBySelector(elements, selector);
  if (!target) return undefined;
  const camel = property.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return target.styles[property] ?? target.styles[camel];
}
