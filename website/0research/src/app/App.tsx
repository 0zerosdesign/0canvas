// ============================================
// APP: 0research — Content Discovery & Learning Platform
// PURPOSE: Entry point. Public homepage + auth provider so the
//          /internal research tool can gate access via RequireAuth.
// ============================================

import { RouterProvider } from "react-router";
import { ZerosAuthProvider, useOAuthCallback } from "@0zerosdesign/auth-client/react";
import { router } from "./routes";

export default function App() {
  // `useOAuthCallback` returns `ready=false` only while processing
  // an OAuth return URL from accounts.zeros.design. On a normal
  // page load (including the public homepage) it flips to `true`
  // immediately. Once ready, we mount the router.
  const ready = useOAuthCallback();

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--surface-0)",
          color: "var(--text-muted)",
          fontFamily: "var(--font-ui, sans-serif)",
        }}
      >
        Signing in…
      </div>
    );
  }

  return (
    <ZerosAuthProvider config={{ productId: "0research" }}>
      <RouterProvider router={router} />
    </ZerosAuthProvider>
  );
}
