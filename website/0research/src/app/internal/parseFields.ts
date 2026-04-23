/**
 * Parse an AI response (markdown) into structured Feed fields.
 *
 * The AI response follows this format:
 *   **Title**: Pattern name
 *   **Description**: Analysis text (may include inline HTML)
 *   **Insights**: Structured learning content with headings and bullets
 *   **Applications**: App1, App2
 *   **Psychology**: Pattern1, Pattern2
 *   **Industries**: Industry1, Industry2
 *   **AI Patterns**: Pattern1, Pattern2 (optional)
 *   **UI Elements**: Element1, Element2 (optional)
 *   **Tags**: tag1, tag2, tag3
 */

import type { FeedField, FeedFieldKind, M2MItem, InsightBlock } from "./types";
import { getCachedTaxonomy } from "./agent";

// ── Field Configuration ───────────────────────────────────────────

const FIELD_LABELS = [
  "Title",
  "Description",
  "Insights",
  "Applications",
  "App Details",
  "Psychology",
  "Industries",
  "AI Patterns",
  "UI Elements",
  "Tags",
];

const FIELD_CONFIG: Record<string, FeedFieldKind> = {
  title: "text",
  description: "richtext",
  insights: "blocks",
  applications: "m2m",
  app_details: "text", // metadata-only, not emitted as a field
  psychology: "m2m",
  industries: "m2m",
  ai_patterns: "m2m",
  ui_elements: "m2m",
  tags: "tags",
};

const FIELD_PATTERN = new RegExp(
  `\\*\\*(${FIELD_LABELS.join("|")})\\*\\*\\s*:\\s*`,
  "gi",
);

function toKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_");
}

// ── Parse App Details metadata block ──────────────────────────────

interface AppDetailsParsed {
  website_url?: string;
  company?: string;
  short_description?: string;
  platform?: string[];
}

function parseAppDetails(content: string): Map<string, AppDetailsParsed> {
  const map = new Map<string, AppDetailsParsed>();
  const lines = content.split("\n").filter((l) => l.trim().startsWith("-"));
  for (const line of lines) {
    const parts = line.replace(/^\s*-\s*/, "").split("|").map((s) => s.trim());
    if (parts.length >= 1 && parts[0]) {
      map.set(parts[0].toLowerCase(), {
        website_url: parts[1] || undefined,
        company: parts[2] || undefined,
        short_description: parts[3] || undefined,
        platform: parts[4] ? parts[4].split(",").map((p) => p.trim()).filter(Boolean) : undefined,
      });
    }
  }
  return map;
}

// ── Parse M2M items from comma-separated text ─────────────────────

function parseM2MItems(
  content: string,
  type?: string,
  appDetailsMap?: Map<string, AppDetailsParsed>,
): M2MItem[] {
  const taxonomy = getCachedTaxonomy();

  return content
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((rawName) => {
      // Strip [NEW] prefix if AI marked it
      const isMarkedNew = rawName.startsWith("[NEW]");
      const name = isMarkedNew ? rawName.replace(/^\[NEW\]\s*/, "") : rawName;

      // Check if item exists in cached taxonomy
      let isNew = isMarkedNew;
      if (!isNew && taxonomy) {
        const key = type === undefined ? "applications" :
          type === "Psychology" ? "psychology" :
          type === "Industry" ? "industries" :
          type === "AI_Pattern" ? "ai_patterns" :
          type === "UI_Element" ? "ui_elements" : null;
        if (key) {
          const existing = taxonomy[key as keyof typeof taxonomy] || [];
          isNew = !existing.some((e) => e.toLowerCase() === name.toLowerCase());
        }
      }

      // Attach appData for new applications from App Details block
      let appData: M2MItem["appData"] | undefined;
      if (isNew && type === undefined && appDetailsMap) {
        const details = appDetailsMap.get(name.toLowerCase());
        if (details) {
          appData = {
            name,
            short_description: details.short_description,
            website_url: details.website_url,
            company: details.company,
            platform: details.platform,
          };
        }
      }

      return { id: "", name, type, isNew, appData };
    });
}

// ── Parse tags from comma-separated text ──────────────────────────

