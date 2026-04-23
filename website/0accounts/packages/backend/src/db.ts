// ============================================
// MODULE: Database
// PURPOSE: PostgreSQL queries via Railway Postgres (raw pg)
// NOTE: Supabase is auth-only. All data lives in Railway PostgreSQL.
// ============================================

import pg from "pg";
import type {
  ZeroProfile,
  ZeroProduct,
  ProductAccess,
} from "./types.js";

const { Pool } = pg;

// Singleton connection pool
let pool: pg.Pool | null = null;

// WORKFLOW: getPool
// TRIGGERED BY: All DB operations
// WHAT IT DOES: Returns or creates a PostgreSQL connection pool
function getPool(): pg.Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return pool;
}

// WORKFLOW: query
// TRIGGERED BY: All DB functions
// WHAT IT DOES: Executes a parameterized SQL query
async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<pg.QueryResult<T>> {
  const db = getPool();
  return db.query<T>(text, params);
}

// WORKFLOW: initializeTables
// TRIGGERED BY: Server startup
// WHAT IT DOES:
// 1. Creates zeros_products table if not exists
// 2. Creates zeros_profiles table if not exists
// 3. Creates zeros_product_access table if not exists
// 4. Creates zeros_audit_log table if not exists
// 5. Creates indexes for performance
export async function initializeTables(): Promise<void> {
  try {
    await query(`
      -- Product registry
      CREATE TABLE IF NOT EXISTS zeros_products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        url TEXT NOT NULL,
        icon_url TEXT,
        color TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- User profiles (user ID matches Supabase auth.users UUID)
      CREATE TABLE IF NOT EXISTS zeros_profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        display_name TEXT,
        avatar_url TEXT,
        bio TEXT,
        preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
        role TEXT NOT NULL DEFAULT 'user',
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Product access records
      CREATE TABLE IF NOT EXISTS zeros_product_access (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        first_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, product_id)
      );

      -- Activity audit log
      CREATE TABLE IF NOT EXISTS zeros_audit_log (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Rate limit buckets (replaces the in-memory Map that didn't survive
      -- restarts or scale horizontally). Keyed by <action>:<ip>.
      CREATE TABLE IF NOT EXISTS zeros_rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        reset_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_zeros_profiles_email ON zeros_profiles(email);
      CREATE INDEX IF NOT EXISTS idx_zeros_product_access_user ON zeros_product_access(user_id);
      CREATE INDEX IF NOT EXISTS idx_zeros_product_access_product ON zeros_product_access(product_id);
      CREATE INDEX IF NOT EXISTS idx_zeros_audit_log_user ON zeros_audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_zeros_audit_log_created ON zeros_audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_zeros_rate_limits_reset_at ON zeros_rate_limits(reset_at);
    `);

    // Rate-limit check function. Atomic INSERT ... ON CONFLICT keeps the
    // counter correct under concurrent requests; when the window has
    // expired the counter resets to 1 instead of continuing to climb.
    await query(`
      CREATE OR REPLACE FUNCTION check_rate_limit(
        p_key TEXT,
        p_limit INTEGER,
        p_window_ms INTEGER
      ) RETURNS BOOLEAN AS $$
      DECLARE
        v_now TIMESTAMPTZ := NOW();
        v_count INTEGER;
      BEGIN
        INSERT INTO zeros_rate_limits (key, count, reset_at)
        VALUES (p_key, 1, v_now + (p_window_ms || ' milliseconds')::INTERVAL)
        ON CONFLICT (key) DO UPDATE SET
          count = CASE
            WHEN zeros_rate_limits.reset_at <= v_now THEN 1
            ELSE zeros_rate_limits.count + 1
          END,
          reset_at = CASE
            WHEN zeros_rate_limits.reset_at <= v_now
              THEN v_now + (p_window_ms || ' milliseconds')::INTERVAL
            ELSE zeros_rate_limits.reset_at
          END
        RETURNING count INTO v_count;

        RETURN v_count <= p_limit;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log("Database tables initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize tables:", err);
    throw err;
  }
}

// --- ZERO PROFILES ---

// WORKFLOW: getProfile
// TRIGGERED BY: GET /api/v1/profile
// WHAT IT DOES: Fetches a user's zero profile by their Supabase auth user ID
export async function getProfile(
  userId: string,
): Promise<ZeroProfile | null> {
  const result = await query<ZeroProfile>(
    "SELECT * FROM zeros_profiles WHERE id = $1",
    [userId],
  );
  return result.rows[0] || null;
}

// WORKFLOW: createProfile
// TRIGGERED BY: POST /api/v1/auth/signup, POST /api/v1/auth/verify (auto-create)
// WHAT IT DOES: Creates or updates a zero profile for a user (upsert)
export async function createProfile(
  userId: string,
  email: string,
  name: string,
): Promise<ZeroProfile | null> {
  const result = await query<ZeroProfile>(
    `INSERT INTO zeros_profiles (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       updated_at = NOW()
     RETURNING *`,
    [userId, email, name || email.split("@")[0]],
  );
  return result.rows[0] || null;
}

// WORKFLOW: updateProfile
// TRIGGERED BY: PUT /api/v1/profile
// WHAT IT DOES: Updates a user's profile with the provided fields
export async function updateProfile(
  userId: string,
  updates: Partial<
    Pick<
      ZeroProfile,
      "name" | "display_name" | "avatar_url" | "bio" | "preferences"
    >
  >,
): Promise<ZeroProfile | null> {
  // Build dynamic SET clause from provided fields
  const fields: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(updates.name);
  }
  if (updates.display_name !== undefined) {
    fields.push(`display_name = $${paramIndex++}`);
    values.push(updates.display_name);
  }
  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramIndex++}`);
    values.push(updates.avatar_url);
  }
  if (updates.bio !== undefined) {
    fields.push(`bio = $${paramIndex++}`);
    values.push(updates.bio);
  }
  if (updates.preferences !== undefined) {
    fields.push(`preferences = $${paramIndex++}`);
    values.push(JSON.stringify(updates.preferences));
  }

  if (fields.length === 0) return getProfile(userId);

  fields.push(`updated_at = NOW()`);
  values.push(userId);

  const result = await query<ZeroProfile>(
    `UPDATE zeros_profiles SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

// --- ZERO PRODUCTS ---

// WORKFLOW: getAllProducts
// TRIGGERED BY: GET /api/v1/products
// WHAT IT DOES: Fetches all products ordered by sort_order
export async function getAllProducts(): Promise<ZeroProduct[]> {
  const result = await query<ZeroProduct>(
    "SELECT * FROM zeros_products ORDER BY sort_order ASC",
  );
  return result.rows;
}

// WORKFLOW: getProduct
// TRIGGERED BY: Various routes that need product info
// WHAT IT DOES: Fetches a single product by ID
export async function getProduct(
  productId: string,
): Promise<ZeroProduct | null> {
  const result = await query<ZeroProduct>(
    "SELECT * FROM zeros_products WHERE id = $1",
    [productId],
  );
  return result.rows[0] || null;
}

// --- PRODUCT ACCESS ---

// WORKFLOW: getProductAccess
// TRIGGERED BY: GET /api/v1/products/access
// WHAT IT DOES: Fetches all product access records for a user
export async function getProductAccess(
  userId: string,
): Promise<ProductAccess[]> {
  const result = await query<ProductAccess>(
    "SELECT * FROM zeros_product_access WHERE user_id = $1",
    [userId],
  );
  return result.rows;
}

// WORKFLOW: registerProductAccess
// TRIGGERED BY: POST /api/v1/products/access, POST /api/v1/auth/verify with product_id
// WHAT IT DOES:
// 1. Inserts product access or updates last_accessed_at if exists
// 2. Returns the access record
export async function registerProductAccess(
  userId: string,
  productId: string,
): Promise<ProductAccess | null> {
  const result = await query<ProductAccess>(
    `INSERT INTO zeros_product_access (user_id, product_id, status, last_accessed_at)
     VALUES ($1, $2, 'active', NOW())
     ON CONFLICT (user_id, product_id) DO UPDATE SET
       last_accessed_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [userId, productId],
  );
  return result.rows[0] || null;
}

// --- AUDIT LOG ---

// WORKFLOW: logAuditEvent
// TRIGGERED BY: Various actions (signup, login, profile update, etc.)
// WHAT IT DOES: Creates an audit log entry
export async function logAuditEvent(entry: {
  user_id?: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO zeros_audit_log (user_id, action, resource_type, resource_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.user_id || null,
        entry.action,
        entry.resource_type || null,
        entry.resource_id || null,
        JSON.stringify(entry.metadata || {}),
        entry.ip_address || null,
      ],
    );
  } catch (err) {
    console.error("Failed to log audit event:", err);
  }
}

