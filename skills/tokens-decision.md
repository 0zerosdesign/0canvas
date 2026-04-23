---
name: Tokens Decision
description: Decision tree for picking the correct semantic token when you need a color, size, space, radius, or motion value. Prevents invention of new tokens.
icon: Compass
---

You are the tokens-decision skill. Your only job is to map a UI need to the correct semantic token in `styles/tokens.css`. Walk the tree top-down; pick the first match.

---

## "I need a background"

1. Is this the **title bar / activity bar / status bar / command-palette backdrop**?
   → `var(--surface-floor)`
2. Is this the **main body** of the app (editor, canvas, sidebar list, page content)?
   → `var(--surface-0)`
3. Is this an **elevated surface** (card, input, menu, dropdown, popover, row hover target)?
   → `var(--surface-1)`
4. Is this an **emphasis state** (selected tab, active chip, pressed button)?
   → `var(--surface-2)` OR `var(--tint-primary-soft)` (when the accent should show through)
5. Is this a **hover** on a default surface?
   → Layer `background: var(--tint-hover)` on top — don't swap the surface.

If none of these apply, STOP. You probably don't need a new background at all.

---

## "I need a text or icon color"

1. Is this **default body text**?
   → `var(--text-on-surface)`
2. Is this a **secondary label** (sitting inside a card header, a tab, a section label)?
   → `var(--text-on-surface-variant)`
3. Is this **metadata / placeholder / timestamp / hint**?
   → `var(--text-muted)`
4. Is this a **disabled element**?
   → `var(--text-disabled)` (never `opacity: 0.5` on text)
5. Is this text sitting on a **blue bg / primary button**?
   → `var(--primary-foreground)`
6. Is this a **link / active tab label / tag name**?
   → `var(--text-primary)` (hover: `var(--text-primary-light)`)
7. Is this a **success indicator**?
   → `var(--status-success)`
8. Is this an **error / destructive indicator**?
   → `var(--status-critical)`
9. Is this a **warning**?
   → `var(--status-warning)`

---

## "I need a border color"

1. **Subtle** (column seam, card edge, divider on `--surface-0`)?
   → `var(--border-subtle)`
2. **Default** (input edge, menu border on `--surface-1`)?
   → `var(--border-default)`
3. **Strong** (active input focus, emphasized separator)?
   → `var(--border-strong)`

**Pairing rule**: match border tier to the surface under it. On `--surface-0` use `--border-subtle`; on `--surface-1` use `--border-default`; on `--surface-2` use `--border-strong`.

---

## "I need an action / CTA color"

1. **Primary button background** → `var(--primary)`; hover → `var(--primary-hover)`; text → `var(--primary-foreground)`.
2. **Secondary button** → `<Button variant="secondary">` (uses `--surface-1`).
3. **Ghost button** → `<Button variant="ghost">` (transparent until hover).
4. **Destructive** → `<Button variant="destructive">` (uses `--destructive`).
5. **Focus ring** → `outline: 2px solid var(--ring); outline-offset: 1px;` via `:focus-visible`.

If you're about to draw an "accent gradient" or "glowing CTA", STOP. The Cursor aesthetic is flat.

---

## "I need a font-size"

ONLY these values exist:

1. **Overline / badge / tiny label** (uppercase, 0.05em tracking) → `var(--text-10)` @ weight 600
2. **Metadata, timestamps, hints** → `var(--text-11)` @ weight 400-500
3. **Controls** (buttons, tabs, menu items, chips) → `var(--text-12)` @ weight 500
4. **Body** (default readable text, list rows) → `var(--text-13)` @ weight 400
5. **Panel title, card heading** → `var(--text-15)` @ weight 600
6. **Page heading (settings only)** → `var(--text-18)` @ weight 600

If you want 9, 14, or 16, you are wrong. Snap to the scale.

---

## "I need a padding / gap"

Use ONLY `--space-1` (2) through `--space-12` (24), even values only:

