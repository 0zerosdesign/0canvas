// ============================================
// TYPES: 0research Project - All TypeScript Interfaces
// PURPOSE: Defines the shape of all data used in the app
//
// DATA MODEL:
//   - MetadataItem: lightweight info for the left sidebar list
//   - MediaItem: rich content blocks for the main feed + right sidebar detail
//   - Both share the same UUID (one row in Directus CMS, split into two API calls)
//
// CONTENT BLOCKS:
//   Each MediaItem has ordered sections with content blocks.
//   Each feed has a single primary media (image/video).
//   Sections contain insights content (blocks: heading, text, code, table, etc.)
// ============================================

// --- CONTENT BLOCK TYPES ---

/** Block collection names from Directus M2A */
export type BlockCollection =
  | "block_heading"
  | "block_text"
  | "block_rich_text"
  | "block_media"
  | "block_code"
  | "block_table"
  | "block_quote"
  | "block_tags"
  | "block_transcript";

/** Block type values used in Supabase feed_blocks table */
export type BlockType =
  | "media"
  | "rich_text"
  | "text"
  | "video_transcript_section"
  | "heading"
  | "table"
  | "code_block"
  | "quotation"
  | "tags";

/** A single content block within a feed section. */
export interface ContentBlock {
  block_id: string;
  block_type: BlockType;
  order: number;

  // Media fields
  media_url?: string;
  media_type?: "image" | "video";
  caption?: string;

  // Side media
  side_media_url?: string;
  side_media_type?: "image" | "gif";
  side_media_caption?: string;

  // Text fields
  title?: string;
  rich_text_content?: string;
  text_content?: string;

  // Transcript
  transcript_text?: string;

  // Table
  table_data?: string[][];

  // Code
  code_content?: string;
  language?: string;

  // Quote
  quote_text?: string;
  quote_author?: string;

  // Tags
  tag_list?: string[];
}

/** Raw M2A block item from Directus API */
export interface DirectusM2ABlock {
  collection: BlockCollection;
  sort: number;
  item: Record<string, any>;
}

/** A section within a feed — groups blocks for insights content. */
export interface FeedSection {
  id: string;
  sort: number;
  title?: string;
  blocks: ContentBlock[];
}

// --- FEED ITEM TYPES ---

/** Metadata for a feed item — lightweight data for the left sidebar list. */
export interface MetadataItem {
  id: string;
  created_at: string;
  title: string;
  slug?: string;
  description: string;
  media_url?: string;
  media_type?: "image" | "video";
  status?: string;
  module?: string;
  publish_date?: string;
  read_time_minutes?: number;
  tags: string[];
  // Taxonomy (denormalized arrays)
  applications: string[];
  psychology: string[];
  industries: string[];
  ai_patterns: string[];
  ui_elements: string[];
}

/** Media content for a feed item — sections with content blocks. */
export interface MediaItem {
  id: string;
  sections: FeedSection[];
}

// --- API RESPONSE TYPES ---

export interface MetadataResponse {
  items: MetadataItem[];
  total: number;
}

// --- COMPONENT PROP TYPES ---

export interface FeedExperienceProps {
  mediaItems: MediaItem[];
  activeItemId: string;
  metadataItems: MetadataItem[];
  hasMoreMetadata: boolean;
  loadingMoreMetadata: boolean;
  onItemClick: (itemId: string) => void;
  onItemActive: (itemId: string) => void;
  onLoadMoreMetadata: (offset: number, limit: number) => void;
}

export interface MainFeedItemProps {
  id: string;
  title: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  isActive: boolean;
}

export interface SideFeedItemProps {
  title: string;
  description: string;
  module: string;
  author: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  sections: FeedSection[];
  // Taxonomy
  applications: string[];
  psychology: string[];
  industries: string[];
  ai_patterns: string[];
  ui_elements: string[];
  tags: string[];
}

export interface ListFeedItemProps {
  title: string;
  subcategory: string;
  mediaUrl: string;
  tags: string[];
  selected: boolean;
  onClick: () => void;
}
