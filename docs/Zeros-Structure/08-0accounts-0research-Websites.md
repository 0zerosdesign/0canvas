# 0accounts And 0research

This explains the account/auth and website parts of the repo.

## Why These Exist

The repo includes more than the Mac app:

- `0accounts`: shared login/account system for all Zeros products.
- `0research`: public learning/research website plus internal tooling.

These are important, but they should not be confused with the local Mac app runtime.

## 0accounts

0accounts lives in two places:

- `website/0accounts`: frontend website and auth client package.
- `servers/0accounts`: backend API.

## 0accounts Frontend

Main folder:

- `website/0accounts/packages/frontend`

Main route file:

- `website/0accounts/packages/frontend/src/routes.tsx`

Routes:

- `/`: dashboard
- `/login`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/verify-email`
- `/profile`
- `/settings`

Purpose:

- Let users sign in.
- Let users manage profile/settings.
- Show product access/dashboard.

## 0accounts Auth Client

Main folder:

- `website/0accounts/packages/auth-client`

Main exports:

- `signInWithEmail`
- `signUpWithEmail`
- `signInWithGoogle`
- `signOut`
- `resetPassword`
- `updatePassword`
- `getSession`
- `onAuthStateChange`
- `verifyWithAccounts`
- `getProfile`
- `registerProductAccess`
- `redirectToLogin`
- `ZerosAuthProvider`
- `useZerosAuth`
- `useOAuthCallback`

Purpose:

> One shared auth package so 0colors, 0research, and future Zeros web products do not each rebuild auth.

Current consumers:

- 0colors frontend uses `@0zerosdesign/auth-client`.
- 0research frontend uses `@0zerosdesign/auth-client`.

## Auth Design

Supabase is used for authentication:

- sign in
- sessions
- OAuth
- email/password flows

The accounts API handles product/account data:

- profiles
- product access
- admin routes

The auth client wraps both so product frontends have a simpler API.

## 0accounts Backend

Main folder:

- `servers/0accounts`

Main file:

- `servers/0accounts/src/server.ts`

Local default port:

- `4456`

Routes mounted under:

- `/api/v1`

Route groups:

- health
- auth
- profile
- products
- admin

Backend responsibilities:

- initialize database tables
- verify auth
- profile data
- product access
- product catalog
- admin operations

## How 0accounts Should Relate To The Mac App

The Mac app should not require account login for basic local use.

Recommended rule:

> Zeros Mac app is local-first. Account login unlocks cloud and commercial features, not local project editing.

Account-required features may include:

- license/subscription
- cloud sync
- community publish
- hosted token APIs
- team collaboration
- device sync

Account-not-required features should include:

- open local project
- inspect/edit styles
- use installed local agent CLIs
- save `.zeros` project file
- local terminal/git/env/todo
- local 0colors token graph

## 0research

0research also lives in two places:

- `website/0research`: frontend website.
- `servers/0research`: backend API and Supabase/Directus tooling.

## 0research Frontend

Main files:

- `website/0research/src/app/App.tsx`
- `website/0research/src/app/routes.ts`
- `website/0research/src/app/pages/HomePage.tsx`
- `website/0research/src/app/internal/AiToolPage.tsx`

Routes:

- `/`: public homepage.
- `/internal`: authenticated internal tool.

Auth:

- Uses `ZerosAuthProvider`.
- Product id is `0research`.
- Login defaults to accounts URLs unless local env overrides are set.

## 0research Product Shape

Public side:

- learning platform
- content discovery
- research feed
- AI/UX/product education content

Internal side:

- authenticated internal AI/content tooling
- Directus/Supabase-related workflows
- content operations

## 0research Backend

Main folder:

- `servers/0research`

Main file:

- `servers/0research/src/index.ts`

Routes:

- `/health`
- `/api/search`

Other backend assets:

- Supabase migrations
- Supabase functions
- Directus sync scripts
- Directus debug script

Purpose:

- AI search.
- User/data API foundation.
- Directus/Supabase content sync and backend support.

## Directus And Supabase Context

0research has signs of multiple backend eras:

- Directus CMS for content.
- Supabase tables/functions/migrations.
- Older docs mention Appwrite and Antigravity/Figma Make workflows.

This should be cleaned so the current source of truth is obvious.

## Relationship To Zeros Product

Recommended relationship:

- Keep 0research as the public website/content platform.
- Use it to educate users and publish research.
- Do not merge it into the Mac app.
- Let it share auth and brand.
- Consider using Zeros Mac app internally to produce/edit research assets later, but keep product boundaries clear.

## What To Consolidate

Consolidate:

- shared auth through `auth-client`
- shared design tokens
- shared brand language
- deploy docs
- account/product ids
- environment variable naming

Do not consolidate:

- 0research content UI into Mac app
- 0accounts backend into Mac app runtime
- hosted account auth into required local app boot

## Cleanup Checklist

For 0accounts:

- Make auth-client package name consistent with final brand.
- Decide product ids: `zeros`, `0colors`, `0research`, etc.
- Document local/prod env variables in one place.
- Ensure Mac app account usage is optional.

For 0research:

- Update stale backend context docs.
- Clarify Directus vs Supabase source of truth.
- Keep `/internal` protected by shared auth.
- Remove obsolete Appwrite references if no longer active.

## Status Summary

0accounts:

- Functional shared auth direction.
- Frontend/backend/auth-client are present.
- Should become optional account layer for Zeros Mac app.

0research:

- Separate website and internal tool.
- Uses 0accounts auth.
- Should remain website/content-first.

Zeros Mac app:

- Should integrate account login later for cloud/commercial features, but remain local-first.