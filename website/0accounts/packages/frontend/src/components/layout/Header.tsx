// ============================================
// COMPONENT: Header
// PURPOSE: Top navigation bar with Zero branding, nav links, and user menu
// USED IN: App.tsx (shown when authenticated)
// ============================================

import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LogOut, User, Settings, LayoutDashboard } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useAppStore } from "../../store";
import "./Header.css";

export default function Header() {
  // Controls whether the user dropdown menu is visible
  const [menuOpen, setMenuOpen] = useState(false);

  const { handleSignOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Current user's session info
  const authSession = useAppStore((s) => s.authSession);

  // WORKFLOW: onSignOut
  // TRIGGERED BY: Click on "Sign Out" in dropdown
  // WHAT IT DOES: Signs out and navigates to login
  async function onSignOut() {
    await handleSignOut();
    navigate("/login");
  }

  // Helper: check if a nav link is active
  function isActive(path: string) {
    return location.pathname === path;
  }

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="header-logo">
          <span className="header-logo-zero">zero</span>
          <span className="header-logo-accent">account</span>
        </Link>

        <nav className="header-nav">
          <Link
            to="/"
            className={`header-nav-link ${isActive("/") ? "active" : ""}`}
          >
            <LayoutDashboard size={15} />
            Dashboard
          </Link>
          <Link
            to="/profile"
            className={`header-nav-link ${isActive("/profile") ? "active" : ""}`}
          >
            <User size={15} />
            Profile
          </Link>
          <Link
            to="/settings"
            className={`header-nav-link ${isActive("/settings") ? "active" : ""}`}
          >
            <Settings size={15} />
            Settings
          </Link>
        </nav>
      </div>

      <div className="header-right">
        <button
          className="header-avatar-btn"
          onClick={() => setMenuOpen(!menuOpen)}
          onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
        >
          <div className="header-avatar">
            {(authSession?.name || authSession?.email || "U")[0].toUpperCase()}
          </div>
        </button>

        {menuOpen && (
          <div className="header-dropdown">
            <div className="header-dropdown-user">
              <span className="header-dropdown-name">
                {authSession?.name || "User"}
              </span>
              <span className="header-dropdown-email">
                {authSession?.email}
              </span>
            </div>
            <div className="header-dropdown-divider" />
            <button className="header-dropdown-item" onClick={onSignOut}>
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
