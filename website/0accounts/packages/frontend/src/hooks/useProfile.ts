// ============================================
// HOOK: useProfile
// PURPOSE: Fetches and updates the current user's profile
// USED IN: ProfilePage, DashboardPage
// ============================================

import { useCallback } from "react";
import { useAppStore } from "../store";
import { getProfile, updateProfile as updateProfileApi } from "../api/accounts";

export function useProfile() {
  const { authSession, profile, setProfile } = useAppStore();

  // WORKFLOW: fetchProfile
  // TRIGGERED BY: DashboardPage mount, ProfilePage mount
  // WHAT IT DOES: Fetches the user's full profile from the API
  const fetchProfile = useCallback(async () => {
    if (!authSession?.accessToken) return null;

    try {
      const data = await getProfile(authSession.accessToken);
      setProfile(data);
      return data;
    } catch {
      return null;
    }
  }, [authSession?.accessToken, setProfile]);

  // WORKFLOW: updateProfile
  // TRIGGERED BY: ProfilePage form submit
  // WHAT IT DOES: Updates the user's profile and refreshes local state
  const updateProfile = useCallback(
    async (updates: {
      name?: string;
      display_name?: string;
      avatar_url?: string;
      bio?: string;
      preferences?: Record<string, unknown>;
    }) => {
      if (!authSession?.accessToken) return false;

      try {
        const { profile: updated } = await updateProfileApi(
          authSession.accessToken,
          updates,
        );
        setProfile(updated);
        return true;
      } catch {
        return false;
      }
    },
    [authSession?.accessToken, setProfile],
  );

  return { profile, fetchProfile, updateProfile };
}
