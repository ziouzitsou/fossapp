# Advanced Product Search UI/UX Implementation Guide

**Created**: 2025-11-22
**Status**: In Development
**Backend Architecture**: [ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md](../ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md)
**Working Demo**: http://localhost:3001 (search-test-app)

---

## Overview

This document outlines the frontend implementation strategy for the advanced product search feature in FOSSAPP. The backend (database schema, RPC functions, materialized views) is **already complete** and production-ready.

### Key Features

- **Three-Tier Search**: Guided Finder (boolean) → Smart Text Search → Technical Filters (ranges)
- **Delta Light-Style UX**: Context-aware filter counts prevent "0 results" dead ends
- **Performance**: Sub-200ms queries on 14,889+ products
- **User-Friendly**: Human taxonomy ("Ceiling → Recessed") instead of ETIM codes

---

## Architecture Summary

### Backend (Complete ✅)

**Database Schema** (`search` schema):
- `search.taxonomy` - 30-node category tree
- `search.classification_rules` - ETIM → human taxonomy mapping
- `search.filter_definitions` - 8 active filters (IP, CCT, voltage, CRI, etc.)
- 3 materialized views (product_taxonomy_flags, product_filter_index, filter_facets)

**RPC Functions** (7 total):
1. `search_products_with_filters()` - Main search with pagination
2. `count_products_with_filters()` - Result count
3. `get_dynamic_facets()` - Context-aware filter options (🔑 KEY FEATURE)
4. `get_filter_facets_with_context()` - Boolean flag counts
5. `get_taxonomy_tree()` - Category hierarchy
6. `get_filter_definitions_with_type()` - Filter metadata
7. `get_search_statistics()` - System stats

**Server Actions** (to be created):
- `searchProductsAction()` - src/lib/search-actions.ts
- `countProductsAction()`
- `getDynamicFacetsAction()`
- `getTaxonomyTreeAction()`

### Frontend (To Build 🚧)

**Location**: `src/app/products/page.tsx` (existing file to enhance)

**Component Strategy**: shadcn/ui components for consistency

---

## UI/UX Layout Design

### Desktop Layout (3-column)

```
┌─────────────────────────────────────────────────────────────────┐
│ Header (existing navbar)                                        │
├────────────────┬────────────────────────────────────────────────┤
│ Left Sidebar   │ Active Filters: [Indoor ×] [IP65 ×] [Clear]   │
│ (280px wide)   ├────────────────────────────────────────────────┤
│                │ Text Search: [________________] [🔍 Search]    │
│ 📁 Categories  ├────────────────────────────────────────────────┤
│ (Accordion)    │ Showing 23 of 14,889 products                  │
│                │                                                 │
│ ☑️ Guided      │ ┌─────────────────────────────────────────┐  │
│ Finder         │ │ [Product Card 1]                        │  │
│ (Checkboxes)   │ │ Delta Light DL-123 • IP65 • 3000K      │  │
│                │ │ €45.99                                  │  │
│ 🔧 Technical   │ └─────────────────────────────────────────┘  │
│ Filters        │                                                 │
│ (Collapsible)  │ [Product Card 2]                               │
│                │ [Product Card 3]                               │
│                │ ...                                             │
│                │                                                 │
│                │ [Pagination]                                   │
└────────────────┴────────────────────────────────────────────────┘
```

### Mobile Layout

- Floating filter button (bottom-right FAB)
- Sheet/Drawer slides from left with all filters
- Results take full width
- Active filters visible at top

---

## Component Breakdown

### 1. Category Navigation (Taxonomy Tree)

**Component**: `Accordion` + custom tree structure

