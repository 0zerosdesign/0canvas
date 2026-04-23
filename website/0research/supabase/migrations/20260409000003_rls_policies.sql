-- ============================================
-- MIGRATION 003: Row Level Security Policies
-- PURPOSE: Control who can read/write each table
-- PATTERN: Content is publicly readable; user data is per-user;
--          writes happen via service_role (Edge Functions / sync)
-- ============================================

-- ======== SHOTS (public read) ========
ALTER TABLE shots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published shots"
  ON shots FOR SELECT
  USING (status = 'published');

CREATE POLICY "Service role can manage all shots"
  ON shots FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ======== SHOT SECTIONS (public read via published shot) ========
ALTER TABLE shot_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sections of published shots"
  ON shot_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shots
      WHERE shots.id = shot_sections.shot_id
        AND shots.status = 'published'
    )
  );

CREATE POLICY "Service role can manage all sections"
  ON shot_sections FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ======== SHOT BLOCKS (public read via published shot) ========
ALTER TABLE shot_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read blocks of published shots"
  ON shot_blocks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shot_sections s
      JOIN shots sh ON sh.id = s.shot_id
      WHERE s.id = shot_blocks.section_id
        AND sh.status = 'published'
    )
  );

CREATE POLICY "Service role can manage all blocks"
  ON shot_blocks FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ======== USER PREFERENCES (per-user) ========
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ======== FEATURE FLAGS (public read) ========
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags"
  ON feature_flags FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage feature flags"
  ON feature_flags FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
