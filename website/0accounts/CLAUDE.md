# 0accounts — frontend

Frontend for the zeros.design accounts service. Deploys to Cloudflare Pages.
Backend lives at `/servers/0accounts/` and deploys to Railway separately.

## Project Structure

- `packages/frontend` — React + Vite SPA (port 3001)
- `packages/auth-client` — `@0zerosdesign/auth-client` shared library (consumed
  by frontends of 0research, 0colors, 0docs, etc.); published to npm
- Backend: see `/servers/0accounts/` (Hono API on port 4456)

## Tech Stack

- **Frontend**: React 18 + Vite + React Router + Zustand
- **Auth**: Supabase (project `qvayepdjxvkdeiczjzfj`) — auth only
- **Styling**: /styles/tokens.css (repo-root shared tokens)
- **Package Manager**: pnpm workspaces

## Commands (from this directory)

- `pnpm dev`         — start the frontend dev server
- `pnpm build`       — build all workspace packages (auth-client + frontend)
- `pnpm typecheck`   — typecheck all packages
- `pnpm --filter @0zerosdesign/auth-client build` — rebuild auth-client only

Backend commands run in `/servers/0accounts/`:
- `pnpm dev`   — start Hono dev server with tsx watch
- `pnpm build` — compile TS
- `pnpm seed:products` — seed zero_products table
- `pnpm migrate:users` — migrate user records

## Architecture

- **Supabase = auth only**: sign-in, session tokens, user metadata.
- **Railway PostgreSQL = all data**: zeros_products, zeros_profiles,
  zeros_product_access, zeros_audit_log — served by the Hono backend.
- Auth-client library abstracts the Supabase + accounts-API dance so
  other product frontends call `useZerosAuth()` and `useOAuthCallback()`
  without thinking about it.

## Environment Variables (frontend)

Copy `packages/frontend/.env.example` → `.env.local` to override defaults
for local dev. Production hits `accounts.zeros.design` and `accounts-api.zeros.design`.
