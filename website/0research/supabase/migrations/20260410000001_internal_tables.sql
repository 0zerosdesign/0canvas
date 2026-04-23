-- ============================================
-- MIGRATION: Internal Admin Tool Tables
-- PURPOSE: Conversation persistence for the 0internal workspace
-- PREFIX: All tables use internal_ prefix per project convention
-- ============================================

-- internal_agents: Agent registry (seeded from code, FK target for conversations)
CREATE TABLE internal_agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  output_schema_type TEXT,
  sort INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- internal_conversations: Per-agent chat sessions
CREATE TABLE internal_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES internal_agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_internal_conv_agent
  ON internal_conversations(agent_id, user_id, updated_at DESC);

-- internal_messages: Messages within conversations
CREATE TABLE internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES internal_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  images TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_internal_msg_conv
  ON internal_messages(conversation_id, created_at ASC);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE internal_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_messages ENABLE ROW LEVEL SECURITY;

-- Agents: readable by authenticated users, writable by service role
CREATE POLICY "internal_agents_select"
  ON internal_agents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "internal_agents_service"
  ON internal_agents FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Conversations: users see only their own
CREATE POLICY "internal_conversations_select"
  ON internal_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "internal_conversations_insert"
  ON internal_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "internal_conversations_update"
  ON internal_conversations FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "internal_conversations_delete"
  ON internal_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Messages: users can manage messages in their own conversations
CREATE POLICY "internal_messages_select"
  ON internal_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversations c
      WHERE c.id = internal_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "internal_messages_insert"
  ON internal_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM internal_conversations c
      WHERE c.id = internal_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "internal_messages_delete"
  ON internal_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM internal_conversations c
      WHERE c.id = internal_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO internal_agents (id, name, description, icon, output_schema_type, sort)
VALUES ('shots', 'Shots', 'Generate UX Shot content from AI app screenshots', '📷', 'directus_shot', 1);
