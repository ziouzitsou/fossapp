---
name: supabase-patterns
description: Critical reference for all Supabase database operations. Use this whenever reading from or writing to the database to ensure correct client usage (supabaseServer vs supabase), schema names, and query patterns. CRITICAL for security.
---

# Supabase Patterns for FOSSAPP

**CRITICAL:** Using the wrong Supabase client is a **security vulnerability**. This skill ensures you always use the correct client for the context.

---

## ⚠️ Dual Supabase Client Pattern (CRITICAL)

FOSSAPP uses TWO different Supabase clients with different access levels:

### Server-Side Client (ADMIN ACCESS)

**File:** `src/lib/supabase-server.ts`
**Key:** `SUPABASE_SERVICE_ROLE_KEY` (full admin access)
**Use in:** Server actions, API routes

```typescript
import { supabaseServer } from '@/lib/supabase-server'

export async function serverAction() {
  const { data, error } = await supabaseServer
    .from('items.product_info')
    .select('*')

  return data
}
```

**⚠️ NEVER expose to client!** This client bypasses Row Level Security (RLS).

### Client-Side Client (LIMITED ACCESS)

**File:** `src/lib/supabase.ts`
**Key:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (limited permissions)
**Use in:** Browser components only

```typescript
'use client'

import { supabase } from '@/lib/supabase'

export function ClientComponent() {
  const fetchData = async () => {
    const { data } = await supabase
      .from('items.product_info')
      .select('*')
    return data
  }
}
```

### Decision Tree

```
┌─ Where is this code running? ──────────────────────┐
│                                                     │
│  Server Actions ('use server')                     │
│  API Routes (route.ts)              ────────────▶  supabaseServer
│  Server Components (no 'use client')               │
│                                                     │
│  Client Components ('use client')   ────────────▶  supabase (or better: use server action)
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Rule of Thumb:** When in doubt, use a server action with `supabaseServer`.

---

## Database Schema Organization

### Available Schemas

```
items.*        → Product catalog data (56K+ products)
  ├── product              (base product table)
  ├── product_detail       (descriptions, classifications)
  ├── product_feature      (ETIM features)
  ├── product_info         (materialized view - USE THIS for queries)
  └── product_price        (pricing data)

etim.*         → ETIM classification system
  ├── class                (product classes: EC001744, etc.)
  ├── feature              (feature definitions: EF000004, etc.)
  ├── value                (predefined values: EV006167, etc.)
  ├── unit                 (units of measure: EU570448, etc.)
  └── classfeaturemap      (class-to-feature mappings)

search.*       → Advanced search system
  ├── taxonomy             (human-friendly categories)
  ├── classification_rules (ETIM → taxonomy mapping)
  ├── product_taxonomy_flags (boolean: indoor, ceiling, dimmable)
  ├── product_filter_index (filter values: CCT, IP, voltage)
  └── filter_facets        (pre-aggregated counts)

analytics.*    → User tracking and metrics
  ├── page_views
  ├── user_sessions
  └── product_interactions

projects.*     → Project management (future)
customers.*    → Customer data (future)
```

### Schema Usage Examples

```typescript
// Query products (use materialized view)
const { data } = await supabaseServer
  .from('items.product_info')  // Schema prefix required
  .select('*')

// Query ETIM classifications
const { data } = await supabaseServer
  .schema('etim')              // Can set schema once
  .from('class')
  .select('*')

// Call RPC function
const { data } = await supabaseServer
  .schema('items')
  .rpc('get_dashboard_stats')

// Search with filters
const { data } = await supabaseServer
  .schema('search')
  .rpc('search_products_with_filters', {
    search_query: 'downlight',
    taxonomy_codes: ['LUM_CEIL_REC']
  })
```

---

## Common Query Patterns

### Select Specific Columns (Performance)

```typescript
// ✅ GOOD: Specific columns
const { data } = await supabaseServer
  .from('items.product_info')
  .select('product_id, description_short, supplier_name, prices')
  .limit(50)

