# FOSSAPP - Technical Debt & Optimization TODO

**Last Updated**: 2025-11-11
**Source**: Gemini Code Auditor Agent (v1.4.3 audit)

This document tracks optimization suggestions, technical debt, and future improvements identified by automated audits and code reviews.

---

## Priority Legend

- 🔴 **High Priority**: Should address within 1-2 weeks
- 🟡 **Medium Priority**: Address within 1-2 months
- 🟢 **Low Priority**: Nice to have, address when convenient
- 💡 **Future Enhancement**: For v2.0 or major refactors

---

## Warnings from Latest Audit (2025-11-11)

### 🟡 WARNING 1: Inconsistent String Interpolation in Query Filters

**Severity**: Medium
**Files**:
- `src/lib/actions.ts:57` (product search)
- `src/lib/actions.ts:473` (customer search)

**Issue**: While functionally safe, `.ilike` and `.or` methods use string interpolation that could be more explicit about parameterization.

**Current Code**:
```typescript
.or(`description_short.ilike.%${sanitizedQuery}%,foss_pid.ilike.%${sanitizedQuery}%,...`)
```

**Recommendation**: Refactor to make parameterization more explicit
```typescript
// Option 1: Chain individual conditions
.or('description_short.ilike.*')
.or('foss_pid.ilike.*')

// Option 2: Use object notation (if supported)
.or([
  { description_short: { ilike: `%${sanitizedQuery}%` } },
  { foss_pid: { ilike: `%${sanitizedQuery}%` } },
  // ...
])
```

**Impact**: Improves code clarity and defense-in-depth

**Estimated Effort**: 1-2 hours

**Status**: ⏳ Pending

---

### 🟢 WARNING 2: PII Exposure in Event Logging

**Severity**: Low
**Files**:
- `src/lib/actions.ts:63-68`
- `src/lib/actions.ts:137-142`

**Issue**: Error logging includes partial user identifiers (username part of email).

**Current Code**:
```typescript
console.error('Product search failed:', {
  userId: userId?.split('@')[0],  // "dimitri"
  query: sanitizedQuery.substring(0, 50),
  // ...
})
```

**Recommendation**: Hash or remove user identifiers from error logs
```typescript
// Option 1: Hash user ID
userId: userId ? hashUserId(userId) : undefined

// Option 2: Remove entirely for error logs
// (only log in success cases for analytics)
```

**Impact**: Better GDPR compliance for future multi-tenant versions

**Estimated Effort**: 30 minutes

**Status**: ⏳ Pending

**Note**: Low priority for internal tool with @foss.gr users only

---

### 🟡 WARNING 3: Missing Rate Limiting on API Endpoints

**Severity**: Medium
**Files**:
- `src/app/api/products/search/route.ts`
- `src/app/api/products/[id]/route.ts`

**Issue**: No rate limiting on authenticated API endpoints. Could lead to resource exhaustion.

**Recommendation**: Implement rate limiting middleware
```typescript
import { Ratelimit } from '@upstash/ratelimit'

const limiter = new Ratelimit({
  redis: ...,
  limiter: Ratelimit.slidingWindow(30, '1 m'),  // 30 requests per minute
})

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { success } = await limiter.limit(session.user.email)
  if (!success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  // Continue with request...
}
```

**Libraries to Consider**:
- `@upstash/ratelimit` (Redis-based, distributed)
- `next-rate-limit` (memory-based, simpler)

**Impact**: Prevents abuse and resource exhaustion

**Estimated Effort**: 2-3 hours (including Redis setup if using Upstash)

**Status**: ⏳ Pending

**Priority Note**: Implement before scaling beyond ~10 concurrent users

---

## Optimization Suggestions

### 💡 SUGGESTION 1: Strengthen Input Validation Regex

**Priority**: 🟢 Low
**File**: `src/lib/actions.ts:8-20`, `src/lib/actions.ts:22-34`

**Issue**: Input validation could be more defensive with explicit character whitelist.

**Current Code**:
```typescript
function validateSearchQuery(query: string): string {
  const sanitized = query.trim().slice(0, 100)
  if (sanitized.length === 0) {
    throw new Error('Search query cannot be empty')
  }
  return sanitized
}
```

