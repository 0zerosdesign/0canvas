# Visual Editors

> `src/zeros/editors/`

The visual editors are specialized React components that replace raw property rows for certain CSS sections. Each editor provides a domain-specific UI that is more intuitive than editing raw CSS values. All editors follow the same integration pattern: they receive `elementId`, `selector`, and `styles`, and apply changes through the local store + DOM + bridge pipeline.

---

## Shared Controls (`controls.tsx`)

Three reusable primitives used across multiple editors.

### SegmentedControl

A horizontal button group where exactly one option is active at a time. Used for enumerated CSS values like `display`, `flex-direction`, `border-style`, and `overflow`.

```
Props:
  options: { value, label?, icon?, title? }[]
  value: string
  onChange: (value) => void
  size: "sm" | "md"  (default "sm")
```

Each button renders either an icon or label. The active button gets the `.is-active` class. All buttons are wrapped in `.oc-segmented` with a size modifier class.

### NumberInputWithUnit

The workhorse numeric input. Supports five interaction modes for adjusting values:

| Mode | Behavior | Modifier |
|------|----------|----------|
| **Direct edit** | Click value to type a number | -- |
| **Arrow keys** | Up/Down while focused | Shift = 10x, Alt = 0.1x |
| **Scroll wheel** | Scroll over the value display | Step-based |
| **Label drag** | Click+drag the label text horizontally | Shift = 10x, Alt = 0.1x; 1 unit per 2px |
| **Arrow keys on display** | Up/Down when display span has focus | Shift = 10x, Alt = 0.1x |

```
Props:
  label?: string
  value: string           (e.g. "16px", "1.5rem")
  onChange: (value) => void
  units: string[]         (default ["px","rem","em","%","vw","vh"])
  min?, max?, step?
  placeholder: string     (default "--")
```

**Value parsing**: Splits the incoming string into numeric part and unit via regex `/^(-?[\d.]+)\s*([\w%]+)?$/`. If a bare number is typed, the current unit is auto-appended on commit.

**Unit dropdown**: When `units.length > 1`, renders a `<select>` for switching units. When only one unit exists, renders a static label.

**Label drag scrubbing**: When the user mousedowns on the label, the cursor changes to `ew-resize`, and horizontal movement adjusts the value. Sensitivity is 0.5 units per pixel. Body `user-select` is disabled during drag.

**Clamping**: All computed values pass through `clampAndRound()` which rounds to 2 decimal places and enforces min/max bounds.

### SliderInput

A range slider with a numeric display and label drag support.

```
Props:
  label?: string
  value: number
  onChange: (value) => void
  min, max, step
  suffix?: string
```

The track background uses a CSS linear gradient to show filled vs unfilled portions using `var(--color--base--primary)` for the filled portion. Supports the same label-drag scrubbing as NumberInputWithUnit, with sensitivity scaled relative to the range (full range over ~200px of drag).

---

## Color Editor (`color-editor.tsx`)

A popover component that wraps the project's `ColorPicker` (from `themes/color-picker.tsx`) and wires it to the bridge for source file writes.

### Features
- **Instant local feedback**: Every color change immediately updates the store and applies inline style to the DOM
- **Debounced bridge send**: Changes are sent to the VS Code extension after a 300ms pause (prevents flooding during continuous color picking)
- **Write status indicator**: Shows four states in the header:
  - `idle` -- no indicator
  - `writing` -- "saving..." badge
  - `success` -- green checkmark (auto-clears after 2s)
  - `error` -- red AlertCircle icon with error tooltip
- **Bridge status icon**: Wifi/WifiOff in the header showing connection state
- **Close button**: X button to dismiss the popover

### Lifecycle
1. Opens when user clicks a color swatch in `StylePropertyRow`
2. Renders absolutely positioned over the style panel
3. Each drag/click in the picker triggers `handleChange`
4. `handleChange` -> instant local apply -> debounced bridge send
5. Closes on X click or `onClose` callback

---

## Spacing Editor (`spacing-editor.tsx`)

An interactive box-model diagram for editing margin and padding on all four sides.

### Visual Layout

```
+------------------------------------------+
|  margin                                   |
|     [margin-top value]                    |
|  [ml] +------------------------+ [mr]    |
|       |  padding               |          |
|       |    [padding-top]       |          |
|       | [pl] [content] [pr]   |          |
|       |    [padding-bottom]    |          |
|       +------------------------+          |
|     [margin-bottom value]                 |
+------------------------------------------+
```

### Interaction Model

