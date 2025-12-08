# API Patterns

FOSSAPP API architecture using Next.js App Router patterns and Supabase server actions.

## Overview

**Framework**: Next.js 16 App Router
**Database**: Supabase PostgreSQL
**Pattern**: Server Actions (preferred) + REST API routes (fallback)
**Authentication**: NextAuth.js session-based

## Server Actions (Preferred)

Server actions provide type-safe, direct database access from client components.

### Location

All server actions defined in: `src/lib/actions.ts`

### Pattern

```typescript
'use server'

import { supabaseServer } from '@/lib/supabase-server'

export async function searchProductsAction(query: string) {
  // Input validation
  if (!query || query.trim().length === 0) {
    throw new Error('Query required')
  }

  // Sanitize input
  const sanitizedQuery = query.trim().slice(0, 100)

  // Query database
  const { data, error } = await supabaseServer
    .from('items.product_info')
    .select('*')
    .ilike('description_short', `%${sanitizedQuery}%`)
    .limit(50)

  if (error) throw error
  return data
}
```

### Usage in Client Components

```typescript
'use client'

import { searchProductsAction } from '@/lib/actions'

export function ProductSearch() {
  const handleSearch = async (query: string) => {
    try {
      const results = await searchProductsAction(query)
      setResults(results)
    } catch (error) {
      console.error('Search failed:', error)
    }
  }

  return <SearchInput onSearch={handleSearch} />
}
```

### Benefits

- ✅ Type-safe (TypeScript end-to-end)
- ✅ No API route needed
- ✅ Direct database access
- ✅ Server-side validation
- ✅ Better performance (less overhead)

## REST API Routes (Fallback)

API routes for external integrations, webhooks, or fallback scenarios.

### Location

All API routes in: `src/app/api/`

### Pattern

```typescript
// src/app/api/products/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { searchProductsAction } from '@/lib/actions'

export async function GET(request: NextRequest) {
  // Extract query parameters
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  // Validate input
  if (!query) {
    return NextResponse.json(
      { error: 'Query parameter required' },
      { status: 400 }
    )
  }

  // Delegate to server action
  try {
    const results = await searchProductsAction(query)
    return NextResponse.json({ data: results })
  } catch (error) {
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
```

### HTTP Methods

```typescript
// GET request
export async function GET(request: NextRequest) { }

// POST request
export async function POST(request: NextRequest) { }

// PUT request
export async function PUT(request: NextRequest) { }

// DELETE request
export async function DELETE(request: NextRequest) { }

// PATCH request
export async function PATCH(request: NextRequest) { }
```

### Dynamic Routes

```typescript
// src/app/api/products/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id

  // Validate UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(productId)) {
    return NextResponse.json(
      { error: 'Invalid product ID' },
      { status: 400 }
    )
  }

  const { data, error } = await supabaseServer
    .from('items.product_info')
    .select('*')
    .eq('product_id', productId)
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Product not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ data })
}
```

## Available Endpoints

### Product Search

**Endpoint**: `GET /api/products/search?q=<term>`

**Response**:
```json
{
  "data": [
    {
      "product_id": "uuid",
      "foss_pid": "DELTA-123456",
      "description_short": "Product name",
      "description_long": "Full description",
      "supplier_name": "Delta Light",
      "prices": [...],
      "multimedia": [...],
      "features": [...]
    }
  ]
}
```

**Limits**: Maximum 50 results

### Product Detail

**Endpoint**: `GET /api/products/[id]`

**Response**:
```json
{
  "data": {
    "product_id": "uuid",
    "foss_pid": "DELTA-123456",
    ...
  }
}
```

### Health Check

**Endpoint**: `GET /api/health`

**Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T09:51:00.000Z",
  "version": "1.3.5",
  "uptime": 199,
  "environment": "production"
}
```

**Used by**: Docker healthcheck

## Input Validation

### Validation Rules

```typescript
// 1. Required field check
if (!query) {
  throw new Error('Query required')
}

// 2. Trim whitespace
const trimmed = query.trim()

// 3. Length limits
if (trimmed.length > 100) {
  throw new Error('Query too long')
}

// 4. Regex validation (for UUIDs, etc.)
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!uuidRegex.test(id)) {
  throw new Error('Invalid UUID')
}

