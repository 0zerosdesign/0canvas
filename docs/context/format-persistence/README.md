# Module: .0c File Format & Persistence

> **🚧 Partially stale (2026-04-20).** The `.0c` schema below is still
> current. The "IndexedDB primary" paragraphs are obsolete — the Mac
> app is file-first via `src/native/storage.ts`. IDB is only used for
> ephemeral UI state. See [../README.md](../README.md) for full status.

---

> **Source files:**
> - `src/0canvas/format/oc-project.ts` -- schema, validation, migration, conversion
> - `src/0canvas/format/oc-project-store.ts` -- IndexedDB + filesystem sync
> - `src/0canvas/format/oc-format.ts` -- variant node format (OCDocument / OCNode)
> - `src/0canvas/format/oc-parser.ts` -- HTML/CSS to OC tree conversion

---

## Overview

A `.0c` file is the canonical representation of an entire 0canvas project. It is a JSON document containing metadata, workspace config, breakpoints, variables, pages, variants, annotations, feedback, history checkpoints, and integrity hashes. The format is designed to be portable (git-friendly), self-validating (Zod schemas + SHA-256 integrity), and dual-persisted (IndexedDB for speed, filesystem for portability).

---

## 1. OCProjectFile Schema

The top-level schema is defined via Zod in `oc-project.ts` and exported as `OCProjectFileSchema`. The current schema version is **1** (`OC_PROJECT_SCHEMA_VERSION = 1`).

### Top-level structure

```
OCProjectFile {
  $schema?:        string (URL, optional)
  schemaVersion:   1 (literal)
  project:         ProjectMeta
  workspace:       WorkspaceMeta
  breakpoints:     BreakpointsConfig
  variables:       Record<string, string | number | boolean | null>
  pages:           Page[] (min 1)
  variants:        Variant[]
  history:         History
  integrity:       Integrity
}
```

### ProjectMeta

| Field       | Type     | Constraint               |
|-------------|----------|--------------------------|
| `id`        | string   | `^[A-Za-z0-9._:\-]+$`   |
| `name`      | string   | min length 1             |
| `createdAt` | string   | ISO 8601 datetime        |
| `updatedAt` | string   | ISO 8601 datetime        |
| `revision`  | number   | integer >= 0             |

### WorkspaceMeta

| Field         | Type                    | Notes                                                                                  |
|---------------|-------------------------|----------------------------------------------------------------------------------------|
| `root`        | string                  | Project root path (typically `.`)                                                      |
| `entryFiles`  | string[]                | Min 1, e.g. `["src/main.tsx"]`                                                         |
| `framework`   | enum                    | `react`, `next`, `vue`, `nuxt`, `svelte`, `solid`, `angular`, `astro`, `unknown`       |
| `pathAliases` | Record<string, string>  | e.g. `{ "@": "src" }`                                                                   |

### BreakpointsConfig

Default values (from `DEFAULT_PROJECT_BREAKPOINTS`):

| Breakpoint | Default |
|------------|---------|
| desktop    | 1280    |
| laptop     | 1024    |
| tablet     | 768     |
| mobile     | 390     |

### Page

```
Page {
  id:     string
  name:   string
  route:  string
  source: { html: string, styles: string, assets: string[] }
  layers: LayerNode[]
}
```

`LayerNode` is a recursive tree:
```
LayerNode {
  id:          string
  tag:         string
  selector?:   string
  textPreview?: string
  classes?:    string[]
  attrs?:      Record<string, string>
  children:    LayerNode[]
}
```

### Variant

```
Variant {
  id:                  string
  pageId:              string
  name:                string
  sourceElementId:     string | null
  sourceViewportWidth: number (int >= 1)
  sourceContentHeight?: number (int >= 0)
  viewport:            { width: int, height: int }
  content:             { html: string, styles: string }
  annotations:         Annotation[]
  feedback:            Feedback[]
  parentId?:           string | null
  status:              "draft" | "finalized" | "sent" | "pushed" (default: "draft")
  createdAt:           ISO datetime
  updatedAt:           ISO datetime
}
```

### Annotation

```
Annotation {
  id:         string
  elementId:  string
  author?:    string
  text:       string
  createdAt:  ISO datetime
  resolved:   boolean (default: false)
}
```

### Feedback (file-level)

```
Feedback {
  id:         string
  text:       string
  author?:    string
  severity?:  "info" | "low" | "medium" | "high" | "critical"
  elementId?: string
  createdAt:  ISO datetime
}
```

### History

```
History {
  checkpoints:      Checkpoint[]
  lastCheckpointAt: ISO datetime | null
}

Checkpoint {
  id:        string
  createdAt: ISO datetime
  revision:  number (int >= 0)
  label:     string
  note?:     string
}
```

