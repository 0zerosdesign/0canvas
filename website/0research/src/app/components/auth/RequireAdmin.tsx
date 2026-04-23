// ============================================
// COMPONENT: RequireAdmin
// PURPOSE: Route guard that restricts access to admin users
// USED IN: Routes that should only be visible to admins (e.g., /internal)
// ============================================

import { useEffect, type ReactNode } from "react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";

interface RequireAdminProps {
  children: ReactNode;
}

export function RequireAdmin({ children }: RequireAdminProps) {
  const { user, loading, isAuthenticated, redirectToLogin } = useZerosAuth();

  // Redirect to login via effect (not during render) to prevent loops
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      redirectToLogin();
    }
  }, [loading, isAuthenticated, redirectToLogin]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "var(--zeros-text2)",
          fontFamily: "var(--zeros-font)",
        }}
      >
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    // Will redirect via the useEffect above — show nothing meanwhile
    return null;
  }

  if (!user?.isAdmin) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: "8px",
          color: "var(--zeros-text2)",
          fontFamily: "var(--zeros-font)",
        }}
      >
        <p style={{ fontSize: "var(--zeros-text-lg)" }}>Access Denied</p>
        <p style={{ fontSize: "var(--zeros-text-sm)", opacity: 0.6 }}>
          This feature is available to admins only.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
