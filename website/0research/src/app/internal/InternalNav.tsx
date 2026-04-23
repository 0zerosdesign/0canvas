// ============================================
// COMPONENT: InternalNav
// PURPOSE: Vertical left nav bar for the internal workspace.
//          Top: agent icons. Bottom: profile avatar with menu (admin badge, theme toggle, sign out).
// USED IN: WorkspaceLayout
// ============================================

import { useState, useCallback } from "react";
import { LogOut, Sun, Moon } from "lucide-react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";
import type { AgentConfig } from "./agents.config";

const THEME_KEY = "zeros_theme";

function getCurrentTheme(): "dark" | "light" {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

interface Props {
  agents: AgentConfig[];
  selectedAgentId: string;
  onAgentSelect: (id: string) => void;
}

export function InternalNav({ agents, selectedAgentId, onAgentSelect }: Props) {
  const { user, session, signOut } = useZerosAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [theme, setTheme] = useState(getCurrentTheme);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
  }, [theme]);

  const initial = (user?.name || session?.email || "U")[0].toUpperCase();
  const isAdmin = (user as Record<string, unknown>)?.isAdmin === true;

  return (
    <nav className="oai-nav">
      <div className="oai-nav__top">
        {agents.map((agent) => (
          <button
            key={agent.id}
            className={`oai-nav-item ${agent.id === selectedAgentId ? "oai-nav-item--active" : ""}`}
            onClick={() => onAgentSelect(agent.id)}
            title={agent.name}
            type="button"
          >
            {agent.icon}
          </button>
        ))}
      </div>

      <div className="oai-nav__bottom">
        <button
          className="oai-nav-avatar"
          aria-label="Account menu"
          onClick={() => setShowMenu((v) => !v)}
          title={user?.name || session?.email || "Account"}
        >
          {initial}
        </button>

        {showMenu && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 99 }}
              onClick={() => setShowMenu(false)}
            />
            <div className="oai-nav-menu">
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
    </nav>
  );
}
