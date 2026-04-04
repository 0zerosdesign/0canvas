# 0canvas Development Rules

> These rules MUST be followed by all contributors — human and AI — when developing this project.

---

## Rule 1: File Organization

Every file MUST be placed in the correct folder:

| Content | Location |
|---------|----------|
| 0canvas core engine | `/src/0canvas/engine/` |
| DOM inspector | `/src/0canvas/inspector/` |
| Canvas components | `/src/0canvas/canvas/` |
| Panel components | `/src/0canvas/panels/` |
| .0c file format | `/src/0canvas/format/` |
| State management | `/src/0canvas/store/` |
| Database/IndexedDB | `/src/0canvas/db/` |
| Utilities | `/src/0canvas/utils/` |
| UI primitives | `/src/0canvas/ui/` |
| MCP server | `/src/mcp/` |
| Design tokens | `/src/styles/` |
| Demo app pages | `/src/demo/pages/` |
| Demo app styles | `/src/demo/styles/` |
| Documentation | `/docs/` |
| Scripts | `/scripts/` |

NEVER put component code inside page files (import them instead).
NEVER put styling logic inside utility files.

---

## Rule 2: Every Component MUST Have This Structure

```tsx
// ============================================
// COMPONENT: ComponentName
// PURPOSE: What this component does
// USED IN: Which pages/components use this
// ============================================

// --- IMPORTS ---

// --- TYPES (component-specific) ---
// Every prop MUST have a comment

// --- VARIABLES (internal state) ---
// Each useState MUST have a comment explaining its purpose

// --- WORKFLOWS (functions) ---
// Each function MUST have a comment explaining what it does

// --- EVENT HANDLERS ---
// Each handler MUST have a comment explaining when it fires

// --- RENDER ---
// Clean HTML structure with CSS classes
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

// --- TYPES (page-specific) ---

// --- VARIABLES (useState declarations) ---
// Each variable MUST have a comment explaining its purpose

// --- WORKFLOWS (functions) ---
// Each workflow MUST have a comment explaining what it does

// --- EVENT HANDLERS ---

// --- RENDER ---
// Clean HTML structure with CSS classes
```

---

## Rule 4: CSS and Styling Rules

### Token Architecture

The design token system has two layers — **primitives** and **semantics**:

```
Primitive tokens      →   Semantic tokens       →   Component styles
--grey-800: #262626       --color--surface--1        background: var(--color--surface--1)
--blue-600: #2563EB       --color--base--primary     background: var(--color--base--primary)
```

- The ONLY token definition file is `/src/styles/variables.css`
- ALL UI across the entire application MUST use **semantic tokens**, not primitives
- NO hardcoded hex color values allowed anywhere in component code
- Primitive tokens (`--grey-800`, `--blue-600`, etc.) are the low-level palette — they exist ONLY to be referenced by semantic tokens
- Component code MUST use semantic tokens (`--color--surface--1`, `--color--text--muted`, etc.)

### Semantic Token System

The naming follows **surface / on-surface** convention:
- **Surface** tokens are for backgrounds (where content sits)
- **On-surface** tokens are for foreground (text, borders, icons that sit ON a surface)

Each surface level has paired foreground tokens. If a panel uses `surface--0` as its background, its borders use `border--on-surface-0` and its text uses `text--on-surface`.

### Surface Tokens (Backgrounds)

Use these for all `background`, `background-color` properties:

| Token | Resolves To | When To Use |
|-------|------------|-------------|
| `--color--surface--floor` | `--grey-950` | Deepest surfaces — toolbar, overlay backdrops, command palette |
| `--color--surface--0` | `--grey-900` | Main app background, canvas, cards, panels |
| `--color--surface--1` | `--grey-800` | Elevated surfaces — inputs, hover states, badges, code blocks |
| `--color--surface--2` | `--grey-700` | Secondary elevated — active states, scrollbar thumbs |
| `--color--surface--absolute` | `black` | Pure black (rare) |
| `--color--surface--inverted` | `--grey-200` | Light background for inverted elements (logos on dark) |

```
Depth order (darkest → lightest):
  floor → 0 → 1 → 2
```

### Text Tokens (Foreground — text, icons)

Use these for all `color` properties on text and icons:

| Token | Resolves To | When To Use |
|-------|------------|-------------|
| `--color--text--on-surface` | `--grey-200` | Primary text, headings, active labels |
| `--color--text--on-surface-variant` | `--grey-400` | Secondary text, panel titles, labels |
| `--color--text--muted` | `--grey-500` | Muted text, placeholders, inactive items |
| `--color--text--disabled` | `--grey-600` | Disabled text, very dim metadata |
| `--color--text--hint` | `--grey-700` | Hint text, barely visible labels |
| `--color--text--on-primary` | `--grey-50` | Text on blue/colored backgrounds (buttons) |
| `--color--text--primary` | `--blue-600` | Accent text — links, active tabs, tag names |
| `--color--text--primary-light` | `--blue-400` | Lighter primary accent text |

