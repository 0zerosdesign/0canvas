# Zeros Development Rules

> These rules MUST be followed by every contributor — human **and** AI — working on this project. They exist to keep the UI consistent, top-class, and Cursor/Figma-grade. Breaking them is treated as a failing review.

Visual target: **Cursor IDE + Linear + Figma**. Dark theme, slate-neutral palette, restrained blue accent (≤ 5% of pixels per screen), 3-tier text hierarchy, strict 4px spacing grid, tonal borders.

The design-token system spans **two products** in this repo:

- **Zeros** (Electron mac app) — IDE-scale chrome, `--h-control-sm|md|lg` (24/28/32).
- **0colors** (`apps/0colors/`) — form-scale chrome, `--h-control-xl|2xl|3xl` (36/40/44).

Both share one `/styles/tokens.css` file. When 0colors embeds inside Zeros' design module later, surfaces / text tiers / accents resolve to the exact same values because the tokens are physically the same.

---

## Rule 1 — Design Tokens (ONE source of truth)

### 1.1 One file
The only place tokens live is **`/styles/tokens.css`** at the repo root. No other CSS file defines color, typography, spacing, radius, shadow, motion, or z-index values. Never create `tokens/foo.css`, never split, never fork.

### 1.2 Semantic tokens only in components
Components reference **semantic** names (`--surface-0`, `--text-primary`, `--accent`, `--radius-sm`, `--space-4`, `--text-13`, `--dur-fast`, `--z-dropdown`). Components NEVER reference **primitives** directly (`--grey-900`, `--blue-500`) — those are internal to `tokens.css`.

### 1.3 Banned in component code

| Banned | Use instead |
|---|---|
| Hex colors (`#171717`, `#10B981`, …) outside `tokens.css` | Semantic token |
| `rgba(...)` literals, EXCEPT the documented `--tint-*` + `--backdrop-*` set | Documented tint/backdrop token |
| `font-size: Npx` where N ∉ {8, 9, 10, 11, 12, 13, 15, 18, 20} | `var(--text-8|9|10|11|12|13|15|18|20)` |
| `font-weight: N` where N ∉ {400, 500, 600} | `var(--weight-body|control|heading)` |
| `border-radius: Npx` off-scale | `var(--radius-xs|sm|md|lg|pill|circle)` |
| Odd margin/gap values (3, 5, 7, 9, 11, 13, 15) | Closest `var(--space-N)` (or `--space-3x|5x|7x` for 6/10/14) |
| Arbitrary `z-index: N` | `var(--z-chrome|panel|dropdown|modal|toast)` |
| Raw `box-shadow` patterns | `var(--shadow-sm|md|lg|xl|glass|glass-deep|inset-subtle|inset-accent|ring|ring-halo)` |
| Raw `transition` durations / easings | `var(--dur-fast|base|slow) var(--ease-standard|emphasized)` |
| Tailwind color classes (`bg-blue-500`, `text-red-600`, …) | Semantic token via component CSS |
| `font-family: "Inter"` or any web font | `var(--font-ui)` (system stack) or `var(--font-mono)` |

### 1.4 Adding a token
If nothing fits, STOP. Do not invent inline. Either:
1. Use the nearest existing semantic token, or
2. Add a new semantic token to `tokens.css` in the same PR that introduces its first caller. Update this file's Quick Decision Table + tokens.css section headers.

Do not carry legacy aliases. If a rename happens, codemod callers and drop the old name.

---

## Rule 2 — Boundary Exceptions (when raw values ARE OK)

Not every pixel can be a token. These are documented exceptions:

### 2.1 User-rendered data
Values bound to runtime user state — color picker swatches, palette renderers, canvas HCT/OKLCH math. A text editor doesn't tokenize letters; a color editor doesn't tokenize swatches.

```tsx
// OK — user data
<div style={{ background: userChosenColor }} />
<div style={{ background: computeOklch(h, c, l) }} />
```

### 2.2 Library / platform boundaries
CSS can't reach into some runtimes. Keep hex values as raw at the boundary:
- **xterm.js** (`terminal-panel.tsx`) — `TERMINAL_THEME` paints to canvas/WebGL.
- **Canvas 2D** (`thumbnail-generator.ts`) — `ctx.fillStyle = '#1a1a1a'` can't read CSS vars.
- **Radix runtime vars** — `--radix-context-menu-content-available-height` etc. are injected by Radix at runtime.
- **LLM prompt / MCP schema strings** — hex values inside prompt text describe what to generate.

