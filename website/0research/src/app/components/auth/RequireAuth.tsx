// ============================================
// COMPONENT: RequireAuth
// PURPOSE: Gate for routes that need the visitor to be signed in
//          (any authenticated user — not admin-only). Unauthenticated
//          visitors see a sign-in card; click → OAuth flow to
//          accounts.zeros.design via the auth-client.
// USED IN: routes.ts (/internal/*)
// ============================================

import { type ReactNode } from "react";
import { useZerosAuth } from "@0zerosdesign/auth-client/react";

interface Props {
  children: ReactNode;
}

const screenStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  background: "var(--surface-0, #0d0d0d)",
  color: "var(--text-primary, #ededed)",
  fontFamily: "var(--font-ui, -apple-system, BlinkMacSystemFont, sans-serif)",
  padding: "var(--space-6)",
} as const;

const cardStyle = {
  maxWidth: "420px",
  width: "100%",
  background: "var(--surface-1, #161616)",
  border: "1px solid var(--border-subtle, #262626)",
  borderRadius: "var(--radius-lg)",
  padding: "var(--space-7)",
  textAlign: "center" as const,
  boxShadow:
    "var(--shadow-glass, 0 8px 30px rgba(0, 0, 0, 0.5))",
};

const titleStyle = {
  margin: "0 0 var(--space-2)",
  fontSize: "var(--text-18)",
  fontWeight: "var(--weight-heading)",
  color: "var(--text-primary, #ededed)",
};

const bodyStyle = {
  margin: "0 0 var(--space-6)",
  fontSize: "var(--text-13)",
  lineHeight: "var(--leading-normal)",
  color: "var(--text-muted, #a0a0a0)",
};

const btnStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: "var(--h-control-xl)",
  padding: "0 var(--space-5)",
  borderRadius: "var(--radius-sm)",
  border: "none",
  background: "var(--accent, #3b9eff)",
  color: "var(--text-on-accent, #0d2847)",
  fontSize: "var(--text-13)",
  fontWeight: "var(--weight-control)",
  fontFamily: "inherit",
  cursor: "pointer",
};

export function RequireAuth({ children }: Props) {
  const { user, session, signIn, loading } = useZerosAuth();

  if (loading) {
    return (
      <div style={screenStyle} role="status" aria-live="polite">
        <span style={{ color: "var(--text-muted, #a0a0a0)", fontSize: "var(--text-13)" }}>
          Loading…
        </span>
      </div>
    );
  }

  if (!user && !session) {
    return (
      <div style={screenStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>Sign in to continue</h1>
          <p style={bodyStyle}>
            This area is for signed-in researchers. Use your Zeros account to
            access the AI research tools.
          </p>
          <button type="button" style={btnStyle} onClick={() => signIn()}>
            Sign in with Zeros
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
