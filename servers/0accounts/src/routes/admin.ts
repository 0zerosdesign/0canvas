// ============================================
// ROUTES: Admin
// PURPOSE: Admin-only endpoints for user management and stats
// ============================================

import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth.js";
import { getAllProfiles, getProfile, getProductAccess, getStats } from "../db.js";

export const adminRoutes = new Hono();

// GET /api/v1/admin/users
// List all users with pagination (admin only)
adminRoutes.get("/admin/users", async (c) => {
  const admin = await requireAdmin(c);
  if (!admin) return c.json({ error: "Forbidden" }, 403);

  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "50", 10);

  const { profiles, total } = await getAllProfiles(page, limit);

  return c.json({
    users: profiles,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

// GET /api/v1/admin/users/:id
// Get a specific user's full profile with product access (admin only)
adminRoutes.get("/admin/users/:id", async (c) => {
  const admin = await requireAdmin(c);
  if (!admin) return c.json({ error: "Forbidden" }, 403);

  const userId = c.req.param("id");
  const profile = await getProfile(userId);

  if (!profile) {
    return c.json({ error: "User not found" }, 404);
  }

  const access = await getProductAccess(userId);

  return c.json({ user: profile, product_access: access });
});

// GET /api/v1/admin/stats
// Dashboard stats: user counts, product access counts (admin only)
adminRoutes.get("/admin/stats", async (c) => {
  const admin = await requireAdmin(c);
  if (!admin) return c.json({ error: "Forbidden" }, 403);

  const stats = await getStats();
  return c.json(stats);
});