**Code Pattern**:
```tsx
<Accordion type="multiple" className="w-full">
  <AccordionItem value="luminaires">
    <AccordionTrigger>
      <Lightbulb className="mr-2" />
      Luminaires <Badge variant="secondary">13,336</Badge>
    </AccordionTrigger>
    <AccordionContent>
      <div className="pl-4 space-y-1">
        <button className="flex items-center w-full py-2 hover:bg-accent rounded">
          <ArrowDown className="mr-2 h-4 w-4" />
          Ceiling <Badge variant="outline">7,361</Badge>
        </button>
        <div className="pl-6">
          <Checkbox>Recessed <Badge>3,456</Badge></Checkbox>
          <Checkbox>Surface-mounted <Badge>2,789</Badge></Checkbox>
        </div>
      </div>
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

**Features**:
- Hierarchical expansion (4 levels deep)
- Product counts next to each category
- Icons for visual scanning
- Multi-select support

---

### 2. Guided Finder (Boolean Flags)

**Component**: `Checkbox` with **three-state logic**

**CRITICAL Pattern**: Indeterminate state = "don't care" (NULL in database)

**Code Pattern**:
```tsx
<div className="space-y-3">
  <h3 className="font-semibold text-sm">Environment</h3>
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <Checkbox
          id="indoor"
          checked={filters.indoor}
          onCheckedChange={(checked) =>
            setFilters(prev => ({
              ...prev,
              indoor: checked === 'indeterminate' ? null : checked
            }))
          }
        />
        <label htmlFor="indoor" className="ml-2 text-sm">Indoor</label>
      </div>
      <Badge variant="secondary">{facetCounts.indoor || 0}</Badge>
    </div>

    <div className="flex items-center justify-between">
      <Checkbox id="outdoor" ... />
      <Badge variant="secondary">{facetCounts.outdoor || 0}</Badge>
    </div>
  </div>

  <Separator className="my-4" />

  <h3 className="font-semibold text-sm">Mounting</h3>
  <Checkbox>Ceiling <Badge>7,361</Badge></Checkbox>
  <Checkbox>Wall <Badge>2,456</Badge></Checkbox>
  <Checkbox>Floor <Badge>891</Badge></Checkbox>
</div>
```

**Key Features**:
- ✅ Delta Light-style counts (update in real-time)
- ✅ Visual grouping (Environment/Mounting/Installation)
- ✅ Counts always visible (no "0 results" surprises)
- ✅ Three-state logic (checked/unchecked/don't care)

---

### 3. Technical Filters (Advanced)

**Multi-Select Filters** (IP Rating, Voltage):

```tsx
<Collapsible>
  <CollapsibleTrigger>
    <ChevronDown className="mr-2" />
    Advanced Filters
  </CollapsibleTrigger>
  <CollapsibleContent className="space-y-4">
    <div>
      <Label className="text-sm font-semibold">IP Rating</Label>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {ipOptions.map(option => (
          <div key={option.value} className="flex items-center justify-between">
            <Checkbox
              checked={filters.ip?.includes(option.value)}
              onCheckedChange={(checked) => handleMultiSelect('ip', option.value, checked)}
            >
              {option.value}
            </Checkbox>
            <Badge variant="outline">{option.count}</Badge>
          </div>
        ))}
      </div>
    </div>
  </CollapsibleContent>
</Collapsible>
```

**Range Filters** (CCT, CRI, Lumens):

```tsx
<div className="space-y-2">
  <div className="flex justify-between">
    <Label>Color Temperature (K)</Label>
    <span className="text-sm text-muted-foreground">
      {cctRange[0]} - {cctRange[1]}K
    </span>
  </div>

  <Slider
    min={2700}
    max={6500}
    step={100}
    value={cctRange}
    onValueChange={setCctRange}
    className="w-full"
  />

  {/* Preset chips */}
  <div className="flex gap-2 mt-2">
    <Badge
      variant="outline"
      className="cursor-pointer hover:bg-primary/10"
      onClick={() => setCctRange([2700, 3000])}
    >
      Warm (3000K)
    </Badge>
    <Badge variant="outline" onClick={() => setCctRange([3900, 4100])}>
      Neutral (4000K)
    </Badge>
    <Badge variant="outline" onClick={() => setCctRange([6000, 6500])}>
      Cool (6500K)
    </Badge>
  </div>
