/**
 * Which env-map differences actually require tearing down an agent subprocess
 * and respawning it, and which can be applied at session level (or ignored).
 *
 * Subprocess env is baked at fork time — the only way to "change" an API key
 * or HOME override is to spawn a new process. But some keys Zeros sends are
 * either purely client conventions that agents ignore, or map to capabilities
 * the agent exposes via `session/set_model` etc. Those don't need respawn.
 */

/**
 * Keys that are safe to change without respawning. Currently just the
 * Zeros-internal thinking-effort hint, which agents don't consume.
 *
 * If an agent starts honoring one of these at spawn time, move it out.
 */
export const RESPAWN_IGNORED_KEYS = new Set<string>([
  "ACP_THINKING_EFFORT",
]);

/**
 * True when the two env maps differ only in keys we don't care about.
 * Returns false if any "meaningful" key has a different value — in that
 * case the subprocess must be respawned so the new env takes effect.
 */
export function envMatchesForRespawn(
  a: Record<string, string>,
  b: Record<string, string>,
): boolean {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of allKeys) {
    if (RESPAWN_IGNORED_KEYS.has(k)) continue;
    if (a[k] !== b[k]) return false;
  }
  return true;
}
