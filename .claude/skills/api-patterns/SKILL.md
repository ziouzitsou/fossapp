---
name: api-patterns
description: Enforce consistent API route patterns including auth, rate limiting, validation, and error handling. Reduces boilerplate and prevents security issues.
---

# API Route Patterns for FOSSAPP

**Purpose:** Every API route in FOSSAPP follows a consistent structure. This skill ensures you include all required components and follow best practices.

---

## Standard API Route Template

Every API route must include these components in order:

```typescript
/**
 * API Endpoint: [Description]
 * POST /api/[domain]/[action]
 *
 * [What this endpoint does]
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'

// 1. CONFIGURATION
export const dynamic = 'force-dynamic'
export const maxDuration = 120  // Adjust based on operation type

// 2. HANDLER
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Step 2: Rate Limiting
    const rateLimit = checkRateLimit(session.user.email, 'endpoint-key')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    // Step 3: Request Validation
    const payload = await request.json()
    // ... validate payload

    // Step 4: Business Logic
    const result = await processRequest(payload)

    // Step 5: Success Response
    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    // Step 6: Error Handling
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
```

---

## Configuration Guidelines

### `export const dynamic`

**Always use:** `'force-dynamic'`

**Why:** API routes should not be cached - they process user data and state.

```typescript
// ✅ CORRECT
export const dynamic = 'force-dynamic'

// ❌ WRONG (will cause caching issues)
// No dynamic export
```

---

### `export const maxDuration`

Set based on operation type:

| Operation Type | Duration | Reason | Example |
|---------------|----------|--------|---------|
| **Database query** | 10 | Simple queries are fast | Search products |
| **File processing** | 30 | Small files process quickly | Image upload |
| **External API call** | 60 | Third-party APIs vary | Send email |
| **APS processing** | 120 | Design Automation takes time | DWG generation |
| **Streaming/SSE** | 300 | Long-polling connections | Progress updates |

```typescript
// ✅ Database query
export const maxDuration = 10

// ✅ File upload
export const maxDuration = 30

// ✅ APS Design Automation
export const maxDuration = 120
```

**Why this matters:** Vercel/deployment platforms enforce timeouts. Setting correct duration prevents premature termination.

---

## Authentication Pattern

**ALWAYS** check authentication first, before any other logic.

```typescript
const session = await getServerSession(authOptions)
if (!session?.user?.email) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Why this order:**
1. No point rate-limiting unauthenticated requests
2. Prevents wasting resources on invalid requests
3. Security best practice: fail fast

**User email is the identifier:**
- Used for rate limiting keys
- Used for logging/audit trails
- Used for associating actions with users

---

## Rate Limiting Strategy

### Rate Limit by Endpoint Cost

| Endpoint Cost | Limit | Reason | Examples |
|--------------|-------|--------|----------|
| **Cheap** | 60/min | User typing, searches | Product search, filters |
| **Normal** | 30/min | Standard operations | CRUD, uploads |
| **Expensive** | 5-10/min | Heavy compute/cost | APS, AI generation |
| **Very expensive** | 3/min | Extreme cost | Multi-step AI workflows |

```typescript
// Product search (cheap - user typing)
const rateLimit = checkRateLimit(session.user.email, 'products-search')
// Limit: 60/min

// Tile generation (expensive - APS + AI)
const rateLimit = checkRateLimit(session.user.email, 'tiles-generate')
// Limit: 5/min

// Feedback AI chat (expensive - Claude API)
const rateLimit = checkRateLimit(session.user.email, 'feedback-chat')
// Limit: 10/min
```

### Rate Limit Key Naming

**Pattern:** `[domain]-[action]`

```typescript
// ✅ GOOD
'products-search'
'tiles-generate'
'symbols-create'
'projects-update'
'feedback-chat'

// ❌ BAD (too vague)
'search'
'generate'
'api'
```

**Why:** Granular keys allow different limits per endpoint.

### Rate Limit Response

```typescript
const rateLimit = checkRateLimit(session.user.email, 'endpoint-key')
if (!rateLimit.success) {
  return NextResponse.json(
    {
      error: 'Rate limit exceeded. Max [N] requests per minute.',
      // Optional: include retry-after
    },
    {
      status: 429,
      headers: rateLimitHeaders(rateLimit)  // Includes X-RateLimit-* headers
    }
  )
}
```

**Headers included by `rateLimitHeaders()`:**
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - Timestamp when limit resets

---

## Request Validation

### Option 1: Zod Schema (Recommended)

```typescript
import { z } from 'zod'

