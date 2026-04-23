// ============================================
// SERVICE: User Service
// PURPOSE: Business logic for user operations beyond basic CRUD
// ============================================

import { getProfile, createProfile, getProductAccess } from "../db.js";
import type { ZeroProfile, ProductAccess } from "../types.js";

// WORKFLOW: ensureProfile
// TRIGGERED BY: Auth verify, signup flows
// WHAT IT DOES:
// 1. Checks if profile exists
// 2. Creates one if missing
// 3. Returns the profile
export async function ensureProfile(
  userId: string,
  email: string,
  name: string,
): Promise<ZeroProfile | null> {
  let profile = await getProfile(userId);
  if (!profile) {
    profile = await createProfile(userId, email, name);
  }
  return profile;
}

// WORKFLOW: getUserWithProducts
// TRIGGERED BY: Dashboard, profile pages
// WHAT IT DOES: Returns a user's profile with their product access list
export async function getUserWithProducts(
  userId: string,
): Promise<{ profile: ZeroProfile; access: ProductAccess[] } | null> {
  const profile = await getProfile(userId);
  if (!profile) return null;

  const access = await getProductAccess(userId);
  return { profile, access };
}
