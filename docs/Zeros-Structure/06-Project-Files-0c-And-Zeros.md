# Project Files: `.0c` And Future `.zeros`

This explains the current project file situation and what needs to happen next.

## Current Reality

The current implemented design project format is `.0c`.

Main files:

- `src/zeros/format/oc-project.ts`
- `src/zeros/format/oc-project-store.ts`
- `src/engine/oc-manager.ts`

The future product direction mentioned by the user is `.zeros`, but the codebase currently still implements `.0c`.

## What `.0c` Is Supposed To Store

The schema in `oc-project.ts` says one `.0c` file is intended to represent an entire Zeros design project:

- project metadata
- workspace metadata
- breakpoints
- variables
- pages
- source HTML/styles
- layer tree
- variants
- annotations
- feedback
- history checkpoints
- integrity hash

In product terms:

> `.0c` is the current portable file for a Zeros design workspace.

## Current Schema Version

The current schema version is:

- `OC_PROJECT_SCHEMA_VERSION = 1`

There is a migration pipeline placeholder, but no real migrations yet.

## Browser/Renderer Persistence Path

`oc-project-store.ts` uses IndexedDB:

- database: `Zeros-projects`
- project store: `oc-projects`
- sync metadata store: `oc-sync-meta`

It supports:

- save project file
- load project file
- list files
- delete file
- import `.0c` / `.json`
- export/download `.0c`
- build current project file

This path comes from browser-style persistence.

## Engine Disk Persistence Path

`src/engine/oc-manager.ts` manages `.0c` files on disk.

It supports:

- find all `.0c` files
- read a `.0c` file
- write a `.0c` file atomically
- create a new `.0c` file
- delete a `.0c` file

This is the more Mac-app-native direction because the app can directly read/write the user's project folder.

## Important Mismatch

There is a schema mismatch risk:

- `oc-project.ts` expects breakpoints to be numbers.
- `oc-manager.ts` creates breakpoint objects with label/width/height.

This should be audited before relying on engine-created `.0c` files. It may be a bug or stale implementation.

## What `.zeros` Should Become

If the product moves from `.0c` to `.zeros`, do not just rename the extension. Use the migration to define the final local-first product file.

Recommended `.zeros` role:

> A single local-first project bundle/manifest that stores all Zeros-owned project state for one codebase.

It should include:

- Zeros design workspace state
- selected app/dev server metadata
- pages/routes
- variants
- feedback/comments
- theme/token file references
- 0colors graph and token systems
- agent chat metadata
- optional chat transcript pointers
- project settings
- integration settings
- local-only secrets references, never secrets
- version/migration metadata

## What Should Not Go Into `.zeros`

Do not store:

- API keys
- OAuth tokens
- vendor CLI credentials
- Git credentials
- large generated build outputs
- node_modules data
- raw screenshots/videos unless intentionally embedded

Instead store references:

- keychain service names
- file paths
- generated output paths
- cloud ids

## `.0c` To `.zeros` Migration Strategy

Recommended path:

1. Keep `.0c` import working.
2. Introduce `.zeros` schema v1.
3. Add converter: `.0c` to `.zeros`.
4. Save new projects as `.zeros`.
5. Keep `.0c` export as compatibility for a while.
6. Remove `.0c` as internal source of truth once migration is stable.

## Local-First Model

For the Mac app, local-first means:

- The user's project data is stored in their project folder.
- Zeros can work without a cloud account.
- Cloud sync is optional.
- The file format is inspectable and versioned.
- Git can track the file if the user wants.

This fits the product vision better than browser IndexedDB as the primary source of truth.

## How 0colors Fits

0colors currently stores:

- projects
- nodes
- tokens
- groups
- pages
- themes
- canvas states
- advanced logic
- dev configs
- cloud sync metadata

In a unified Zeros product, most of this should become a `.zeros` module:

```json
{
  "schemaVersion": 1,
  "project": {},
  "design": {},
  "colors": {
    "nodes": [],
    "tokens": [],
    "themes": [],
    "advancedLogic": []
  },
  "agents": {},
  "integrations": {}
}
```

This is conceptual, not current code.

## Project File UX

For a non-technical user, the file should be explained like:

> A `.zeros` file is your design workspace memory for a codebase. It remembers your variants, feedback, color systems, token logic, and Zeros settings.

Do not expose too much technical language in the UI.

Possible UI labels:

- "Project file"
- "Save Zeros project"
- "Import Zeros project"
- "Export Zeros project"
- "Project memory"

Avoid making users think about schema versions unless there is an error.

## Cleanup Checklist

- Decide whether `.0c` is legacy or still the shipping format.
- Fix schema mismatch between `oc-project.ts` and `oc-manager.ts`.
- Move primary Mac persistence away from browser download/import patterns.
- Decide where chat transcripts live.
- Decide how 0colors graph state is embedded.
- Add migrations before changing stored data shape.
- Rename user-facing `.0c` labels after `.zeros` is implemented.
- Keep secret values out of project files.

## Status Summary

Current:

- `.0c` exists and is wired.
- `.zeros` is product intent, not implemented as a real format.
- Persistence is split between browser-style IndexedDB and engine disk manager.

Desired:

- `.zeros` becomes the local-first source of truth.
- `.0c` becomes import/export legacy compatibility.
- 0colors and design workspace state share one project model.

