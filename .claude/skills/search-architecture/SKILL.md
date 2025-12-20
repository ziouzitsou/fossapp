---
name: search-architecture
description: Use this when working with search or filter features. Provides understanding of the three-tier search system (Guided Finder, Smart Text, Technical Filters), classification rules, facet filtering, and materialized view architecture.
---

# Search Architecture for FOSSAPP

FOSSAPP uses a sophisticated three-tier faceted search system built on PostgreSQL and materialized views. This skill provides essential knowledge for working with search and filter features.

---

## Three-Tier Search System

The search system has three complementary layers:

```
1. GUIDED FINDER
   └─ Boolean flags: indoor/outdoor/ceiling/recessed/dimmable
   └─ Fast category navigation
   └─ Examples: "Show me indoor ceiling lights" → filter by flags

2. SMART TEXT SEARCH
   └─ Full-text search on descriptions
   └─ ETIM feature matching
   └─ Examples: "67mm downlight" → matches descriptions + features

3. TECHNICAL FILTERS
   └─ Numeric ranges: power, lumens, dimensions
   └─ Alphanumeric: IP rating, voltage, color temperature
   └─ Examples: "IP65, 3000K, 10-20W" → precise specs
```

### Why Three Tiers?

- **Guided Finder:** Quick exploration without knowing technical terms
- **Smart Text:** Natural language queries (how users actually search)
- **Technical Filters:** Precise specification matching (expert users)

---

## Database Schema Organization

### search.* Schema (Isolated)

All search functionality lives in the `search` schema, which **never modifies** existing `items.*` tables.

```
search.taxonomy                  → Human-friendly categories
search.classification_rules      → ETIM class → taxonomy mapping
search.product_taxonomy_flags    → Boolean flags (indoor, ceiling, dimmable, etc.)
search.product_filter_index      → Filter values (CCT, IP, voltage, power, etc.)
search.filter_facets             → Pre-aggregated counts for UI
```

### Data Flow

```
items.product_info (56K+ products)
         ↓
Apply classification_rules (ETIM → human taxonomy)
         ↓
search.product_taxonomy_flags (boolean flags)
         ↓
Extract ETIM features → Flatten to relational format
         ↓
search.product_filter_index (filter values)
         ↓
Pre-aggregate statistics
         ↓
search.filter_facets (UI counts)
         ↓
RPC functions provide API for Next.js
```

---

## Classification System

### ETIM to Human Taxonomy

The system translates technical ETIM classifications into user-friendly categories:

**Example:**
```
ETIM Class: EC001744 "Downlight/spot/floodlight"
         ↓
Taxonomy: LUM_CEIL_REC "Recessed Ceiling Luminaires"
         ↓
Flags: indoor=true, ceiling=true, recessed=true
```

### Taxonomy Hierarchy

```
ROOT
├── LUM (Luminaires)
│   ├── LUM_CEIL (Ceiling)
│   │   ├── LUM_CEIL_REC (Recessed)
│   │   ├── LUM_CEIL_SURF (Surface)
│   │   └── LUM_CEIL_PEND (Pendant)
│   ├── LUM_WALL (Wall)
│   └── LUM_FLOOR (Floor)
├── TRACK (Track Systems)
└── CTRL (Control Systems)
```

### Classification Rules (search.classification_rules)

Maps ETIM classes to taxonomy codes with boolean flags:

```sql
-- Example rule
INSERT INTO search.classification_rules VALUES (
  'EC001744',           -- ETIM class (Downlight/spot/floodlight)
  'LUM_CEIL_REC',       -- Taxonomy code
  'indoor',             -- Indoor location
  NULL,                 -- Outdoor location (not applicable)
  'ceiling',            -- Mounting: ceiling
  'recessed',           -- Installation: recessed
  NULL,                 -- Not surface
  NULL,                 -- Not pendant
  true,                 -- Dimmable (default assumption)
  -- ... more flags
);
```

---

## RPC Functions (API Layer)

### Main Search Function

```typescript
// Search products with filters
const { data } = await supabaseServer
  .schema('search')
  .rpc('search_products_with_filters', {
    search_query: 'downlight',
    taxonomy_codes: ['LUM_CEIL_REC'],
    ip_ratings: ['IP20', 'IP44'],
    min_cct: 2700,
    max_cct: 3000,
    min_power: 10,
    max_power: 20,
    page_size: 50,
    page_number: 1
  })
```

### Get Dynamic Facets (Context-Aware Filters)

```typescript
// Get available filter options based on current search
const { data } = await supabaseServer
  .schema('search')
  .rpc('get_dynamic_facets', {
    search_query: 'downlight',
    taxonomy_codes: ['LUM_CEIL_REC']
  })

// Returns:
// {
//   ip_ratings: [{ value: 'IP20', count: 543 }, { value: 'IP44', count: 123 }],
//   cct_values: [{ value: 2700, count: 234 }, { value: 3000, count: 456 }],
//   ...
// }
```

**Why context-aware?** Prevents "0 results" dead ends by only showing filter options that have products matching the current search.

### Count Products

```typescript
// Get total count for pagination
const { data } = await supabaseServer
  .schema('search')
  .rpc('count_products_with_filters', {
    search_query: 'downlight',
    taxonomy_codes: ['LUM_CEIL_REC'],
    // ... same filters as search
  })
```

---

## Performance Characteristics

| Operation | Performance | Notes |
|-----------|-------------|-------|
| `search_products_with_filters()` | <200ms cold, <100ms warm | Main search query |
| `count_products_with_filters()` | <100ms cold, <50ms warm | Result count |
| `get_dynamic_facets()` | <100ms cold, <50ms warm | Context-aware filters |
| Materialized view refresh | 6-9s | All 3 search views |
| Full refresh (items + search) | 20-23s | Daily after catalog import |

