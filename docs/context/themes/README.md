# Module: Themes & Design Tokens

> **Source files:**
> - `src/0canvas/themes/themes-page.tsx` -- token table editor, file import, multi-theme columns
> - `src/0canvas/themes/theme-mode-panel.tsx` -- color inspection panel, change tracking, prompt generation
> - `src/0canvas/themes/css-token-parser.ts` -- CSS custom property extraction, syntax detection, surgical updates
> - `src/0canvas/themes/theme-color-resolver.ts` -- CSSOM walking, var() chain resolution, shorthand extraction
> - `src/0canvas/themes/color-picker.tsx` -- HSL-based color picker with hex input

---

## Overview

The Themes module provides two complementary workflows:

1. **Themes Page** -- a full-page token table editor where designers load CSS files, view/edit design tokens across themes, add/rename/delete tokens, and sync changes back to the source file.
2. **Theme Mode** -- an inspection mode activated from the toolbar where clicking elements reveals their color properties and lets you swap tokens visually, then generates a structured prompt for the AI agent.

---

## 1. Themes Page (`themes-page.tsx`)

### Architecture

The Themes Page is a full-width view (replaces the canvas when the "Themes" sidebar tab is active). It renders as a spreadsheet-like table with:

- **File tabs** at the top (multiple CSS files can be loaded)
- **Search bar** with selection actions (batch rename, batch delete)
- **Token table** with columns: checkbox, name, one column per theme, add-theme button
- **Detail panel** (slides in from right when a token name is clicked)

### File Selection via File System Access API

```typescript
pickCSSFile()  // window.showOpenFilePicker({ types: [{ accept: { "text/css": [".css"] } }] })
writeToFile(handle, content)  // handle.createWritable() -> write -> close
```

The `FileSystemFileHandle` is stored on the `ThemeFile` object, enabling two-way sync without re-picking the file.

### Token Extraction

When a CSS file is loaded:
1. `parseCSSTokens(content)` extracts all custom properties grouped by theme
2. Theme detection maps CSS selectors to theme IDs:
   - `:root` -> `"default"`
   - `[data-theme="light"]` -> `"light"`
   - `.theme-dark` -> `"dark"`
   - `@media (prefers-color-scheme: light) :root` -> `"light"`
3. Each token gets auto-detected syntax type via `detectSyntax()`
4. Tokens are grouped by prefix (e.g. `--color-primary` -> group `"color"`)

### Two-Way File Sync

**File -> Table (automatic):** A 1-second polling interval reads the file via `handle.getFile()` and re-parses if content changed. This catches external IDE edits. A `isSyncingToFile` ref prevents read-during-write conflicts.

**Table -> File (manual):** The sync button calls `applyTokensToSource()` which surgically replaces only custom property values in the original CSS, preserving all other content (imports, rules, animations, comments, `@layer`, `@theme`, etc.).

### Token CRUD Operations

All operations dispatch to the store reducer:

| Action                | Dispatch Type        | Notes                                          |
|-----------------------|----------------------|------------------------------------------------|
| Add variable          | `ADD_TOKENS`         | Creates with default value per syntax type     |
| Edit value            | `UPDATE_TOKEN_VALUE` | Per-theme, per-token                           |
| Rename (single)       | `RENAME_TOKENS`      | Updates name and re-derives group              |
| Batch rename          | `RENAME_TOKENS`      | Adds prefix/suffix to selected tokens          |
| Delete (single)       | `DELETE_TOKENS`      | From detail panel                              |
| Batch delete          | `DELETE_TOKENS`      | From selection bar                             |
| Update metadata       | `UPDATE_TOKEN_META`  | Description, inherits, syntax                  |
| Paste CSS             | `ADD_TOKENS`         | Parses pasted text via `parsePastedCSS()`      |
| Add theme column      | `ADD_THEME_COLUMN`   | Copies default values to new theme             |

### Variable Detail Panel

Clicking a token name opens a side panel showing:
- **Name** (editable, triggers rename on blur)
- **Syntax** dropdown (angle, color, length-percentage, percentage, number, time, *)
- **Initial value** with color swatch for color tokens
- **Description** (free text)
- **Inherits** checkbox
- **Copy** and **Delete** buttons in footer

### Color Picker Integration

Color tokens show an inline swatch. Clicking the swatch opens the `ColorPicker` component (see section 5 below) positioned below the value cell.

### Paste CSS Variables

A textarea overlay accepts pasted CSS:
```css
--color-primary: #3B82F6;
--spacing-md: 16px;
```

`parsePastedCSS()` handles both full CSS blocks and bare property lists.

---

## 2. Theme Mode Panel (`theme-mode-panel.tsx`)

### Activation

Theme Mode is toggled via the "Theme" button in the workspace toolbar. When active:
- The style panel is hidden
- The Theme Mode Panel replaces it on the right
- The inspector switches to `"theme"` mode (shows color popup instead of feedback pill)

### Panel Sections

