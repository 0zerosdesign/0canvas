// ──────────────────────────────────────────────────────────
// CSS Source Resolver — Find where a CSS selector lives on disk
// ──────────────────────────────────────────────────────────
//
// Given a CSS selector and property, walks all .css files in the
// workspace to find the file path and line number of the declaration.
//
// Phase 1: Regex + brace-depth approach for plain CSS.
//
// ──────────────────────────────────────────────────────────

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export interface SourceLocation {
  file: string;     // relative path from workspace root
  absPath: string;  // absolute path
  line: number;     // 1-based line number of the property declaration
  column: number;   // 0-based column
  selector: string; // the matched selector text
}

export class CSSSourceResolver {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Find the source location where a CSS selector declares a property.
   * Returns null if not found.
   */
  async resolve(
    selector: string,
    property: string
  ): Promise<SourceLocation | null> {
    // Find all CSS files in workspace
    const cssFiles = await vscode.workspace.findFiles(
      "**/*.css",
      "{**/node_modules/**,**/dist/**,**/.next/**,**/build/**}"
    );

    // Sort: prefer src/ files over others
    const sorted = cssFiles.sort((a, b) => {
      const aInSrc = a.fsPath.includes("/src/") ? 0 : 1;
      const bInSrc = b.fsPath.includes("/src/") ? 0 : 1;
      return aInSrc - bInSrc;
    });

    // Generate selector variants to search for
    const variants = this.selectorVariants(selector);

    for (const uri of sorted) {
      const content = fs.readFileSync(uri.fsPath, "utf-8");
      const location = this.findInCSS(content, variants, property);
      if (location) {
        return {
          file: path.relative(this.workspaceRoot, uri.fsPath),
          absPath: uri.fsPath,
          line: location.line,
          column: location.column,
          selector: location.matchedSelector,
        };
      }
    }

    return null;
  }

  /**
   * Generate selector variants to match against CSS files.
   * E.g., "button.primary" → ["button.primary", ".primary", "button"]
   */
  private selectorVariants(selector: string): string[] {
    const variants: string[] = [selector];

    // Extract class names
    const classMatch = selector.match(/\.[\w-]+/g);
    if (classMatch) {
      // Individual classes
      for (const cls of classMatch) {
        if (!variants.includes(cls)) variants.push(cls);
      }
    }

    // Extract tag name
    const tagMatch = selector.match(/^(\w[\w-]*)/);
    if (tagMatch && tagMatch[1] !== selector) {
      variants.push(tagMatch[1]);
    }

    // Extract ID
    const idMatch = selector.match(/#[\w-]+/);
    if (idMatch) {
      variants.push(idMatch[0]);
    }

    return variants;
  }

  /**
   * Search CSS content for a selector variant that contains the given property.
   */
  private findInCSS(
    css: string,
    selectorVariants: string[],
    property: string
  ): { line: number; column: number; matchedSelector: string } | null {
    const lines = css.split("\n");
    const kebabProperty = this.toKebabCase(property);

    for (const variant of selectorVariants) {
      const escapedVariant = this.escapeForRegex(variant);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check if this line contains the selector and an opening brace
        // or contains the selector with brace on a subsequent line
        if (!this.lineMatchesSelector(line, escapedVariant)) continue;

        // Find the opening brace (might be on this line or next lines)
        let braceLineIdx = i;
        while (braceLineIdx < lines.length && !lines[braceLineIdx].includes("{")) {
          braceLineIdx++;
        }
        if (braceLineIdx >= lines.length) continue;

        // Now find the property inside this rule block
        const propertyLine = this.findPropertyInBlock(
          lines,
          braceLineIdx,
          kebabProperty
        );
        if (propertyLine !== null) {
          return {
            line: propertyLine + 1, // 1-based
            column: lines[propertyLine].search(/\S/),
            matchedSelector: variant,
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a line contains a CSS selector (not inside a comment or string).
   */
  private lineMatchesSelector(line: string, escapedSelector: string): boolean {
    // Skip comment-only lines
    const trimmed = line.trim();
    if (trimmed.startsWith("/*") || trimmed.startsWith("//") || trimmed.startsWith("*")) {
      return false;
    }

    // Match the selector — it should appear as a standalone token
    const regex = new RegExp(`(^|[\\s,>+~{])${escapedSelector}([\\s,>+~{.:[]|$)`);
    return regex.test(line);
  }

  /**
   * Starting from a line with `{`, find a property declaration inside the block.
   * Tracks brace depth so we don't leak into nested rules.
   */
  private findPropertyInBlock(
    lines: string[],
    startLine: number,
    property: string
  ): number | null {
    let depth = 0;
    let started = false;

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];

      for (const ch of line) {
        if (ch === "{") {
          depth++;
          started = true;
        }
        if (ch === "}") depth--;
      }

      // We're inside the top-level block (depth === 1) when looking for properties
      if (started && depth === 1) {
        const trimmed = line.trim();
        // Match property declaration: "  property: value;" or "  property : value;"
        const propRegex = new RegExp(
          `^\\s*${this.escapeForRegex(property)}\\s*:`
        );
        if (propRegex.test(trimmed) || propRegex.test(line)) {
          return i;
        }
      }

      // Block closed
      if (started && depth <= 0) break;
    }

    return null;
  }

  private toKebabCase(str: string): string {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
  }

  private escapeForRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
