// ============================================
// API: Accounts
// BASE URL: /api/v1 (proxied in dev, full URL in production)
// PURPOSE: API client for 0accounts backend endpoints
// ============================================

import type { ZeroProfile, AuthVerifyResponse } from "../types";

// API base URL — proxied to backend in dev, full URL in production
const API_BASE =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV
    ? "/api/v1"
    : "https://accounts-api.zeros.design/api/v1");

// WORKFLOW: makeHeaders
// TRIGGERED BY: All API calls
// WHAT IT DOES: Creates headers with auth token
function makeHeaders(accessToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["X-User-Token"] = accessToken;
  }
  return headers;
}

// --- API 1: Verify Token ---
// Method: POST
// Endpoint: /auth/verify
// Parameters: accessToken (header), product_id (optional body)
// Returns: AuthVerifyResponse
export async function verifyToken(
  accessToken: string,
  productId?: string,
): Promise<AuthVerifyResponse> {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: "POST",
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ product_id: productId }),
  });
  return res.json();
}

// --- API 2: Get Profile ---
// Method: GET
// Endpoint: /profile
// Parameters: accessToken (header)
// Returns: ZeroProfile with products
export async function getProfile(
  accessToken: string,
): Promise<ZeroProfile> {
  const res = await fetch(`${API_BASE}/profile`, {
    method: "GET",
    headers: makeHeaders(accessToken),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

// --- API 3: Update Profile ---
// Method: PUT
// Endpoint: /profile
// Parameters: accessToken (header), profile fields (body)
// Returns: { success: boolean, profile: ZeroProfile }
export async function updateProfile(
  accessToken: string,
  updates: {
    name?: string;
    display_name?: string;
    avatar_url?: string;
    bio?: string;
    preferences?: Record<string, unknown>;
  },
): Promise<{ success: boolean; profile: ZeroProfile }> {
  const res = await fetch(`${API_BASE}/profile`, {
    method: "PUT",
    headers: makeHeaders(accessToken),
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

// --- API 4: Get Products ---
// Method: GET
// Endpoint: /products
// Parameters: none
// Returns: { products: ZeroProduct[] }
export async function getProducts(): Promise<{
  products: { id: string; name: string; display_name: string; url: string; status: string }[];
}> {
  const res = await fetch(`${API_BASE}/products`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return res.json();
}

// --- API 5: Register Product Access ---
// Method: POST
// Endpoint: /products/access
// Parameters: accessToken (header), product_id (body)
// Returns: { success: boolean, access: ProductAccess }
export async function registerProductAccess(
  accessToken: string,
  productId: string,
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/products/access`, {
    method: "POST",
    headers: makeHeaders(accessToken),
    body: JSON.stringify({ product_id: productId }),
  });
  return res.json();
}
