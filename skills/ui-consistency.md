---
name: UI Consistency
description: Rules and constraints for making any UI change in Zeros consistent with the Cursor 3 Agents Window design system. Read this BEFORE writing any UI code.
icon: Palette
---

You are the UI-consistency skill for Zeros. Zeros is an IDE modelled visually on the **Cursor 3 "Glass" / Agents Window**. Every UI change you make — in `src/shell/**`, `src/app-shell.tsx`, `src/zeros/**`, or any CSS file — must obey these rules.

**Read `RULES.md` first, pick the correct tokens and primitives, and only then write code. Never invent new values.**

---

## 0. The non-negotiables

1. **One token file.** `src/styles/design-tokens.css` is the single source of truth for every color, size, space, radius, shadow, duration, and z-index. You never create a second token file. You never put a raw value in a component that could have come from a token.
2. **Semantic tokens only.** In components you reference `--surface-0`, `--text-on-surface`, `--primary`, `--radius-sm`, `--space-4`, `--text-12`, `--dur-fast`, `--z-dropdown`. You never reference a primitive token (`--grey-900`, `--blue-500`) outside `design-tokens.css`.
3. **Primitives first.** For any visual element you import from `@/Zeros/ui` (`Button`, `Input`, `DropdownMenu`, `Card`, `Tabs`, `Dialog`, `Tooltip`, `Badge`, `Pill`, `StatusDot`, `Kbd`, `Divider`, `Icon`). If the variant you need doesn't exist, extend the primitive in `src/zeros/ui/` — never write per-feature CSS.
4. **`className` for layout only.** Tailwind utility classes allowed only for layout (`flex`, `gap-*`, `items-*`, `max-w-*`, `truncate`, `size-*`). Never color, typography, or spacing that bypasses tokens.
5. **No inline visual `style={{}}`.** Allowed only for truly dynamic values (a swatch colour from user data, a runtime rect position, a drag-resize width).
6. **No numeric z-index** in components. Use the token or let the primitive own it.

---

## 1. Cursor 3 visual language reference

When in doubt about *how* something should look, pull up a Cursor 3 Agents Window reference and match these qualities:

| Aspect | Target |
|---|---|
| Density | Dense, everything compact — 28px default controls, 13px body, 11px metadata |
| Tones | Three surfaces: floor (chrome) → 0 (body) → 1 (cards/menus) → 2 (selected) |
| Accent | Single blue, used only for run/active/selected/focus. **< 5% of pixels** |
| Seams | 1px subtle border between regions. Never a tone step |
| Hover | A 3-5% white tint on top of the surface. Never a full background swap |
| Radii | 4 / 6 / 8 / 12 / pill only. 6px is default |
| Font | System stack — `-apple-system, BlinkMacSystemFont, "SF Pro Text", ...`. Never Inter/web fonts |
| Motion | 120ms default. Subtle, never jumpy |
| Chrome | TitleBar (36px) + ActivityBar (48px) + Col 1 + Col 2 + Col 3 + StatusBar (22px) |
| Icons | 14px for inline next to 13px text, 16px in nav |

---

## 2. Surface hierarchy — what background goes where

| Role | Token | Examples |
|---|---|---|
| Chrome (titlebar, activitybar, statusbar, tab bars) | `var(--surface-floor)` | `.oc-titlebar`, `.oc-activitybar`, `.oc-statusbar`, Col 2 tab bar |
| Main body (canvas, page content, sidebar body) | `var(--surface-0)` | Col 3 canvas, settings body, sidebar list area |
| Elevated (cards, inputs, menus, row hover targets) | `var(--surface-1)` | `<Card>`, `<Input>`, `DropdownMenu.Content`, hover state carrier |
| Emphasis (selected tab, active chip) | `var(--surface-2)` | `data-active="true"` tab, pressed button |

**Pairing rule:** element on `--surface-0` uses `--border-subtle`; on `--surface-1` uses `--border-default`; on `--surface-2` uses `--border-strong`.

---

## 3. Type scale — the only allowed text sizes

| Size | Role | Weight | Example |
|---|---|---|---|
| `--text-10` (10px) | Overline, badges, tiny labels (uppercase, 0.05em tracking) | 600 | `<Badge>` |
| `--text-11` (11px) | Metadata, timestamps, hints | 400-500 | status bar, timestamps |
| `--text-12` (12px) | Controls: buttons, tabs, menu items, chips | 500 | `<Button>`, `<Tab>`, `<DropdownMenu.Item>` |
| `--text-13` (13px) | Body: list rows, default readable text | 400 | list rows, descriptions |
| `--text-15` (15px) | Panel titles, card headings | 600 | `<Card>` title, dialog title |
| `--text-18` (18px) | Page titles (settings only) | 600 | Settings h1 |

