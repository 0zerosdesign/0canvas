# Design Workspace And Style Editor Deep Dive

This document expands the browser overlay/design workspace documentation. It explains the visible UI, how style editing works, how variants work, where `.0c` fits, and what the backend/local engine does.

## Short Answer

The old browser overlay is now mostly the **Design tab in Column 3** of the Mac app.

The browser overlay still exists as `<Zeros />`, but the active product experience is:

> Mac app -> Column 3 -> Design tab -> `EngineWorkspace` -> preview canvas + style editor + variants + theme tools.

Important naming:

- **Browser overlay**: old floating UI that can still mount on a webpage.
- **Design workspace**: the React UI currently used in the Mac app.
- **Local engine**: hidden Node sidecar that writes files, indexes CSS, exposes WebSocket/MCP, and talks to agents.

## Main Files

User-facing workspace:

- `src/zeros/engine/zeros-engine.tsx`
- `src/zeros/panels/workspace-toolbar.tsx`
- `src/zeros/panels/app-sidebar.tsx`
- `src/zeros/canvas/variant-canvas.tsx`
- `src/zeros/canvas/source-node.tsx`
- `src/zeros/canvas/variant-node.tsx`
- `src/zeros/panels/style-panel.tsx`
- `src/zeros/themes/themes-page.tsx`
- `src/zeros/panels/theme-mode-panel.tsx`
- `src/zeros/panels/command-palette.tsx`
- `src/zeros/panels/inline-edit.tsx`
- `src/zeros/panels/visual-diff.tsx`

Inspection and direct DOM behavior:

- `src/zeros/inspector/`*

State:

- `src/zeros/store/store.tsx`

`.0c` project file:

- `src/zeros/format/oc-project.ts`
- `src/zeros/format/oc-project-store.ts`
- `src/engine/oc-manager.ts`

Backend/local engine:

- `src/engine/index.ts`
- `src/engine/server.ts`
- `src/engine/css-file-writer.ts`
- `src/engine/tailwind-writer.ts`
- `src/engine/css-resolver.ts`

## User Flow: Opening The Design Workspace

### In the Mac App

1. User opens the Zeros Mac app.
2. User picks a project folder from Column 1.
3. User starts the app's dev server, for example `pnpm dev`.
4. Column 1 detects localhost services.
5. User clicks a localhost preview.
6. Column 3 Design tab loads the preview inside a source node iframe.
7. Zeros scans the preview DOM and builds a selectable element tree.
8. User clicks an element.
9. Right Style panel shows styles for that element.

### In The Old Browser Overlay

1. A page includes `<Zeros />`.
2. Zeros creates a portal on `document.body`.
3. It injects its CSS.
4. User sees a floating button.
5. User opens the overlay.
6. The same `EngineWorkspace` appears full screen over the website.

Current status:

- **Mac app path is primary**.
- **Floating overlay path is legacy/public-package mode**.

## Design Workspace Layout

Location:

- `src/zeros/engine/zeros-engine.tsx`

Visible areas:

- Left internal sidebar: Design and Themes.
- Top toolbar: project/mode/import/export controls.
- Center canvas: ReactFlow canvas containing the main preview and variants.
- Right panel: Style, Feedback, or Theme Mode panel.
- Global overlays: command palette, inline edit, visual diff.

### Internal Sidebar

Location:

- `src/zeros/panels/app-sidebar.tsx`

Visible UI:

- Design tab.
- Themes tab.
- Close button only when `onClose` exists.

Status:

- **Wired**.

Important Mac app detail:

- The close button usually does not show in the Mac app because Column 3 embeds the workspace directly.

### Toolbar

Location:

- `src/zeros/panels/workspace-toolbar.tsx`

Visible UI:

- Current project/app identity.
- App route navigation controls.
- Feedback mode.
- Style mode.
- Theme mode.
- `.0c` import/export.

Status:

- **Wired / partially legacy**.

Why partially legacy:

- `.0c` is still the old project file name.
- The toolbar has project identity controls while the Mac app also has Column 1 workspace selection.

