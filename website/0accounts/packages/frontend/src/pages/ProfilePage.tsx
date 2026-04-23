// ============================================
// PAGE: ProfilePage
// ROUTE: /profile
// PURPOSE: Edit user profile (name, display name, bio, avatar)
// ============================================

import { useEffect, useState } from "react";
import { toast } from "sonner";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import { useProfile } from "../hooks/useProfile";
import "./ProfilePage.css";

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}

function ProfileContent() {
  // --- VARIABLES ---

  const { profile, fetchProfile, updateProfile } = useProfile();

  // Form field: user's name
  const [name, setName] = useState("");

  // Form field: user's display name
  const [displayName, setDisplayName] = useState("");

  // Form field: user's bio
  const [bio, setBio] = useState("");

  // Form field: user's avatar URL
  const [avatarUrl, setAvatarUrl] = useState("");

  // Whether save is in progress
  const [saving, setSaving] = useState(false);

  // --- WORKFLOWS ---

  // WORKFLOW: loadProfile
  // TRIGGERED BY: Page mount
  // WHAT IT DOES: Fetches profile and populates form fields
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  // WORKFLOW: onSave
  // TRIGGERED BY: Form submit
  // WHAT IT DOES: Saves updated profile to the API
  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const success = await updateProfile({
      name: name.trim(),
      display_name: displayName.trim() || undefined,
      bio: bio.trim() || undefined,
      avatar_url: avatarUrl.trim() || undefined,
    });

    if (success) {
      toast.success("Profile updated.");
    } else {
      toast.error("Failed to update profile.");
    }

    setSaving(false);
  }

  // --- RENDER ---

  return (
    <div className="profile-page">
      <section className="profile-header">
        <h1 className="profile-title">Profile</h1>
        <p className="profile-subtitle">
          Manage your Zero account profile
        </p>
      </section>

      <form className="profile-form" onSubmit={onSave}>
        <div className="profile-field">
          <label className="profile-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={profile?.email || ""}
            disabled
            className="profile-input-disabled"
          />
          <span className="profile-hint">
            Email cannot be changed here. Contact support to update your email.
          </span>
        </div>

        <div className="profile-field">
          <label className="profile-label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="profile-field">
          <label className="profile-label" htmlFor="display-name">
            Display Name <span className="profile-optional">(optional)</span>
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you want to be shown"
          />
        </div>

        <div className="profile-field">
          <label className="profile-label" htmlFor="bio">
            Bio <span className="profile-optional">(optional)</span>
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell us about yourself"
            rows={3}
          />
        </div>

        <div className="profile-field">
          <label className="profile-label" htmlFor="avatar-url">
            Avatar URL <span className="profile-optional">(optional)</span>
          </label>
          <input
            id="avatar-url"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/your-avatar.jpg"
          />
        </div>

        <button
          type="submit"
          className="profile-save-btn"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