- **Click anywhere in a segment area** to start inline editing (enlarged click targets for Fitts's Law compliance)
- **Hover** shows a tinted background on the segment being targeted
- **Inline input**: When editing, a small text input appears in place of the value. Commits on Enter/blur, cancels on Escape.
- **Auto unit**: If a bare number is typed, "px" is appended automatically

### Linked / Unlinked Toggle

Two toggle buttons at the top: one for margin, one for padding.

| State | Icon | Behavior |
|-------|------|----------|
| **Linked** | `Link` | Editing any side applies the value to all four sides |
| **Unlinked** | `Unlink` | Each side is edited independently |

Both default to linked. The toggle buttons show `.is-active` when linked.

### Value Display
- `parseValue()` strips "px" for display, keeps other units
- The center content area shows `{width} x {height}` or "auto x auto"
- Each cell has a CSS property tooltip (e.g. "margin-left", "padding-top")

### Bridge Integration
On commit, iterates through affected sides (all four if linked, single if unlinked), dispatching `UPDATE_STYLE` and `applyStyle` for each, then sending through the bridge.

---

## Typography Editor (`typography-editor.tsx`)

Controls for font and text properties, arranged in a compact vertical layout.

### Controls

| Row | Control | Type | Values |
|-----|---------|------|--------|
| 1 | **Font Family** | Dropdown | 15 common fonts: inherit, system-ui, Inter, Roboto, Open Sans, Lato, Poppins, Montserrat, Source Sans 3, Nunito, Raleway, DM Sans, monospace, serif, sans-serif |
| 2 | **Font Size** | NumberInput | Numeric + unit |
| 2 | **Font Weight** | Dropdown | 100-900 with labels (Thin, Extra Light, Light, Regular, Medium, Semi Bold, Bold, Extra Bold, Black) |
| 3 | **Line Height** | NumberInput | Numeric or "normal" |
| 3 | **Letter Spacing** | NumberInput | Numeric or "normal" |
| 4 | **Text Align** | Button group | 4 buttons with Lucide icons: AlignLeft, AlignCenter, AlignRight, AlignJustify |
| 5 | **Color** | Swatch + value | Conditional -- only shown if `styles.color` exists |

### NumberInput (local component)

The editor defines its own simplified `NumberInput` component (not the shared `NumberInputWithUnit`). It parses values into number + unit, supports direct typing with Enter/Escape, and auto-appends the unit for bare numbers.

### Text Align Buttons

The align buttons use the `is-active` class pattern. Each button has a tooltip like `text-align: center`. The current alignment is read from `styles.textAlign` with a fallback to `"left"`.

---

## Layout Editor (`layout-editor.tsx`)

Flex and grid display controls with the signature 9-dot alignment grid.

### Display Segmented Control

Five options: Flex, Block, Inline, Grid, None. Uses the shared `SegmentedControl`.

### Flex-Specific Controls (shown only when display is flex or inline-flex)

#### Direction + Wrap Row
- **Direction**: 4-option segmented control with arrow icons:
  - `ArrowRight` = row
  - `ArrowDown` = column
  - `ArrowLeft` = row-reverse
  - `ArrowUp` = column-reverse
- **Wrap toggle**: Small button with `WrapText` icon. Toggles between `wrap` and `nowrap`. Uses `.is-active` when wrap is on.

#### 9-Dot Alignment Grid

A 3x3 grid of clickable dots that simultaneously sets `justify-content` and `align-items`.

```
Grid layout:

  [flex-start, flex-start]  [center, flex-start]  [flex-end, flex-start]
  [flex-start, center]      [center, center]      [flex-end, center]
  [flex-start, flex-end]    [center, flex-end]     [flex-end, flex-end]

  Columns = justify-content
  Rows = align-items
```

The active dot (matching current justify + align values) gets `.is-active` styling. Each dot has a tooltip showing both property values.

Implementation maps:
- `JUSTIFY_MAP = ["flex-start", "center", "flex-end"]` (columns)
- `ALIGN_MAP = ["flex-start", "center", "flex-end"]` (rows)

#### Gap Input
Uses `NumberInputWithUnit` with units `["px", "rem"]` and `min={0}`.

### Conditional Controls

- **Overflow**: Only shown if `styles.overflow` exists. Segmented: Vis, Hide, Scroll, Auto.
- **Z-index**: Only shown if `styles.zIndex` exists. NumberInputWithUnit with no unit (empty string).

---

## Border Editor (`border-editor.tsx`)

Controls for borders, radius, and box shadow.

### Border Width / Style / Color

All three are conditional -- they only render if `styles.borderWidth`, `styles.borderStyle`, or `styles.border` exist.

- **Width**: `NumberInputWithUnit` with `["px"]` unit, min 0
- **Style**: `SegmentedControl` with Solid, Dash, Dot, None
- **Color**: Clickable swatch that opens the `ColorEditor` popover (via `onOpenColorEditor` callback), plus the raw value displayed as text

### Border Radius Diagram

A visual 4-corner layout:

```
  [TL]  ----  [TR]
  |              |
  |   preview    |
  |   (shows     |
  |   radiusVal) |
  |              |
  [BL]  ----  [BR]
```

- **Link/Unlink toggle**: `Link`/`Unlink` icon button. When linked, editing any corner applies to all four. When unlinked, each corner (`borderTopLeftRadius`, etc.) is independent.
- **Preview box**: A small rectangle in the center with `borderRadius` applied inline, showing the actual effect. Displays the radius value as text.
- **RadiusInput**: Each corner has a clickable value that becomes an inline input on click. Commits on Enter/blur, cancels on Escape.

### Box Shadow Editor

Only renders when `styles.boxShadow` exists, is not "none", and successfully parses.

**Shadow parsing**: Regex extracts X offset, Y offset, blur radius, spread radius, and color from the shadow string.

Controls:
- **X, Y, Blur, Spread**: Four `NumberInputWithUnit` inputs in a 2x2 grid, all with `["px"]` unit
- **Color**: Swatch + raw value display (currently read-only for shadow color)

Each field change reconstructs the full shadow string: `"Xpx Ypx Blurpx Spreadpx color"` and applies it as the `boxShadow` property.

---

## Tailwind Editor (`tailwind-editor.tsx`)

Manages Tailwind utility classes on the selected element.

### Class Detection and Grouping

Uses `detectTailwindClasses()` to split the element's classes into `tailwind` and `other` arrays. Tailwind classes are then grouped by category using `classifyTailwindClass()`:

| Category | Label | Color | Example Classes |
|----------|-------|-------|-----------------|
| layout | Layout | `#3b82f6` (blue) | flex, relative, items-center |
| spacing | Spacing | `#22c55e` (green) | p-4, mx-auto, gap-2 |
| sizing | Sizing | `#a855f7` (purple) | w-full, h-screen |
| typography | Type | `#f59e0b` (amber) | text-lg, font-bold |
| color | Color | `#ef4444` (red) | text-white, bg-gray-100 |
| border | Border | `#06b6d4` (cyan) | rounded-lg, border |
| effects | Effects | `#8b5cf6` (violet) | shadow-md, opacity-50 |
| other | Other | `#6b7280` (gray) | _(unclassified)_ |

### Chip Display

Each Tailwind class renders as a "chip" with:
- Colored border (40% opacity of the category color)
- Class name text
- X button to remove (calls `removeClass`)

Non-Tailwind ("Custom") classes render in a separate group with gray chips and no remove button.

### Adding Classes

1. Click the "+ Add class" button at the bottom
2. A search input appears with a `Search` icon
3. Type to filter from `COMMON_TAILWIND_CLASSES` (160+ common utility classes)
4. Up to 8 suggestions appear, each showing:
   - Colored dot matching the category
   - Class name
   - Mapped CSS property (e.g. "padding", "font-size")
5. Enter selects the first suggestion; click selects any
6. Escape cancels

### Bridge Communication

Class changes send a `TAILWIND_CLASS_CHANGE` message through the bridge:
```json
{
  "type": "TAILWIND_CLASS_CHANGE",
  "source": "browser",
  "selector": ".my-element",
  "action": "add" | "remove",
  "className": "p-4"
}
```

The DOM is also updated directly: `el.classList.add(cls)` / `el.classList.remove(cls)`.

---

## Effects Editor (inline in `style-panel.tsx`)

Not a separate file -- defined directly in the style panel as `EffectsEditor`.

### Controls

- **Opacity**: `SliderInput` from 0-100%, step 1. Internally converts between 0-1 (CSS) and 0-100 (display) scales. Handles NaN and clamps to valid range.
- **Mix Blend Mode**: `<select>` dropdown with 16 blend modes: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity.

Other effects properties (cursor, transform, transition, animation, filter, backdropFilter) are listed in the section's property array but currently only get raw `StylePropertyRow` treatment when the section doesn't have exclusive visual editor rendering -- however since `editorType: "effects"` is set, only the EffectsEditor renders, meaning these other properties are not individually editable through this section. They would need to be added to the EffectsEditor component or the rendering logic adjusted.

---

## Common Patterns Across All Editors

### Style Application Pipeline
Every editor follows the same three-step pattern:
1. `dispatch({ type: "UPDATE_STYLE", elementId, property, value })` -- update the local store
2. `applyStyle(elementId, kebabProp, value)` -- apply inline style to the DOM for instant preview
3. `sendStyleChange(selector, kebabProp, value)` -- send through bridge to VS Code extension (conditional on `bridgeStatus === "connected"`)

### Bridge Hooks
All editors import from `../bridge/use-bridge`:
- `useStyleChange()` -- returns the `sendStyleChange` function
- `useBridgeStatus()` -- returns `"connected"` | `"disconnected"` | etc.

### CamelCase to kebab-case
All editors use the inline conversion `.replace(/([A-Z])/g, "-$1").toLowerCase()` when sending to the bridge or applying to the DOM, since the store uses camelCase keys but CSS/bridge use kebab-case.

---

## Pending Improvements

- **Typography**: No font preview in dropdown (shows name only, not styled preview)
- **Layout**: Grid properties are listed in the section but the LayoutEditor only handles flex; no visual grid editor exists
- **Border**: Shadow color is display-only -- cannot open color picker for it
- **Effects**: Only opacity and blend mode have visual controls; transform, filter, transition, and animation are not editable through the effects visual editor
- **Spacing**: No visual indication of negative margins
- **Controls**: NumberInputWithUnit scroll handling does not call `preventDefault()` on the container, which could cause page scroll conflicts
- **Tailwind**: Remove triggers a store re-render via a dummy `SET_ELEMENT_STYLES` dispatch with empty styles rather than a proper class update action
