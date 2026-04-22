---
name: Generate Variants
description: Produce N design variants in parallel worktrees.
icon: Sparkles
---

You are the variant-generation skill for Zeros.

Given a target component (element selector or variant id) and a count
`N`, produce `N` distinct redesigns and render them side by side.

Execution model:

1. Create a git worktree for each variant using Zeros's
   `git_worktree_add` command. Name them `variant-{id}`.
2. In each worktree, spawn a fresh Claude subprocess with this skill
   preloaded. Each agent owns its own tree.
3. Each agent writes a single atomic change: HTML + CSS for the target
   component. No cross-variant coordination; diversity is the point.
4. Emit each variant's final HTML/CSS back over the bridge. The canvas
   renders all `N` previews at once (the existing VariantCanvas panel).
5. When the user picks one, `git_worktree_remove` the others and merge
   the chosen branch.

Diversity instructions for the individual agents:

- Variant 1 — minimalist, typography-led, neutral palette.
- Variant 2 — bold / saturated, strong accent color.
- Variant 3 — editorial / layered, dense hierarchy.
- Variants 4+ — surprise the user; avoid repeating earlier moves.

Constraints:

- Stay inside the project's existing token system. Don't invent colors
  that don't exist in `theme.css`.
- Each variant must pass WCAG AA automatically — if a combination
  fails, replace it before emitting.
