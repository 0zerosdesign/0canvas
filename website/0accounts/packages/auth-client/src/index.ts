// ============================================
// EXPORTS: @zeros/auth-client
// PURPOSE: Shared authentication client for all zeros.design products
//
// USAGE (core — any framework):
//   import { signInWithEmail, signInWithGoogle, getSession, signOut } from '@zeros/auth-client'
//
// USAGE (React):
//   import { ZerosAuthProvider, useZerosAuth } from '@zeros/auth-client/react'
// ============================================

// --- Types ---
export type {
  ZerosAuthConfig,
  ZerosSession,
  ZerosUser,
  ZerosProductAccess,
  ZerosVerifyResponse,
  ZerosAuthEvent,
  ZerosAuthListener,
} from "./types.js";

// --- Config ---
export {
  SUPABASE_PROJECT_ID,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  ACCOUNTS_API_URL,
  ACCOUNTS_LOGIN_URL,
} from "./config.js";

// --- Supabase Client ---
export { getSupabase, resetClient } from "./client.js";

// --- Auth Methods ---
export {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  signOut,
  resetPassword,
  updatePassword,
  resendVerification,
  getSession,
  onAuthStateChange,
} from "./auth.js";

// --- 0accounts API ---
export {
  verifyWithAccounts,
  getProfile,
  registerProductAccess,
  verifyFromBackend,
} from "./api.js";

// --- Redirect Helpers ---
export {
  redirectToLogin,
  getRedirectParams,
  isAuthenticated,
} from "./redirect.js";