```
Brightness order (brightest → dimmest):
  on-primary → on-surface → on-surface-variant → muted → disabled → hint
```

### Border Tokens (Foreground — borders, dividers)

Use these for all `border-color`, `border` shorthand, and divider backgrounds:

| Token | Resolves To | When To Use |
|-------|------------|-------------|
| `--color--border--on-surface-0` | `--grey-800` | Subtle borders — panel edges, card outlines, dividers |
| `--color--border--on-surface-1` | `--grey-700` | Visible borders — hover states, input focus, resize lines |
| `--color--border--on-surface-2` | `--grey-600` | Emphasized borders — active inputs, strong separators |

**Pairing rule:** Match border number to the surface it sits on:
- Element on `surface--0` → border `on-surface-0`
- Element on `surface--1` → border `on-surface-1`

### Primary / Action Tokens

Use these for interactive elements with brand color:

| Token | Resolves To | When To Use |
|-------|------------|-------------|
| `--color--base--primary` | `--blue-600` | Primary button background, active indicators |
| `--color--base--primary-hover` | `--blue-700` | Primary button hover |
| `--color--base--primary-light` | `--blue-500` | Lighter primary (secondary actions) |
| `--color--outline--focus` | `--blue-500` | Focus rings, focus-visible outlines |
| `--color--outline--on-background` | `--blue-600` | Selected borders, active tab underlines |

### Status Tokens

Use these for status indicators, badges, and alert states:

| Token | Resolves To | When To Use |
|-------|------------|-------------|
| `--color--status--success` | `--green-500` | Success dots, connected badges, copy confirmation |
| `--color--status--warning` | `--yellow-500` | Warning badges, unsaved indicators |
| `--color--status--critical` | `--red-500` | Error badges, delete buttons, blocking severity |
| `--color--status--info` | `--blue-500` | Info indicators |
| `--color--status--connecting` | `--orange-500` | Connecting/pending states |
| `--color--text--critical-light` | `--red-400` | Lighter error text (hover delete) |

### Syntax Highlighting Tokens

Use these for code display and CSS property rendering:

| Token | Resolves To | When To Use |
|-------|------------|-------------|
| `--color--syntax--comment` | `--grey-400` | Code comments |
| `--color--syntax--selector` | `--green-500` | CSS selectors |
| `--color--syntax--property` | `--blue-300` | CSS property names |
| `--color--syntax--value` | `--orange-400` | CSS values |

### Primitive Palettes (reserved)

Primitive tokens (`--grey-*`, `--blue-*`, etc.) are ONLY used inside semantic token definitions in `variables.css`. Component code must NEVER reference them directly.

Other palettes (purple, pink, teal, orange, cyan, indigo, fuchsia, lime) are reserved for:
- Annotation color differentiation
- Tag/element type colors in layers panel
- Data visualization
- Syntax highlighting (via semantic tokens)
- NOT for general UI backgrounds, text, or borders

### How To Apply — Quick Decision Guide

```
Need a background?     → --color--surface--{floor|0|1|2}
Need text color?       → --color--text--{on-surface|muted|disabled|primary}
Need a border?         → --color--border--on-surface-{0|1|2}
Need a blue button?    → bg: --color--base--primary, text: --color--text--on-primary
Need a status dot?     → --color--status--{success|warning|critical}
Need focus ring?       → --color--outline--focus
Need selected border?  → --color--outline--on-background
```

### Example: Building a Panel

```css
.oc-panel {
  background: var(--color--surface--floor);       /* deepest surface */
}
.oc-panel-header {
  border-bottom: 1px solid var(--color--border--on-surface-0);
  color: var(--color--text--on-surface);          /* primary text */
}
.oc-panel-title {
  color: var(--color--text--on-surface-variant);  /* secondary text */
}
.oc-panel-input {
  background: var(--color--surface--1);           /* elevated input */
  border: 1px solid var(--color--border--on-surface-0);
  color: var(--color--text--on-surface);
}
.oc-panel-input:focus {
  border-color: var(--color--outline--on-background); /* blue focus */
}
.oc-panel-btn-primary {
  background: var(--color--base--primary);        /* blue button */
  color: var(--color--text--on-primary);          /* white text */
}
.oc-panel-btn-primary:hover {
  background: var(--color--base--primary-hover);
}
.oc-panel-muted {
  color: var(--color--text--muted);               /* dim label */
}
.oc-panel-status.is-connected {
  color: var(--color--status--success);           /* green dot */
}
```

### Styling Method

- Use CSS classes (not inline `style={{}}`) for all static styles
- Use proper class names: `.oc-toolbar-btn`, `.oc-layers-row`
- State classes: `.is-active`, `.is-selected`, `.when-expanded`, `.when-loading`
- Let CSS `:hover` and `:focus` handle interactive states (no `useState(hovered)`)
- Tailwind utility classes are permitted ONLY for layout: `flex`, `grid`, `gap-*`, `items-center`, etc.
- NEVER use Tailwind for colors, typography, or visual styling

