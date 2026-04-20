// ──────────────────────────────────────────────────────────
// Native Storage API — single entry point for 0canvas storage
// ──────────────────────────────────────────────────────────
//
// This module is the ONLY place the rest of the app imports
// storage from. It currently re-exports IndexedDB-backed
// implementations from internal modules; in Phase 1 (Tauri)
// the backing swaps to the filesystem via the Tauri fs plugin,
// without any caller needing to change imports.
//
// Public surface (keep stable — callers depend on this):
//   Variants:       saveVariant, getVariant, getAllVariants,
//                   deleteVariant, clearVariants, cleanupOldVariants
//   Waitlist:       saveFeedbackItem, getAllFeedbackItems,
//                   deleteFeedbackItem, clearWaitlist
//   Projects:       saveProject, getProject, getAllProjects,
//                   deleteProject, clearProjects, cleanupUnsavedProjects
//                   (legacy StoredProject — to be merged with project files)
//   Project files:  saveProjectFile, loadProjectFile,
//                   listProjectFiles, deleteProjectFile
//   Sync metadata:  getSyncMeta, saveSyncMeta, markDirty, markSynced
//   Import/export:  downloadProjectFile, importProjectFile
//                   (Phase 1 will replace these with native dialogs;
//                   kept here so the dev harness keeps working.)
//   Runtime:        scheduleAutoSave, buildCurrentProjectFile,
//                   setBridgeSender
// ──────────────────────────────────────────────────────────

export {
  saveVariant,
  getVariant,
  getAllVariants,
  deleteVariant,
  clearVariants,
  cleanupOldVariants,
  saveFeedbackItem,
  getAllFeedbackItems,
  deleteFeedbackItem,
  clearWaitlist,
  saveProject,
  getProject,
  getAllProjects,
  deleteProject,
  clearProjects,
  cleanupUnsavedProjects,
} from "../0canvas/db/variant-db";

export type { StoredProject } from "../0canvas/db/variant-db";

export {
  saveProjectFile,
  loadProjectFile,
  listProjectFiles,
  deleteProjectFile,
  getSyncMeta,
  saveSyncMeta,
  markDirty,
  markSynced,
  downloadProjectFile,
  importProjectFile,
  scheduleAutoSave,
  buildCurrentProjectFile,
  setBridgeSender,
} from "../0canvas/format/oc-project-store";

export type { OCSyncMeta } from "../0canvas/format/oc-project-store";
