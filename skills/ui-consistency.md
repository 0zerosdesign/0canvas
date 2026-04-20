---
name: UI Consistency
description: Rules and constraints for making any UI change in 0canvas visually consistent with the Pass 1-5 design system.
icon: Palette
---

You are the UI-consistency skill for 0canvas. Every change you make to
the Tauri shell (`src/shell/**`, `src/app-shell.tsx`), the engine
canvas (`src/0canvas/**`), or any injected CSS
(`src/shell/app-shell.css`, `src/0canvas/engine/styles/*.ts`,
`src/0canvas/engine/0canvas-styles.ts`) must obey the following rules.

If you're asked to add or modify UI, read these rules first, pick the
correct tokens/sizes/radii, and only then write code. Do not invent
new values.

---

## 1. Surface hierarchy (Pass 1)

| Role | Token | Where |
|---|---|---|
| Chrome (nav, tab bars, toolbars) | `--color--surface--floor` | Col 1 whole, Col 2 whole, Col 3 tab bar + workspace toolbar, Settings nav |
| Content (canvas, body) | `--color--surface--0` | Col 3 canvas area, Settings content, preview iframe frame |
| Elevated (cards, menus, inputs, hover) | `--color--surface--1` | dropdowns, inputs, row hover, chat composer card |
| Emphasis (active, selected) | `--color--surface--2` | active tab bg, selected chip |
| Separators | `--color--border--on-surface-0` | between chrome and content, column seams, tab bar underlines, card edges |

**Never** use hardcoded hex values (`#000`, `#141414`, `#1a1a1a`, etc.)
for backgrounds or borders. Always use a semantic token. Status colors
(info / success / warning / critical) also use their semantic tokens
(`--color--text--primary-light`, `--color--text--success`,
`--color--text--warning`, `--color--text--critical-light`).

---

## 2. Typography scale (Pass 2)

The only font-sizes allowed in shell/engine CSS:

| Size | Role | Weight |
|---|---|---|
| 10px | overline / tiny badges (uppercase, 0.05em tracking) | 600 |
| 11px | metadata, hints, subtitles, timestamps | 400-500 |
| 12px | controls — buttons, menu items, tabs, chips | 500 |
| 13px | body — list rows, input text, default readable text | 400 |
| 15px | headings — panel titles, card titles, modal heads | 600 |
| 18px | page h1 (settings only) | 600 |

Documented exceptions, scoped and intentional:

- `6px` — the `.oc-source-badge` micro label inside a 14×14 overlay.
- `14px` — icon font-size for lucide SVGs sized via font-size
  (e.g. `.oc-auto-send-icon`).
- `16px` — icon font-size inside 20×20 buttons (close, expand).
- `.text-\[Npx\]` utility classes keep their class-name-encoded sizes.

**Never** use 9, 14, or 16 for actual text. Always snap to the scale.
If you need a size between two steps, pick the step above for
headings and below for controls.

Weight/color rules:

- 400 body / 500 labels & controls / 600 headings & overline /
  700 only for strong micro emphasis (badges, KBD chips).
- Default color: `--color--text--on-surface` for body,
  `--color--text--muted` for secondary, `--color--text--disabled`
  for disabled/hint.
- Hover/active states = tinted background, never a ring or border
  change.

---

## 3. Spacing & radius (Pass 3)

### Padding

- Buttons: `6px 10px` (sm) / `6px 12px` / `8px 12px` (lg) / `10px 14px`
- Rows (list items, panel headers): `10px 12px` / `10px 14px`
- Panels / cards: `12px 14px` / `14px 16px`
- Dialogs: `16px` / `20px` / `24px`
- Chip micro-padding (`1px 5px`, `1px 6px`, `3px 8px`) is intentional
  fine-grain and is the ONLY place sub-8 values are allowed.

### Gap / margin

Only even values: 2 / 4 / 6 / 8 / 10 / 12 / 14 / 16. Never 3, 5, 7, 9,
11, 13, 15 as gap/margin values.

### Border radius (the only values allowed)

| Radius | Role |
|---|---|
| 4px | small (chips, badges, swatches, scrollbar) |
| 6px | default (buttons, tabs, inputs, menu items) |
| 8px | cards, menus, elevated surfaces |
| 12px | modals, command palette, hero cards |
| 50% | circles (status dots, avatars) |
| 9999px | pills (branch chip, tag pill, segmented) |

Never use 2, 3, 5, 7, 10, 14, or any other radius. Snap to the scale.

### Icons

- 16px for nav-tier icons
- 14px for inline icons next to text
- 12px for micro icons (inside pills, tight chips)
- 10-11px for caret/chevron icons

---

## 4. Primitives vocabulary (Pass 5)

When you're creating a new control, use the primitive classes first:

```jsx
<button className="oc-btn">Label</button>              // ghost
<button className="oc-btn oc-btn--primary">Save</button>
<button className="oc-btn oc-btn--secondary">Back</button>
<button className="oc-btn oc-btn--critical">Delete</button>
<button className="oc-btn oc-btn--icon"><Icon/></button>
<button className="oc-btn oc-btn--sm">small</button>
<input  className="oc-input" />
<div    className="oc-card">...</div>
```

Existing per-feature button classes (`.oc-toolbar-btn`,
`.oc-chat-iconbtn`, `.oc-git__btn`, etc.) already exist and share
focus/disabled styling with the primitives via the legacy
normalization block in `app-shell.css`. **Do not rename them**; when
you touch a component, migrate its JSX to use the primitives and
delete the per-feature class's duplicated CSS.

---

## 5. Shell layout rules