**Banned text sizes**: 9, 14, 16. Snap to the scale.

---

## 4. Space & radius

**Space (padding / gap / margin):** ONLY even values, and only from `--space-1` (2px) through `--space-12` (24px). Never 3, 5, 7, 9, 11, 13, 15.

**Radius:** ONLY `--radius-xs` (4), `--radius-sm` (6, DEFAULT), `--radius-md` (8), `--radius-lg` (12), `--radius-pill`, `--radius-circle`. Never 2, 3, 5, 7, 10, 14.

---

## 5. Primitives vocabulary — REQUIRED for new components

```tsx
import {
  Button, Input, Textarea, Label, Kbd, Badge, StatusDot, Divider, Pill,
  Card, CardHeader, CardBody, CardFooter,
  Tabs, Tab,
  DropdownMenu,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter,
  Tooltip, Icon,
} from "@/Zeros/ui";
```

Example (a chat composer pill with a model dropdown):

```tsx
<DropdownMenu>
  <DropdownMenu.Trigger asChild>
    <Pill><Sparkles size={12} />Claude 4.6 <ChevronDown size={10} /></Pill>
  </DropdownMenu.Trigger>
  <DropdownMenu.Content side="top" align="start">
    <DropdownMenu.Label>Providers</DropdownMenu.Label>
    <DropdownMenu.Item selected>Claude Sonnet 4.6</DropdownMenu.Item>
    <DropdownMenu.Item>GPT-5.4</DropdownMenu.Item>
    <DropdownMenu.Separator />
    <DropdownMenu.Label>Local</DropdownMenu.Label>
    <DropdownMenu.Item>Llama 3 70B</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu>
```

**Existing per-feature classes** (`.oc-toolbar-btn`, `.oc-chat-iconbtn`, `.oc-git__btn`, etc.) are deprecated. When you touch a component, migrate its JSX to the primitives above and delete the per-feature CSS.

---

## 6. Dropdowns, menus, overlays

The `<DropdownMenu>` primitive already handles:

- Direction-aware placement (`side="top|bottom"`, `align="start|end"`)
- Max-height + internal scroll (60vh cap)
- Click-outside + Escape dismissal
- z-index ownership (`--z-dropdown`)
- Focus management

You should NEVER write a bespoke `useState(open)` + positioned `<div>` dropdown again. Use the primitive. If it can't do what you need, extend it.

---

## 7. Empty states and placeholders

- Copy color: `var(--text-muted)`
- Size: 11-12px
- Centered or left-aligned with 12-24px padding
- No technical strings (PIDs, raw URLs, error codes). Human copy.

---

## 8. Interaction feedback

- Transition duration: `var(--dur-fast)` (120ms) for color/bg/border, `var(--dur-base)` (160ms) for layout
- Easing: `var(--ease-standard)` unless dialogs → `var(--ease-emphasized)`
- Focus ring: `outline: 2px solid var(--ring); outline-offset: 1px;` applied via `:focus-visible`
- Disabled: `opacity: 0.5; cursor: not-allowed;` — already on every primitive

---

## 9. Before you commit — checklist

- [ ] Surface tokens used, no hex bg / borders
- [ ] Font sizes on the scale (10/11/12/13/15/18 only)
- [ ] Paddings, gaps, radii on the scale
- [ ] Every interactive element uses a primitive from `@/Zeros/ui`
- [ ] No inline `style={{}}` with static visuals
- [ ] No numeric `z-index` in components
- [ ] Container doesn't clip the dropdown (`overflow: hidden` on dropdown-host is forbidden)
- [ ] Focus-visible and disabled states read like the rest of the app
- [ ] `pnpm check:ui` passes
- [ ] `pnpm build:ui` compiles

---

## 10. Hard don'ts

1. **Never** add a new hex color anywhere except `design-tokens.css`.
2. **Never** use a Tailwind color class (`bg-blue-500`, `text-red-600`, …).
3. **Never** import `Inter` or any other web font. The system stack is deliberate.
4. **Never** write a per-feature button / input / card class. Use primitives.
5. **Never** set `z-index: <number>` in a component.
6. **Never** use `font-size: 9|14|16`. Banned.
7. **Never** inline `style={{ color, background, padding, margin, fontSize, border, borderRadius }}` for static visuals.

---

## 11. If you're about to add a token

STOP. Ask a human. 99% of the time the token you want already exists under a semantic name in `design-tokens.css`. The 1% of the time you genuinely need a new token, it goes in `design-tokens.css` with an inline comment explaining when to use it, and the `RULES.md` Quick Decision Table is updated in the same commit.
