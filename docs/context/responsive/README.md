# Responsive Editing

> **Doc label (PR 4):** Partial — engine and Col 3 behavior described here is largely still accurate. Mentions of the **VS Code extension**, **Tauri**, or **live ACP runtime** in the prose below are **historical** unless stated otherwise. Current stack: **Electron** + local engine — see [`03-Mac-App-Architecture.md`](../../Zeros-Structure/03-Mac-App-Architecture.md). Full index: [`12-Doc-Index-And-Labels.md`](../../Zeros-Structure/12-Doc-Index-And-Labels.md).

## Overview

Zeros includes a breakpoint system for previewing and eventually editing designs at different viewport widths. The system connects the workspace toolbar, the global store state, and the canvas source node to provide responsive preview switching.

Key files:
- `src/zeros/store/store.tsx` -- `Breakpoint` type, `BREAKPOINT_WIDTHS`, `SET_BREAKPOINT` action
- `src/zeros/panels/workspace-toolbar.tsx` -- breakpoint toggle buttons
- `src/zeros/canvas/source-node.tsx` -- viewport preset buttons and resize behavior
- `src/zeros/panels/style-panel.tsx` -- breakpoint badge display

## Breakpoint System

Four named breakpoints are defined:

| Breakpoint | Width  | Icon        | Constant Key |
|------------|--------|-------------|--------------|
| Desktop    | 1440px | Monitor     | `desktop`    |
| Laptop     | 1280px | Laptop      | `laptop`     |
| Tablet     | 768px  | Tablet      | `tablet`     |
| Mobile     | 375px  | Smartphone  | `mobile`     |

These are defined in the store as:

```typescript
export type Breakpoint = "desktop" | "laptop" | "tablet" | "mobile";

export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  desktop: 1440,
  laptop: 1280,
  tablet: 768,
  mobile: 375,
};
```

## Store State

The active breakpoint is tracked globally in `WorkspaceState`:

```typescript
activeBreakpoint: Breakpoint;  // default: "desktop"
```

It is changed via the `SET_BREAKPOINT` action:

```typescript
case "SET_BREAKPOINT":
  return { ...state, activeBreakpoint: action.breakpoint };
```

## Toolbar Buttons

The workspace toolbar (`workspace-toolbar.tsx`) renders four icon-only buttons in a compact pill group (`is-pill-sm` class):

```tsx
<div className="oc-toolbar-group is-pill-sm">
  <ToolbarBtn icon={<Monitor size={13} />} label=""
    active={state.activeBreakpoint === "desktop"}
    onClick={() => dispatch({ type: "SET_BREAKPOINT", breakpoint: "desktop" })} />
  <ToolbarBtn icon={<Laptop size={13} />} label=""
    active={state.activeBreakpoint === "laptop"}
    onClick={() => dispatch({ type: "SET_BREAKPOINT", breakpoint: "laptop" })} />
  <ToolbarBtn icon={<Tablet size={13} />} label=""
    active={state.activeBreakpoint === "tablet"}
    onClick={() => dispatch({ type: "SET_BREAKPOINT", breakpoint: "tablet" })} />
  <ToolbarBtn icon={<Smartphone size={13} />} label=""
    active={state.activeBreakpoint === "mobile"}
    onClick={() => dispatch({ type: "SET_BREAKPOINT", breakpoint: "mobile" })} />
</div>
```

The active button receives the `is-active` CSS class for visual highlighting.

## Canvas Behavior

### Source Node Responds to Global Breakpoint

In `source-node.tsx`, a `useEffect` watches `state.activeBreakpoint` and resizes the source node iframe accordingly:

```typescript
useEffect(() => {
  const bp = state.activeBreakpoint;
  const presetMap: Record<string, number> = {
    desktop: 1440,
    laptop: 1280,
    tablet: 768,
    mobile: 375,
  };
  const targetWidth = presetMap[bp] || DEFAULT_WIDTH;
  if (Math.abs(dims.w - targetWidth) > 20) {
    applyDims(targetWidth, dims.h);
  }
}, [state.activeBreakpoint]);
```

This means clicking a toolbar breakpoint button resizes the SourceNode's iframe width to match that breakpoint. The height is preserved. The `applyDims` function also updates the ReactFlow node dimensions and determines which preset label to highlight.

### Source Node Viewport Presets

The source node also has its own set of preset buttons positioned vertically along the right edge. These provide the same breakpoints as the toolbar but are local to the source node. Clicking them calls `applyPreset()` which:

1. Sets the iframe width to the preset's pixel value
2. Updates the ReactFlow node dimensions
3. Highlights the matching preset label

The two systems stay in sync: the toolbar buttons dispatch `SET_BREAKPOINT` globally, and the source node reacts to the global state. The source node's own preset buttons call `applyDims()` directly and also update the `activePreset` display label.

### Variant Node Presets

Variant nodes have their own breakpoint presets (slightly different widths since variants are typically narrower):

| Preset  | Width | Icon       |
|---------|-------|------------|
| Wide    | 768px | Laptop     |
| Tablet  | 560px | Tablet     |
| Mobile  | 375px | Smartphone |

These are local to each variant card and do not affect the global breakpoint state. They resize only that variant's iframe.

## Style Panel Breakpoint Badge

When the active breakpoint is anything other than "desktop", the style panel (`style-panel.tsx`) shows a yellow breakpoint badge in the header metadata area:

```tsx
{state.activeBreakpoint !== "desktop" && (
  <span className="oc-breakpoint-badge">
    {state.activeBreakpoint} {BREAKPOINT_WIDTHS[state.activeBreakpoint]}px
  </span>
)}
```

This gives the user a persistent visual indicator of which breakpoint context they are inspecting. For example, when viewing at tablet width, the badge reads "tablet 768px".

## Data Flow

```
User clicks Tablet in toolbar
  -> dispatch({ type: "SET_BREAKPOINT", breakpoint: "tablet" })
  -> store.activeBreakpoint = "tablet"
  -> SourceNode effect fires: applyDims(768, currentHeight)
  -> ReactFlow node resizes to 768px wide
  -> iframe renders at 768px viewport
  -> Style panel shows "tablet 768px" badge
  -> User inspects element -> sees styles as rendered at 768px
```

## User Workflow

1. Open the Zeros workspace
2. The source node defaults to Laptop width (1280px)
3. Click the Tablet icon in the toolbar
4. The canvas source node smoothly resizes to 768px width
5. The app inside the iframe re-renders at tablet dimensions
6. Click an element to inspect it
7. The style panel shows a "tablet 768px" badge, confirming the breakpoint context
8. Computed styles reflect the tablet viewport (media queries apply inside the iframe)
9. Switch back to Desktop to return to 1440px

## Pending Features

- **Per-breakpoint style editing:** edit styles at a specific breakpoint and have those changes only apply at that breakpoint (generating `@media` queries)
- **@media query detection:** parsing the app's existing media queries to show which styles change at which breakpoints
- **Responsive style storage in .0c format:** saving breakpoint-specific style overrides in the project file
- **Breakpoint markers on canvas:** visual indicators showing where breakpoint boundaries fall
- **Auto-detect breakpoints:** scanning the app's CSS to discover custom breakpoint values rather than using fixed presets
