# FOSSAPP Development Instructions for Claude Code

## 🚨 CRITICAL: Read Before Any Development

**Branch**: `claude/refactor-monorepo-fvct8`

**Required Reading** (in order):
1. `.claude/monorepo-development-guidelines.md` - Complete development guidelines
2. `COMPREHENSIVE_DUPLICATION_ANALYSIS.md` - 7 duplication patterns & solutions
3. `MONOREPO_MIGRATION_PLAN.md` - Migration strategy & package structure
4. `AUTODESK_VIEWER_MONOREPO_ANALYSIS.md` - Viewer reusability patterns

---

## 📋 Your Task Checklist

When asked to implement any feature, **follow these steps in order**:

### Step 1: Read the Context (5 minutes)

```bash
# Read these files FIRST:
1. .claude/monorepo-development-guidelines.md
2. COMPREHENSIVE_DUPLICATION_ANALYSIS.md
3. MONOREPO_MIGRATION_PLAN.md (if touching architecture)
```

**DO NOT skip this step.** These documents contain critical patterns you MUST follow.

### Step 2: Identify Applicable Patterns (2 minutes)

Ask yourself which patterns apply to your task:

- [ ] **Pattern #1 (Viewer)**: Am I creating/modifying a DWG viewer component?
- [ ] **Pattern #2 (API Routes)**: Am I creating a new API endpoint?
- [ ] **Pattern #3 (APS)**: Am I using Autodesk Platform Services?
- [ ] **Pattern #4 (Google Drive)**: Am I uploading/downloading from Google Drive?
- [ ] **Pattern #5 (CRUD)**: Am I adding search/list/getById operations?
- [ ] **Pattern #6 (Modal)**: Am I creating a modal/dialog component?
- [ ] **Pattern #7 (Loading)**: Am I fetching async data in a component?

### Step 3: Search for Existing Implementations (3 minutes)

**NEVER start from scratch.** Find similar code first:

```bash
# For viewer components:
grep -r "DwgViewer\|GuiViewer3D\|Viewer3D" src/components/

# For API routes:
ls src/app/api/**/route.ts

# For server actions:
ls src/lib/actions/*.ts

# For APS services:
grep -r "aps.*service\|APS.*Service" src/lib/

# For modals:
grep -r "Dialog.*Modal\|ViewerModal" src/components/
```

### Step 4: Apply the Patterns (Implementation)

**DO**:
- ✅ Compose from existing components
- ✅ Import from shared packages (if they exist)
- ✅ Follow the pattern examples in the guidelines
- ✅ Add TODOs for future refactoring
- ✅ Document your dependencies

**DON'T**:
- ❌ Copy-paste entire components
- ❌ Duplicate auth/error/loading logic
- ❌ Create new base classes/utilities if similar ones exist
- ❌ Reinvent modal/viewer/API patterns

### Step 5: Document for Future Refactoring

Add clear TODO comments:

```typescript
/**
 * TODO: Refactor with monorepo patterns once packages are extracted
 *
 * Applicable Patterns:
 * - Pattern #2: Use withRouteHandlers middleware for auth/rate-limiting
 * - Pattern #3: Import from @fossapp/aps/core for APS operations
 *
 * See:
 * - .claude/monorepo-development-guidelines.md
 * - COMPREHENSIVE_DUPLICATION_ANALYSIS.md
 */
```

---

## 🎯 Quick Pattern Reference

### API Route Pattern

```typescript
// TODO: Use withRouteHandlers middleware once implemented
export async function POST(request: NextRequest) {
  try {
    // Auth check (will be in middleware)
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (will be in middleware)
    const rateLimit = checkRateLimit(session.user.email, 'feature-name')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    // ONLY your domain logic here
    const result = await processYourFeature(payload)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

### Viewer Component Pattern

```typescript
// TODO: Replace with @fossapp/viewer components once extracted
import { DwgViewer } from '@/components/tiles/dwg-viewer' // Temporary
import { Dialog, DialogContent } from '@/components/ui/dialog'

export function YourViewerModal({ open, onOpenChange, urn }) {
  // TODO: Use ViewerModal wrapper
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh]">
        <DwgViewer
          urn={urn}
          tokenEndpoint="/api/your-feature/auth"
          theme="dark"
        />
      </DialogContent>
    </Dialog>
  )
}
```

### Server Action CRUD Pattern

```typescript
// TODO: Refactor with BaseRepository once implemented
export async function searchYourDomainAction(query: string) {
  try {
    const sanitized = validateSearchQuery(query)

    const { data, error } = await supabaseServer
      .schema('your_schema')
      .from('your_table')
      .select('*')
      .or(`field1.ilike.%${sanitized}%,field2.ilike.%${sanitized}%`)
      .limit(20)

    if (error) throw error
    return data
  } catch (error) {
    console.error('Search error:', error)
    throw error
  }
}
```

### Loading State Pattern

```typescript
// TODO: Replace with useAsync hook once created
const [loading, setLoading] = useState(true)
const [error, setError] = useState<Error | null>(null)
const [data, setData] = useState<YourData | null>(null)

useEffect(() => {
  let cancelled = false

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchYourData()
      if (!cancelled) setData(result)
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err : new Error('Unknown'))
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  fetchData()
  return () => { cancelled = true }
}, [dependencies])