</div>
```

---

### 4. Active Filters Display

**Component**: `Badge` chips with remove buttons

```tsx
<div className="flex items-center gap-2 flex-wrap mb-4">
  <span className="text-sm font-medium">Active filters:</span>

  {filters.indoor && (
    <Badge variant="default" className="gap-1">
      Indoor
      <X className="h-3 w-3 cursor-pointer" onClick={() => removeFilter('indoor')} />
    </Badge>
  )}

  {filters.ip?.map(value => (
    <Badge key={value} variant="default" className="gap-1">
      {value}
      <X className="h-3 w-3 cursor-pointer" onClick={() => removeIpValue(value)} />
    </Badge>
  ))}

  {filters.cct && (
    <Badge variant="default" className="gap-1">
      CCT: {filters.cct.min}-{filters.cct.max}K
      <X className="h-3 w-3 cursor-pointer" onClick={() => removeCct()} />
    </Badge>
  )}

  {hasActiveFilters && (
    <Button variant="ghost" size="sm" onClick={clearAllFilters}>
      Clear all
    </Button>
  )}
</div>
```

---

### 5. Result Count & Sorting

```tsx
<div className="flex items-center justify-between mb-4">
  <div className="text-sm text-muted-foreground">
    Showing <span className="font-semibold">{results.length}</span> of{' '}
    <span className="font-semibold">{totalCount.toLocaleString()}</span> products
  </div>

  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger className="w-[180px]">
      <SelectValue placeholder="Sort by" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="relevance">Relevance</SelectItem>
      <SelectItem value="price_asc">Price: Low to High</SelectItem>
      <SelectItem value="price_desc">Price: High to Low</SelectItem>
    </SelectContent>
  </Select>
</div>
```

---

### 6. Loading States

**CRITICAL**: Don't disable filters during search!

```tsx
{isLoading && (
  <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
    <div className="flex items-center gap-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">Updating results...</span>
    </div>
  </div>
)}
```

---

## Data Flow & State Management

### State Structure

```tsx
const [filters, setFilters] = useState<SearchFilters>({
  query: '',
  categories: [],
  indoor: null,  // Three-state: true/false/null
  outdoor: null,
  ceiling: null,
  wall: null,
  floor: null,
  recessed: null,
  surface_mounted: null,
  suspended: null,
  dimmable: null,
  technicalFilters: {
    ip: [],
    voltage: [],
    cct: null,
    cri: null,
    luminous_flux: null
  },
  sortBy: 'relevance',
  page: 0,
  limit: 50
})

const [results, setResults] = useState<SearchProduct[]>([])
const [totalCount, setTotalCount] = useState(0)
const [facets, setFacets] = useState<Facet[]>([])
const [isLoading, setIsLoading] = useState(false)
```

### Debounced Search Pattern

```tsx
useEffect(() => {
  const timer = setTimeout(async () => {
    setIsLoading(true)

    // Parallel calls for performance
    const [products, count, dynamicFacets] = await Promise.all([
      searchProductsAction(filters),
      countProductsAction(filters),
      getDynamicFacetsAction(filters)  // 🔑 Context-aware counts!
    ])

    setResults(products)
    setTotalCount(count)
    setFacets(dynamicFacets)
    setIsLoading(false)
  }, 300)  // 300ms debounce

  return () => clearTimeout(timer)
}, [filters])
```

### Facet Count Updates

**CRITICAL**: Update filter counts based on current context

```tsx
// Group facets by filter_key for easy lookup
const facetsByKey = useMemo(() => {
  return facets?.reduce((acc, facet) => {
    if (!acc[facet.filter_key]) acc[facet.filter_key] = []
    acc[facet.filter_key].push({
      value: facet.filter_value,
      count: facet.product_count
    })
    return acc
  }, {} as Record<string, Array<{ value: string; count: number }>>)
}, [facets])

