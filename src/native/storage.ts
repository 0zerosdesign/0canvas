// ──────────────────────────────────────────────────────────
// Native Storage API — single entry point for Zeros storage
// ──────────────────────────────────────────────────────────
//
// This module is the ONLY place the rest of the app imports
// storage from. It currently re-exports IndexedDB-backed
// implementations from internal modules; in the native Mac app
// the backing swaps to filesystem/native storage,
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
} from "../zeros/db/variant-db";

export type { StoredProject } from "../zeros/db/variant-db";

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
} from "../zeros/format/oc-project-store";

export type { OCSyncMeta } from "../zeros/format/oc-project-store";
