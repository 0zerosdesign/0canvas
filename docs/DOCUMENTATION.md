# Zeros — Documentation Index

> **⚠️ 2026-04-20 rewrite.** This file previously carried the full
> engine-era module reference (40KB); that content is now in
> [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md), which remains the
> authoritative engine-layer reference. This index is now a thin
> pointer to the right doc for the question you have.

---

## Start here

| If you want to understand... | Read |
|---|---|
| **What Zeros is** (current vision) | [PRODUCT_VISION_V3.md](PRODUCT_VISION_V3.md) |
| **How the Mac app is being built** (phase plan, what's shipped) | [TAURI_MAC_APP_PLAN.md](TAURI_MAC_APP_PLAN.md) |
| **How to run the app locally** | [TAURI_SETUP.md](TAURI_SETUP.md) |
| **The engine internals** (CSS resolver, selector index, inspector, canvas, panels) | [PROJECT_ANALYSIS.md](PROJECT_ANALYSIS.md) §1-10 |
| **Attribution / licenses** | [ATTRIBUTIONS.md](ATTRIBUTIONS.md) |
| **What was shipped or planned in the V1/V2 era (historical)** | [PRODUCT_VISION.md](PRODUCT_VISION.md) (V1) + [PRODUCT_VISION_V2.md](PRODUCT_VISION_V2.md) (V2) — both superseded |
| **A specific engine module** (inspector, style-panel, themes, etc.) | [context/](context/) subdirectory — one README per module |

---

## Doc map

```
docs/
├── DOCUMENTATION.md          ← you are here (index)
├── PRODUCT_VISION_V3.md      ← current product vision
├── PRODUCT_VISION_V2.md      ← SUPERSEDED (npm engine + overlay vision)
├── PRODUCT_VISION.md         ← SUPERSEDED (V1 — VS Code extension + overlay)
├── TAURI_MAC_APP_PLAN.md     ← execution plan, phase-by-phase, with status
├── TAURI_SETUP.md            ← developer environment setup
├── PROJECT_ANALYSIS.md       ← engine-layer reference (still current for Col 3)
├── ATTRIBUTIONS.md           ← open-source licenses
└── context/
    ├── ai-agents/
    │   ├── README.md
    │   └── inline-edit.md
    ├── bridge-communication/README.md
    ├── canvas-variants/README.md
    ├── extension/README.md
    ├── feedback/README.md
    ├── format-persistence/README.md
    ├── inspector/README.md
    ├── overlay/
    │   ├── README.md
    │   └── command-palette.md
    ├── responsive/README.md
    ├── settings/README.md
    ├── style-panel/
    │   ├── README.md
    │   ├── editors.md
    │   └── libraries.md
    ├── tailwind/  (empty — TODO)
    └── themes/README.md
```

---

## Where each code surface is documented

| Code surface | Primary doc |
|---|---|
| `src/app-shell.tsx`, `src/shell/` (Col 1, Col 2 panels) | V3 §2-4 (gap: no per-module doc yet — see V3 TODO) |
| `src/zeros/engine/` (engine shell + styles) | PROJECT_ANALYSIS.md §5 |
| `src/zeros/canvas/` (variant canvas) | `context/canvas-variants/` |
| `src/zeros/inspector/` | `context/inspector/` |
| `src/zeros/panels/style-panel.tsx` | `context/style-panel/` |
| `src/zeros/themes/` | `context/themes/` |
| `src/zeros/bridge/` | `context/bridge-communication/` |
| `src/zeros/format/` | `context/format-persistence/` |
| `src/engine/` (npm engine backend) | V2 §3-4 (still accurate for the npm channel) |
| `src-tauri/src/` (Rust backend) | V3 §7 |
| `src/native/` (Tauri JS bridge) | *no doc yet* — see V3 TODO |
| `skills/*.md` | V3 §9 |

---

## Status snapshot (2026-04-20)

- **Phase 0, 1A, 1B, 1C, 2:** shipped to `main`.
- **Phase 3:** partial (git2-rs shipped; clone/worktrees/PR/conflict-UX pending).
- **Phase 4:** WIP merged to `main` (AI CLI bridge + Skills + Mission Control).
- **Passes 1-5 (design system lock-in):** shipped 2026-04-20.
- **Phase 5 (signed distribution):** not started; gated on Streams 2-5.

Full roadmap in [TAURI_MAC_APP_PLAN.md](TAURI_MAC_APP_PLAN.md) and
[PRODUCT_VISION_V3.md §13](PRODUCT_VISION_V3.md#13-roadmap--where-we-actually-are).

---

## TODO

- [ ] Add a `context/shell/` module doc covering `src/shell/` (the
      Tauri shell — Col 1 nav, Col 2 tabs, and their panel
      components). This is the biggest docs gap.
- [ ] Add a `context/rust-backend/` module doc mirroring V3 §7 with
      per-Tauri-command descriptions.
- [ ] Add a `context/native-bridge/` module doc covering
      `src/native/` (settings.ts, secrets.ts, storage.ts, events).
- [ ] The `context/tailwind/` directory is empty — either populate
      it with the Tailwind class-writer docs or remove it.
- [ ] Each `context/*/README.md` should carry a ✅/🚧/⏳ status
      badge and note whether the module lives in the engine, the
      shell, or both. See Stream 1.5 in
      [PRODUCT_VISION_V3.md §15](PRODUCT_VISION_V3.md#15-todo--fine-tuning-needed).
- [ ] A single `CONTRIBUTING.md` (not yet created) covering
      commit-message conventions, how to run each test, the Pass 1-5
      design-system rules, and the primitive-migration pattern from
      Pass 5.
