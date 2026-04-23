// ── Chat Types ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type AiProvider = "chatgpt" | "openai";

export interface AiSettings {
  provider: AiProvider;
  proxyUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  temperature: number;
}

export interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string | OpenAIContentPart[];
}

export interface OpenAIContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: {
    url: string;
    detail?: "low" | "high" | "auto";
  };
}

// ── Internal Workspace Types ──────────────────────────────────────

export interface InternalConversation {
  id: string;
  agent_id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternalMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  images: string[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Feed Field System ─────────────────────────────────────────────

export type FeedFieldKind =
  | "text"      // title, seo_title
  | "richtext"  // description (inline HTML)
  | "media"     // media UUID + media_type
  | "blocks"    // insights — sections + blocks
  | "m2m"       // applications, psychology, industries, ai_patterns, ui_elements
  | "tags"      // free-form keyword tags (JSON array)
  | "readonly"; // module

export interface FeedField {
  key: string;
  label: string;
  kind: FeedFieldKind;
  content: string;
  items?: M2MItem[];
  tags?: string[];
  mediaId?: string;
  mediaType?: "image" | "video";
  mediaUrl?: string;
  localBase64?: string; // Local file data (not yet uploaded to Directus)
  blocks?: InsightBlock[];
}

export interface M2MItem {
  id: string;
  name: string;
  type?: string; // For taxonomy: "Psychology", "Industry", "AI_Pattern", "UI_Element"
  isNew?: boolean; // True if this item doesn't exist in Directus yet
  appData?: { // Rich fields for applications collection
    name: string;
    short_description?: string;
    website_url?: string;
    company?: string;
    platform?: string[];
    logo?: string; // Directus file UUID — populated server-side from favicon
  };
}

export interface InsightBlock {
  id: string;
  collection: string;
  sort: number;
  data: Record<string, unknown>;
}

// ── Output Item Types ─────────────────────────────────────────────

export type OutputItemStatus = "draft" | "saved" | "modified";

export interface OutputItem {
  id: string;
  directusId: string | null;
  fields: Map<string, FeedField>;
  savedFields: Map<string, FeedField> | null;
  status: OutputItemStatus;
  title: string;
  createdAt: number;
}

/** Serializable version for Supabase JSONB storage */
export interface OutputItemSerialized {
  id: string;
  directusId: string | null;
  fields: Record<string, FeedField>;
  savedFields: Record<string, FeedField> | null;
  status: OutputItemStatus;
  title: string;
  createdAt: number;
}
