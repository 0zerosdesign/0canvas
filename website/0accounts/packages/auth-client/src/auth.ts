// ============================================
// MODULE: Auth Methods
// PURPOSE: All authentication operations — sign in, sign up, sign out, OAuth
// USED BY: Every zeros product (0colors, 0research, 0canvas, etc.)
// ============================================

import { getSupabase } from "./client.js";
import type { ZerosSession } from "./types.js";

// WORKFLOW: signInWithEmail
// TRIGGERED BY: Login form submit
// WHAT IT DOES: Signs in with email and password via Supabase
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ session: ZerosSession | null; error: string | null }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    return { session: null, error: error.message };
  }

  if (!data.session) {
    return { session: null, error: "No session returned" };
  }

  return {
    session: mapSession(data.session),
    error: null,
  };
}

// WORKFLOW: signUpWithEmail
// TRIGGERED BY: Signup form submit
// WHAT IT DOES: Creates a new user via Supabase auth
//
// Supabase returns a fake "success" response when the email is already
// registered (with an empty `identities` array) to prevent user
// enumeration. When this happens, `signUp()` does NOT send a verification
// email, so callers should follow up with `resendVerification()` to
// trigger the email. We surface this case via `userAlreadyExists`.
export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string,
  redirectTo?: string,
): Promise<{
  userId: string | null;
  session: ZerosSession | null;
  error: string | null;
  requiresVerification: boolean;
  userAlreadyExists: boolean;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name?.trim() || email.split("@")[0] },
      emailRedirectTo: redirectTo || window.location.origin,
    },
  });

  if (error) {
    return {
      userId: null,
      session: null,
      error: error.message,
      requiresVerification: false,
      userAlreadyExists: false,
    };
  }

  const userAlreadyExists =
    !!data.user && (!data.user.identities || data.user.identities.length === 0);

  return {
    userId: data.user?.id || null,
    // When Supabase auto-confirms (email verification disabled at the
    // project level), signUp returns a session immediately. Otherwise
    // it's null and the caller should prompt the user to verify.
    session: data.session ? mapSession(data.session) : null,
    error: null,
    requiresVerification: !data.session,
    userAlreadyExists,
  };
}

// WORKFLOW: resendVerification
// TRIGGERED BY: User asks to resend signup email, or signUpWithEmail returns
//               userAlreadyExists (Supabase suppresses the first email for
//               duplicate registrations).
// WHAT IT DOES: Asks Supabase to resend the signup verification email.
export async function resendVerification(
  email: string,
  redirectTo?: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim(),
    options: {
      emailRedirectTo: redirectTo || window.location.origin,
    },
  });
  return { error: error?.message || null };
}

// WORKFLOW: signInWithGoogle
// TRIGGERED BY: "Sign in with Google" button click
// WHAT IT DOES: Initiates Google OAuth flow via Supabase
export async function signInWithGoogle(
  redirectTo?: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo || window.location.origin,
    },
  });

  return { error: error?.message || null };
}

// WORKFLOW: signOut
// TRIGGERED BY: User clicks sign out
// WHAT IT DOES: Signs out of Supabase and clears the local session.
//               Uses 'local' scope — only clears THIS domain's session.
//               The accounts.zeros.design login page handles stale sessions
//               independently by clearing them when redirect_url is present.
export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  await supabase.auth.signOut({ scope: 'local' });
}

// WORKFLOW: resetPassword
// TRIGGERED BY: Forgot password form
// WHAT IT DOES: Sends a password reset email via Supabase
export async function resetPassword(
  email: string,
  redirectTo?: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: redirectTo || `${window.location.origin}/reset-password`,
  });

  return { error: error?.message || null };
}

// WORKFLOW: updatePassword
// TRIGGERED BY: Reset password page or settings page
// WHAT IT DOES: Updates the current user's password
export async function updatePassword(
  newPassword: string,
): Promise<{ error: string | null }> {
  const supabase = getSupabase();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error?.message || null };
}

// WORKFLOW: getSession
// TRIGGERED BY: App initialization, auth state check
// WHAT IT DOES: Returns the current Supabase session if one exists
export async function getSession(): Promise<ZerosSession | null> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return null;
  return mapSession(session);
}

// WORKFLOW: onAuthStateChange
// TRIGGERED BY: App initialization
// WHAT IT DOES: Listens for auth state changes (sign in, sign out, token refresh)
export function onAuthStateChange(
  callback: (event: string, session: ZerosSession | null) => void,
): { unsubscribe: () => void } {
  const supabase = getSupabase();
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session ? mapSession(session) : null);
    },
  );

  return { unsubscribe: () => subscription.unsubscribe() };
}

// --- INTERNAL HELPERS ---

// Maps a Supabase session to our ZerosSession type
function mapSession(session: {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  user: {
    id: string;
    email?: string;
    user_metadata?: { name?: string };
  };
}): ZerosSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token || "",
    userId: session.user.id,
    email: session.user.email || "",
    name: session.user.user_metadata?.name || session.user.email?.split("@")[0] || "",
    isAdmin: false,
    expiresAt: session.expires_at || 0,
  };
}