// Render checkbox with dynamic count
<Checkbox>
  IP65 <Badge>{facetsByKey.ip?.find(f => f.value === 'IP65')?.count || 0}</Badge>
</Checkbox>
```

---

## TypeScript Types

**Location**: `src/types/search.ts` (new file)

```typescript
// Search filters
export interface SearchFilters {
  query?: string
  categories?: string[]  // Taxonomy codes
  suppliers?: string[]

  // Boolean flags (three-state: true/false/null)
  indoor?: boolean | null
  outdoor?: boolean | null
  ceiling?: boolean | null
  wall?: boolean | null
  floor?: boolean | null
  recessed?: boolean | null
  surface_mounted?: boolean | null
  suspended?: boolean | null
  dimmable?: boolean | null

  // Technical filters
  technicalFilters?: TechnicalFilters

  // Pagination and sorting
  sortBy?: 'relevance' | 'price_asc' | 'price_desc'
  page?: number
  limit?: number
}

// Technical filters (JSONB format for RPC)
export interface TechnicalFilters {
  voltage?: string[]            // Multi-select
  ip?: string[]                 // Multi-select
  dimmable?: boolean            // Boolean
  cct?: { min: number, max: number }  // Range
  cri?: { min: number, max: number }
  luminous_flux?: { min: number, max: number }
  protection_class?: string[]
  finishing_colour?: string[]
}

// Search result (from RPC)
export interface SearchProduct {
  product_id: string
  foss_pid: string
  description_short: string
  description_long: string
  supplier_name: string
  class_name: string
  price: number
  image_url: string
  taxonomy_path: string[]
  flags: Record<string, boolean>
  key_features: Record<string, any>
  relevance_score: number
}

// Dynamic facet (from get_dynamic_facets)
export interface Facet {
  filter_category: string  // 'electricals' | 'design' | 'light_engine'
  filter_key: string       // 'ip', 'cct', 'voltage'
  filter_value: string     // 'IP65', '3000', '12V'
  product_count: number    // Count in CURRENT context
}