**A. Token Palette** -- displays all color tokens from loaded theme files, grouped by prefix, with color swatches and search filtering. If no tokens are loaded, shows a link to the Themes page.

**B. Changes List** -- numbered list of applied color changes with:
- Change number badge
- CSS selector
- Property name
- Before/after color swatches with arrow
- New token name
- Remove button (reverts inline style on the element)

**C. Footer** -- "Copy Prompt" button that generates a structured markdown prompt.

### Change Tracking

Each change is stored as a `ThemeChangeItem` in the store:

```typescript
ThemeChangeItem {
  id: string
  elementId: string
  elementSelector: string
  elementTag: string
  elementClasses: string[]
  property: string                // "color", "background-color", etc.
  originalValue: string           // computed value before change
  originalTokenChain: string[]    // var() resolution chain
  originalSourceSelector: string  // CSS rule that set this
  originalSourceType: "rule" | "inline" | "inherited"
  newToken: string                // e.g. "--green-500"
  newValue: string                // resolved hex/rgb of new token
  timestamp: number
  boundingBox: { x, y, width, height }
}
```

### Prompt Generation

The "Copy Prompt" button generates markdown with:

```markdown
# 0canvas Theme Changes (N items)

Apply these design token changes to the source code.
Use the var() form in stylesheets, not the resolved hex value.

## Changes

### 1. `.demo-card` -- background-color
- **CSS Rule:** `.demo-card`
- **Element:** `div.demo-card`
- **Property:** `background-color`
- **Original:** `var(--color--surface--1)` -> `#1E293B`
- **Replace with:** `var(--green-500)` -> `#22C55E`
- **Tag:** div | **Classes:** demo-card

## Instructions
Find each element by its selector and replace the CSS property value with the new design token.
Use the `var()` form (e.g., `var(--blue-600)`) in the source code, not the resolved hex value.
```

### Clear / Revert

- **Remove single change:** reverts the inline style (`el.style.removeProperty`) and removes from store
- **Clear all:** iterates all changes, removes inline styles, dispatches `CLEAR_THEME_CHANGES`

---

## 3. CSS Token Parser (`css-token-parser.ts`)

### Syntax Detection (`detectSyntax`)

Auto-detects the `TokenSyntax` type from a CSS value string:

| Check Order | Pattern                          | Result              |
|-------------|----------------------------------|---------------------|
| 1           | Hex: `#[0-9a-fA-F]{3,8}`       | `"color"`           |
| 2           | `rgb()/rgba()`                   | `"color"`           |
| 3           | `hsl()/hsla()`                   | `"color"`           |
| 4           | Named CSS colors (148 names)     | `"color"`           |
| 5           | `var()` with color-related name  | `"color"`           |
| 6           | `var()` with size-related name   | `"length-percentage"` |
| 7           | Angle units (deg/rad/grad/turn)  | `"angle"`           |
| 8           | Time units (ms/s)                | `"time"`            |
| 9           | Bare percentage                  | `"percentage"`      |
| 10          | Length units (px/em/rem/vw/etc.) | `"length-percentage"` |
| 11          | `calc()`                         | `"length-percentage"` |
| 12          | Pure number                      | `"number"`          |
| 13          | Contains rgb/hsl function        | `"color"`           |
| 14          | Fallback                         | `"*"`               |

### CSS Block Parsing (`parseCSSBlocks`)

1. Strips CSS comments (`/* ... */`) while preserving line counts
2. Tracks line numbers per character position
3. Parses blocks via brace matching (handles nested `@media`, `@layer`, etc.)
4. Extracts custom properties (`--name: value;`) from each block body
5. Returns `CSSBlock[]` with selector, properties, and line numbers

### Theme Column Mapping (`selectorToThemeId`)

| Selector Pattern                        | Theme ID   |
|-----------------------------------------|------------|
| `[data-theme="light"]`                  | `"light"`  |
| `.theme-dark`                           | `"dark"`   |
| `@media (prefers-color-scheme: light)`  | `"light"`  |
| `.light`                                | `"light"`  |
| `.dark`                                 | `"dark"`   |
| Everything else                         | `"default"` |

### Surgical File Updates

**`applyTokensToSource(originalSource, tokens, themes)`** -- the primary write-back function:
- For each token and theme, builds a regex to match `--name: value;`
- Replaces only the value portion, preserving the rest of the file exactly
- For single-theme files, replaces all occurrences
- For multi-theme files, replaces the Nth occurrence corresponding to the theme index

**`updateTokenInSource(source, tokenName, themeId, newValue)`** -- single-token surgical update (replaces first occurrence only).

---

## 4. Theme Color Resolver (`theme-color-resolver.ts`)

### Purpose

When Theme Mode is active and the user clicks an element, this module resolves exactly which CSS color properties are active on that element, where they came from, and what design tokens (if any) are involved.

### Three-Strategy Hybrid Approach

For maximum reliability across different CSS architectures (Tailwind, @layer, :where(), etc.):

**Strategy 1: CSSOM Walk** -- recursively walks `document.styleSheets[].cssRules`, matches via `el.matches(selectorText)`, tracks specificity. Handles nested `@layer` and `@media` via recursive `walk()`.