**Recommendation**: Add character filtering
```typescript
function validateSearchQuery(query: string): string {
  // Remove potentially problematic characters
  const cleaned = query
    .trim()
    .slice(0, 100)
    .replace(/[<>{}[\]\\]/g, '')  // Remove brackets, backslashes

  if (cleaned.length === 0) {
    throw new Error('Search query cannot be empty')
  }
  return cleaned
}
```

**Benefit**: Defense-in-depth against edge cases

**Estimated Effort**: 15 minutes

**Status**: ⏳ Pending

---

### 🟡 SUGGESTION 2: Add TypeScript Strict Mode to Product Aggregation

**Priority**: Medium
**File**: `src/lib/actions.ts:409-414`

**Issue**: Using `any` type in aggregation function.

**Current Code**:
```typescript
products.forEach((product: any) => {
  const catalogId = product.catalog_id
  countMap.set(catalogId, (countMap.get(catalogId) || 0) + 1)
})
```

**Recommendation**: Replace with proper type
```typescript
interface ProductCatalogRow {
  catalog_id: number
}

if (products && Array.isArray(products)) {
  products.forEach((product: ProductCatalogRow) => {
    const catalogId = product.catalog_id
    if (typeof catalogId === 'number') {
      countMap.set(catalogId, (countMap.get(catalogId) || 0) + 1)
    }
  })
}
```

**Benefit**: Type safety, catches errors at compile time

**Estimated Effort**: 30 minutes (find all instances of `any` in actions.ts)

**Status**: ⏳ Pending

---

### 🔴 SUGGESTION 3: Optimize Database Queries - Use Database-Level Aggregation

**Priority**: High
**Files**:
- `src/lib/actions.ts:270-308` (Supplier stats)
- `src/lib/actions.ts:315-344` (Top families)
- `src/lib/actions.ts:199-250` (Dashboard stats)

**Issue**: Fetching all products and aggregating in application code is inefficient.

**Current Approach**:
```typescript
// Fetch ALL products
const { data } = await supabaseServer
  .schema('items')
  .from('product_info')
  .select('supplier_name, ...')

// Then aggregate in JavaScript
const supplierMap = new Map<string, SupplierStats>()
data?.forEach((item) => {
  // Count products per supplier
})
```

**Recommendation**: Create database functions for aggregation
```sql
-- PostgreSQL function
CREATE OR REPLACE FUNCTION items.get_supplier_stats()
RETURNS TABLE (
  supplier_name text,
  product_count bigint,
  supplier_logo text,
  supplier_logo_dark text
) AS $$
  SELECT
    supplier_name,
    COUNT(*) as product_count,
    MAX(supplier_logo) as supplier_logo,
    MAX(supplier_logo_dark) as supplier_logo_dark
  FROM items.product_info
  WHERE supplier_name IS NOT NULL
  GROUP BY supplier_name
  ORDER BY product_count DESC
$$ LANGUAGE sql STABLE;
```

**TypeScript Call**:
```typescript
const { data, error } = await supabaseServer.rpc('get_supplier_stats')
return data || []
```

**Benefit**:
- Reduces data transfer by ~99%
- Faster execution (database aggregation)
- Scales better with large datasets

**Estimated Effort**: 4-6 hours (create 3 functions + migrations)

**Status**: ⏳ Pending

**Impact**: High - significant performance improvement for dashboard

---

### 🟢 SUGGESTION 4: Add Explicit Transaction Boundaries

**Priority**: Low
**File**: `src/lib/event-logger.ts:127-169`

**Issue**: Batch insert without explicit transaction boundaries.

**Current Code**:
```typescript
const { error } = await supabaseServer
  .from('analytics.user_events')
  .insert(records)
```

**Recommendation**: Wrap in explicit transaction
```typescript
// Create PostgreSQL function with transaction
CREATE OR REPLACE FUNCTION insert_events_batch(events jsonb)
RETURNS void AS $$
BEGIN
  INSERT INTO analytics.user_events (event_type, user_id, event_data, ...)
  SELECT * FROM jsonb_to_recordset(events) AS ...;
END;
$$ LANGUAGE plpgsql;

// TypeScript
const { error } = await supabaseServer.rpc('insert_events_batch', {
  events: records
})
```

**Benefit**: All-or-nothing guarantee for batch operations

**Estimated Effort**: 1 hour

**Status**: ⏳ Pending

---

### 🟡 SUGGESTION 5: Implement Caching for Dashboard Statistics

