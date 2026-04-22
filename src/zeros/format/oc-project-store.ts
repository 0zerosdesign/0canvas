// ──────────────────────────────────────────────────────────
// DD Project Store — IndexedDB persistence + import/export
// ──────────────────────────────────────────────────────────

import { openDB, type IDBPDatabase } from "idb";
import {
  type OCProjectFile,
  validateOCProjectFile,
  parseProjectFile,
  serializeProjectFile,
  computeProjectHash,
  stateToProjectFile,
  projectFileToState,
  createEmptyProjectFile,
} from "./oc-project";
import type { VariantData, FeedbackItem, OCProject } from "../store/store";

const DB_NAME = "Zeros-projects";
const DB_VERSION = 1;
const PROJECT_STORE = "oc-projects";
const SYNC_META_STORE = "oc-sync-meta";

// ── Types ──────────────────────────────────────────────────

export type OCSyncMeta = {
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

export async function saveProjectFile(file: OCProjectFile): Promise<void> {
  const hash = await computeProjectHash(file);
  const withHash: OCProjectFile = {
    ...file,
    integrity: { ...file.integrity, hash },
  };
  const db = await getDB();
  await db.put(PROJECT_STORE, withHash);
}

export async function loadProjectFile(projectId: string): Promise<OCProjectFile | null> {
  const db = await getDB();
  const doc = await db.get(PROJECT_STORE, projectId);
  if (!doc) return null;
  const result = validateOCProjectFile(doc);
  return result.valid ? result.data : null;
}

export async function listProjectFiles(): Promise<OCProjectFile[]> {
  const db = await getDB();
  const all = await db.getAll(PROJECT_STORE);
  return all.filter((doc: any) => {
    const result = validateOCProjectFile(doc);
    return result.valid;
  });
}

export async function deleteProjectFile(projectId: string): Promise<void> {
  const db = await getDB();
  await db.delete(PROJECT_STORE, projectId);
  await db.delete(SYNC_META_STORE, projectId);
}

// ── Sync metadata ──────────────────────────────────────────

export async function getSyncMeta(projectId: string): Promise<OCSyncMeta | null> {
  const db = await getDB();
  return (await db.get(SYNC_META_STORE, projectId)) || null;
}

export async function saveSyncMeta(meta: OCSyncMeta): Promise<void> {
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

export function downloadProjectFile(file: OCProjectFile): void {
  const json = serializeProjectFile(file);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const name = (file.project.name || "project").replace(/[^a-zA-Z0-9_-]/g, "_");

  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.0c`;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 100);
}

// ── Import (upload) ────────────────────────────────────────

export function importProjectFile(): Promise<OCProjectFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".0c,.json";
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

// ── Filesystem sync via WebSocket bridge ──────────────────

type BridgeSender = (msg: { type: string; [key: string]: unknown }) => void;
let _bridgeSend: BridgeSender | null = null;
let _fsSyncTimer: ReturnType<typeof setTimeout> | null = null;
const FS_SYNC_DEBOUNCE_MS = 1000; // 1s debounce for disk writes

/** Set the bridge send function. Call this once when the bridge connects. */
export function setBridgeSender(send: BridgeSender | null): void {
  _bridgeSend = send;
}

/** Derive .0c filename from project name. */
function projectToFileName(name: string): string {
  const safe = (name || "project").replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  return `${safe}.0c`;
}

/** Send the current project state to the extension for filesystem write. */
function syncToFilesystem(file: OCProjectFile): void {
  if (!_bridgeSend) return;

  if (_fsSyncTimer) clearTimeout(_fsSyncTimer);
  _fsSyncTimer = setTimeout(() => {
    try {
      const json = serializeProjectFile(file);
      const fileName = projectToFileName(file.project.name);
      _bridgeSend?.({
        type: "PROJECT_STATE_SYNC",
        source: "browser",
        projectFile: json,
        filePath: fileName, // each project gets its own file
        projectId: file.project.id,
      });
      console.log(`[Zeros] Synced ${fileName} to filesystem`);
    } catch (err) {
      console.warn("[Zeros] Filesystem sync error:", err);
    }
  }, FS_SYNC_DEBOUNCE_MS);
}

// ── Auto-save from runtime state ───────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

export function scheduleAutoSave(
  project: OCProject,
  variants: VariantData[],
  feedbackItems: FeedbackItem[],
  currentRoute: string,
  existingFile?: OCProjectFile | null,
): void {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const file = stateToProjectFile(
        project, variants, feedbackItems, currentRoute, existingFile,
      );
      await saveProjectFile(file);
      await markDirty(project.id);

      // Also sync to filesystem via bridge (debounced separately at 3s)
      syncToFilesystem(file);
    } catch (err) {
      console.warn("[DD Project] Auto-save error:", err);
    }
  }, DEBOUNCE_MS);
}

// ── Build project file from current state (sync helper) ────

export async function buildCurrentProjectFile(
  project: OCProject,
  variants: VariantData[],
  feedbackItems: FeedbackItem[],
  currentRoute: string,
): Promise<OCProjectFile> {
  const existing = await loadProjectFile(project.id);
  const file = stateToProjectFile(
    project, variants, feedbackItems, currentRoute, existing,
  );
  const hash = await computeProjectHash(file);
  return { ...file, integrity: { ...file.integrity, hash } };
}

