// ============================================
// SERVICE: Product Service
// PURPOSE: Business logic for product operations
// ============================================

import { getAllProducts, getProduct, registerProductAccess } from "../db.js";
import type { ZeroProduct, ProductAccess } from "../types.js";

// WORKFLOW: getActiveProducts
// TRIGGERED BY: Product listing endpoints
// WHAT IT DOES: Returns only active products (not deprecated)
export async function getActiveProducts(): Promise<ZeroProduct[]> {
  const products = await getAllProducts();
  return products.filter((p) => p.status !== "deprecated");
}

// WORKFLOW: grantProductAccess
// TRIGGERED BY: Cross-product auth flow, admin actions
// WHAT IT DOES:
// 1. Validates the product exists
// 2. Registers product access for the user
// 3. Returns the access record or null if product doesn't exist
export async function grantProductAccess(
  userId: string,
  productId: string,
): Promise<ProductAccess | null> {
  const product = await getProduct(productId);
  if (!product) return null;

  return registerProductAccess(userId, productId);
}
