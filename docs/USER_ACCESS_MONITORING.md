# User Access Monitoring

## Overview

FOSSAPP includes a comprehensive event tracking system to monitor user access and activity. Events are logged server-side to a PostgreSQL table in Supabase for analytics and insights.

**Implemented**: 2025-11-11 (v1.0), 2025-11-15 (v1.1 - Phase 1 expansion)
**Version**: 1.1 (Phase 1 complete)

## Implementation Status

### ✅ Phase 1 (Implemented)

**High Value, Low Effort** - Core analytics for immediate insights

| Category | Events | Status |
|----------|--------|--------|
| **Search & Discovery** | `search`, `search_refinement`, `search_no_results`, `search_filter_applied`, `search_sort_changed` | ✅ Implemented |
| **Product Engagement** | `product_view`, `product_image_viewed`, `product_details_expanded` | ✅ Implemented |
| **User Preferences** | `theme_toggled` | ✅ Implemented |
| **Error Tracking** | `client_error`, `api_error` | ✅ Implemented |
| **Performance Metrics** | `page_load_time`, `api_response_time` | ✅ Implemented |

### 🔜 Phase 2 (Planned)

**Medium Value, Medium Effort** - Enhanced product intelligence

| Category | Events | Priority |
|----------|--------|----------|
| **ETIM Classification** | `etim_class_explored`, `etim_feature_filtered`, etc. | Medium |
| **Export & Downloads** | `export_initiated`, `autocad_block_downloaded`, etc. | Medium |
| **User Journey** | `session_started`, `scroll_depth`, `time_on_page` | Medium |
| **PWA Events** | `pwa_installed`, `pwa_launched`, `pwa_update_installed` | Low |

### 🎯 Phase 3 (Future)

**High Value, High Effort** - Advanced features

| Category | Events | Priority |
|----------|--------|----------|
| **Collaboration** | Projects, sharing, comments | Low |
| **A/B Testing** | Experiments, feature flags | Low |
| **Business Intelligence** | Quotes, orders, supplier contact | Low |

## Currently Tracked Events

The system currently tracks these events:

| Event Type | Description | Logged Data |
|------------|-------------|-------------|
| **Authentication** | | |
| `login` | User successfully authenticates | provider (google), login_timestamp |
| `logout` | User signs out | logout_timestamp |
| **Search & Discovery** | | |
| `search` | User performs product search | search_query, results_count |
| `search_no_results` | Search returns zero results | search_query |
| `search_refinement` | User modifies search query | original_query, refined_query, time_between_searches |
| `search_filter_applied` | User applies filters | filter_type, filter_value, results_before, results_after |
| `search_sort_changed` | User changes sort order | sort_field, sort_direction, results_count |
| **Product Engagement** | | |
| `product_view` | User views product details | product_id, foss_pid, supplier, description |
| `product_image_viewed` | User views/zooms product image | product_id, image_index, total_images, zoomed |
| `product_details_expanded` | User expands accordion sections | product_id, section (technical/features/etim) |
| **User Preferences** | | |
| `theme_toggled` | User switches theme | from_theme, to_theme (light/dark/system) |
| **Error Tracking** | | |
| `client_error` | Client-side JavaScript error | error_message, error_name, component_stack, error_stack |
| `api_error` | API request failure | endpoint, status_code, method, error_message |
| **Performance Metrics** | | |
| `page_load_time` | Page load performance | pathname, load_time_ms, dom_content_loaded_ms, transfer_size_kb |
| `api_response_time` | API latency tracking | endpoint, response_time_ms, status_code, method |

## Database Schema

**Schema**: `analytics` (domain-driven organization)
**Table**: `analytics.user_events`

```sql
CREATE TABLE analytics.user_events (
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

**Database Functions**:
- `analytics.get_most_active_users(user_limit)` - Returns top active users by event count
  - Used by Dashboard "Most Active Users" card
  - Returns: user_id, event_count, last_active, login_count, search_count, product_view_count

**Note**: The `analytics` schema must be exposed in Supabase API settings for PostgREST access.

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
SELECT * FROM analytics.user_events LIMIT 1;
```

You should see an empty result set (no errors).

### 3. Expose Analytics Schema in Supabase

**IMPORTANT**: Ensure the `analytics` schema is exposed in Supabase API settings:

