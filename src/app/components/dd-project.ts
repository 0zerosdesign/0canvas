// ──────────────────────────────────────────────────────────
// DD Project — Whole-project .dd file format
// ──────────────────────────────────────────────────────────
//
// A single .dd file is the canonical representation of an
// entire DesignDead project: metadata, workspace config,
// breakpoints, variables, pages, variants, annotations,
// feedback, and history checkpoints.
//
// The file is JSON-based, stored in IndexedDB in-browser,
// downloadable as .dd, and syncable to IDE via MCP bridge.
//
// ──────────────────────────────────────────────────────────

import { z } from "zod";
import type { VariantData, FeedbackItem, DDProject, FileMapping } from "../store";

export const DD_PROJECT_SCHEMA_VERSION = 1;

// ── Zod Schemas ────────────────────────────────────────────

const isoDateTime = z.string().datetime();
const idString = z.string().min(1).regex(/^[A-Za-z0-9._:\-]+$/);
const nonEmptyString = z.string().min(1);

const ProjectMetaSchema = z.object({
  id: idString,
  name: nonEmptyString,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  revision: z.number().int().min(0),
});

const WorkspaceMetaSchema = z.object({
  root: nonEmptyString,
  entryFiles: z.array(nonEmptyString).min(1),
  framework: z.enum([
    "react", "next", "vue", "nuxt", "svelte", "solid", "angular", "astro", "unknown",
  ]),
  pathAliases: z.record(z.string().min(1), z.string().min(1)),
});

const BreakpointsSchema = z.object({
  desktop: z.number().int().min(1),
  laptop: z.number().int().min(1),
  tablet: z.number().int().min(1),
  mobile: z.number().int().min(1),
});

const VariablesSchema = z.record(
  z.string().min(1),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);

const PageSourceSchema = z.object({
  html: z.string(),
  styles: z.string(),
  assets: z.array(nonEmptyString),
});

const LayerNodeSchema: z.ZodType<DDLayerNode> = z.lazy(() =>
  z.object({
    id: idString,
    tag: nonEmptyString,
    selector: z.string().optional(),
    textPreview: z.string().optional(),
    classes: z.array(z.string()).optional(),
    attrs: z.record(z.string().min(1), z.string()).optional(),
    children: z.array(LayerNodeSchema),
  }),
);

const FileMapEntrySchema = z.object({
  elementId: idString,
  filePath: nonEmptyString,
  componentName: z.string().optional(),
  framework: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()).optional(),
});

const PageSchema = z.object({
  id: idString,
  name: nonEmptyString,
  route: nonEmptyString,
  source: PageSourceSchema,
  layers: z.array(LayerNodeSchema),
  fileMap: z.array(FileMapEntrySchema),
});

const ViewportSchema = z.object({
  width: z.number().int().min(1),
  height: z.number().int().min(1),
});

const VariantContentSchema = z.object({
  html: z.string(),
  styles: z.string(),
});

const AnnotationSchema = z.object({
  id: idString,
  elementId: idString,
  author: z.string().optional(),
  text: nonEmptyString,
  createdAt: isoDateTime,
  resolved: z.boolean().optional().default(false),
});

const FeedbackSchema = z.object({
  id: idString,
  text: nonEmptyString,
  author: z.string().optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  elementId: idString.optional(),
  createdAt: isoDateTime,
});

