// ============================================
// PAGE: VerifyEmailPage
// ROUTE: /verify-email
// PURPOSE: Handles the email verification redirect from Supabase
// ============================================

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getSupabaseClient } from "../supabase/client";
import { useAuth } from "../hooks/useAuth";
import "./AuthPages.css";

export default function VerifyEmailPage() {
  // --- VARIABLES ---

  // Current verification status
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  const { handleSignIn } = useAuth();
  const navigate = useNavigate();

  // --- WORKFLOWS ---

  // WORKFLOW: checkVerification
  // TRIGGERED BY: Page mount
  // WHAT IT DOES:
  // 1. Checks if there's a session from the email verification redirect
  // 2. If yes, signs the user in and redirects to dashboard
  // 3. If no, shows error
  useEffect(() => {
    async function checkVerification() {
      try {
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setStatus("success");
          await handleSignIn(session);

          // Redirect to dashboard after a short delay
          setTimeout(() => navigate("/"), 1500);
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }

    checkVerification();
  }, [handleSignIn, navigate]);

  // --- RENDER ---

  return (
    <div className="auth-page">
      <div className="auth-card">
        {status === "verifying" && (
          <div className="auth-header">
            <h1 className="auth-title">Verifying your email...</h1>
            <p className="auth-subtitle">Please wait while we verify your account.</p>
          </div>
        )}

        {status === "success" && (
          <div className="auth-header">
            <h1 className="auth-title">Email verified!</h1>
            <p className="auth-subtitle">
              Your Zero account is now active. Redirecting to dashboard...
            </p>
          </div>
        )}

        {status === "error" && (
          <>
            <div className="auth-header">
              <h1 className="auth-title">Verification failed</h1>
              <p className="auth-subtitle">
                The verification link may have expired. Please try signing in or request a new link.
              </p>
            </div>
            <div className="auth-footer">
              <Link to="/login" className="auth-link">
                Go to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
