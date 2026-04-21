# 0canvas Development Rules

> These rules MUST be followed by every contributor — human **and** AI — working on this project. They exist to keep the UI consistent, top-class, and Cursor-like. Breaking them is treated as a failing review.

Target visual language: **Cursor 3 "Glass" / Agents Window** — minimal, small, dense, subtle, classy. Flat chrome, three surface tones, one blue accent used sparingly.

---

## Rule 1: File Organization

Every file MUST be placed in the correct folder:

| Content | Location |
|---------|----------|
| 0canvas core engine | `/src/0canvas/engine/` |
| DOM inspector | `/src/0canvas/inspector/` |
| Canvas components | `/src/0canvas/canvas/` |
| Panel components | `/src/0canvas/panels/` |
| Editors (style panel) | `/src/0canvas/editors/` |
| Themes system | `/src/0canvas/themes/` |
| .0c file format | `/src/0canvas/format/` |
| State management | `/src/0canvas/store/` |
| Database/IndexedDB | `/src/0canvas/db/` |
| Utilities & libs | `/src/0canvas/lib/`, `/src/0canvas/utils/` |
| **UI primitives (atoms + molecules + organisms)** | `/src/0canvas/ui/` |
| ACP bridge | `/src/0canvas/acp/` |
| MCP server | `/src/mcp/` |
| **Design tokens (ONE file)** | `/src/styles/design-tokens.css` |
| App shell (Tauri window chrome) | `/src/shell/` |
| Tauri native bridge | `/src/native/` |
| Demo pages | `/src/demo/` |
| Documentation | `/docs/` |
| Skills | `/skills/` |
| Scripts | `/scripts/` |

NEVER put component code inside page files (import them).
NEVER put styling logic inside utility files.
NEVER put a new primitive outside `/src/0canvas/ui/`.

---

## Rule 2: Every Component MUST Have This Structure

```tsx
// ============================================
// COMPONENT: ComponentName
// PURPOSE: What this component does
// USED IN: Which pages/components use this
// ============================================

// --- IMPORTS ---
// --- TYPES ---          (each prop commented)
// --- STATE ---          (each useState commented)
// --- WORKFLOWS ---      (each function commented)
// --- EVENT HANDLERS --- (each handler commented)
// --- RENDER ---         (only primitives + layout classes)
```

---

## Rule 3: Every Page MUST Have This Structure

```tsx
// ============================================
// PAGE: PageName
// ROUTE: /route-path
// PURPOSE: What this page does
// ============================================

// --- IMPORTS ---
// --- TYPES ---
// --- STATE ---
// --- WORKFLOWS ---
// --- EVENT HANDLERS ---
// --- RENDER ---
```

---

## Rule 4: Design Tokens (ONE source of truth)

### 4.1 — One file

There is exactly ONE design-token file: **`/src/styles/design-tokens.css`**. No other CSS file defines tokens. Never create `tokens/foo.css` or split the tokens across files.

### 4.2 — Semantic tokens only in components

Components MUST reference **semantic** tokens (`--surface-0`, `--text-on-surface`, `--primary`, `--radius-sm`, `--space-4`, `--text-12`, `--dur-fast`, `--z-dropdown`, etc.). Components MUST NEVER reference **primitive** tokens (`--grey-900`, `--blue-500`) directly.

### 4.3 — Banned values in component code

| Banned | Use instead |
|---|---|
| Hex colors (`#171717`, `#10B981`, …) outside `design-tokens.css` | Semantic token |
| Raw rgba literals, EXCEPT the documented `--tint-*` tokens | Documented tint token |
| `font-size: 9|14|16px` (and any value not in the type scale) | `var(--text-10|11|12|13|15|18)` |
| `border-radius: 2|3|5|7|10|14|16|20px` | `var(--radius-xs|sm|md|lg|pill)` |
| Odd margin / gap values (3, 5, 7, 9, 11, 13, 15) | Closest even `var(--space-N)` |
| Arbitrary numeric `z-index` | `var(--z-chrome|panel|dropdown|modal|toast)` |
| Tailwind color classes (`bg-blue-500`, `text-red-600`, `border-gray-700`, …) | Semantic token via CSS or primitive component |
| `font-family: "Inter"` or any web font | `var(--font-ui)` (system stack) or `var(--font-mono)` |

### 4.4 — Adding a token

If no semantic token fits, STOP. Do not invent. Either:
1. Find the nearest existing semantic token, or
2. Open a PR that adds a new semantic token to `design-tokens.css` **and** updates the matching section of this file and `skills/ui-consistency.md`.

---

## Rule 11: Primitive-first (the shadcn rule)

Every visual element uses a component from `/src/0canvas/ui/`. Per-feature classes that duplicate primitive behavior are forbidden in new code.

