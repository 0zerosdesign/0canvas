// ============================================
// MODULE: 0accounts API Client
// PURPOSE: Communicate with the 0accounts backend for profile/product operations
// USED BY: All zeros products — verifies tokens, registers product access
// ============================================

import { ACCOUNTS_API_URL } from "./config.js";
import type { ZerosVerifyResponse, ZerosUser } from "./types.js";

// WORKFLOW: verifyWithAccounts
// TRIGGERED BY: Product app initialization (after getting Supabase session)
// WHAT IT DOES:
// 1. Sends the JWT to 0accounts backend for verification
// 2. Optionally registers which product the user is accessing
// 3. Returns the verified user profile (mapped from snake_case API response)
export async function verifyWithAccounts(
  accessToken: string,
  productId?: string,
  apiUrl?: string,
): Promise<ZerosVerifyResponse | null> {
  try {
    const res = await fetch(`${apiUrl || ACCOUNTS_API_URL}/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Token": accessToken,
      },
      body: JSON.stringify({ product_id: productId }),
    });

    if (!res.ok) return null;
    const raw = await res.json();

    // Map snake_case API response to camelCase TypeScript types
    if (raw?.valid && raw.user) {
      return {
        valid: true,
        user: {
          id: raw.user.id,
          email: raw.user.email,
          name: raw.user.name,
          displayName: raw.user.display_name ?? null,
          avatarUrl: raw.user.avatar_url ?? null,
          role: raw.user.role || "user",
          isAdmin: raw.user.is_admin === true,
        },
        productAccess: raw.product_access
          ? {
              product_id: raw.product_access.product_id,
              status: raw.product_access.status,
              first_accessed_at: raw.product_access.first_accessed_at,
            }
          : undefined,
      };
    }

    return raw;
  } catch {
    return null;
  }
}

// WORKFLOW: getProfile
// TRIGGERED BY: Dashboard, profile pages
// WHAT IT DOES: Fetches the full user profile with product access list
export async function getProfile(
  accessToken: string,
  apiUrl?: string,
): Promise<(ZerosUser & { products: unknown[] }) | null> {
  try {
    const res = await fetch(`${apiUrl || ACCOUNTS_API_URL}/profile`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-User-Token": accessToken,
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// WORKFLOW: registerProductAccess
// TRIGGERED BY: When a user first visits a product
// WHAT IT DOES: Tells 0accounts that this user accessed this product
export async function registerProductAccess(
  accessToken: string,
  productId: string,
  apiUrl?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl || ACCOUNTS_API_URL}/products/access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Token": accessToken,
      },
      body: JSON.stringify({ product_id: productId }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

// WORKFLOW: verifyFromBackend
// TRIGGERED BY: Product backend (server-side, using service key)
// WHAT IT DOES: Service-to-service verification — backend uses ZERO_SERVICE_KEY
export async function verifyFromBackend(
  userId: string,
  email: string,
  name: string,
  productId: string,
  serviceKey: string,
  apiUrl?: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl || ACCOUNTS_API_URL}/auth/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": serviceKey,
      },
      body: JSON.stringify({
        user_id: userId,
        email,
        name,
        product_id: productId,
      }),
    });

    return res.ok;
  } catch {
    return false;
  }
}
