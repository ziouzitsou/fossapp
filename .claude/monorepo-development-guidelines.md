# FOSSAPP Monorepo Development Guidelines

## 🎯 Context & Purpose

This document provides comprehensive guidelines for developing FOSSAPP using monorepo architecture patterns and shared component abstractions.

**IMPORTANT**: These guidelines are mandatory for all future development. They represent a shift from duplication-heavy development to composition-based, DRY (Don't Repeat Yourself) architecture.

---

## 📚 Required Reading

Before starting any development, review these analysis documents:

1. **`MONOREPO_MIGRATION_PLAN.md`** - Complete migration strategy with package structure
2. **`COMPREHENSIVE_DUPLICATION_ANALYSIS.md`** - 7 major duplication patterns and solutions
3. **`AUTODESK_VIEWER_MONOREPO_ANALYSIS.md`** - Viewer reusability patterns
4. **`MONOREPO_UNIFIED_GENERATOR_BENEFITS.md`** - Component composition examples

**Branch**: `claude/refactor-monorepo-fvct8`

**Key Findings Summary**:
- ✅ 95+ files with duplicated code
- ✅ ~6,840 lines of duplication identified
- ✅ 66% reduction potential (~4,450 lines can be eliminated)
- ✅ 7 major patterns: API routes, APS services, Viewer, Google Drive, CRUD, Modals, Loading states

---

## 🏗️ Architectural Principles

### 1. **Composition Over Duplication**

**NEVER copy-paste code**. Instead:
- Extract to shared package
- Create configurable base components
- Use dependency injection
- Compose from primitives

**Example**:
```typescript
// ❌ WRONG: Copy entire component
function NewFeatureViewer() {
  // 300 lines copied from dwg-viewer.tsx
}

// ✅ CORRECT: Compose from shared package
import { DwgViewer } from '@fossapp/viewer/components/dwg-viewer'

function NewFeatureViewer({ urn }) {
  return <DwgViewer urn={urn} tokenEndpoint="/api/new-feature/auth" />
}
```

### 2. **Single Source of Truth**

Every piece of logic should exist in exactly **one place**:
- Auth logic → `@fossapp/core/auth`
- DB queries → `@fossapp/core/db` or domain repositories
- Viewer logic → `@fossapp/viewer`
- APS operations → `@fossapp/aps`
- Google Drive → `@fossapp/google-drive`

### 3. **Explicit Package Boundaries**

Use `package.json` exports to define public APIs:

```json
{
  "name": "@fossapp/viewer",
  "exports": {
    "./components/dwg-viewer": "./src/components/dwg-viewer.tsx",
    "./core/script-loader": "./src/core/script-loader.ts"
    // Everything else is PRIVATE
  }
}
```

### 4. **Type Safety Across Packages**

Shared types must live in shared packages:

```typescript
// ❌ WRONG: Duplicate type definitions
// packages/tiles/src/types.ts
interface TranslationStatus { ... }

// packages/playground/src/types.ts
interface TranslationStatus { ... } // WILL DRIFT!

// ✅ CORRECT: Single source of truth
// packages/viewer/src/core/types.ts
export interface TranslationStatus { ... }

// Usage
import type { TranslationStatus } from '@fossapp/viewer/core/types'
```

---

## 📐 Module Splitting Strategy (MANDATORY)

**Large files MUST be split** into focused, single-responsibility modules. This is a core architectural principle, not optional.

### When to Split

| Trigger | Action |
|---------|--------|
| File > 500 lines | Consider splitting |
| File > 800 lines | **MUST split** |
| Multiple distinct responsibilities | Split by domain |
| Repeated patterns across file | Extract shared utilities |

### Splitting Patterns

#### Pattern A: Server Actions (Domain-Based)

For large action files, create a subdirectory with focused modules:

```
src/lib/actions/
├── project-areas.ts          # Backward-compat re-export (17 lines)
└── areas/                    # New focused modules
    ├── index.ts              # Barrel export (NO 'use server')
    ├── area-crud-actions.ts  # CRUD ops (has 'use server')
    ├── version-actions.ts    # Version management
    ├── floorplan-actions.ts  # Floorplan ops
    └── version-products-actions.ts
```

**Key Rules**:
- Each action file has `'use server'` at the top
- Barrel exports (`index.ts`) must NOT have `'use server'`
- Original file becomes a re-export for backward compatibility

#### Pattern B: Page Components (Co-located)

For large page files, create a `components/` directory alongside:

```
src/app/projects/[id]/
├── page.tsx                  # Main page (reduced to ~500 lines)
└── components/               # Co-located components
    ├── index.ts              # Barrel export
    ├── project-overview-tab.tsx
    ├── project-products-tab.tsx
    └── utils.tsx             # Shared utilities
```

**Key Rules**:
- Components directory is co-located with `page.tsx`
- Each component is focused on one tab/section
- Shared utilities live in `utils.tsx`
- Use barrel exports for clean imports

#### Pattern C: Complex Components

For large React components, extract sub-components and hooks:

```
src/components/planner/
├── planner-viewer.tsx        # Main component (reduced)
├── viewer-toolbar.tsx        # Extracted toolbar
├── viewer-overlays.tsx       # Loading/error overlays
└── hooks/
    └── use-viewer-state.ts   # Complex state logic
```

### Barrel Export Pattern

Always use `index.ts` for clean imports:

```typescript
// src/app/projects/[id]/components/index.ts
export { ProjectOverviewTab } from './project-overview-tab'
export { ProjectProductsTab } from './project-products-tab'
export { formatDate, formatCurrency, getStatusBadge } from './utils'
export type { ProductTotals } from './utils'
```

Usage:
```typescript
// Clean import from barrel
import {
  ProjectOverviewTab,
  ProjectProductsTab,
  formatDate
} from './components'
```

### Backward Compatibility

When splitting existing files, maintain backward compatibility via re-exports:

```typescript
// src/lib/actions/project-areas.ts (original location)
// Re-export everything from new location for backward compatibility
export * from './areas'
```

**DO NOT** add `'use server'` to re-export files - only actual action files.

### Recent Examples (v1.13.0)

| Original File | Lines | Result |
|---------------|-------|--------|
| `project-areas.ts` | 1,117 | 5 modules in `areas/` |
| `projects.ts` | 954 | 4 modules in `projects/` |
| `planner-viewer.tsx` | 974 | 850 + 2 extracted components |
| `projects/[id]/page.tsx` | 914 | 479 + 3 component files |

**Total reduction**: ~50% in main files, with cleaner separation of concerns.

---

## 🔧 Development Patterns

### Pattern #1: API Routes (Use Middleware)

**Rule**: NEVER duplicate auth/rate-limiting/error handling in API routes.

**Current Problem**: All 27 API routes duplicate 60 lines of boilerplate.

**Solution**: Use `withRouteHandlers` middleware (once implemented).

```typescript
// ❌ WRONG: Manual boilerplate (60 lines)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = checkRateLimit(session.user.email, 'my-endpoint')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    // ... actual logic
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// ✅ CORRECT: Use middleware (15 lines)
import { withRouteHandlers } from '@/lib/api/middleware'

export const POST = withRouteHandlers(
  async ({ session, request }) => {
    const payload = await request.json()

    // ... actual logic (only what's unique!)

    return NextResponse.json({ success: true })
  },
  {
    rateLimitKey: 'my-endpoint',
    rateLimitMax: 10,
  }
)
```

**When to use**: Every new API route.

**Current Status**: Pattern identified, middleware not yet implemented.

**Action**: When creating API routes before middleware exists, add a TODO comment:
```typescript
// TODO: Refactor to use withRouteHandlers middleware once implemented
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #2
```

---

### Pattern #2: Autodesk Viewer (Reuse Components)

**Rule**: NEVER create new viewer from scratch. Compose from `@fossapp/viewer`.

**Current Problem**: 5 viewer implementations duplicate script loading, translation polling, modal wrappers.

**Solution**: Import from shared viewer package (once extracted).

```typescript
// ❌ WRONG: New viewer component (300+ lines)
export function MyFeatureViewer() {
  const [scriptsLoaded, setScriptsLoaded] = useState(false)

  useEffect(() => {
    // 75 lines of script loading logic (DUPLICATED!)
  }, [])

  // 200+ more lines...
}

// ✅ CORRECT: Compose from shared viewer
import { DwgViewer } from '@fossapp/viewer/components/dwg-viewer'
import { ViewerModal } from '@fossapp/viewer/components/viewer-modal'

export function MyFeatureViewerModal({ open, urn }) {
  return (
    <ViewerModal
      open={open}
      title="My Feature Viewer"
    >
      <DwgViewer
        urn={urn}
        tokenEndpoint="/api/my-feature/auth"
        statusEndpoint={(urn) => `/api/my-feature/status/${urn}`}
      />
    </ViewerModal>
  )
}
```

**When to use**: Any feature that needs to display DWG/3D models.

**Current Status**: Pattern identified, package not yet extracted.

**Action**: Before package extraction, document viewer requirements:
```typescript
// TODO: Replace with @fossapp/viewer/components/dwg-viewer once extracted
// Requirements:
// - Token endpoint: /api/my-feature/auth
// - Status endpoint: /api/my-feature/status/:urn
// - Theme: dark
// See: AUTODESK_VIEWER_MONOREPO_ANALYSIS.md
```

---

### Pattern #3: APS Services (Shared Core)

**Rule**: NEVER duplicate APS auth/bucket/upload logic.

**Current Problem**: 3 APS services duplicate 1,425 lines.

**Solution**: Import from `@fossapp/aps/core` (once extracted).

```typescript
// ❌ WRONG: Duplicate APS auth class (80 lines)
class MyAPSAuthService {
  private tokenCache: string | null = null
  // ... 80 lines of duplicated auth logic
}

// ✅ CORRECT: Import from shared package
import { APSAuthService, APSBucketService } from '@fossapp/aps/core'

class MyDomainAPSService {
  private auth = new APSAuthService()
  private bucket = new APSBucketService(this.auth)

  async processMyDomain(data: MyData) {
    const bucketKey = await this.bucket.createTempBucket('mydomain')
    // ... domain-specific logic only
  }
}
```

**When to use**: Any feature using Autodesk Platform Services.

**Current Status**: Pattern identified, package not yet extracted.

**Action**: Add TODO and avoid duplication:
```typescript
// TODO: Replace with @fossapp/aps/core services once extracted
// Current duplication: Auth (80 lines), Bucket ops (150 lines)
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #3
```

---

### Pattern #4: Server Actions (Repository Pattern)

**Rule**: Use `BaseRepository` for CRUD operations. Never duplicate search/list/getById.

**Current Problem**: All 11 server action files repeat CRUD patterns (1,650 lines).

**Solution**: Extend `BaseRepository<T>` (once implemented).

```typescript
// ❌ WRONG: Duplicate CRUD in every action file (150 lines)
export async function searchProductsAction(query: string) {
  try {
    const sanitized = validateSearchQuery(query)
    const { data, error } = await supabaseServer
      .schema('items')
      .from('product_info')
      .select('*')
      .or(`foss_pid.ilike.%${sanitized}%`)
      .limit(20)
    if (error) throw error
    return data
  } catch (error) {
    console.error('Search error:', error)
    throw error
  }
}

export async function getProductByIdAction(id: string) {
  // ... another 30 lines of similar code
}

// ✅ CORRECT: Use BaseRepository pattern
import { BaseRepository } from '@/lib/db/base-repository'

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super('items', 'product_info')
  }

  async search(query: string) {
    return super.search(query, ['foss_pid', 'description_short'])
  }
}

const productRepo = new ProductRepository()

export async function searchProductsAction(query: string) {
  return productRepo.search(query)
}
```

**When to use**: Any new domain with CRUD operations.

**Current Status**: Pattern identified, BaseRepository not yet implemented.

**Action**: Follow consistent pattern, add TODO:
```typescript
// TODO: Refactor to use BaseRepository once implemented
// Current duplication: search (30 lines), list (30 lines), getById (20 lines)
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #5
```

---

### Pattern #5: Modals/Dialogs (Shared Wrapper)

**Rule**: Use `BaseModal` wrapper. Never duplicate scroll lock, sizing, handlers.

**Current Problem**: 17 modals duplicate ~40 lines each (680 lines total).

**Solution**: Use generic modal wrapper (once created).

```typescript
// ❌ WRONG: Duplicate modal boilerplate (40 lines)
export function MyModal({ open, onOpenChange, children }) {
  // Body scroll lock (DUPLICATED!)
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[95vw] w-[95vw] h-[90vh] p-0 gap-0"
        onPointerDownOutside={(e) => {
          e.preventDefault()
          onOpenChange(false)
        }}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

// ✅ CORRECT: Use shared BaseModal
import { BaseModal } from '@/components/shared/base-modal'

export function MyModal({ open, onOpenChange, children }) {
  return (
    <BaseModal
      open={open}
      onOpenChange={onOpenChange}
      title="My Feature"
    >
      {children}
    </BaseModal>
  )
}
```

**When to use**: Any new modal/dialog component.

**Current Status**: Pattern identified, BaseModal not yet created.

**Action**: Follow consistent pattern, add TODO:
```typescript
// TODO: Replace with BaseModal once created
// Duplicated: body scroll lock, sizing, pointer handlers
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #6
```

---

### Pattern #6: Loading States (useAsync Hook)

**Rule**: Use `useAsync` hook. Never duplicate loading/error/data state management.

**Current Problem**: 30+ components duplicate useState/useEffect patterns (900 lines).

**Solution**: Use `useAsync` hook (once created).

```typescript
// ❌ WRONG: Manual loading state (30 lines)
const [isLoading, setIsLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
const [data, setData] = useState<Product[]>([])

useEffect(() => {
  const fetchData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const result = await searchProducts(query)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }
  fetchData()
}, [query])

if (isLoading) return <Loader />
if (error) return <Error message={error} />
return <ProductList products={data} />

// ✅ CORRECT: Use useAsync hook
import { useAsync } from '@/hooks/use-async'

const { loading, error, data } = useAsync(
  () => searchProducts(query),
  [query]
)

if (loading) return <Loader />
if (error) return <Error message={error.message} />
return <ProductList products={data} />
```

**When to use**: Any component that fetches async data.

**Current Status**: Pattern identified, useAsync not yet created.

**Action**: Follow consistent pattern, add TODO:
```typescript
// TODO: Replace with useAsync hook once created
// Duplicated: loading/error/data state, try/catch, cleanup
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #7
```

---

### Pattern #7: Google Drive Operations

**Rule**: Import from `@fossapp/google-drive/core`. Never duplicate auth/folder/upload logic.

**Current Problem**: 2 services duplicate 380 lines.

**Solution**: Use shared Google Drive package (once extracted).

```typescript
// ❌ WRONG: Duplicate Google Drive auth (60 lines)
constructor() {
  const credentialsPath = path.join(process.cwd(), 'credentials', 'google-service-account.json')
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
  const auth = new google.auth.GoogleAuth({ credentials, scopes: [...] })
  this.drive = google.drive({ version: 'v3', auth })
}

// ✅ CORRECT: Import from shared package
import { GoogleDriveAuthService, GoogleDriveFolderService } from '@fossapp/google-drive/core'

class MyDomainDriveService {
  private auth = new GoogleDriveAuthService()
  private folders = new GoogleDriveFolderService(this.auth.getDrive())

  async createMyDomainFolder(name: string) {
    return this.folders.createFolder(name, parentId)
  }
}
```

**When to use**: Any feature using Google Drive.

**Current Status**: Pattern identified, package not yet extracted.

---

## 📋 Step-by-Step Instructions for New Features

### When Adding a New Feature:

#### Step 1: Review Existing Patterns

Before writing any code:

1. Read `COMPREHENSIVE_DUPLICATION_ANALYSIS.md`
2. Identify which patterns apply to your feature
3. Check if shared packages exist for those patterns

#### Step 2: Check for Existing Components

Search for similar functionality:

```bash
# Search for similar components
grep -r "ModalComponent\|ViewerComponent\|useAsync" src/

# Search for similar API routes
ls src/app/api/**/route.ts

# Search for similar server actions
ls src/lib/actions/*.ts
```

#### Step 3: Compose from Shared Packages

**DO**:
- ✅ Import from `@fossapp/*` packages (once extracted)
- ✅ Use middleware, base classes, hooks
- ✅ Configure with props/parameters
- ✅ Add only domain-specific logic

**DON'T**:
- ❌ Copy-paste from existing files
- ❌ Duplicate auth/error handling
- ❌ Create new base components
- ❌ Reinvent modal/loading patterns

#### Step 4: Document Dependencies

Add clear comments for future refactoring:

```typescript
/**
 * MyFeature API Route
 *
 * TODO: Refactor with monorepo patterns
 * - Use withRouteHandlers middleware (Pattern #2)
 * - Import from @fossapp/aps/core (Pattern #3)
 * - Use BaseRepository for CRUD (Pattern #5)
 *
 * See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md
 */
```

#### Step 5: Follow DRY Principle

**If you write the same code twice, extract it.**

Example:
```typescript
// First usage
const result1 = await processData(data1)

// Second usage (STOP! Extract function)
const result2 = await processData(data2)

// ✅ Extract to shared utility
async function processDataUtil(data: Data) {
  // shared logic
}
```

---

## 🎯 Specific Instructions for Common Tasks

### Task: Add New API Endpoint

1. **Check**: Is there middleware for auth/rate-limiting?
   - **Yes**: Use `withRouteHandlers`
   - **No**: Follow existing pattern + add TODO

2. **Structure**:
```typescript
// src/app/api/my-feature/my-action/route.ts

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// TODO: Use withRouteHandlers once implemented
export async function POST(request: NextRequest) {
  try {
    // Auth check (will be in middleware)
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limiting (will be in middleware)
    const rateLimit = checkRateLimit(session.user.email, 'my-feature-action')
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    const payload = await request.json()

    // ONLY domain-specific logic here
    const result = await processMyFeature(payload)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
```

---

### Task: Add New Viewer Component

1. **Check**: Is `@fossapp/viewer` package extracted?
   - **Yes**: Import `DwgViewer` and `ViewerModal`
   - **No**: Copy from most similar viewer + add TODO

2. **Structure**:
```typescript
// TODO: Replace with @fossapp/viewer components once extracted
// See: AUTODESK_VIEWER_MONOREPO_ANALYSIS.md

import { DwgViewer } from '@/components/tiles/dwg-viewer' // Temporary
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'

export function MyFeatureViewerModal({ open, onOpenChange, urn }) {
  // TODO: Use ViewerModal wrapper once created
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[90vh]">
        <DialogHeader>My Feature Viewer</DialogHeader>
        <DwgViewer
          urn={urn}
          tokenEndpoint="/api/my-feature/auth"
          theme="dark"
        />
      </DialogContent>
    </Dialog>
  )
}
```

---

### Task: Add New CRUD Domain

1. **Check**: Is `BaseRepository` implemented?
   - **Yes**: Extend `BaseRepository<T>`
   - **No**: Follow consistent pattern + add TODO

2. **Structure**:
```typescript
// src/lib/actions/my-domain.ts

'use server'

import { supabaseServer } from '../supabase-server'
import { validateSearchQuery, validateId } from './validation'
import { PAGINATION } from '@/lib/constants'

// TODO: Refactor with BaseRepository once implemented
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #5

export interface MyDomain {
  id: string
  name: string
  // ... fields
}

export async function searchMyDomainAction(query: string): Promise<MyDomain[]> {
  try {
    const sanitized = validateSearchQuery(query)

    const { data, error } = await supabaseServer
      .schema('my_schema')
      .from('my_table')
      .select('*')
      .or(`name.ilike.%${sanitized}%,code.ilike.%${sanitized}%`)
      .limit(20)

    if (error) throw error
    return data
  } catch (error) {
    console.error('MyDomain search error:', error)
    throw error
  }
}

export async function getMyDomainByIdAction(id: string): Promise<MyDomain | null> {
  try {
    const validId = validateId(id)

    const { data, error } = await supabaseServer
      .schema('my_schema')
      .from('my_table')
      .select('*')
      .eq('id', validId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('MyDomain getById error:', error)
    throw error
  }
}

// ... list, create, update, delete (all following same pattern)
```

---

### Task: Add Component with Async Data

1. **Check**: Is `useAsync` hook created?
   - **Yes**: Use `useAsync`
   - **No**: Follow consistent pattern + add TODO

2. **Structure**:
```typescript
// TODO: Replace with useAsync hook once created
// See: COMPREHENSIVE_DUPLICATION_ANALYSIS.md, Pattern #7

const [loading, setLoading] = useState(true)
const [error, setError] = useState<Error | null>(null)
const [data, setData] = useState<MyData | null>(null)

useEffect(() => {
  let cancelled = false

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetchMyData()
      if (!cancelled) setData(result)
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err : new Error('Unknown error'))
    } finally {
      if (!cancelled) setLoading(false)
    }
  }

  fetchData()

  return () => {
    cancelled = true
  }
}, [dependencies])

if (loading) return <Loader2 className="h-8 w-8 animate-spin" />
if (error) return <div className="text-destructive">{error.message}</div>
return <MyComponent data={data} />
```

---

## 🚫 Anti-Patterns (NEVER DO THIS)

### ❌ Anti-Pattern #1: Copy-Paste Components

```typescript
// ❌ WRONG
// Copied from playground-viewer-modal.tsx
export function MyViewerModal() {
  // 145 lines of duplicated code
}
```

**Why it's wrong**: Creates maintenance nightmare. Bug fixes need to be applied to N copies.

**What to do instead**: Import from shared package or create shared component.

---

### ❌ Anti-Pattern #2: Duplicate Type Definitions

```typescript
// ❌ WRONG
// In file A
interface TranslationStatus {
  status: 'pending' | 'inprogress' | 'success' | 'failed'
}

// In file B
interface TranslationStatus { // WILL DRIFT OVER TIME!
  status: 'pending' | 'inprogress' | 'success' | 'failed'
}
```

**Why it's wrong**: Types will drift, causing bugs.

**What to do instead**: Define once in shared package, import everywhere.

---

### ❌ Anti-Pattern #3: Manual Auth in Every Route

```typescript
// ❌ WRONG
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // ... repeated in 27 routes!
}
```

**Why it's wrong**: 27 places to update when auth logic changes.

**What to do instead**: Use middleware (or add TODO).

---

### ❌ Anti-Pattern #4: Reinventing Base Classes

```typescript
// ❌ WRONG
class MyDomainRepository {
  async search(query: string) {
    // 30 lines of generic search logic (DUPLICATED!)
  }

  async getById(id: string) {
    // 20 lines of generic getById logic (DUPLICATED!)
  }
}
```

**Why it's wrong**: Same logic repeated across 11 domains.

**What to do instead**: Extend `BaseRepository` (or add TODO).

---

## ✅ Code Review Checklist

Before submitting any PR, verify:

- [ ] **No duplicated code**: Did I copy-paste from another file?
- [ ] **Used shared packages**: Did I import from `@fossapp/*` where available?
- [ ] **Added TODOs**: If shared package doesn't exist, did I document it?
- [ ] **Followed patterns**: Did I follow the 7 patterns in COMPREHENSIVE_DUPLICATION_ANALYSIS.md?
- [ ] **Single responsibility**: Does each function/component do one thing?
- [ ] **Type safety**: Are all types imported from shared packages?
- [ ] **DRY principle**: Did I extract repeated logic?

---

## 📊 Migration Status Tracking

### Currently Implemented Patterns

- [ ] API Route Middleware (`withRouteHandlers`)
- [ ] Base Repository Pattern (`BaseRepository<T>`)
- [ ] Viewer Package (`@fossapp/viewer`)
- [ ] APS Core Package (`@fossapp/aps`)
- [ ] Google Drive Package (`@fossapp/google-drive`)
- [ ] Base Modal Component (`BaseModal`)
- [ ] Async Hook (`useAsync`)

**Last Updated**: 2025-12-26

**Note**: Until patterns are implemented, follow existing code style but add TODO comments referencing this document and the analysis files.

---

## 🎓 Learning Resources

### Internal Documentation

1. **`MONOREPO_MIGRATION_PLAN.md`**
   - Complete 6-week migration strategy
   - Package structure design
   - Docker and deployment updates

2. **`COMPREHENSIVE_DUPLICATION_ANALYSIS.md`**
   - 7 major duplication patterns
   - Before/after code examples
   - ROI analysis and timeline

3. **`AUTODESK_VIEWER_MONOREPO_ANALYSIS.md`**
   - Viewer component reusability
   - Script loading, polling, modal patterns
   - Shared package design

4. **`MONOREPO_UNIFIED_GENERATOR_BENEFITS.md`**
   - How to merge similar features
   - Composition examples
   - Unified vs standalone pages

### Key Concepts

- **Monorepo**: Single repository with multiple packages
- **Workspace**: npm/pnpm feature for linking local packages
- **Composition**: Building components from smaller pieces
- **DRY**: Don't Repeat Yourself
- **Single Source of Truth**: One canonical place for each piece of logic

---

## 🚀 Getting Started

### For Existing Developers

1. **Read the PR**: Review branch `claude/refactor-monorepo-fvct8`
2. **Read analysis docs**: All 4 markdown files in project root
3. **Understand patterns**: Review the 7 patterns above
4. **Apply to new code**: Use patterns immediately, even before monorepo migration
5. **Add TODOs**: Document future refactoring opportunities

### For New Features

1. **Before writing code**: Check if similar feature exists
2. **Identify patterns**: Which of the 7 patterns apply?
3. **Check shared packages**: Are they implemented yet?
4. **Compose, don't duplicate**: Import from shared packages
5. **Document**: Add TODOs for future refactoring

### For Bug Fixes

1. **Find all instances**: Search for duplicated code
2. **Fix in all places**: Until we have shared packages
3. **Add TODO**: Note that this should be deduplicated
4. **Consider extracting**: If you fix the same bug in 3+ places, extract to shared utility

---

## 📞 Questions?

If you're unsure about any of these patterns:

1. **Check the docs**: Read the 4 analysis markdown files
2. **Search existing code**: Find similar implementations
3. **Ask in PR**: Reference this document and the analysis
4. **When in doubt**: Favor composition over duplication

---

## 🎯 Success Metrics

We'll know this approach is working when:

- ✅ New features take 50-90% less code
- ✅ Bugs only need fixing in one place
- ✅ Tests are reusable across domains
- ✅ Type safety prevents drift
- ✅ Onboarding is faster (clear patterns)
- ✅ Code reviews are easier (consistent structure)

---

**Remember**: These patterns aren't optional. They're the foundation for sustainable, scalable development. Every line of duplicated code is a future bug waiting to happen.

**The best time to follow these patterns was during the initial development. The second best time is now.**
