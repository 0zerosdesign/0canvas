// ============================================
// APP: 0research — Content Discovery & Learning Platform
// PURPOSE: Entry point. Public homepage + auth provider so the
//          /internal research tool can gate access via RequireAuth.
// ============================================

import { RouterProvider } from "react-router";
import { ZerosAuthProvider, useOAuthCallback } from "@0zerosdesign/auth-client/react";
import { router } from "./routes";

// Auth endpoints — default to production accounts.zeros.design; override
// in local dev by setting these in .env.local (see .env.example):
//   VITE_ACCOUNTS_LOGIN_URL=http://localhost:3001/login
//   VITE_ACCOUNTS_API_URL=http://localhost:4456/api/v1
const LOGIN_URL      = import.meta.env.VITE_ACCOUNTS_LOGIN_URL || undefined;
const ACCOUNTS_API   = import.meta.env.VITE_ACCOUNTS_API_URL   || undefined;

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
    <ZerosAuthProvider
      config={{
        productId: "0research",
        loginUrl: LOGIN_URL,
        accountsApiUrl: ACCOUNTS_API,
      }}
    >
      <RouterProvider router={router} />
    </ZerosAuthProvider>
  );
}
