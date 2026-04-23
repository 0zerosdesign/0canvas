// ============================================
// PAGE: LoginPage
// ROUTE: /login
// PURPOSE: Sign in to Zero account with email and password
// ============================================

import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getSupabaseClient } from "../supabase/client";
import { useAuth } from "../hooks/useAuth";
import { validateRedirectUrl } from "../lib/validate-redirect";
import "./AuthPages.css";

export default function LoginPage() {
  // --- VARIABLES ---

  // User's email input
  const [email, setEmail] = useState("");

  // User's password input
  const [password, setPassword] = useState("");

  // Whether the sign-in request is in progress
  const [loading, setLoading] = useState(false);

  const { handleSignIn, markFreshLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL to redirect to after login (from product that sent the user here).
  // Validated against the zeros.design allowlist — invalid URLs are dropped
  // so we never forward session tokens to attacker-controlled domains.
  const rawRedirectUrl = searchParams.get("redirect_url");
  const redirectUrl = validateRedirectUrl(rawRedirectUrl);
  const redirectRejected = rawRedirectUrl !== null && redirectUrl === null;

  // Product ID that initiated the login (for tracking)
  const productId = searchParams.get("product_id");

  // Session clearing for product redirects is handled by initAuth() in useAuth.
  // No need for a separate effect here.

  // Warn the user once when their redirect_url was rejected by the allowlist —
  // they'll end up on the dashboard rather than bouncing to an unexpected site.
  useEffect(() => {
    if (redirectRejected) {
      toast.error("Invalid redirect destination. Signing you in to your Zero dashboard.");
    }
  }, [redirectRejected]);

  // --- WORKFLOWS ---

  // WORKFLOW: onGoogleSignIn
  // TRIGGERED BY: Click on "Sign in with Google" button
  // WHAT IT DOES:
  // 1. Initiates Google OAuth flow via Supabase
  // 2. Supabase redirects to Google, then back to our app
  async function onGoogleSignIn() {
    markFreshLogin();
    const supabase = getSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl
          ? `${window.location.origin}/login?redirect_url=${encodeURIComponent(redirectUrl)}`
          : window.location.origin,
      },
    });
  }

  // WORKFLOW: onSubmit
  // TRIGGERED BY: Form submit
  // WHAT IT DOES:
  // 1. Validates email and password
  // 2. Signs in via Supabase auth
  // 3. Calls handleSignIn to store session and fetch profile
  // 4. Redirects to dashboard or redirect_url
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      // Mark that a fresh login is happening — this tells onAuthStateChange
      // that the resulting SIGNED_IN event should trigger the product redirect
      markFreshLogin();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.includes("Email not confirmed")) {
          toast.error("Please verify your email before signing in.");
        } else if (error.message.includes("Invalid login credentials")) {
          toast.error("Invalid email or password.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.session) {
        await handleSignIn(data.session);
        toast.success("Signed in successfully.");

        if (redirectUrl) {
          // redirectUrl has already been validated against the zeros.design
          // allowlist — safe to parse and use directly.
          const target = new URL(redirectUrl);
          target.hash = `access_token=${data.session.access_token}&refresh_token=${data.session.refresh_token}&token_type=bearer&type=signup`;
          window.location.href = target.toString();
        } else {
          navigate("/");
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- RENDER ---

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Sign in to Zero</h1>
          <p className="auth-subtitle">
            {productId
              ? `Sign in to access ${productId}`
              : "Access your Zero account and products"}
          </p>
        </div>

        <button
          type="button"
          className="auth-google-btn"
          onClick={onGoogleSignIn}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <div className="auth-divider">
          <span className="auth-divider-line"></span>
          <span className="auth-divider-text">or</span>
          <span className="auth-divider-line"></span>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || !email.trim() || !password}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/forgot-password" className="auth-link">
            Forgot password?
          </Link>
          <span className="auth-footer-divider">|</span>
          <Link
            to={`/signup${productId ? `?product_id=${productId}` : ""}${redirectUrl ? `&redirect_url=${encodeURIComponent(redirectUrl)}` : ""}`}
            className="auth-link"
          >
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}
