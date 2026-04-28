// ──────────────────────────────────────────────────────────
// Per-chat permission policies — "Always for X" decisions
// ──────────────────────────────────────────────────────────
//
// Stage 6.2. When the user picks "Always allow" / "Always block"
// on the inline permission cluster, we record a Zeros-side policy
// keyed by chatId. Future permission requests in the same chat
// are matched against the policy list FIRST; on hit we auto-
// respond through the bridge and never bother the user with a
// prompt — the engine still receives a normal selected-option
// response, so its own policy machinery stays in sync.
//
// Policies are deliberately per-chat (not session, not global).
// The chat is the unit of conversation context; a "yes always"
// decision in one chat shouldn't silently apply to a fresh chat
// the next day. A future Settings page will offer cross-chat
// policy management for power users.
//
// Persistence: dual-write. localStorage gives us the synchronous-
// boot bootstrap (the store needs initial state at module load
// time), and SQLite is the durable backstop the audit-fix #2
// added so quota/private-mode failures on localStorage don't
// silently drop the user's "always allow" decisions. On chat
// open, SQLite hydrates and overlays whatever localStorage had.
// ──────────────────────────────────────────────────────────

import {
  listChatPolicies as ipcListChatPolicies,
  upsertChatPolicy as ipcUpsertChatPolicy,
  deleteChatPolicy as ipcDeleteChatPolicy,
} from "../../native/native";

const STORAGE_KEY = "zeros.chat-policies.v1";

export type PolicyDecision = "allow" | "reject";

export interface PolicyRule {
  /** Stable id so the user can revoke a specific rule from
   *  Settings / from the chip on the tool card. */
  id: string;
  /** The chat this rule belongs to. */
  chatId: string;
  /** Match rule. Empty toolKind matches anything; toolTitle
   *  is the exact title (e.g. "Bash") or a prefix the rule
   *  cares about. For Phase 1 we only match on toolKind —
   *  toolTitle is reserved for finer-grained matching later. */
  toolKind?: string;
  toolTitle?: string;
  /** allow → respond with the request's allow_always option;
   *  reject → respond with reject_always. */
  decision: PolicyDecision;
  /** Wallclock ms — surfaced by the future Settings page so
   *  users can spot stale rules. */
  createdAt: number;
}

interface PolicyDoc {
  /** Map of chatId → list of rules. */
  byChat: Record<string, PolicyRule[]>;
}

const EMPTY: PolicyDoc = { byChat: {} };

/** Read policies from localStorage. Tolerant to missing / malformed
 *  data — returns an empty doc rather than throwing. */
export function loadPolicies(): PolicyDoc {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as PolicyDoc;
    if (!parsed || typeof parsed !== "object" || !parsed.byChat) return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

/** Persist a policy doc back to localStorage. Best-effort —
 *  swallows quota errors etc. and logs to console only. */
export function savePolicies(doc: PolicyDoc): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(doc));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[Zeros policies] persist failed:", err);
  }
}

/** Find the first policy matching the given tool. Returns null
 *  if nothing applies, in which case the UI shows the prompt. */
export function findMatchingPolicy(
  rules: PolicyRule[],
  toolKind: string | undefined,
  toolTitle: string | undefined,
): PolicyRule | null {
  for (const r of rules) {
    if (r.toolKind && r.toolKind !== toolKind) continue;
    if (r.toolTitle && r.toolTitle !== toolTitle) continue;
    return r;
  }
  return null;
}

/** Build a fresh policy id. Date-based + random suffix — collisions
 *  inside a single chat are vanishingly unlikely. */
export function newPolicyId(): string {
  return `pol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── SQLite layer — fix #2 ──────────────────────────────────

/** Async hydration from SQLite. Called when a chat is opened so the
 *  durable copy overlays whatever localStorage had. Tolerant to IPC
 *  failures — returns the localStorage rules as a fallback so a
 *  broken main process doesn't strip the user's existing rules. */
export async function hydrateChatPolicies(
  chatId: string,
  fallback: PolicyRule[],
): Promise<PolicyRule[]> {
  try {
    const rows = await ipcListChatPolicies(chatId);
    if (rows.length === 0) return fallback;
    const out: PolicyRule[] = [];
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.payload) as PolicyRule;
        if (parsed && typeof parsed === "object" && parsed.id) {
          out.push(parsed);
        }
      } catch {
        /* skip malformed row */
      }
    }
    return out;
  } catch {
    return fallback;
  }
}

/** Fire-and-forget durable persist for a single rule. Called by
 *  sessions-store mutations alongside the legacy localStorage write.
 *  IPC failures are swallowed — localStorage acts as the fallback. */
export function persistPolicyToDb(rule: PolicyRule): void {
  void ipcUpsertChatPolicy({
    chatId: rule.chatId,
    policyId: rule.id,
    payload: JSON.stringify(rule),
  }).catch(() => {
    /* localStorage is the fallback; main-side failure is recoverable */
  });
}

/** Fire-and-forget durable delete. */
export function deletePolicyFromDb(chatId: string, ruleId: string): void {
  void ipcDeleteChatPolicy({ chatId, policyId: ruleId }).catch(() => {
    /* see persistPolicyToDb */
  });
}