### Integrity

```
Integrity {
  hash:      string  (SHA-256 or FNV-1a fallback)
  generator: string  (e.g. "0canvas@0.0.1")
}
```

---

## 2. Zod Validation Pipeline

All data entering or leaving the `.0c` format passes through Zod validation.

- **`validateOCProjectFile(input)`** -- returns `{ valid: true, data }` or `{ valid: false, errors: string[] }`. Errors include the dot-path and message for each issue.
- **`parseProjectFile(json: string)`** -- parses JSON string, attempts migration if `schemaVersion < current`, then validates.
- **`migrateProjectFile(raw)`** -- runs sequential migrations from the document's version to the current version. Returns `null` if migration is impossible. Migration functions are registered in the `MIGRATIONS` record (currently empty for v1).

---

## 3. Dual Persistence: IndexedDB + Filesystem

### IndexedDB (fast, live)

The store uses the `idb` library to manage an IndexedDB database named `"0canvas-projects"` (version 1) with two object stores:

| Store            | Key Path       | Purpose                        |
|------------------|----------------|--------------------------------|
| `oc-projects`    | `project.id`   | Full OCProjectFile documents   |
| `oc-sync-meta`   | `projectId`    | Sync metadata per project      |

**CRUD operations:**

| Function              | Description                                            |
|-----------------------|--------------------------------------------------------|
| `saveProjectFile()`   | Computes SHA-256 hash, stores with integrity           |
| `loadProjectFile()`   | Loads by project ID, validates before returning        |
| `listProjectFiles()`  | Returns all valid project files                        |
| `deleteProjectFile()` | Deletes project and its sync metadata                  |

### Filesystem (portable, git)

Filesystem sync happens via a WebSocket bridge to a VS Code extension. The bridge sender is registered with `setBridgeSender()` when the connection opens.

**`syncToFilesystem(file)`** sends a `PROJECT_STATE_SYNC` message containing:
- `projectFile`: serialized JSON string
- `filePath`: derived from project name (e.g. `my_project.0c`)
- `projectId`: the project's unique ID

The filename is derived by `projectToFileName()`: lowercased, non-alphanumeric chars replaced with `_`, appended with `.0c`.

### Sync Metadata

```
OCSyncMeta {
  projectId:          string
  lastSyncedRevision: number
  lastSyncedAt:       ISO datetime
  dirty:              boolean
  filePath?:          string
}
```

- `markDirty(projectId)` -- flags a project as having unsaved changes
- `markSynced(projectId, revision)` -- clears the dirty flag after successful sync

---

## 4. Auto-Save Pipeline

Auto-save is triggered by `scheduleAutoSave()`, which watches runtime state changes.

### Debounce timers

| Target      | Debounce | Trigger                                     |
|-------------|----------|---------------------------------------------|
| IndexedDB   | 500ms    | Any state change (variants, feedback, etc.)  |
| Filesystem  | 1000ms   | After IndexedDB save, via bridge             |

### Flow

```
Runtime state change
  --> scheduleAutoSave() [500ms debounce]
    --> stateToProjectFile() [convert runtime -> .0c]
    --> saveProjectFile() [IndexedDB + SHA-256 hash]
    --> markDirty(projectId)
    --> syncToFilesystem() [1000ms debounce]
      --> bridge.send({ type: "PROJECT_STATE_SYNC", ... })
        --> VS Code extension writes .0c file to disk
```

---

## 5. State Conversion Functions

### `stateToProjectFile(project, variants, feedbackItems, currentRoute, existingFile?)`

Converts runtime state to a `.0c` project file:
- Increments the revision number
- Maps runtime `VariantData[]` to `OCVariant[]` (including feedback severity mapping: blocking->critical, important->high, else->medium)
- Maps runtime `FeedbackItem[]` into per-variant feedback arrays
- Preserves workspace, breakpoints, variables, and history from the existing file (or creates defaults)
- Sets integrity hash to empty (computed later by `saveProjectFile`)

### `projectFileToState(file)`

Converts a `.0c` file back to runtime state:
- Creates an `OCProject` with numeric timestamps
- Maps `OCVariant[]` back to `VariantData[]` with sourceType detection (component if sourceElementId exists, else page)
- Flattens per-variant feedback into a flat `FeedbackItem[]` array with severity reverse-mapping

---

## 6. Import/Export Flow

### Export (Download as .0c)

`downloadProjectFile(file)` serializes the project file to JSON, creates a Blob, and triggers a browser download with filename `{sanitized_name}.0c`.

### Import (File Picker)

