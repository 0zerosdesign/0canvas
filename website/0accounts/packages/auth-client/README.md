# @0zerosdesign/auth-client

Shared authentication client for all zeros.design products. Wraps the
Supabase project used by `accounts.zeros.design` and exposes a consistent
API for product apps (`0colors`, `0research`, future zeros products).

## Install

```bash
# Products install from GitHub Packages
npm install @0zerosdesign/auth-client
```

This requires a `.npmrc` that points the scope at GitHub Packages:

```
@0zerosdesign:registry=https://npm.pkg.github.com
```

## Usage

### Core (any framework)

```ts
import {
  signInWithEmail,
  signUpWithEmail,
  signOut,
  getSession,
  redirectToLogin,
} from "@0zerosdesign/auth-client";
```

### React

```tsx
import {
  ZerosAuthProvider,
  useZerosAuth,
  useOAuthCallback,
} from "@0zerosdesign/auth-client/react";

export default function App() {
  const ready = useOAuthCallback();
  if (!ready) return <LoadingSpinner />;

  return (
    <ZerosAuthProvider config={{ productId: "0colors" }}>
      <AppRoutes />
    </ZerosAuthProvider>
  );
}
```

## Why `signOut` uses `scope: 'local'`

`supabase.auth.signOut()` accepts a `scope` parameter:

- `'global'` revokes the refresh token server-side across all devices.
- `'local'` only clears the session on the current domain.

We use `'local'`. The reason is cross-domain session hand-off: when a user
signs in on `accounts.zeros.design` and we redirect them back to
`0colors.zeros.design` with fresh tokens in the URL hash, calling
`setSession()` with those tokens initializes a new session on the product
domain. If a previous `signOut({ scope: 'global' })` ran, the refresh
token on the newly delivered session is already revoked — the product's
next `autoRefreshToken` attempt fails and the user is bounced back to the
login page.

To keep stale cross-domain sessions from sticking around, the
`accounts.zeros.design` login page clears any existing local session
whenever `redirect_url` is present on the URL, *before* signing the user
in fresh. See [`useAuth.initAuth`](https://github.com/Withso/0accounts)
in the 0accounts repo.

## Local development

While iterating on this package from a consuming product:

```bash
# In the auth-client package
cd 0shared/packages/auth-client
pnpm link .

# In the consumer (pnpm)
cd 0research
pnpm link @0zerosdesign/auth-client

# Or in the consumer (npm)
cd 0colors/packages/frontend
npm link @0zerosdesign/auth-client
```

Unlink when done:

```bash
pnpm unlink @0zerosdesign/auth-client && pnpm install
# or
npm unlink @0zerosdesign/auth-client && npm install
```

## Publish

See [CHANGELOG.md](./CHANGELOG.md) for version history.

```bash
pnpm build
pnpm publish --dry-run   # inspect
pnpm publish              # publishes to https://npm.pkg.github.com
```

CI should use a GitHub token with `packages:write`.
