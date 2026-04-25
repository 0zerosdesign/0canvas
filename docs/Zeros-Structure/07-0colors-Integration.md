# 0colors Integration

This explains what 0colors is today and how it should be integrated into the Zeros Mac app.

## What 0colors Is

0colors is a separate full-stack product inside `apps/0colors`.

It is a node-based color and token intelligence tool. Users create color systems visually, connect logic between nodes, assign tokens, create themes, and export those tokens to real code formats.

Main folders:

- `apps/0colors/packages/frontend`: Vite + React + Zustand UI.
- `apps/0colors/packages/backend`: Hono API backend.
- `apps/0colors/QA-automation`: test and QA automation.
- `apps/0colors/scripts`: QA/report helper scripts.

## 0colors Frontend

The frontend includes:

- canvas UI
- color nodes
- token nodes
- palette nodes
- spacing nodes
- themes
- token tables
- command palette
- project dashboard
- AI chat/settings
- cloud sync
- community publish
- dev mode panel
- import/export

Important files:

- `apps/0colors/packages/frontend/src/App.tsx`
- `apps/0colors/packages/frontend/src/store/index.ts`
- `apps/0colors/packages/frontend/src/types/index.ts`
- `apps/0colors/packages/frontend/src/components/canvas/ColorCanvas.tsx`
- `apps/0colors/packages/frontend/src/components/canvas/ConnectedColorCanvas.tsx`
- `apps/0colors/packages/frontend/src/components/tokens/*`
- `apps/0colors/packages/frontend/src/pages/ConnectedDevModePanel.tsx`
- `apps/0colors/packages/frontend/src/hooks/useDevMode.ts`
- `apps/0colors/packages/frontend/src/hooks/useAdvancedLogicEffect.ts`

## 0colors Backend

The backend is a Hono server.

Important files:

- `apps/0colors/packages/backend/src/server.ts`
- `apps/0colors/packages/backend/src/db.ts`
- `apps/0colors/packages/backend/src/routes/projects.ts`
- `apps/0colors/packages/backend/src/routes/dev.ts`
- `apps/0colors/packages/backend/src/routes/community.ts`
- `apps/0colors/packages/backend/src/routes/templates.ts`
- `apps/0colors/packages/backend/src/computation/pipeline.ts`
- `apps/0colors/packages/backend/src/computation/advanced-logic-engine.ts`

Backend responsibilities:

- health route
- signup/cloud metadata
- project cloud register/unregister/sync/load
- batch sync
- project locks/SSE
- templates
- community publishing
- Figma token endpoints
- AI settings/conversations
- dev-mode webhooks
- token output APIs
- server-side color computation pipeline

## Core 0colors Data

The central data types include:

- `ColorNode`
- `DesignToken`
- token groups
- pages
- themes
- canvas states
- advanced logic
- dev configs

`ColorNode` is rich. It supports:

- HSL
- RGB
- OKLCH
- HCT
- HEX
- parent/child offsets
- locks
- diffs
- theme overrides
- palette generation
- spacing nodes
- token nodes
- webhook input flags
- sync metadata

## Advanced Logic

Advanced logic lets node values be computed from rules and expressions.

Current behavior:

- `useAdvancedLogicEffect` watches nodes/themes/logic.
- It builds channel maps for all nodes.
- It resolves cross-channel dependencies.
- It evaluates logic in dependency order.
- It writes computed values back into nodes and tokens.

Product meaning:

> This is the "intelligence" layer of 0colors. It lets a color system react to changes instead of being static swatches.

## Dev Mode

0colors Dev Mode is a major feature area.

`DevConfig` stores:

- incoming webhook enabled/secret/target node/formats
- schedule settings
- output format
- selected output theme
- GitHub repo/path/branch/PAT
- outgoing webhook URL/headers
- pull API enabled
- last run status/error

Supported output formats:

- CSS variables
- DTCG JSON
- Tailwind config
- Figma variables JSON

Backend dev routes include:

- `POST /api/webhook/:projectId/run`
- `POST /api/webhook/:projectId/:nodeId`
- `POST /api/webhook/:projectId`
- `GET /api/webhook-pending/:projectId`
- `POST /api/webhook-clear/:projectId`
- `GET /api/tokens/:projectId/:format`
- `GET /api/tokens/:projectId/:format/etag`
- `POST /api/dev/save-output`
- `POST /api/dev/github-push`
- `POST /api/dev/webhook-push`
- `POST /api/dev/save-config`
- `GET /api/dev/load-config/:projectId`

## What Works In 0colors Today

Strong areas:

- Rich frontend state model.
- Node/token/theme concepts are implemented.
- Advanced logic exists.
- Local persistence and cloud sync paths exist.
- Backend has real project/dev/community routes.
- Dev Mode has concrete webhook and token output APIs.
- QA automation is much deeper than the root app.

Mixed areas:

- Frontend `App.tsx` is very large and orchestration-heavy.
- Several systems exist both frontend and backend.
- Cloud and local-first models are mixed.
- Dev Mode secrets/PAT handling must be reconsidered for a Mac app.
- It uses 0accounts auth-client directly.
- UI patterns are separate from the Zeros Mac app shell.

