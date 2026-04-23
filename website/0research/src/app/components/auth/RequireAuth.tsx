// ============================================
// COMPONENT: RequireAuth
// PURPOSE: Gate for routes that need the visitor to be signed in
//          (any authenticated user — not admin-only). Redirects
//          unauthenticated visitors to the hosted sign-in flow at
//          accounts.zeros.design via the auth-client.
// USED IN: routes.ts (/internal/*)
// ============================================

import { type ReactNode } from "react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";

interface Props {
  children: ReactNode;
}

export function RequireAuth({ children }: Props) {
  const { user, session, signIn, loading } = useZerosAuth();

  if (loading) {
    return (
      <div className="require-auth-loading" role="status" aria-live="polite">
        <span>Loading…</span>
      </div>
    );
  }

  if (!user && !session) {
    return (
      <div className="require-auth-gate">
        <div className="require-auth-gate__card">
          <h1 className="require-auth-gate__title">Sign in to continue</h1>
          <p className="require-auth-gate__body">
            This area is for signed-in researchers. Use your Zeros account to
            access the AI research tools.
          </p>
          <button
            type="button"
            className="require-auth-gate__btn"
            onClick={() => signIn()}
          >
            Sign in with Zeros
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
