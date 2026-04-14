// ──────────────────────────────────────────────────────────
// Themes Page — Full-page design token table editor
// ──────────────────────────────────────────────────────────
//
// Features:
//   - CSS file selection via File System Access API
//   - Design token extraction with syntax detection
//   - Multi-theme columns (Default, Light, etc.)
//   - Color picker for color tokens
//   - Variable detail panel (name, syntax, description, inherits)
//   - Multi-select with batch rename/delete
//   - Search/filter
//   - Paste CSS variables
//   - Two-way sync with the source CSS file
//   - Groups by token prefix
//
// ──────────────────────────────────────────────────────────

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  MoreHorizontal,
  Trash2,
  ClipboardPaste,
  FileCode,
  X,
  Check,
  ChevronDown,
  RefreshCw,
  Pencil,
  GripVertical,
  Copy,
} from "lucide-react";
import { useWorkspace, type DesignToken, type ThemeColumn, type ThemeFile, type TokenSyntax } from "../store/store";
import { parseCSSTokens, applyTokensToSource, parsePastedCSS, detectSyntax } from "./css-token-parser";
import { ColorPicker } from "./color-picker";
import { ScrollArea } from "../ui/scroll-area";

// ── File picker ──────────────────────────────────────────

async function pickCSSFile(): Promise<{ handle: FileSystemFileHandle; content: string; name: string } | null> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description: "CSS files", accept: { "text/css": [".css"] } }],
      multiple: false,
    });
    const file = await handle.getFile();
    const content = await file.text();
    return { handle, content, name: file.name };
  } catch {
    return null; // user cancelled
  }
}

