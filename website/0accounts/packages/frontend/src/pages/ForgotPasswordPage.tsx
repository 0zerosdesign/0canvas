// ============================================
// PAGE: ForgotPasswordPage
// ROUTE: /forgot-password
// PURPOSE: Send a password reset email
// ============================================

import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { getSupabaseClient } from "../supabase/client";
import "./AuthPages.css";

export default function ForgotPasswordPage() {
  // --- VARIABLES ---

  // User's email input
  const [email, setEmail] = useState("");

  // Whether the reset request is in progress
  const [loading, setLoading] = useState(false);

  // Whether the reset email has been sent
  const [emailSent, setEmailSent] = useState(false);

  // --- WORKFLOWS ---

  // WORKFLOW: onSubmit
  // TRIGGERED BY: Form submit
  // WHAT IT DOES:
  // 1. Sends password reset email via Supabase
  // 2. Shows confirmation message
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` },
      );

      if (error) {
        toast.error(error.message);
        return;
      }

      setEmailSent(true);
      toast.success("Password reset email sent!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- RENDER ---

  if (emailSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              We sent a password reset link to <strong>{email}</strong>.
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
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-subtitle">
            Enter your email and we'll send you a reset link.
          </p>
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

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || !email.trim()}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <div className="auth-footer">
          <Link to="/login" className="auth-link">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
