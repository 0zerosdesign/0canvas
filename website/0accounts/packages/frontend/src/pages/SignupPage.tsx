// ============================================
// PAGE: SignupPage
// ROUTE: /signup
// PURPOSE: Create a new Zero account
// ============================================

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { getSupabaseClient } from "../supabase/client";
import "./AuthPages.css";

export default function SignupPage() {
  // --- VARIABLES ---

  // User's name input
  const [name, setName] = useState("");

  // User's email input
  const [email, setEmail] = useState("");

  // User's password input
  const [password, setPassword] = useState("");

  // Whether the signup request is in progress
  const [loading, setLoading] = useState(false);

  // Whether verification email has been sent
  const [emailSent, setEmailSent] = useState(false);

  const [searchParams] = useSearchParams();

  // Product that initiated the signup
  const productId = searchParams.get("product_id");

  // --- WORKFLOWS ---

  // WORKFLOW: onGoogleSignUp
  // TRIGGERED BY: Click on "Sign up with Google" button
  // WHAT IT DOES: Initiates Google OAuth flow via Supabase
  async function onGoogleSignUp() {
    const supabase = getSupabaseClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  // WORKFLOW: onSubmit
  // TRIGGERED BY: Form submit
  // WHAT IT DOES:
  // 1. Validates inputs
  // 2. Signs up via Supabase auth
  // 3. Shows verification email prompt
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return;

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { name: name.trim() || email.split("@")[0] },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        if (error.message.includes("already been registered")) {
          toast.error("An account with this email already exists. Try signing in.");
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (data.user) {
        setEmailSent(true);
        toast.success("Verification email sent! Check your inbox.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- RENDER ---

  // Show verification email screen after signup
  if (emailSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              We sent a verification link to <strong>{email}</strong>.
              Click the link in the email to activate your Zero account.
            </p>
          </div>

          <div className="auth-footer">
            <Link to="/login" className="auth-link">
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">Create a Zero Account</h1>
          <p className="auth-subtitle">
            One account for all Zero products
          </p>
        </div>

        <button
          type="button"
          className="auth-google-btn"
          onClick={onGoogleSignUp}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>

        <div className="auth-divider">
          <span className="auth-divider-line"></span>
          <span className="auth-divider-text">or</span>
          <span className="auth-divider-line"></span>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="name">
              Name <span className="auth-optional">(optional)</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              autoFocus
            />
          </div>

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
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || !email.trim() || !password}
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <div className="auth-footer">
          <span className="auth-footer-text">Already have an account?</span>
          <Link
            to={`/login${productId ? `?product_id=${productId}` : ""}`}
            className="auth-link"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
