// ============================================
// LIB: Supabase Client
// PURPOSE: Singleton Supabase client for frontend queries
// PROJECT: jnkfagcdhwjrzqcgilmt (0research)
// USED BY: feeds.ts (content reads), user preferences, feature flags
// ============================================

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../api/config";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