const TilePayloadSchema = z.object({
  tile: z.string().min(1),
  members: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1),
  })).min(1).max(20),
})

// In handler
const payload = await request.json()
const validated = TilePayloadSchema.parse(payload)
// If validation fails, throws ZodError (caught by catch block)
```

**Benefits:**
- Type-safe (TypeScript infers type)
- Clear error messages
- Automatic validation

---

### Option 2: Manual Validation

```typescript
const payload = await request.json()

// Validate required fields
if (!payload.tile || typeof payload.tile !== 'string') {
  return NextResponse.json(
    { error: 'Invalid tile name' },
    { status: 400 }
  )
}

if (!Array.isArray(payload.members) || payload.members.length === 0) {
  return NextResponse.json(
    { error: 'At least one member required' },
    { status: 400 }
  )
}
```

**Use when:** Simple validation, avoiding zod dependency.

---

### Validation Checklist

- [ ] Required fields present
- [ ] Correct types (string, number, array)
- [ ] Valid ranges (min/max values)
- [ ] Valid formats (UUID, email, URL)
- [ ] Array length limits (prevent DoS)
- [ ] String length limits (prevent injection)

---

## Response Patterns

### Success Response (200)

```typescript
return NextResponse.json({
  success: true,
  // Data for client
  result: {
    id: '...',
    status: '...',
  },
  // Optional: metadata
  message: 'Operation completed successfully',
})
```

### Immediate Response with Background Job

For long-running operations (tiles, symbols, AI):

```typescript
// Create job and return ID immediately
const jobId = generateJobId()
createJob(jobId, payload)

// Start processing in background (DON'T AWAIT!)
processInBackground(jobId, payload)

return NextResponse.json({
  success: true,
  jobId,
  message: 'Processing started',
})
```

**Pattern:** Client polls `/api/[domain]/progress/[jobId]` or uses SSE.

---

### Error Responses

| Status | When | Example |
|--------|------|---------|
| **400** | Bad Request | Invalid input, missing fields |
| **401** | Unauthorized | No session, invalid token |
| **403** | Forbidden | User lacks permission |
| **404** | Not Found | Resource doesn't exist |
| **429** | Too Many Requests | Rate limit exceeded |
| **500** | Internal Error | Unexpected error, DB failure |

```typescript
// 400 Bad Request
return NextResponse.json(
  { error: 'Invalid product ID format' },
  { status: 400 }
)

// 401 Unauthorized
return NextResponse.json(
  { error: 'Unauthorized' },
  { status: 401 }
)

// 404 Not Found
return NextResponse.json(
  { error: 'Product not found' },
  { status: 404 }
)

// 500 Internal Error
return NextResponse.json(
  { error: error instanceof Error ? error.message : 'Unknown error' },
  { status: 500 }
)
```

---

## Error Handling Best Practices

### DO: Catch All Errors

```typescript
export async function POST(request: NextRequest) {
  try {
    // All logic here
  } catch (error) {
    // Catch everything
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

### DO: Log Errors with Context

```typescript
catch (error) {
  console.error('Tile generation error:', {
    user: session.user.email,
    tile: payload.tile,
    error: error instanceof Error ? error.message : error,
  })
  // Return error response
}
```

**Why:** Makes debugging production issues possible.

### DON'T: Expose Internal Details

```typescript
// ❌ BAD (exposes DB schema, credentials)
return NextResponse.json({
  error: error.message  // Could be: "Connection refused at db.internal:5432"
}, { status: 500 })

// ✅ GOOD (generic message)
return NextResponse.json({
  error: 'Failed to generate tile. Please try again.'
}, { status: 500 })
```

**Exception:** Development mode can be more verbose if needed.

---

## HTTP Method Conventions

| Method | Use Case | Example |
|--------|----------|---------|
| **GET** | Retrieve data, idempotent | Get product details |
| **POST** | Create resource, non-idempotent | Generate tile, send email |
| **PUT** | Update entire resource | Update project (all fields) |
| **PATCH** | Update partial resource | Update project status only |
| **DELETE** | Remove resource | Delete project |

```typescript
// GET - Retrieve data
export async function GET(request: NextRequest) {
  // No body, use query params
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
}

// POST - Create/process
export async function POST(request: NextRequest) {
  const payload = await request.json()
  // Create or process
}

// DELETE - Remove
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id
  // Delete resource
}
```

---

## Route Parameters vs Query Params

### Use Route Parameters (Preferred)
```
/api/products/[id]/route.ts
/api/projects/[projectId]/areas/[areaId]/route.ts
```

**When:** Resource identifier (ID)

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const productId = params.id
}
```

### Use Query Parameters
```
/api/products/search?q=led&supplier=delta
```

**When:** Filtering, searching, optional params

```typescript
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const supplier = searchParams.get('supplier')
}
```

---

## Streaming Responses (SSE)

For long-running operations with progress updates:

```typescript
import { createProgressStream } from '@/lib/progress'

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const jobId = params.jobId

  // Create SSE stream
  const stream = createProgressStream(jobId)

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
```

**Pattern used in:**
- `/api/tiles/progress/[jobId]`
- `/api/symbols/progress/[jobId]`
- `/api/playground/progress/[jobId]`

---

## Real Examples from FOSSAPP

### Example 1: Simple CRUD

```typescript
// /api/projects/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const project = await getProjectByIdAction(params.id)

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ project })
  } catch (error) {
    console.error('Get project error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve project' },
      { status: 500 }
    )
  }
}
```

---

### Example 2: Long-Running Operation

```typescript
// /api/tiles/generate/route.ts
export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = checkRateLimit(session.user.email, 'tiles-generate')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Max 5 tile generations per minute.' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const payload: TilePayload = await request.json()

    // Create job and return ID immediately
    const jobId = generateJobId()
    createJob(jobId, payload.tile)

    // Start background processing (don't await!)
    processInBackground(jobId, payload)

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Tile generation started',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