| Need | Primitive |
|---|---|
| Button | `<Button variant="…" size="…">` |
| Icon-only button | `<Button variant="ghost" size="icon">` |
| Text input / password / number | `<Input type="…">` |
| Multi-line input | `<Textarea>` |
| Label above a form control | `<Label>` |
| Dropdown / select / menu | `<DropdownMenu>` (with `.Trigger`, `.Content`, `.Item`, `.Label`, `.Separator`) |
| Tabs | `<Tabs>` or `<Tab>` |
| Card | `<Card>` / `<CardHeader>` / `<CardBody>` / `<CardFooter>` |
| Dialog / modal | `<Dialog>` and friends |
| Tooltip | `<Tooltip label="…">` |
| Chip / compact control | `<Pill>` |
| Badge / tag | `<Badge variant="…">` |
| Status dot | `<StatusDot status="…">` |
| Keyboard chip | `<Kbd>` |
| Divider | `<Divider orientation="…">` |
| Icon wrapper | `<Icon as={Lucide} size="sm|md|lg">` |

If a primitive is missing, extend `/src/0canvas/ui/` first — **never** write per-feature CSS. A variant missing? Add it to the existing primitive with a new `variant` prop value and document it here.

---

## Rule 12: `className` is for layout only (the shadcn rule)

`className` may contain Tailwind layout utilities: `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `max-w-*`, `min-h-*`, `mx-auto`, `overflow-*`, `truncate`, `w-full`, `h-full`, `size-*`. Anything visual — color, typography, spacing, radius, shadow, border — must come from a primitive or a token.

### Banned patterns

```tsx
// ❌ Tailwind colors / typography / spacing
<div className="bg-blue-500 text-white p-4 rounded-lg">…</div>

// ❌ Overriding primitive visuals
<Button className="bg-red-600 text-white">Delete</Button>

// ❌ Inline style for static visuals
<p style={{ color: "#aaa", fontSize: 14 }}>…</p>
```

### Correct

```tsx
<div className="flex items-center gap-2">
  <Badge variant="primary">New</Badge>
  <Button variant="destructive">Delete</Button>
</div>
```

---

## Rule 13: Cursor density

- **Control heights** ≤ 32px (`--h-control-sm|md|lg`). No 40+ unless onboarding hero.
- **Body text** 13px (`--text-13`). **Metadata** 11px. **Controls** 12px. **Headings** 15px panel / 18px page. No other text sizes.
- **Accent discipline**: the primary blue (`--primary`, `--tint-primary-soft`, `--ring`) should appear on **< 5%** of pixels on any given screen. If it decorates more than a button, an active tab underline, and a focus ring — too much.
- **Flat chrome**: three surface tones (`--surface-floor`, `--surface-0`, `--surface-1`), optional `--surface-2` for selected. No gradients in chrome.
- **1px seams**, not tone steps, between columns. Always `--border-subtle`.
- **Hover** = a tint (`--tint-hover`). Never change the whole background or add a border on hover.

---

## Rule 14: No inline visual styles

`style={{}}` may ONLY be used for values that cannot be expressed as a class:

- A swatch background sourced from user data (`style={{ background: user.color }}`)
- An element position computed at runtime (`style={{ top: rect.y, left: rect.x }}`)
- A dynamic width that comes from a resize handle (`style={{ width: dims.w }}`)

`style={{}}` MUST NEVER contain static values for: `background`, `color`, `padding`, `margin`, `fontSize`, `fontWeight`, `fontFamily`, `border`, `borderRadius`, `boxShadow`, `zIndex`, or `width/height` for things that aren't being dragged.

If you're tempted to inline a static value, add a class instead.

---

## Rule 15: No manual `z-index`

Overlays use the primitives — `<DropdownMenu>`, `<Dialog>`, `<Tooltip>`, `<Popover>` — which already own the right z-layer via `--z-dropdown|modal|toast`. Writing `z-index: 999` or `z-index: 50` anywhere in a component is a bug.

If you need a new layer, add a token (`--z-foo`) to `design-tokens.css`, document it, and use it.

---

## Rule 5: Variable Documentation

Every `useState` / `useRef` MUST have a one-line comment above it explaining what it holds. Every prop in an interface MUST have a comment.

---

## Rule 6: Workflow Documentation

Every function or workflow MUST have a block comment:

```tsx
// WORKFLOW: handleForkPage
// TRIGGERED BY: Fork button click
// WHAT IT DOES: 1. …  2. …  3. …
```

---

## Rule 7: Clean HTML Structure

Prefer primitives + semantic tags. Never reach for `<div>` where a primitive exists.

```tsx
// GOOD
<Card>
  <CardHeader>Layers</CardHeader>
  <CardBody>
    {elements.map((el) => (
      <button
        key={el.id}
        className="oc-layers-row"
        data-selected={selected === el.id ? "true" : "false"}
      >…</button>
    ))}
  </CardBody>
