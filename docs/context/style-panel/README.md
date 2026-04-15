# Style Panel

> `src/0canvas/panels/style-panel.tsx`

The Style Panel is the primary CSS inspection and editing interface in 0canvas. It occupies the right side of the workspace (280px fixed width) and provides a visual, section-based CSS editor for the currently selected DOM element. All edits apply instantly to the live preview via inline styles and, when the bridge is connected, write back to source files through the VS Code extension.

---

## Architecture Overview

```
StylePanel (root)
  |-- BridgeIndicator          (wifi icon, connection status)
  |-- Focus mode toggle        (Focus icon button)
  |-- Copy CSS button          (copies full rule to clipboard)
  |-- Breakpoint badge         (shows active breakpoint when != desktop)
  |-- Element metadata         (tag, class list, prop count)
  |-- Tab bar                  (Editor | Code)
  |-- Search bar               (fuzzy filter across sections)
  |-- TailwindEditor           (if Tailwind classes detected)
  |-- StyleSection * 7         (one per CSS category)
  |     |-- Visual editor      (if editorType is set)
  |     |-- StylePropertyRow * N  (for sections without visual editors)
  |          |-- Checkbox toggle
  |          |-- Color swatch + TokenSuggestions
  |          |-- AutocompleteInput (on edit)
  |-- ColorEditor popover      (opens over panel when swatch clicked)
```

---

## Two Tabs: Editor and Code

The panel was consolidated from three tabs to two:

### Editor Tab
The default view. Shows all CSS properties grouped into collapsible sections with visual editors. Includes the search bar, Tailwind class section, and all 7 CSS property sections.

### Code Tab
A syntax-highlighted read-only code view showing the selected element's styles as a CSS rule block:
```css
.my-selector {
  display: flex;
  padding: 16px;
  color: #333;
}
```
Properties are rendered with distinct CSS classes for syntax coloring: `.oc-style-syntax-selector`, `.oc-style-syntax-property`, `.oc-style-syntax-value`, `.oc-style-syntax-comment`.

---

## The 7 CSS Property Sections

Each section is defined in the `STYLE_CATEGORIES` array. Sections only render if the selected element has at least one active property from that section's property list.

| # | Section      | Icon          | Properties                                                                 | Editor Type    |
|---|-------------|---------------|---------------------------------------------------------------------------|----------------|
| 1 | **Size**     | `Ruler`       | width, height, maxWidth, maxHeight, minWidth, minHeight                   | _(none -- raw rows)_ |
| 2 | **Layout**   | `Grid3x3`    | display, position, flexDirection, alignItems, justifyContent, flexWrap, gap, gridTemplateColumns, gridTemplateRows, overflow, float, clear, zIndex, top, right, bottom, left | `layout`       |
| 3 | **Spacing**  | `Box`         | padding (T/R/B/L), margin (T/R/B/L)                                      | `spacing`      |
| 4 | **Typography** | `Type`      | fontSize, fontWeight, lineHeight, textAlign, color, letterSpacing, fontFamily, textDecoration, textTransform, whiteSpace, verticalAlign, listStyleType | `typography`   |
| 5 | **Background** | `Palette`   | background, backgroundColor, backgroundImage, backgroundSize, backgroundPosition, backgroundRepeat | _(none -- raw rows)_ |
| 6 | **Borders**  | `Square`      | border, borderTop/Bottom/Left/Right, borderRadius, borderColor, borderWidth, borderStyle, boxShadow, outline | `border`       |
| 7 | **Effects**  | `Sparkles`    | opacity, mixBlendMode, cursor, pointerEvents, transform, transformOrigin, transition, animation, filter, backdropFilter | `effects`      |

### How Sections Render

When a section has an `editorType`, it renders the corresponding visual editor component (LayoutEditor, SpacingEditor, etc.) instead of raw property rows. The visual editors provide richer interaction than text fields.

Sections **without** an editorType (Size, Background) render individual `StylePropertyRow` components for each active property.

