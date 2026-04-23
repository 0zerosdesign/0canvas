# 0accounts

Centralized authentication and account management service for zeros.design.

## Project Structure

- `packages/backend` — Hono API server (port 4456)
- `packages/frontend` — React + Vite SPA (port 3001)
- `scripts/` — Utility scripts (seed data, migrations)

## Tech Stack

- **Backend**: Hono + TypeScript, raw `pg` for data, Supabase client for auth only
- **Frontend**: React 18 + Vite + React Router + Zustand
- **Database**: Railway PostgreSQL (all data tables)
- **Auth**: Supabase (same project as 0colors: `qvayepdjxvkdeiczjzfj`) — auth only
- **Styling**: CSS variables (`--zeros-*` tokens)
- **Package Manager**: pnpm workspaces

## Commands

- `pnpm dev` — Start both backend and frontend
- `pnpm dev:backend` — Start backend only
- `pnpm dev:frontend` — Start frontend only
- `pnpm build` — Build all packages
- `pnpm typecheck` — Type check all packages
- `pnpm seed:products` — Seed zero_products table

## Architecture

- **Supabase = auth only**: `supabase.auth.getUser()`, `supabase.auth.admin.createUser()`. No data in Supabase DB.
- **Railway PostgreSQL = all data**: `zeros_products`, `zeros_profiles`, `zeros_product_access`, `zeros_audit_log`
- User IDs in Railway PG match Supabase auth user UUIDs (logical reference, no FK constraint)
- All colors use `--zeros-*` CSS variables — no hardcoded hex values
- Every page/component follows zeros conventions: header comment, documented variables/workflows
- API routes prefixed with `/api/v1/`

## Database Tables (Railway PostgreSQL)

- `zeros_products` — Product registry (0colors, 0research, 0canvas, 0docs, 0kit)
- `zeros_profiles` — Extended user profiles (ID matches Supabase auth user)
- `zeros_product_access` — Which products each user has accessed
- `zeros_audit_log` — Activity tracking

## Environment Variables

- `DATABASE_URL` — Railway PostgreSQL connection string
- `SUPABASE_URL` — Supabase project URL (auth only)
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (backend auth operations)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key (frontend auth)
- `ZERO_SERVICE_KEY` — Service-to-service auth key
