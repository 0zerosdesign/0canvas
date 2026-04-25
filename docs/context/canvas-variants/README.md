# Canvas & Variants

> **Doc label (PR 4):** Partial — engine and Col 3 behavior described here is largely still accurate. Mentions of the **VS Code extension**, **Tauri**, or **live ACP runtime** in the prose below are **historical** unless stated otherwise. Current stack: **Electron** + local engine — see [`03-Mac-App-Architecture.md`](../../Zeros-Structure/03-Mac-App-Architecture.md). Full index: [`12-Doc-Index-And-Labels.md`](../../Zeros-Structure/12-Doc-Index-And-Labels.md).

## Overview

The canvas system is the central workspace of Zeros. It uses [ReactFlow](https://reactflow.dev/) to provide an infinite, pannable, zoomable canvas where the user sees a live preview of their app alongside forked design variants. The architecture lives across three main files:

- `src/zeros/canvas/variant-canvas.tsx` -- orchestrates the ReactFlow canvas, node layout, and all fork/delete/finalize actions
- `src/zeros/canvas/source-node.tsx` -- the live app preview (main iframe)
- `src/zeros/canvas/variant-node.tsx` -- each forked variant card (isolated srcdoc iframe)

## ReactFlow Infinite Canvas

`VariantCanvas` wraps the entire workspace in a `<ReactFlowProvider>`. The canvas is configured with:

- **Zoom range:** 0.02x to 4x
- **Interactions:** pan on scroll (free mode), zoom on scroll, zoom on pinch, Meta-key zoom activation
- **Node dragging:** enabled with a 5px drag threshold
- **No edges/connections:** variants are positioned spatially, not wired together
- **Background:** dot grid using `BackgroundVariant.Dots` at 20px gap
- **Controls:** zoom in/out buttons (no interactive toggle)
- **Fit view:** on mount with 0.2 padding, max zoom capped at 1x

During canvas interactions (pan, zoom, drag), a style guard is injected that sets `pointer-events: none` on all iframes inside `[data-Zeros]`. This prevents iframes from stealing mouse events mid-drag.

## SourceNode: Live App Preview

The SourceNode renders the user's actual running application inside an iframe (`<iframe name="Zeros-preview">`). It loads `window.location.href` so the preview is always the current page.

### Viewport Presets

Four responsive breakpoints are available as preset buttons, positioned vertically along the right edge of the source node:

| Preset   | Width   | Icon        |
|----------|---------|-------------|
| Desktop  | 1440px  | Monitor     |
| Laptop   | 1280px  | Laptop      |
| Tablet   | 768px   | Tablet      |
| Mobile   | 375px   | Smartphone  |

- Default dimensions: 1280 x 800
- Minimum: 320 x 300
- A current-width pill shows the active pixel width
- The active preset is highlighted; clicking a preset resizes the iframe width

### Chrome Bar

A floating bar above the source node contains:

- **URL pill:** shows `localhost` + the current route
- **Feedback button:** toggles inspect/feedback mode; shows a badge with pending feedback count; when items exist, a "Send" button appears to copy feedback to clipboard
- **Rescan button:** re-scans the iframe DOM to refresh the element tree
- **Fork Page button:** captures a full-page snapshot and creates a new variant

### Resize System

The source node uses custom pointer-capture resize handlers (not ReactFlow's NodeResizer). Three grab zones surround the card:

- **Left edge:** horizontal resize
- **Right edge:** horizontal resize
- **Bottom edge:** vertical resize

All handlers account for the current ReactFlow zoom level. A "Reset (800px)" button appears below the node when height differs from default.

### Inspect and Feedback

When feedback mode is active, clicking elements in the source iframe opens a feedback pill (see Feedback docs). The source node registers callbacks for:

- `onForkElementRequest` -- fork a specific element into a variant
- `onChangeRequest` -- add or update feedback on an element
- `onDeleteFeedbackRequest` -- remove feedback from an element
- `setFeedbackLookup` -- check if an element already has feedback

Feedback markers (numbered pins) are rendered directly into the iframe's document.

## VariantNode: Forked Design Cards

Each variant is rendered as a ReactFlow node with its own isolated iframe using `srcdoc`. The variant card includes:

### Floating Chrome Header

Positioned above the node (absolutely, at `bottom: 100%`), the header contains three sections:

1. **Left:** variant name (double-click to rename) + status badge
2. **Center:** breakpoint presets (Wide 768px, Tablet 560px, Mobile 375px) + dimensions display
3. **Right:** action buttons:
   - **Inspect** (Crosshair) -- toggle element inspection within the variant
   - **Fork** (GitFork) -- create a child variant from this one
   - **Copy HTML** (Copy) -- copy the variant's HTML to clipboard
   - **Finalize** (CheckCircle2) -- mark draft as finalized (shown for drafts only)
   - **Send to Agent** (Send) -- copy structured output to clipboard (shown for finalized only)
   - **Push to Main** (ArrowUpToLine) -- push changes back to the live DOM (shown for finalized with sourceElementId)
   - **Delete** (Trash2) -- remove the variant

### Resizing

Uses ReactFlow's `<NodeResizer>` with invisible handles (edge-drag only):
- Min: 280 x 160
- Max: 1440 x 4000
- During resize, an overlay shows the current dimensions

### srcdoc Construction

The variant's iframe is built from its `html` and `css` fields (preferring `modifiedHtml`/`modifiedCss` when present):

1. CSS is split into `@import` rules and regular rules
2. Internal rules are filtered out -- anything matching `[data-Zeros`, `.react-flow`, `--xy-`, or `--oc-` is stripped
3. A minimal reset is injected: `box-sizing: border-box`, `body { margin: 0 }`
4. The HTML is placed directly in `<body>`

## VariantData Type

```typescript
type VariantData = {
  id: string;
  name: string;
  html: string;                    // original captured HTML
  css: string;                     // original captured CSS
  mockData: { images: string[]; texts: string[] };
  sourceType: "page" | "component";
  sourceSelector?: string;
  sourceElementId?: string | null;
  sourcePageRoute?: string;
  sourceOuterHTML?: string;        // for component forks
  parentId: string | null;         // null = root, string = child of another variant
  status: "draft" | "finalized" | "sent" | "pushed";
  createdAt: number;
  modifiedHtml?: string;           // AI-modified HTML
  modifiedCss?: string;            // AI-modified CSS
  sourceViewportWidth?: number;    // viewport width at capture time
  sourceContentHeight?: number;    // content height at capture time
};
```

## Fork Workflow

### Fork Page

1. User clicks the GitFork button in the source node chrome bar
2. `capturePageSnapshot()` is called, which captures the full page HTML and all collected CSS
3. A new `VariantData` is created with `sourceType: "page"`, the current route, and the viewport width
4. The variant is added to the store and persisted to IndexedDB via `saveVariant()`
5. It appears as a new ReactFlow node to the right of the source

### Fork Component

1. User clicks an element in the source iframe (while inspect mode is active)
2. The feedback pill appears with a Fork button
3. Clicking Fork calls `captureComponentSnapshot(elementId)` for the selected element
4. `getElementOuterHTML(elementId)` is also stored as `sourceOuterHTML`
5. A new variant is created with `sourceType: "component"` and the element's ID/selector

### Fork Variant (Re-fork)

1. User clicks the Fork button on an existing variant's chrome header
2. A child variant is created using the source variant's `modifiedHtml` (or `html`) and `modifiedCss` (or `css`)
3. The new variant's `parentId` is set to the source variant's ID
4. Layout places children in the next depth column to the right

## Variant Layout

Variants are arranged in a column-based layout to the right of the source node:

- **Source node** is always at position (0, 0)
- **Root variants** (parentId = null) start at x = 1400 (VARIANT_COL_OFFSET)
- **Child variants** are placed in subsequent columns, offset by `nodeWidth + 80px` gap
- Within each column, variants stack vertically with a 60px gap
- Node dimensions are derived from `sourceViewportWidth` and `sourceContentHeight`, with minimums of 560x420 (page) or 560x200 (component)

## Variant Status Lifecycle

```
draft  -->  finalized  -->  sent  -->  pushed
```

| Status      | Meaning                                           | Visual                       |
|-------------|---------------------------------------------------|------------------------------|
| `draft`     | Initial state after forking                       | Muted surface badge          |
| `finalized` | User has approved this variant for handoff         | Green success badge/border   |
| `sent`      | Structured output copied to clipboard for agent    | Light primary badge          |
| `pushed`    | Changes applied back to the live DOM               | Primary blue badge           |

Transitions:
- **draft -> finalized:** user clicks the Finalize (checkmark) button
- **finalized -> sent:** user clicks Send to Agent; output is copied to clipboard as structured markdown (HTML truncated to 5000 chars, CSS to 3000)
- **finalized -> pushed:** user clicks Push to Main; `domPushToMain()` applies the HTML/CSS back to the source element in the live page

## AI Variant Redesign

When using the AI chat panel (designMode = "ai"), the user can send the full variant HTML to ChatGPT or OpenAI. The AI response may contain `html-apply` blocks that replace the variant's `modifiedHtml` and/or `modifiedCss`. This allows iterative AI-driven redesign while preserving the original captured state.

## Visual Diff (Before/After Comparison)

`src/zeros/panels/visual-diff.tsx` provides a slider-based comparison overlay:

- Shows two iframes stacked: "Before" (original html/css) and "After" (modified html/css)
- A draggable slider wipes between them using CSS `clip-path: inset(...)` 
- Slider position ranges from 0% to 100%, defaulting to 50%
- Both iframes use the same srcdoc construction (filtered CSS, minimal reset)
- Close with Escape key or the X button
- The overlay is modal (click backdrop to dismiss)

## Node Click Behavior

When the user clicks a node in the canvas:

- **Source node click:** sets activeVariantId to null, scans the source iframe's DOM into the element tree
- **Variant node click:** sets activeVariantId to the variant's ID, scans the variant's iframe DOM into the element tree

This ensures the layers panel and style panel always reflect whichever node is active.

## User Workflow

1. Open the Zeros overlay (Ctrl+Shift+D)
2. The live app loads in the SourceNode iframe on the canvas
3. Click a responsive preset to adjust the viewport (e.g., Tablet 768px)
4. Click "Fork Page" to capture the entire page as a variant
5. Or: enable inspect mode, click a component, then click Fork in the feedback pill to fork just that element
6. The variant appears as a card to the right of the source
7. Use the AI chat panel to redesign the variant (sends HTML to AI, receives modified HTML back)
8. Open Visual Diff to compare before/after side by side with the slider
9. Finalize the variant when satisfied
10. Send to Agent (copies structured markdown) or Push to Main (applies directly to the DOM)

## Pending Features

- **Push variant to production:** currently pushes to the live DOM only; writing changes back to source files via the VS Code extension bridge is planned
- **Variant inheritance:** propagating parent changes to child variants
- **Multi-variant comparison:** comparing multiple variants side by side beyond the two-pane visual diff
- **Variant annotations:** attaching design notes and feedback directly to variant elements