The Effects section is a special case: it has `editorType: "effects"` which renders an inline `EffectsEditor` component defined within the style-panel file itself (not a separate editor file). This editor provides an opacity slider (0-100%) and a blend mode dropdown (16 modes).

---

## Property Search Bar

A text input with a `Search` icon at the top of the Editor tab. As the user types, `filteredCategories` is computed by filtering each section's property list against the search query (case-insensitive substring match on the kebab-case property name). Sections with zero matching properties are hidden entirely.

---

## Focus Mode

A toggle button with a `Focus` icon in the panel header. Persisted to `localStorage` key `"oc-style-focus-mode"`.

- **Focus mode ON** (default): Only one section can be expanded at a time. Clicking a section header collapses whatever was previously open and expands the clicked section. This is an accordion pattern.
- **Focus mode OFF**: Multiple sections can be expanded simultaneously. Each section toggles independently.

State management:
- `focusMode: boolean` -- the mode toggle
- `expandedSection: string | null` -- tracks the single open section in focus mode
- `expandedSections: Set<string>` -- tracks all open sections in free mode

When switching between modes, the panel intelligently preserves context: switching to focus mode keeps the first expanded section; switching to free mode carries the focused section into the set.

---

## Property Toggle Checkboxes (Disable/Enable)

Each `StylePropertyRow` has a checkbox on the left side that appears on hover. The checkbox allows temporarily disabling a CSS property without deleting it.

### Behavior
- **Unchecking** (disable): Stores the original value in `disabledProps` Map, removes the inline style from the DOM via `applyStyle(id, prop, "")`, and adds the `.is-disabled` class which applies a strikethrough style.
- **Re-checking** (enable): Restores the original value from the Map, re-applies it to the DOM, and sends the change through the bridge if connected.
- **Selection change**: The `disabledProps` Map is cleared whenever the selected element changes, so disabled states are per-session and per-element.

---

## Token Suggestions Dropdown

The `TokenSuggestions` component renders a small `Palette` icon button next to color property swatches. When clicked, it opens a dropdown showing up to 6 color tokens from the project's theme files.

### Data Flow
1. Reads `state.themes.files` from the workspace store
2. Filters tokens where `token.syntax === "color"`
3. Each token is rendered with a color swatch (resolved from `token.values["default"]`) and the token name (stripped of `--` prefix)
4. Selecting a token inserts `var(--token-name)` as the property value
5. Closes on outside click via `mousedown` listener

This bridges the gap between raw CSS editing and design-system-aware token usage.

---

## CSS Value Autocomplete

The `AutocompleteInput` component replaces the standard text input when editing a property value. It queries `getAutocompleteSuggestions()` from `lib/css-properties.ts` for valid keyword values.

### Interaction
- Suggestions appear as a dropdown below the input
- Arrow keys navigate the list, Enter/Tab selects
- Prefix matches are prioritized over substring matches
- Max 6 suggestions shown
- `onBlur` commits after a 150ms delay (to allow click on suggestion)
- Escape cancels editing and restores the original value

---

## Breakpoint Badge

When `state.activeBreakpoint` is not `"desktop"`, a badge appears in the header metadata row showing the breakpoint name and its pixel width (from `BREAKPOINT_WIDTHS`). This provides constant visual feedback about which responsive context is being edited.

---

## Bridge Status Indicator

The `BridgeIndicator` component renders in the panel header. It shows three states:

| State | Icon | CSS Class | Meaning |
|-------|------|-----------|---------|
| Fully connected | `Wifi` | `.oc-icon-connected` | Bridge + extension connected; edits write to source |
| Partial | `Wifi` | `.oc-icon-partial` | Bridge up but extension reconnecting |
| Disconnected | `WifiOff` | `.oc-icon-disconnected` | No bridge; edits are local only |

The indicator is a small icon with a descriptive tooltip explaining the current state.

---

## Cascade / Source Indicator

The panel shows class badges for the selected element's CSS classes (up to 5, with an overflow counter like "+3"). These serve as cascade/source indicators -- when Tailwind is detected, classes like `tw:p-4` or utility names appear as badges, telling the user where styles originate.