- **Col 1 (Nav, 248px, collapsible to 56px):** project list, chats
  grouped under projects, localhost ports, profile menu.
  `--color--surface--floor` with `border-right: 1px solid
  --color--border--on-surface-0`.
- **Col 2 (Workspace, 440px fixed):** horizontal tabs (Chat / Git /
  Terminal / Env / Todo / Mission). `--color--surface--floor` with
  right border. Tab style shared with Col 3 page tabs.
- **Col 3 (Canvas, flex):** page tabs on top (Design / Themes /
  Settings-when-active). Workspace toolbar below. Preview iframe +
  right panel slot (StylePanel / Feedback). Col 3 chrome =
  `--color--surface--floor`, canvas area = `--color--surface--0`.

Column seams are 1px `border-right` on col 1 and col 2. Never a tone
step between columns — always a thin border.

Tab bar style (used in Col 2, Col 3 page tabs, Settings): horizontal
flex, `padding: 10px 10px 4px`, `background:
var(--color--surface--floor)`, `border-bottom: 1px solid
var(--color--border--on-surface-0)`. Individual tabs:
`padding: 5px 10px`, `border-radius: 6px`, `font-size: 12px`,
`font-weight: 500`. Hover = `rgba(255,255,255,0.03)` bg, active =
`rgba(255,255,255,0.06)` bg + `--color--text--on-surface`.

---

## 6. Dropdowns, menus, and overlays

- **Don't clip.** If a dropdown is anchored inside a container, make
  sure the container does NOT have `overflow: hidden`. Anchor menus
  with `position: absolute` + `bottom: calc(100% + 6px)` for
  bottom-rising menus or `top: calc(100% + 6px)` for top-rising.
  Z-index ≥ 25 for composer/toolbar menus, ≥ 100 for modals.
- **Click-outside + Escape dismiss.** Every dropdown must handle
  `mousedown` outside its root and the `Escape` key to close.
- **Current selection mark.** Use a `Check` icon at the right edge of
  the selected row, `--color--text--primary-light` for both the icon
  and the label color.
- **Section labels.** 10px uppercase, 0.05em tracking, `padding: 4px
  10px`, color `--color--text--muted`.
- **Dividers.** 1px `--color--border--on-surface-0`, margin `4px 2px`.
- **Dropdown menu container.** `background:
  --color--surface--1`, `border: 1px solid
  --color--border--on-surface-1`, `border-radius: 8px`,
  `box-shadow: var(--shadow-lg)`, `padding: 4px`.

Existing reusable primitives inside the chat composer:
`DropdownPill<T>` (single-level), `SkillPillButton`,
`ModelPickerPill` (two-level provider → model), `BranchSwitcherPill`,
`OpenProjectMenu`.

---

## 7. Empty states and placeholders

- Use `--color--text--muted` for the copy.
- 11-12px font-size.
- Centered or left-aligned with comfortable padding (12-24px).
- Never show raw technical strings (port numbers, process PIDs, MCP
  protocol details). Human-readable only.

---

## 8. Interaction feedback

- **Transition duration:** 120ms for color/background/border changes,
  160ms for layout transitions (collapse, slide).
- **Focus ring:** `outline: 2px solid var(--color--outline--focus)`,
  `outline-offset: 1px`. Applied via `:focus-visible` on all
  interactive primitives.
- **Disabled state:** `opacity: 0.5; cursor: not-allowed`. Already
  applied to `.oc-btn`, `.oc-input`, and the legacy button classes
  listed in `app-shell.css` Pass 5 normalization.

---

## 9. Hard constraints (don't break these)

1. **Never modify `src/styles/variables.css`.** The design tokens are
   fixed. Use them; don't add new ones, don't change values.
2. **Never hardcode colors.** Every `background:`, `color:`, `border:`
   must reference a token or a rgba() tint of white (for hover). The
   only allowed rgba() uses are the hover/active tints
   (`rgba(255,255,255,0.03)` and `rgba(255,255,255,0.06)`) and the
   status-color alpha backgrounds (`rgba(37,99,235,0.12)` etc).
3. **Never introduce a new button/input/card variant.** Use the
   existing primitives. If truly new, extend the primitive's variant
   list with a `--new-variant` modifier and document it here.
4. **Never use `px` values off the spacing/radius scales.**
5. **Never use font-sizes off the type scale.**
6. **Never break HMR.** The engine's `injectStyles` handler accepts
   HMR updates in place — don't add `overflow: hidden` to any
   composer-like container that needs dropdowns to escape.

---

## 10. Before you commit

Run this checklist on every UI change:

- [ ] Surface tokens used — no hex bg/borders.
- [ ] Font-sizes match the scale.
- [ ] Paddings / gaps / radii match the scales.
- [ ] Icons at 14/16/18 (or 12 for micro in pills).
- [ ] New dropdowns have click-outside + Esc dismiss.
- [ ] Container does not clip the dropdown (no `overflow: hidden`).
- [ ] Focus-visible and disabled states read like the rest of the
      app.
- [ ] No regression in Col 1 / Col 2 / Col 3 chrome alignment (same
      tone, same border seam).
- [ ] If you deleted a legacy class, grep the repo for remaining
      references.

---

## 11. Reference commits (for pattern examples)

- Pass 1 surface unification: `f951eff`
- Pass 2 type scale: `9ae0d80`
- Pass 3 spacing/radius: `6863bdc`
- Pass 4 settings-into-shell: `241132d`
- Pass 5 primitive vocabulary: `c3c915c`
- Col 3 AI removal: `6cd1c1c`
- Project-grouping prominence: `ece2ff3`
- Chat composer dropdowns wired (Effort + Permission): `3849781`

When in doubt, look at how these commits shaped the codebase — not at
older commits, which predate the design system.
