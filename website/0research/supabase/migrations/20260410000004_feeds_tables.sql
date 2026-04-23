-- ============================================
-- MIGRATION 004: Feeds Tables (replaces shots/shot_sections/shot_blocks)
-- PURPOSE: New unified feeds schema aligned with Directus CMS feeds collection
-- CHANGES: Single media per feed (no carousel), taxonomy as denormalized arrays,
--          description (HTML) instead of short_description, module field
-- ============================================

-- Drop old tables (cascade handles foreign keys)
DROP TABLE IF EXISTS shot_blocks CASCADE;
DROP TABLE IF EXISTS shot_sections CASCADE;
DROP TABLE IF EXISTS shots CASCADE;

-- Feeds (top-level content items, synced from Directus feeds collection)
CREATE TABLE feeds (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT,
  description TEXT,                          -- HTML (inline rich text from Directus)
  status TEXT NOT NULL DEFAULT 'draft',
  module TEXT NOT NULL DEFAULT 'shots',      -- shots, workflows, glossary, directory, news
  publish_date TIMESTAMPTZ,
  read_time_minutes INTEGER,
  media_url TEXT,                            -- single primary media URL
  media_type TEXT DEFAULT 'image',           -- image or video
  tags TEXT[] DEFAULT '{}',                  -- free-form keyword tags (JSON array from Directus)
  -- Denormalized taxonomy arrays (display names, not IDs)
  applications TEXT[] DEFAULT '{}',
  psychology TEXT[] DEFAULT '{}',
  industries TEXT[] DEFAULT '{}',
  ai_patterns TEXT[] DEFAULT '{}',
  ui_elements TEXT[] DEFAULT '{}',
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  directus_synced_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_feeds_status ON feeds(status);
CREATE INDEX idx_feeds_module ON feeds(module);
CREATE INDEX idx_feeds_created_at ON feeds(created_at DESC);
CREATE INDEX idx_feeds_slug ON feeds(slug) WHERE slug IS NOT NULL;

-- Feed sections (ordered groups within a feed — insights content)
CREATE TABLE feed_sections (
  id UUID PRIMARY KEY,
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_sections_feed_id ON feed_sections(feed_id);

-- Feed blocks (flattened content blocks within sections)
CREATE TABLE feed_blocks (
  id UUID PRIMARY KEY,
  section_id UUID NOT NULL REFERENCES feed_sections(id) ON DELETE CASCADE,
  sort INTEGER NOT NULL DEFAULT 0,
  block_type TEXT NOT NULL,

  -- Shared fields
  title TEXT,
  body TEXT,

  -- Media fields
  media_url TEXT,
  media_type TEXT,
  caption TEXT,
  side_media_url TEXT,
  side_media_caption TEXT,

  -- Code fields
  code_content TEXT,
  language TEXT,

  -- Table fields
  table_data JSONB,

  -- Tags fields
  tag_list TEXT[] DEFAULT '{}',

  -- Quote fields
  quote_author TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_feed_blocks_section_id ON feed_blocks(section_id);

-- ============================================
-- RLS Policies
-- ============================================

ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_blocks ENABLE ROW LEVEL SECURITY;

-- Public read access for published feeds
CREATE POLICY "Anyone can read published feeds"
  ON feeds FOR SELECT
  USING (status = 'published');

CREATE POLICY "Anyone can read sections of published feeds"
  ON feed_sections FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM feeds WHERE feeds.id = feed_sections.feed_id AND feeds.status = 'published'
  ));

CREATE POLICY "Anyone can read blocks of published feeds"
  ON feed_blocks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM feed_sections
    JOIN feeds ON feeds.id = feed_sections.feed_id
    WHERE feed_sections.id = feed_blocks.section_id AND feeds.status = 'published'
  ));

-- Service role full access (for sync scripts)
CREATE POLICY "Service role manages feeds"
  ON feeds FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages feed_sections"
  ON feed_sections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role manages feed_blocks"
  ON feed_blocks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
