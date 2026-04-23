/**
 * Parse an AI response (markdown) into structured Shot fields.
 *
 * The AI response follows this format:
 *   **Title**: "Hold Shift" drag-to-attach override
 *   **App**: Claude Code
 *   **Platform**: Desktop / IDE extension
 *   **Summary**: When a user drags...
 *   **Analysis**: This works as a safety valve...
 *   **UI Elements**:\n- item\n- item
 *   **Interaction Patterns**:\n- item\n- item
 *   **Tags**: onboarding, chat-ui, ...
 */

export interface ShotField {
  key: string;       // normalized key: "title", "app", "summary", etc.
  label: string;     // display label: "Title", "App", "Summary", etc.
  content: string;   // the raw content for this field
}

const FIELD_LABELS = [
  "Title",
  "App",
  "Platform",
  "Summary",
  "Analysis",
  "UI Elements",
  "Interaction Patterns",
  "Tags",
];

// Build regex: **Title**: or **Title**:
const FIELD_PATTERN = new RegExp(
  `\\*\\*(${FIELD_LABELS.join("|")})\\*\\*\\s*:\\s*`,
  "gi",
);

function toKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, "_");
}

export function parseShotFields(markdown: string): ShotField[] | null {
  // Quick check — does this look like a shot response?
  const matches = markdown.match(/\*\*(Title|Summary|Analysis)\*\*\s*:/gi);
  if (!matches || matches.length < 2) return null;

  const fields: ShotField[] = [];
  const parts = markdown.split(FIELD_PATTERN);

  // parts alternates: [prefix, label1, content1, label2, content2, ...]
  // First element is any text before the first field (skip it)
  for (let i = 1; i < parts.length - 1; i += 2) {
    const rawLabel = parts[i];
    const content = (parts[i + 1] || "").trim();
    const matched = FIELD_LABELS.find(
      (l) => l.toLowerCase() === rawLabel.toLowerCase(),
    );
    if (matched && content) {
      fields.push({
        key: toKey(matched),
        label: matched,
        content,
      });
    }
  }

  return fields.length >= 2 ? fields : null;
}

/**
 * Parse a regenerated field message: [<Label> regenerated]\n\n<content>
 * Returns a single ShotField or null if not a regen message.
 */
export function parseRegeneratedField(markdown: string): ShotField | null {
  const match = markdown.match(/^\[(\w[\w\s]*?) regenerated\]\s*\n+([\s\S]+)/i);
  if (!match) return null;

  const rawLabel = match[1].trim();
  const content = match[2].trim();
  const matched = FIELD_LABELS.find(
    (l) => l.toLowerCase() === rawLabel.toLowerCase(),
  );
  if (!matched || !content) return null;

  return { key: toKey(matched), label: matched, content };
}

/**
 * Build a targeted regeneration prompt for a specific field.
 */
export function buildRegeneratePrompt(
  field: ShotField,
  userInstructions: string,
  allFields: ShotField[],
): string {
  const context = allFields
    .filter((f) => f.key !== field.key)
    .map((f) => `**${f.label}**: ${f.content}`)
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
