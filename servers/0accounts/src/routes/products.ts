// ============================================
// ROUTES: Products
// PURPOSE: Product registry and user product access endpoints
// ============================================

import { Hono } from "hono";
import { requireAuth } from "../middleware/auth.js";
import {
  getAllProducts,
  getProduct,
  getProductAccess,
  registerProductAccess,
  logAuditEvent,
} from "../db.js";
import type { ProductAccessRequest } from "../types.js";

export const productRoutes = new Hono();

// GET /api/v1/products
// Lists all Zero products (public — no auth required)
productRoutes.get("/products", async (c) => {
  const products = await getAllProducts();
  return c.json({ products });
});

// GET /api/v1/products/:id
// Get a single product by ID (public)
productRoutes.get("/products/:id", async (c) => {
  const productId = c.req.param("id");
  const product = await getProduct(productId);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  return c.json({ product });
});

// GET /api/v1/products/access
// Get the current user's product access list
productRoutes.get("/products/access", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const accessRecords = await getProductAccess(user.userId);
  return c.json({ access: accessRecords });
});

// POST /api/v1/products/access
// Register user's access to a product
productRoutes.post("/products/access", async (c) => {
  const user = await requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json<ProductAccessRequest>().catch(() => null);
  if (!body?.product_id) {
    return c.json({ error: "product_id is required" }, 400);
  }

  // Verify product exists
  const product = await getProduct(body.product_id);
  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  const access = await registerProductAccess(user.userId, body.product_id);
  if (!access) {
    return c.json({ error: "Failed to register product access" }, 500);
  }

  // Log product access
  await logAuditEvent({
    user_id: user.userId,
    action: "product_access",
    resource_type: "product",
    resource_id: body.product_id,
  });

  return c.json({ success: true, access });
});
