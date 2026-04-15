// ──────────────────────────────────────────────────────────
// Tailwind Writer — Modify className in JSX/TSX source files
// ──────────────────────────────────────────────────────────
//
// Ported from extensions/vscode/src/tailwind-writer.ts.
// Only change: vscode.workspace.findFiles() → tinyglobby.
//
// ──────────────────────────────────────────────────────────

import * as fs from "node:fs";
import * as path from "node:path";
import { findJSXFiles } from "./discovery";

export class TailwindWriter {
  constructor(private root: string) {}

  /**
   * Add or remove a Tailwind class from a JSX/TSX element.
   * Searches source files for the element's className and modifies it.
   */
  async writeClassChange(
    selector: string,
    action: "add" | "remove",
    className: string
  ): Promise<{ success: boolean; file?: string; error?: string }> {
    try {
      // Extract class names from selector (e.g., "div.flex.gap-4" → ["flex", "gap-4"])
      const selectorClasses = selector.match(/\.[\w-]+/g)?.map((c) => c.slice(1)) || [];

      if (selectorClasses.length === 0) {
        return { success: false, error: "No classes in selector to search for" };
      }

      const files = await findJSXFiles(this.root);

      for (const filePath of files) {
        const content = fs.readFileSync(filePath, "utf-8");

        // Look for className containing our selector classes
        // Match patterns: className="...", className={`...`}, className={clsx(...)}
        const classNameRegex = /className[=](?:"([^"]+)"|{`([^`]+)`}|{[^}]*["']([^"']+)["'][^}]*})/g;
        let match: RegExpExecArray | null;

        while ((match = classNameRegex.exec(content)) !== null) {
          const classString = match[1] || match[2] || match[3];
          if (!classString) continue;

          // Check if this className contains enough of the selector classes
          const classesInString = classString.split(/\s+/);
          const matchCount = selectorClasses.filter((c) => classesInString.includes(c)).length;

          // Require at least 2 classes to match (or all if selector has < 2)
          const threshold = Math.min(2, selectorClasses.length);
          if (matchCount < threshold) continue;

          // Found the element — modify the className
          let newClassString: string;
          if (action === "add") {
            if (classesInString.includes(className)) continue; // already has it
            newClassString = classString + " " + className;
          } else {
            newClassString = classesInString.filter((c) => c !== className).join(" ");
          }

          // Replace in source
          const newContent = content.slice(0, match.index) +
            content.slice(match.index, match.index + match[0].length)
              .replace(classString, newClassString) +
            content.slice(match.index + match[0].length);

          fs.writeFileSync(filePath, newContent, "utf-8");

          const relPath = path.relative(this.root, filePath);
          console.log(`[0canvas] Tailwind: ${action} "${className}" in ${relPath}`);

          return {
            success: true,
            file: relPath,
          };
        }
      }

      return {
        success: false,
        error: `Could not find element with classes [${selectorClasses.join(", ")}] in any JSX/TSX file`,
      };
    } catch (err) {
      return {
        success: false,
        error: `Tailwind write failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
