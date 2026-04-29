// ──────────────────────────────────────────────────────────
// DevThemeTester — bottom-right floating theme controls
// ──────────────────────────────────────────────────────────
//
// Zeros Dev only. Mounted from AppShell behind `import.meta.env.DEV`,
// which is true under `pnpm electron:dev` (Vite dev server) and
// false in `pnpm build:ui` output (packaged Zeros). That mapping is
// 1:1 with the IS_DEV / IS_PACKAGED runtime check in electron/main.ts,
// so the button only appears in the "Zeros Dev" binary.
//
// Two states, same anchor (bottom-right corner of the viewport):
//   - collapsed → 36px round button with a Palette glyph
//   - expanded  → 280px popover with the same controls as the
//                 Settings → Appearance panel (mode + hue +
//                 intensity + accent + reduce transparency)
//
// We don't reuse <AppearancePanel/> because that one is built for a
// scrollable settings page (full-width cards, big copy). The tester
// is a compact, on-page utility — same controls, denser layout.
// All controls write through useAppearance().setPrefs(), so changes
// are applied + persisted instantly on whatever screen you're on.
// ──────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { Palette, X } from "lucide-react";
import { useAppearance } from "../zeros/appearance/provider";
import { type ThemeMode } from "../zeros/appearance/prefs";

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string }> = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "high-contrast", label: "HC" },
];

export function DevThemeTester() {
  const { prefs, setPrefs } = useAppearance();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside + Escape to dismiss the popover. We don't use a
  // backdrop because the user explicitly didn't want a modal feel —
  // the popover sits over content but never blocks interaction.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const intensityPct = Math.round(prefs.intensity * 100);

  return (
    <div ref={rootRef} className="oc-dev-theme-tester">
      {open ? (
        <div
          className="oc-dev-theme-tester__panel"
          role="dialog"
          aria-label="Theme tester"
        >
          <div className="oc-dev-theme-tester__header">
            <span className="oc-dev-theme-tester__title">
              Theme tester
              <span className="oc-dev-theme-tester__badge">DEV</span>
            </span>
            <button
              type="button"
              className="oc-dev-theme-tester__close"
              onClick={() => setOpen(false)}
              aria-label="Close theme tester"
            >
              <X size={14} />
            </button>
          </div>

          <div className="oc-dev-theme-tester__body">
            <label className="oc-dev-theme-tester__field">
              <span className="oc-dev-theme-tester__label">Theme</span>
              <div className="oc-dev-theme-tester__seg">
                {THEME_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`oc-dev-theme-tester__seg-item${
                      prefs.mode === opt.value ? " is-active" : ""
                    }`}
                    onClick={() => setPrefs({ mode: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </label>

            <label className="oc-dev-theme-tester__field">
              <span className="oc-dev-theme-tester__label">
                Hue
                <span className="oc-dev-theme-tester__value">
                  {Math.round(prefs.hue)}°
                </span>
              </span>
              <div className="oc-dev-theme-tester__row">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={prefs.hue}
                  onChange={(e) => setPrefs({ hue: Number(e.target.value) })}
                  className="oc-appearance-slider oc-appearance-slider--hue"
                  aria-label="Tint hue"
                />
                <span
                  className="oc-appearance-swatch"
                  style={{ background: "var(--zeros-tint-color)" }}
                  aria-hidden
                />
              </div>
            </label>

            <label className="oc-dev-theme-tester__field">
              <span className="oc-dev-theme-tester__label">
                Intensity
                <span className="oc-dev-theme-tester__value">{intensityPct}%</span>
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={intensityPct}
                onChange={(e) =>
                  setPrefs({ intensity: Number(e.target.value) / 100 })
                }
                className="oc-appearance-slider"
                aria-label="Tint intensity"
              />
            </label>

            <label className="oc-dev-theme-tester__field">
              <span className="oc-dev-theme-tester__label">
                Accent
                <span className="oc-dev-theme-tester__value">
                  {Math.round(prefs.accent)}°
                </span>
              </span>
              <div className="oc-dev-theme-tester__row">
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={prefs.accent}
                  onChange={(e) =>
                    setPrefs({ accent: Number(e.target.value) })
                  }
                  className="oc-appearance-slider oc-appearance-slider--hue"
                  aria-label="Brand accent hue"
                />
                <span
                  className="oc-appearance-swatch"
                  style={{ background: "var(--zeros-accent)" }}
                  aria-hidden
                />
              </div>
            </label>

            <label className="oc-dev-theme-tester__check">
              <input
                type="checkbox"
                checked={prefs.reduceTransparency}
                onChange={(e) =>
                  setPrefs({ reduceTransparency: e.target.checked })
                }
              />
              <span>Reduce transparency</span>
            </label>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="oc-dev-theme-tester__trigger"
          onClick={() => setOpen(true)}
          title="Theme tester (Zeros Dev only)"
          aria-label="Open theme tester"
        >
          <Palette size={16} />
        </button>
      )}
    </div>
  );
}
