// ──────────────────────────────────────────────────────────
// Theme Mode Panel — Right sidebar for color token inspection
// ──────────────────────────────────────────────────────────
//
// Shows when themeMode is active. Two sections:
//   A. Token Palette — all color tokens from loaded theme files
//   B. Changes List — tracked color changes with numbered markers
//   C. Footer — Copy Prompt button
//
// ──────────────────────────────────────────────────────────

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  X,
  Palette,
  Send,
  Check,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { useWorkspace, type DesignToken, type ThemeChangeItem } from "../store/store";
import { copyToClipboard } from "../utils/clipboard";
import { ScrollArea } from "../ui/scroll-area";
import { applyStyle, getElementById } from "../inspector";

export function ThemeModePanel() {
  const { state, dispatch } = useWorkspace();
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  // ── All color tokens from loaded theme files ──
  const colorTokens = useMemo(() => {
    const tokens: { name: string; value: string; group: string }[] = [];
    for (const file of state.themes.files) {
      for (const token of file.tokens) {
        if (token.syntax !== "color") continue;
        const defaultTheme = file.themes.find((t) => t.isDefault) || file.themes[0];
        const value = defaultTheme ? token.values[defaultTheme.id] : Object.values(token.values)[0];
        if (value) {
          tokens.push({ name: token.name, value, group: token.group });
        }
      }
    }
    return tokens;
  }, [state.themes.files]);

  // ── Filter tokens by search ──
  const filteredTokens = useMemo(() => {
    if (!search) return colorTokens;
    const q = search.toLowerCase();
    return colorTokens.filter(
      (t) => t.name.toLowerCase().includes(q) || t.value.toLowerCase().includes(q) || t.group.toLowerCase().includes(q)
    );
  }, [colorTokens, search]);

  // ── Group tokens ──
  const groups = useMemo(() => {
    const map = new Map<string, typeof colorTokens>();
    for (const t of filteredTokens) {
      const arr = map.get(t.group) || [];
      arr.push(t);
      map.set(t.group, arr);
    }
    return map;
  }, [filteredTokens]);

  // ── Remove change (revert inline style) ──
  const handleRemoveChange = useCallback((change: ThemeChangeItem) => {
    const el = getElementById(change.elementId) as HTMLElement | null;
    if (el) {
      el.style.removeProperty(change.property);
    }
    dispatch({ type: "REMOVE_THEME_CHANGE", id: change.id });
  }, [dispatch]);

  // ── Clear all changes ──
  const handleClearAll = useCallback(() => {
    for (const change of state.themeChanges) {
      const el = getElementById(change.elementId) as HTMLElement | null;
      if (el) el.style.removeProperty(change.property);
    }
    dispatch({ type: "CLEAR_THEME_CHANGES" });
  }, [state.themeChanges, dispatch]);

  // ── Copy prompt ──
  const handleCopyPrompt = useCallback(() => {
    if (state.themeChanges.length === 0) return;

    const lines: string[] = [];
    lines.push(`# 0canvas Theme Changes (${state.themeChanges.length} items)`);
    lines.push("");
    lines.push("Apply these design token changes to the source code.");
    lines.push("Use the var() form in stylesheets, not the resolved hex value.");
    lines.push("");
    lines.push("## Changes");
    lines.push("");

    state.themeChanges.forEach((change, i) => {
      const cssRule = change.originalSourceSelector || change.elementSelector;
      lines.push(`### ${i + 1}. \`${cssRule}\` — ${change.property}`);
      lines.push(`- **CSS Rule:** \`${cssRule}\``);
      lines.push(`- **Element:** \`${change.elementSelector}\``);
      lines.push(`- **Property:** \`${change.property}\``);
      if (change.originalTokenChain.length > 0) {
        lines.push(`- **Original:** \`var(${change.originalTokenChain[0]})\` → \`${change.originalValue}\``);
      } else {
        lines.push(`- **Original:** \`${change.originalValue}\``);
      }
      lines.push(`- **Replace with:** \`var(${change.newToken})\` → \`${change.newValue}\``);
      lines.push(`- **Tag:** ${change.elementTag} | **Classes:** ${change.elementClasses.join(", ") || "(none)"}`);
      lines.push("");
    });

    lines.push("## Instructions");
    lines.push("Find each element by its selector and replace the CSS property value with the new design token.");
    lines.push("Use the `var()` form (e.g., `var(--blue-600)`) in the source code, not the resolved hex value.");

    copyToClipboard(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [state.themeChanges]);

  const hasChanges = state.themeChanges.length > 0;
  const hasTokens = colorTokens.length > 0;

  return (
    <div className="oc-panel oc-theme-mode-panel">
      {/* Header */}
      <div className="oc-panel-header">
        <div className="oc-theme-mode-header-info">
          <Palette size={14} />
          <span>Theme Mode</span>
        </div>
        {hasChanges && (
          <span className="oc-theme-mode-badge">{state.themeChanges.length}</span>
        )}
      </div>

      <ScrollArea className="oc-theme-mode-body">
        {/* Token Palette */}
        <div className="oc-theme-mode-section">
          <div className="oc-theme-mode-section-title">Color Tokens</div>

          {hasTokens ? (
            <>
              <div className="oc-theme-mode-search">
                <Search size={12} />
                <input
                  placeholder="Search tokens..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  spellCheck={false}
                />
                {search && (
                  <button className="oc-theme-mode-search-clear" onClick={() => setSearch("")}>
                    <X size={10} />
                  </button>
                )}
              </div>

              <div className="oc-theme-mode-token-list">
                {[...groups.entries()].map(([group, tokens]) => (
                  <div key={group}>
                    <div className="oc-theme-mode-group-label">{group}</div>
                    {tokens.map((token) => (
                      <div key={token.name} className="oc-theme-mode-token-row" title={`${token.name}: ${token.value}`}>
                        <span
                          className="oc-theme-mode-token-swatch"
                          style={{ background: token.value }}
                        />
                        <span className="oc-theme-mode-token-name">{token.name}</span>
                        <span className="oc-theme-mode-token-value">{token.value}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="oc-theme-mode-empty">
              <div className="oc-theme-mode-empty-text">
                No color tokens loaded. Add a CSS file on the Themes page first.
              </div>
              <button
                className="oc-theme-mode-empty-btn"
                onClick={() => dispatch({ type: "SET_ACTIVE_PAGE", page: "themes" })}
              >
                Go to Themes
              </button>
            </div>
          )}
        </div>

        {/* Changes List */}
        <div className="oc-theme-mode-section">
          <div className="oc-theme-mode-section-header">
            <div className="oc-theme-mode-section-title">Changes</div>
            {hasChanges && (
              <button className="oc-theme-mode-clear-btn" onClick={handleClearAll}>
                Clear All
              </button>
            )}
          </div>

          {hasChanges ? (
            <div className="oc-theme-mode-change-list">
              {state.themeChanges.map((change, i) => (
                <div key={change.id} className="oc-theme-mode-change-row">
                  <span className="oc-theme-mode-change-num">{i + 1}</span>
                  <div className="oc-theme-mode-change-info">
                    <div className="oc-theme-mode-change-selector">{change.originalSourceSelector || change.elementSelector}</div>
                    <div className="oc-theme-mode-change-detail">
                      <span className="oc-theme-mode-change-prop">{change.property}</span>
                      <span
                        className="oc-theme-mode-token-swatch is-small"
                        style={{ background: change.originalValue }}
                      />
                      <ArrowRight size={10} style={{ color: "var(--color--text--disabled)", flexShrink: 0 }} />
                      <span
                        className="oc-theme-mode-token-swatch is-small"
                        style={{ background: change.newValue }}
                      />
                      <span className="oc-theme-mode-change-token">{change.newToken}</span>
                    </div>
                  </div>
                  <button
                    className="oc-theme-mode-change-remove"
                    onClick={() => handleRemoveChange(change)}
                    title="Revert"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="oc-theme-mode-empty-text is-small">
              Click elements to inspect and change their colors.
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer: Send */}
      {hasChanges && (
        <div className="oc-theme-mode-footer">
          <button className="oc-theme-mode-send-btn" onClick={handleCopyPrompt}>
            {copied ? <Check size={14} /> : <Send size={14} />}
            {copied ? "Copied!" : `Copy Prompt (${state.themeChanges.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