// 5. Sanitize special characters
const sanitized = query.replace(/[^\w\s-]/g, '')
```

### Security Considerations

**Always**:
- ✅ Validate all inputs (regex, trim, length)
- ✅ Use parameterized queries (Supabase client)
- ✅ Limit result sets (`.limit(50)`)
- ✅ Sanitize user input before database queries
- ✅ Return generic error messages (don't expose internals)

**Never**:
- ❌ Trust user input directly
- ❌ Concatenate SQL strings manually
- ❌ Return raw database errors to client
- ❌ Expose service role key to client
- ❌ Skip input validation

## Error Handling

### Pattern

```typescript
try {
  const { data, error } = await supabaseServer
    .from('items.product_info')
    .select('*')
    .eq('product_id', id)
    .single()

  if (error) throw error
  return data

} catch (error) {
  console.error('Database error:', error)

  // Graceful fallback
  return null  // or empty array, default value
}
```

### HTTP Error Responses

```typescript
// 400 Bad Request - Invalid input
return NextResponse.json(
  { error: 'Invalid query parameter' },
  { status: 400 }
)

// 404 Not Found - Resource doesn't exist
return NextResponse.json(
  { error: 'Product not found' },
  { status: 404 }
)

// 500 Internal Server Error - Unexpected error
return NextResponse.json(
  { error: 'Internal server error' },
  { status: 500 }
)

// 401 Unauthorized - Authentication required
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
)
```

## Supabase Client Pattern

### Server-Side (Actions & API Routes)

```typescript
import { supabaseServer } from '@/lib/supabase-server'

export async function serverAction() {
  const { data, error } = await supabaseServer
    .from('items.product_info')
    .select('*')

  return data
}
```

**Uses**: `SUPABASE_SERVICE_ROLE_KEY` (full admin access)

### Client-Side (Components)

```typescript
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

**Uses**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (limited permissions)

**⚠️ CRITICAL**: Never mix these up! See [CLAUDE.md](../CLAUDE.md#dual-supabase-client-pattern) for details.

## Authentication

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

### Protected Server Actions

```typescript
'use server'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function protectedAction() {
  const session = await getServerSession(authOptions)

  if (!session) {
    throw new Error('Unauthorized')
  }

  // Proceed with action
}
```

## Rate Limiting

Currently not implemented. Future enhancement options:

- Upstash Rate Limit (Redis-based)
- Next.js middleware-based
- Supabase RLS policies with request counting

## CORS

### Configuration

```typescript
// next.config.ts
export default {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ]
  },
}
```

**Current**: Not configured (same-origin only)

## Performance Optimization

### Caching Strategy

```typescript
// Revalidate every 60 seconds
export const revalidate = 60

export async function GET() {
  const data = await fetchData()
  return NextResponse.json({ data })
}
```

### Database Query Optimization

```typescript
// ✅ GOOD: Specific columns
const { data } = await supabaseServer
  .from('items.product_info')
  .select('product_id, description_short, prices')
  .limit(50)

// ❌ BAD: SELECT *
const { data } = await supabaseServer
  .from('items.product_info')
  .select('*')
```

### Limit Result Sets

```typescript
// Always limit results
.limit(50)     // Search results
.limit(100)    // List views
.single()      // Single record
```

## Testing

### Manual Testing

```bash
# Health check
curl http://localhost:8080/api/health

# Search products
curl "http://localhost:8080/api/products/search?q=downlight"

# Get product by ID
curl http://localhost:8080/api/products/<uuid>
```

### Production Testing

```bash
curl https://main.fossapp.online/api/health
curl "https://main.fossapp.online/api/products/search?q=downlight"
```

## Code Organization

### Keep API Routes Thin

```typescript
// ❌ BAD: Business logic in API route
export async function GET(request: NextRequest) {
  const { data } = await supabaseServer.from('...').select('...')
  const processed = data.map(...)
  const filtered = processed.filter(...)
  return NextResponse.json({ data: filtered })
}

// ✅ GOOD: Delegate to server action
export async function GET(request: NextRequest) {
  const results = await searchProductsAction(query)
  return NextResponse.json({ data: results })
}
```

### Business Logic in Actions

- Database queries → `src/lib/actions.ts`
- Validation logic → `src/lib/actions.ts`
- Data processing → `src/lib/actions.ts`
- API routes → Thin wrappers only

## See Also

- Database patterns: [CLAUDE.md](../CLAUDE.md#dual-supabase-client-pattern)
- Security: [SECURITY_AUDITING.md](./SECURITY_AUDITING.md)
- Deployment: [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)
