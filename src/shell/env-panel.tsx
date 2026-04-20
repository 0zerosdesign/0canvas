// ──────────────────────────────────────────────────────────
// Env Panel — .env file editor for Column 2
// ──────────────────────────────────────────────────────────
//
// Lists every `.env*` file in the open project root as a tab
// strip. Each tab shows a KEY=VALUE table with masked values
// (click eye to reveal), per-row remove, and a "+ Add Variable"
// button at the bottom. Saves are server-side via the
// save_env_file Tauri command, which preserves comments and
// writes atomically.
//
// Out-of-scope for Phase 1C-Env:
//   - Creating a new .env file from scratch (use Terminal:
//     `touch .env.local`, then the file appears here).
//   - .env file templates / discovery from .env.example.
//   - Warnings beyond "not gitignored".
// ──────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  AlertTriangle,
} from "lucide-react";
import {
  listEnvFiles,
  saveEnvFile,
  type EnvFile,
  type EnvVar,
} from "../native/tauri-events";

function isTauriWebview(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

type DraftRow = EnvVar & { revealed: boolean };

export function EnvPanel() {
  const [files, setFiles] = useState<EnvFile[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listEnvFiles();
      setFiles(list);
      // Preserve the active tab across refresh if the file is still there;
      // otherwise pick the first.
      setActivePath((prev) => {
        if (prev && list.some((f) => f.path === prev)) return prev;
        return list[0]?.path ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeFile = files.find((f) => f.path === activePath) ?? null;

  // Re-seed the draft whenever the active file changes (via tab click or
  // a refresh). Keep `dirty` false until the user edits something.
  useEffect(() => {
    if (!activeFile) {
      setDraft([]);
      setDirty(false);
      return;
    }
    setDraft(
      activeFile.variables.map((v) => ({
        key: v.key,
        value: v.value,
        revealed: false,
      })),
    );
    setDirty(false);
  }, [activeFile?.path, activeFile?.variables]);

  const updateRow = (idx: number, patch: Partial<DraftRow>) => {
    setDraft((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
    setDirty(true);
  };

  const addRow = () => {
    setDraft((rows) => [...rows, { key: "", value: "", revealed: true }]);
    setDirty(true);
  };

  const removeRow = (idx: number) => {
    setDraft((rows) => rows.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!activeFile) return;
    // Drop rows with empty keys; keep the user's last valid state.
    const variables: EnvVar[] = draft
      .filter((r) => r.key.trim().length > 0)
      .map((r) => ({ key: r.key.trim(), value: r.value }));
    setSaving(true);
    setError(null);
    try {
      await saveEnvFile(activeFile.path, variables);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  if (!isTauriWebview()) {
    return (
      <div className="oc-env-panel__empty">
        Env editor requires the Mac app (pnpm tauri:dev).
      </div>
    );
  }

  if (loading) {
    return <div className="oc-env-panel__empty">Loading .env files…</div>;
  }

  if (files.length === 0) {
    return (
      <div className="oc-env-panel__empty">
        <p>No <code>.env*</code> files found in this project.</p>
        <p className="oc-env-panel__hint">
          Create one from the Terminal tab:
          <br />
          <code>touch .env.local</code>
        </p>
        <button className="oc-env-panel__refresh" onClick={refresh}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="oc-env-panel">
      <nav className="oc-env-panel__files">
        {files.map((f) => (
          <button
            key={f.path}
            className={`oc-env-panel__file ${
              f.path === activePath ? "is-active" : ""
            }`}
            onClick={() => setActivePath(f.path)}
            title={f.path}
          >
            {f.filename}
          </button>
        ))}
        <button
          className="oc-env-panel__file oc-env-panel__refresh-tab"
          onClick={refresh}
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </nav>

      {activeFile && (
        <>
          {!activeFile.gitignored && (
            <div className="oc-env-panel__warning">
              <AlertTriangle size={12} />
              <span>
                This file isn't matched by any <code>.gitignore</code> rule — secrets
                may get committed. Add <code>{activeFile.filename}</code> or
                {" "}<code>.env*</code> to <code>.gitignore</code>.
              </span>
            </div>
          )}

          <div className="oc-env-panel__rows">
            {draft.length === 0 && (
              <p className="oc-env-panel__empty-rows">
                No variables yet. Click <strong>Add Variable</strong> below.
              </p>
            )}
            {draft.map((row, idx) => (
              <div key={idx} className="oc-env-panel__row">
                <input
                  className="oc-env-panel__key"
                  type="text"
                  placeholder="KEY"
                  value={row.key}
                  onChange={(e) =>
                    updateRow(idx, { key: e.target.value.toUpperCase() })
                  }
                  spellCheck={false}
                />
                <input
                  className="oc-env-panel__value"
                  type={row.revealed ? "text" : "password"}
                  placeholder="value"
                  value={row.value}
                  onChange={(e) => updateRow(idx, { value: e.target.value })}
                  spellCheck={false}
                />
                <button
                  className="oc-env-panel__icon-btn"
                  onClick={() => updateRow(idx, { revealed: !row.revealed })}
                  title={row.revealed ? "Hide value" : "Reveal value"}
                >
                  {row.revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
                <button
                  className="oc-env-panel__icon-btn is-danger"
                  onClick={() => removeRow(idx)}
                  title="Remove variable"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <footer className="oc-env-panel__footer">
            <button className="oc-env-panel__add" onClick={addRow}>
              <Plus size={13} /> Add Variable
            </button>
            <button
              className="oc-env-panel__save"
              disabled={!dirty || saving}
              onClick={handleSave}
            >
              <Save size={13} />
              {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </button>
          </footer>

          {error && <div className="oc-env-panel__error">{error}</div>}
        </>
      )}
    </div>
  );
}
