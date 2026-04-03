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

### Token System

- The ONLY design token file is `/src/styles/variables.css`
- ALL UI across the entire application MUST use only these tokens
- NO hardcoded hex color values allowed anywhere in component code
- NO semantic color aliases (no `--oc-bg`, `--oc-surface`, etc.)
- Use raw token names directly: `var(--grey-800)`, `var(--blue-500)`

### Color Usage

| Color | Purpose | Example |
|-------|---------|---------|
| `--grey-*` (50-900) | ALL neutrals — backgrounds, text, borders, icons | `var(--grey-900)` for dark bg |
| `--blue-*` | Primary — actions, links, selected states, accents | `var(--blue-500)` for links |
| `--green-*` | Success states only | `var(--green-500)` for success |
| `--yellow-*` | Warning states only | `var(--yellow-500)` for warning |
| `--red-*` | Error/danger states only | `var(--red-500)` for error |

Other palettes (purple, pink, teal, orange, cyan, etc.) are reserved for:
- Annotation color differentiation
- Tag/element type colors in layers panel
- Data visualization
- NOT for general UI elements

### Grey Hierarchy (dark theme)

```
Backgrounds (darkest → lightest):
  var(--grey-900)  → app/page background
  var(--grey-800)  → panel/card background
  var(--grey-700)  → hover state, elevated surface
  var(--grey-600)  → active state

Text (brightest → dimmest):
  var(--grey-50)   → primary text, headings
  var(--grey-200)  → secondary text
  var(--grey-400)  → muted text, labels
  var(--grey-500)  → dim text, metadata
  var(--grey-600)  → placeholder, disabled

Borders:
  var(--grey-800)  → subtle border
  var(--grey-700)  → visible border
  var(--grey-600)  → emphasized border
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

| Design Token | CSS Usage |
|-------------|-----------|
| `--grey-900` | `background: var(--grey-900)` |
| `--blue-500` | `color: var(--blue-500)` |
| `--font-sans` | `font-family: var(--font-sans)` |
| `--font-size-sm` | `font-size: var(--font-size-sm)` |
| `--font-weight-regular` | `font-weight: var(--font-weight-regular)` |
| `--shadow-md` | `box-shadow: var(--shadow-md)` |

| Visual Concept | React Code |
|---------------|------------|
| State variable | `useState()` |
| Computed value | `useMemo()` or `const x = ...` |
| Side effect | `useEffect()` |
| Event handler | `onClick`, `onChange`, `onSubmit` |
| Conditional render | `{condition && <Element />}` |
| List render | `{array.map(item => <Element />)}` |
| CSS class toggle | `` className={`oc-btn ${active ? 'is-active' : ''}`} `` |
