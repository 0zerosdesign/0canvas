// ============================================
// COMPONENT: AuthButton
// PURPOSE: Header affordance that shows "Sign in" for anonymous
//          visitors and a user avatar/menu for signed-in users.
//          Used in the public feed header + the mobile top bar —
//          lets visitors opt into signing in without forcing them.
// USED IN: components/feed/ListFeedHeader, components/feed/MobileTopBar
// ============================================

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";

export function AuthButton() {
  // --- STATE ---
  // Whether the profile dropdown menu is open (shown for signed-in users).
  const [menuOpen, setMenuOpen] = useState(false);

  const { user, session, signIn, signOut, loading } = useZerosAuth();

  // Auth state still resolving → show nothing to avoid flash.
  if (loading) return null;

  // WORKFLOW: unauthenticated → Sign in button
  // TRIGGERED BY: click on "Sign in"
  // WHAT IT DOES: hands off to accounts.zeros.design OAuth flow via auth-client.
  if (!user && !session) {
    return (
      <button
        type="button"
        className="zeros-auth-btn"
        onClick={() => signIn()}
      >
        Sign in
      </button>
    );
  }

  // WORKFLOW: authenticated → avatar + dropdown with sign-out
  const initial = (user?.name || session?.email || "U")[0].toUpperCase();

  return (
    <div className="zeros-auth-menu-root">
      <button
        type="button"
        className="zeros-auth-avatar"
        aria-label="Account menu"
        onClick={() => setMenuOpen((v) => !v)}
        title={user?.name || session?.email || "Account"}
      >
        {initial}
      </button>

      {menuOpen && (
        <>
          <div
            className="zeros-auth-menu-backdrop"
            onClick={() => setMenuOpen(false)}
          />
          <div className="zeros-auth-menu">
            <div className="zeros-auth-menu-info">
              <span className="zeros-auth-menu-name">
                {user?.name || "User"}
              </span>
              <span className="zeros-auth-menu-email">
                {session?.email || ""}
              </span>
            </div>
            <button
              type="button"
              className="zeros-auth-menu-item"
              onClick={() => {
                setMenuOpen(false);
                signOut();
              }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