function parseTags(content: string): string[] {
  return content
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

// ── Parse insights into blocks ────────────────────────────────────

function parseInsightBlocks(content: string): InsightBlock[] {
  const blocks: InsightBlock[] = [];
  let sort = 1;

  const lines = content.split("\n");
  let currentText = "";

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading line (### or ##)
    if (/^#{2,4}\s+/.test(trimmed)) {
      // Flush accumulated text
      if (currentText.trim()) {
        blocks.push({
          id: crypto.randomUUID(),
          collection: "block_rich_text",
          sort: sort++,
          data: { body: currentText.trim() },
        });
        currentText = "";
      }
      const headingText = trimmed.replace(/^#{2,4}\s+/, "");
      const level = trimmed.startsWith("####") ? "h4" : trimmed.startsWith("###") ? "h3" : "h2";
      blocks.push({
        id: crypto.randomUUID(),
        collection: "block_heading",
        sort: sort++,
        data: { title: headingText, level },
      });
    } else if (trimmed) {
      // Accumulate text (including bullet points)
      currentText += (currentText ? "\n" : "") + trimmed;
    }
  }

  // Flush remaining text
  if (currentText.trim()) {
    blocks.push({
      id: crypto.randomUUID(),
      collection: "block_rich_text",
      sort: sort++,
      data: { body: currentText.trim() },
    });
  }

  return blocks;
}

// ── Taxonomy type mapping ─────────────────────────────────────────

const M2M_TAXONOMY_TYPES: Record<string, string> = {
  applications: "App",
  psychology: "Psychology",
  industries: "Industry",
  ai_patterns: "AI_Pattern",
  ui_elements: "UI_Element",
};

// ── Main Parser ───────────────────────────────────────────────────

export function parseFeedFields(markdown: string): FeedField[] | null {
  // Quick check — does this look like a feed response?
  const matches = markdown.match(/\*\*(Title|Description|Insights)\*\*\s*:/gi);
  if (!matches || matches.length < 2) return null;

  const fields: FeedField[] = [];
  const parts = markdown.split(FIELD_PATTERN);

  // First pass: extract App Details block if present
  let appDetailsMap: Map<string, AppDetailsParsed> | undefined;
  for (let i = 1; i < parts.length - 1; i += 2) {
    const rawLabel = parts[i];
    const content = (parts[i + 1] || "").trim();
    if (rawLabel.toLowerCase() === "app details" && content) {
      appDetailsMap = parseAppDetails(content);
      break;
    }
  }

  // Second pass: build fields
  // parts alternates: [prefix, label1, content1, label2, content2, ...]
  for (let i = 1; i < parts.length - 1; i += 2) {
    const rawLabel = parts[i];
    const content = (parts[i + 1] || "").trim();
    const matched = FIELD_LABELS.find(
      (l) => l.toLowerCase() === rawLabel.toLowerCase(),
    );
    if (!matched || !content) continue;

    const key = toKey(matched);
    const kind = FIELD_CONFIG[key] || "text";

    // Skip app_details — it's metadata-only, not a pushable field
    if (key === "app_details") continue;

    const field: FeedField = { key, label: matched, kind, content };

    switch (kind) {
      case "m2m": {
        const taxonomyType = M2M_TAXONOMY_TYPES[key];
        field.items = parseM2MItems(
          content,
          key === "applications" ? undefined : taxonomyType,
          key === "applications" ? appDetailsMap : undefined,
        );
        break;
      }
      case "tags":
        field.tags = parseTags(content);
        break;
      case "blocks":
        field.blocks = parseInsightBlocks(content);
        break;
    }

    fields.push(field);
  }

  return fields.length >= 2 ? fields : null;
}

// ── Parse Regenerated Field ───────────────────────────────────────

export function parseRegeneratedField(markdown: string): FeedField | null {
  const match = markdown.match(/^\[(\w[\w\s]*?) regenerated\]\s*\n+([\s\S]+)/i);
  if (!match) return null;

  const rawLabel = match[1].trim();
  const content = match[2].trim();
  const matched = FIELD_LABELS.find(
    (l) => l.toLowerCase() === rawLabel.toLowerCase(),
  );
  if (!matched || !content) return null;

  const key = toKey(matched);
  const kind = FIELD_CONFIG[key] || "text";

  const field: FeedField = { key, label: matched, kind, content };

  switch (kind) {
    case "m2m": {
      const taxonomyType = M2M_TAXONOMY_TYPES[key];
      field.items = parseM2MItems(content, key === "applications" ? undefined : taxonomyType);
      break;
    }
    case "tags":
      field.tags = parseTags(content);
      break;
    case "blocks":
      field.blocks = parseInsightBlocks(content);
      break;
  }

  return field;
}

// ── Build Regeneration Prompt ─────────────────────────────────────

export function buildRegeneratePrompt(
  field: FeedField,
  userInstructions: string,
  allFields: FeedField[],
): string {
  const context = allFields
    .filter((f) => f.key !== field.key)
    .map((f) => {
      if (f.kind === "m2m" && f.items) return `**${f.label}**: ${f.items.map((i) => i.name).join(", ")}`;
      if (f.kind === "tags" && f.tags) return `**${f.label}**: ${f.tags.join(", ")}`;
      return `**${f.label}**: ${f.content}`;
    })
    .join("\n\n");

  return (
    `You are regenerating the **${field.label}** field for a UX Shot analysis.\n\n` +
    `IMPORTANT: You MUST produce a DIFFERENT and IMPROVED version. Do NOT repeat the current content.\n\n` +
    `Current ${field.label} (to be replaced):\n${field.content}\n\n` +
    `User's instructions for improvement: ${userInstructions}\n\n` +
    `For context, here are the other fields (do NOT include these in your response):\n${context}\n\n` +
    `Respond with ONLY the new ${field.label} content. No label prefix, no markdown bold, no other fields. Just the content.`
  );
}
