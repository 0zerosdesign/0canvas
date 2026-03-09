// ──────────────────────────────────────────────────────────
// DD Project Store — IndexedDB persistence + import/export
// ──────────────────────────────────────────────────────────

import { openDB, type IDBPDatabase } from "idb";
import {
  type DDProjectFile,
  validateDDProjectFile,
  parseProjectFile,
  serializeProjectFile,
  computeProjectHash,
  stateToProjectFile,
  projectFileToState,
  createEmptyProjectFile,
} from "./dd-project";
import type { VariantData, FeedbackItem, DDProject, FileMapping } from "../store";

const DB_NAME = "designdead-projects";
const DB_VERSION = 1;
const PROJECT_STORE = "dd-projects";
const SYNC_META_STORE = "dd-sync-meta";

// ── Types ──────────────────────────────────────────────────

export type DDSyncMeta = {
  projectId: string;
  lastSyncedRevision: number;
  lastSyncedAt: string;
  dirty: boolean;
  filePath?: string;
};

// ── DB init ────────────────────────────────────────────────

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB not available in SSR"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: "project.id" });
        }
        if (!db.objectStoreNames.contains(SYNC_META_STORE)) {
          db.createObjectStore(SYNC_META_STORE, { keyPath: "projectId" });
        }
      },
    });
  }
  return dbPromise;
}

// ── CRUD operations ────────────────────────────────────────

export async function saveProjectFile(file: DDProjectFile): Promise<void> {
  const hash = await computeProjectHash(file);
  const withHash: DDProjectFile = {
    ...file,
    integrity: { ...file.integrity, hash },
  };
  const db = await getDB();
  await db.put(PROJECT_STORE, withHash);
}

export async function loadProjectFile(projectId: string): Promise<DDProjectFile | null> {
  const db = await getDB();
  const doc = await db.get(PROJECT_STORE, projectId);
  if (!doc) return null;
  const result = validateDDProjectFile(doc);
  return result.valid ? result.data : null;
}

export async function listProjectFiles(): Promise<DDProjectFile[]> {
  const db = await getDB();
  const all = await db.getAll(PROJECT_STORE);
  return all.filter((doc: any) => {
    const result = validateDDProjectFile(doc);
    return result.valid;
  });
}

export async function deleteProjectFile(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete(PROJECT_STORE, projectId);
  await db.delete(SYNC_META_STORE, projectId);
}

// ── Sync metadata ──────────────────────────────────────────

export async function getSyncMeta(projectId: string): Promise<DDSyncMeta | null> {
  const db = await getDB();
  return (await db.get(SYNC_META_STORE, projectId)) || null;
}

export async function saveSyncMeta(meta: DDSyncMeta): Promise<void> {
  const db = await getDB();
  await db.put(SYNC_META_STORE, meta);
}

export async function markDirty(projectId: string): Promise<void> {
  const meta = await getSyncMeta(projectId);
  if (meta) {
    await saveSyncMeta({ ...meta, dirty: true });
  } else {
    await saveSyncMeta({
      projectId,
      lastSyncedRevision: 0,
      lastSyncedAt: new Date().toISOString(),
      dirty: true,
    });
  }
}

export async function markSynced(projectId: string, revision: number): Promise<void> {
  await saveSyncMeta({
    projectId,
    lastSyncedRevision: revision,
    lastSyncedAt: new Date().toISOString(),
    dirty: false,
  });
}

// ── Export (download) ──────────────────────────────────────

export function downloadProjectFile(file: DDProjectFile): void {
  const json = serializeProjectFile(file);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const name = (file.project.name || "project").replace(/[^a-zA-Z0-9_-]/g, "_");

  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.dd`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

// ── Import (upload) ────────────────────────────────────────

export function importProjectFile(): Promise<DDProjectFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".dd,.json";
    input.style.display = "none";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }

      try {
        const text = await file.text();
        const result = parseProjectFile(text);
        if (result.valid) {
          await saveProjectFile(result.data);
          resolve(result.data);
        } else {
          console.warn("[DD Project] Import validation failed:", result.errors);
          resolve(null);
        }
      } catch (err) {
        console.warn("[DD Project] Import error:", err);
        resolve(null);
      } finally {
        document.body.removeChild(input);
      }
    };

    input.oncancel = () => {
      document.body.removeChild(input);
      resolve(null);
    };

    document.body.appendChild(input);
    input.click();
  });
}

// ── Auto-save from runtime state ───────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

export function scheduleAutoSave(
  project: DDProject,
  variants: VariantData[],
  feedbackItems: FeedbackItem[],
  fileMappings: FileMapping[],
  currentRoute: string,
  existingFile?: DDProjectFile | null,
): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const file = stateToProjectFile(
        project, variants, feedbackItems, fileMappings, currentRoute, existingFile,
      );
      await saveProjectFile(file);
      await markDirty(project.id);
    } catch (err) {
      console.warn("[DD Project] Auto-save error:", err);
    }
  }, DEBOUNCE_MS);
}

// ── Build project file from current state (sync helper) ────

export async function buildCurrentProjectFile(
  project: DDProject,
  variants: VariantData[],
  feedbackItems: FeedbackItem[],
  fileMappings: FileMapping[],
  currentRoute: string,
): Promise<DDProjectFile> {
  const existing = await loadProjectFile(project.id);
  const file = stateToProjectFile(
    project, variants, feedbackItems, fileMappings, currentRoute, existing,
  );
  const hash = await computeProjectHash(file);
  return { ...file, integrity: { ...file.integrity, hash } };
}

// ── Push to IDE via bridge ─────────────────────────────────

export async function pushProjectToIDE(
  file: DDProjectFile,
  bridgePort: number,
): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${bridgePort}/api/dd-project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: serializeProjectFile(file),
    });
    if (res.ok) {
      await markSynced(file.project.id, file.project.revision);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ── Pull from IDE via bridge ───────────────────────────────

export async function pullProjectFromIDE(
  projectId: string,
  bridgePort: number,
): Promise<DDProjectFile | null> {
  try {
    const res = await fetch(`http://127.0.0.1:${bridgePort}/api/dd-project?id=${encodeURIComponent(projectId)}`);
    if (!res.ok) return null;
    const json = await res.json();
    const result = validateDDProjectFile(json);
    if (result.valid) {
      await saveProjectFile(result.data);
      await markSynced(result.data.project.id, result.data.project.revision);
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}