// ❌ BAD: SELECT * (transfers unnecessary data)
const { data } = await supabaseServer
  .from('items.product_info')
  .select('*')
```

### Filtering

```typescript
// Exact match
.eq('supplier_name', 'Delta Light')

// Case-insensitive search
.ilike('description_short', `%${query}%`)

// Multiple conditions
.eq('supplier_name', 'Delta Light')
.ilike('description_short', '%LED%')

// IN clause
.in('supplier_name', ['Delta Light', 'Modular'])

// Range
.gte('price', 100)
.lte('price', 500)
```

### Single Record

```typescript
const { data, error } = await supabaseServer
  .from('items.product_info')
  .select('*')
  .eq('product_id', id)
  .single()  // Expect exactly one result

if (error) {
  console.error('Product not found:', error)
  return null
}
```

### Always Limit Results

```typescript
// Search queries
.limit(50)

// List views
.limit(100)

// Single record
.single()
```

---

## RPC Functions (PostgreSQL Functions)

### When to Use RPC

Use PostgreSQL functions for:
1. **Aggregations** - COUNT, SUM, GROUP BY
2. **Complex joins** - Let PostgreSQL optimize
3. **Multiple queries** - Batch into single call
4. **Performance** - Reduce data transfer

### Calling RPC Functions

```typescript
const { data, error } = await supabaseServer
  .schema('items')
  .rpc('get_dashboard_stats', {
    // Parameters (snake_case in database)
    p_catalog_id: catalogId,
    p_limit: 10
  })

if (error) {
  console.error('RPC error:', error)
  return defaultValue
}

// Map database response to TypeScript
return (data || []).map((row: DBRow) => ({
  name: row.name,
  count: Number(row.count)  // bigint → number conversion
}))
```

### Common RPC Functions

```typescript
// Dashboard stats
items.get_dashboard_stats()
items.get_supplier_stats()
items.get_active_catalogs_with_counts()

// Search
search.search_products_with_filters(search_query, taxonomy_codes, ...)
search.get_dynamic_facets(search_query, ...)
search.count_products_with_filters(...)

// Analytics
analytics.get_most_active_users(p_limit)
analytics.track_page_view(p_user_id, p_page_url)
```

---

## Error Handling

### Standard Pattern

```typescript
try {
  const { data, error } = await supabaseServer
    .from('items.product_info')
    .select('*')
    .eq('product_id', id)
    .single()

  if (error) {
    console.error('Database error:', {
      message: error.message,
      code: error.code,
      details: error.details
    })
    return null  // or throw error, depending on context
  }

  return data
} catch (error) {
  console.error('Unexpected error:',
    error instanceof Error ? error.message : 'Unknown error'
  )
  return null
}
```

### HTTP Error Codes (API Routes)

```typescript
// 400 Bad Request
if (!productId || !uuidRegex.test(productId)) {
  return NextResponse.json(
    { error: 'Invalid product ID' },
    { status: 400 }
  )
}

// 404 Not Found
if (!data) {
  return NextResponse.json(
    { error: 'Product not found' },
    { status: 404 }
  )
}

// 500 Internal Server Error
if (error) {
  console.error('Database error:', error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
```

---

## Authentication Context

### Protected Server Actions

```typescript
'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabaseServer } from '@/lib/supabase-server'

export async function protectedAction() {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new Error('Unauthorized')
  }

  // Now safe to use supabaseServer with user context
  const { data } = await supabaseServer
    .from('items.product_info')
    .select('*')

  return data
}
```

### Protected API Routes

```typescript
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Proceed with authenticated request
}
```

---

## Materialized Views

### items.product_info (Primary Product View)

**ALWAYS use this view** for product queries, not the base `product` table.

```typescript
// ✅ CORRECT
const { data } = await supabaseServer
  .from('items.product_info')
  .select('*')

