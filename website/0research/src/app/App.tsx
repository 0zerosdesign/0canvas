// ============================================
// APP: 0research - Content Discovery & Learning Platform
// PURPOSE: Entry point that sets up routing + auth
// ============================================

import { RouterProvider } from "react-router";
import { ZerosAuthProvider, useOAuthCallback } from "@0zerosdesign/auth-client/react";
import { router } from "./routes";

export default function App() {
  const ready = useOAuthCallback();

  if (!ready) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "var(--zeros-bg1, #0d0d0d)",
          color: "var(--zeros-text2, #a0a0a0)",
          fontFamily: "var(--zeros-font, sans-serif)",
        }}
      >
        Signing in...
      </div>
    );
  }

  return (
    <ZerosAuthProvider config={{ productId: "0research" }}>
      <RouterProvider router={router} />
    </ZerosAuthProvider>
  );
}
