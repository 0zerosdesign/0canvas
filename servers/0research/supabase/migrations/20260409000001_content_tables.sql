-- ============================================
-- MIGRATION 001: Content Tables
-- PURPOSE: Stores UX Shots content synced from Directus CMS
-- SYNC: Directus Flow → webhook → Edge Function → these tables
-- READ: Frontend queries these tables (not Directus directly)
-- ============================================

-- Shots (top-level content items)
CREATE TABLE shots (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  short_description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  publish_date TIMESTAMPTZ,
  read_time_minutes INTEGER,
  tags TEXT[] DEFAULT '{}',
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  directus_synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shots_status ON shots(status);
CREATE INDEX idx_shots_created_at ON shots(created_at DESC);
CREATE INDEX idx_shots_slug ON shots(slug) WHERE slug IS NOT NULL;

-- Shot sections (ordered groups within a shot, each may own a carousel slide)
CREATE TABLE shot_sections (
  id UUID PRIMARY KEY,
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  carousel_media_url TEXT,
  carousel_media_type TEXT DEFAULT 'image',
  carousel_caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shot_sections_shot_id ON shot_sections(shot_id);

-- Content blocks within sections (flattened from Directus M2A)
CREATE TABLE shot_blocks (
  id UUID PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES shot_sections(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  block_type TEXT NOT NULL,

  -- Shared fields
  title TEXT,
  body TEXT,

  -- Media fields (block_media, side media on block_text/block_rich_text)
  media_url TEXT,
  media_type TEXT,
  caption TEXT,
  side_media_url TEXT,
  side_media_caption TEXT,

  -- Code fields (block_code)
  code_content TEXT,
  language TEXT,

  -- Table fields (block_table)
  table_data JSONB,

  -- Tags fields (block_tags)
  tag_list TEXT[] DEFAULT '{}',

  -- Quote fields (block_quote)
  quote_author TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shot_blocks_section_id ON shot_blocks(section_id);
