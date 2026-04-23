# RULES.md - Development Rules for 0research Project

## ALWAYS follow these rules when developing this project.

---

## Rule 1: File Organization Mirrors Visual Development Tools

Every file MUST be placed in the correct folder:

- **Pages** go in `/src/app/pages/`
- **Components** go in `/src/app/components/{category}/`
- **API calls** go in `/src/app/api/`
- **Types/Interfaces** go in `/src/app/types/`
- **Mock data** goes in `/src/app/data/`
- **Styles** go in `/src/styles/`

NEVER put API logic inside components or pages.
NEVER put component code inside page files (import them instead).

---

## Rule 2: Every Page MUST Have This Structure

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
// Each handler MUST have a comment explaining when it fires

// --- RENDER ---
// Clean HTML structure with CSS classes
```

---

## Rule 3: Every Component MUST Have This Structure

```tsx
// ============================================
// COMPONENT: ComponentName
// PURPOSE: What this component does
// USED IN: Which pages use this component
// ============================================

// --- ATTRIBUTES (Props interface) ---
// Every prop MUST have a comment

// --- VARIABLES (internal state) ---

// --- FORMULAS (computed values) ---

// --- WORKFLOWS (component logic) ---

// --- RENDER ---
```

---

## Rule 4: Every API File MUST Have This Structure

```tsx
// ============================================
// API: Category Name
// BASE URL: https://...
// PURPOSE: What APIs are in this file
// ============================================

// --- API 1: Name ---
// Method: GET/POST
// Endpoint: /path
// Parameters: list them
// Returns: describe response
// Auto-fetch: yes/no

// --- API 2: Name ---
// ...
```

---

## Rule 5: CSS and Styling Rules

- Use ONLY 0research design tokens for all colors — no hardcoded hex values allowed
- The ONLY permitted color tokens are (defined in `/src/styles/0research.css`):

| Token               | Hex Value  | Purpose                              |
|---------------------|-----------|---------------------------------------|
| `--zeros-bg1`       | #0d0d0d   | Main app background (darkest)         |
| `--zeros-bg2`       | #1A1A1A   | Card/section background               |
| `--zeros-bg3`       | #212121   | Elevated surfaces, input backgrounds  |
| `--zeros-bg4`       | #292929   | Hover states, subtle elevation        |
| `--zeros-bg5`       | #333333   | Active states, higher elevation       |
| `--zeros-bg6`       | #656567   | Muted foreground elements             |
| `--zeros-border`    | #3E3D3D   | All borders, dividers, separators     |
| `--zeros-button`    | #ffffff   | Primary button background (white)     |
| `--zeros-button2`   | #0D0D0D   | Primary button text (near-black)      |
| `--zeros-text1`     | #FFFFFF   | Primary text (headings, titles)       |
| `--zeros-text2`     | #AAAAAA   | Secondary text (descriptions, labels) |
| `--zeros-text3`     | #888888   | Tertiary text (metadata, captions)    |
| `--zeros-text4`     | #5C5C5C   | Muted text (placeholders, hints)      |

- NO other colors exist. Do not invent accent, success, error, or any other color tokens.
- Use Tailwind utility classes for layout: `flex`, `grid`, `gap-4`, etc.
- Use CSS classes (not inline styles) for component-specific styling
- Exception: third-party brand SVGs (e.g., Google logo) may use their official colors

---

## Rule 6: Variable Documentation

Every `useState` variable MUST have a comment above it:

```tsx
// Tracks the currently active/selected feed item ID
const [activeItemId, setActiveItemId] = useState<string>("");

// Controls whether OTP input section is visible (true after email is sent)
const [emailSent, setEmailSent] = useState<boolean>(false);
```

---

## Rule 7: Workflow Documentation

Every function/workflow MUST have a comment block:

```tsx
// WORKFLOW: loadMoreMedia
// TRIGGERED BY: Scroll reaching bottom of feed
// WHAT IT DOES:
// 1. Sets loading state to true
// 2. Fetches next batch of media from API
// 3. Appends new media to existing list
// 4. Sets loading state to false
function loadMoreMedia(offset: number) {
  // ...
}
```

---

## Rule 8: Clean HTML Structure

JSX must be readable like HTML. Use semantic elements:

```tsx
// GOOD - Readable, semantic
<main className="feed-main">
  <aside className="feed-sidebar-left">...</aside>
  <section className="feed-content">...</section>
  <aside className="feed-sidebar-right">...</aside>