</Card>

// BAD
<div style={{ background: "#141414", padding: 10 }}>…</div>
```

---

## Rule 8: Component Props

Props must be named clearly. Lean on shadcn conventions: `variant`, `size`, `asChild`, `onOpenChange`, `selected`, `disabled`, `loading`.

---

## Rule 9: npm Package CSS Delivery (engine)

The 0canvas engine ships as an npm package; its CSS is injected at runtime from `src/0canvas/engine/0canvas-styles.ts`. Engine styles MUST reference the same semantic tokens as the shell (no duplicate palette). Engine styles are scoped under `[data-0canvas-root]`.

---

## Rule 10: Keep It Simple

- No complex abstractions for their own sake.
- React `useState` + `useEffect` is enough for state in a component.
- If a designer can't read the JSX, simplify.
- Comments explain **why**, never **what**.
- Prefer CSS `:hover` / `:focus-visible` over JS handlers for styling.

---

## Quick Decision Table — "I need X → use Y"

| I need… | Use… |
|---|---|
| App background | `var(--surface-0)` |
| Chrome background (title/activity/status bar) | `var(--surface-floor)` |
| Card / input / menu background | `var(--surface-1)` |
| Selected tab / active chip background | `var(--surface-2)` or `var(--tint-primary-soft)` |
| Primary body text | `var(--text-on-surface)` |
| Secondary label text | `var(--text-on-surface-variant)` |
| Muted metadata text | `var(--text-muted)` |
| Disabled text | `var(--text-disabled)` |
| Link text | `var(--text-primary)` → hover `var(--text-primary-light)` |
| Subtle border | `var(--border-subtle)` |
| Input border | `var(--border-default)` |
| Focus ring | `var(--ring)` + `outline-offset: 1px` |
| Primary button bg | `var(--primary)` → hover `var(--primary-hover)` |
| Primary button text | `var(--primary-foreground)` |
| Destructive button | `var(--destructive)` |
| Success indicator | `var(--status-success)` |
| Error indicator | `var(--status-critical)` |
| Warning indicator | `var(--status-warning)` |
| Panel padding | `var(--space-6)` (12px) or `var(--space-7)` (14px) |
| Row padding Y | `var(--space-5)` (10px) |
| Item gap | `var(--space-3)` (6px) |
| Button radius | `var(--radius-sm)` (6px, DEFAULT) |
| Card/menu radius | `var(--radius-md)` (8px) |
| Dialog radius | `var(--radius-lg)` (12px) |
| Pill radius | `var(--radius-pill)` (9999px) |
| Hover tint | `background: var(--tint-hover)` |
| Active tint | `background: var(--tint-active)` |
| Selected row bg | `background: var(--tint-primary-soft)` |
| Dropdown z-index | (nothing — the primitive owns it, `var(--z-dropdown)`) |
| Modal z-index | (nothing — the primitive owns it, `var(--z-modal)`) |
| Transition duration | `var(--dur-fast)` for color/bg, `var(--dur-base)` for layout |
| System font stack | `var(--font-ui)` |
| Monospace | `var(--font-mono)` |
| Icon next to 13px text | `size={14}` or `<Icon size="md">` |
| Icon in activity bar / nav | `size={16}` or `<Icon size="lg">` |
| Chevron in pill | `size={10}` or `<Icon size="xs">` |

---

## Pre-commit Checklist

Before every UI-touching commit, verify:

- [ ] No new hex colors (`rg '#[0-9a-fA-F]{3,8}' src/`, should only light up `design-tokens.css`)
- [ ] No Tailwind color classes outside layout (`rg 'bg-(red|blue|green|gray|zinc|neutral)-\d+' src/`)
- [ ] No off-scale `font-size: Npx` (N ∉ {10,11,12,13,15,18})
- [ ] No off-scale `border-radius: Npx` (N ∉ {4,6,8,12})
- [ ] No numeric `z-index` in components
- [ ] `style={{}}` contains no static visual properties (color/bg/padding/margin/fontSize/border)
- [ ] Every new interactive element uses a primitive from `/src/0canvas/ui/`
- [ ] `pnpm check:ui` passes
- [ ] `pnpm build:ui` compiles clean

---

## Reference: Sections of `design-tokens.css`

1. Primitives (internal only — never reference in components)
2. Surfaces (backgrounds)
3. Text (foregrounds on surfaces)
4. Borders
5. Status
6. Primary / action
7. Typography
8. Space
9. Radius
10. Control heights
11. Icon sizes
12. Motion
13. Shadows
14. Z-index
15. Chrome layout
16. Tints (the ONLY rgba allowed outside the tokens file)
17. Syntax highlighting
18. Legacy aliases (deprecated, do not use in new code)
