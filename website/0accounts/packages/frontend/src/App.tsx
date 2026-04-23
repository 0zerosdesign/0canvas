// ============================================
// APP: Root Application Shell
// PURPOSE: Initializes auth, renders layout with router outlet
// ============================================

import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuth } from "./hooks/useAuth";
import { useAppStore } from "./store";
import Header from "./components/layout/Header";

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];

export default function App() {
  const { initAuth } = useAuth();
  const location = useLocation();

  // Tracks whether the current route is a public auth page
  const isPublicRoute = PUBLIC_ROUTES.some((r) => location.pathname.startsWith(r));

  // Tracks whether auth check is still in progress
  const authChecking = useAppStore((s) => s.authChecking);

  // Tracks if user is authenticated
  const isAuthenticated = useAppStore((s) => !!s.authSession);

  // Initialize auth on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Show loading while checking auth (only on protected routes)
  if (authChecking && !isPublicRoute) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" />
      </div>
    );
  }

  return (
    <div className="app-root">
      {/* Show header only when authenticated and not on auth pages */}
      {isAuthenticated && !isPublicRoute && <Header />}

      <main className={isPublicRoute ? "auth-layout" : "main-layout"}>
        <Outlet />
      </main>

      <Toaster
        position="bottom-right"
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
