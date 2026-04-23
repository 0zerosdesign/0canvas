// ============================================
// ROUTES: Profile
// PURPOSE: User profile CRUD endpoints
// ============================================

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import {
  getProfile,
  updateProfile,
  getProductAccess,
  getAllProducts,
  logAuditEvent,
} from "../db.js";
import type { ProfileUpdateRequest } from "../types.js";

export const profileRoutes = new Hono();

// GET /api/v1/profile
// Returns the current user's profile with their product access list
profileRoutes.get("/profile", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const profile = await getProfile(user.userId);
  if (!profile) {
    return c.json({ error: "Profile not found" }, 404);
  }

  // Fetch product access records
  const accessRecords = await getProductAccess(user.userId);
  const allProducts = await getAllProducts();

  // Join product info with access records
  const products = allProducts.map((product) => {
    const access = accessRecords.find((a) => a.product_id === product.id);
    return {
      product_id: product.id,
      name: product.name,
      display_name: product.display_name,
      url: product.url,
      icon_url: product.icon_url,
      color: product.color,
      status: product.status,
      accessed: !!access,
      access_status: access?.status || null,
      first_accessed_at: access?.first_accessed_at || null,
      last_accessed_at: access?.last_accessed_at || null,
    };
  });

  return c.json({
    ...profile,
    products,
  });
});

// PUT /api/v1/profile
// Updates the current user's profile
profileRoutes.put("/profile", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<ProfileUpdateRequest>().catch(() => null);
  if (!body) {
    return c.json({ error: "Invalid request body" }, 400);
  }

  // Only allow known fields
  const updates: ProfileUpdateRequest = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.avatar_url !== undefined) updates.avatar_url = body.avatar_url;
  if (body.bio !== undefined) updates.bio = body.bio;
  if (body.preferences !== undefined) updates.preferences = body.preferences;

  const profile = await updateProfile(user.userId, updates);
  if (!profile) {
    return c.json({ error: "Failed to update profile" }, 500);
  }

  // Log profile update
  await logAuditEvent({
    user_id: user.userId,
    action: "profile_update",
    resource_type: "profile",
    resource_id: user.userId,
    metadata: { fields: Object.keys(updates) },
  });

  return c.json({ success: true, profile });
});
