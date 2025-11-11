-- Create user_events table for access monitoring
-- Migration: 20251111_create_user_events_table
-- Purpose: Track user access events (login, logout, searches, product views)

CREATE TABLE IF NOT EXISTS public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on user_id for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON public.user_events(user_id);

-- Create index on event_type for efficient event-type queries
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON public.user_events(event_type);

-- Create index on created_at for time-based queries and cleanup
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON public.user_events(created_at DESC);

-- Create composite index for common query patterns (user + time)
CREATE INDEX IF NOT EXISTS idx_user_events_user_time ON public.user_events(user_id, created_at DESC);

-- Grant permissions
GRANT SELECT, INSERT ON public.user_events TO service_role;
GRANT SELECT, INSERT ON public.user_events TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE public.user_events IS 'Stores user access and activity events for monitoring and analytics';
COMMENT ON COLUMN public.user_events.user_id IS 'User email from NextAuth session';
COMMENT ON COLUMN public.user_events.event_type IS 'Type of event: login, logout, search, product_view, etc.';
COMMENT ON COLUMN public.user_events.event_data IS 'Flexible JSON metadata: search_query, product_id, referrer, etc.';
COMMENT ON COLUMN public.user_events.session_id IS 'Session identifier for grouping related events';
COMMENT ON COLUMN public.user_events.created_at IS 'Timestamp when the event occurred';
