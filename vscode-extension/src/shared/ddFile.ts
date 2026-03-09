// Pure .dd file utilities — parse, validate, serialize, patch.
// No external dependencies (no Zod). Runs in both Node and browser.

import type { DDProjectFile } from "./types";
import type { DDPatch } from "./protocol";

const CURRENT_SCHEMA_VERSION = 1;

// ── Parse ──────────────────────────────────────────────────

export type ParseResult =
  | { valid: true; data: DDProjectFile }
  | { valid: false; errors: string[] };

export function parseDDFile(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }

  return validateDDFile(raw);
}

export function validateDDFile(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["File must be a JSON object"] };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj.schemaVersion !== "number") {
    errors.push("Missing or invalid 'schemaVersion' (expected number)");
  } else if (obj.schemaVersion > CURRENT_SCHEMA_VERSION) {
    errors.push(`Schema version ${obj.schemaVersion} is newer than supported (${CURRENT_SCHEMA_VERSION})`);
  }

  if (!obj.project || typeof obj.project !== "object") {
    errors.push("Missing 'project' object");
  } else {
    const p = obj.project as Record<string, unknown>;
    if (typeof p.id !== "string" || !p.id) errors.push("project.id is required");
    if (typeof p.name !== "string" || !p.name) errors.push("project.name is required");
    if (typeof p.revision !== "number") errors.push("project.revision must be a number");
  }

  if (!obj.workspace || typeof obj.workspace !== "object") {
    errors.push("Missing 'workspace' object");
  }

  if (!obj.breakpoints || typeof obj.breakpoints !== "object") {
    errors.push("Missing 'breakpoints' object");
  }

  if (!obj.pages || !Array.isArray(obj.pages)) {
    errors.push("Missing 'pages' array");
  }

  if (!obj.variants || !Array.isArray(obj.variants)) {
    errors.push("Missing 'variants' array");
  }

  if (!obj.integrity || typeof obj.integrity !== "object") {
    errors.push("Missing 'integrity' object");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: raw as DDProjectFile };
}

// ── Serialize ──────────────────────────────────────────────

export function serializeDDFile(doc: DDProjectFile): string {
  return JSON.stringify(doc, null, 2);
}

// ── Compute integrity hash (FNV-1a, sync, works everywhere) ──

function fnv1aHash(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return "fnv1a-" + hash.toString(16);
}

export function computeHash(doc: DDProjectFile): string {
  const { integrity, ...rest } = doc;
  return fnv1aHash(JSON.stringify(rest));
}

// ── Apply patch ────────────────────────────────────────────

export function applyPatch(doc: DDProjectFile, patch: DDPatch): DDProjectFile {
  const now = new Date().toISOString();
  const isLayoutOnly = ["updateCanvasViewport", "updateVariantPosition", "updateVariantCanvasSize", "updatePagePosition"].includes(patch.op);
  let updated: DDProjectFile = isLayoutOnly
    ? { ...doc }
    : { ...doc, project: { ...doc.project, updatedAt: now, revision: doc.project.revision + 1 } };

  switch (patch.op) {
    case "setProjectName":
      updated.project = { ...updated.project, name: patch.value };
      break;

    case "setBreakpoint":
      updated = { ...updated, breakpoints: { ...updated.breakpoints, [patch.key]: patch.value } };
      break;

    case "setVariable":
      updated = { ...updated, variables: { ...updated.variables, [patch.name]: patch.value } };
      break;

    case "deleteVariable": {
      const vars = { ...updated.variables };
      delete vars[patch.name];
      updated = { ...updated, variables: vars };
      break;
    }

    case "updateVariantName":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId ? { ...v, name: patch.name, updatedAt: now } : v
        ),
      };
      break;

    case "updateVariantStatus":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId ? { ...v, status: patch.status, updatedAt: now } : v
        ),
      };
      break;

    case "updateVariantContent":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId
            ? {
                ...v,
                content: {
                  html: patch.html ?? v.content.html,
                  styles: patch.styles ?? v.content.styles,
                },
                updatedAt: now,
              }
            : v
        ),
      };
      break;

    case "deleteVariant":
      updated = {
        ...updated,
        variants: updated.variants.filter((v) => v.id !== patch.variantId),
      };
      break;

    case "addFeedback":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId
            ? { ...v, feedback: [...v.feedback, patch.feedback], updatedAt: now }
            : v
        ),
      };
      break;

    case "deleteFeedback":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId
            ? { ...v, feedback: v.feedback.filter((f) => f.id !== patch.feedbackId), updatedAt: now }
            : v
        ),
      };
      break;

    case "resolveFeedback":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId
            ? {
                ...v,
                feedback: v.feedback.map((f) =>
                  f.id === patch.feedbackId ? { ...f, resolved: true } : f
                ),
                updatedAt: now,
              }
            : v
        ),
      };
      break;

    case "updateCanvasViewport":
      updated = {
        ...updated,
        canvas: { ...updated.canvas, viewport: patch.viewport },
      };
      break;

    case "updateVariantPosition":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId ? { ...v, canvasPosition: patch.position } : v
        ),
      };
      break;

    case "updateVariantCanvasSize":
      updated = {
        ...updated,
        variants: updated.variants.map((v) =>
          v.id === patch.variantId ? { ...v, canvasSize: patch.size } : v
        ),
      };
      break;

    case "updatePagePosition":
      updated = {
        ...updated,
        pages: updated.pages.map((p) =>
          p.id === patch.pageId ? { ...p, canvasPosition: patch.position } : p
        ),
      };
      break;
  }

  // Recompute integrity hash
  const hash = computeHash(updated);
  updated = { ...updated, integrity: { ...updated.integrity, hash } };

  return updated;
}