async function writeToFile(handle: FileSystemFileHandle, content: string): Promise<boolean> {
  try {
    const writable = await (handle as any).createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

// ── Syntax icon ──────────────────────────────────────────

const SYNTAX_LABELS: Record<TokenSyntax, string> = {
  color: "Color",
  "length-percentage": "Length",
  percentage: "%",
  number: "123",
  angle: "Angle",
  time: "Time",
  "*": "*",
};

function SyntaxBadge({ syntax }: { syntax: TokenSyntax }) {
  return <span className="oc-theme-syntax-badge" data-syntax={syntax}>{SYNTAX_LABELS[syntax]}</span>;
}

// ── Color swatch ─────────────────────────────────────────

function ColorSwatch({ color }: { color: string }) {
  const isColor = /^#|^rgb|^hsl|^var\(--.*color|^var\(--.*surface|^var\(--.*bg|^var\(--.*text|^var\(--.*border/i.test(color);
  if (!isColor) return null;
  return (
    <span
      className="oc-theme-color-swatch"
      style={{ background: color.startsWith("var(") ? undefined : color }}
      title={color}
    />
  );
}

// ── Token value cell ─────────────────────────────────────

function TokenValueCell({
  token,
  themeId,
  fileId,
}: {
  token: DesignToken;
  themeId: string;
  fileId: string;
}) {
  const { dispatch } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(token.values[themeId] || "");
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const value = token.values[themeId] || "";

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const commit = () => {
    if (localValue !== value) {
      dispatch({ type: "UPDATE_TOKEN_VALUE", fileId, tokenName: token.name, themeId, value: localValue });
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { setLocalValue(value); setEditing(false); }
  };

  return (
    <div className="oc-theme-value-cell" data-syntax={token.syntax}>
      {token.syntax === "color" && (
        <span
          className="oc-theme-color-swatch is-clickable"
          style={{ background: value.startsWith("var(") ? undefined : value }}
          onClick={() => setColorPickerOpen(!colorPickerOpen)}
        />
      )}

      {editing ? (
        <input
          ref={inputRef}
          className="oc-theme-value-input"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          autoFocus
          spellCheck={false}
        />
      ) : (
        <span
          className="oc-theme-value-text"
          onDoubleClick={() => setEditing(true)}
          title={value}
        >
          {value || <span className="oc-theme-value-empty">&mdash;</span>}
        </span>
      )}

      {colorPickerOpen && token.syntax === "color" && (
        <div className="oc-theme-color-picker-wrap">
          <ColorPicker
            value={value}
            tokenName={token.name}
            onChange={(v) => {
              setLocalValue(v);
              dispatch({ type: "UPDATE_TOKEN_VALUE", fileId, tokenName: token.name, themeId, value: v });
            }}
            onClose={() => setColorPickerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Variable detail panel ────────────────────────────────

function VariableDetailPanel({
  token,
  fileId,
  onClose,
}: {
  token: DesignToken;
  fileId: string;
  onClose: () => void;
}) {
  const { dispatch } = useWorkspace();
  const [name, setName] = useState(token.name);
  const [description, setDescription] = useState(token.description);
  const [inherits, setInherits] = useState(token.inherits);
  const [syntax, setSyntax] = useState<TokenSyntax>(token.syntax);
  const [syntaxOpen, setSyntaxOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const syntaxOptions: TokenSyntax[] = ["angle", "color", "length-percentage", "percentage", "number", "time", "*"];

  const handleSave = () => {
    if (name !== token.name) {
      dispatch({ type: "RENAME_TOKENS", fileId, renames: [{ from: token.name, to: name }] });
    }
    dispatch({
      type: "UPDATE_TOKEN_META",
      fileId,
      tokenName: name !== token.name ? name : token.name,
      updates: { description, inherits, syntax },
    });
  };

  const defaultValue = token.values["default"] || Object.values(token.values)[0] || "";

  return (
    <div ref={panelRef} className="oc-theme-detail-panel">
      <div className="oc-theme-detail-header">
        <GripVertical size={14} style={{ color: "var(--color--text--disabled)" }} />
        <span className="oc-theme-detail-title">{token.name}</span>
        <button className="oc-theme-detail-close" onClick={onClose}><X size={14} /></button>
      </div>

      <div className="oc-theme-detail-body">
        <div className="oc-theme-detail-field">
          <label>Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            spellCheck={false}
          />
        </div>

        <div className="oc-theme-detail-field">
          <label>Syntax</label>
          <div className="oc-theme-detail-select" onClick={() => setSyntaxOpen(!syntaxOpen)}>
            <span>{syntax === "*" ? "Any (*)" : syntax.charAt(0).toUpperCase() + syntax.slice(1)}</span>
            <ChevronDown size={12} />
            {syntaxOpen && (
              <div className="oc-theme-detail-dropdown">
                {syntaxOptions.map((opt) => (
                  <button
                    key={opt}
                    className={`oc-theme-detail-dropdown-item ${syntax === opt ? "is-active" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSyntax(opt);
                      setSyntaxOpen(false);
                      dispatch({ type: "UPDATE_TOKEN_META", fileId, tokenName: token.name, updates: { syntax: opt } });
                    }}
                  >
                    {opt === "*" ? "Any (*)" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="oc-theme-detail-divider">Advanced</div>

        <div className="oc-theme-detail-field">
          <label>Initial value</label>
          <div className="oc-theme-detail-initial">
            {token.syntax === "color" && <ColorSwatch color={defaultValue} />}
            <span>{defaultValue}</span>
          </div>
        </div>

        <div className="oc-theme-detail-field">
          <label>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Add description..."
            spellCheck={false}
          />
        </div>

        <div className="oc-theme-detail-field is-row">
          <label>Inherits</label>
          <button
            className={`oc-theme-detail-checkbox ${inherits ? "is-checked" : ""}`}
            onClick={() => {
              setInherits(!inherits);
              dispatch({ type: "UPDATE_TOKEN_META", fileId, tokenName: token.name, updates: { inherits: !inherits } });
            }}
          >
            {inherits && <Check size={12} />}
          </button>
        </div>
      </div>

      <div className="oc-theme-detail-footer">
        <button
          className="oc-theme-detail-action"
          onClick={() => {
            navigator.clipboard.writeText(`${token.name}: ${defaultValue};`);
          }}
          title="Copy"
        >
          <Copy size={14} />
        </button>
        <button
          className="oc-theme-detail-action is-danger"
          onClick={() => {
            dispatch({ type: "DELETE_TOKENS", fileId, tokenNames: [token.name] });
            onClose();
          }}
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Rename Dialog ────────────────────────────────────────

function RenameDialog({
  selectedCount,
  onRename,
  onClose,
}: {
  selectedCount: number;
  onRename: (prefix: string, suffix: string) => void;
  onClose: () => void;
}) {
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");

  return (
    <div className="oc-theme-dialog-overlay" onClick={onClose}>
      <div className="oc-theme-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="oc-theme-dialog-header">
          <span>Rename selection</span>
          <button onClick={onClose}><X size={14} /></button>
        </div>
        <div className="oc-theme-dialog-body">
          <div className="oc-theme-dialog-field">
            <label>Prefix</label>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="-" spellCheck={false} />
          </div>
          <div className="oc-theme-dialog-field">
            <label>Suffix</label>
            <input value={suffix} onChange={(e) => setSuffix(e.target.value)} placeholder="-" spellCheck={false} />
          </div>
          <div className="oc-theme-dialog-preview">
            Preview: <code>--{prefix}variable-name{suffix}</code>
          </div>
        </div>
        <div className="oc-theme-dialog-actions">
          <button className="oc-theme-dialog-btn is-secondary" onClick={onClose}>Cancel</button>
          <button
            className="oc-theme-dialog-btn is-primary"
            onClick={() => { onRename(prefix, suffix); onClose(); }}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Syntax type dropdown for the "+" button ──────────────

function AddVariableDropdown({ onAdd }: { onAdd: (syntax: TokenSyntax) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const options: { syntax: TokenSyntax; label: string; icon: string }[] = [
    { syntax: "angle", label: "Angle", icon: "Angle" },
    { syntax: "color", label: "Color", icon: "Color" },
    { syntax: "length-percentage", label: "Length-percentage", icon: "Length" },
    { syntax: "percentage", label: "Percentage", icon: "%" },
    { syntax: "number", label: "Number", icon: "123" },
    { syntax: "time", label: "Time", icon: "Time" },
    { syntax: "*", label: "Any (*)", icon: "*" },
  ];

  return (
    <div ref={ref} className="oc-theme-add-var">
      <button className="oc-theme-header-btn" onClick={() => setOpen(!open)} title="Add variable">
        <Plus size={14} />
      </button>
      {open && (
        <div className="oc-theme-add-dropdown">
          {options.map((opt) => (
            <button
              key={opt.syntax}
              className="oc-theme-add-dropdown-item"
              onClick={() => { onAdd(opt.syntax); setOpen(false); }}
            >
              <SyntaxBadge syntax={opt.syntax} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ThemesPage ──────────────────────────────────────

export function ThemesPage() {
  const { state, dispatch } = useWorkspace();
  const { themes: themesState } = state;
  const activeFile = themesState.files.find((f) => f.id === themesState.activeFileId) || null;
  const [renameOpen, setRenameOpen] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── File selection ──
  const handlePickFile = useCallback(async () => {
    const result = await pickCSSFile();
    if (!result) return;

    const { tokens, themes } = parseCSSTokens(result.content);
    const fileId = `theme-${Date.now()}`;
    const themeFile: ThemeFile = {
      id: fileId,
      name: result.name,
      handle: result.handle,
      content: result.content,
      tokens,
      themes: themes.length > 0 ? themes : [{ id: "default", name: "Default", isDefault: true }],
      lastSynced: Date.now(),
    };
    dispatch({ type: "ADD_THEME_FILE", file: themeFile });
  }, [dispatch]);

  // ── Two-way sync: watch file for external IDE changes ──
  const isSyncingToFile = useRef(false);

  useEffect(() => {
    if (!activeFile?.handle) return;

    const syncFromFile = async () => {
      // Don't read while we're writing
      if (isSyncingToFile.current) return;
      if (!activeFile.handle) return;
      try {
        const file = await activeFile.handle.getFile();
        const content = await file.text();
        if (content !== activeFile.content) {
          const { tokens, themes } = parseCSSTokens(content);
          dispatch({ type: "UPDATE_THEME_FILE", id: activeFile.id, updates: { content } });
          dispatch({ type: "SET_THEME_TOKENS", fileId: activeFile.id, tokens, themes: themes.length > 0 ? themes : activeFile.themes });
        }
      } catch { /* file may be unavailable */ }
    };

    syncIntervalRef.current = setInterval(syncFromFile, 1000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [activeFile?.id, activeFile?.handle, activeFile?.content, dispatch]);

  // ── Sync tokens back to file (manual) ──
  // Uses surgical update: only modifies custom property values,
  // preserves ALL other CSS content (imports, rules, animations, etc.)
  const syncToFile = useCallback(async () => {
    if (!activeFile?.handle) return;
    isSyncingToFile.current = true;
    const newSource = applyTokensToSource(activeFile.content, activeFile.tokens, activeFile.themes);
    const ok = await writeToFile(activeFile.handle, newSource);
    if (ok) {
      dispatch({ type: "UPDATE_THEME_FILE", id: activeFile.id, updates: { content: newSource, lastSynced: Date.now() } });
    }
    isSyncingToFile.current = false;
  }, [activeFile, dispatch]);

  // NOTE: No auto-sync-to-file. Writing to CSS files is manual only (sync button).
  // File→Table sync (reading) happens automatically via the 1s polling above.
  // Table→File sync (writing) happens only when the user clicks the sync button.

  // ── Add new variable ──
  const handleAddVariable = useCallback((syntax: TokenSyntax) => {
    if (!activeFile) return;
    const defaultValues: Record<string, string> = {};
    for (const theme of activeFile.themes) {
      defaultValues[theme.id] = syntax === "color" ? "#000000" : syntax === "number" ? "0" : "0px";
    }
    const name = `--new-variable-${Date.now()}`;
    const token: DesignToken = {
      name,
      values: defaultValues,
      syntax,
      description: "",
      inherits: true,
      group: "new",
    };
    dispatch({ type: "ADD_TOKENS", fileId: activeFile.id, tokens: [token] });
  }, [activeFile, dispatch]);

  // ── Add theme column (inherit all values from default) ──
  const handleAddTheme = useCallback(() => {
    if (!activeFile) return;
    const id = `theme-${Date.now()}`;
    // Add column first
    dispatch({ type: "ADD_THEME_COLUMN", fileId: activeFile.id, theme: { id, name: "New Theme", isDefault: false } });
    // Copy all default values into the new theme column
    const defaultTheme = activeFile.themes.find((t) => t.isDefault) || activeFile.themes[0];
    if (defaultTheme) {
      for (const token of activeFile.tokens) {
        const defaultVal = token.values[defaultTheme.id];
        if (defaultVal !== undefined) {
          dispatch({ type: "UPDATE_TOKEN_VALUE", fileId: activeFile.id, tokenName: token.name, themeId: id, value: defaultVal });
        }
      }
    }
  }, [activeFile, dispatch]);

  // ── Paste CSS ──
  const handlePasteCSS = useCallback(() => {
    if (!activeFile || !pasteText.trim()) return;
    const newTokens = parsePastedCSS(pasteText);
    if (newTokens.length > 0) {
      dispatch({ type: "ADD_TOKENS", fileId: activeFile.id, tokens: newTokens });
    }
    setPasteMode(false);
    setPasteText("");
  }, [activeFile, pasteText, dispatch]);

  // ── Batch rename ──
  const handleBatchRename = useCallback((prefix: string, suffix: string) => {
    if (!activeFile) return;
    const renames = [...themesState.selectedTokens].map((name) => {
      const stripped = name.replace(/^--/, "");
      return { from: name, to: `--${prefix}${stripped}${suffix}` };
    });
    dispatch({ type: "RENAME_TOKENS", fileId: activeFile.id, renames });
    dispatch({ type: "SET_SELECTED_TOKENS", tokens: new Set() });
  }, [activeFile, themesState.selectedTokens, dispatch]);

  // ── Batch delete ──
  const handleBatchDelete = useCallback(() => {
    if (!activeFile) return;
    dispatch({ type: "DELETE_TOKENS", fileId: activeFile.id, tokenNames: [...themesState.selectedTokens] });
    dispatch({ type: "SET_SELECTED_TOKENS", tokens: new Set() });
  }, [activeFile, themesState.selectedTokens, dispatch]);

  // ── Select all / deselect ──
  const handleSelectAll = useCallback(() => {
    if (!activeFile) return;
    const all = new Set(activeFile.tokens.map((t) => t.name));
    dispatch({ type: "SET_SELECTED_TOKENS", tokens: all });
  }, [activeFile, dispatch]);

  const handleDeselectAll = useCallback(() => {
    dispatch({ type: "SET_SELECTED_TOKENS", tokens: new Set() });
  }, [dispatch]);

  // ── Filter tokens by search ──
  const filteredTokens = activeFile?.tokens.filter((t) => {
    if (!themesState.searchQuery) return true;
    const q = themesState.searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.group.toLowerCase().includes(q) || Object.values(t.values).some((v) => v.toLowerCase().includes(q));
  }) ?? [];

  // ── Group tokens ──
  const groups = new Map<string, DesignToken[]>();
  for (const token of filteredTokens) {
    const arr = groups.get(token.group) || [];
    arr.push(token);
    groups.set(token.group, arr);
  }

  const hasSelection = themesState.selectedTokens.size > 0;
  const editingToken = activeFile?.tokens.find((t) => t.name === themesState.editingToken) || null;

  // ── Empty state ──
  if (!activeFile) {
    return (
      <div className="oc-themes-page">
        <div className="oc-themes-empty">
          <div className="oc-themes-empty-icon">
            <FileCode size={48} />
          </div>
          <div className="oc-themes-empty-title">No CSS file loaded</div>
          <div className="oc-themes-empty-desc">
            Select a CSS file to extract and manage design tokens.
          </div>
          <button className="oc-themes-empty-btn" onClick={handlePickFile}>
            <FileCode size={16} />
            Select CSS File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="oc-themes-page">
      {/* File tabs */}
      <div className="oc-themes-file-bar">
        <div className="oc-themes-file-tabs">
          {themesState.files.map((f) => (
            <button
              key={f.id}
              className={`oc-themes-file-tab ${f.id === themesState.activeFileId ? "is-active" : ""}`}
              onClick={() => dispatch({ type: "SET_ACTIVE_THEME_FILE", id: f.id })}
            >
              <FileCode size={12} />
              {f.name}
              <button
                className="oc-themes-file-tab-close"
                onClick={(e) => { e.stopPropagation(); dispatch({ type: "REMOVE_THEME_FILE", id: f.id }); }}
              >
                <X size={10} />
              </button>
            </button>
          ))}
          <button className="oc-themes-file-add" onClick={handlePickFile} title="Add CSS file">
            <Plus size={14} />
          </button>
        </div>

        <div className="oc-themes-file-actions">
          <button
            className="oc-themes-action-btn"
            onClick={() => setPasteMode(!pasteMode)}
            title="Paste CSS variables"
          >
            <ClipboardPaste size={14} />
          </button>
          <button
            className="oc-themes-action-btn"
            onClick={syncToFile}
            title="Sync to file"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Paste overlay */}
      {pasteMode && (
        <div className="oc-themes-paste-bar">
          <textarea
            className="oc-themes-paste-input"
            placeholder="Paste CSS variables here...&#10;&#10;--color-primary: #3B82F6;&#10;--spacing-md: 16px;"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={5}
            autoFocus
          />
          <div className="oc-themes-paste-actions">
            <button className="oc-theme-dialog-btn is-secondary" onClick={() => { setPasteMode(false); setPasteText(""); }}>
              Cancel
            </button>
            <button className="oc-theme-dialog-btn is-primary" onClick={handlePasteCSS}>
              Import
            </button>
          </div>
        </div>
      )}

      {/* Search + selection actions */}
      <div className="oc-themes-toolbar">
        <div className="oc-themes-search">
          <Search size={14} />
          <input
            placeholder="Search"
            value={themesState.searchQuery}
            onChange={(e) => dispatch({ type: "SET_THEME_SEARCH", query: e.target.value })}
            spellCheck={false}
          />
          {themesState.searchQuery && (
            <button className="oc-themes-search-clear" onClick={() => dispatch({ type: "SET_THEME_SEARCH", query: "" })}>
              <X size={12} />
            </button>
          )}
        </div>

        {hasSelection && (
          <div className="oc-themes-selection-bar">
            <button className="oc-themes-sel-btn" onClick={handleDeselectAll}>Deselect</button>
            <button className="oc-themes-sel-btn" onClick={() => setRenameOpen(true)}>Rename</button>
            <button className="oc-themes-sel-btn is-danger" onClick={handleBatchDelete}>
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Main table area */}
      <div className="oc-themes-main">
        <ScrollArea className="oc-themes-scroll">
          <table className="oc-themes-table">
            <thead>
              <tr>
                <th className="oc-themes-th-check">
                  <input
                    type="checkbox"
                    checked={hasSelection && themesState.selectedTokens.size === filteredTokens.length}
                    onChange={(e) => e.target.checked ? handleSelectAll() : handleDeselectAll()}
                  />
                </th>
                <th className="oc-themes-th-name">
                  <div className="oc-themes-th-name-inner">
                    Name
                    <AddVariableDropdown onAdd={handleAddVariable} />
                  </div>
                </th>
                {activeFile.themes.map((theme) => (
                  <th key={theme.id} className="oc-themes-th-theme">
                    <div className="oc-themes-th-theme-inner">
                      {theme.name}
                      {theme.isDefault && <span className="oc-themes-default-badge">Default</span>}
                      <button className="oc-themes-th-menu"><MoreHorizontal size={12} /></button>
                    </div>
                  </th>
                ))}
                <th className="oc-themes-th-add">
                  <button className="oc-theme-header-btn" onClick={handleAddTheme} title="Add theme">
                    <Plus size={14} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...groups.entries()].map(([group, tokens]) => (
                <React.Fragment key={group}>
                  {groups.size > 1 && (
                    <tr className="oc-themes-group-row">
                      <td colSpan={activeFile.themes.length + 3}>
                        <span className="oc-themes-group-label">{group}</span>
                        <span className="oc-themes-group-count">{tokens.length}</span>
                      </td>
                    </tr>
                  )}
                  {tokens.map((token) => (
                    <tr
                      key={token.name}
                      className={`oc-themes-token-row ${themesState.selectedTokens.has(token.name) ? "is-selected" : ""}`}
                    >
                      <td className="oc-themes-td-check">
                        <input
                          type="checkbox"
                          checked={themesState.selectedTokens.has(token.name)}
                          onChange={() => dispatch({ type: "TOGGLE_TOKEN_SELECTION", tokenName: token.name })}
                        />
                      </td>
                      <td
                        className="oc-themes-td-name"
                        onClick={() => dispatch({ type: "SET_EDITING_TOKEN", tokenName: token.name })}
                      >
                        <span className="oc-themes-token-name">{token.name}</span>
                      </td>
                      {activeFile.themes.map((theme) => (
                        <td key={theme.id} className="oc-themes-td-value">
                          <TokenValueCell token={token} themeId={theme.id} fileId={activeFile.id} />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Group hint */}
          {groups.size <= 1 && filteredTokens.length > 0 && (
            <div className="oc-themes-group-hint">
              No groups found. Group by adding a double dash (--) to variable names.
              <br />
              E.g. --color--primary will create a "color" group.
            </div>
          )}
        </ScrollArea>

        {/* Detail panel */}
        {editingToken && (
          <div className="oc-themes-detail-slot">
            <VariableDetailPanel
              token={editingToken}
              fileId={activeFile.id}
              onClose={() => dispatch({ type: "SET_EDITING_TOKEN", tokenName: null })}
            />
          </div>
        )}
      </div>

      {/* Rename dialog */}
      {renameOpen && (
        <RenameDialog
          selectedCount={themesState.selectedTokens.size}
          onRename={handleBatchRename}
          onClose={() => setRenameOpen(false)}
        />
      )}
    </div>
  );
}
