// ============================================
// COMPONENT: AuthButton
// PURPOSE: Compact auth indicator for the header/topbar.
//          Signed out → "Sign in" icon button → redirects to accounts.zeros.design
//          Signed in  → User initial avatar → click to open menu
//          Menu shows: name + admin badge, email, theme toggle, sign out
// USED IN: ListFeedHeader, MobileTopBar
// ============================================

import { useState, useCallback } from "react";
import { LogIn, LogOut, Sun, Moon } from "lucide-react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";

const THEME_KEY = "zeros_theme";

function getCurrentTheme(): "dark" | "light" {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function AuthButton() {
  const { user, session, loading, isAuthenticated, signOut, redirectToLogin } =
    useZerosAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [theme, setTheme] = useState(getCurrentTheme);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  if (loading) return null;

  if (!isAuthenticated) {
    return (
      <button
        className="zeros-auth-btn"
        aria-label="Sign in"
        onClick={redirectToLogin}
        title="Sign in"
      >
        <LogIn size={16} strokeWidth={1.8} />
      </button>
    );
  }

  const initial = (user?.name || session?.email || "U")[0].toUpperCase();
  const isAdmin = (user as Record<string, unknown>)?.isAdmin === true;

  return (
    <div style={{ position: "relative" }}>
      <button
        className="zeros-auth-avatar"
        aria-label="Account menu"
        onClick={() => setShowMenu((v) => !v)}
        title={user?.name || session?.email || "Account"}
      >
        {initial}
      </button>

      {showMenu && (
        <>
          {/* Backdrop to close menu */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 99 }}
            onClick={() => setShowMenu(false)}
          />
          <div className="zeros-auth-menu">
            <div className="zeros-auth-menu-info">
              <div className="zeros-auth-menu-name-row">
                <span className="zeros-auth-menu-name">
                  {user?.name || "User"}
                </span>
                {isAdmin && <span className="zeros-admin-badge">Admin</span>}
              </div>
              <span className="zeros-auth-menu-email">
                {session?.email || ""}
              </span>
            </div>
            <button
              className="zeros-auth-menu-item"
              onClick={toggleTheme}
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <button
              className="zeros-auth-menu-item"
              onClick={() => {
                setShowMenu(false);
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
