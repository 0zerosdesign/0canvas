-- ============================================
-- MIGRATION: Fix internal tables RLS
-- REASON: The data Supabase project (0research) has no auth session —
--         auth lives on a separate shared Supabase project (0accounts).
--         auth.uid() is always null on this project's client.
--         Since /internal is already gated by RequireAdmin in the frontend,
--         we allow the anon role full access to internal_* tables.
-- ============================================

-- Drop old policies that depend on auth.uid()
DROP POLICY IF EXISTS "internal_agents_select" ON internal_agents;
DROP POLICY IF EXISTS "internal_agents_service" ON internal_agents;
DROP POLICY IF EXISTS "internal_conversations_select" ON internal_conversations;
DROP POLICY IF EXISTS "internal_conversations_insert" ON internal_conversations;
DROP POLICY IF EXISTS "internal_conversations_update" ON internal_conversations;
DROP POLICY IF EXISTS "internal_conversations_delete" ON internal_conversations;
DROP POLICY IF EXISTS "internal_messages_select" ON internal_messages;
DROP POLICY IF EXISTS "internal_messages_insert" ON internal_messages;
DROP POLICY IF EXISTS "internal_messages_delete" ON internal_messages;

-- Agents: anon can read, service_role can write
CREATE POLICY "internal_agents_read" ON internal_agents
  FOR SELECT USING (true);

CREATE POLICY "internal_agents_write" ON internal_agents
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Conversations: anon has full access (admin-gated in frontend)
CREATE POLICY "internal_conversations_all" ON internal_conversations
  FOR ALL USING (true) WITH CHECK (true);

-- Messages: anon has full access (admin-gated in frontend)
CREATE POLICY "internal_messages_all" ON internal_messages
  FOR ALL USING (true) WITH CHECK (true);
