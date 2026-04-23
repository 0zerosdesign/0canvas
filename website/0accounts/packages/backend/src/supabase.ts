// ============================================
// MODULE: Supabase Client
// PURPOSE: Initialize Supabase client with service role key for admin operations
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton Supabase client instance
let supabaseClient: SupabaseClient | null = null;

// WORKFLOW: getSupabase
// TRIGGERED BY: Any module that needs database or auth access
// WHAT IT DOES:
// 1. Returns existing client if already initialized
// 2. Validates environment variables
// 3. Creates Supabase client with service role key (bypasses RLS)
export function getSupabase(): SupabaseClient {
  if (supabaseClient) return supabaseClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables",
    );
  }

  supabaseClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}
