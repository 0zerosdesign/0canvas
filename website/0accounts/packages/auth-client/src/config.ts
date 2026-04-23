// ============================================
// MODULE: Config
// PURPOSE: Default configuration and constants for zeros auth
// ============================================

import type { ZerosAuthConfig } from "./types.js";

// Shared Supabase project (same across all zeros products)
export const SUPABASE_PROJECT_ID = "qvayepdjxvkdeiczjzfj";
export const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2YXllcGRqeHZrZGVpY3pqemZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTMxNTUsImV4cCI6MjA4NzU4OTE1NX0.3mAW-M5p2GxU0wHO6PYQS-ihlaJYdhWOzWL0WtiCFaY";

// 0accounts service URLs
export const ACCOUNTS_API_URL = "https://accounts-api.zeros.design/api/v1";
export const ACCOUNTS_LOGIN_URL = "https://accounts.zeros.design/login";

// localStorage key for session (shared across all products on same domain)
export const SESSION_STORAGE_KEY = `sb-${SUPABASE_PROJECT_ID}-auth-token`;

// WORKFLOW: resolveConfig
// TRIGGERED BY: ZerosAuth constructor
// WHAT IT DOES: Merges user config with defaults
export function resolveConfig(config: ZerosAuthConfig): Required<ZerosAuthConfig> {
  return {
    productId: config.productId,
    accountsApiUrl: config.accountsApiUrl || ACCOUNTS_API_URL,
    supabaseUrl: config.supabaseUrl || SUPABASE_URL,
    supabaseAnonKey: config.supabaseAnonKey || SUPABASE_ANON_KEY,
    loginUrl: config.loginUrl || ACCOUNTS_LOGIN_URL,
    autoRedirect: config.autoRedirect ?? false,
    serviceKey: config.serviceKey || "",
  };
}
