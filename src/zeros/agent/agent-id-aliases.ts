// ──────────────────────────────────────────────────────────
// Agent id aliases — map legacy persisted ids forward
// ──────────────────────────────────────────────────────────
//
// `claude-acp`, `codex-acp`, `amp-acp` were the agent ids while
// the legacy protocol-adapter naming was in place. After the
// 2026-04-25 native-runtime migration the suffixes carried no
// meaning, and Phase 1 Stage 1B drops them — Claude is `claude`,
// Codex is `codex`, Amp is `amp`.
//
// Renderer-side maps (brands, auth config, model catalog) and
// the engine registry now key on the canonical ids. Lookups
// normalize through `canonicalAgentId()` first so existing
// persisted data (workspace state, SQLite chats, keychain) keeps
// resolving while one-shot migrations move it forward.
// ──────────────────────────────────────────────────────────

const LEGACY_TO_CANONICAL: Record<string, string> = {
  "claude-acp": "claude",
  "codex-acp": "codex",
  "amp-acp": "amp",
};

/** Map legacy ids to their canonical form. Unknown ids pass through
 *  unchanged so we don't accidentally rewrite a Cursor / Gemini /
 *  Droid id (which never had a `-acp` suffix). */
export function canonicalAgentId(id: string): string;
export function canonicalAgentId(id: null | undefined): null;
export function canonicalAgentId(
  id: string | null | undefined,
): string | null;
export function canonicalAgentId(
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  return LEGACY_TO_CANONICAL[id] ?? id;
}

/** True when `id` is one of the legacy aliases — used by the boot-time
 *  migration to know whether to UPDATE a SQLite row or workspace chat. */
export function isLegacyAgentId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id in LEGACY_TO_CANONICAL;
}

/** The full alias map, exported for the engine-side adapter lookup
 *  which needs to resolve a legacy id before the renderer migration
 *  has had a chance to run (e.g. on first boot after upgrade). */
export const AGENT_ID_ALIASES: ReadonlyMap<string, string> = new Map(
  Object.entries(LEGACY_TO_CANONICAL),
);
