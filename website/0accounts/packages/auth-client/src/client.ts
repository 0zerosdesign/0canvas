// ============================================
// MODULE: Supabase Client
// PURPOSE: Shared Supabase client initialization for all zeros products
// ============================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SESSION_STORAGE_KEY,
} from "./config.js";

// Singleton client instance
let client: SupabaseClient | null = null;

const SUPABASE_FETCH_TIMEOUT_MS = 15_000;

/**
 * Wrap fetch with a timeout so a hung Supabase edge function (cold start,
 * network partition, etc.) can't lock up the auth state forever. On error
 * we return a synthetic 503 JSON response instead of re-throwing — the
 * Supabase SDK's error handling doesn't always catch thrown network errors,
 * and this keeps `supabase.auth.*` calls returning structured AuthApiErrors
 * rather than unhandled promise rejections.
 */
function resilientFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  if (init?.signal) {
    if (init.signal.aborted) {
      controller.abort(init.signal.reason);
    } else {
      init.signal.addEventListener(
        "abort",
        () => controller.abort(init.signal!.reason),
        { once: true },
      );
    }
  }
  const timeout = setTimeout(
    () => controller.abort("Supabase fetch timeout"),
    SUPABASE_FETCH_TIMEOUT_MS,
  );

  return fetch(input, { ...init, signal: controller.signal })
    .catch(() => {
      return new Response(
        JSON.stringify({
          message: "Network request failed",
          error: "network_error",
          error_description:
            "The server could not be reached. This is usually temporary.",
        }),
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "application/json" },
        },
      );
    })
    .finally(() => clearTimeout(timeout));
}

// WORKFLOW: getSupabase
// TRIGGERED BY: Any auth operation
// WHAT IT DOES:
// 1. Returns existing client if already created
// 2. Creates Supabase client with shared project credentials
// 3. Configures session persistence and token detection
export function getSupabase(
  url?: string,
  anonKey?: string,
): SupabaseClient {
  if (client) return client;

  client = createClient(url || SUPABASE_URL, anonKey || SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      // We handle URL hash tokens manually via useOAuthCallback().
      // detectSessionInUrl is disabled because it fails silently and
      // causes race conditions.
      detectSessionInUrl: false,
      storageKey: SESSION_STORAGE_KEY,
      // Disable Web Locks API to avoid "Lock not released within 5000ms"
      // errors when React Strict Mode double-mounts and two concurrent
      // getSession/refreshSession calls fight for the same lock. The
      // application serialises auth access via the singleton above, so a
      // no-op lock is safe and silences the warnings.
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
    global: {
      fetch: resilientFetch,
    },
  });

  return client;
}

// WORKFLOW: resetClient
// TRIGGERED BY: Testing or reconfiguration
// WHAT IT DOES: Clears the singleton client (useful for tests)
export function resetClient(): void {
  client = null;
}
