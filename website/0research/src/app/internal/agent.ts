/**
 * 0internal Agent — Agentic context builder
 *
 * On every request this module:
 * 1. Loads the static knowledge base (ux-bites reference data)
 * 2. Loads published feeds from Directus (auto-enrichment)
 * 3. Searches for relevant examples based on the user's message
 * 4. Assembles a rich system prompt with schema + examples + style guide
 */

import type { OpenAIMessage, OpenAIContentPart } from "./types";
import type { ChatMessage } from "./types";

// ── Knowledge Base Types ────────────────────────────────────────────

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

interface KnowledgeBase {
  version: number;
  count: number;
  entries: KBEntry[];
}

// ── Published Feed Context ──────────────────────────────────────────

interface FeedContextEntry {
  id: string;
  title: string;
  description: string;
  applications: string[];
  psychology: string[];
  industries: string[];
  tags: string[];
}

// ── KB Loading (cached in memory after first load) ──────────────────

let kbCache: KnowledgeBase | null = null;
let kbLoading: Promise<KnowledgeBase> | null = null;

async function loadKnowledgeBase(): Promise<KnowledgeBase> {
  if (kbCache) return kbCache;
  if (kbLoading) return kbLoading;

  kbLoading = fetch(new URL("./knowledge-base.json", import.meta.url).href)
    .then((res) => res.json())
    .then((data: KnowledgeBase) => {
      kbCache = data;
      console.log(
        `[0internal agent] Knowledge base loaded: ${data.count} entries`,
      );
      return data;
    });

  return kbLoading;
}

// ── Published Feeds Loading (auto-enrichment) ───────────────────────

let feedsCache: FeedContextEntry[] | null = null;
let feedsCacheTime = 0;
let feedsLoading: Promise<FeedContextEntry[]> | null = null;
const FEEDS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadPublishedFeeds(): Promise<FeedContextEntry[]> {
  const now = Date.now();
  if (feedsCache && now - feedsCacheTime < FEEDS_CACHE_TTL) return feedsCache;
  if (feedsLoading) return feedsLoading;

  feedsLoading = (async () => {
    try {
      const { listPublishedFeeds } = await import("./directus-proxy");
      const feeds = await listPublishedFeeds();
      feedsCache = feeds;
      feedsCacheTime = now;
      console.log(`[0internal agent] Published feeds loaded: ${feeds.length} entries`);
      return feeds;
    } catch (err) {
      console.warn("[0internal agent] Failed to load published feeds:", err);
      return feedsCache || [];
    } finally {
      feedsLoading = null;
    }
  })();

  return feedsLoading;
}

// ── Taxonomy Context (existing items from Directus) ─────────────────

interface TaxonomyContext {
  applications: string[];
  psychology: string[];
  industries: string[];
  ai_patterns: string[];
  ui_elements: string[];
}

let taxonomyCache: TaxonomyContext | null = null;
let taxonomyCacheTime = 0;
let taxonomyLoading: Promise<TaxonomyContext> | null = null;

async function loadExistingTaxonomy(): Promise<TaxonomyContext> {
  const now = Date.now();
  if (taxonomyCache && now - taxonomyCacheTime < FEEDS_CACHE_TTL) return taxonomyCache;
  if (taxonomyLoading) return taxonomyLoading;

  taxonomyLoading = (async () => {
    try {
      const { searchTaxonomy, searchApplications } = await import("./directus-proxy");
      const [psych, industries, aiPatterns, uiElements, apps] = await Promise.all([
        searchTaxonomy("Psychology", "").catch(() => []),
        searchTaxonomy("Industry", "").catch(() => []),
        searchTaxonomy("AI_Pattern", "").catch(() => []),
        searchTaxonomy("UI_Element", "").catch(() => []),
        searchApplications("").catch(() => []),
      ]);
      const ctx: TaxonomyContext = {
        applications: apps.map((a: { name: string }) => a.name),
        psychology: psych.map((p: { name: string }) => p.name),
        industries: industries.map((i: { name: string }) => i.name),
        ai_patterns: aiPatterns.map((p: { name: string }) => p.name),
        ui_elements: uiElements.map((e: { name: string }) => e.name),
      };
      taxonomyCache = ctx;
      taxonomyCacheTime = now;
      console.log(`[0internal agent] Taxonomy loaded: ${apps.length} apps, ${psych.length} psych, ${industries.length} industries, ${aiPatterns.length} AI patterns, ${uiElements.length} UI elements`);
      return ctx;
    } catch (err) {
      console.warn("[0internal agent] Failed to load taxonomy:", err);
      return taxonomyCache || { applications: [], psychology: [], industries: [], ai_patterns: [], ui_elements: [] };
    } finally {
      taxonomyLoading = null;
    }
  })();

  return taxonomyLoading;
}