// --- ADMIN QUERIES ---

// WORKFLOW: getAllProfiles
// TRIGGERED BY: GET /api/v1/admin/users
// WHAT IT DOES: Fetches all user profiles with pagination
export async function getAllProfiles(
  page: number = 1,
  limit: number = 50,
): Promise<{ profiles: ZeroProfile[]; total: number }> {
  const offset = (page - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    query<ZeroProfile>(
      "SELECT * FROM zeros_profiles ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset],
    ),
    query<{ count: string }>(
      "SELECT COUNT(*) as count FROM zeros_profiles",
    ),
  ]);

  return {
    profiles: dataResult.rows,
    total: parseInt(countResult.rows[0]?.count || "0", 10),
  };
}

// WORKFLOW: getStats
// TRIGGERED BY: GET /api/v1/admin/stats
// WHAT IT DOES: Fetches aggregate stats for the admin dashboard
export async function getStats(): Promise<{
  total_users: number;
  total_zeros_product_accesses: number;
  products: { product_id: string; user_count: number }[];
}> {
  const [usersResult, accessResult, productStatsResult] = await Promise.all([
    query<{ count: string }>("SELECT COUNT(*) as count FROM zeros_profiles"),
    query<{ count: string }>("SELECT COUNT(*) as count FROM zeros_product_access"),
    query<{ product_id: string; user_count: string }>(
      "SELECT product_id, COUNT(*) as user_count FROM zeros_product_access GROUP BY product_id",
    ),
  ]);

  return {
    total_users: parseInt(usersResult.rows[0]?.count || "0", 10),
    total_zeros_product_accesses: parseInt(accessResult.rows[0]?.count || "0", 10),
    products: productStatsResult.rows.map((r) => ({
      product_id: r.product_id,
      user_count: parseInt(r.user_count, 10),
    })),
  };
}
