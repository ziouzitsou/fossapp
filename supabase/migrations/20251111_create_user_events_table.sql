-- Create analytics schema and user_events table for access monitoring
-- Migration: 20251111_create_user_events_table
-- Purpose: Track user access events (login, logout, searches, product views)

-- Create analytics schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create user_events table in analytics schema
CREATE TABLE IF NOT EXISTS analytics.user_events (
    -- Core fields
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Context fields
    session_id TEXT,
    pathname TEXT,

    -- Event metadata (flexible)
    event_data JSONB,

    -- Technical metadata
    user_agent TEXT
);

-- Create index on user_id for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON analytics.user_events(user_id);

-- Create index on event_type for efficient event-type queries
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON analytics.user_events(event_type);

-- Create index on created_at for time-based queries and cleanup
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON analytics.user_events(created_at DESC);

-- Create composite index for common query patterns (user + time)
CREATE INDEX IF NOT EXISTS idx_user_events_user_time ON analytics.user_events(user_id, created_at DESC);

-- Create index on pathname for page analytics
CREATE INDEX IF NOT EXISTS idx_user_events_pathname ON analytics.user_events(pathname);

-- Grant permissions to analytics schema
GRANT USAGE ON SCHEMA analytics TO service_role;
GRANT USAGE ON SCHEMA analytics TO authenticated;

-- Grant permissions on table
GRANT SELECT, INSERT ON analytics.user_events TO service_role;
GRANT SELECT, INSERT ON analytics.user_events TO authenticated;

-- Add comments for documentation
COMMENT ON SCHEMA analytics IS 'Analytics and monitoring data (user events, metrics, etc.)';
COMMENT ON TABLE analytics.user_events IS 'Stores user access and activity events for monitoring and analytics';
COMMENT ON COLUMN analytics.user_events.user_id IS 'User email from NextAuth session';
COMMENT ON COLUMN analytics.user_events.event_type IS 'Type of event: login, logout, search, product_view, etc.';
COMMENT ON COLUMN analytics.user_events.pathname IS 'Route/page path where event occurred (e.g., /products, /dashboard)';
COMMENT ON COLUMN analytics.user_events.event_data IS 'Flexible JSON metadata: search_query, product_id, result_count, etc.';
COMMENT ON COLUMN analytics.user_events.session_id IS 'Session identifier for grouping related events';
COMMENT ON COLUMN analytics.user_events.user_agent IS 'Browser and device information from User-Agent header';
COMMENT ON COLUMN analytics.user_events.created_at IS 'Timestamp when the event occurred';
