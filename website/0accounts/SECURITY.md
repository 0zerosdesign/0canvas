# Security notes — 0accounts

## Data storage architecture

Authentication uses the shared Supabase project (`qvayepdjxvkdeiczjzfj`).
**All user data** (profiles, product access records, audit log, rate
limits) lives in **Railway Postgres**, accessed via the `pg` library
with the `DATABASE_URL` connection string.

This is intentional — Supabase is the identity provider only.

## Why Supabase RLS doesn't apply here

Supabase RLS policies protect rows against direct queries from the
anon/authenticated client-side keys. That model requires the frontend to
query the database directly.

In this project:

- The frontend never connects to Railway Postgres.
- Every data access goes through the Hono backend (`packages/backend`).
- The backend uses a single privileged `DATABASE_URL` and enforces
  per-user scoping at the application layer.

So the "RLS-equivalent" defense in this architecture is: **every
data-reading query MUST filter by the authenticated user's ID**, and the
authenticated ID MUST come from `getAuthUser(c)` (which calls
`supabase.auth.getUser()` on the JWT), never from request parameters.

## Query filter audit

Use this grep whenever a new query is added to confirm it's scoped:

```bash
# List every backend query — manually check each for a user_id filter
rg "query\(" packages/backend/src --type ts
```

Queries that intentionally return cross-user data (admin endpoints,
public product list) should be gated behind `requireAdmin(c)` or
documented as public-by-design.

## Authentication hardenings

- Supabase JWT verified via `supabase.auth.getUser()` on every request
  (`middleware/auth.ts`). No trusted-client paths.
- Service-to-service auth uses `X-Service-Key` header (compared against
  `ZERO_SERVICE_KEY` env var) — see `middleware/auth.ts:verifyServiceKey`.
- Rate limiting is **persistent** (Postgres-backed, see
  `services/rate-limit.ts`) and survives restarts + scale-out.
- Redirect URLs validated against an allowlist (`lib/validate-redirect.ts`)
  before the login page forwards tokens. Prevents open-redirect token
  exfiltration.
- `.env` files gitignored at any depth (`**/.env`).

## Content Security Policy

Not yet enforced at the hosting layer. See the CSP middleware
implementation in `packages/backend/src/middleware/csp.ts` (shipped in
`Content-Security-Policy-Report-Only` mode by default — flip to enforce
after 48h of clean console output).

## Known gaps

- CSP headers (above) are in report-only; enforcement requires a clean
  browser-console window before flipping.
- No end-to-end redirect-validation tests yet (see
  `0colors/QA-automation/auth-e2e/` once Phase 7 ships).
