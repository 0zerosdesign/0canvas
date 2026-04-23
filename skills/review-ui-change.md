---
name: Review UI Change
description: Reviewer checklist for any PR that touches UI files in Zeros. Use this skill when doing code review on `src/shell/**`, `src/app-shell.tsx`, `src/zeros/**`, or any CSS file.
icon: ShieldCheck
---

You are the review-ui-change skill. Your job is to catch visual drift before it lands. Run through this checklist mechanically. If any item fails, leave a blocking comment with the fix.

---

## 1. Token discipline

- [ ] No new hex colors outside `styles/tokens.css`. Run `rg '#[0-9a-fA-F]{3,8}' src/ | rg -v 'design-tokens\.css'` — should be empty (allowing for legit dynamic color swatches sourced from user data only).
- [ ] No raw `rgba(` outside `tokens.css` (the documented `--tint-*` tokens are the only allowed ones).
- [ ] No primitive tokens (`--grey-*`, `--blue-*`, `--green-*`, etc.) referenced from component code.
- [ ] No Tailwind color classes (`bg-(red|blue|green|gray|zinc|neutral)-\d+`, `text-...-\d+`, `border-...-\d+`).
- [ ] No `font-family` naming a web font (`"Inter"`, `"Roboto"`, `"IBM Plex"`). All text uses `var(--font-ui)` or `var(--font-mono)`.

## 2. Scale discipline

- [ ] Every `font-size: Npx` has `N ∈ {10, 11, 12, 13, 15, 18}`.
- [ ] Every `border-radius: Npx` has `N ∈ {4, 6, 8, 12}` (or `9999px`, or `50%`).
- [ ] Every `gap: Npx` / `padding: Npx` / `margin: Npx` uses an even value (2, 4, 6, 8, 10, 12, 14, 16, 20, 24). Never 3, 5, 7, 9, 11, 13, 15.

## 3. Primitive discipline

- [ ] Every new `<button>` / `<input>` / `<textarea>` / menu / card / dialog is a primitive from `@/Zeros/ui`, not a raw HTML element styled inline.
- [ ] No per-feature button class has been added (no new `.oc-*-btn`, `.oc-*-input`, `.oc-*-card`).
- [ ] If a variant was needed that doesn't exist, it was added to the primitive in `/src/zeros/ui/`, not inline-styled in the feature file.

## 4. Inline-style discipline

- [ ] No `style={{` containing `color`, `background`, `padding`, `margin`, `fontSize`, `fontWeight`, `fontFamily`, `border`, `borderRadius`, `boxShadow`, `zIndex` for STATIC values.
- [ ] Inline `style={{}}` is used ONLY for: runtime rect positioning, drag-resize width/height, user-sourced swatch colour.

## 5. z-index discipline

- [ ] No numeric `z-index` in component files. Overlays use `<DropdownMenu>`, `<Dialog>`, `<Tooltip>`, `<Popover>` which own the layer.

## 6. Layout discipline

- [ ] `className` on non-primitive elements contains Tailwind layout utilities only (`flex`, `gap-*`, `items-*`, `justify-*`, `max-w-*`, `size-*`, `truncate`, `overflow-*`). No color, typography, or spacing override.
- [ ] Chrome between columns uses `1px solid var(--border-subtle)`, never a tone step.

## 7. Cursor density

- [ ] Controls are ≤ 32px tall (the `--h-control-lg` cap). Onboarding heroes may exceed.
- [ ] Body text is 13px (`--text-13`). Metadata 11px. Controls 12px.
- [ ] Primary blue accent appears on **< 5%** of the screen — one button, one active tab underline, one focus ring at a time.
- [ ] Hover state is a subtle tint (`var(--tint-hover)` or `--tint-primary-soft`), not a full background swap.

## 8. Interaction polish

- [ ] Every interactive element has a visible `:focus-visible` state (2px outline, 1px offset, via `--ring`).
- [ ] Every dropdown / menu handles Escape and outside-click (should come for free from the primitive).
- [ ] Transitions use `var(--dur-fast)` for color and `var(--dur-base)` for layout — not `transition: all 0.3s`.

## 9. Automated guard

- [ ] CI ran `pnpm check:ui` and it passed.
- [ ] CI ran `pnpm build:ui` and it compiled clean.
- [ ] If the change touched `.ts`/`.tsx`, TypeScript compiled clean.

## 10. Documentation

- [ ] If a new primitive was added, RULES.md Rule 11 table was updated.
- [ ] If a new token was added, `tokens.css` has the inline comment explaining usage AND the RULES.md Quick Decision Table was updated.

---

## How to leave a blocking comment

Point at the exact line and say:

> This violates RULES.md Rule 14 (no inline visual styles). Replace `style={{ color: "#aaa" }}` with either a primitive (`<Badge variant="default">`) or move the rule to a class that references `var(--text-muted)`.

Always name the rule number. Always give the fix.