/** Exported for use by parseFields to check new vs existing items */
export function getCachedTaxonomy(): TaxonomyContext | null {
  return taxonomyCache;
}

// ── Context Message Limit ───────────────────────────────────────────

const MAX_CONTEXT_MESSAGES = 20;

function trimHistory(chatHistory: ChatMessage[]): ChatMessage[] {
  if (chatHistory.length <= MAX_CONTEXT_MESSAGES) return chatHistory;
  // Keep first message (original prompt with images) + last N-1 messages
  return [chatHistory[0], ...chatHistory.slice(-(MAX_CONTEXT_MESSAGES - 1))];
}

// ── Relevance Scoring ───────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function scoreKBEntry(entry: KBEntry, queryTokens: string[]): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  const summaryLower = entry.summary.toLowerCase();
  const analysisLower = (entry.analysis || "").toLowerCase();

  for (const token of queryTokens) {
    if (titleLower.includes(token)) score += 3;
    if (summaryLower.includes(token)) score += 2;
    if (analysisLower.includes(token)) score += 2;
    for (const p of entry.patterns) {
      if (p.toLowerCase().includes(token)) score += 2;
    }
    for (const el of entry.ui_elements) {
      if (el.toLowerCase().includes(token)) score += 1;
    }
    for (const tag of entry.tags) {
      if (tag.includes(token)) score += 1;
    }
  }

  if (entry.analysis) score += 1;
  return score;
}

function scoreFeedEntry(entry: FeedContextEntry, queryTokens: string[]): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  const descLower = entry.description.toLowerCase();

  for (const token of queryTokens) {
    if (titleLower.includes(token)) score += 3;
    if (descLower.includes(token)) score += 2;
    for (const app of entry.applications) {
      if (app.toLowerCase().includes(token)) score += 2;
    }
    for (const p of entry.psychology) {
      if (p.toLowerCase().includes(token)) score += 2;
    }
    for (const tag of entry.tags) {
      if (tag.includes(token)) score += 1;
    }
  }

  return score;
}