// ❌ WRONG (joins are expensive, data is incomplete)
const { data } = await supabaseServer
  .from('items.product')
  .select('*')
```

**Refresh:** Materialized views are refreshed daily after catalog imports.

**Columns available:**
- `product_id` (uuid)
- `foss_pid` (text) - Product identifier
- `description_short`, `description_long` (text)
- `supplier_name` (text)
- `manufacturer_pid` (text)
- `class` (text) - ETIM class code (e.g., EC001744)
- `family`, `subfamily` (text)
- `prices` (jsonb array)
- `multimedia` (jsonb array)
- `features` (jsonb array)
- `supplier_logo`, `supplier_logo_dark` (text URLs)

---

## Security Best Practices

### Input Validation

```typescript
// ✅ ALWAYS validate and sanitize
const sanitizedQuery = query.trim().slice(0, 100)

// ✅ Use parameterized queries (Supabase handles this)
.ilike('description_short', `%${sanitizedQuery}%`)

// ❌ NEVER concatenate SQL strings
// (Supabase client prevents this, but be aware)
```

### Row Level Security (RLS)

- **supabaseServer:** Bypasses RLS (service role)
- **supabase:** Respects RLS (anon role)

**Current setup:** Most tables have permissive RLS for authenticated users.

### Secrets Management

```typescript
// ✅ Server-side only
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// ✅ Client-side safe
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ❌ NEVER expose service role key to client
```

---

## Performance Optimization

### Database Queries

```typescript
// ✅ Select only needed columns
.select('product_id, description_short, supplier_name')

// ✅ Always limit results
.limit(50)

// ✅ Use indexes (already set up)
.eq('supplier_name', 'Delta Light')  // Indexed

// ✅ Use RPC for aggregations
.rpc('get_supplier_stats')  // Better than client-side grouping
```

### Caching Strategy

```typescript
// API routes: Revalidate every 60 seconds
export const revalidate = 60

export async function GET() {
  const data = await fetchData()
  return NextResponse.json({ data })
}
```

---

## TypeScript Patterns

### Database Response Types

```typescript
// Define database row type
interface ProductRow {
  product_id: string
  description_short: string
  prices: { amount: number; currency: string }[]
}

// Map to application type
const { data } = await supabaseServer
  .from('items.product_info')
  .select('product_id, description_short, prices')

const products: ProductInfo[] = (data || []).map((row: ProductRow) => ({
  id: row.product_id,
  name: row.description_short,
  pricing: row.prices.map(p => ({
    value: p.amount,
    currency: p.currency
  }))
}))
```

### Handling bigint

```typescript
// PostgreSQL bigint → JavaScript number
const count = Number(row.count)

// Handle potential overflow
const safeCount = BigInt(row.count) > Number.MAX_SAFE_INTEGER
  ? Number.MAX_SAFE_INTEGER
  : Number(row.count)
```

---

## Quick Reference

### Client Selection Flowchart

```
Is this a client component ('use client')?
├─ YES → Can you move this to a server action?
│        ├─ YES → Create server action with supabaseServer ✅
│        └─ NO  → Use supabase (anon key) ⚠️
│
└─ NO  → Use supabaseServer ✅
```

### Common Mistakes

| ❌ Wrong | ✅ Correct |
|---------|-----------|
| `import { supabase } from '@/lib/supabase'` in server action | `import { supabaseServer } from '@/lib/supabase-server'` |
| `.select('*')` for large tables | `.select('product_id, name, ...')` |
| No `.limit()` on queries | `.limit(50)` or `.limit(100)` |
| Using base `product` table | Use `product_info` materialized view |
| Forgetting schema prefix | `.from('items.product_info')` |

---

## See Also

- API patterns: [docs/architecture/api-patterns.md](../../docs/architecture/api-patterns.md)
- Database schema: [docs/database/schema.md](../../docs/database/schema.md)
- Security auditing: [docs/security/auditing.md](../../docs/security/auditing.md)
