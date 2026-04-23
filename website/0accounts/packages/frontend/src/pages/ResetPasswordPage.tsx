// ============================================
// PAGE: ResetPasswordPage
// ROUTE: /reset-password
// PURPOSE: Set a new password after clicking the reset link in email
// ============================================

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getSupabaseClient } from "../supabase/client";
import "./AuthPages.css";

export default function ResetPasswordPage() {
  // --- VARIABLES ---

  // New password input
  const [password, setPassword] = useState("");

  // Confirm password input
  const [confirmPassword, setConfirmPassword] = useState("");

  // Whether the reset request is in progress
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  // --- WORKFLOWS ---

  // WORKFLOW: onSubmit
  // TRIGGERED BY: Form submit
  // WHAT IT DOES:
  // 1. Validates passwords match
  // 2. Updates password via Supabase
  // 3. Navigates to login
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated! You can now sign in.");
      navigate("/login");
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
          <h1 className="auth-title">Set new password</h1>
          <p className="auth-subtitle">
            Enter your new password below.
          </p>
        </div>

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="password">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              autoComplete="new-password"
              autoFocus
              minLength={6}
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="confirm-password">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              required
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            className="auth-submit-btn"
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? "Updating..." : "Update Password"}
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