**Priority**: Medium
**File**: `src/lib/actions.ts:199-250`

**Issue**: Dashboard queries database on every page load.

**Recommendation**: Add Next.js caching
```typescript
import { unstable_cache } from 'next/cache'

export const getDashboardStatsAction = unstable_cache(
  async (): Promise<DashboardStats> => {
    // Existing implementation
  },
  ['dashboard-stats'],
  {
    revalidate: 300,  // 5 minutes
    tags: ['dashboard']
  }
)
```

**Benefit**:
- Reduces database load by ~95%
- Faster page loads
- Stats don't need real-time data

**Revalidation Strategy**:
- Time-based: Every 5 minutes
- Event-based: `revalidateTag('dashboard')` on product updates

**Estimated Effort**: 1 hour

**Status**: ⏳ Pending

---

## Future Enhancements (v2.0+)

### 💡 Row-Level Security (RLS) Implementation

**Priority**: Future (if app becomes multi-tenant)
**Effort**: High (1-2 weeks)

**Current**: Service role key bypasses all RLS policies
**Future**: User-specific Supabase clients with RLS enforcement

**When to implement**:
- Application needs multi-tenant support
- Multiple organizations using the platform
- Different data access rules per user/org

**Status**: 📋 Backlog

---

### 💡 Migrate to next-auth v5 (Auth.js)

**Priority**: Future (when stable version released)
**Effort**: Medium (4-8 hours)

**Current**: next-auth v4.24.11 (compatible with Next.js 16)
**Future**: next-auth v5 (full Next.js 16 support)

**Reference**: `docs/NEXTAUTH_V5_MIGRATION_GUIDE.md` (ready when needed)

**Status**: 📋 Backlog

---

### 💡 Comprehensive Rate Limiting Middleware

**Priority**: Future (before public release)
**Effort**: Medium (1 week)

**Features**:
- Per-user rate limits (authenticated)
- IP-based rate limits (public endpoints)
- Configurable thresholds
- Redis-backed (distributed)
- Monitoring and alerts

**Status**: 📋 Backlog

---

### 💡 GDPR-Compliant Logging System

**Priority**: Future (if handling EU user data)
**Effort**: Medium (3-5 days)

**Features**:
- PII hashing in all logs
- Data retention policies
- Log anonymization tools
- GDPR compliance audit trail

**Status**: 📋 Backlog

---

## Tracking

### Summary

| Priority | Total | Pending | In Progress | Completed |
|----------|-------|---------|-------------|-----------|
| 🔴 High  | 1     | 1       | 0           | 0         |
| 🟡 Medium| 4     | 4       | 0           | 0         |
| 🟢 Low   | 2     | 2       | 0           | 0         |
| 💡 Future| 4     | 4       | 0           | 0         |
| **Total**| **11**| **11**  | **0**       | **0**     |

### Recently Completed

- ✅ **SQL Injection Fix** (v1.4.3) - Fixed raw SQL in `getActiveCatalogsFallback()`
- ✅ **API Authentication** (v1.4.2) - Required auth on product endpoints
- ✅ **NextAuth Domain Validation** (v1.4.2) - Fixed critical auth bypass
- ✅ **Automated Security Audits** (v1.4.3) - Gemini audit system operational

---

## Next Actions

**This Week** (2025-11-11 to 2025-11-17):
1. Review and prioritize warnings with team
2. Decide on rate limiting approach
3. Schedule time for database aggregation functions

**This Month** (November 2025):
1. Implement database-level aggregation (🔴 High priority)
2. Add rate limiting to API endpoints (🟡 Medium priority)
3. Refactor query filters for clarity (🟡 Medium priority)

**Next Quarter** (Q1 2026):
1. Add caching for dashboard stats
2. Implement strict TypeScript types throughout
3. Plan v2.0 architectural improvements (RLS, multi-tenant)

---

## Notes

- All TODO items sourced from Gemini Code Auditor agent (2025-11-11 audit)
- Priorities assigned based on security impact, performance benefit, and effort
- Update this file after each major audit or code review
- Mark items as completed and add to changelog when done

**Related Documents**:
- Audit Report: `audits/20251111_211000_GEMINI_AUDIT.md`
- Agent Documentation: `docs/gemini-auditor.md`
- Project Guide: `CLAUDE.md`

---

**Document Version**: 1.0
**Next Review**: 2025-11-18 (weekly)