## The Style Editor: What The User Sees

Location:

- `src/zeros/panels/style-panel.tsx`

The Style panel appears on the right side of the Design workspace when:

- the workspace is in Style mode, and
- Theme Mode is not active.

Empty states:

- If no preview is connected: "Connect a project to inspect styles."
- If preview is connected but no element is selected: "Select an element to inspect its styles."

Once an element is selected, the user sees:

- Style header.
- Focus mode toggle.
- Copy CSS button.
- Breakpoint badge when not desktop.
- HTML tag badge.
- Prop count.
- Class badges.
- Editor/Code tabs.
- Search field.
- Tailwind Classes section if Tailwind classes are detected.
- CSS categories.
- Visual editors for certain categories.
- Raw code preview.

## Style Editor Header

Visible information:

- Panel title: Style.
- Breakpoint badge, such as mobile/tablet/laptop.
- Selected tag, for example `<button>`.
- Number of detected style props.
- Up to five class badges.
- Overflow count if more than five classes.

Actions:

- Focus mode toggle.
- Copy CSS.

Focus mode:

- **On**: only one style category is open at a time.
- **Off**: multiple categories can be open.
- User preference is persisted with native settings key `style-focus-mode`.

Copy CSS:

- Copies a CSS block using the selected element selector and detected properties.

## Style Editor Tabs

### Editor Tab

Purpose:

- Visual and form-based editing.

Includes:

- Search field.
- Tailwind classes section.
- Categorized CSS sections.

### Code Tab

Purpose:

- Read-only CSS-style view of the selected element's current detected styles.

Important limitation:

- It is not a full code editor. Editing happens through the Editor tab rows and visual controls.

## Style Categories

Location:

- `STYLE_CATEGORIES` in `src/zeros/panels/style-panel.tsx`

The style editor groups CSS properties into categories. Categories only show when the selected element has matching detected styles.

Visible category behavior:

- Each category has a chevron.
- Each category shows a count of active properties.
- Empty categories are hidden.

Special visual editors:

- Spacing.
- Typography.
- Layout.
- Border.
- Effects.
- Tailwind Classes.

Generic property rows:

- Used for categories without a custom visual editor.
- Shows property name, value, optional color swatch, token suggestions, and enable/disable checkbox.

## Property Rows

Each row represents one detected CSS property.

Visible UI:

- Checkbox-style enable/disable control.
- Property name, converted to kebab-case.
- Property value.
- Color swatch when the value looks like a color.
- Token suggestions when matching theme tokens exist.
- Inline editing input with autocomplete.

What works:

- Clicking a value turns it into an input.
- Enter commits.
- Escape cancels.
- Blur commits after a short delay.
- Suggestions appear for known values.
- Clicking a suggestion commits it.
- Color values can open the Color Editor.

Technical flow when editing:

1. User changes a value.
2. React state dispatches `UPDATE_STYLE`.
3. Inspector applies the style live to the preview DOM.
4. The selected element briefly flashes.
5. `useStyleChange()` sends the change to the bridge.
6. The local engine can resolve and write the change to source CSS/Tailwind files.

Important limitation:

- The live DOM update is immediate, but durable source-code writing depends on the local engine finding the correct source location.

## Enable / Disable Property

Visible UI:

- Checkbox at the left of each property row.

What it does:

- Disabling removes the inline live style from the preview.
- Re-enabling restores the stored previous value.

Status:

- **Partially wired**.

Why:

- It changes the live preview, but disabling does not currently send a durable "remove this source style" operation in the same clear way that value editing sends a write.

## Color Editing

Location:

- `src/zeros/panels/style-panel.tsx`
- `ColorEditor` imported by the panel.

Visible UI:

- Swatch beside color-like values.
- Color editor popover.
- Token suggestions.

What works:

- Opens for color properties and color-looking values.
- Applies new color live.
- Sends style change through the bridge.
- Can select a token value instead of a raw color.

0colors relationship:

- Today this is separate from the full 0colors node-based system.
- Future integration should make 0colors the richer token/color intelligence layer behind this simpler style editor.

## Tailwind Editing

Location:

- `TailwindEditor` inside `src/zeros/panels/style-panel.tsx`
- Backend writing through `src/engine/tailwind-writer.ts`

Visible UI:

- Tailwind Classes section appears only when classes are detected.
- Tailwind class editing controls are shown under that section.

What works:

- Detects Tailwind-like class names.
- Lets the user edit class-based styling.
- Sends changes toward the local engine.

Important limitation:

- Tailwind writing depends on finding and safely changing the right source file/class string.

## Specialized Editors

### Spacing Editor

Purpose:

- Edit padding, margin, gap, width/height-related spacing values visually.

User experience:

- More visual than raw CSS rows.
- Still writes through the same style-change flow.

### Typography Editor

Purpose:

- Edit font size, family, weight, line height, text styles.

### Layout Editor

Purpose:

- Edit display, flex direction, alignment, justification, position-like values.

### Border Editor

Purpose:

- Edit border, radius, and border colors.

### Effects Editor

Location:

- `EffectsEditor` inside `src/zeros/panels/style-panel.tsx`

Visible UI:

- Opacity slider.
- Blend mode dropdown.

What works:

- Converts opacity to 0-1 CSS value.
- Writes `mix-blend-mode`.
- Applies live and sends through bridge.

## How Element Selection Works

Location:

- `src/zeros/canvas/source-node.tsx`
- `src/zeros/inspector/`*

Flow:

1. Preview iframe loads.
2. Zeros sets the inspection target to the iframe document.
3. It builds an element tree.
4. It rebuilds the element map.
5. It auto-starts inspect mode.
6. User clicks an element.
7. Zeros stores the selected element id.
8. It reads computed styles from the browser.
9. It stores selected styles in workspace state.
10. Style panel renders those properties.

Detected properties include:

- color
- backgroundColor
- fontSize
- fontFamily
- fontWeight
- lineHeight
- padding
- margin
- width
- height
- display
- flexDirection
- alignItems
- justifyContent
- gap
- position
- borderRadius
- border
- boxShadow
- opacity
- transform

Limitation:

- This is a curated property list, not every possible CSS property.

## Backend Flow For Style Writes

Frontend:

- `StylePanel` calls `useStyleChange()`.
- `useStyleChange()` sends a bridge message over WebSocket.

Bridge:

- `src/zeros/bridge/use-bridge.tsx`
- Connects renderer to the local engine.

Local engine:

- Receives style-change messages.
- Resolves where the style came from.
- Writes CSS through `CSSFileWriter`.
- Writes Tailwind classes through `TailwindWriter`.
- Watches files for changes.
- Can expose context through MCP.

Product explanation:

> The style editor is not just changing pixels in the preview. It tries to turn a visual edit into a real code edit in the user's project.

Important failure mode:

- If the engine cannot confidently map the selected DOM element/style to a source file, the preview can still change live but the real project file may not update.

## Variants: What They Are

Location:

- `src/zeros/canvas/variant-canvas.tsx`
- `src/zeros/canvas/variant-node.tsx`
- `src/zeros/store/store.tsx`

A variant is a fork of the current page or a selected component.

User purpose:

- Try alternate designs without immediately changing the main preview.
- Compare ideas.
- Fork from a variant again.
- Copy/send a finalized variant to an agent.
- Push a component variant back to the main preview.

## Variant Canvas UI

Visible UI:

- Main Preview source node.
- Variant nodes to the right.
- ReactFlow pan/zoom controls.
- Background grid.
- Draggable nodes.
- Resizable source preview.
- Device/viewport presets.

Status:

- **Wired**.

Important detail:

- There are no visual edges/wires. Parent-child relationship exists in data, and layout places child variants in deeper columns.

## Source Node

Location:

- `src/zeros/canvas/source-node.tsx`

Visible UI:

