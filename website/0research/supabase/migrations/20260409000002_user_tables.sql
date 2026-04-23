-- ============================================
-- MIGRATION 002: User Tables
-- PURPOSE: User preferences and feature flags for 0research
-- AUTH: user_id matches Supabase auth.users.id (from Zeros auth)
-- ============================================

-- User preferences for 0research
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY,
  saved_shots UUID[] DEFAULT '{}',
  reading_history JSONB DEFAULT '[]',
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Feature flags (admin-controlled)
CREATE TABLE feature_flags (
  id TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  admin_only BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default feature flags
INSERT INTO feature_flags (id, enabled, admin_only, description) VALUES
  ('0ai_internal', true, true, 'Internal AI content creation tool (admin only)'),
  ('0ai_public', false, false, 'Public AI analysis tool for users'),
  ('semantic_search', false, false, 'AI-powered semantic search across shots');
