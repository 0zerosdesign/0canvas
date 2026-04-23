// ============================================
// TYPES: @zeros/auth-client
// PURPOSE: Shared types for zeros authentication across all products
// ============================================

// --- CONFIGURATION ---

export interface ZerosAuthConfig {
  // Which product is using this client (e.g., '0colors', '0research')
  productId: string;

  // 0accounts API URL (defaults to https://accounts-api.zeros.design/api/v1)
  accountsApiUrl?: string;

  // Supabase project URL (defaults to the shared zeros Supabase project)
  supabaseUrl?: string;

  // Supabase anon key (defaults to the shared zeros anon key)
  supabaseAnonKey?: string;

  // URL to redirect to for login (defaults to https://accounts.zeros.design/login)
  loginUrl?: string;

  // Whether to auto-redirect to login when no session is found
  autoRedirect?: boolean;

  // Service key for backend-to-backend calls (only used server-side)
  serviceKey?: string;
}

// --- AUTH SESSION ---

export interface ZerosSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
  expiresAt: number;
}

// --- USER PROFILE ---

export interface ZerosUser {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
  isAdmin: boolean;
}

// --- PRODUCT ACCESS ---

export interface ZerosProductAccess {
  productId: string;
  status: string;
  firstAccessedAt: string;
  lastAccessedAt: string;
}

// --- API RESPONSES ---

export interface ZerosVerifyResponse {
  valid: boolean;
  user: ZerosUser;
  productAccess?: {
    product_id: string;
    status: string;
    first_accessed_at: string;
  };
}

// --- AUTH EVENTS ---

export type ZerosAuthEvent =
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "SESSION_EXPIRED";

export type ZerosAuthListener = (
  event: ZerosAuthEvent,
  session: ZerosSession | null,
) => void;