## Main Integration Question

The big question is:

> Should 0colors remain a hosted web product inside Zeros, or become a local-first module inside the Mac app?

For the Mac app vision, the answer should be:

> Make 0colors a local-first Zeros module, with optional cloud publishing/sync.

## Recommended Integration Strategy

### Phase 1: Do Not Merge UI Immediately

Do not paste the whole 0colors app into Column 3 as-is.

First extract product domains:

- color graph model
- token model
- theme model
- advanced logic evaluator
- format exporters
- dev-mode pipeline
- persistence adapters

Goal:

- Separate the 0colors "brain" from the 0colors web app shell.

### Phase 2: Create A Zeros Colors Module

Add a native module inside the Mac app:

- `src/zeros/colors/` or `src/modules/colors/`

Suggested structure:

- `model/`: node/token/theme types
- `logic/`: advanced logic evaluator
- `exporters/`: CSS/DTCG/Tailwind/Figma output
- `runtime/`: generated runtime package/logic evaluator
- `ui/`: Mac app UI components
- `persistence/`: `.zeros` serialization

### Phase 3: Put Data Into `.zeros`

Move 0colors project state into the future `.zeros` file:

- nodes
- tokens
- groups
- pages
- themes
- canvas states
- advanced logic
- dev configs without secrets

This avoids juggling separate project databases.

### Phase 4: Local Dev Mode

Replace hosted-only Dev Mode with local project output:

- write `tokens.css`
- write `tokens.json`
- write `tailwind.config`
- write Figma variables JSON
- optionally run a local file watcher
- optionally expose a localhost webhook
- optionally push to Git through Zeros Git panel

This fits the Mac app better than requiring a cloud backend for local token sync.

### Phase 5: Optional Cloud Features

Keep cloud only for:

- account/license
- backups/sync
- community publish
- hosted token API
- hosted webhook endpoint
- team collaboration later

## The End-User Runtime Problem

The user raised an important product problem:

> If a Zeros user's customer changes a hue slider inside the user's shipped product, how does the 0colors logic run for that customer?

There are two separate use cases:

### Use Case A: Design-Time Tokens

The designer changes nodes inside Zeros. Zeros exports static tokens to the codebase.

This can be local-only and is simpler.

Example:

- User changes palette in Zeros.
- Zeros writes `src/styles/tokens.css`.
- App hot reloads.
- The shipped product later uses static CSS variables.

### Use Case B: Runtime Customization

The end customer changes a hue slider in the shipped product. The token graph must recompute in that customer's browser/app.

This needs a runtime package.

Recommended solution:

- Compile the 0colors graph into a small JavaScript runtime.
- Export:
  - serialized graph
  - evaluator
  - CSS variable writer
  - optional React hook
- The user's app imports this runtime.
- End-user changes input values.
- Runtime evaluates token outputs locally in the browser.
- CSS variables update instantly.

This should not call Zeros cloud for every customer interaction.

## Recommended Runtime Package

Future package idea:

- `@zeros/colors-runtime`

It should provide:

- `createColorSystem(graph)`
- `setInput(nodeId, value)`
- `getTokens(themeId)`
- `toCSSVariables()`
- `applyToDocument()`
- framework adapters later

Product explanation:

> Zeros Colors can export either static tokens or a live runtime. Static tokens are for design systems. Live runtime is for products where end users customize themes.

## What To Remove Or Avoid

Avoid bringing these directly into the Mac app:

- the 0colors web app router
- 0colors auth wrapper as a required local dependency
- hosted-only assumptions
- cloud sync as primary persistence
- PAT storage in project data
- separate design tokens that fork from `styles/tokens.css`

Keep or adapt:

- node/token/theme types
- advanced logic
- exporters
- computation pipeline
- QA tests
- community publish as optional cloud feature
- dev-mode concepts, but local-first

## Best Product Shape

In the Mac app, 0colors should appear as a new workspace mode:

- Design
- Colors
- Git
- Terminal
- Env
- Todo

Or inside Design as a left-nav section:

- Inspect
- Variants
- Themes
- Colors

Recommendation:

> Make `Colors` a first-class Column 3 tab once the module is extracted. Do not hide it inside the old overlay workspace.

## Cleanup Checklist

- Extract 0colors domain logic from app shell.
- Define `.zeros.colors` schema.
- Decide local output targets.
- Build local file writer through existing engine/native IPC.
- Define cloud feature boundary.
- Build runtime export plan.
- Replace 0colors styling with shared `styles/tokens.css`.
- Migrate auth usage to optional account layer.
- Keep QA tests and adapt them to extracted logic.

## Status Summary

Current:

- 0colors is powerful but separate.
- Backend and cloud features exist.
- Dev Mode exists but is cloud/webhook oriented.
- Integration into the Mac app is not done.

Desired:

- 0colors becomes the Zeros Colors module.
- Core graph logic becomes local-first.
- Project state lives in `.zeros`.
- Cloud becomes optional.
- Runtime package handles end-user customization use cases.