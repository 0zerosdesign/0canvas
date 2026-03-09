// ──────────────────────────────────────────────────────────
// Build srcDoc — Shared iframe preview content builder
// ──────────────────────────────────────────────────────────

/**
 * Build a sandboxed HTML document from variant HTML + CSS.
 * Filters out DesignDead/ReactFlow internal styles.
 * Used by both the browser variant-node and VS Code extension.
 */
export function buildSrcDoc(html: string, css: string): string {
  const importRules: string[] = [];
  const otherRules: string[] = [];

  for (const line of css.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("@import")) {
      importRules.push(line);
    } else if (
      !line.includes("[data-designdead") &&
      !line.includes(".react-flow") &&
      !line.includes("--xy-") &&
      !line.includes("--dd-")
    ) {
      otherRules.push(line);
    }
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>${importRules.join("\n")}</style>
<style>
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;overflow:auto;width:100%;min-height:100%;}
${otherRules.join("\n")}
</style>
</head>
<body>${html}</body>
</html>`;
}
