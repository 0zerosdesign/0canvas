// ──────────────────────────────────────────────────────────
// CSS File Writer — Write CSS property changes to disk
// ──────────────────────────────────────────────────────────
//
// Given a file path, line number, CSS property, and new value,
// updates the declaration in place while preserving formatting.
//
// After the write, Vite HMR detects the change and hot-reloads.
//
// ──────────────────────────────────────────────────────────

import * as fs from "fs";
import * as path from "path";

export interface WriteResult {
  success: boolean;
  file?: string;
  line?: number;
  error?: string;
}

export class CSSFileWriter {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Update a CSS property value at a specific file and line.
   * Preserves whitespace, comments, and surrounding formatting.
   */
  write(
    filePath: string,
    line: number,
    property: string,
    newValue: string
  ): WriteResult {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.workspaceRoot, filePath);

    // Validate file exists
    if (!fs.existsSync(absPath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(absPath, "utf-8");
    const lines = content.split("\n");

    // Validate line number
    const idx = line - 1; // 1-based to 0-based
    if (idx < 0 || idx >= lines.length) {
      return { success: false, error: `Line ${line} out of range (file has ${lines.length} lines)` };
    }

    const targetLine = lines[idx];
    const kebabProperty = this.toKebabCase(property);

    // Match: "  property: oldValue;" or "  property: oldValue" (no semicolon at EOF)
    const regex = new RegExp(
      `^(\\s*${this.escapeForRegex(kebabProperty)}\\s*:\\s*)([^;!]*)(\\s*(?:![^;]*)?;?.*)$`,
      "i"
    );
    const match = targetLine.match(regex);

    if (!match) {
      return {
        success: false,
        error: `Property "${kebabProperty}" not found on line ${line}: "${targetLine.trim()}"`,
      };
    }

    // Replace only the value part, preserving leading whitespace, property name, and trailing semicolon/!important
    lines[idx] = match[1] + newValue + match[3];

    // Write back atomically (write to temp, then rename)
    const tmpPath = absPath + ".0canvas-tmp";
    try {
      fs.writeFileSync(tmpPath, lines.join("\n"), "utf-8");
      fs.renameSync(tmpPath, absPath);
    } catch (err) {
      // Cleanup temp file if rename failed
      try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
      return {
        success: false,
        error: `Write failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return {
      success: true,
      file: path.relative(this.workspaceRoot, absPath),
      line,
    };
  }

  /**
   * Add a new property declaration to a CSS rule block.
   * Finds the selector, then inserts the property before the closing brace.
   */
  addProperty(
    filePath: string,
    selectorLine: number,
    property: string,
    value: string
  ): WriteResult {
    const absPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(this.workspaceRoot, filePath);

    if (!fs.existsSync(absPath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }

    const content = fs.readFileSync(absPath, "utf-8");
    const lines = content.split("\n");
    const kebabProperty = this.toKebabCase(property);

    // Find the closing brace of this rule block
    let depth = 0;
    let closingBraceLine = -1;

    for (let i = selectorLine - 1; i < lines.length; i++) {
      for (const ch of lines[i]) {
        if (ch === "{") depth++;
        if (ch === "}") {
          depth--;
          if (depth === 0) {
            closingBraceLine = i;
            break;
          }
        }
      }
      if (closingBraceLine !== -1) break;
    }

    if (closingBraceLine === -1) {
      return { success: false, error: "Could not find closing brace for rule block" };
    }

    // Detect indentation from existing properties
    let indent = "  ";
    for (let i = selectorLine; i < closingBraceLine; i++) {
      const propMatch = lines[i].match(/^(\s+)\S/);
      if (propMatch) {
        indent = propMatch[1];
        break;
      }
    }

    // Insert new property before the closing brace
    const newLine = `${indent}${kebabProperty}: ${value};`;
    lines.splice(closingBraceLine, 0, newLine);

    try {
      fs.writeFileSync(absPath, lines.join("\n"), "utf-8");
    } catch (err) {
      return {
        success: false,
        error: `Write failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    return {
      success: true,
      file: path.relative(this.workspaceRoot, absPath),
      line: closingBraceLine + 1,
    };
  }

  private toKebabCase(str: string): string {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
  }

  private escapeForRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
