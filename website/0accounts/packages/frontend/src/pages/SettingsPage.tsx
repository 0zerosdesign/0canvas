// ============================================
// PAGE: SettingsPage
// ROUTE: /settings
// PURPOSE: Account settings — password change, preferences, danger zone
// ============================================

import { useState } from "react";
import { toast } from "sonner";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import { getSupabaseClient } from "../supabase/client";
import { useAppStore } from "../store";
import "./SettingsPage.css";

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}

function SettingsContent() {
  // --- VARIABLES ---

  const authSession = useAppStore((s) => s.authSession);

  // New password input
  const [newPassword, setNewPassword] = useState("");

  // Confirm new password input
  const [confirmPassword, setConfirmPassword] = useState("");

  // Whether password update is in progress
  const [changingPassword, setChangingPassword] = useState(false);

  // --- WORKFLOWS ---

  // WORKFLOW: onChangePassword
  // TRIGGERED BY: Password form submit
  // WHAT IT DOES:
  // 1. Validates passwords match and meet minimum length
  // 2. Updates password via Supabase
  // 3. Clears form on success
  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setChangingPassword(true);

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Password updated successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to update password.");
    } finally {
      setChangingPassword(false);
    }
  }

  // --- RENDER ---

  return (
    <div className="settings-page">
      <section className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your account settings and preferences
        </p>
      </section>

      {/* Account Info */}
      <section className="settings-section">
        <h2 className="settings-section-title">Account</h2>
        <div className="settings-card">
          <div className="settings-row">
            <span className="settings-row-label">Email</span>
            <span className="settings-row-value">{authSession?.email}</span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">User ID</span>
            <span className="settings-row-value settings-mono">
              {authSession?.userId}
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">Role</span>
            <span className="settings-row-value">
              {authSession?.isAdmin ? "Admin" : "User"}
            </span>
          </div>
        </div>
      </section>

      {/* Change Password */}
      <section className="settings-section">
        <h2 className="settings-section-title">Change Password</h2>
        <form className="settings-card" onSubmit={onChangePassword}>
          <div className="settings-field">
            <label className="settings-label" htmlFor="new-password">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <div className="settings-field">
            <label className="settings-label" htmlFor="confirm-new-password">
              Confirm New Password
            </label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="settings-btn"
            disabled={changingPassword || !newPassword || !confirmPassword}
          >
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </section>
    </div>
  );
}
