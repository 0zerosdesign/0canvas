/// <reference types="vite/client" />
// ============================================
// API CONFIG: Base URLs and Configuration
// PURPOSE: Central place to update all API endpoints
// AUTH: Handled by @0zerosdesign/auth-client (accounts.zeros.design)
// ============================================

// --- DIRECTUS CMS (content creation tool — admin use only) ---
// Frontend will migrate to Supabase for content reads (Phase 3).
// Directus remains the authoring backend.
export const DIRECTUS_URL = "https://cms.0research.zeros.design";

// --- SUPABASE (0research app backend) ---
// Project: jnkfagcdhwjrzqcgilmt
// Read from .env via Vite (VITE_ prefix exposes to frontend)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
