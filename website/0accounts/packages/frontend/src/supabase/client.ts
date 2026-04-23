// ============================================
// MODULE: Supabase Client
// PURPOSE: Initialize Supabase client for frontend auth operations
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "./info";

// Singleton client instance
let client: SupabaseClient | null = null;

// WORKFLOW: getSupabaseClient
// TRIGGERED BY: Any component or hook that needs auth
// WHAT IT DOES:
// 1. Returns existing client if already created
// 2. Creates new client with Supabase project URL and anon key
// 3. Configures auth: persist session, detect email verification redirects
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = `https://${projectId}.supabase.co`;

  client = createClient(supabaseUrl, publicAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: `sb-${projectId}-auth-token`,
    },
  });

  return client;
}