### 2.3 Local z-index stacking
`z-index: 1` or `z-index: 2` inside a parent's stacking context (e.g., a card's content over its `::before` pseudo) is fine as raw. Local stacking ≠ global chrome layering. Tokenize only when you're claiming a global layer (≥ `--z-chrome`).

### 2.4 Hair-line pixel details
`border: 1px solid …` stays as `1px`. 1-2px decorative bleeds (`margin-top: -3px` on a slider thumb) are fine. Adding a `--space-3px` token is anti-pattern — single-use tokens dilute the system.

### 2.5 Unique component geometry
If a component has a specific shape (e.g., TokenNodeCard's 19px outer radius, 80px hero empty-state vertical pad, 500px dialog max-width), leave as raw with an inline `/* FLAG: ... */` comment explaining the visual intent. These sit below our "token-worthy" threshold.

### 2.6 Keyframe internals
Animation `@keyframes` translation offsets and timing values (e.g., 2s pulse, 1.5s loader) are allowed raw. Token the *invocation* (`animation-duration: var(--dur-base)`), not the keyframe math.

**Rule:** any raw value that isn't in the above categories IS a violation. An inline FLAG comment signals a judgment call, not a pass.

---

## Rule 3 — File Organization

| Content | Location |
|---|---|
| Zeros core engine | `/src/zeros/engine/` |
| DOM inspector | `/src/zeros/inspector/` |
| Canvas components | `/src/zeros/canvas/` |
| Panel components | `/src/zeros/panels/` |
| Editors (style panel) | `/src/zeros/editors/` |
| Themes system | `/src/zeros/themes/` |
| `.0c` file format | `/src/zeros/format/` |
| State management | `/src/zeros/store/` |
| Database / IndexedDB | `/src/zeros/db/` |
| Utilities | `/src/zeros/lib/`, `/src/zeros/utils/` |
| **UI primitives** | `/src/zeros/ui/` |
| ACP bridge | `/src/zeros/acp/` |
| MCP server | `/src/mcp/` |
| **Design tokens (ONE file)** | `/styles/tokens.css` |
| App shell (Electron window chrome) | `/src/shell/` |
| Electron main + preload + IPC | `/electron/` |
| Native IPC façade for renderer | `/src/native/` |
| Demo pages | `/src/demo/` |
| Vendored apps | `/apps/0colors/` |
| Documentation | `/docs/` |
| Scripts | `/scripts/` |

NEVER put component code inside page files (import them).
NEVER put styling logic inside utility files.
NEVER put a new primitive outside `/src/zeros/ui/`.

---

## Rule 4 — Primitive-first (the shadcn rule)

Every visual element uses a component from `/src/zeros/ui/`. Per-feature classes that duplicate primitive behaviour are forbidden in new code.

| Need | Primitive |
|---|---|
| Button | `<Button variant="…" size="…">` |
| Icon-only button | `<Button variant="ghost" size="icon">` |
| Text / password / number input | `<Input type="…">` |
| Multi-line input | `<Textarea>` |
| Label above a form control | `<Label>` |
| Dropdown / select / menu | `<DropdownMenu>` with `.Trigger/.Content/.Item/.Label/.Separator` |
| Tabs | `<Tabs>` |
| Card | `<Card>` / `<CardHeader>` / `<CardBody>` / `<CardFooter>` |
| Dialog / modal | `<Dialog>` + friends |
| Tooltip | `<Tooltip label="…">` |
| Chip / compact control | `<Pill>` |
| Badge / tag | `<Badge variant="…">` |
| Status dot | `<StatusDot status="…">` |
| Keyboard chip | `<Kbd>` |
| Divider | `<Divider orientation="…">` |
| Icon wrapper | `<Icon as={Lucide} size="sm|md|lg">` |

If a primitive is missing, extend `/src/zeros/ui/` first. Never write per-feature CSS.

---

## Rule 5 — `className` is for layout only

`className` may contain Tailwind layout utilities: `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `max-w-*`, `min-h-*`, `mx-auto`, `overflow-*`, `truncate`, `w-full`, `h-full`, `size-*`. Anything visual — color, typography, spacing, radius, shadow, border — must come from a primitive or a token.

```tsx
// ❌ Tailwind colors / typography / spacing
<div className="bg-blue-500 text-white p-4 rounded-lg">…</div>

// ❌ Overriding primitive visuals
<Button className="bg-red-600 text-white">Delete</Button>

// ❌ Inline style for static visuals
<p style={{ color: "#aaa", fontSize: 14 }}>…</p>

// ✅ Layout classes + primitives
<div className="flex items-center gap-2">
  <Badge variant="primary">New</Badge>
  <Button variant="destructive">Delete</Button>
</div>
```

---

## Rule 6 — Density

- **Control heights**:
  - Zeros IDE chrome: 24 / 28 / 32 px (`--h-control-sm|md|lg`). Never exceed 32.
  - 0colors forms + dialogs: 36 / 40 / 44 px (`--h-control-xl|2xl|3xl`).
- **Body text** 13 px (`var(--text-13)`). **Controls** 12 px. **Metadata** 11 px. **Panel heading** 15 px. **Page heading** 18–20 px. Micro-labels (timestamps, tiny badges) may use 9–10 px where essential.
- **Accent discipline**: blue (`--accent`, `--accent-hover`, `--accent-soft-bg`, `--ring-focus`, `--text-link`) appears on **< 5%** of pixels. If it decorates more than:
  1. Primary-button fill
  2. Active-tab indicator
  3. Focus-ring outline
  4. Link text
  5. Selection-highlight bg

  it's too much.
- **Surface hierarchy**: 5-tier (`--surface-floor/0/1/2/3`). Hover swaps to `--surface-2`; selected swaps to `--surface-3`. Never gradient chrome.
- **Borders**: solid tonal steps, not alpha overlays. Use `--border-subtle|default|strong` per visual weight.
- **1px column seams**, always `--border-subtle`.

---

## Rule 7 — No inline visual styles

`style={{}}` is ONLY for values that can't be expressed as a class:

- User-data swatches (`style={{ background: user.color }}`)
- Runtime-computed position (`style={{ top: rect.y, left: rect.x }}`)
- Dynamic width from a resize handle (`style={{ width: dims.w }}`)

NEVER use `style={{}}` for static `background`, `color`, `padding`, `margin`, `fontSize`, `fontWeight`, `fontFamily`, `border`, `borderRadius`, `boxShadow`, `zIndex`, or `width/height` on non-interactive elements. If you're tempted, add a class.

---

## Rule 8 — No manual `z-index`

Overlays use the primitives (`<DropdownMenu>`, `<Dialog>`, `<Tooltip>`, `<Popover>`) which already own the right layer via `--z-dropdown|modal|toast`. Writing `z-index: 999` or `z-index: 50` in a component is a bug.

**Exception:** local stacking `z-index: 1|2` inside a parent's contained context (see Rule 2.3).

If you need a new global layer, add a token (`--z-foo`) to `tokens.css`, document it, and use it.

---

## Rule 9 — Component Structure

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

Pages follow the same pattern with `PAGE:` / `ROUTE:` / `PURPOSE:` header.

Every `useState` / `useRef` has a one-line comment explaining what it holds. Every prop has a comment. Every workflow function has a block comment.

Comments explain **why**, never **what**.

---

## Rule 10 — Keep It Simple

- No complex abstractions for their own sake.
- React `useState` + `useEffect` is enough for state in a component.
- If a designer can't read the JSX, simplify.
- Prefer CSS `:hover` / `:focus-visible` over JS handlers for styling.

---

## Quick Decision Table — "I need X → use Y"

| I need… | Use… |
|---|---|
| Deepest chrome bg (title/activity/status bar) | `var(--surface-floor)` |
| App canvas background | `var(--surface-0)` |
| Card / input / menu bg | `var(--surface-1)` |
| Row hover / menu-item hover bg | `var(--surface-2)` |
| Active tab / selected row bg | `var(--surface-3)` or `var(--accent-soft-bg)` |
| Body text | `var(--text-primary)` |
| Secondary label text | `var(--text-muted)` |
| Placeholder / hint text | `var(--text-placeholder)` |
| Disabled text | `var(--text-disabled)` |
| Link text | `var(--text-link)` (resolves to `--accent`) |
| Primary button fill | `var(--accent)` → hover `var(--accent-hover)` |
| Primary button text | `var(--text-on-accent)` |
| Focus ring outline | `var(--ring-focus)` + `outline-offset: 1px` |
| Destructive fill | `var(--text-critical)` |
| Success indicator | `var(--text-success)` |
| Warning indicator | `var(--text-warning)` |
| Info indicator | `var(--text-info)` |
| Subtle border / column seam | `var(--border-subtle)` |
| Input / button border | `var(--border-default)` |
| Focused input / dialog edge | `var(--border-strong)` |
| Panel padding | `var(--space-5)` (20px) or `var(--space-6)` (24px) |
| Row padding Y | `var(--space-5x)` (10px) |
| Item gap | `var(--space-3)` (12px) |
| Button radius | `var(--radius-sm)` (6px, DEFAULT) |
| Card / menu radius | `var(--radius-md)` (8px) |
| Dialog radius | `var(--radius-lg)` (12px) |
| Pill radius | `var(--radius-pill)` |
| Selected row bg | `background: var(--accent-soft-bg)` |
| Card floating shadow | `var(--shadow-glass)` |
| Modal deep shadow | `var(--shadow-glass-deep)` |
| Opaque drop shadow (IDE chrome) | `var(--shadow-lg)` / `var(--shadow-xl)` |
| Focus ring (solid) | `box-shadow: var(--shadow-ring)` |
| Focus halo (soft) | `box-shadow: var(--shadow-ring-halo)` |
| Card inner hairline | `box-shadow: var(--shadow-inset-subtle)` |
| Selection inset | `box-shadow: var(--shadow-inset-accent)` |
| Dropdown z-index | (primitive owns it — `var(--z-dropdown)`) |
| Modal z-index | (primitive owns it — `var(--z-modal)`) |
| Transition for color/bg | `var(--dur-fast) var(--ease-standard)` |
| Transition for layout | `var(--dur-base) var(--ease-standard)` |
| System font stack | `var(--font-ui)` |
| Monospace | `var(--font-mono)` |
| Icon next to 13px text | `size={14}` (`var(--icon-md)`) |
| Icon in nav / activity bar | `size={16}` (`var(--icon-lg)`) |
| Chevron in pill | `size={10}` (`var(--icon-xs)`) |
| Dropdown min-width | `var(--menu-min-width)` (8rem) |

---

## Pre-commit Checklist

Before every UI-touching commit, verify with the grep one-liners below. Each should light up zero lines (or only files listed in Rule 2 — boundary exceptions):

```bash
# No raw hex in components
grep -rnE '#[0-9a-fA-F]{6,8}\b' src/ apps/0colors/packages/frontend/src/ --include='*.css' --include='*.tsx' | grep -v 'styles/tokens.css'

# No raw rgba in components
grep -rnE 'rgba\(' src/ apps/0colors/packages/frontend/src/ --include='*.css' | grep -v 'styles/tokens.css'

# No off-scale font-size
grep -rnE 'font-size:\s*[0-9]+' src/ apps/0colors/packages/frontend/src/ --include='*.css' | grep -v 'var(--text-'

# No raw z-index in components (except local stacking 1-2)
grep -rnE 'z-index:\s*[3-9][0-9]*' src/ apps/0colors/packages/frontend/src/ --include='*.css' | grep -v 'var(--z-'

# No raw transition
grep -rnE 'transition:' src/ apps/0colors/packages/frontend/src/ --include='*.css' | grep -vE 'var\(--(dur|ease)'

# Typecheck
pnpm exec tsc --noEmit -p tsconfig.build.json
```

A violation that falls under Rule 2's boundary exceptions is fine — leave an inline `/* FLAG: <reason> */` comment on the line so reviewers can see it's intentional.

---

## Reference: Sections of `tokens.css`

1. Internal primitives — NEVER reference from components
2. Surfaces (5-tier + inverted pair)
3. Borders (3 solid tonal steps)
4. Text (3 tiers + disabled + on-accent/-inverted)
5. Accent (+ hover / pressed / soft-bg / ring-focus)
6. Status (text color + soft-bg pair for each)
7. Tints (state overlays — the ONLY rgba allowed in components, indirectly)
8. Typography (font stacks + px scale 8/9/10/11/12/13/15/18/20 + weights + leading + tracking)
9. Spacing (strict 4px grid + `-3x/-5x/-7x` odd steps)
10. Radius (`xs|sm|md|lg|pill|circle`)
11. Motion (`dur-fast|base|slow`, `ease-standard|emphasized`)
12. Shadows (opaque elevation `sm|md|lg|xl` + glass `glass|glass-deep` + insets + rings)
13. Z-index (5-tier scale)
14. Control heights (IDE-scale `sm|md|lg` + form-scale `xl|2xl|3xl`)
15. Icon sizes (`xs|sm|md|lg|xl`)
16. Chrome layout (shell dims + menu min-widths)
17. Syntax highlighting (generic + DSL-specific)
18. Brand (third-party product tints — Claude, Codex, …)
19. Utility (0colors domain indicators — build, project, API, …)

Any new token lands in the matching section with a one-line comment; no ad-hoc additions outside the taxonomy.