### Optimization Techniques

- **Materialized views:** Pre-computed joins and aggregations
- **Indexes:** On all filterable columns
- **GIN indexes:** For full-text search
- **Configuration-driven:** No hardcoded business logic

---

## Working with Filters

### Filter Types

**Boolean Flags:**
```typescript
// Guided Finder
indoor?: boolean
outdoor?: boolean
ceiling?: boolean
wall?: boolean
recessed?: boolean
dimmable?: boolean
```

**Alphanumeric:**
```typescript
// Technical Filters
ip_ratings?: string[]        // ['IP20', 'IP44', 'IP65']
voltage_types?: string[]     // ['AC', 'DC']
beam_angles?: string[]       // ['10°', '24°', '40°']
```

**Numeric Ranges:**
```typescript
// Technical Filters
min_cct?: number            // Color temperature
max_cct?: number
min_power?: number          // Wattage
max_power?: number
min_lumens?: number         // Light output
max_lumens?: number
```

### Filter Combination Logic

Filters combine with **AND** logic within types, **OR** logic across values:

```typescript
// Example: Indoor AND Ceiling AND (IP20 OR IP44) AND 2700-3000K
{
  indoor: true,              // AND
  ceiling: true,             // AND
  ip_ratings: ['IP20', 'IP44'],  // OR
  min_cct: 2700,             // AND (range)
  max_cct: 3000
}
```

---

## Materialized Views

### Refresh Schedule

Materialized views are refreshed:
- **Automatically:** After daily catalog imports (via cron job)
- **Manually:** When needed via Supabase dashboard or SQL

**Refresh sequence:**
```sql
-- 1. Taxonomy flags
REFRESH MATERIALIZED VIEW CONCURRENTLY search.product_taxonomy_flags;

-- 2. Filter index
REFRESH MATERIALIZED VIEW CONCURRENTLY search.product_filter_index;

-- 3. Facets
REFRESH MATERIALIZED VIEW CONCURRENTLY search.filter_facets;
```

**CONCURRENTLY:** Allows queries during refresh (no downtime)

### When to Refresh

- After adding new products to catalog
- After updating classification rules
- After modifying taxonomy hierarchy
- When search results seem stale

---

## Adding New Filter Types

To add a new filter (e.g., "beam angle"):

1. **Add column to `search.product_filter_index` materialized view**
2. **Update extraction logic** to pull value from ETIM features
3. **Add to RPC function parameters** (`search_products_with_filters`)
4. **Update facet aggregation** in `search.filter_facets`
5. **Add to TypeScript types** (`src/types/search.ts`)
6. **Update UI components** to display new filter

---

## Common Queries

### Get All Available Taxonomies

```typescript
const { data } = await supabaseServer
  .schema('search')
  .from('taxonomy')
  .select('*')
  .order('display_order')
```

### Get Classification Rules

```typescript
const { data } = await supabaseServer
  .schema('search')
  .from('classification_rules')
  .select('*')
```

### Get Filter Facets (Pre-aggregated Counts)

```typescript
const { data } = await supabaseServer
  .schema('search')
  .from('filter_facets')
  .select('*')
```

---

## Integration with Components

### Filter Panel Component Pattern

```typescript
'use client'

import { useState } from 'react'
import { searchProductsWithFilters, getDynamicFacets } from '@/lib/actions/search'

export function FilterPanel() {
  const [filters, setFilters] = useState({})
  const [facets, setFacets] = useState({})

  // Get dynamic facets when filters change
  useEffect(() => {
    const loadFacets = async () => {
      const data = await getDynamicFacets(filters)
      setFacets(data)
    }
    loadFacets()
  }, [filters])

  // Render facets with counts
  return (
    <div>
      {facets.ip_ratings?.map(facet => (
        <Checkbox key={facet.value}>
          {facet.value} ({facet.count})
        </Checkbox>
      ))}
    </div>
  )
}
```

---

## Troubleshooting

### Search Returns No Results

**Check:**
1. Are filters too restrictive? Remove some filters
2. Are materialized views stale? Refresh them
3. Is search query too specific? Try broader terms
4. Are classification rules missing for products?

### Facets Show Zero Counts

**Check:**
1. Refresh `search.filter_facets` materialized view
2. Verify `search.product_filter_index` has data
3. Check classification rules are applied

### Slow Search Performance

**Check:**
1. Are indexes present on filter columns?
2. Is query plan using indexes? (`EXPLAIN ANALYZE`)
3. Are materialized views refreshed?
4. Is page_size too large? (keep under 100)

---

## Quick Reference

### RPC Functions

```typescript
// Search
search.search_products_with_filters(...)

// Count
search.count_products_with_filters(...)

// Dynamic facets
search.get_dynamic_facets(...)

// Boolean flag facets
search.get_filter_facets_with_context(...)
```

### Materialized Views

```sql
search.product_taxonomy_flags    -- Boolean flags per product
search.product_filter_index      -- Filter values per product
search.filter_facets             -- Pre-aggregated counts
```

### Configuration Tables

```sql
search.taxonomy                  -- Category hierarchy
search.classification_rules      -- ETIM → taxonomy mapping
```

---

## See Also

- Full architecture doc (8,500 words): [docs/database/advanced-search.md](../../docs/database/advanced-search.md)
- ETIM schema: [docs/database/schema.md](../../docs/database/schema.md)
- Filter UI components: [docs/features/filters.md](../../docs/features/filters.md)
- Product search: [docs/features/product-search.md](../../docs/features/product-search.md)
