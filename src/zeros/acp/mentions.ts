// ──────────────────────────────────────────────────────────
// Mentions — @-picker data model, collectors, expansion
// ──────────────────────────────────────────────────────────
//
// When the designer types "@" in the ACP composer we surface a picker
// over project-native objects: the current selection, design tokens,
// variants, pending feedback items. Chosen items are inserted as a
// compact token (e.g. `@token:--color-primary`). On send, these tokens
// are expanded inline into descriptive English so the agent reads a
// natural sentence with real context attached — no protocol extension,
// just enriched text.
//
// Elements-as-mentions are deliberately skipped: the element tree is
// deep and unlabeled, and @selection already covers the common case
// of "work on what I'm pointing at".
// ──────────────────────────────────────────────────────────

import type { WorkspaceState } from "../store/store";

export type MentionKind = "selection" | "token" | "variant" | "feedback";

export interface MentionItem {
  /** Stable unique id across the whole list — used as React key. */
  id: string;
  kind: MentionKind;
  /** What the user types to pick this (e.g. "selection", "--color-primary"). */
  query: string;
  /** Primary label shown in the picker. */
  label: string;
  /** Secondary dim label — value, affected element, etc. */
  hint?: string;
  /** The token we inject into the textarea, e.g. "@token:--color-primary". */
  token: string;
  /** What the token expands to in the sent message. */
  expansion: string;
}

/**
 * Build the full mention catalogue from the current workspace state. Callers
 * filter this by query string; we rebuild on every keystroke because it's
 * cheap and the workspace state snapshot is closed over.
 */
export function collectMentions(state: WorkspaceState): MentionItem[] {
  const items: MentionItem[] = [];

  // ── @selection — whatever the designer is pointing at ─────
  if (state.selectedElementId) {
    const selected = findElementById(state.elements, state.selectedElementId);
    if (selected) {
      const classSuffix = selected.classes.length
        ? ` .${selected.classes.join(".")}`
        : "";
      items.push({
        id: "selection",
        kind: "selection",
        query: "selection",
        label: "selection",
        hint: `${selected.tag}${classSuffix}`,
        token: "@selection",
        expansion: `the currently-selected element (${selected.tag}${classSuffix}, selector ${selected.selector})`,
      });
    }
  } else {
    items.push({
      id: "selection",
      kind: "selection",
      query: "selection",
      label: "selection",
      hint: "nothing selected",
      token: "@selection",
      expansion: "the currently-selected element (nothing is selected right now)",
    });
  }

  // ── Tokens — all design tokens across every theme file ───
  for (const file of state.themes.files) {
    for (const t of file.tokens) {
      const defaultValue =
        t.values["default"] ??
        Object.values(t.values)[0] ??
        "";
      const valuesList = Object.entries(t.values)
        .map(([theme, v]) => `${theme}=${v}`)
        .join(", ");
      items.push({
        id: `token:${file.id}:${t.name}`,
        kind: "token",
        query: t.name.replace(/^--/, ""),
        label: t.name,
        hint: defaultValue || valuesList || t.group,
        token: `@token:${t.name}`,
        expansion: `design token ${t.name}${valuesList ? ` (values: ${valuesList})` : ""}`,
      });
    }
  }

  // ── Variants ──────────────────────────────────────────────
  for (const v of state.variants) {
    items.push({
      id: `variant:${v.id}`,
      kind: "variant",
      query: v.name,
      label: v.name,
      hint: `${v.sourceType} · ${v.status}`,
      token: `@variant:${v.id}`,
      expansion: `variant "${v.name}" (${v.sourceType}, status ${v.status}${v.sourceSelector ? `, sourced from ${v.sourceSelector}` : ""})`,
    });
  }

  // ── Feedback — pending items only, most recent first ─────
  const pending = state.feedbackItems
    .filter((f) => f.status === "pending")
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp);
  for (const f of pending) {
    const preview =
      f.comment.length > 40 ? f.comment.slice(0, 40) + "…" : f.comment;
    items.push({
      id: `feedback:${f.id}`,
      kind: "feedback",
      query: f.comment,
      label: preview || "(no text)",
      hint: `${f.intent} · ${f.severity} · ${f.elementSelector}`,
      token: `@feedback:${f.id}`,
      expansion: `feedback "${f.comment}" (${f.intent}/${f.severity}, on ${f.elementSelector})`,
    });
  }

  return items;
}

/**
 * Case-insensitive fuzzy contains, ranked by match position. Keeps things
 * predictable for keyboard users — shorter matches starting with the query
 * rank highest.
 */
export function filterMentions(
  items: MentionItem[],
  query: string,
  limit = 8,
): MentionItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items.slice(0, limit);

  const scored: Array<{ item: MentionItem; score: number }> = [];
  for (const item of items) {
    const idx = item.query.toLowerCase().indexOf(q);
    if (idx < 0) {
      // Also match against label so users can find a variant by its display name.
      const altIdx = item.label.toLowerCase().indexOf(q);
      if (altIdx < 0) continue;
      scored.push({ item, score: altIdx + 100 });
      continue;
    }
    scored.push({ item, score: idx });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, limit).map((s) => s.item);
}

/**
 * Replace every @<kind>:<id> or @selection in the user's text with its
 * descriptive expansion. We rebuild mentions from the live workspace state
 * rather than trusting stale hints captured at typing time — keeps the
 * sent message in sync with what the designer is actually looking at.
 */
export function expandMentionsInText(
  text: string,
  state: WorkspaceState,
): string {
  const items = collectMentions(state);
  const byToken = new Map(items.map((m) => [m.token, m]));

  // Match @selection and @<kind>:<value>. Values may contain dashes, dots, ids.
  return text.replace(
    /@(selection|token:[^\s]+|variant:[^\s]+|feedback:[^\s]+)/g,
    (full) => {
      const item = byToken.get(full);
      if (!item) return full; // leave unresolved tokens alone — user can see what's wrong
      return item.expansion;
    },
  );
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function findElementById(
  elements: WorkspaceState["elements"],
  id: string,
): WorkspaceState["elements"][number] | null {
  for (const el of elements) {
    if (el.id === id) return el;
    const inner = findElementById(el.children, id);
    if (inner) return inner;
  }
  return null;
}

// ──────────────────────────────────────────────────────────
// Mention-trigger detection in a textarea
// ──────────────────────────────────────────────────────────

export interface MentionTrigger {
  /** Index in the text where the '@' sits. */
  start: number;
  /** Index just past the last matched character. */
  end: number;
  /** Characters typed after the '@'. May be empty. */
  query: string;
}

/**
 * Detect whether the caret is currently inside an unterminated @mention.
 * Returns null when the caret is outside one (no @, or @ followed by a
 * whitespace which terminates the mention).
 */
export function detectMentionTrigger(
  text: string,
  caret: number,
): MentionTrigger | null {
  // Walk backwards from the caret to find '@', bail on whitespace.
  let i = caret - 1;
  while (i >= 0) {
    const ch = text[i];
    if (ch === "@") {
      // The char before '@' must be start-of-line or whitespace — otherwise
      // this '@' is inside an email or selector and we shouldn't trigger.
      const before = i > 0 ? text[i - 1] : "";
      if (before && !/\s/.test(before)) return null;
      return { start: i, end: caret, query: text.slice(i + 1, caret) };
    }
    if (/\s/.test(ch)) return null;
    i -= 1;
  }
  return null;
}