// Taxonomy node
export interface TaxonomyNode {
  code: string
  parent_code: string | null
  level: number
  name: string
  icon: string | null
  product_count: number
  children?: TaxonomyNode[]
}
```

---

## shadcn/ui Components Needed

### Already Installed ✅
- Card
- Input
- Button
- Badge
- Alert
- Avatar

### To Install 🆕

**Required**:
```bash
npx shadcn@latest add accordion
npx shadcn@latest add checkbox
npx shadcn@latest add slider
npx shadcn@latest add sheet         # Mobile filter drawer
npx shadcn@latest add separator
npx shadcn@latest add label
npx shadcn@latest add scroll-area   # Long filter lists
npx shadcn@latest add collapsible   # Advanced filters
npx shadcn@latest add select        # Sort dropdown
```

**Optional** (for enhanced UX):
```bash
npx shadcn@latest add command       # Searchable category picker
npx shadcn@latest add tabs          # Alternative to accordion
npx shadcn@latest add tooltip       # Filter help text
npx shadcn@latest add skeleton      # Loading placeholders
```

---

## Implementation Phases

### Phase 1: Basic Search & Navigation (Week 1)

**Tasks**:
1. Install required shadcn components
2. Create TypeScript types (`src/types/search.ts`)
3. Create server actions (`src/lib/search-actions.ts`)
4. Build category tree navigation (Accordion)
5. Wire up text search with debounce
6. Display results in existing Card layout
7. Add result count display

**Files to Create**:
- `src/types/search.ts`
- `src/lib/search-actions.ts`

**Files to Modify**:
- `src/app/products/page.tsx`

**Success Criteria**:
- User can browse category tree
- Text search returns results
- Results display with counts
- No filters yet (comes in Phase 2)

---

### Phase 2: Guided Finder (Week 2)

**Tasks**:
1. Add boolean flag checkboxes (Indoor/Outdoor/Ceiling/Wall/Floor)
2. Implement three-state checkbox logic
3. Wire up `getDynamicFacetsAction()` for context-aware counts
4. Build active filters display (Badge chips with ×)
5. Add "Clear all filters" button
6. Real-time count updates as filters change

**Files to Modify**:
- `src/app/products/page.tsx`
- `src/lib/search-actions.ts`

**Success Criteria**:
- Checkboxes show live product counts
- Counts update when filters change (Delta Light-style)
- Active filters displayed at top
- User can remove individual filters or clear all

---

### Phase 3: Technical Filters (Week 3)

**Tasks**:
1. Build Collapsible "Advanced Filters" section
2. Add multi-select filters (IP Rating, Voltage, Protection Class)
3. Add range filters (CCT, CRI, Luminous Flux) with Slider
4. Add preset chips for common ranges (Warm/Neutral/Cool)
5. Connect to `p_filters` JSONB parameter in RPC call
6. Update facet counts for technical filters

**Files to Modify**:
- `src/app/products/page.tsx`
- `src/types/search.ts`

**Success Criteria**:
- Advanced filters collapsible (hidden by default)
- Multi-select checkboxes work
- Range sliders work with presets
- Technical filters integrate with search results

---

### Phase 4: Polish & Mobile (Week 4)

**Tasks**:
1. Mobile responsive layout
2. Sheet/Drawer for mobile filters
3. Floating action button (mobile filter trigger)
4. Loading states and skeletons
5. Sort dropdown functionality
6. Pagination controls
7. Empty states ("No results found")
8. Error handling and fallbacks
9. Accessibility improvements (ARIA labels, keyboard nav)
10. Performance optimization (memoization, lazy loading)

**Files to Modify**:
- `src/app/products/page.tsx`
- `src/components/ui/*` (if custom components needed)

**Success Criteria**:
- Works perfectly on mobile/tablet
- Loading states don't block interaction
- Sorting changes update results
- Pagination works smoothly
- Accessible (keyboard navigation, screen reader support)

---

## Progressive Disclosure Strategy

### Level 1: Initial State (Simplest)
- Taxonomy tree (collapsed)
- Text search box
- "Popular categories" shortcuts (optional)
- No filters visible

### Level 2: After Category Selection
- Expand guided finder checkboxes
- Show context-aware counts
- Categories remain visible

### Level 3: Advanced Users
- "Advanced Filters" collapsible section
- Technical filters (CCT, IP, voltage, etc.)
- Only expand when user clicks

**Goal**: Don't overwhelm beginners, empower power users

---

## Key UX Principles

### 1. Context-Aware Counts (Delta Light Pattern)

**The Problem**:
```
Without dynamic facets:
  User selects "Indoor Ceiling"
  Filters still show: "IP65 (1,277 products)"
  User clicks IP65
  SURPRISE! Only 23 products (not 1,277)
```

**The Solution**:
```
With dynamic facets:
  User selects "Indoor Ceiling"
  Filter updates to: "IP65 (23 products)"  ← Updated count!
  User clicks IP65
  Shows exactly 23 products (as expected)
```

**Implementation**: Call `getDynamicFacetsAction()` after every filter change

---

### 2. Three-State Checkboxes

**States**:
- ✅ Checked = Filter for TRUE (must be indoor)
- ❌ Unchecked = Filter for FALSE (must be outdoor)
- ➖ Indeterminate = Don't care / NULL (show both)

**Database Mapping**:
```sql
WHERE (p_indoor IS NULL OR ptf.indoor = p_indoor)
```

**Why This Matters**: User can explicitly filter for "NOT indoor" (outdoor only)

---

### 3. Never Hide Options (Show Zeros)

**Bad UX**:
```
User selects "Indoor Ceiling"
IP rating options disappear if count = 0
User confused: "Where did IP67 go?"
```

**Good UX**:
```
User selects "Indoor Ceiling"
IP67 (0)  ← Still visible, but shows 0 count
User understands: "No indoor ceiling fixtures are IP67"
```

**Implementation**: Always render all filter options, just update counts

---

### 4. Live Feedback

Always show:
- "Showing X of Y products"
- Loading indicators (but don't disable UI)
- Active filters at top
- Clear affordances (× buttons, "Clear all")

---

## Performance Considerations

### Debouncing
- Text search: 300ms debounce
- Filter changes: Immediate (no debounce)

### Parallel Calls
```tsx
// ✅ GOOD: Parallel calls
const [products, count, facets] = await Promise.all([
  searchProductsAction(filters),
  countProductsAction(filters),
  getDynamicFacetsAction(filters)
])

// ❌ BAD: Sequential calls (3× slower)
const products = await searchProductsAction(filters)
const count = await countProductsAction(filters)
const facets = await getDynamicFacetsAction(filters)
```

### Caching
- Taxonomy tree: Cache with `unstable_cache` (1 hour TTL)
- Filter definitions: Fetch once, cache in state
- Search results: No caching (always fresh)

### Memoization
```tsx
const facetsByKey = useMemo(() => {
  return facets?.reduce((acc, facet) => {
    // ... group by filter_key
  }, {})
}, [facets])
```

---

## Testing Strategy

### Manual Testing Checklist

**Phase 1**:
- [ ] Category tree expands/collapses
- [ ] Text search returns results
- [ ] Result count displays correctly
- [ ] Product cards show basic info

**Phase 2**:
- [ ] Checkboxes update counts in real-time
- [ ] Three-state logic works (checked/unchecked/indeterminate)
- [ ] Active filters display
- [ ] Remove individual filters
- [ ] Clear all filters

**Phase 3**:
- [ ] Advanced filters collapsible
- [ ] Multi-select checkboxes work
- [ ] Range sliders update results
- [ ] Preset chips work

**Phase 4**:
- [ ] Mobile drawer opens/closes
- [ ] Loading states show
- [ ] Sorting works
- [ ] Pagination works
- [ ] Empty states display
- [ ] Keyboard navigation works

### Edge Cases

1. **No results**: Show helpful message
2. **Network error**: Show retry button
3. **Slow connection**: Show loading skeleton
4. **All filters cleared**: Return to initial state
5. **Invalid filter combo**: Show 0 results with explanation

---

## Accessibility Requirements

### Keyboard Navigation
- Tab through all interactive elements
- Enter/Space to activate checkboxes
- Escape to close modals/drawers
- Arrow keys for sliders

### Screen Reader Support
- ARIA labels on all filters
- Announce result count changes
- Announce loading states
- Semantic HTML (`<nav>`, `<aside>`, `<main>`)

### Color Contrast
- All text meets WCAG AA standards
- Focus indicators visible
- Don't rely on color alone for state

---

## Future Enhancements

### Phase 5 (Post-MVP)
- Save filter presets
- Filter history (back/forward navigation)
- URL parameter sync (shareable filter URLs)
- Infinite scroll (alternative to pagination)
- Product comparison feature
- Bulk export (CSV, PDF)
- Advanced text search (operators: AND, OR, NOT)
- Filter autocomplete
- Recently viewed products
- Recommended filters (AI-based)

---

## Reference Links

**Backend Documentation**:
- [ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md](../ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md) - Complete database schema and RPC functions

**Working Demo**:
- http://localhost:3001 - search-test-app (reference implementation)

**Source Code**:
- `/home/sysadmin/tools/searchdb/` - Complete backend implementation
- `/home/sysadmin/tools/searchdb/search-test-app/` - Demo frontend

**External Resources**:
- Delta Light filters: https://www.deltalight.com/ (UX reference)
- shadcn/ui: https://ui.shadcn.com/
- Radix UI: https://www.radix-ui.com/primitives

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-22 | 1.0 | Initial documentation created |

---

**End of Document**
