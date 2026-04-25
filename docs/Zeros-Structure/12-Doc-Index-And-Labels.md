# Documentation index and labels (PR 2+)

This file is the **single place** to see which docs describe the **shipping** Zeros Mac app (Electron + local engine + React) versus **historical**, **partial**, or **aspirational** material.

## How to read labels


| Label            | Meaning                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **Current**      | Written for the Electron Mac app and local engine; intended to match the repo today.            |
| **Partial**      | Still useful, but mixed with older UX or stack names; read the module banner in each file.      |
| **Historical**   | Frozen snapshot or engine-only reference; may say "browser overlay," Tauri, or ACP in places.   |
| **Aspirational** | Future / research architecture (e.g. hypothetical `src-tauri` modules); **not** the live stack. |
| **Superseded**   | Replaced by a newer doc; kept for migration or legal/attribution context.                       |


## Repository root


| Path                    | Label   | Notes                                                                                                                                 |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md` (repo root) | Current | Zeros overview, Mermaid **three-process** diagram (main / renderer / engine), `pnpm` dev commands, link into `docs/Zeros-Structure/`. |


## Product-owner docs (`docs/Zeros-Structure/`)


| Doc                                             | Label   | Notes                                                 |
| ----------------------------------------------- | ------- | ----------------------------------------------------- |
| `00-Start-Here.md`                              | Current | Entry point; mental models and naming reality.        |
| `01-Folder-Map.md`                              | Current | Top-level folder map.                                 |
| `02-Current-User-Flows.md`                      | Current | User-facing flows.                                    |
| `03-Mac-App-Architecture.md`                    | Current | Electron ↔ renderer ↔ engine sidecar.                 |
| `04-Agent-Chat-And-Agents.md`                   | Current | Native CLI adapters and chat.                         |
| `05-Browser-Overlay-And-Engine.md`              | Current | Explains legacy overlay vs design workspace in Col 3. |
| `06-Project-Files-0c-And-Zeros.md`              | Current | `.0c` / `.zeros` direction.                           |
| `07-0colors-Integration.md`                     | Current | Integration strategy.                                 |
| `08-0accounts-0research-Websites.md`            | Current | Web products.                                         |
| `09-Cleanup-And-Consolidation-Plan.md`          | Current | Roadmap and cleanup phases.                           |
| `10-UI-Inventory-And-Wiring-Status.md`          | Current | Wired vs placeholder UI.                              |
| `11-Design-Workspace-Style-Editor-Deep-Dive.md` | Current | Style editor and variants.                            |
| **12-Doc-Index-And-Labels.md** (this file)      | Current | Doc inventory; PR 2+ labeling.                        |


## Root and top-level `docs/`


| Doc                                      | Label                          | Notes                                                                                                                                                                       |
| ---------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROJECT_ANALYSIS.md`                    | Historical                     | Long-form engine reference; banner points here. Shell/IPC sections describe the pre–Mac-app era; vision links to removed files were deleted—use `Zeros-Structure/` instead. |
| `Development Enhancement and Collab.md`  | Aspirational                   | Phased collab / LSP / `src-tauri` plan; ideas only.                                                                                                                         |
| `AGENT_RUNTIME.md`                       | Partial (current native focus) | Native agents; ACP section is historical; label banner in PR 4.                                                                                                             |
| `ORCHESTRATION_DESIGN.md`                | Partial                        | Orchestration **proposal**; ACP-centric language — compare to `src/engine/agents/`.                                                                                         |
| `ATTRIBUTIONS.md`                        | Current                        | Third-party credits; stack section should match `package.json`.                                                                                                             |
| `ZEROS_COLORS_INTEGRATION_TRANSCRIPT.md` | Historical                     | Research transcript; not authoritative for current build.                                                                                                                   |


## `docs/context/` (per-module reference)

These were written for the V1/V2 **engine** era. Most **Col 3** behavior is still accurate; **shell and native** descriptions are updated in `context/README.md` to say **Electron** and `electron/`, not Tauri.

**PR 4:** Every file below has a top-of-file **doc label** blockquote (`Partial` or `Superseded`) stating that **VS Code extension** and **Tauri** mentions in the body are **historical** where applicable.


| Path                                                                                | Label          | Notes                                                                |
| ----------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------- |
| [context/README.md](../context/README.md)                                           | Partial        | Index of modules; PR 4 note in the opening banner.                   |
| [context/inspector/README.md](../context/inspector/README.md)                       | Partial        | DOM inspector modules.                                               |
| [context/style-panel/README.md](../context/style-panel/README.md)                   | Partial        | Style panel; may mention VS Code for writes — historical.            |
| [context/style-panel/editors.md](../context/style-panel/editors.md)                 | Partial        | Visual editors.                                                      |
| [context/style-panel/libraries.md](../context/style-panel/libraries.md)             | Partial        | Shared style-panel libs.                                             |
| [context/canvas-variants/README.md](../context/canvas-variants/README.md)           | Partial        | ReactFlow canvas.                                                    |
| [context/themes/README.md](../context/themes/README.md)                             | Partial        | Themes and tokens.                                                   |
| [context/feedback/README.md](../context/feedback/README.md)                         | Partial        | Feedback annotations.                                                |
| [context/responsive/README.md](../context/responsive/README.md)                     | Partial        | Breakpoints.                                                         |
| [context/format-persistence/README.md](../context/format-persistence/README.md)     | Partial        | `.0c` schema; file-first in Mac app.                                 |
| [context/overlay/README.md](../context/overlay/README.md)                           | Partial        | “Overlay” = Col 3 in the app.                                        |
| [context/overlay/command-palette.md](../context/overlay/command-palette.md)         | Partial        | Command palette.                                                     |
| [context/ai-agents/README.md](../context/ai-agents/README.md)                       | Partial        | AI panel moved to Col 2.                                             |
| [context/ai-agents/inline-edit.md](../context/ai-agents/inline-edit.md)             | Partial        | Cmd+K inline edit.                                                   |
| [context/settings/README.md](../context/settings/README.md)                         | Partial        | Settings UI; keychain via Electron.                                  |
| [context/bridge-communication/README.md](../context/bridge-communication/README.md) | Partial        | WebSocket; VS Code as third party — historical.                      |
| [context/extension/README.md](../context/extension/README.md)                       | **Superseded** | **VS Code extension** — not maintained; file is **historical** only. |


## Removed files (do not link)

The following were removed from the repo; older docs may still mention them:

- `PRODUCT_VISION_V3.md`
- `PRODUCT_VISION.md` / `PRODUCT_VISION_V2.md`
- `TAURI_MAC_APP_PLAN.md`
- `TAURI_SETUP.md`
- `DOCUMENTATION.md`

Use `**Zeros-Structure/`** and this index instead.

## Naming cleanup progress

- **PR 1:** Comment-only pass in `src/` and `electron/` (Tauri / Rust-side / ACP wording where behavior is Electron / native agents).
- **PR 2:** Documentation labels, this index, broken-link repair, and attribution stack alignment.
- **PR 3:** Root `README.md` + Mermaid **three-process** diagram; contributor quick start.
- **PR 4:** Bulk **doc label** banners on `docs/context/`** and selected top-level docs — marks **VS Code extension** and **Tauri** prose as **historical** where the live stack is **Electron** + local engine; **extension/README** explicitly **Superseded**.