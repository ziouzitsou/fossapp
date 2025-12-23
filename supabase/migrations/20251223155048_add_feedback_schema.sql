-- Migration: Add feedback schema for AI chat feature
-- Purpose: Store user feedback conversations with AI assistant
-- Date: 2025-12-23

-- Create feedback schema
CREATE SCHEMA IF NOT EXISTS feedback;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Chats table (main conversation records)
CREATE TABLE feedback.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  subject TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived')),
  message_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  total_cost NUMERIC(10, 6) DEFAULT 0,  -- Track cost in dollars
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table (individual messages)
CREATE TABLE feedback.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES feedback.chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  attachments JSONB,  -- Array of {type, url, filename, size}
  tool_calls JSONB,   -- Track tool usage for debugging
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost NUMERIC(10, 6),  -- Cost for this message in dollars
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_feedback_chats_user_email ON feedback.chats(user_email);
CREATE INDEX idx_feedback_chats_status ON feedback.chats(status);
CREATE INDEX idx_feedback_chats_created_at ON feedback.chats(created_at DESC);
CREATE INDEX idx_feedback_chat_messages_chat_id ON feedback.chat_messages(chat_id);
CREATE INDEX idx_feedback_chat_messages_created_at ON feedback.chat_messages(created_at);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON SCHEMA feedback IS 'AI-powered feedback chat system for user bug reports, feature requests, and product questions';
COMMENT ON TABLE feedback.chats IS 'Main conversation records for AI feedback chat';
COMMENT ON TABLE feedback.chat_messages IS 'Individual messages within a chat conversation';
COMMENT ON COLUMN feedback.chats.total_cost IS 'Accumulated cost in USD for all messages in this chat';
COMMENT ON COLUMN feedback.chat_messages.cost IS 'Cost in USD for this specific message (assistant messages only)';

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE feedback.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback.chat_messages ENABLE ROW LEVEL SECURITY;

-- No public policies - all access goes through API routes with service_role key
-- This ensures proper auth validation happens in the application layer

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to auto-update message count, tokens, and updated_at on message insert
CREATE OR REPLACE FUNCTION feedback.update_chat_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE feedback.chats
  SET
    message_count = (SELECT COUNT(*) FROM feedback.chat_messages WHERE chat_id = NEW.chat_id),
    total_tokens_used = COALESCE(total_tokens_used, 0) + COALESCE(NEW.input_tokens, 0) + COALESCE(NEW.output_tokens, 0),
    total_cost = COALESCE(total_cost, 0) + COALESCE(NEW.cost, 0),
    updated_at = NOW()
  WHERE id = NEW.chat_id;
  RETURN NEW;
END;
$$;

-- Trigger to update chat stats on message insert
CREATE TRIGGER trigger_update_chat_stats
AFTER INSERT ON feedback.chat_messages
FOR EACH ROW
EXECUTE FUNCTION feedback.update_chat_stats();

-- Function to get chat with messages (for loading a conversation)
CREATE OR REPLACE FUNCTION feedback.get_chat_with_messages(p_chat_id UUID, p_user_email TEXT)
RETURNS TABLE (
  chat_id UUID,
  user_email TEXT,
  subject TEXT,
  status TEXT,
  message_count INTEGER,
  total_tokens_used INTEGER,
  total_cost NUMERIC,
  chat_created_at TIMESTAMPTZ,
  message_id UUID,
  role TEXT,
  content TEXT,
  attachments JSONB,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost NUMERIC,
  message_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- Verify chat belongs to user
  IF NOT EXISTS (
    SELECT 1 FROM feedback.chats c
    WHERE c.id = p_chat_id AND c.user_email = p_user_email
  ) THEN
    RAISE EXCEPTION 'Chat not found or access denied';
  END IF;

  RETURN QUERY
  SELECT
    c.id as chat_id,
    c.user_email,
    c.subject,
    c.status,
    c.message_count,
    c.total_tokens_used,
    c.total_cost,
    c.created_at as chat_created_at,
    m.id as message_id,
    m.role,
    m.content,
    m.attachments,
    m.input_tokens,
    m.output_tokens,
    m.cost,
    m.created_at as message_created_at
  FROM feedback.chats c
  LEFT JOIN feedback.chat_messages m ON m.chat_id = c.id
  WHERE c.id = p_chat_id
  ORDER BY m.created_at ASC;
END;
$$;

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA feedback TO authenticated;
GRANT USAGE ON SCHEMA feedback TO service_role;

-- Grant table permissions (service_role only - all access through API)
GRANT ALL ON feedback.chats TO service_role;
GRANT ALL ON feedback.chat_messages TO service_role;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION feedback.get_chat_with_messages(UUID, TEXT) TO service_role;