if (loading) return <Loader2 className="h-8 w-8 animate-spin" />
if (error) return <div className="text-destructive">{error.message}</div>
return <YourComponent data={data} />
```

---

## 🚫 RED FLAGS - Stop If You See These

**STOP immediately if you find yourself doing any of these**:

1. ❌ Copying more than 20 lines of code from another file
2. ❌ Writing a third instance of similar logic (extract to shared utility)
3. ❌ Creating a new `AuthService` class
4. ❌ Implementing script loading for Autodesk Viewer
5. ❌ Writing new `getServerSession` + rate limit boilerplate
6. ❌ Creating new modal with body scroll lock logic
7. ❌ Writing manual useState/useEffect for async data

**If you encounter any of these**, go back to Step 3 and find the existing implementation.

---

## 📊 Current Status (Updated: 2025-12-26)

### Identified Duplication Patterns

| Pattern | Files | Lines | Status |
|---------|-------|-------|--------|
| API Route Boilerplate | 27 | ~905 | ⚠️ Not yet extracted |
| APS Services | 3 | ~1,425 | ⚠️ Not yet extracted |
| Autodesk Viewer | 5 | ~900 | ⚠️ Not yet extracted |
| Google Drive | 2 | ~380 | ⚠️ Not yet extracted |
| Server Actions CRUD | 11 | ~1,650 | ⚠️ Not yet extracted |
| Modal Wrappers | 17 | ~680 | ⚠️ Not yet extracted |
| Loading States | 30+ | ~900 | ⚠️ Not yet extracted |

### Migration Packages (Planned)

- [ ] `@fossapp/core` - Auth, DB, utils, middleware
- [ ] `@fossapp/ui` - Design system, modals, hooks
- [ ] `@fossapp/viewer` - Autodesk Viewer components
- [ ] `@fossapp/aps` - APS services
- [ ] `@fossapp/google-drive` - Google Drive services
- [ ] Domain packages (tiles, planner, products, etc.)

**Until migration is complete**: Follow the patterns but use existing code locations.

---

## 🎯 Example: Step-by-Step Feature Implementation

### Task: "Add a new endpoint to generate product reports"

**Step 1**: Read the guidelines ✅

**Step 2**: Identify patterns
- [x] Pattern #2 (API Routes) - YES, creating new endpoint
- [x] Pattern #5 (CRUD) - YES, fetching product data
- [ ] Pattern #7 (Loading) - Maybe, if client-side component needed

**Step 3**: Search existing code
```bash
# Find similar API routes
ls src/app/api/products/  # Found products/[id]/route.ts

# Find similar server actions
cat src/lib/actions/products.ts  # Found getProductByIdAction
```

**Step 4**: Implement following the pattern

```typescript
// src/app/api/products/report/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'
import { getProductByIdAction } from '@/lib/actions/products'

export const dynamic = 'force-dynamic'

/**
 * Generate product report endpoint
 *
 * TODO: Refactor with monorepo patterns
 * - Pattern #2: Use withRouteHandlers middleware
 * - Pattern #5: Use BaseRepository for product queries
 *
 * See: .claude/monorepo-development-guidelines.md
 */
export async function POST(request: NextRequest) {
  try {
    // Auth check (TODO: Move to middleware)
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (TODO: Move to middleware)
    const rateLimit = checkRateLimit(session.user.email, 'product-report')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const { productId } = await request.json()

    // Domain logic (THIS IS THE ONLY UNIQUE PART)
    const product = await getProductByIdAction(productId)
    const report = generateReport(product) // Your custom logic

    return NextResponse.json({ success: true, report })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function generateReport(product: Product) {
  // Your domain-specific report generation logic
  return {
    title: `Report for ${product.foss_pid}`,
    // ... report fields
  }
}
```

**Step 5**: Document ✅ (TODOs added above)

---

## 💬 Communication Template

When submitting your implementation, include:

```markdown
## Implementation Summary

**Feature**: [Brief description]

**Patterns Applied**:
- [x] Pattern #2: API Route (auth/rate-limiting boilerplate)
- [x] Pattern #5: Server Actions (used existing getProductByIdAction)
- [ ] Pattern #7: Loading States (not applicable - server-only)

**Existing Code Reused**:
- `getProductByIdAction` from `src/lib/actions/products.ts`
- Auth pattern from `src/app/api/products/[id]/route.ts`
- Error handling pattern (standard across all routes)

**New Code Added**:
- ~30 lines of domain-specific report generation logic
- ~45 lines of route boilerplate (TODO: extract to middleware)

**TODOs for Future Refactoring**:
- Refactor with `withRouteHandlers` middleware (Pattern #2)
- Consider extracting report generation to `@fossapp/reports` package

**References**:
- .claude/monorepo-development-guidelines.md - Patterns #2 and #5
- COMPREHENSIVE_DUPLICATION_ANALYSIS.md - API Route section
```

---

## 🎓 Final Reminder

**Every line of duplicated code is a future bug.**

The patterns in this document are not suggestions - they are **mandatory** for:
- Maintaining code quality
- Enabling team scalability
- Preventing technical debt
- Ensuring consistency

**When in doubt**:
1. Read the guidelines
2. Search for similar code
3. Compose, don't duplicate
4. Document your decisions

**The monorepo migration will happen soon. Following these patterns now makes that migration 10x easier.**

---

**Questions?** Reference:
- `.claude/monorepo-development-guidelines.md` for detailed explanations
- `COMPREHENSIVE_DUPLICATION_ANALYSIS.md` for pattern examples
- Branch: `claude/refactor-monorepo-fvct8` for all documentation
