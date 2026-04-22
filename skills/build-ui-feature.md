---
name: Build UI Feature
description: Step-by-step procedure for implementing any new UI feature in Zeros so the result stays consistent with the Cursor 3 design system. Use this skill whenever you're about to create or modify a component, panel, or page.
icon: LayoutTemplate
---

You are the build-ui-feature skill. When a user asks for new UI work (new panel, new control, new page, new dialog), follow this procedure **in order**. Skipping steps causes visual drift.

---

## Step 1 — Read `RULES.md` and `skills/ui-consistency.md`

They exist for a reason. Always read them first when you're about to write UI. Pay special attention to:
- Rule 4 (one token file, semantic tokens only)
- Rule 11 (primitives first)
- Rule 12 (`className` for layout only)
- Rule 13 (Cursor density)
- Rule 14 (no inline visual styles)

---

## Step 2 — Name the module and its home

Answer in writing before coding:

1. Which column / panel will this live in? (Col 1 sidebar, Col 2 workspace tab, Col 3 page, a floating dialog, the status bar, …)
2. What file will it live in? Use `RULES.md` Rule 1 to place it correctly.
3. Is this a **page** (routed, top-level) or a **component** (composes other primitives)? Use the matching file header template from Rule 2 / 3.

---

## Step 3 — List the primitives you'll use

Write the list out before writing JSX. Example for "a delete-project confirmation modal":

- `<Dialog>` + `<DialogContent>` + `<DialogHeader>` + `<DialogBody>` + `<DialogFooter>`
- `<Button variant="destructive">` for the confirm action
- `<Button variant="ghost">` for cancel
- `<Icon as={AlertTriangle} size="md">` in the header for the warning indicator

If your list includes a primitive that doesn't exist yet in `/src/zeros/ui/`, STOP and add it to the primitive library first. Never write a one-off class.

---

## Step 4 — Pick the tokens

Cross-reference the `RULES.md` Quick Decision Table. Write a token list before the JSX:

| Need | Token |
|---|---|
| Dialog bg | `var(--surface-1)` (primitive handles it) |
| Title text | `var(--text-on-surface)` (primitive) |
| Warning icon color | `var(--status-warning)` |
| Destructive button bg | `var(--destructive)` (primitive) |
| Padding | `var(--space-8)` (primitive) |

Using tokens the primitive already owns means you mostly just pass props.

---

## Step 5 — Write the JSX

Hard rules while typing:

- Never type `#` followed by a hex digit.
- Never type a Tailwind color utility (`bg-*-<n>`, `text-*-<n>`, `border-*-<n>`).
- Never type `style={{` followed by `color`, `background`, `padding`, `margin`, `fontSize`, `fontWeight`, `fontFamily`, `border`, `borderRadius`, `boxShadow`, `zIndex`.
- Every interactive element is a `<Button>`, `<Pill>`, `<Input>`, `<DropdownMenu.Item>`, `<Tab>`, or `<Card>`.
- `className` contains Tailwind layout only: `flex`, `grid`, `gap-*`, `items-*`, `justify-*`, `max-w-*`, `size-*`, `truncate`, `overflow-*`.

---

## Step 6 — Run the guards

```bash
pnpm check:ui        # lints for token/primitive violations
pnpm build:ui        # must compile clean
```

If `check:ui` fails, fix at the source — don't suppress.

---

## Step 7 — Visual QA against Cursor

Before declaring done:

- Controls ≤ 32px tall?
- Body text at 13px, metadata at 11px?
- Accent blue on **one** element per screen (at most two)?
- 1px subtle border between regions, never a tone step?
- Hover is a tint, not a full bg swap?
- Dropdowns open in the right direction (away from screen edges)?
- Focus ring visible on every control via keyboard?

If any answer is "no", fix it before committing.

---

## Anti-patterns to avoid

```tsx
// ❌ Rolling your own button
<button className="text-white bg-blue-600 px-4 py-2 rounded">Save</button>

// ✅ Use the primitive
<Button variant="primary">Save</Button>


// ❌ Inline styling static visuals
<div style={{ background: "#1a1a1a", padding: 12, borderRadius: 8 }}>…</div>

// ✅ Primitive
<Card><CardBody>…</CardBody></Card>


// ❌ Bespoke dropdown
const [open, setOpen] = useState(false);
return <div style={{ position: "absolute", zIndex: 999 }}>…</div>;

// ✅ Primitive
<DropdownMenu>
  <DropdownMenu.Trigger asChild><Button>…</Button></DropdownMenu.Trigger>
  <DropdownMenu.Content>…</DropdownMenu.Content>
</DropdownMenu>
```

---

## When you finish

Add a one-line note to the PR description:

> Built using primitives: `<Button>`, `<Card>`, `<DropdownMenu>`. Tokens: `--surface-1`, `--space-6`, `--radius-md`. `pnpm check:ui` clean.

That note is the contract: any reviewer (human or AI) can verify consistency at a glance.