`importProjectFile()` creates a hidden `<input type="file" accept=".0c,.json">`, reads the selected file as text, parses and validates it, saves to IndexedDB, and returns the parsed file. Returns `null` on cancel or validation failure.

---

## 7. Project Hash Integrity (SHA-256)

`computeProjectHash(doc)` computes a hash of the entire project file **excluding** the `integrity` field:

1. Strips the `integrity` property
2. JSON-stringifies the remainder
3. Uses `crypto.subtle.digest("SHA-256", ...)` if available (returns `"sha256-{hex}"`)
4. Falls back to FNV-1a hash for environments without SubtleCrypto (returns `"fnv1a-{hex}"`)

The hash is computed and stored every time `saveProjectFile()` is called.

---

## 8. The .0c Variant Format (OCDocument / OCNode)

In addition to the project-level `.0c` file, there is a lower-level **variant format** defined in `oc-format.ts`. This is a structured JSON representation of UI variants optimized for AI agents:

### OCDocument

```
OCDocument {
  version:      string (e.g. "0.1.0")
  name:         string
  source:       { type: "page"|"component", selector?, route?, elementId? }
  variables?:   Record<string, OCVariable>
  breakpoints?: OCBreakpoints
  tree:         OCNode[]
}
```

### OCNode

```
OCNode {
  id:          string
  tag:         string
  name?:       string
  class?:      string
  href?, src?, alt?, type?, placeholder?: string
  text?:       string (leaf text content)
  styles?:     OCStyles (CSS properties as camelCase keys)
  responsive?: { [breakpoint]: Partial<OCStyles> }
  children?:   OCNode[]
}
```

### OCStyles

Supports all common CSS properties as typed fields: layout (display, flexDirection, gap, gridTemplateColumns), spacing (padding, margin as single value or 4-value tuple), sizing (width, height, min/max), typography (fontSize, fontWeight, fontFamily, lineHeight, letterSpacing, textAlign, textDecoration), color (color, backgroundColor), border (borderRadius, border, borderColor, borderWidth), effects (boxShadow, opacity, transform, transition, backdropFilter), position (position, top/right/bottom/left, zIndex), overflow. Values can be strings, numbers, or `$variable.name` references.

### Tree Operations

`oc-format.ts` provides helper functions:
- `findNodeById(tree, id)` -- recursive search
- `updateNodeById(tree, id, updates)` -- in-place patch
- `deleteNodeById(tree, id)` -- removal with splice
- `insertNode(tree, parentId, node, position?)` -- child insertion
- `countOCNodes(tree)` -- recursive count

---

## 9. HTML/CSS to OC Conversion (oc-parser.ts)

### `htmlToOCDocument(html, css, name, source)`

Parses HTML + CSS into an OCDocument by:
1. Creating a hidden iframe (1280x800) with the content
2. Walking all elements in `<body>`, extracting computed styles and attributes
3. Building the OCNode tree recursively (ignoring SCRIPT, STYLE, LINK, META, HEAD, NOSCRIPT, BR, WBR)
4. Extracting CSS custom properties (--var-name) from the CSS text and auto-detecting type (color, number, string)
5. Cleaning up the iframe

### `ocDocumentToHtml(doc)`

Renders an OCDocument back to `{ html, css }`:
1. Renders each node to HTML with inline styles (resolved from OCStyles)
2. Generates `:root {}` block from variables
3. Generates `@media` rules from responsive overrides using breakpoint definitions
4. Uses `data-oc-id` attributes for node identification

---

## 10. Sync Flow Summary

```
Browser State (store.tsx)
  |
  v
stateToProjectFile()          -- runtime -> .0c JSON
  |
  v
saveProjectFile()             -- write to IndexedDB (500ms debounce)
  |
  v
syncToFilesystem()            -- send via WebSocket bridge (1000ms debounce)
  |
  v
VS Code Extension             -- writes .0c file to workspace root
  |
  v
Git-trackable .0c file        -- portable, version-controlled
```

On load, the reverse path:
```
IndexedDB (or imported .0c file)
  |
  v
projectFileToState()          -- .0c JSON -> runtime state
  |
  v
dispatch(LOAD_FROM_OC_FILE)   -- hydrates store
```

---

## 11. Pending / Future Work

- **Conflict resolution** -- no merge strategy when IndexedDB and filesystem diverge
- **`.0c` merge driver** -- custom git merge driver for .0c files
- **Multi-page support** -- currently only `page_main` is used
- **Checkpoint creation** -- history schema exists but no UI to create checkpoints
- **Schema migrations** -- v1 -> v2 migrators not yet needed (MIGRATIONS record is empty)
- **Layer tree persistence** -- layers are in the schema but not actively synced from runtime