1. Go to https://supabase.com/dashboard/project/hyppizgiozyyyelwdius/settings/api
2. Under **API Settings** → **Exposed schemas**
3. Verify `analytics` is included in the list (along with public, items, etim, customers)
4. If not listed, add it and save

This is required for the application to access `analytics.get_most_active_users()` function.

### 4. Test Event Logging

Once deployed:
1. Sign in to FOSSAPP
2. Perform a product search
3. View a product detail page
4. Check the events table:

```sql
SELECT * FROM analytics.user_events
ORDER BY created_at DESC
LIMIT 10;
```

You should see login, search, and product_view events.

### 5. Test Dashboard Function

Verify the analytics function works:

```sql
SELECT * FROM analytics.get_most_active_users(5);
```

Should return top 5 active users with event counts.

## Architecture

### 1. Server-Side Event Logger (`src/lib/event-logger.ts`)

Server-side utility function for logging events from server actions and API routes:

```typescript
import { logEvent } from '@/lib/event-logger'

// Log an event from server action
await logEvent('search', 'user@example.com', {
  eventData: { search_query: 'downlight', results_count: 42 },
  pathname: '/products'
})
```

**Features**:
- Server-side only (uses `supabaseServer`)
- Error-tolerant (won't crash app if logging fails)
- TypeScript typed event types
- Development mode console logging
- Batch logging support
- Logs to `analytics.user_events` table (domain-driven schema organization)

### 2. Client-Side Event Logger (`src/lib/event-logger.ts`)

Client-side wrapper that sends events to API endpoint:

```typescript
import { logEventClient } from '@/lib/event-logger'

// Log event from client component
await logEventClient('theme_toggled', {
  from_theme: 'light',
  to_theme: 'dark'
})
```

**API Endpoint**: `/api/analytics/log-event`
- Authenticates user via session
- Validates event data
- Extracts pathname and user agent
- Delegates to server-side logger

### 3. Error Tracking (`src/components/error-boundary.tsx`)

React Error Boundary for catching client-side errors:

```typescript
import { ErrorBoundary } from '@/components/error-boundary'

// Wrap components to catch errors
<ErrorBoundary fallback={<CustomError />}>
  <YourComponent />
</ErrorBoundary>
```

**Features**:
- Catches React component errors
- Logs errors to analytics automatically
- Customizable fallback UI
- Global error handlers for unhandled promises and uncaught errors

**Setup** (add to root layout):
```typescript
'use client'
import { initializeGlobalErrorHandling } from '@/components/error-boundary'

useEffect(() => {
  initializeGlobalErrorHandling()
}, [])
```

### 4. API Client with Error Tracking (`src/lib/api-client.ts`)

Enhanced fetch wrapper with automatic error and performance tracking:

```typescript
import { apiClient, apiGet, apiPost } from '@/lib/api-client'

// Automatic error tracking and performance monitoring
const data = await apiGet('/api/products/search?q=downlight')

// Or use the raw client
const response = await apiClient('/api/endpoint', {
  method: 'POST',
  trackPerformance: true // default
})
```

**Features**:
- Automatic `api_error` logging for failed requests
- Automatic `api_response_time` tracking
- Network error handling
- Convenience methods (`apiGet`, `apiPost`)

### 5. Performance Tracking Hook (`src/hooks/use-page-performance.ts`)

Custom hook for page load performance monitoring:

```typescript
import { usePagePerformance } from '@/hooks/use-page-performance'

function MyPage() {
  usePagePerformance() // Automatically tracks page load
  return <div>...</div>
}
```

**Metrics Tracked**:
- Total page load time
- DOM content loaded time
- DOM interactive time
- Transfer size (KB)

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

**5. Dashboard Analytics** (`src/components/most-active-users-card.tsx`)
- Fetches data using `getMostActiveUsersAction()` from `src/lib/actions.ts`
- Calls `analytics.get_most_active_users()` database function
- Displays top active users with event breakdown (logins, searches, views)

## Usage Examples

### Query Recent User Activity

```sql
-- All events for a specific user (last 24 hours)
SELECT
  event_type,
  event_data,
  created_at
FROM analytics.user_events
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
FROM analytics.user_events
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
FROM analytics.user_events
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
FROM analytics.user_events
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
FROM analytics.user_events
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id, DATE(created_at)
ORDER BY session_date DESC, events_in_session DESC;
```

### Most Active Users (Dashboard Function)

```sql
-- Get top 10 most active users (used by Dashboard)
SELECT * FROM analytics.get_most_active_users(10);
```

## Data Retention & Cleanup

Currently, events are stored indefinitely. Consider implementing a cleanup policy:

### Manual Cleanup (Delete old events)

```sql
-- Delete events older than 90 days
DELETE FROM analytics.user_events
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Automated Cleanup (Postgres Cron Extension)

Enable `pg_cron` extension in Supabase, then:

```sql
-- Schedule weekly cleanup (every Sunday at 3 AM)
SELECT cron.schedule(
  'cleanup_old_events',
  '0 3 * * 0',
  $$DELETE FROM analytics.user_events WHERE created_at < NOW() - INTERVAL '90 days'$$
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
UPDATE analytics.user_events
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
SELECT * FROM analytics.user_events LIMIT 1;
```

**Check 2: Analytics schema is exposed**
- Verify in Supabase Dashboard → Settings → API → Exposed schemas
- Should include: `analytics` (along with public, items, etim, customers)

**Check 3: Permissions**
```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'analytics' AND table_name = 'user_events';
```

**Check 4: Application logs**
- Development: Check console for `[EventLogger]` messages
- Production: Check Docker logs: `docker-compose logs -f`

**Check 5: Session availability**
- Ensure user is authenticated (session exists)
- Check NextAuth configuration in `src/lib/auth.ts`

**Check 6: Dashboard function**
```sql
-- Test the analytics function directly
SELECT * FROM analytics.get_most_active_users(5);
```

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
SELECT * FROM analytics.user_events
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

---

## Future Events Catalog

Comprehensive list of events planned for Phase 2 and Phase 3 implementation.

### 🔜 Phase 2: Enhanced Product Intelligence

**Priority**: Medium | **Effort**: Medium | **Timeline**: Q1 2026

#### ETIM Classification Events
```typescript
'etim_class_explored'       // { etim_class_code, class_name, depth_level }
'etim_feature_filtered'     // { feature_name, feature_value, results_count }
'etim_hierarchy_navigated'  // { from_class, to_class, navigation_type: 'up|down|sibling' }
'etim_value_selected'       // { feature_code, value_code, product_count }
```

#### Export & Download Events
```typescript
'export_initiated'          // { export_type: 'csv|excel|pdf', item_count }
'export_completed'          // { export_type, file_size_kb, duration_ms }
'export_failed'             // { export_type, error_message }
'autocad_block_downloaded'  // { product_id, file_format: 'dwg|dxf' }
'product_list_exported'     // { format, product_count, filters_applied }
'bim_model_downloaded'      // { product_id, format: 'ifc|revit' }
```

#### User Journey & Workflow
```typescript
'session_started'           // { entry_point, referrer, device_type }
'session_idle'              // { idle_duration_minutes }
'page_visibility_changed'   // { is_visible: boolean, duration_ms }
'scroll_depth'              // { page, max_scroll_percent }
'time_on_page'              // { route, duration_seconds }
'user_flow_completed'       // { flow_name: 'search_to_view|browse_to_favorite', steps, duration }
'rage_click_detected'       // { element, click_count, element_selector }
```

#### PWA Events
```typescript
'pwa_installed'             // { platform: 'desktop|mobile|tablet' }
'pwa_launched'              // { launch_mode: 'standalone|browser' }
'pwa_update_available'      // { current_version, new_version }
'pwa_update_installed'      // { from_version, to_version, auto: boolean }
'offline_action_queued'     // { action_type, will_sync_at }
'push_notification_granted' // { platform }
'add_to_home_prompt_shown'  // { user_action: 'accepted|dismissed|ignored' }
```

#### Advanced Search Events
```typescript
'search_filter_applied'     // { filter_type: 'supplier|category|price', filter_value, results_before, results_after }
'search_sort_changed'       // { sort_field, sort_direction, results_count }
'catalog_filter_applied'    // { catalog_name, filter_type }
'supplier_filter_toggle'    // { supplier_name, is_filtered_in: boolean }
```

#### Product Engagement (Extended)
```typescript
'product_favorite_added'    // { product_id, foss_pid, supplier }
'product_favorite_removed'  // { product_id, foss_pid }
'product_comparison_added'  // { product_id, comparison_list_size }
'product_datasheet_viewed'  // { product_id, document_type: 'pdf|dwg|ifc' }
'product_share_clicked'     // { product_id, share_method: 'link|email' }
'related_product_clicked'   // { source_product_id, target_product_id }
```

#### Supplier & Catalog Events
```typescript
'supplier_page_viewed'      // { supplier_name, products_count }
'catalog_opened'            // { catalog_name, product_count, last_updated }
'catalog_download_started'  // { catalog_name, format: 'bmecat|excel' }
'new_catalog_notification'  // { catalog_name, product_count, notification_sent }
'price_alert_set'           // { product_id, threshold_type: 'above|below', threshold_value }
```

### 🎯 Phase 3: Advanced Features

**Priority**: Low | **Effort**: High | **Timeline**: Q2-Q3 2026

#### Collaboration & Sharing
```typescript
'project_created'           // { project_name, initial_products_count }
'project_shared'            // { project_id, share_method: 'email|link', recipient_count }
'product_added_to_project'  // { project_id, product_id }
'comment_added'             // { entity_type: 'product|project', entity_id }
'team_member_invited'       // { project_id, role }
```

#### Notifications & Alerts
```typescript
'notification_received'     // { notification_type, delivery_method: 'in-app|email' }
'notification_clicked'      // { notification_id, action_taken }
'notification_dismissed'    // { notification_id, time_to_dismiss_seconds }
'alert_triggered'           // { alert_type: 'new_products|price_change|stock_update' }
```

#### Onboarding & Help
```typescript
'onboarding_started'        // { user_type: 'new|returning' }
'onboarding_step_completed' // { step_number, step_name }
'onboarding_skipped'        // { at_step }
'tutorial_watched'          // { tutorial_id, completion_percent }
'help_article_viewed'       // { article_id, search_query? }
'feedback_submitted'        // { feedback_type: 'bug|feature|general', rating }
```

#### Mobile & Device Specific
```typescript
'mobile_gesture_used'       // { gesture_type: 'swipe|pinch|long-press', context }
'mobile_menu_toggled'       // { is_open: boolean }
'keyboard_shortcut_used'    // { shortcut_key, action }
```

#### A/B Testing & Experiments
```typescript
'experiment_assigned'       // { experiment_name, variant, user_cohort }
'experiment_conversion'     // { experiment_name, variant, conversion_metric }
'feature_flag_evaluated'    // { flag_name, is_enabled, user_segment }
```

#### Business Intelligence (Future)
```typescript
'quote_requested'           // { product_ids[], quantity, urgency: 'standard|urgent' }
'quote_downloaded'          // { quote_id, format: 'pdf|excel' }
'price_comparison_viewed'   // { product_id, competitor_count }
'bulk_order_initiated'      // { product_count, total_estimated_value }
'supplier_contacted'        // { supplier_name, contact_method: 'email|phone|form' }
```

#### Feature Usage & Navigation
```typescript
'dashboard_card_clicked'    // { card_type: 'active_catalogs|recent_products|stats' }
'sidebar_nav_clicked'       // { destination_route, from_route }
'quick_action_used'         // { action_type: 'recent|favorites|downloads' }
'help_tooltip_viewed'       // { tooltip_id, context_page }
```

#### Advanced Performance Metrics
```typescript
'slow_query_detected'       // { query_type, duration_ms, threshold_ms }
'image_load_failed'         // { product_id, image_url, error }
'offline_mode_activated'    // { last_sync_time, cached_pages_count }
'search_latency'            // { query_length, results_count, latency_ms }
```

#### User Preferences (Extended)
```typescript
'language_changed'          // { from_lang, to_lang }
'display_density_changed'   // { density: 'compact|comfortable|spacious' }
'results_per_page_changed'  // { from_count, to_count }
'default_catalog_set'       // { catalog_name }
'notification_preference'   // { notification_type, enabled: boolean }
```

#### Network & Session Events
```typescript
'network_error'             // { endpoint, error_type, retry_count }
'session_expired'           // { last_activity_time, session_duration_minutes }
'auth_failure'              // { provider, error_reason }
'404_not_found'             // { requested_path, referrer }
'form_validation_error'     // { form_name, field_name, validation_rule }
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-11 | Initial implementation: login, logout, search, product_view events |
| 1.1 | 2025-11-15 | **Phase 1 Complete**: Added search refinement, product engagement, theme toggle, error tracking, performance metrics. New infrastructure: ErrorBoundary, apiClient, usePagePerformance hook, client-side logger. Future events catalog added for Phase 2-3 planning. |
