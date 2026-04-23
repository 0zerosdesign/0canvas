# Changelog

All notable changes to `@0zerosdesign/auth-client` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the package adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-18

### Added

- `useOAuthCallback()` React hook (exported from `@0zerosdesign/auth-client/react`).
  Parses `access_token` + `refresh_token` from the URL hash after a redirect
  back from `accounts.zeros.design`, calls `supabase.auth.setSession()`, and
  cleans up the hash. Replaces the copies that each product was maintaining
  inline.
- `resendVerification(email, redirectTo?)` — wraps `supabase.auth.resend`
  with the `signup` type. Needed because when signup hits an already-
  registered email, Supabase suppresses the first verification email and
  callers have to resend explicitly.
- `signUpWithEmail()` return type now includes `userAlreadyExists: boolean`
  so callers can branch into the resend flow without re-parsing the raw
  Supabase response.
- Resilient `fetch` wrapper in the Supabase client:
  - 15-second `AbortController` timeout (covers edge-function cold starts).
  - Network failures return a synthetic `503` response body instead of
    throwing, so `supabase.auth.*` callers get a normal `AuthApiError`
    instead of an unhandled rejection.
- No-op `lock` override on the auth client to silence
  "Lock not released within 5000ms" warnings under React Strict Mode.

### Documented

- `signOut()` uses `scope: 'local'` by design. Global scope revokes the
  refresh token server-side, which breaks fresh tokens from
  `accounts.zeros.design`. The login page clears stale cross-domain
  sessions independently via the presence of `redirect_url`.

### Notes

- **No breaking changes.** Existing consumers keep working without any
  code changes. The extra field on `signUpWithEmail`'s return type is
  additive.

## [0.1.0] - 2026-04-08

### Added

- Initial release.
- Core auth methods: `signInWithEmail`, `signUpWithEmail`,
  `signInWithGoogle`, `signOut`, `resetPassword`, `updatePassword`,
  `getSession`, `onAuthStateChange`.
- 0accounts API wrappers: `verifyWithAccounts`, `getProfile`,
  `registerProductAccess`, `verifyFromBackend`.
- React bindings: `ZerosAuthProvider`, `useZerosAuth`.
- Redirect helpers: `redirectToLogin`, `getRedirectParams`,
  `isAuthenticated`.