- Main preview iframe.
- Viewport presets: Desktop, Laptop, Tablet, Mobile.
- Inspect controls.
- Refresh/scan controls.
- Fork page/component affordances.
- Feedback controls.

Behavior:

- Loads `state.project.devServerUrl` when set.
- In the Mac app, it does not use the Zeros app URL as fallback because that would recursively show Zeros inside itself.
- In legacy browser overlay mode, it can fall back to `window.location.href`.

## Creating A Variant

### Fork Page

Flow:

1. User forks the whole page.
2. Zeros captures a page snapshot.
3. It creates a `VariantData` record.
4. It saves the variant to state.
5. It persists it through native/browser storage.
6. A variant node appears to the right of the main preview.

Stored fields include:

- id
- name
- html
- css
- mockData
- source type
- source page route
- source viewport width
- source content height
- parent id
- status
- created timestamp

### Fork Component

Flow:

1. User forks selected component/element.
2. Zeros captures only that component.
3. It stores the source element id and outer HTML.
4. A component variant node appears.

### Fork Variant

Flow:

1. User forks an existing variant.
2. New variant uses the modified HTML/CSS from parent variant if available.
3. Parent-child relationship is stored through `parentId`.

## Variant Actions

Actions:

- Delete variant.
- Finalize variant.
- Send to agent.
- Push to main.
- Fork again.

### Finalize

Status:

- **Wired in state**.

Meaning:

- Marks the variant as finalized.

### Send To Agent

Status:

- **Partially wired / clipboard-based**.

What happens:

- Builds a markdown package containing variant name, type, selector, HTML, and CSS.
- Copies it to clipboard.
- Marks variant status as sent.

Important:

- This does not yet directly inject the variant into an active agent chat as a structured attachment.

### Push To Main

Status:

- **Partially wired**.

What works:

- For component variants with `sourceElementId`, it tries to replace the source element DOM with variant HTML/CSS.
- Marks variant as pushed when successful.

Limitation:

- This is mainly DOM-level push, not necessarily a durable source-code transformation.

## Feedback Mode

Visible UI:

- Right panel switches from Style to Feedback.
- Feedback list shows pending items.
- Empty state says no feedback yet.
- Source preview can render feedback markers.

Status:

- **Wired / partially productized**.

Flow:

1. User selects/clicks elements in feedback mode.
2. Feedback item stores selector, tag, classes, comment, intent, severity, status.
3. Feedback appears in the panel.
4. Source node can copy pending feedback to clipboard.
5. Feedback can be sent to an agent manually.

Limitation:

- The agent handoff is still clipboard/manual in parts instead of being a fully structured workflow.

## Theme Mode

Locations:

- `src/zeros/panels/theme-mode-panel.tsx`
- `src/zeros/themes/themes-page.tsx`

Visible UI:

- Theme Mode replaces Style/Feedback right panel.
- Themes page shows full token table editor.

Status:

- **Wired**, but separate from full 0colors logic.

What works:

- CSS file selection.
- Token extraction.
- Multi-theme columns.
- Color token editing.
- Variable detail panel.
- Multi-select.
- Batch rename/delete.
- Search/filter.
- Paste CSS variables.
- Two-way sync with source CSS file.

Mac app behavior:

- Uses native file picker/read/write for CSS files.

Browser behavior:

- Uses File System Access API when available.

0colors relationship:

- Current theme/token editor is simpler and file-based.
- 0colors is richer and graph-based.
- Future plan should connect them through a shared token model instead of duplicating token editing forever.

## `.0c` Project File

Locations:

- `src/zeros/format/oc-project.ts`
- `src/zeros/format/oc-project-store.ts`
- `src/engine/oc-manager.ts`

User meaning:

- `.0c` is the current design workspace project file.
- It should eventually become `.zeros`.

What `.0c` stores:

- Project metadata.
- Routes.
- Variants.
- Feedback items.
- Selected/current route.
- Timestamps.
- Integrity hash.

What `.0c` should not store long-term:

- Full user source code.
- Secret keys.
- Agent transcripts as primary storage.
- Large build artifacts.
- Runtime-only DOM caches.

