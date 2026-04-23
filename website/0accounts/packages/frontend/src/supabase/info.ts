// ============================================
// MODULE: Supabase Info
// PURPOSE: Supabase project ID and public anon key (safe to expose in browser)
// ============================================

export const projectId = "qvayepdjxvkdeiczjzfj";

// Public anon key — this is safe to expose in the browser
// It only grants access to public endpoints and RLS-protected tables
export const publicAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2YXllcGRqeHZrZGVpY3pqemZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTMxNTUsImV4cCI6MjA4NzU4OTE1NX0.3mAW-M5p2GxU0wHO6PYQS-ihlaJYdhWOzWL0WtiCFaY";
