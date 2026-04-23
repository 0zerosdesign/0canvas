/**
 * Build script: ux-bites.jsonl → knowledge-base.json
 *
 * Run: npx tsx src/app/internal/scripts/build-kb.ts
 *
 * Reads the full 4MB JSONL and produces a lean JSON file
 * with only the fields the agent needs for context matching.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUT = resolve(
  __dirname,
  "../../../../Dataaset training/ux-bites/data/ux-bites.jsonl",
);
const OUTPUT = resolve(__dirname, "../knowledge-base.json");

interface KBEntry {
  id: string;
  title: string;
  company: string;
  summary: string;
  analysis: string | null;
  ui_elements: string[];
  patterns: string[];
  tags: string[];
}

const lines = readFileSync(INPUT, "utf-8").trim().split("\n");
const entries: KBEntry[] = [];

for (const line of lines) {
  const d = JSON.parse(line);

  const patterns: string[] = d.vision?.interaction_pattern || [];
  const uiElements: string[] = d.vision?.ui_elements || [];

  // Build tags from multiple sources
  const tags = new Set<string>();
  for (const p of patterns) tags.add(p.toLowerCase());
  if (d.vision?.notable_text) {
    for (const t of d.vision.notable_text) {
      if (t.length > 2 && t.length < 40) tags.add(t.toLowerCase());
    }
  }

  entries.push({
    id: d.id,
    title: d.title || "",
    company: d.company?.name || "",
    summary: d.content?.summary_text || "",
    analysis: d.content?.analysis_text || null,
    ui_elements: uiElements,
    patterns,
    tags: Array.from(tags),
  });
}

const output = {
  version: 1,
  source: "builtformars/ux-bites",
  generated: new Date().toISOString(),
  count: entries.length,
  entries,
};

writeFileSync(OUTPUT, JSON.stringify(output));

const sizeKB = Math.round(Buffer.byteLength(JSON.stringify(output)) / 1024);
console.log(`Built knowledge-base.json: ${entries.length} entries, ${sizeKB}KB`);