function selectExamples(
  kb: KnowledgeBase,
  feeds: FeedContextEntry[],
  userMessage: string,
  maxExamples: number = 12,
): { kbExamples: KBEntry[]; feedExamples: FeedContextEntry[] } {
  const tokens = tokenize(userMessage);

  if (tokens.length === 0) {
    return {
      kbExamples: kb.entries
        .filter((e) => e.analysis && e.summary.length > 50)
        .slice(0, Math.min(8, maxExamples)),
      feedExamples: feeds.slice(0, Math.min(4, maxExamples)),
    };
  }

  // Score KB entries
  const scoredKB = kb.entries
    .map((entry) => ({ entry, score: scoreKBEntry(entry, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // Score feed entries
  const scoredFeeds = feeds
    .map((entry) => ({ entry, score: scoreFeedEntry(entry, tokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const kbExamples = scoredKB.slice(0, Math.min(8, maxExamples)).map((s) => s.entry);
  const feedExamples = scoredFeeds.slice(0, Math.min(4, maxExamples)).map((s) => s.entry);

  // Pad KB if too few results
  if (kbExamples.length < 4) {
    const usedIds = new Set(kbExamples.map((e) => e.id));
    const defaults = kb.entries
      .filter((e) => e.analysis && !usedIds.has(e.id))
      .slice(0, 4 - kbExamples.length);
    kbExamples.push(...defaults);
  }

  return { kbExamples, feedExamples };
}

// ── Format Examples ─────────────────────────────────────────────────

function formatKBExample(entry: KBEntry): string {
  let text = `**"${entry.title}"** — ${entry.company}\n`;
  text += `Summary: ${entry.summary}\n`;
  if (entry.analysis) text += `Analysis: ${entry.analysis}\n`;
  if (entry.patterns.length > 0) text += `Patterns: ${entry.patterns.join(", ")}\n`;
  if (entry.ui_elements.length > 0) text += `UI Elements: ${entry.ui_elements.join(", ")}`;
  return text;
}

function formatFeedExample(entry: FeedContextEntry): string {
  let text = `**"${entry.title}"**`;
  if (entry.applications.length > 0) text += ` — ${entry.applications.join(", ")}`;
  text += `\n`;
  text += `Description: ${entry.description}\n`;
  if (entry.psychology.length > 0) text += `Psychology: ${entry.psychology.join(", ")}\n`;
  if (entry.industries.length > 0) text += `Industries: ${entry.industries.join(", ")}\n`;
  if (entry.tags.length > 0) text += `Tags: ${entry.tags.join(", ")}`;
  return text;
}

// ── Style Guide ─────────────────────────────────────────────────────

const STYLE_GUIDE = `You are 0internal — a UX analyst specialized in AI application interfaces (web & mobile).

## YOUR TASK
When shown a UI screenshot or description of an AI application, produce a structured **UX Shot** for the feeds collection.

## OUTPUT FORMAT (strict)
**Title**: A concise, descriptive name for the UX pattern (e.g., "Contextual prompt suggestions")
**Description**: 2-3 sentences describing what this pattern does and your analysis of why it works. You may include inline HTML for emphasis: <strong>bold</strong>, <em>italic</em>, <u>underline</u>, <s>strikethrough</s>. This is the primary analysis text.
**Insights**:
### Analysis
Key observations about the UI design, interaction patterns, and UX quality. Each point should be specific and reference visible elements.
### Key Patterns
Specific UX/AI patterns observed with brief explanations.
**Applications**: Application name(s) — comma-separated if multiple (e.g., ChatGPT, Claude, Cursor). Prefix with [NEW] if not in existing taxonomy.
**App Details**: (ONLY for [NEW] applications — one line per new app, pipe-delimited)
- AppName | website_url | company | one-sentence description | platforms (comma-separated from: web, ios, android, macos, windows, linux, api, cli, ide_extension)
Example: If you output [NEW] Bolt in Applications, add: - Bolt | https://bolt.new | StackBlitz | AI-powered full-stack web development tool | web
**Psychology**: Psychological principles at work — comma-separated (e.g., Progressive Disclosure, Cognitive Load Reduction, Anchoring Effect)
**Industries**: Industry/domain — comma-separated (e.g., AI Assistant, Developer Tools, Productivity)
**AI Patterns**: AI-specific patterns — comma-separated, optional (e.g., Streaming Response, Model Selector, Context Window Indicator)
**UI Elements**: Key UI components — comma-separated, optional (e.g., Chat Bubble, Side Panel, Dropdown Menu)
**Tags**: Free-form keywords for discovery — comma-separated, 5-6 tags (e.g., onboarding, chat-ui, error-handling)

## STYLE RULES
- Description combines WHAT + WHY in a flowing narrative. Be opinionated.
- Insights should have structured headings (### Analysis, ### Key Patterns) with bullet points
- Psychology, Industries, AI Patterns, UI Elements should reference established terms
- Focus on AI-specific patterns: prompt interfaces, response streaming, model selection, context windows, tool use indicators
- Write like a senior product designer — sharp, specific, educational
- Never be generic. Reference specific UI elements you can see
- Keep each section concise — no filler, no preamble`;

// ── Debug Info ───────────────────────────────────────────────────────

export interface AgentDebug {
  query: string;
  kbSize: number;
  examplesSelected: { title: string; company: string; score: number }[];
  feedExamplesSelected: { title: string; score: number }[];
  systemPromptTokens: number;
  systemPromptPreview: string;
  totalMessages: number;
}

export interface AgentResult {
  messages: OpenAIMessage[];
  debug: AgentDebug;
}

// ── Public API ───────────────────────────────────────────────────────

export async function buildAgentMessages(
  userStyleGuide: string,
  chatHistory: ChatMessage[],
): Promise<AgentResult> {
  const [kb, feeds, taxonomy] = await Promise.all([
    loadKnowledgeBase(),
    loadPublishedFeeds(),
    loadExistingTaxonomy(),
  ]);

  const lastUserMsg = [...chatHistory].reverse().find((m) => m.role === "user");
  const query = lastUserMsg?.content || "";
  const queryTokens = tokenize(query);

  const { kbExamples, feedExamples } = selectExamples(kb, feeds, query);

  const scoredKB = kbExamples.map((ex) => ({
    title: ex.title,
    company: ex.company,
    score: scoreKBEntry(ex, queryTokens),
  }));

  const scoredFeeds = feedExamples.map((ex) => ({
    title: ex.title,
    score: scoreFeedEntry(ex, queryTokens),
  }));

  // Assemble system prompt
  const systemParts: string[] = [
    userStyleGuide || STYLE_GUIDE,
    "",
    "## REFERENCE EXAMPLES (UX Bites Knowledge Base)",
    "Match this style, depth, and structure:",
    "",
    ...kbExamples.map((ex, i) => `### Example ${i + 1}\n${formatKBExample(ex)}`),
  ];

  if (feedExamples.length > 0) {
    systemParts.push(
      "",
      "## PUBLISHED SHOTS (from our feeds collection)",
      "These are shots we've already published. Use them as reference for quality and taxonomy consistency:",
      "",
      ...feedExamples.map((ex, i) => `### Published ${i + 1}\n${formatFeedExample(ex)}`),
    );
  }

  // Taxonomy context — existing items from Directus
  const hasTaxonomy = taxonomy.applications.length > 0 || taxonomy.psychology.length > 0 ||
    taxonomy.industries.length > 0 || taxonomy.ai_patterns.length > 0 || taxonomy.ui_elements.length > 0;

  if (hasTaxonomy) {
    systemParts.push(
      "",
      "## EXISTING TAXONOMY (from our Directus CMS)",
      "IMPORTANT: Prefer using these EXISTING terms when applicable. If you suggest a new term not in these lists, prefix it with [NEW].",
      "",
    );
    if (taxonomy.applications.length > 0) systemParts.push(`**Applications**: ${taxonomy.applications.join(", ")}`);
    if (taxonomy.psychology.length > 0) systemParts.push(`**Psychology**: ${taxonomy.psychology.join(", ")}`);
    if (taxonomy.industries.length > 0) systemParts.push(`**Industries**: ${taxonomy.industries.join(", ")}`);
    if (taxonomy.ai_patterns.length > 0) systemParts.push(`**AI Patterns**: ${taxonomy.ai_patterns.join(", ")}`);
    if (taxonomy.ui_elements.length > 0) systemParts.push(`**UI Elements**: ${taxonomy.ui_elements.join(", ")}`);
  }

  systemParts.push(
    "",
    "## IMPORTANT",
    "- These examples are REFERENCE for style and structure only",
    "- YOUR analysis must be original and specific to the UI shown",
    "- Focus on AI application patterns — not generic UX",
    "- Use established taxonomy terms when possible — prefer EXISTING items from the taxonomy list above",
    "- If you introduce a NEW taxonomy term not in the existing lists, prefix it with [NEW] (e.g., [NEW] Ambient Intelligence)",
    "- For any [NEW] application, ALWAYS include a corresponding **App Details** entry with website URL, company, description, and platforms",
  );

  const systemContent = systemParts.join("\n");
  const systemTokens = Math.round(systemContent.length / 4);

  const messages: OpenAIMessage[] = [
    { role: "system", content: systemContent },
  ];

  // Trim history to avoid exceeding context window
  const trimmedHistory = trimHistory(chatHistory);

  for (const msg of trimmedHistory) {
    if (msg.images && msg.images.length > 0) {
      const parts: OpenAIContentPart[] = [
        { type: "text", text: msg.content || "Analyze this UI." },
        ...msg.images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img, detail: "high" as const },
        })),
      ];
      messages.push({ role: msg.role, content: parts });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const debug: AgentDebug = {
    query,
    kbSize: kb.count,
    examplesSelected: scoredKB,
    feedExamplesSelected: scoredFeeds,
    systemPromptTokens: systemTokens,
    systemPromptPreview: systemContent,
    totalMessages: messages.length,
  };

  console.log(
    `[0internal agent] Context: ${kbExamples.length} KB + ${feedExamples.length} feeds, ~${systemTokens} tokens`,
  );

  return { messages, debug };
}

export { STYLE_GUIDE };
