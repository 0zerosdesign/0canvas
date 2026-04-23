// ============================================
// ROUTES: Auth
// PURPOSE: Authentication endpoints — verify tokens, create users
// USED BY: All Zero products + 0accounts frontend
// ============================================

import { Hono } from "hono";
import { getSupabase } from "../supabase.js";
import { getAuthUser, verifyServiceKey } from "../middleware/auth.js";
import {
  getProfile,
  createProfile,
  registerProductAccess,
  logAuditEvent,
} from "../db.js";
import { rateLimiter, getClientIp } from "../services/rate-limit.js";
import type { AuthSignupRequest, AuthVerifyRequest } from "../types.js";

export const authRoutes = new Hono();

// POST /api/v1/auth/verify
// Verifies a user's JWT token and returns their profile
// Optionally registers product access if product_id is provided
// Supports both JWT auth (X-User-Token) and service key auth (X-Service-Key)
authRoutes.post("/auth/verify", async (c) => {
  // Rate limit: 20 requests per minute per IP
  const ip = getClientIp(c.req.header("x-forwarded-for"));
  if (!(await rateLimiter.check(`verify:${ip}`, 20))) {
    return c.json({ error: "Too many requests. Try again later." }, 429);
  }

  const body = await c.req.json<AuthVerifyRequest & { user_id?: string; email?: string; name?: string }>().catch(
    () => ({} as AuthVerifyRequest & { user_id?: string; email?: string; name?: string }),
  );

  let userId: string;
  let email: string;
  let name: string;

  // Check if this is a service-to-service call (e.g., 0colors backend)
  if (verifyServiceKey(c) && body.user_id) {
    userId = body.user_id;
    email = body.email || "";
    name = body.name || "";
  } else {
    // Standard JWT verification
    const user = await getAuthUser(c);
    if (!user) {
      return c.json({ valid: false, error: "Invalid or expired token" }, 401);
    }
    userId = user.userId;
    email = user.email;
    name = user.name;
  }

  // Ensure zero_profile exists (auto-create if missing)
  let profile = await getProfile(userId);
  if (!profile) {
    profile = await createProfile(userId, email, name);
  }

  // Register product access if product_id provided
  let productAccess = null;
  if (body.product_id) {
    productAccess = await registerProductAccess(userId, body.product_id);
  }

  // Build response
  const response: Record<string, unknown> = {
    valid: true,
    user: {
      id: profile?.id || userId,
      email: profile?.email || email,
      name: profile?.name || name,
      display_name: profile?.display_name || null,
      avatar_url: profile?.avatar_url || null,
      role: profile?.role || "user",
      is_admin: profile?.is_admin || false,
    },
  };

  if (productAccess) {
    response.product_access = {
      product_id: productAccess.product_id,
      status: productAccess.status,
      first_accessed_at: productAccess.first_accessed_at,
    };
  }

  return c.json(response);
});

// POST /api/v1/auth/signup
// Creates a new user via Supabase Auth admin API + zero_profile
authRoutes.post("/auth/signup", async (c) => {
  // Rate limit: 5 signups per minute per IP (strict to prevent spam)
  const ip = getClientIp(c.req.header("x-forwarded-for"));
  if (!(await rateLimiter.check(`signup:${ip}`, 5))) {
    return c.json({ error: "Too many signup attempts. Try again later." }, 429);
  }

  const body = await c.req.json<AuthSignupRequest>().catch(() => null);

  if (!body?.email || !body?.password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email.trim())) {
    return c.json({ error: "Invalid email format" }, 400);
  }

  // Validate password strength
  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  const supabase = getSupabase();

  // Create user via Supabase Auth admin API
  const { data, error } = await supabase.auth.admin.createUser({
    email: body.email,
    password: body.password,
    user_metadata: { name: body.name || body.email.split("@")[0] },
    email_confirm: false,
  });

  if (error) {
    // Handle "user already exists" gracefully
    if (error.message.includes("already been registered")) {
      return c.json({ error: "A user with this email already exists" }, 409);
    }
    return c.json({ error: error.message }, 400);
  }

  if (!data.user) {
    return c.json({ error: "Failed to create user" }, 500);
  }

  // Create zero_profile
  await createProfile(
    data.user.id,
    body.email,
    body.name || body.email.split("@")[0],
  );

  // Register product access if product_id provided
  if (body.product_id) {
    await registerProductAccess(data.user.id, body.product_id);
  }

  // Log signup event
  await logAuditEvent({
    user_id: data.user.id,
    action: "signup",
    resource_type: "profile",
    resource_id: data.user.id,
    metadata: { product_id: body.product_id || null },
  });

  return c.json({
    success: true,
    user_id: data.user.id,
    requires_verification: true,
  });
});
