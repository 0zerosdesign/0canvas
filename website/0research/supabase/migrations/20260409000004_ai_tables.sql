-- ============================================
-- MIGRATION 004: AI Tables
-- PURPOSE: pgvector embeddings for semantic search (Phase 5)
-- NOTE: Creating schema now so it's ready when embedding pipeline is built.
--       pgvector extension is free on all Supabase plans.
-- ============================================

-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Shot embeddings for semantic search
CREATE TABLE shot_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shot_id UUID NOT NULL REFERENCES shots(id) ON DELETE CASCADE,
  embedding vector(384),
  model_name TEXT NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(shot_id, model_name)
);

-- IVFFlat index for fast cosine similarity search
-- NOTE: IVFFlat requires at least 1 row to build. If empty, Supabase will
-- defer index creation until first insert. This is fine.
CREATE INDEX idx_shot_embeddings_vector
  ON shot_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS: public read, service_role write
ALTER TABLE shot_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read embeddings"
  ON shot_embeddings FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage embeddings"
  ON shot_embeddings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
