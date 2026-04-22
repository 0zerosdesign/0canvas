// ──────────────────────────────────────────────────────────
// File Discovery — Find CSS, JSX, and .0c files
// ──────────────────────────────────────────────────────────
//
// Replaces vscode.workspace.findFiles() with tinyglobby.
// Returns absolute paths sorted with src/ files first.
//
// ──────────────────────────────────────────────────────────

import { glob } from "tinyglobby";

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/build/**",
  "**/.zeros/**",
  "**/.git/**",
];

function sortSrcFirst(files: string[]): string[] {
  return files.sort((a, b) => {
    const aInSrc = a.includes("/src/") ? 0 : 1;
    const bInSrc = b.includes("/src/") ? 0 : 1;
    return aInSrc - bInSrc;
  });
}

export async function findCSSFiles(root: string): Promise<string[]> {
  const files = await glob(["**/*.css"], {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE,
  });
  return sortSrcFirst(files);
}

export async function findJSXFiles(root: string): Promise<string[]> {
  const files = await glob(["**/*.{tsx,jsx}"], {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE,
  });
  return sortSrcFirst(files);
}

export async function findOCFiles(root: string): Promise<string[]> {
  const files = await glob(["**/*.0c"], {
    cwd: root,
    absolute: true,
    ignore: ["**/node_modules/**"],
  });
  return files;
}

export async function findSourceFiles(root: string): Promise<string[]> {
  const files = await glob(["**/*.{tsx,ts,jsx,js}"], {
    cwd: root,
    absolute: true,
    ignore: DEFAULT_IGNORE,
  });
  return sortSrcFirst(files);
}