**Strategy 2: Class-based Text Search** -- when CSSOM `el.matches()` fails (common with @layer, :where(), Tailwind), searches raw CSS text for rules containing the element's class names. Filters out Tailwind utility classes with brackets.

**Strategy 3: Tag-based Text Search** -- for `body`, `html`, `:root` rules.

### var() Chain Resolution (`resolveVarChain`)

Traces a chain of `var()` references up to 10 levels deep:

```
var(--color--text--primary)
  -> var(--blue-600)
    -> #2563EB
```

Returns: `["--color--text--primary", "--blue-600", "#2563EB"]`

Uses both computed style and raw stylesheet text search to find intermediate `var()` references.

### Color Property Classification

**Inheritable** (always shown, source found via ancestor walking): `color`, `fill`, `stroke`

**Non-inheritable** (only shown if explicitly set by a rule): `background-color`, `border-color`, `border-*-color`, `outline-color`, `text-decoration-color`, `column-rule-color`, `caret-color`, `accent-color`, `box-shadow`, `text-shadow`

Decision logic for non-inheritable props: if computed value equals computed `color`, it is just the `currentColor` default and is skipped. If it differs, a CSS rule must have set it.

### Shorthand Extraction

`extractColorFromShorthand()` handles values like `"1px solid var(--demo-border)"` by extracting just the color part (`var(--demo-border)`). Checks for `var()`, hex, color functions, and named colors within a shorthand value.

### Token Matching

`matchTokenToValue(value, tokens)` normalizes colors to hex and searches all loaded design tokens for a match across all theme values.

### Output Type

```typescript
ColorPropertyInfo {
  property: string
  computedValue: string
  specifiedValue: string
  sourceSelector: string
  sourceType: "rule" | "inline" | "inherited"
  inheritedFrom?: string
  tokenChain: string[]
  isToken: boolean
}
```

Results are sorted with `color` and `background-color` first, then alphabetically.

---

## 5. Color Picker (`color-picker.tsx`)

### Architecture

An HSL-based color picker rendered as a floating panel. Components:

1. **Header** -- token name + close button
2. **Hex input row** -- live swatch + editable hex input
3. **Saturation/Lightness area** -- 2D gradient with draggable thumb (X = saturation 0-100, Y = lightness 100-0)
4. **Hue slider** -- horizontal rainbow bar (0-360)
5. **Alpha slider** -- horizontal transparency bar (0-1)
6. **HSL value inputs** -- numeric inputs for H, S, L, A

### Color Conversion

- `hexToHsl(hex)` -> `[hue, saturation, lightness, alpha]`
- `hslToHex(h, s, l, a?)` -> `"#rrggbb"` or `"#rrggbbaa"`
- `parseColor(value)` -- handles hex, `rgb()/rgba()`, `hsl()/hsla()` input formats

### Drag Interaction

Uses a `useDrag()` hook that:
1. Calculates normalized (0-1) coordinates from click/move position relative to the container's bounding rect
2. Uses `document.addEventListener("mousemove/mouseup")` for smooth dragging outside the element
3. Calls `onChange` with normalized coordinates on every move

### Integration

Changes propagate immediately via `onChange(hexValue)` callback, which the `TokenValueCell` component dispatches to the store as `UPDATE_TOKEN_VALUE`. Click-outside closes the picker via a document-level `mousedown` listener.

---

## 6. Store Types & Actions

### ThemesState

```typescript
ThemesState {
  files:          ThemeFile[]      // loaded CSS files with tokens
  activeFileId:   string | null    // currently viewed file tab
  selectedTokens: Set<string>      // multi-select for batch ops
  searchQuery:    string           // filter input
  editingToken:   string | null    // token name in detail panel
}
```

### ThemeFile

```typescript
ThemeFile {
  id:         string
  name:       string                        // filename, e.g. "variables.css"
  handle:     FileSystemFileHandle | null    // for two-way sync
  content:    string                         // raw CSS content
  tokens:     DesignToken[]
  themes:     ThemeColumn[]
  lastSynced: number
}
```

### DesignToken

```typescript
DesignToken {
  name:        string                     // e.g. "--blue-500"
  values:      Record<string, string>     // themeId -> value
  syntax:      TokenSyntax
  description: string
  inherits:    boolean
  group:       string                     // derived from name prefix
}
```

### Token Group Derivation

`deriveGroup(name)` strips `--` prefix and returns everything before the first `-` or `--`:
- `--blue-500` -> `"blue"`
- `--color--text--muted` -> `"color"`

---

## 7. Pending / Future Work

- **Token suggestions in editors** -- autocomplete design tokens in the style panel value inputs
- **Design system import** -- import tokens from Figma, Tokens Studio, or Style Dictionary formats
- **Theme preview** -- live-switch between themes on the canvas
- **Token usage tracking** -- show which elements use each token
- **Auto-sync to file** -- currently write-back is manual only; could be opt-in automatic
