// ============================================
// STORE: Global State
// PURPOSE: Zustand store for auth session and UI state
// ============================================

import { create } from "zustand";
import type { AuthSession, ZeroProfile } from "../types";

interface AppState {
  // Whether auth check is in progress on initial load
  authChecking: boolean;

  // Current user's auth session (null = not logged in)
  authSession: AuthSession | null;

  // Current user's full profile from 0accounts API
  profile: ZeroProfile | null;

  // --- ACTIONS ---

  // Set auth checking state
  setAuthChecking: (checking: boolean) => void;

  // Set auth session after sign-in
  setAuthSession: (session: AuthSession | null) => void;

  // Set user profile after fetching from API
  setProfile: (profile: ZeroProfile | null) => void;

  // Clear all auth state on sign-out
  clearAuth: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  authChecking: true,
  authSession: null,
  profile: null,

  setAuthChecking: (checking) => set({ authChecking: checking }),

  setAuthSession: (session) => set({ authSession: session }),

  setProfile: (profile) => set({ profile }),

  clearAuth: () =>
    set({
      authSession: null,
      profile: null,
      authChecking: false,
    }),
}));
