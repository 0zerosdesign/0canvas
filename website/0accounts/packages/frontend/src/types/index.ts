// ============================================
// TYPES: Frontend shared types
// PURPOSE: TypeScript interfaces for all frontend modules
// ============================================

// --- AUTH ---

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

// --- PROFILE ---

export interface ZeroProfile {
  id: string;
  email: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  preferences: Record<string, unknown>;
  role: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  products: ProductWithAccess[];
}

// --- PRODUCTS ---

export interface ZeroProduct {
  product_id: string;
  name: string;
  display_name: string;
  url: string;
  icon_url: string | null;
  color: string | null;
  status: string;
}

export interface ProductWithAccess extends ZeroProduct {
  accessed: boolean;
  access_status: string | null;
  first_accessed_at: string | null;
  last_accessed_at: string | null;
}

// --- API RESPONSES ---

export interface ApiError {
  error: string;
}

export interface AuthVerifyResponse {
  valid: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string;
    is_admin: boolean;
  };
}