## `.0c` Browser/Renderer Persistence

Location:

- `src/zeros/format/oc-project-store.ts`

How it works:

- Uses IndexedDB database `Zeros-projects`.
- Loads a saved project file on workspace mount.
- Auto-saves state changes.
- Supports import.
- Supports export/download.

Status:

- **Wired**, but browser-era.

Concern:

- IndexedDB is not the ideal primary persistence for a native Mac app. It should become a compatibility/cache layer.

## `.0c` Engine/Disk Persistence

Location:

- `src/engine/oc-manager.ts`

How it works:

- Local engine can list/read/write/create/delete `.0c` files on disk.

Status:

- **Partially aligned**.

Important issue:

- There are signs of schema mismatch between browser/renderer `.0c` handling and engine/disk `.0c` handling. The cleanup plan should unify this before renaming to `.zeros`.

## `.zeros` Future Direction

Recommended product meaning:

> `.zeros` should be the local project/design state file for Zeros, similar to how design tools have a native project file, but connected to the user's real codebase.

Recommended migration:

1. Freeze the current `.0c` schema as legacy.
2. Define one canonical `.zeros` schema.
3. Store `.zeros` in the project folder, likely under `.zeros/project.zeros` or a named project file.
4. Keep import support for `.0c`.
5. Convert `.0c` to `.zeros` on import/open.
6. Make the local engine the source of truth for native persistence.
7. Keep IndexedDB only for browser overlay/public package mode.

## How Variants And `.0c` Connect

Flow:

1. User forks a page/component.
2. Variant is added to workspace state.
3. Auto-save builds current project file.
4. Variant is serialized into `.0c`.
5. On next load, `.0c` is read.
6. Variants are restored into state.
7. Variant nodes are rebuilt on the ReactFlow canvas.

This means:

- Variants are not just visual cards.
- They are stored as design history/alternatives inside the project file.

## Backend Perspective

The local engine does not render the Style panel. It supports it.

Backend responsibilities:

- Start local HTTP/WebSocket server.
- Track project root.
- Resolve CSS source files.
- Write CSS changes.
- Write Tailwind class changes.
- Watch files.
- Manage `.0c` files on disk.
- Expose MCP context/tools.
- Manage native agent gateway.

Style editor dependency on backend:

- Without the local engine, the style editor can still inspect and apply live browser changes.
- With the local engine, style edits can become real file changes.

## What Is Fully Covered Now

Covered in this doc:

- Browser overlay status.
- Mac app Design tab status.
- Style editor user flow.
- Style editor technical flow.
- Style categories.
- Tailwind editing.
- Color/token editing.
- Variant creation and actions.
- Feedback mode.
- Theme mode.
- `.0c` persistence.
- `.zeros` direction.
- Backend/local engine responsibilities.

## What Still Needs Cleanup

1. Decide whether `<Zeros />` overlay remains a public package or becomes legacy-only.
2. Rename "engine" references so UI workspace and backend sidecar are not confused.
3. Make style disable/remove operations durable, not just live-preview behavior.
4. Connect "Send to Agent" directly to active chat instead of clipboard-only handoff.
5. Make "Push to Main" a real source-file change when possible.
6. Unify `.0c` schemas before building `.zeros`.
7. Move IndexedDB persistence out of the Mac app primary path.
8. Connect 0colors token logic to the Theme/Style editor through a shared token runtime.
9. Reduce duplicated project-switching UI between Column 1 and Design toolbar.
10. Audit CSS injection/reset so Design workspace styles cannot leak into Git/Terminal/Env/Todo panels.

## Product Explanation

The design workspace is the visual editing surface of Zeros. It lets a user open their running app, click UI elements, inspect styles, make changes, create variants, collect feedback, and manage theme tokens.

The local engine is the hidden helper that turns those visual actions into real project changes. The current system is already powerful, but it still carries older browser-overlay assumptions. The cleanup work is not about removing the feature. It is about making the Mac app the main product and making the overlay a controlled legacy/public mode.