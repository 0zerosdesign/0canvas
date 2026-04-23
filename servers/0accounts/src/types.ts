// ============================================
// TYPES: Backend shared types
// PURPOSE: TypeScript interfaces for all backend modules
// ============================================

// --- ZERO PRODUCTS ---

export interface ZeroProduct {
  id: string;
  name: string;
  display_name: string;
  description: string;
  url: string;
  icon_url: string | null;
  color: string | null;
  status: "active" | "beta" | "coming_soon" | "deprecated";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// --- ZERO PROFILES ---

export interface ZeroProfile {
  id: string;
  email: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  preferences: Record<string, unknown>;
  role: "user" | "admin" | "super_admin";
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

// --- PRODUCT ACCESS ---

export interface ProductAccess {
  id: string;
  user_id: string;
  product_id: string;
  status: "active" | "disabled" | "revoked";
  first_accessed_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// --- AUDIT LOG ---

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// --- API REQUEST/RESPONSE TYPES ---

export interface AuthVerifyRequest {
  product_id?: string;
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
  product_access?: {
    product_id: string;
    status: string;
    first_accessed_at: string;
  };
}

export interface AuthSignupRequest {
  email: string;
  password: string;
  name?: string;
  product_id?: string;
}

export interface ProfileUpdateRequest {
  name?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  preferences?: Record<string, unknown>;
}

export interface ProductAccessRequest {
  product_id: string;
}

// --- AUTH CONTEXT ---

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}
