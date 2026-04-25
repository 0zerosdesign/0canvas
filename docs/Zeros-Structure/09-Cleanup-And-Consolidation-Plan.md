# Cleanup And Consolidation Plan

This is a practical plan to make the repo easier to understand, faster, and more product-focused without losing important features.

## Product Direction

Make one primary product:

> **Zeros**: a local-first Mac app for design-led software building.

Supporting products:

- **0accounts**: shared account/auth service.
- **0research**: public learning/content website.
- **Zeros Colors**: should become a module inside the Mac app, not a separate product the user has to maintain day-to-day.

## Core Principles

1. **Local-first by default**
  The Mac app should work without login.
2. **Cloud optional**
  Cloud should support sync, publish, community, hosted APIs, and account/license features.
3. **One project memory**
  Use `.zeros` as the future unified project file.
4. **One design system**
  Keep `styles/tokens.css` as shared source of truth.
5. **Native app first**
  Browser overlay can remain, but should not drive the main UX.
6. **No secret leakage**
  Keep credentials in keychain/vendor CLIs/env, not project files.

## Cleanup Phase 1: Documentation Truth Pass

Goal:

- Remove confusion from stale docs/comments.

Actions:

- Replace root `README.md` with current Zeros Mac app overview. **(PR 3)**
- Mark Tauri docs as historical or remove if no longer needed. **`docs/context/` labeled in PR 4;** repo-wide, use `12-Doc-Index-And-Labels.md` and one-off file banners.
- Mark VS Code extension docs as historical. **(PR 4 — `context/extension/README.md` + index)**
- Update comments saying "Tauri", "Rust side", or "ACP" where current behavior is Electron/native agents. **(PR 1)**
- Add a short architecture diagram to root docs. **(PR 3)**
- Keep these `docs/Zeros-Structure` docs as product-owner documentation.

Expected result:

- A new contributor can understand the current product in one hour.

### Naming and boundaries: PR 1, PR 2, and PR 3 (incremental)

- **PR 1 (done):** Comment-only updates in `src/` and `electron/` so active code describes Electron, the local engine sidecar, the design workspace, and native agent adapters (without renaming runtime ids or persisted keys).
- **PR 2 (done):** Documentation labeling — see `docs/Zeros-Structure/12-Doc-Index-And-Labels.md` for which files are **current**, **partial**, **historical**, or **aspirational**; repair broken links to removed vision/Tauri plan docs; align `docs/ATTRIBUTIONS.md` with the shipping stack; refresh `docs/context/README.md` to point at `electron/` and this index instead of `src-tauri/` and deleted markdown files.
- **PR 3 (done):** Root `README.md` replaced with a current Zeros overview, repository map, dev commands, and a **Mermaid** architecture diagram (three processes: main, renderer, engine). Phase 1 item “short architecture diagram to root docs” is satisfied at the repository root.
- **PR 4 (done):** Bulk historical labeling — **doc label** banners on all `docs/context/**/*.md` files (and selected top-level docs) so **Tauri** / **VS Code extension** content is explicitly **historical** or **superseded**; `12-Doc-Index-And-Labels.md` lists each file. Phase 1 actions “mark Tauri docs as historical” and “mark VS Code extension docs as historical” are satisfied for the `docs/context/` tree; remaining one-off files stay covered by the index and `PROJECT_ANALYSIS` / transcripts.

## Cleanup Phase 2: Naming And Boundaries

Goal:

- Make product boundaries obvious.

Actions:

- Decide final public name: likely `Zeros`.
- Decide repo/package naming strategy.
- Decide whether `.0c` is legacy or current.
- Define `.zeros` schema name and file extension.
- Rename "overlay engine" docs to "design workspace".
- Keep "local engine" for backend sidecar.
- Plan gradual cleanup of `acp` ids/comments without breaking saved chats.

Expected result:

- The codebase stops speaking in four eras at once.

## Cleanup Phase 3: Persistence Unification

Goal:

- One local-first source of truth.

Actions:

- Define `.zeros` v1 schema.
- Include design workspace state.
- Include future 0colors graph state.
- Include chat metadata.
- Store transcript pointers, not necessarily all messages at first.
- Store integration settings without secrets.
- Add `.0c` import converter.
- Fix current `.0c` schema mismatch.
- Move Mac app save/load away from browser download-first behavior.

Expected result:

- The user's project memory is understandable, portable, and versioned.

## Cleanup Phase 4: Agent Runtime Polish

Goal:

- Make agents feel instant and non-technical.

Actions:

- Keep native adapter direction.
- Improve first-run install/auth UI.
- Make "bring your own agent" language clear.
- Reconcile Mission Control with current agent events.
- Persist or index chat transcripts intentionally.
- Make permission modes easier to understand.
- Add health checks for each CLI.
- Add recovery UI when engine/agent crashes.

