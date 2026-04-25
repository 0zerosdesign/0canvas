# Command Palette

> **Doc label (PR 4):** Partial — [overlay/README.md](README.md). Historical **VS Code** / **Tauri** phrasing in the text refers to the old multi-participant model. [`03-Mac-App-Architecture.md`](../../Zeros-Structure/03-Mac-App-Architecture.md) · [`12-Doc-Index-And-Labels.md`](../../Zeros-Structure/12-Doc-Index-And-Labels.md).

## Overview

The command palette provides quick access to all Zeros actions through a fuzzy-searchable overlay. It follows the standard pattern established by VS Code, Figma, and similar tools.

Source: `src/zeros/panels/command-palette.tsx`

## Trigger

The command palette is opened via keyboard shortcut:

- **Cmd+/** or **Cmd+Shift+P**

It is rendered as a modal overlay on top of the workspace.

## Fuzzy Search

The palette uses a custom fuzzy matching algorithm that supports two modes:

1. **Substring match:** if the query appears anywhere in the text (case-insensitive), it matches
2. **Character-sequence match:** each character in the query must appear in order in the text, but not necessarily contiguously (e.g., "exoc" matches "Export .0c File")

Search runs against both the command label and its category name.

## Registered Commands

### Modes


| ID              | Label              | Shortcut | Action                          |
| --------------- | ------------------ | -------- | ------------------------------- |
| `mode-design`   | Switch to Design   | --       | `SET_ACTIVE_PAGE` -> "design"   |
| `mode-settings` | Switch to Settings | --       | `SET_ACTIVE_PAGE` -> "settings" |


### Panels


| ID              | Label               | Shortcut | Action               |
| --------------- | ------------------- | -------- | -------------------- |
| `toggle-layers` | Toggle Layers Panel | L        | `TOGGLE_STYLE_PANEL` |
| `toggle-style`  | Toggle Style Panel  | S        | `TOGGLE_STYLE_PANEL` |


### Tools


| ID                 | Label            | Shortcut | Action             |
| ------------------ | ---------------- | -------- | ------------------ |
| `toggle-inspector` | Toggle Inspector | I        | `TOGGLE_INSPECTOR` |


### Actions


| ID          | Label                        | Shortcut | Action                                         |
| ----------- | ---------------------------- | -------- | ---------------------------------------------- |
| `export-0c` | Export .0c File              | --       | Builds and downloads the project file          |
| `import-0c` | Import .0c File              | --       | Opens file picker, loads .0c project           |
| `copy-css`  | Copy CSS of Selected Element | --       | Copies the selected element's CSS to clipboard |


### Navigation


| ID             | Label              | Shortcut | Action                          |
| -------------- | ------------------ | -------- | ------------------------------- |
| `nav-settings` | Open Settings      | --       | `SET_ACTIVE_PAGE` -> "settings" |
| `nav-design`   | Open Design Canvas | --       | `SET_ACTIVE_PAGE` -> "design"   |


## Keyboard Navigation


| Key        | Action                                            |
| ---------- | ------------------------------------------------- |
| Arrow Down | Move highlight to next item                       |
| Arrow Up   | Move highlight to previous item                   |
| Enter      | Execute the highlighted command and close palette |
| Escape     | Close the palette without executing               |


The active item automatically scrolls into view when navigated with arrow keys.

## Visual Design

- **Overlay:** semi-transparent backdrop covering the entire workspace
- **Panel:** centered modal with search input at top, divider, then command list
- **Search input:** auto-focused on open, placeholder "Type a command..."
- **Command items:** grouped by category with category headers
- **Active item:** highlighted with the `is-active` class
- **Shortcut badges:** displayed as keyboard badge (`oc-cmd-kbd` class) next to command labels
- **Empty state:** "No commands found" when no matches exist

## Result Limit

A maximum of **10 visible results** are shown at any time. The list is sliced from the filtered results before grouping by category.

## Dismissal

The palette can be closed by:

1. Pressing **Escape**
2. Clicking the **backdrop** (the semi-transparent overlay behind the panel)
3. **Executing a command** (closes automatically, then runs the action on the next animation frame)

## Command Execution

When a command is executed:

1. `onClose()` is called immediately to dismiss the palette
2. The command's action runs on the next `requestAnimationFrame`, ensuring the palette is fully unmounted before side effects occur

## User Workflow

1. Press **Cmd+/** to open the command palette
2. Type a search query (e.g., "export")
3. The list filters to matching commands (e.g., "Export .0c File")
4. Use arrow keys to navigate or click directly
5. Press **Enter** to execute the highlighted command
6. The palette closes and the action runs

## Pending Features

- **Recent commands at top:** showing the most recently used commands before the full list
- **Plugin/extension commands:** allowing extensions (VS Code bridge, etc.) to register their own commands
- **More actions:** adding commands for all toolbar actions, breakpoint switching, variant operations, and theme mode toggles
- **Contextual commands:** showing different commands based on the current state (e.g., variant-specific actions when a variant is selected)
- **Command aliases:** supporting multiple names for the same command (e.g., "export" and "download")