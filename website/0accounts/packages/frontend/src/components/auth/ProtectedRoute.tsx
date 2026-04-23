// ============================================
// COMPONENT: ProtectedRoute
// PURPOSE: Redirects to login if user is not authenticated
// USED IN: DashboardPage, ProfilePage, SettingsPage
// ============================================

import { Navigate, useLocation } from "react-router-dom";
import { useAppStore } from "../../store";

// --- ATTRIBUTES ---
interface ProtectedRouteProps {
  // The page content to render if authenticated
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const authSession = useAppStore((s) => s.authSession);
  const authChecking = useAppStore((s) => s.authChecking);
  const location = useLocation();

  // Still checking auth — show nothing (App.tsx handles the loader)
  if (authChecking) return null;

  // Not authenticated — redirect to login with return URL
  if (!authSession) {
    const redirectUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect_url=${redirectUrl}`} replace />;
  }

  return <>{children}</>;
}