---

## Tailwind Class Section

When `detectTailwindClasses(selectedElement.classes).isTailwind` returns true, a "Tailwind Classes" section appears above the CSS property sections. It renders the `TailwindEditor` component which shows detected utility classes as color-coded chips grouped by category, with add/remove functionality. See `editors.md` for full details.

---

## StylePropertyRow Component

The individual property row is the most granular editing unit. It handles:

1. **Display**: Shows kebab-case property name and value
2. **Color detection**: Checks if the property is in `COLOR_PROPERTIES` set or if the value matches a color pattern (`#hex`, `rgb()`, `hsl()`)
3. **Color swatch**: For color properties, renders a clickable swatch that opens the ColorEditor popover, plus the TokenSuggestions dropdown
4. **Inline editing**: Click the value to enter edit mode, which renders an `AutocompleteInput`
5. **Save flow**: On commit, dispatches `UPDATE_STYLE` to the store, calls `applyStyle()` for instant DOM feedback, calls `flashElement()` for visual confirmation, and sends through the bridge if connected
6. **Disable toggle**: Checkbox controlled by parent's `disabledProps` state

### Style Application Pipeline
Every property change follows this pipeline:
```
User edit -> dispatch(UPDATE_STYLE) -> applyStyle(elementId, kebabProp, value)
                                    -> flashElement(elementId)
                                    -> sendStyleChange(selector, kebabProp, value, oldValue)
```

---

## 280px Panel Width Constraint

The style panel is designed to fit within a 280px fixed-width sidebar. This constraint drives several design decisions:
- Segmented controls use abbreviated labels ("Vis", "Hide", "Dash", "Dot")
- Number inputs are compact with small unit dropdowns
- The spacing editor uses a nested box-model diagram
- Token suggestions show max 6 items
- Class badges truncate after 5 with overflow counter
- The 9-dot alignment grid is a minimal 3x3 layout

---

## Empty States

Two distinct empty states depending on context:

1. **No elements loaded** (no project connected): Shows `Globe` icon + "Connect a project to inspect styles"
2. **No element selected** (project loaded but nothing selected): Shows `MousePointer2` icon + "Select an element to inspect its styles"
3. **Element selected but no styles**: Shows inline text "No styles detected yet." + hint to click in preview

---

## Key Dependencies

| Import | Purpose |
|--------|---------|
| `useWorkspace`, `findElement`, `BREAKPOINT_WIDTHS`, `DesignToken` | Store access and element lookup |
| `copyToClipboard` | Copy CSS to clipboard |
| `ScrollArea` | Custom scrollable container (shadcn/radix-based) |
| `ColorEditor`, `SpacingEditor`, `TypographyEditor`, `LayoutEditor`, `BorderEditor`, `TailwindEditor` | Visual section editors |
| `detectTailwindClasses` | Tailwind detection for conditional rendering |
| `SliderInput` | Used by inline EffectsEditor for opacity |
| `useBridgeStatus`, `useExtensionConnected`, `useStyleChange` | Bridge integration hooks |
| `applyStyle`, `flashElement` | Direct DOM manipulation for instant feedback |
| `getAutocompleteSuggestions` | CSS value autocomplete data |

---

## Pending Improvements

- **Cascade visualization**: Currently shows class badges but does not show which rule/stylesheet a property comes from (e.g., "computed" vs "tw:p-4" indicators are just class badges, not true cascade tracing)
- **Property addition**: No UI to add new CSS properties that don't already exist on the element
- **Undo/redo**: No undo stack for style changes; disabled-property toggle is the closest workaround
- **Responsive editing**: Breakpoint badge shows context but there's no breakpoint-specific style override storage
- **Animation/transition previews**: Effects section shows properties as text but doesn't preview animations
- **Filter/backdrop-filter editors**: No visual editors for these complex properties
- **Grid editor**: Layout section has grid-template properties listed but no visual grid editor (only flex gets the visual treatment)
