# User Access Monitoring

## Overview

FOSSAPP now includes a simple event tracking system to monitor user access and activity. Events are logged server-side to a PostgreSQL table in Supabase.

**Implemented**: 2025-11-11
**Version**: 1.0 (Simple start)

## Tracked Events

The system currently tracks the following events:

| Event Type | Description | Logged Data |
|------------|-------------|-------------|
| `login` | User successfully authenticates | provider (google), login_timestamp |
| `logout` | User signs out | logout_timestamp |
| `search` | User performs product search | search_query, results_count |
| `product_view` | User views product details | product_id, foss_pid, supplier, description |

## Database Schema

**Table**: `public.user_events`

```sql
CREATE TABLE public.user_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,              -- User email from NextAuth session
    event_type TEXT NOT NULL,           -- login, logout, search, product_view, etc.
    event_data JSONB,                   -- Flexible metadata
    session_id TEXT,                    -- Optional session grouping
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes**:
- `idx_user_events_user_id` - Efficient user-based queries
- `idx_user_events_event_type` - Efficient event-type queries
- `idx_user_events_created_at` - Time-based queries and cleanup
- `idx_user_events_user_time` - Composite index (user + time)

**Permissions**:
- `service_role`: SELECT, INSERT (server-side only)
- `authenticated`: SELECT, INSERT (logged-in users)

## Setup Instructions

### 1. Apply Database Migration

Run the SQL migration file on your Supabase database:

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project (hyppizgiozyyyelwdius)
3. Navigate to SQL Editor
4. Copy contents of `supabase/migrations/20251111_create_user_events_table.sql`
5. Paste and execute the SQL

**Option B: Supabase CLI** (if installed)
```bash
supabase db push
```

**Option C: Direct SQL Connection**
```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@db.hyppizgiozyyyelwdius.supabase.co:5432/postgres" \
  -f supabase/migrations/20251111_create_user_events_table.sql
```

### 2. Verify Table Creation

Run this query in Supabase SQL Editor to confirm:

```sql
SELECT * FROM public.user_events LIMIT 1;
```

You should see an empty result set (no errors).

### 3. Test Event Logging

Once deployed:
1. Sign in to FOSSAPP
2. Perform a product search
3. View a product detail page
4. Check the events table:

```sql
SELECT * FROM public.user_events
ORDER BY created_at DESC
LIMIT 10;
```

You should see login, search, and product_view events.

## Architecture

### Event Logger (`src/lib/event-logger.ts`)

Server-side utility function for logging events:

```typescript
import { logEvent } from '@/lib/event-logger'

// Log an event
await logEvent('search', 'user@example.com', {
  search_query: 'downlight',
  results_count: 42
})
```

**Features**:
- Server-side only (uses `supabaseServer`)
- Error-tolerant (won't crash app if logging fails)
- TypeScript typed event types
- Development mode console logging
- Batch logging support

### Integration Points

**1. NextAuth Callbacks** (`src/lib/auth.ts`)
- `signIn` callback logs successful login
- `signOut` event logs logout

**2. Product Search** (`src/lib/actions.ts`)
- `searchProductsAction` logs search queries and result counts

**3. Product Views** (`src/lib/actions.ts`)
- `getProductByIdAction` logs product detail views

**4. API Routes**
- `/api/products/search` - Passes session userId to search action
- `/api/products/[id]` - Passes session userId to product detail action

## Usage Examples

### Query Recent User Activity

```sql
-- All events for a specific user (last 24 hours)
SELECT
  event_type,
  event_data,
  created_at
FROM public.user_events
WHERE user_id = 'user@example.com'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Popular Search Queries

```sql
-- Top 10 search queries (last 7 days)
SELECT
  event_data->>'search_query' AS query,
  COUNT(*) AS search_count,
  AVG((event_data->>'results_count')::int) AS avg_results
FROM public.user_events
WHERE event_type = 'search'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY event_data->>'search_query'
ORDER BY search_count DESC
LIMIT 10;
```

### Most Viewed Products

