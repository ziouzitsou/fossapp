# FOSSAPP Architecture Guide

**Last Updated**: 2025-12-28

This document defines coding patterns and architectural decisions for FOSSAPP. Follow these guidelines for all new features.

> **Note for Claude Code:** This content is also available as a skill (`.claude/skills/coding-patterns/`) which Claude automatically uses when writing code. This document serves as comprehensive human reference.

---

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Server Actions (Domain Organization)](#server-actions-domain-organization)
3. [Database Functions](#database-functions)
4. [Type Definitions](#type-definitions)
5. [Constants & Configuration](#constants--configuration)
6. [Validation Patterns](#validation-patterns)
7. [Error Handling](#error-handling)
8. [Naming Conventions](#naming-conventions)

---

## Directory Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── api/                  # REST API routes (thin, delegate to actions)
│   ├── dashboard/
│   ├── products/
│   └── ...
│
├── components/
│   ├── ui/                   # shadcn/ui primitives
│   ├── filters/              # Domain: filter components
│   ├── products/             # Domain: product components
│   └── ...
│
├── lib/
│   ├── actions/              # Server actions (domain-organized)
│   │   ├── index.ts          # Unified exports
│   │   ├── validation.ts     # Shared validation
│   │   ├── dashboard.ts      # Dashboard domain
│   │   ├── customers.ts      # Customers domain
│   │   ├── products.ts       # Products domain (TODO)
│   │   ├── projects.ts       # Projects domain (TODO)
│   │   └── taxonomy.ts       # Taxonomy domain (TODO)
│   │
│   ├── constants.ts          # Centralized configuration
│   ├── supabase.ts           # Client-side Supabase (anon key)
│   ├── supabase-server.ts    # Server-side Supabase (service role)
│   └── ...
│
├── types/
│   ├── product.ts            # Product-related types
│   ├── search.ts             # Search/filter types
│   └── ...
│
└── ...
```

---

## Server Actions (Domain Organization)

### Structure

Organize server actions by business domain, not by operation type:

```
src/lib/actions/
├── index.ts          # Re-exports all actions (backward compatible)
├── validation.ts     # Shared validation utilities
├── dashboard.ts      # Stats, analytics, aggregations
├── customers.ts      # Customer CRUD
├── products.ts       # Product search, details
├── projects.ts       # Project management
├── suppliers.ts      # Supplier operations
└── taxonomy.ts       # Category tree operations
```

### Pattern for Domain Files

```typescript
// src/lib/actions/[domain].ts
'use server'

import { supabaseServer } from '../supabase-server'
import { validateXxx } from './validation'
import { PAGINATION } from '@/lib/constants'

// ============================================================================
// INTERFACES
// ============================================================================

export interface DomainItem {
  id: string
  name: string
  // ...
}

export interface DomainListParams {
  page?: number
  pageSize?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface DomainListResult {
  items: DomainItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ============================================================================
// SEARCH
// ============================================================================

export async function searchDomainAction(query: string): Promise<DomainItem[]> {
  try {
    const sanitizedQuery = validateSearchQuery(query)

    const { data, error } = await supabaseServer
      .schema('schema_name')
      .from('table_name')
      .select('...')
      .ilike('name', `%${sanitizedQuery}%`)
      .limit(PAGINATION.DEFAULT_SEARCH_LIMIT)

    if (error) {
      console.error('Domain search error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Search domain error:', error)
    return []
  }
}

// ============================================================================
// GET BY ID
// ============================================================================

export async function getDomainByIdAction(id: string): Promise<DomainItem | null> {
  // ...
}

// ============================================================================
// LIST WITH PAGINATION
// ============================================================================

export async function listDomainAction(params: DomainListParams = {}): Promise<DomainListResult> {
  // ...
}
```

### Importing Actions

```typescript
// Preferred: Import from domain file directly
import { searchCustomersAction } from '@/lib/actions/customers'

// Also valid: Import from index (backward compatible)
import { searchCustomersAction } from '@/lib/actions'

// Legacy: Import from original file (will be deprecated)
import { searchCustomersAction } from '@/lib/actions.ts'
```

---

## Database Functions

### When to Use Database Functions

Use PostgreSQL functions (RPC) when:

1. **Aggregation needed** - COUNT, SUM, GROUP BY operations
2. **Multiple related queries** - Batch into single call
3. **Complex joins** - Let PostgreSQL optimize
4. **Performance critical** - Avoid transferring large datasets

### Pattern

```sql
-- Migration: supabase/migrations/YYYYMMDD_add_domain_functions.sql

CREATE OR REPLACE FUNCTION schema.function_name(
  p_param1 text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  column1 text,
  column2 bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    column1,
    COUNT(*) as column2
  FROM schema.table_name
  WHERE (p_param1 IS NULL OR column1 = p_param1)
  GROUP BY column1
  ORDER BY column2 DESC
  LIMIT p_limit
$$;

-- Always grant permissions
GRANT EXECUTE ON FUNCTION schema.function_name(text, integer)
  TO authenticated, service_role;

-- Add documentation
COMMENT ON FUNCTION schema.function_name(text, integer)
  IS 'Description of what this function does';
```

### Calling from TypeScript

```typescript
const { data, error } = await supabaseServer
  .schema('schema_name')
  .rpc('function_name', {
    p_param1: value,
    p_limit: 10
  })

if (error) {
  console.error('RPC error:', error)
  return defaultValue
}

// Map to TypeScript interface
return (data || []).map((item: DBResponseType) => ({
  field1: item.column1,
  field2: Number(item.column2)  // bigint → number
}))
```

### Schema Organization

```
items.*        → Product/catalog functions
analytics.*    → User tracking, metrics
search.*       → Search/filter functions
customers.*    → Customer functions (future)
projects.*     → Project functions (future)
```

---

## Type Definitions

### Location

```
src/types/
├── product.ts    # ProductInfo, ProductSearchResult, Feature, etc.
├── search.ts     # SearchFilters, FilterDefinition, Facets, etc.
├── customer.ts   # CustomerDetail, CustomerSearchResult (future)
└── index.ts      # Re-exports (optional)
```

### Pattern

```typescript
// src/types/domain.ts

/**
 * Lightweight type for list/search results
 */
export interface DomainSearchResult {
  id: string
  name: string
  // Minimal fields for listing
}

/**
 * Full type for detail views
 */
export interface DomainDetail extends DomainSearchResult {
  description: string
  created_at: string
  // All fields
}

/**
 * Params for list operations
 */
export interface DomainListParams {
  page?: number
  pageSize?: number
  sortBy?: 'name' | 'created_at'
  sortOrder?: 'asc' | 'desc'
}
```

### Re-exporting for Backward Compatibility

```typescript
// In action file, if type was previously defined there:
import type { ProductSearchResult } from '@/types/product'
export type { ProductSearchResult } from '@/types/product'
```

---

## Constants & Configuration

### Location

All magic numbers and configuration values go in `src/lib/constants.ts`:

```typescript
// src/lib/constants.ts

export const VALIDATION = {
  SEARCH_QUERY_MAX_LENGTH: 100,
  UUID_REGEX: /^[0-9a-f]{8}-...-[0-9a-f]{12}$/i,
} as const

export const PAGINATION = {
  DEFAULT_SEARCH_LIMIT: 50,
  DEFAULT_PAGE_SIZE: 20,
  MAX_BATCH_SIZE: 1000,
} as const

export const DASHBOARD = {
  TOP_FAMILIES_LIMIT: 10,
  ACTIVE_USERS_LIMIT: 5,
} as const

export const CACHE = {
  DASHBOARD_STATS_TTL: 300,  // 5 minutes
} as const
```

### Usage

```typescript
import { PAGINATION, VALIDATION } from '@/lib/constants'

// Instead of magic number:
.limit(50)

// Use constant:
.limit(PAGINATION.DEFAULT_SEARCH_LIMIT)
```

---

## Validation Patterns

### Centralized Validation

```typescript
// src/lib/actions/validation.ts
'use server'

import { VALIDATION } from '@/lib/constants'

export function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid search query')
  }

  const sanitized = query.trim().slice(0, VALIDATION.SEARCH_QUERY_MAX_LENGTH)
  if (sanitized.length === 0) {
    throw new Error('Search query cannot be empty')
  }

  return sanitized
}

export function validateUUID(id: string, fieldName: string): string {
  if (!id || !VALIDATION.UUID_REGEX.test(id)) {
    throw new Error(`Invalid ${fieldName} format`)
  }
  return id
}
```

### Usage in Actions

```typescript
import { validateSearchQuery, validateUUID } from './validation'

export async function getProductByIdAction(productId: string) {
  const sanitizedId = validateUUID(productId, 'product ID')
  // ...
}
```

---

## Error Handling

### Standard Pattern

```typescript
export async function someAction(): Promise<ResultType> {
  try {
    const { data, error } = await supabaseServer.from('table').select('*')

    if (error) {
      // Log with context, no sensitive data
      console.error('Action name error:', {
        message: error.message,
        code: error.code
      })
      return defaultValue  // Empty array, null, or error object
    }

    return data || defaultValue
  } catch (error) {
    // Catch unexpected errors
    console.error('Action name exception:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return defaultValue
  }
}
```

### Return Patterns

| Scenario | Return Value |
|----------|--------------|
| List/Search failed | `[]` (empty array) |
| Get by ID failed | `null` |
| Stats failed | Object with zero values |
| Paginated list failed | Full result object with empty items |

---

## Naming Conventions

### Actions

```
[verb][Domain]Action
searchProductsAction
getCustomerByIdAction
listProjectsAction
getDashboardStatsAction
```

### Database Functions

```
schema.verb_noun_with_params
items.get_dashboard_stats
items.get_supplier_stats
search.search_products_with_filters
analytics.get_most_active_users
```

### Types

```
[Domain][Purpose]
ProductSearchResult    # For search/list results
ProductDetail          # For full detail view
CustomerListParams     # For list operation params
CustomerListResult     # For paginated list response
```

### Files

```
Domain files:     lowercase, singular (customers.ts, not customer.ts)
Type files:       lowercase, singular (product.ts)
Component files:  PascalCase (FilterPanel.tsx)
```

---

## Adding New Features Checklist

1. **Types first**: Define interfaces in `src/types/[domain].ts`
2. **Database functions**: If aggregation needed, create migration
3. **Validation**: Add validators to `src/lib/actions/validation.ts`
4. **Action file**: Create `src/lib/actions/[domain].ts`
5. **Export**: Add to `src/lib/actions/index.ts`
6. **Constants**: Add any magic numbers to `src/lib/constants.ts`
7. **Tests**: Manual testing via dev server (automated tests TODO)

---

## Migration from Legacy Code

When moving code from `src/lib/actions.ts` to domain files:

1. Copy function and interfaces to domain file
2. Update imports to use validation and constants
3. Add export to `src/lib/actions/index.ts`
4. Remove from original `actions.ts`
5. Test all callers still work
6. Commit with clear message

---

## URL-Based State Management

**Policy (as of 2025-12)**: All client-side navigation state (tabs, filters, views, selections) MUST be stored in URL query parameters.

### Why URL State

- **Browser navigation works**: Back/forward buttons restore previous state
- **Shareable links**: Users can share exact view with colleagues
- **Refresh-safe**: Page reload preserves state
- **No side effects**: Doesn't break other functionality

### Pattern

```typescript
'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function PageWithState() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Read state from URL (with default)
  const activeTab = searchParams.get('tab') || 'overview'

  // Update URL when state changes
  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'overview') {
      params.delete('tab')  // Clean URL for default value
    } else {
      params.set('tab', value)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      {/* ... */}
    </Tabs>
  )
}
```

### Guidelines

| State Type | URL Param | Example |
|------------|-----------|---------|
| Active tab | `?tab=products` | `/projects/123?tab=products` |
| Selected item | `?area=abc123` | `/planner?area=abc123` |
| Filters | `?category=LED&status=active` | `/products?category=LED` |
| View mode | `?view=grid` | `/products?view=grid` |
| Search query | `?q=spotlight` | `/products?q=spotlight` |

### Best Practices

1. **Clean URLs for defaults**: Delete param when value equals default
2. **Use `router.replace()`**: Avoids polluting history with every state change
3. **Add `{ scroll: false }`**: Prevents page jumping
4. **Validate URL params**: Use allowlist for valid values
5. **Controlled components**: Use `value`/`onValueChange` not `defaultValue`

### Implemented Pages

- `/projects/[id]` - `?tab=` for tab selection
- `/planner` - `?area=` for selected area/DWG

---

## URL-Based Routing for Sub-Pages

**Policy (as of 2025-12)**: When a page has multiple tabs or sections, use URL paths (not client-side tabs) for proper browser navigation.

### Pattern: Layout + Sub-Pages

```
src/app/settings/
├── layout.tsx          # Shared layout with tab navigation
├── page.tsx            # Redirects to default sub-page
├── user/
│   └── page.tsx        # User settings content
└── symbols/
    └── page.tsx        # Symbols settings content
```

### Layout Component

```typescript
// src/app/settings/layout.tsx
'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@fossapp/ui'

const tabs = [
  { name: 'User', href: '/settings/user' },
  { name: 'Symbols', href: '/settings/symbols' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <ProtectedPageLayout>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold">Settings</h1>

          {/* Tab Navigation */}
          <div className="inline-flex h-9 items-center rounded-lg bg-muted p-1 mb-6">
            {tabs.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'rounded-md px-3 py-1 text-sm font-medium',
                  pathname === tab.href
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-background/50'
                )}
              >
                {tab.name}
              </Link>
            ))}
          </div>

          {children}
        </div>
      </div>
    </ProtectedPageLayout>
  )
}
```

### Redirect for Base Path

```typescript
// src/app/settings/page.tsx
import { redirect } from 'next/navigation'

export default function SettingsPage() {
  redirect('/settings/user')
}
```

### Why URL Paths vs Query Params

| Approach | Use Case | Example |
|----------|----------|---------|
| **URL Paths** | Distinct sections with different content | `/settings/user`, `/settings/symbols` |
| **Query Params** | State within same content structure | `/projects/123?tab=products` |

**URL Paths Benefits:**
- Each section can have its own loading states
- Code splitting per section (smaller bundles)
- Clear URL structure for users
- Better for SEO (if applicable)

### Implemented Pages

- `/settings/user`, `/settings/symbols` - Settings sub-pages

---

## Reference

- **CLAUDE.md**: Quick reference for development
- **API_PATTERNS.md**: API route patterns
- **COMPONENT_ARCHITECTURE.md**: UI component patterns
- **ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md**: Filter system details