Expected result:

- Designers can safely use coding agents without learning CLI internals.

## Cleanup Phase 5: Design Workspace Native Feel

Goal:

- Make the old overlay feel like a native app module.

Actions:

- Isolate public overlay mode from Mac app mode.
- Reduce reliance on global CSS injection where possible.
- Remove style reset conflicts with Column 3 non-design tabs.
- Make localhost preview selection obvious.
- Improve empty states for no dev server/no selected element.
- Make inspect/edit/save flows visually direct.
- Connect selected element context more visibly to chat.

Expected result:

- The design workspace feels built for the Mac app, not pasted in.

## Cleanup Phase 6: 0colors Extraction

Goal:

- Integrate 0colors without dragging its entire web app structure into Zeros.

Actions:

- Extract core types.
- Extract advanced logic evaluator.
- Extract exporters.
- Extract computation pipeline.
- Extract persistence model.
- Design `colors` section inside `.zeros`.
- Create a Column 3 `Colors` tab.
- Use shared Zeros UI primitives and tokens.
- Convert Dev Mode to local-first file output.
- Keep cloud/community publish as optional.

Expected result:

- Zeros Colors becomes a product module, not a separate maintenance burden.

## Cleanup Phase 7: Runtime Token Package

Goal:

- Support user products that need live end-user theme customization.

Actions:

- Design `@zeros/colors-runtime`.
- Compile color graph to portable runtime data.
- Add browser evaluator.
- Add CSS variable applier.
- Add React hook later.
- Keep bundle small.
- Make static-token export the default and live-runtime export an advanced option.

Expected result:

- 0colors can serve both design-time and runtime customization use cases.

## Cleanup Phase 8: 0accounts Integration

Goal:

- Add accounts without making local app feel gated.

Actions:

- Add optional sign-in in Mac app.
- Use 0accounts for cloud features.
- Keep local use available without login.
- Share auth-client only where needed.
- Define product access for Zeros Mac app.
- Do not mix coding-agent vendor auth with Zeros account auth.

Expected result:

- Users understand "Zeros account" separately from "Claude/Codex login."

## Cleanup Phase 9: Repo Organization

Goal:

- Make folder structure reflect product reality.

Potential future structure:

```text
src/
  shell/              Mac app shell
  native/             renderer native facade
  zeros/
    design/           design workspace (current engine UI)
    agent/            agent UI
    colors/           integrated 0colors module
    format/           .zeros project format
    themes/
    ui/
  engine/             local sidecar backend
electron/
apps/
  0colors-legacy/     temporary while extracting
website/
  0accounts/
  0research/
servers/
  0accounts/
  0research/
docs/
```

Do not reorganize all at once. Move only when a module boundary is clear.

## What To Delete Eventually

Only after replacement is stable:

- stale Tauri setup docs
- stale VS Code extension references
- duplicated overlay docs
- unused demo pages
- old browser-only persistence paths
- ACP migration shims/comments that no longer protect compatibility
- generated build output accidentally tracked or treated as source

## What To Preserve

Preserve:

- native agent adapter work
- sidecar/watchdog architecture
- design workspace functionality
- 0colors domain logic and QA tests
- 0accounts auth-client
- 0research website as brand/content platform
- shared design tokens
- MCP tools
- Git/Terminal/Env/Todo panels

## Risks

### Biggest technical risk

Trying to merge 0colors UI directly into the Mac app before extracting its domain model.

### Biggest product risk

Making the Mac app require cloud/account/backend too early.

### Biggest codebase risk

Renaming everything in one massive refactor. This would create breakage without product value.

## Recommended Next 10 Tasks

1. ~~Replace root `README.md` and add a root architecture diagram.~~ **Done (PR 3).**
2. Decide `.zeros` schema scope.
3. Fix `.0c` schema mismatch.
4. Create a `.zeros` migration/design doc.
5. ~~Audit comments and `docs/context/` for Tauri/ACP/VS Code stale references.~~ **Largely done:** code comments in PR 1; `docs/context/` banners + index in **PR 4** (re-audit as code changes).
6. Extract 0colors logic into a shared module without UI.
7. Add a `Colors` tab prototype in Column 3.
8. Design local token output writer using existing engine/native file APIs.
9. Decide chat transcript persistence.
10. Create account-login UX as optional cloud entry, not boot blocker.

## Product North Star

The cleaned-up app should feel like:

> Open a project. See the product. Point at UI. Ask agents to help. Edit visually. Manage tokens/colors. Ship changes through Git. Everything stays local unless I choose cloud.