```sql
-- Top 10 most viewed products (last 30 days)
SELECT
  event_data->>'product_id' AS product_id,
  event_data->>'description' AS description,
  event_data->>'supplier' AS supplier,
  COUNT(*) AS view_count
FROM public.user_events
WHERE event_type = 'product_view'
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY
  event_data->>'product_id',
  event_data->>'description',
  event_data->>'supplier'
ORDER BY view_count DESC
LIMIT 10;
```

### Daily Active Users

```sql
-- Daily active users (last 30 days)
SELECT
  DATE(created_at) AS date,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(*) AS total_events
FROM public.user_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### User Session Analysis

```sql
-- Events per user session
SELECT
  user_id,
  DATE(created_at) AS session_date,
  COUNT(*) AS events_in_session,
  MIN(created_at) AS session_start,
  MAX(created_at) AS session_end,
  EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) / 60 AS duration_minutes
FROM public.user_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, DATE(created_at)
ORDER BY session_date DESC, events_in_session DESC;
```

## Data Retention & Cleanup

Currently, events are stored indefinitely. Consider implementing a cleanup policy:

### Manual Cleanup (Delete old events)

```sql
-- Delete events older than 90 days
DELETE FROM public.user_events
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Automated Cleanup (Postgres Cron Extension)

Enable `pg_cron` extension in Supabase, then:

```sql
-- Schedule weekly cleanup (every Sunday at 3 AM)
SELECT cron.schedule(
  'cleanup_old_events',
  '0 3 * * 0',
  $$DELETE FROM public.user_events WHERE created_at < NOW() - INTERVAL '90 days'$$
);
```

## Privacy Considerations

- **User Identifier**: Email addresses are stored as `user_id`
- **GDPR Compliance**: Ensure users are informed about event tracking
- **Data Minimization**: Only essential data is logged
- **Retention Policy**: Implement automated cleanup for old events
- **Access Control**: Only `service_role` and `authenticated` users can query events

### Anonymizing User Data

If you need to anonymize data:

```sql
-- Hash user emails (one-way, cannot be reversed)
UPDATE public.user_events
SET user_id = MD5(user_id)
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Future Enhancements

Potential additions for future versions:

1. **Dashboard Visualization** - Admin panel to view analytics
2. **Real-time Monitoring** - WebSocket-based live event feed
3. **Alerts** - Trigger notifications on specific events
4. **Advanced Analytics** - Conversion funnels, retention analysis
5. **Export Functionality** - CSV/JSON export of event data
6. **User Activity Timeline** - Per-user event history view
7. **Geographic Tracking** - Log IP addresses/locations (with consent)
8. **Performance Metrics** - Track page load times, API response times
9. **Error Tracking** - Log client-side errors and exceptions
10. **A/B Testing Support** - Track experiment variants and outcomes

## Troubleshooting

### Events Not Being Logged

**Check 1: Table exists**
```sql
SELECT * FROM public.user_events LIMIT 1;
```

**Check 2: Permissions**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'user_events';
```

**Check 3: Application logs**
- Development: Check console for `[EventLogger]` messages
- Production: Check Docker logs: `docker-compose logs -f`

**Check 4: Session availability**
- Ensure user is authenticated (session exists)
- Check NextAuth configuration in `src/lib/auth.ts`

### Query Performance Issues

If queries are slow:

1. **Check indexes**:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'user_events';
```

2. **Analyze query plans**:
```sql
EXPLAIN ANALYZE
SELECT * FROM public.user_events
WHERE user_id = 'test@example.com'
ORDER BY created_at DESC;
```

3. **Implement partitioning** (for large datasets):
   - Partition by date range (monthly/yearly)
   - Improves query performance on time-based queries

## Support

For issues or questions:
- Check application logs: `docker-compose logs -f`
- Review Supabase logs in dashboard
- Consult CLAUDE.md for general architecture
- GitHub Issues: https://github.com/anthropics/claude-code/issues

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-11 | Initial implementation: login, logout, search, product_view events |
