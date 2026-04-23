// ============================================
// SERVICE: rate-limit
// PURPOSE: Persistent rate limiting backed by Postgres
//
// Replaces the in-memory Map that previously lived in routes/auth.ts.
// The in-memory version lost all state on process restart and did not
// work across multiple Railway replicas. This one uses a single atomic
// Postgres function and survives both restarts and horizontal scale-out.
// ============================================

import pg from "pg";

const { Pool } = pg;

let pool: pg.Pool | null = null;

function getPool(): pg.Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }
  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}

export interface RateLimiter {
  /**
   * Check whether an action identified by `key` is allowed.
   * Returns true when the caller is under the limit, false when they have
   * hit it. The counter is incremented regardless of the result, so a
   * caller spamming requests cannot walk back into an allowed state
   * before the window resets.
   */
  check(key: string, limit: number, windowMs?: number): Promise<boolean>;
}

export const rateLimiter: RateLimiter = {
  async check(key, limit, windowMs = 60_000) {
    const result = await getPool().query<{ allowed: boolean }>(
      "SELECT check_rate_limit($1, $2, $3) AS allowed",
      [key, limit, windowMs],
    );
    return result.rows[0]?.allowed ?? false;
  },
};

/**
 * Extract the first IP from `x-forwarded-for`.
 *
 * Railway (and most reverse proxies) append each hop to the header, so the
 * raw value can look like "203.0.113.5, 10.0.0.1, 127.0.0.1". The first
 * entry is the real client IP; everything after is the proxy chain.
 */
export function getClientIp(forwardedFor: string | null | undefined): string {
  if (!forwardedFor) return "unknown";
  const first = forwardedFor.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}
