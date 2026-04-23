// ============================================
// HOOK: useZerosAuth
// PURPOSE: Access zeros auth state from any component
// USED IN: Any component that needs auth data (header, profile, protected routes)
// ============================================

import { useContext } from "react";
import { ZerosAuthContext, type ZerosAuthContextValue } from "./ZerosAuthProvider.js";

// WORKFLOW: useZerosAuth
// TRIGGERED BY: Any component that needs auth state
// WHAT IT DOES: Returns the auth context value
// THROWS: Error if used outside ZerosAuthProvider
export function useZerosAuth(): ZerosAuthContextValue {
  const context = useContext(ZerosAuthContext);

  if (!context) {
    throw new Error(
      "useZerosAuth must be used within a <ZerosAuthProvider>. " +
      "Wrap your app with <ZerosAuthProvider config={{ productId: '0colors' }}>.",
    );
  }

  return context;
}
