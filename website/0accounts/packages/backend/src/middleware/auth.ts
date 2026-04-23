// ============================================
// MIDDLEWARE: Auth
// PURPOSE: JWT verification and auth helpers for route handlers
// ============================================

import type { Context } from "hono";
import { getSupabase } from "../supabase.js";
import type { AuthUser } from "../types.js";

// WORKFLOW: getAuthUser
// TRIGGERED BY: Any authenticated route
// WHAT IT DOES:
// 1. Extracts JWT from X-User-Token header or Authorization Bearer header
// 2. Verifies token via supabase.auth.getUser()
// 3. Returns user info or null if invalid
export async function getAuthUser(c: Context): Promise<AuthUser | null> {
  const userToken = c.req.header("X-User-Token");
  const authHeader = c.req.header("Authorization");

  // Extract token from either header (same pattern as 0colors)
  const accessToken = userToken || authHeader?.split(" ")[1];

  if (!accessToken) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) return null;

  return {
    userId: data.user.id,
    email: data.user.email || "",
    name: data.user.user_metadata?.name || data.user.email?.split("@")[0] || "",
  };
}

// WORKFLOW: requireAuth
// TRIGGERED BY: Protected routes
// WHAT IT DOES: Returns userId or sends 401 response
export async function requireAuth(c: Context): Promise<AuthUser | null> {
  const user = await getAuthUser(c);
  if (!user) {
    c.status(401);
    return null;
  }
  return user;
}

// WORKFLOW: requireAdmin
// TRIGGERED BY: Admin-only routes
// WHAT IT DOES:
// 1. Verifies auth via requireAuth
// 2. Checks admin status in zeros_profiles
// 3. Returns userId or sends 403
export async function requireAdmin(c: Context): Promise<AuthUser | null> {
  const user = await requireAuth(c);
  if (!user) return null;

  const supabase = getSupabase();
  const { data } = await supabase
    .from("zeros_profiles")
    .select("is_admin")
    .eq("id", user.userId)
    .single();

  if (!data?.is_admin) {
    c.status(403);
    return null;
  }

  return user;
}

// WORKFLOW: verifyServiceKey
// TRIGGERED BY: Service-to-service calls (e.g., 0colors backend → 0accounts)
// WHAT IT DOES: Validates the X-Service-Key header against ZERO_SERVICE_KEY env var
export function verifyServiceKey(c: Context): boolean {
  const serviceKey = c.req.header("X-Service-Key");
  const expectedKey = process.env.ZERO_SERVICE_KEY;

  if (!expectedKey || !serviceKey) return false;
  return serviceKey === expectedKey;
}