---

## Security Checklist

Before deploying any API route, verify:

- [ ] **Authentication check** (getServerSession)
- [ ] **Rate limiting** (appropriate limit for operation)
- [ ] **Input validation** (zod or manual checks)
- [ ] **Error handling** (try/catch with generic messages)
- [ ] **Logging** (errors logged with context, no sensitive data)
- [ ] **CORS** (if needed, use Next.js config)
- [ ] **maxDuration** set appropriately
- [ ] **dynamic = 'force-dynamic'**

---

## Common Mistakes

### ❌ Mistake 1: No Rate Limiting

```typescript
// ❌ Missing rate limit check
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  // ... process expensive operation
}
```

**Risk:** User can spam expensive operations, causing costs or DoS.

**Fix:** Add rate limiting appropriate to operation cost.

---

### ❌ Mistake 2: Wrong maxDuration

```typescript
// ❌ Too short for APS operation
export const maxDuration = 10

// APS takes 60-120 seconds → request times out!
```

**Fix:** Use 120 for APS operations.

---

### ❌ Mistake 3: Exposing Error Details

```typescript
// ❌ Exposes database connection string
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

**Fix:** Return generic message, log details server-side.

---

### ❌ Mistake 4: Awaiting Background Jobs

```typescript
// ❌ Blocks response until job completes (60+ seconds)
const result = await processExpensiveJob(payload)
return NextResponse.json({ result })
```

**Fix:** Return jobId immediately, process in background.

---

## Quick Decision Tree

**"Should I use GET or POST?"**
- Retrieving data only → GET
- Creating/modifying data → POST
- Deleting data → DELETE

**"What maxDuration should I use?"**
- Database query → 10
- File processing → 30
- External API → 60
- APS/heavy compute → 120
- Streaming → 300

**"What rate limit?"**
- Search/typing → 60/min
- Normal CRUD → 30/min
- Expensive operation → 5-10/min

**"Validate with zod or manually?"**
- Complex nested data → zod
- Simple 2-3 fields → manual
- Need type inference → zod

---

## Summary

Every API route follows this pattern:

1. **Configure:** `dynamic`, `maxDuration`
2. **Authenticate:** Check session
3. **Rate Limit:** Appropriate to operation cost
4. **Validate:** Input validation (zod or manual)
5. **Process:** Business logic
6. **Respond:** Success or error with proper status
7. **Handle Errors:** Catch all, log, generic messages

**Remember:** Consistency across API routes makes the codebase predictable and maintainable.

---

## Related Documentation

- **Monorepo packages:** `.claude/monorepo-development-guidelines.md`
- **Coding patterns:** `.claude/skills/coding-patterns/SKILL.md`
- **Rate limiting:** `packages/core/src/ratelimit/index.ts`
- **Auth setup:** `src/lib/auth.ts`

**Last updated:** 2025-12-31
