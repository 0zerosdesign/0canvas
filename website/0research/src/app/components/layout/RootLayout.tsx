// ============================================
// COMPONENT: RootLayout
// PURPOSE: Root layout wrapper with theme detection
// THEME: Auto-detects prefers-color-scheme, persists in localStorage
// USED IN: Routes (wraps all pages)
// ============================================

import { useEffect } from "react";
import { Outlet } from "react-router";
import { Toaster } from "sonner";

const THEME_KEY = "zeros_theme";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function RootLayout() {
  // Apply theme on mount and listen for OS changes
  useEffect(() => {
    const theme = getInitialTheme();
    document.documentElement.setAttribute("data-theme", theme);

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = (e: MediaQueryListEvent) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem(THEME_KEY)) {
        const newTheme = e.matches ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div
      className="w-full h-screen"
      style={{
        background: "var(--surface-floor)",
        fontFamily: "var(--font-ui)",
      }}
    >
      <Outlet />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--surface-1)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-subtle)",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-13)",
          },
        }}
      />
    </div>
  );
}
