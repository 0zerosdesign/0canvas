// Pure TypeScript types for the .dd project file format.
// Extracted from the main DesignDead codebase (dd-project.ts, store.tsx).
// No runtime dependencies — types only.

export type DDProjectFile = {
  $schema?: string;
  schemaVersion: number;
  project: DDProjectMeta;
  workspace: DDWorkspaceMeta;
  breakpoints: DDBreakpointsConfig;
  variables: Record<string, string | number | boolean | null>;
  pages: DDPage[];
  variants: DDVariant[];
  history: DDHistory;
  integrity: DDIntegrity;
  canvas?: DDCanvasLayout;
};

export type DDProjectMeta = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type DDWorkspaceMeta = {
  root: string;
  entryFiles: string[];
  framework: "react" | "next" | "vue" | "nuxt" | "svelte" | "solid" | "angular" | "astro" | "unknown";
  pathAliases: Record<string, string>;
};

export type DDBreakpointsConfig = {
  desktop: number;
  laptop: number;
  tablet: number;
  mobile: number;
};

export type DDPage = {
  id: string;
  name: string;
  route: string;
  source: {
    html: string;
    styles: string;
    assets: string[];
  };
  layers: DDLayerNode[];
  fileMap: DDFileMapEntry[];
  canvasPosition?: { x: number; y: number };
};

export type DDLayerNode = {
  id: string;
  tag: string;
  selector?: string;
  textPreview?: string;
  classes?: string[];
  attrs?: Record<string, string>;
  children: DDLayerNode[];
};

export type DDFileMapEntry = {
  elementId: string;
  filePath: string;
  componentName?: string;
  framework?: string;
  confidence: number;
  reasons?: string[];
};

export type DDVariant = {
  id: string;
  pageId: string;
  name: string;
  sourceElementId: string | null;
  sourceViewportWidth: number;
  viewport: { width: number; height: number };
  content: { html: string; styles: string };
  annotations: DDAnnotation[];
  feedback: DDFeedback[];
  parentId?: string | null;
  status?: "draft" | "finalized" | "sent" | "pushed";
  createdAt: string;
  updatedAt: string;
  canvasPosition?: { x: number; y: number };
  canvasSize?: { width: number; height: number };
};

export type DDAnnotation = {
  id: string;
  elementId: string;
  author?: string;
  text: string;
  createdAt: string;
  resolved?: boolean;
};

export type DDFeedback = {
  id: string;
  text: string;
  author?: string;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  elementId?: string;
  createdAt: string;
};

export type DDHistory = {
  checkpoints: DDCheckpoint[];
  lastCheckpointAt: string | null;
};

export type DDCheckpoint = {
  id: string;
  createdAt: string;
  revision: number;
  label: string;
  note?: string;
};

export type DDIntegrity = {
  hash: string;
  generator: string;
};

export type DDCanvasLayout = {
  viewport?: { x: number; y: number; zoom: number };
  pageNodePositions?: Record<string, { x: number; y: number }>;
};