- Icon ↔ label in a dense pill → `--space-1` (2px) or `--space-2` (4px)
- Tight gap, chip Y-padding → `--space-2` (4px)
- Default item gap → `--space-3` (6px)
- Section gap, card inner top/bot → `--space-4` (8px)
- Row padding Y, list item → `--space-5` (10px)
- Panel padding → `--space-6` (12px)
- Card padding → `--space-7` (14px)
- Dialog padding → `--space-8` (16px)
- Large dialog → `--space-10` (20px) or `--space-12` (24px)

---

## "I need a border-radius"

Pick the closest match:

1. Chips, badges, swatches → `var(--radius-xs)` (4px)
2. **Buttons, tabs, inputs, menu items** (DEFAULT) → `var(--radius-sm)` (6px)
3. Cards, menus, popovers → `var(--radius-md)` (8px)
4. Dialogs, command palette → `var(--radius-lg)` (12px)
5. Pills (branch chip, tag pill) → `var(--radius-pill)` (9999px)
6. Circles (status dots, avatars) → `var(--radius-circle)` (50%)

---

## "I need a control height"

1. Toolbar pills, dense chips, status-bar items → `var(--h-control-sm)` (24px)
2. **Default buttons, inputs, tab triggers** → `var(--h-control-md)` (28px)
3. Primary CTAs, large inputs, dialog buttons → `var(--h-control-lg)` (32px)

If you're about to type `height: 40px` for a control, STOP. Ask what you're really trying to emphasize — there's almost certainly a better way.

---

## "I need an icon size"

1. Caret / chevron inside a pill → 10px (`--icon-xs`) or `<Icon size="xs">`
2. Inline next to 11-12px text → 12px (`--icon-sm`) or `<Icon size="sm">`
3. **Inline next to 13px text (DEFAULT)** → 14px (`--icon-md`) or `<Icon size="md">`
4. Nav / activity bar / page title → 16px (`--icon-lg`) or `<Icon size="lg">`

---

## "I need a motion duration"

1. Color / background / border / opacity → `var(--dur-fast)` (120ms)
2. Layout (collapse, slide, expand) → `var(--dur-base)` (160ms)
3. Page or heavy modal transition → `var(--dur-slow)` (240ms)

Easing: `var(--ease-standard)` for default, `var(--ease-emphasized)` for dialogs.

**Never** write `transition: all 0.3s ease`. Be specific.

---

## "I need a z-index"

Never hardcode a number. Pick a layer token:

1. Chrome (titlebar, activitybar, statusbar) → `var(--z-chrome)` (5)
2. Floating panels → `var(--z-panel)` (10)
3. Dropdowns / menus / popovers → `var(--z-dropdown)` (25) — but the primitive already sets this
4. Dialogs / command palette → `var(--z-modal)` (100) — primitive sets this
5. Toasts → `var(--z-toast)` (200)

If you think you need a new layer, STOP. Ask whether the existing tokens are really insufficient.

---

## "I need a shadow"

1. Inputs, subtle cards on `--surface-0` → `var(--shadow-sm)`
2. Elevated cards on hover → `var(--shadow-md)`
3. Dropdowns, menus, popovers → `var(--shadow-lg)`
4. Dialogs, command palette → `var(--shadow-xl)`

---

## When nothing fits

If after walking this tree you genuinely cannot find a token for what you need:

1. Confirm you've checked ALL sections of `tokens.css`.
2. Ask a human reviewer whether the need is legitimate or whether the design needs to conform to existing tokens.
3. If it IS legitimate, add the token to `tokens.css` with:
   - A clear semantic name (`--X-Y` or `--X-Y-Z`)
   - An inline comment explaining when to use it (include a concrete example)
   - An update to `RULES.md` Quick Decision Table
   - An update to `skills/ui-consistency.md` if relevant

Never invent a token silently. Never put a value directly in a component "just this once".
