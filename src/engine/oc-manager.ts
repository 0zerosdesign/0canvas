// ──────────────────────────────────────────────────────────
// .0c File Manager — Server-side CRUD for design project files
// ──────────────────────────────────────────────────────────
//
// Manages .0c files on disk. Replaces the browser's IndexedDB
// persistence with direct filesystem operations.
//
// Reuses the format/serialization functions from
// src/0canvas/format/oc-project.ts (pure TypeScript).
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import { findOCFiles } from "./discovery";
import { detectFramework, type Framework } from "./framework-detector";

export interface OCProjectMeta {
  path: string;        // absolute path
  relPath: string;     // relative to project root
  content: unknown;    // parsed JSON
}

export class OCManager {
  constructor(private root: string) {}

  /**
   * Find all .0c files in the project and return their parsed contents.
   */
  async listProjects(): Promise<OCProjectMeta[]> {
    const files = await findOCFiles(this.root);
    const results: OCProjectMeta[] = [];

    for (const absPath of files) {
      try {
        const raw = fs.readFileSync(absPath, "utf-8");
        const content = JSON.parse(raw);
        results.push({
          path: absPath,
          relPath: path.relative(this.root, absPath),
          content,
        });
      } catch {
        // Skip unparseable files
      }
    }

    return results;
  }

  /**
   * Read a specific .0c file. Returns null if not found or invalid.
   */
  readProject(filePath: string): unknown | null {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.root, filePath);

    try {
      const raw = fs.readFileSync(absPath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Write/update a .0c file to disk (atomic write).
   */
  writeProject(filePath: string, content: string): boolean {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.root, filePath);

    const tmpPath = absPath + ".0canvas-tmp";
    try {
      // Ensure directory exists
      const dir = path.dirname(absPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(tmpPath, content, "utf-8");
      fs.renameSync(tmpPath, absPath);
      return true;
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      console.error(`[0canvas] Failed to write .0c file:`, err);
      return false;
    }
  }

  /**
   * Create a new .0c project file with auto-detected workspace info.
   * Returns the relative path of the created file.
   */
  createProject(name: string): string {
    const detection = detectFramework(this.root);
    const fileName = sanitizeFileName(name) + ".0c";
    const absPath = path.join(this.root, fileName);

    if (fs.existsSync(absPath)) {
      throw new Error(`Project file already exists: ${fileName}`);
    }

    const projectId = generateProjectId();
    const now = new Date().toISOString();

    const projectFile = {
      schemaVersion: 1,
      project: {
        id: projectId,
        name,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      },
      workspace: {
        root: this.root,
        entryFiles: detection.entryFiles,
        framework: detection.framework,
        pathAliases: {},
      },
      breakpoints: {
        desktop: { label: "Desktop", width: 1440, height: 900 },
        laptop: { label: "Laptop", width: 1280, height: 800 },
        tablet: { label: "Tablet", width: 768, height: 1024 },
        mobile: { label: "Mobile", width: 375, height: 812 },
      },
      variables: {},
      pages: [],
      variants: [],
      history: { checkpoints: [], lastCheckpointAt: null },
      integrity: { hash: "", generator: "0canvas-engine" },
    };

    const content = JSON.stringify(projectFile, null, 2);
    this.writeProject(absPath, content);

    return fileName;
  }

  /**
   * Delete a .0c file from disk.
   */
  deleteProject(filePath: string): boolean {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.root, filePath);

    try {
      if (fs.existsSync(absPath)) {
        fs.unlinkSync(absPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

function generateProjectId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "proj_";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    || "project";
}