const VariantSchema = z.object({
  id: idString,
  pageId: idString,
  name: nonEmptyString,
  sourceElementId: z.string().nullable(),
  sourceViewportWidth: z.number().int().min(1),
  sourceContentHeight: z.number().int().min(0).optional(),
  viewport: ViewportSchema,
  content: VariantContentSchema,
  annotations: z.array(AnnotationSchema),
  feedback: z.array(FeedbackSchema),
  parentId: z.string().nullable().optional(),
  status: z.enum(["draft", "finalized", "sent", "pushed"]).optional().default("draft"),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const CheckpointSchema = z.object({
  id: idString,
  createdAt: isoDateTime,
  revision: z.number().int().min(0),
  label: nonEmptyString,
  note: z.string().optional(),
});

const HistorySchema = z.object({
  checkpoints: z.array(CheckpointSchema),
  lastCheckpointAt: isoDateTime.nullable(),
});

const IntegritySchema = z.object({
  hash: nonEmptyString,
  generator: nonEmptyString,
});

export const DDProjectFileSchema = z.object({
  $schema: z.string().url().optional(),
  schemaVersion: z.literal(DD_PROJECT_SCHEMA_VERSION),
  project: ProjectMetaSchema,
  workspace: WorkspaceMetaSchema,
  breakpoints: BreakpointsSchema,
  variables: VariablesSchema,
  pages: z.array(PageSchema).min(1),
  variants: z.array(VariantSchema),
  history: HistorySchema,
  integrity: IntegritySchema,
});

// ── TypeScript types (inferred from Zod) ───────────────────

export type DDProjectFile = z.infer<typeof DDProjectFileSchema>;
export type DDProjectMeta = z.infer<typeof ProjectMetaSchema>;
export type DDWorkspaceMeta = z.infer<typeof WorkspaceMetaSchema>;
export type DDBreakpointsConfig = z.infer<typeof BreakpointsSchema>;
export type DDPage = z.infer<typeof PageSchema>;
export type DDVariant = z.infer<typeof VariantSchema>;
export type DDAnnotation = z.infer<typeof AnnotationSchema>;
export type DDFeedback = z.infer<typeof FeedbackSchema>;
export type DDCheckpoint = z.infer<typeof CheckpointSchema>;
export type DDIntegrity = z.infer<typeof IntegritySchema>;
export type DDFileMapEntry = z.infer<typeof FileMapEntrySchema>;

export type DDLayerNode = {
  id: string;
  tag: string;
  selector?: string;
  textPreview?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  children: DDLayerNode[];
};

// ── Default breakpoints ────────────────────────────────────

export const DEFAULT_PROJECT_BREAKPOINTS: DDBreakpointsConfig = {
  desktop: 1280,
  laptop: 1024,
  tablet: 768,
  mobile: 390,
};

// ── Validation ─────────────────────────────────────────────

export type DDValidationResult =
  | { valid: true; data: DDProjectFile }
  | { valid: false; errors: string[] };

export function validateDDProjectFile(input: unknown): DDValidationResult {
  const result = DDProjectFileSchema.safeParse(input);
  if (result.success) {
    return { valid: true, data: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`,
  );
  return { valid: false, errors };
}

// ── Migration pipeline ─────────────────────────────────────

type Migrator = (doc: any) => any;
const MIGRATIONS: Record<number, Migrator> = {
  // Future: add migrations like { 1: (doc) => migrateV1toV2(doc) }
};

export function migrateProjectFile(raw: any): DDProjectFile | null {
  if (!raw || typeof raw !== "object") return null;

  let doc = { ...raw };
  const version = doc.schemaVersion;

  if (typeof version !== "number") return null;
  if (version > DD_PROJECT_SCHEMA_VERSION) return null;

  // Run sequential migrations
  for (let v = version; v < DD_PROJECT_SCHEMA_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return null;
    doc = migrate(doc);
  }

  const result = validateDDProjectFile(doc);
  return result.valid ? result.data : null;
}

// ── Integrity hash ─────────────────────────────────────────

export async function computeProjectHash(doc: DDProjectFile): Promise<string> {
  const { integrity, ...rest } = doc;
  const payload = JSON.stringify(rest);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(payload);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return "sha256-" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Fallback: simple FNV-1a hash for environments without SubtleCrypto
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return "fnv1a-" + hash.toString(16);
}

// ── Create empty project file ──────────────────────────────

export function createEmptyProjectFile(
  project: DDProject,
  framework: DDWorkspaceMeta["framework"] = "unknown",
): DDProjectFile {
  const now = new Date().toISOString();
  return {
    $schema: "https://zeros.design/schemas/dd-project-v1.json",
    schemaVersion: DD_PROJECT_SCHEMA_VERSION,
    project: {
      id: project.id,
      name: project.name,
      createdAt: now,
      updatedAt: now,
      revision: 0,
    },
    workspace: {
      root: ".",
      entryFiles: ["src/main.tsx"],
      framework,
      pathAliases: { "@": "src" },
    },
    breakpoints: { ...DEFAULT_PROJECT_BREAKPOINTS },
    variables: {},
    pages: [
      {
        id: "page_main",
        name: "Main",
        route: "/",
        source: { html: "", styles: "", assets: [] },
        layers: [],
        fileMap: [],
      },
    ],
    variants: [],
    history: {
      checkpoints: [],
      lastCheckpointAt: null,
    },
    integrity: {
      hash: "",
      generator: `design-dead@${typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.0.0"}`,
    },
  };
}

// ── Convert runtime state → .dd project file ──────────────

export function stateToProjectFile(
  project: DDProject,
  variants: VariantData[],
  feedbackItems: FeedbackItem[],
  fileMappings: FileMapping[],
  currentRoute: string,
  existingFile?: DDProjectFile | null,
): DDProjectFile {
  const now = new Date().toISOString();
  const base = existingFile || createEmptyProjectFile(project);

  const revision = (base.project.revision || 0) + 1;

  // Build file map entries from runtime FileMapping[]
  const fileMapEntries: DDFileMapEntry[] = fileMappings.map((fm) => ({
    elementId: fm.elementId,
    filePath: fm.filePath,
    componentName: fm.componentName || undefined,
    confidence: fm.confidence === "high" ? 0.9 : fm.confidence === "medium" ? 0.6 : 0.3,
  }));

  // Convert runtime variants to .dd variants
  const ddVariants: DDVariant[] = variants.map((v) => {
    const variantFeedback = feedbackItems
      .filter((f) => f.variantId === v.id)
      .map((f) => ({
        id: f.id,
        text: f.comment,
        severity: f.severity === "blocking" ? "critical" as const :
                  f.severity === "important" ? "high" as const : "medium" as const,
        elementId: f.elementId || undefined,
        createdAt: new Date(f.timestamp).toISOString(),
      }));

    return {
      id: v.id,
      pageId: "page_main",
      name: v.name,
      sourceElementId: v.sourceElementId || null,
      sourceViewportWidth: v.sourceViewportWidth || 1280,
      sourceContentHeight: v.sourceContentHeight,
      viewport: {
        width: v.sourceViewportWidth || 560,
        height: v.sourceContentHeight || Math.round((v.sourceViewportWidth || 560) * (420 / 560)),
      },
      content: {
        html: v.modifiedHtml || v.html,
        styles: v.modifiedCss || v.css || "",
      },
      annotations: [],
      feedback: variantFeedback,
      parentId: v.parentId || null,
      status: v.status,
      createdAt: new Date(v.createdAt).toISOString(),
      updatedAt: now,
    };
  });

  // Build the page
  const page: DDPage = {
    id: "page_main",
    name: project.name || "Main",
    route: currentRoute || "/",
    source: base.pages[0]?.source || { html: "", styles: "", assets: [] },
    layers: base.pages[0]?.layers || [],
    fileMap: fileMapEntries,
  };

  return {
    $schema: "https://zeros.design/schemas/dd-project-v1.json",
    schemaVersion: DD_PROJECT_SCHEMA_VERSION,
    project: {
      id: project.id,
      name: project.name,
      createdAt: base.project.createdAt,
      updatedAt: now,
      revision,
    },
    workspace: base.workspace,
    breakpoints: base.breakpoints,
    variables: base.variables,
    pages: [page],
    variants: ddVariants,
    history: base.history,
    integrity: {
      hash: "",
      generator: base.integrity.generator,
    },
  };
}

// ── Convert .dd project file → runtime state ──────────────

export function projectFileToState(file: DDProjectFile): {
  project: DDProject;
  variants: VariantData[];
  feedbackItems: FeedbackItem[];
} {
  const project: DDProject = {
    id: file.project.id,
    name: file.project.name,
    createdAt: new Date(file.project.createdAt).getTime(),
    updatedAt: new Date(file.project.updatedAt).getTime(),
    appUrl: typeof window !== "undefined" ? window.location.origin : "",
    saved: true,
  };

  const variants: VariantData[] = file.variants.map((v) => ({
    id: v.id,
    name: v.name,
    html: v.content.html,
    css: v.content.styles,
    mockData: { images: [], texts: [] },
    sourceType: v.sourceElementId ? "component" : "page",
    sourceElementId: v.sourceElementId,
    sourcePageRoute: file.pages.find((p) => p.id === v.pageId)?.route,
    parentId: v.parentId || null,
    status: v.status || "draft",
    createdAt: new Date(v.createdAt).getTime(),
    sourceViewportWidth: v.sourceViewportWidth,
    sourceContentHeight: v.sourceContentHeight,
  }));

  const feedbackItems: FeedbackItem[] = file.variants.flatMap((v) =>
    v.feedback.map((f) => ({
      id: f.id,
      variantId: v.id,
      elementId: f.elementId || "",
      elementSelector: "",
      elementTag: "",
      elementClasses: [],
      comment: f.text,
      intent: "change" as const,
      severity: f.severity === "critical" ? "blocking" as const :
                f.severity === "high" ? "important" as const : "suggestion" as const,
      status: "pending" as const,
      timestamp: new Date(f.createdAt).getTime(),
    })),
  );

  return { project, variants, feedbackItems };
}

// ── Serialize to JSON string ───────────────────────────────

export function serializeProjectFile(file: DDProjectFile): string {
  return JSON.stringify(file, null, 2);
}

// ── Parse from JSON string ─────────────────────────────────

export function parseProjectFile(json: string): DDValidationResult {
  try {
    const raw = JSON.parse(json);
    // Try migration first
    if (raw.schemaVersion && raw.schemaVersion < DD_PROJECT_SCHEMA_VERSION) {
      const migrated = migrateProjectFile(raw);
      if (migrated) return { valid: true, data: migrated };
      return { valid: false, errors: ["Migration failed for schema version " + raw.schemaVersion] };
    }
    return validateDDProjectFile(raw);
  } catch (err) {
    return { valid: false, errors: [`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`] };
  }
}

declare const __VERSION__: string;