</main>

// BAD - Unclear divs
<div><div><div>...</div></div></div>
```

---

## Rule 9: Component Props = Attributes

Component props should be named clearly like visual tool attributes:

```tsx
// GOOD - Clear attribute names
<MainFeedItem
  id="item-1"
  title="Design Thinking"
  description="Learn the basics..."
  mediaData={mediaObject}
/>

// BAD - Unclear props
<MainFeedItem d={data} x={true} />
```

---

## Rule 10: API Layer Separation

- Pages call API functions from `/src/app/api/`
- Pages NEVER contain fetch() calls directly
- API functions handle errors and return clean data
- Mock data is used as fallback when APIs are unavailable

```tsx
// IN PAGE (Good):
const metadata = await getMetadata(offset, limit);

// IN PAGE (Bad - Never do this):
const res = await fetch("https://...");
```

---

## Rule 11: Mock Data for Development

- All mock data lives in `/src/app/data/`
- Mock data matches the exact shape of real API responses
- When connecting real APIs, mock data serves as fallback
- Each mock data file documents the data structure

---

## Rule 12: Keep It Simple

- No complex abstractions
- No unnecessary state management libraries
- React useState + useEffect is sufficient
- If a designer can't understand the code structure, simplify it
- Code comments should explain "why", not just "what"

---

## Rule 13: File Ownership (Figma Make vs Antigravity IDE)

To prevent merge conflicts, each tool ONLY edits files in its ownership zone:

**Figma Make owns (UI):**
- `/src/app/pages/*` — all page files
- `/src/app/components/*` — all component files
- `/src/styles/*` — all style files
- `/src/app/data/*` — mock data

**Antigravity IDE owns (Backend):**
- `/src/app/lib/*` — SDK setup (Directus CMS, Appwrite auth)
- `/src/app/api/config.ts` — endpoint URLs and secrets
- `/src/app/api/feeds.ts` — feed API implementation (inside functions)
- `/src/app/api/auth.ts` — auth API implementation (inside functions)

**Shared (coordinate changes):**
- `/src/app/types/index.ts` — the data contract between frontend & backend
- `/BACKEND_CONTEXT.md` — IDE writes context, Figma Make reads it

**The rule:** Function signatures in api/ files are the contract.
Pages call `getMetadata()` — they don't care if it uses fetch(), Directus SDK, or Appwrite.
IDE changes what's INSIDE the function. Figma Make changes who CALLS the function.

---

## Rule 14: Backend Context File

When adding new backend functionality in the IDE:
1. Add the function to the correct api/ file
2. Add types to `/src/app/types/index.ts`
3. Update `/BACKEND_CONTEXT.md` with the new function signature
4. Figma Make reads BACKEND_CONTEXT.md to wire the function into the UI

---

## Quick Reference: Visual Tool → Code Mapping

| Visual Tool Concept | React Code Equivalent |
|--------------------|-----------------------|
| Page               | File in `/pages/`      |
| Component          | File in `/components/` |
| Variable           | `useState()`           |
| Formula            | `useMemo()` or `const computed = ...` |
| Workflow           | Regular function       |
| Event Handler      | `onClick`, `onChange`, `onSubmit` |
| Attribute          | Component `props`      |
| Auto-fetch         | `useEffect(() => {}, [])` |
| Conditional Show   | `{condition && <Element />}` |
| Loop/Repeat        | `{array.map(item => <Element />)}` |
| API Call           | Function in `/api/`    |
| Navigate           | `useNavigate()` from react-router |
| Toast              | `toast()` from sonner  |
| CSS Variable       | `var(--zeros-name)`    |