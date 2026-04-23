-- ============================================
-- MIGRATION: Internal Output Items
-- PURPOSE: Multi-item output persistence per conversation
-- PREFIX: internal_ per project convention
-- ============================================

CREATE TABLE internal_output_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
  directus_id TEXT,
  fields JSONB NOT NULL DEFAULT '{}',
  saved_fields JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'saved', 'modified')),
  title TEXT NOT NULL DEFAULT 'New Shot',
  sort INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_internal_output_conv ON internal_output_items(conversation_id);

ALTER TABLE internal_output_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internal_output_items_all" ON internal_output_items
  FOR ALL USING (true) WITH CHECK (true);