### Class Naming Convention

```
.oc-{component}-{element}
.oc-{component}-{element}.is-{state}
.oc-{component}-{element}:hover
.oc-{component}-{element}:focus
```

Examples:
```css
.oc-toolbar { }
.oc-toolbar-btn { }
.oc-toolbar-btn:hover { }
.oc-toolbar-btn.is-active { }
.oc-panel-header { }
.oc-layers-row { }
.oc-layers-row.is-selected { }
.oc-layers-row.when-expanded { }
```

---

## Rule 5: Variable Documentation

Every `useState` variable MUST have a comment above it:

```tsx
// Tracks the currently selected element ID in the layers tree
const [selectedId, setSelectedId] = useState<string | null>(null);

// Controls whether the style panel is expanded
const [expanded, setExpanded] = useState<boolean>(true);
```

---

## Rule 6: Workflow Documentation

Every function/workflow MUST have a comment block:

```tsx
// WORKFLOW: handleForkPage
// TRIGGERED BY: Fork button click in source node
// WHAT IT DOES:
// 1. Captures current page HTML/CSS snapshot
// 2. Creates a new variant with the snapshot
// 3. Adds variant node to the canvas
// 4. Dispatches ADD_VARIANT action to store
function handleForkPage() {
  // ...
}
```

---

## Rule 7: Clean HTML Structure

JSX must be readable with semantic elements and proper class names:

```tsx
// GOOD - Readable, semantic, proper classes
<div className="oc-panel">
  <header className="oc-panel-header">
    <h3 className="oc-panel-title">Layers</h3>
    <button className="oc-panel-close">...</button>
  </header>
  <section className="oc-panel-body">
    {elements.map(el => (
      <div key={el.id} className={`oc-layers-row ${selected === el.id ? 'is-selected' : ''}`}>
        ...
      </div>
    ))}
  </section>
</div>

// BAD - Unclear divs, inline styles
<div style={{ background: '#0a0a0a', padding: 10 }}>
  <div style={{ display: 'flex' }}>
    <div style={{ color: '#888' }}>Layers</div>
  </div>
</div>
```

---

## Rule 8: Component Props

Component props should be named clearly:

```tsx
// GOOD - Clear attribute names
<VariantNode
  variant={variantData}
  isSelected={selectedId === variant.id}
  onFork={handleFork}
  onDelete={handleDelete}
/>

// BAD - Unclear props
<VariantNode d={data} s={true} f={fn} />
```

---

## Rule 9: npm Package CSS Delivery

The 0canvas app is an npm package. CSS is delivered via runtime injection:

- All component styles live in `src/0canvas/engine/0canvas-styles.ts`
- Styles are scoped under `[data-0canvas-root]` to prevent consumer conflicts
- `injectStyles()` creates a `<style>` element in `document.head`
- `removeStyles()` cleans up on unmount
- NEVER rely on consumers importing external CSS files

---

## Rule 10: Keep It Simple

- No complex abstractions
- No unnecessary state management libraries
- React `useState` + `useEffect` is sufficient
- If a designer can't understand the code structure, simplify it
- Code comments should explain "why", not just "what"
- Prefer CSS `:hover`/`:focus` over JavaScript event handlers for styling

---

## Quick Reference: Token → Code Mapping

| Purpose | Semantic Token | CSS Usage |
|---------|---------------|-----------|
| App background | `--color--surface--0` | `background: var(--color--surface--0)` |
| Card/input bg | `--color--surface--1` | `background: var(--color--surface--1)` |
| Primary text | `--color--text--on-surface` | `color: var(--color--text--on-surface)` |
| Muted text | `--color--text--muted` | `color: var(--color--text--muted)` |
| Subtle border | `--color--border--on-surface-0` | `border: 1px solid var(--color--border--on-surface-0)` |
| Blue button | `--color--base--primary` | `background: var(--color--base--primary)` |
| Button text | `--color--text--on-primary` | `color: var(--color--text--on-primary)` |
| Focus ring | `--color--outline--focus` | `outline: 2px solid var(--color--outline--focus)` |
| Success dot | `--color--status--success` | `color: var(--color--status--success)` |
| Font family | `--font-sans` | `font-family: var(--font-sans)` |
| Font size | `--font-size-sm` | `font-size: var(--font-size-sm)` |
| Shadow | `--shadow-md` | `box-shadow: var(--shadow-md)` |

| Visual Concept | React Code |
|---------------|------------|
| State variable | `useState()` |
| Computed value | `useMemo()` or `const x = ...` |
| Side effect | `useEffect()` |
| Event handler | `onClick`, `onChange`, `onSubmit` |
| Conditional render | `{condition && <Element />}` |
| List render | `{array.map(item => <Element />)}` |
| CSS class toggle | `` className={`oc-btn ${active ? 'is-active' : ''}`} `` |
