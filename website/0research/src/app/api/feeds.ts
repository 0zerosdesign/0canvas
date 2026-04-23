// ============================================
// API: Feeds APIs (Supabase)
// BASE: Supabase Postgres (0research project)
// PURPOSE: Fetch feed metadata and section-based content
//
// TWO-API SPLIT:
//   1. getMetadata — lightweight metadata for sidebar list (paginated, 20/batch)
//   2. getMedia    — sections with content blocks (batched by IDs)
//
// DATA SOURCE: Supabase Postgres (content synced from Directus CMS)
// ============================================

import { supabase } from "../lib/supabase";
import type {
  MetadataResponse,
  MediaItem,
  MetadataItem,
  ContentBlock,
  FeedSection,
  BlockType,
} from "../types";

// --- TABLE DATA TRANSFORMER ---
function transformTableData(data: any): string[][] | undefined {
  if (!data || !Array.isArray(data) || data.length === 0) return undefined;
  if (Array.isArray(data[0])) return data;
  return data.map((row: Record<string, string>) => {
    const vals: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const v = row[`col_${i}`];
      if (v !== undefined && v !== null && v !== "") vals.push(v);
    }
    return vals;
  });
}

// --- BLOCK TRANSFORMER ---
function transformBlock(block: any, index: number): ContentBlock {
  const order = index + 1;
  const base = { block_id: block.id, order };

  switch (block.block_type) {
    case "heading":
      return { ...base, block_type: "heading" as BlockType, title: block.title };
    case "text":
      return {
        ...base, block_type: "text" as BlockType, text_content: block.body,
        side_media_url: block.side_media_url || undefined,
        side_media_caption: block.side_media_caption || undefined,
      };
    case "rich_text":
      return {
        ...base, block_type: "rich_text" as BlockType,
        title: block.title || undefined, rich_text_content: block.body,
        side_media_url: block.side_media_url || undefined,
        side_media_caption: block.side_media_caption || undefined,
      };
    case "media":
      return {
        ...base, block_type: "media" as BlockType,
        media_url: block.media_url || undefined, media_type: block.media_type || "image",
        caption: block.caption || undefined,
        side_media_url: block.side_media_url || undefined,
        side_media_caption: block.side_media_caption || undefined,
      };
    case "code_block":
      return {
        ...base, block_type: "code_block" as BlockType,
        title: block.title || undefined, code_content: block.code_content,
        language: block.language || undefined,
      };
    case "table":
      return {
        ...base, block_type: "table" as BlockType,
        title: block.title || undefined, table_data: transformTableData(block.table_data),
      };
    case "quotation":
      return {
        ...base, block_type: "quotation" as BlockType,
        quote_text: block.body, quote_author: block.quote_author || undefined,
      };
    case "tags":
      return { ...base, block_type: "tags" as BlockType, tag_list: block.tag_list || [] };
    case "video_transcript_section":
      return {
        ...base, block_type: "video_transcript_section" as BlockType,
        title: block.title || undefined, transcript_text: block.body,
      };
    default:
      return { ...base, block_type: "text" as BlockType };
  }
}

// --- SECTION TRANSFORMER ---
function transformSections(rawSections: any[]): FeedSection[] {
  return rawSections
    .sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0))
    .map((section: any) => ({
      id: section.id,
      sort: section.sort,
      title: section.title || undefined,
      blocks: (section.feed_blocks || [])
        .sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0))
        .map((block: any, index: number) => transformBlock(block, index)),
    }));
}

// --- API 1: getMetadata ---
export async function getMetadata(
  offset: number = 0,
  limit: number = 20
): Promise<MetadataResponse> {
  const { data, count, error } = await supabase
    .from("feeds")
    .select(
      "id, title, slug, description, status, module, publish_date, read_time_minutes, tags, media_url, media_type, applications, psychology, industries, ai_patterns, ui_elements, created_at",
      { count: "exact" }
    )
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[getMetadata] Supabase query failed:", error);
    return { items: [], total: 0 };
  }

  const items: MetadataItem[] = (data || []).map((doc: any) => ({
    id: doc.id,
    created_at: doc.created_at,
    title: doc.title,
    slug: doc.slug || undefined,
    description: doc.description || "",
    media_url: doc.media_url || undefined,
    media_type: doc.media_type || "image",
    status: doc.status,
    module: doc.module || "shots",
    publish_date: doc.publish_date || undefined,
    read_time_minutes: doc.read_time_minutes || undefined,
    tags: doc.tags || [],
    applications: doc.applications || [],
    psychology: doc.psychology || [],
    industries: doc.industries || [],
    ai_patterns: doc.ai_patterns || [],
    ui_elements: doc.ui_elements || [],
  }));

  return { items, total: count ?? items.length };
}

// --- API 2: getMedia ---
export async function getMedia(ids: string[]): Promise<MediaItem[]> {
  if (!ids || ids.length === 0) return [];

  const { data, error } = await supabase
    .from("feeds")
    .select(
      `
      id,
      feed_sections (
        id, sort, title,
        feed_blocks (
          id, sort, block_type, title, body,
          media_url, media_type, caption,
          side_media_url, side_media_caption,
          code_content, language,
          table_data, tag_list, quote_author
        )
      )
    `
    )
    .in("id", ids);

  if (error) {
    console.error("[getMedia] Supabase query failed:", error);
    return [];
  }

  return (data || []).map((doc: any) => ({
    id: doc.id,
    sections: transformSections(doc.feed_sections || []),
  }));
}
