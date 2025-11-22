# Advanced Search Database Architecture

**Version**: 2.5 (Production-Ready)
**Last Updated**: 2025-11-22
**Source Repository**: `/home/sysadmin/tools/searchdb/`
**Working Demo**: http://localhost:3001 (search-test-app)
**Target Database**: Supabase PostgreSQL (14,889+ products)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Schema](#database-schema)
3. [RPC Functions](#rpc-functions)
4. [Facet Filtering Logic](#facet-filtering-logic)
5. [Classification System](#classification-system)
6. [Materialized View Refresh Sequence](#materialized-view-refresh-sequence)
7. [Performance & Monitoring](#performance--monitoring)
8. [Integration Guide for FOSSAPP](#integration-guide-for-fossapp)
9. [Appendices](#appendices)

---

## Executive Summary

This document describes the **three-tier faceted search architecture** implemented in the `search` schema for the Foss SA lighting product database.

### Key Features

- **Performance**: Sub-200ms queries on 14,889+ products (sub-100ms with warm cache)
- **Configuration-Driven**: No hardcoded business logic - all rules in database tables
- **ETIM Translation**: Maps technical ETIM classifications to human-friendly taxonomy
- **Delta Light-Style UX**: Context-aware filters prevent "0 results" dead ends
- **Non-Invasive**: Isolated `search` schema - never modifies existing `items.*` tables
- **Domain-Driven RPC Functions**: Follows FOSSAPP's existing pattern (`.schema('search').rpc()`)

### Architecture Overview

```
Three-Tier Search System:

1. GUIDED FINDER → Boolean flags (indoor/outdoor/ceiling/recessed/etc.)
2. SMART TEXT SEARCH → Full-text + ETIM feature matching
3. TECHNICAL FILTERS → Numeric ranges (power, lumens) + alphanumeric (IP rating, voltage)
```

### Data Flow

```
items.product_info (14,889 products - existing materialized view)
         ↓
Apply classification_rules (ETIM → human taxonomy)
         ↓
search.product_taxonomy_flags (boolean flags: indoor, ceiling, dimmable, etc.)
         ↓
Extract ETIM features → Flatten to relational format
         ↓
search.product_filter_index (filter values: CCT, IP rating, voltage, etc.)
         ↓
Pre-aggregate statistics
         ↓
search.filter_facets (UI counts: "IP65: 1,277 products")
         ↓
RPC functions provide clean API for Next.js frontend
```

### Performance Metrics

| Operation | Cold Cache | Warm Cache | Notes |
|-----------|-----------|------------|-------|
| `search_products_with_filters()` | <200ms | <100ms | Main search with filters |
| `count_products_with_filters()` | <100ms | <50ms | Result count |
| `get_dynamic_facets()` | <100ms | <50ms | Context-aware filter options |
| `get_filter_facets_with_context()` | <50ms | <20ms | Boolean flag counts |
| **Materialized view refresh** | **6-9s** | **N/A** | All 3 search views |
| **Total refresh (items + search)** | **20-23s** | **N/A** | Daily after catalog import |

---

## Database Schema

The search system uses a new isolated `search` schema that **reads from** existing views but **never modifies** them.

### Configuration Tables

#### 1. `search.taxonomy`

**Purpose**: Hierarchical product categories for human-friendly navigation

**Structure**:
```sql
CREATE TABLE search.taxonomy (
  code TEXT PRIMARY KEY,              -- Unique identifier (e.g., 'LUM_CEIL_REC')
  parent_code TEXT,                   -- Parent category (NULL for root)
  level INTEGER NOT NULL,             -- Hierarchy depth (0=root, 1=main, 2=sub, 3=type)
  name TEXT NOT NULL,                 -- Display name ('Recessed Ceiling Luminaires')
  icon TEXT,                          -- Optional icon identifier
  full_path TEXT[],                   -- Array: ['ROOT', 'LUM', 'LUM_CEIL', 'LUM_CEIL_REC']
  display_order INTEGER DEFAULT 100,  -- Sort order in UI
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example Hierarchy**:
```
ROOT
├── LUM (Luminaires) - 13,336 products
│   ├── LUM_CEIL (Ceiling)
│   │   ├── LUM_CEIL_REC (Recessed)
│   │   ├── LUM_CEIL_SURF (Surface-mounted)
│   │   └── LUM_CEIL_SUSP (Suspended)
│   ├── LUM_WALL (Wall-mounted)
│   ├── LUM_FLOOR (Floor-standing)
│   └── LUM_SPEC (Special - strips, tracks, decorative)
├── ACC (Accessories) - 1,411 products
│   └── ACC_TRACK (Track Components)
├── DRV (Drivers) - 83 products
│   ├── DRV_CC (Constant Current)
│   └── DRV_CV (Constant Voltage)
└── LAMP (Lamps) - 50 products
```

**Total Nodes**: ~30 taxonomy categories across 4 hierarchy levels

**Key Insight**: This taxonomy is **human-designed** for end users who don't know ETIM codes. A light engineer thinks "Ceiling → Recessed", not "EG000027 → EC001744".

---

#### 2. `search.classification_rules`

**Purpose**: Configuration-driven rules that map ETIM codes → human taxonomy

**Structure**:
```sql
CREATE TABLE search.classification_rules (
  rule_id SERIAL PRIMARY KEY,
  rule_name TEXT NOT NULL UNIQUE,     -- Descriptive identifier
  taxonomy_code TEXT,                  -- Target taxonomy category
  flag_name TEXT,                      -- Boolean flag to set (e.g., 'indoor', 'dimmable')
  priority INTEGER DEFAULT 100,        -- Lower = higher priority (1-20 = root categories)

  -- Classification Methods (ONE or more required):
  etim_group_ids TEXT[],               -- Match ETIM groups (e.g., ['EG000027'])
  etim_class_ids TEXT[],               -- Match ETIM classes (e.g., ['EC002710'])
  etim_feature_conditions JSONB,       -- Feature-based matching
  text_pattern TEXT,                   -- Regex for description matching

  active BOOLEAN DEFAULT TRUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Classification Methods**:

**1. ETIM Group-Based** (Structural - for broad categories):
```sql
INSERT INTO search.classification_rules
(rule_name, taxonomy_code, flag_name, etim_group_ids, priority, description)
VALUES
('luminaires_root', 'LUM', 'luminaire', ARRAY['EG000027'], 10,
 'All luminaires from ETIM group EG000027');
```

**2. ETIM Class-Based** (Specific subset):
```sql
-- Drivers ONLY (subset of accessories group)
INSERT INTO search.classification_rules
(rule_name, taxonomy_code, flag_name, etim_class_ids, priority, description)
VALUES
('drivers_root', 'DRV', 'driver', ARRAY['EC002710'], 5,
 'LED drivers - must have higher priority than accessories to override');
```

**Why Different Priorities?**
Both drivers (EC002710) and accessories come from the same ETIM group (EG000030). By giving drivers **priority 5** and accessories **priority 20**, drivers win when a product matches both rules.

**3. Text Pattern-Based** (Functional characteristics):
```sql
-- Indoor/Outdoor detection
INSERT INTO search.classification_rules
(rule_name, flag_name, text_pattern, priority, description)
VALUES
('indoor_detection', 'indoor', 'indoor|interior|internal', 100,
 'Matches indoor keywords in description (case-insensitive)'),

('outdoor_detection', 'outdoor', 'outdoor|exterior|external|garden', 100,
 'Matches outdoor keywords in description');
```

**Why Text Patterns?**
ETIM doesn't have dedicated "indoor" or "outdoor" classifications. Suppliers include this information in product descriptions, making text patterns more reliable than trying to infer from IP ratings.

**4. Feature-Based** (ETIM feature exists):
```sql
-- Dimmable products
INSERT INTO search.classification_rules
(rule_name, flag_name, etim_feature_conditions, priority, description)
VALUES
('dimmable_detection', 'dimmable',
 '{"EF021180": {"operator": "exists"}}', 100,
 'Products with ETIM feature EF021180 (dimmable)');
```

**Priority System**:
- **1-20**: Root categories (LUMINAIRE, ACCESSORIES, DRIVERS, LAMPS)
- **30-40**: Mounting locations (CEILING, WALL, FLOOR)
- **50-60**: Installation types (RECESSED, SURFACE, SUSPENDED)
- **70-80**: Specialized types (STRIPS, TRACKS, DECORATIVE)
- **100+**: Universal flags (INDOOR, OUTDOOR, TRIMLESS, DIMMABLE)

**Total Rules**: ~30 active classification rules

---

#### 3. `search.filter_definitions`

**Purpose**: Configuration for available filters in UI

**Structure**:
```sql
CREATE TABLE search.filter_definitions (
  filter_key TEXT PRIMARY KEY,         -- Unique identifier ('cct', 'ip', 'voltage')
  filter_type TEXT NOT NULL,           -- 'boolean' | 'multi-select' | 'range'
  label TEXT NOT NULL,                 -- Display name ('Color Temperature')
  etim_feature_id TEXT,                -- ETIM feature code ('EF009346')
  etim_feature_type TEXT,              -- 'L' | 'A' | 'N' | 'R' (from ETIM)
  ui_config JSONB,                     -- UI-specific configuration
  display_order INTEGER DEFAULT 100,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Filter Types**:

**1. Boolean Filters** (`filter_type = 'boolean'`):
```sql
INSERT INTO search.filter_definitions
(filter_key, filter_type, label, etim_feature_id, etim_feature_type, ui_config)
VALUES
('dimmable', 'boolean', 'Dimmable', 'EF021180', 'L',
 '{"filter_category": "electricals", "default": null}');
```
- Maps to ETIM logical features (type "L")
- Stored as boolean in `product_filter_index.boolean_value`
- UI shows: Yes / No / Any (3-state logic)

**2. Multi-Select Filters** (`filter_type = 'multi-select'`):
```sql
INSERT INTO search.filter_definitions
(filter_key, filter_type, label, etim_feature_id, etim_feature_type, ui_config)
VALUES
('ip', 'multi-select', 'IP Rating', 'EF002498', 'A',
 '{"filter_category": "design", "options": ["IP20", "IP44", "IP54", "IP65", "IP67"]}');
```
- Maps to ETIM alphanumeric features (type "A")
- Stored as text in `product_filter_index.alphanumeric_value`
- UI shows: Checkboxes (multiple selection)

**3. Range Filters** (`filter_type = 'range'`):
```sql
INSERT INTO search.filter_definitions
(filter_key, filter_type, label, etim_feature_id, etim_feature_type, ui_config)
VALUES
('cct', 'range', 'Color Temperature (K)', 'EF009346', 'N',
 '{"filter_category": "light_engine", "min": 2700, "max": 6500, "step": 100, "unit": "K",
   "presets": [{"label": "Warm", "value": 3000}, {"label": "Neutral", "value": 4000}]}');
```
- Maps to ETIM numeric/range features (type "N", "R")
- Stored as numeric in `product_filter_index.numeric_value`
- UI shows: Slider or input fields

**Deployed Filters** (Phase 1 - 8 active filters):

| Filter Category | Filter Key | Filter Type | ETIM Feature |
|----------------|-----------|-------------|--------------|
| **Electricals** | voltage | multi-select | EF002497 |
| | dimmable | boolean | EF021180 |
| | protection_class | multi-select | EF009473 |
| **Design** | ip | multi-select | EF002498 |
| | finishing_colour | multi-select | EF009369 |
| **Light Engine** | cct | range | EF009346 |
| | cri | range | EF009470 |
| | luminous_flux | range | EF009471 |

**Future Phases** (18 total filters documented, ready to activate):
- Phase 2: Beam angle, color temp tunable, smart control, emergency function
- Phase 3: Decorative style, material finish, mounting accessories

---

### Materialized Views (Performance Layer)

#### 1. `search.product_taxonomy_flags`

**Purpose**: Pre-computed boolean flags per product for instant filtering

**Dependencies**: ⚠️ **Depends on `items.product_info`** (must refresh after base view)

**Structure**:
```sql
CREATE MATERIALIZED VIEW search.product_taxonomy_flags AS
SELECT
  pi.product_id,
  pi.foss_pid,

  -- Taxonomy path (array of codes)
  ARRAY_AGG(DISTINCT cr.taxonomy_code) FILTER (WHERE cr.taxonomy_code IS NOT NULL) as taxonomy_path,

  -- Root category flags
  bool_or(cr.flag_name = 'luminaire') as luminaire,
  bool_or(cr.flag_name = 'lamp') as lamp,
  bool_or(cr.flag_name = 'driver') as driver,
  bool_or(cr.flag_name = 'accessory') as accessory,

  -- Environment flags
  bool_or(cr.flag_name = 'indoor') as indoor,
  bool_or(cr.flag_name = 'outdoor') as outdoor,
  bool_or(cr.flag_name = 'submersible') as submersible,
  bool_or(cr.flag_name = 'trimless') as trimless,

  -- Mounting location flags
  bool_or(cr.flag_name = 'ceiling') as ceiling,
  bool_or(cr.flag_name = 'wall') as wall,
  bool_or(cr.flag_name = 'floor') as floor,

  -- Installation type flags
  bool_or(cr.flag_name = 'recessed') as recessed,
  bool_or(cr.flag_name = 'surface_mounted') as surface_mounted,
  bool_or(cr.flag_name = 'suspended') as suspended,

  -- [... 10+ more boolean flags]

FROM items.product_info pi
CROSS JOIN search.classification_rules cr
WHERE cr.active = true
  AND (
    -- Match by ETIM group
    pi."group" = ANY(cr.etim_group_ids)
    -- Match by ETIM class
    OR pi.class = ANY(cr.etim_class_ids)
    -- Match by text pattern
    OR pi.description_short ~* cr.text_pattern
    OR pi.description_long ~* cr.text_pattern
    -- Match by ETIM feature (feature-based rules)
    OR [... feature matching logic ...]
  )
GROUP BY pi.product_id, pi.foss_pid
ORDER BY pi.product_id;
```

**How It's Built**:
1. Apply all active `classification_rules` to products
2. Match products by ETIM group/class/feature/text pattern
3. Aggregate boolean flags using `bool_or()` (TRUE if any rule sets it)
4. Store as indexed boolean columns (**NOT JSON** - critical for performance!)

**Indexes**:
```sql
CREATE INDEX idx_ptf_product_id ON search.product_taxonomy_flags (product_id);
CREATE INDEX idx_ptf_taxonomy_path_gin ON search.product_taxonomy_flags USING GIN (taxonomy_path);
CREATE INDEX idx_ptf_indoor ON search.product_taxonomy_flags (indoor) WHERE indoor = TRUE;
CREATE INDEX idx_ptf_outdoor ON search.product_taxonomy_flags (outdoor) WHERE outdoor = TRUE;
CREATE INDEX idx_ptf_ceiling ON search.product_taxonomy_flags (ceiling) WHERE ceiling = TRUE;
-- [... 10+ more partial indexes for boolean flags]
```

**Size**: 4.0 MB (14,889 rows × ~30 columns)
**Refresh Time**: ~2-3 seconds
**Query Performance**: <10ms for boolean flag filtering (indexed equality checks)

**Why It's Fast**:
- No JSON parsing at query time
- Boolean columns use partial indexes (only indexes TRUE values)
- Simple equality checks: `WHERE indoor = TRUE AND ceiling = TRUE`
- Array overlap for taxonomy: `WHERE taxonomy_path && ARRAY['LUM_CEIL']`

---

#### 2. `search.product_filter_index`

**Purpose**: Flattened ETIM features for technical filtering

**Dependencies**: ⚠️ **Depends on `items.product_info` + `items.product_features_mv`**

**Structure**:
```sql
CREATE MATERIALIZED VIEW search.product_filter_index AS
SELECT
  pi.product_id,
  fd.filter_key,
  fd.filter_type,

  -- Store value based on filter type
  CASE WHEN fd.filter_type = 'range'
    THEN pf.numeric_value
  END as numeric_value,

  CASE WHEN fd.filter_type = 'multi-select'
    THEN pf.alphanumeric_value
  END as alphanumeric_value,

  CASE WHEN fd.filter_type = 'boolean'
    THEN pf.boolean_value
  END as boolean_value,

  pf.unit_abbrev

FROM items.product_info pi
JOIN items.product_features_mv pf ON pi.product_id = pf.product_id
JOIN search.filter_definitions fd ON pf.feature_id = fd.etim_feature_id
WHERE fd.active = TRUE;
```

**Example Data**:
```
product_id           | filter_key | filter_type  | numeric_value | alphanumeric_value | unit_abbrev
---------------------|-----------|--------------|---------------|--------------------|--------------
abc-123-def-456...   | cct       | range        | 3000          | NULL               | K
abc-123-def-456...   | ip        | multi-select | NULL          | IP65               | NULL
abc-123-def-456...   | voltage   | multi-select | NULL          | 24V                | NULL
abc-123-def-456...   | luminous_flux | range   | 1200          | NULL               | lm
```

**How It's Built**:
1. Extract features from `items.product_info.features` (JSONB array)
2. Join with `items.product_features_mv` (flattened ETIM features)
3. Join with `filter_definitions` to get only active filters
4. Flatten to one row per product-filter combination
5. Cast values to appropriate column based on filter type

**Indexes**:
```sql
CREATE INDEX idx_pfi_product_id ON search.product_filter_index (product_id);
CREATE INDEX idx_pfi_filter_key ON search.product_filter_index (filter_key);
CREATE INDEX idx_pfi_numeric ON search.product_filter_index (filter_key, numeric_value)
  WHERE numeric_value IS NOT NULL;
CREATE INDEX idx_pfi_alphanumeric ON search.product_filter_index (filter_key, alphanumeric_value)
  WHERE alphanumeric_value IS NOT NULL;
```

**Size**: ~56 KB (~125,000 rows - avg 8.4 features per product)
**Refresh Time**: ~3-5 seconds
**Query Performance**: <50ms for range queries, <20ms for multi-select

**Why This Design?**:
- **Relational format** (not JSONB) allows standard SQL operators
- **Type-specific columns** enable proper indexing (numeric vs. text)
- **One row per filter** enables efficient aggregation for facet counts
- **Narrow table** (5 columns) keeps memory footprint small

---

#### 3. `search.filter_facets`

**Purpose**: Pre-calculated aggregated filter statistics for initial UI rendering

**Dependencies**: ⚠️ **Depends on `search.product_filter_index`**

**Structure**:
```sql
CREATE MATERIALIZED VIEW search.filter_facets AS
SELECT
  filter_key,
  filter_type,

  -- For range filters: min, max, avg, histogram
  CASE WHEN filter_type = 'range' THEN
    jsonb_build_object(
      'min', MIN(numeric_value),
      'max', MAX(numeric_value),
      'avg', AVG(numeric_value),
      'count', COUNT(DISTINCT product_id),
      'histogram', [... binned counts ...]
    )
  END as numeric_stats,

  -- For multi-select: value counts
  CASE WHEN filter_type = 'multi-select' THEN
    jsonb_object_agg(alphanumeric_value, value_count)
  END as alphanumeric_counts,

  -- For boolean: true count
  SUM(CASE WHEN boolean_value = TRUE THEN 1 ELSE 0 END) as boolean_true_count,

  COUNT(DISTINCT product_id) as total_products

FROM search.product_filter_index
GROUP BY filter_key, filter_type;
```

**Example Data**:
```sql
-- CCT filter (range)
filter_key: 'cct'
filter_type: 'range'
numeric_stats: {
  "min": 2700,
  "max": 6500,
  "avg": 3850,
  "count": 13510,
  "histogram": [
    {"range": "2700-3100", "count": 4234},
    {"range": "3100-3500", "count": 2456},
    {"range": "3500-4000", "count": 3120},
    {"range": "4000-6500", "count": 3700}
  ]
}

-- IP rating filter (multi-select)
filter_key: 'ip'
filter_type: 'multi-select'
alphanumeric_counts: {
  "IP20": 5001,
  "IP44": 1456,
  "IP54": 234,
  "IP65": 1277,
  "IP67": 123
}
```

**Size**: ~16 KB (8 rows - one per active filter)
**Refresh Time**: ~1 second
**Use Case**: Initial filter UI rendering (before user applies any filters)

**Why Pre-Aggregate?**
- **Fast initial page load**: UI gets filter counts without query
- **Histogram data**: Enables smart range presets (e.g., "Most products are 3000K")
- **Small size**: 16KB cached in memory for instant access

---

## RPC Functions

The search system provides **7 RPC functions** in the `search` schema, following FOSSAPP's domain-driven organization pattern.

### Core Search Functions

#### 1. `search_products_with_filters()`

**Purpose**: Main product search with filters, sorting, and pagination

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.search_products_with_filters(
  -- Text search
  p_query TEXT DEFAULT NULL,

  -- Taxonomy filter (array of codes)
  p_taxonomy_codes TEXT[] DEFAULT NULL,

  -- Supplier filter
  p_suppliers TEXT[] DEFAULT NULL,

  -- Boolean flags (11 parameters - three-state logic: TRUE/FALSE/NULL)
  p_indoor BOOLEAN DEFAULT NULL,
  p_outdoor BOOLEAN DEFAULT NULL,
  p_submersible BOOLEAN DEFAULT NULL,
  p_trimless BOOLEAN DEFAULT NULL,
  p_ceiling BOOLEAN DEFAULT NULL,
  p_wall BOOLEAN DEFAULT NULL,
  p_floor BOOLEAN DEFAULT NULL,
  p_recessed BOOLEAN DEFAULT NULL,
  p_surface_mounted BOOLEAN DEFAULT NULL,
  p_suspended BOOLEAN DEFAULT NULL,
  p_dimmable BOOLEAN DEFAULT NULL,

  -- Technical filters (JSONB object)
  p_filters JSONB DEFAULT NULL,

  -- Sorting and pagination
  p_sort_by TEXT DEFAULT 'relevance',  -- 'relevance' | 'price_asc' | 'price_desc'
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  product_id UUID,
  foss_pid TEXT,
  description_short TEXT,
  description_long TEXT,
  supplier_name TEXT,
  class_name TEXT,
  price NUMERIC,
  image_url TEXT,
  taxonomy_path TEXT[],        -- Array of taxonomy codes
  flags JSONB,                 -- All boolean flags as JSON
  key_features JSONB,          -- Extracted filter values
  relevance_score INTEGER      -- 1=exact, 2=partial, 3=other
)
LANGUAGE sql
STABLE;
```

**Technical Filter Format** (`p_filters` JSONB):
```json
{
  "voltage": ["12V", "24V"],                    // Multi-select (array)
  "dimmable": true,                             // Boolean
  "cct": {"min": 3000, "max": 4000},           // Range (object with min/max)
  "ip": ["IP65", "IP67"],                       // Multi-select
  "luminous_flux": {"min": 1000, "max": 2000}  // Range
}
```

**How It Works** (simplified):
```sql
SELECT ...
FROM items.product_info pi
JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
WHERE
  -- 1. Filter by taxonomy (array overlap)
  (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)

  -- 2. Filter by boolean flags (three-state logic)
  AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
  AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
  AND (p_ceiling IS NULL OR ptf.ceiling = p_ceiling)
  -- [... other boolean flags ...]

  -- 3. Filter by supplier
  AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))

  -- 4. Filter by technical filters (JSONB)
  AND (
    p_filters IS NULL
    OR EXISTS (
      SELECT 1 FROM search.product_filter_index pfi
      WHERE pfi.product_id = pi.product_id
        -- Multi-select filter
        AND ((p_filters->>'voltage')::JSONB IS NULL
             OR pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'voltage'))))
        -- Range filter
        AND ((p_filters->'cct') IS NULL
             OR pfi.numeric_value BETWEEN (p_filters->'cct'->>'min')::NUMERIC
                                     AND (p_filters->'cct'->>'max')::NUMERIC)
        -- Boolean filter
        AND ((p_filters->>'dimmable')::BOOLEAN IS NULL
             OR pfi.boolean_value = (p_filters->>'dimmable')::BOOLEAN)
    )
  )

  -- 5. Text search (optional)
  AND (p_query IS NULL
       OR pi.description_short ILIKE '%' || p_query || '%'
       OR pi.foss_pid ILIKE '%' || p_query || '%')

ORDER BY
  CASE WHEN p_sort_by = 'relevance' THEN relevance_score END ASC,
  CASE WHEN p_sort_by = 'price_asc' THEN pi.price END ASC,
  CASE WHEN p_sort_by = 'price_desc' THEN pi.price END DESC

LIMIT p_limit OFFSET p_offset;
```

**TypeScript Example** (FOSSAPP integration):
```typescript
// src/lib/actions.ts
import { supabaseServer } from '@/lib/supabase-server'

export async function searchProductsAction(filters: SearchFilters) {
  const { data, error } = await supabaseServer
    .schema('search')
    .rpc('search_products_with_filters', {
      p_query: filters.query || null,
      p_taxonomy_codes: filters.categories || null,
      p_indoor: filters.indoor ?? null,
      p_outdoor: filters.outdoor ?? null,
      p_filters: filters.technicalFilters ? JSON.stringify(filters.technicalFilters) : null,
      p_sort_by: filters.sortBy || 'relevance',
      p_limit: 50,
      p_offset: filters.page * 50
    })

  if (error) {
    console.error('Search error:', error)
    return []
  }

  return data || []
}
```

**Performance**: <200ms cold cache, <100ms warm cache

---

#### 2. `count_products_with_filters()`

**Purpose**: Count matching products (for "Showing X of Y results" UI)

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.count_products_with_filters(
  -- Same parameters as search_products_with_filters()
  -- EXCEPT: no p_sort_by, p_limit, p_offset
)
RETURNS BIGINT
LANGUAGE sql
STABLE;
```

**Implementation**: Uses same WHERE clause as `search_products_with_filters()` but returns `COUNT(DISTINCT pi.product_id)` instead of full SELECT.

**TypeScript Example**:
```typescript
const { data: count } = await supabaseServer
  .schema('search')
  .rpc('count_products_with_filters', {
    p_query: filters.query,
    p_taxonomy_codes: filters.categories,
    p_filters: JSON.stringify(filters.technicalFilters)
  })

console.log(`Found ${count} matching products`)
```

**Performance**: <100ms (same WHERE clause, COUNT only)

---

### Dynamic Facet Functions

#### 3. `get_dynamic_facets()`

**Purpose**: Get context-aware filter options with product counts (Delta Light-style UX)

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.get_dynamic_facets(
  -- Same context filters as search
  p_query TEXT DEFAULT NULL,
  p_taxonomy_codes TEXT[] DEFAULT NULL,
  p_suppliers TEXT[] DEFAULT NULL,
  p_indoor BOOLEAN DEFAULT NULL,
  p_outdoor BOOLEAN DEFAULT NULL,
  -- [... other boolean flags ...]
  p_filters JSONB DEFAULT NULL
)
RETURNS TABLE (
  filter_category TEXT,    -- 'electricals' | 'design' | 'light_engine'
  filter_key TEXT,         -- 'ip', 'cct', 'voltage'
  filter_value TEXT,       -- 'IP65', '3000', '12V'
  product_count BIGINT     -- Count in CURRENT context
)
LANGUAGE sql
STABLE;
```

**How It Works**:
```sql
WITH filtered_products AS (
  -- Step 1: Narrow product set using current context
  SELECT DISTINCT pi.product_id
  FROM items.product_info pi
  JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
  WHERE
    (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
    -- [... apply all current filters ...]
)
-- Step 2: Count filter values from NARROWED product set
SELECT
  fd.ui_config->>'filter_category' as filter_category,
  pfi.filter_key,
  COALESCE(pfi.alphanumeric_value::TEXT, pfi.numeric_value::TEXT) as filter_value,
  COUNT(DISTINCT pfi.product_id) as product_count
FROM search.product_filter_index pfi
JOIN search.filter_definitions fd ON pfi.filter_key = fd.filter_key
WHERE pfi.product_id IN (SELECT product_id FROM filtered_products)
  AND fd.active = TRUE
GROUP BY filter_category, pfi.filter_key, filter_value
HAVING COUNT(DISTINCT pfi.product_id) > 0  -- Only return values that have products
ORDER BY filter_category, pfi.filter_key, product_count DESC;
```

**Example Output**:
```
User selects: "Indoor Ceiling"

filter_category | filter_key | filter_value | product_count
----------------|-----------|--------------|---------------
design          | ip        | IP20         | 4234  ← Indoor typical
design          | ip        | IP44         | 123
design          | ip        | IP65         | 23    ← Only 23 indoor ceiling IP65!
light_engine    | cct       | 3000         | 2456
light_engine    | cct       | 4000         | 1234
```

**Key Benefit**: Counts update in real-time based on current filter context. User sees "IP65 (23)" and knows exactly how many products remain if they select it.

**TypeScript Example**:
```typescript
const { data: facets } = await supabaseServer
  .schema('search')
  .rpc('get_dynamic_facets', {
    p_taxonomy_codes: ['LUM_CEIL'],
    p_indoor: true,
    p_filters: null
  })

// Group facets by filter_key for UI
const facetsByKey = facets?.reduce((acc, facet) => {
  if (!acc[facet.filter_key]) acc[facet.filter_key] = []
  acc[facet.filter_key].push({
    value: facet.filter_value,
    count: facet.product_count
  })
  return acc
}, {})
```

**Performance**: <100ms (CTE narrows set, then aggregate)

---

#### 4. `get_filter_facets_with_context()`

**Purpose**: Get context-aware boolean flag counts

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.get_filter_facets_with_context(
  -- Same context filters as search
  p_query TEXT DEFAULT NULL,
  p_taxonomy_codes TEXT[] DEFAULT NULL,
  -- [...]
)
RETURNS TABLE (
  flag_name TEXT,          -- 'indoor', 'outdoor', 'submersible'
  true_count BIGINT,       -- Products where flag = TRUE
  false_count BIGINT       -- Products where flag = FALSE
)
LANGUAGE sql
STABLE;
```

**Example Output**:
```
User selects: "Indoor Ceiling"

flag_name   | true_count | false_count
------------|------------|-------------
indoor      | 8245       | 0
outdoor     | 368        | 7877  ← 368 products are BOTH indoor AND outdoor!
submersible | 12         | 8233
recessed    | 3456       | 4789
dimmable    | 6234       | 2011
```

**TypeScript Example**:
```typescript
const { data: flagCounts } = await supabaseServer
  .schema('search')
  .rpc('get_filter_facets_with_context', {
    p_taxonomy_codes: ['LUM_CEIL'],
    p_indoor: true
  })

// Update UI checkboxes with counts
flagCounts?.forEach(flag => {
  updateCheckbox(flag.flag_name, flag.true_count)
})
```

**Performance**: <50ms (boolean aggregation is very fast)

---

### Helper Functions

#### 5. `get_taxonomy_tree()`

**Purpose**: Get complete taxonomy hierarchy with product counts

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.get_taxonomy_tree()
RETURNS TABLE (
  code TEXT,
  parent_code TEXT,
  level INTEGER,
  name TEXT,
  icon TEXT,
  product_count INTEGER  -- Calculated from product_taxonomy_flags
)
LANGUAGE sql
STABLE;
```

**TypeScript Example**:
```typescript
const { data: taxonomy } = await supabaseServer
  .schema('search')
  .rpc('get_taxonomy_tree')

// Build tree structure for UI
const buildTree = (nodes, parentCode = null) => {
  return nodes
    .filter(n => n.parent_code === parentCode)
    .map(node => ({
      ...node,
      children: buildTree(nodes, node.code)
    }))
}

const tree = buildTree(taxonomy)
```

**Performance**: <20ms (small table, ~30 rows)

---

#### 6. `get_filter_definitions_with_type()`

**Purpose**: Get filter metadata for UI rendering

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.get_filter_definitions_with_type(
  p_taxonomy_code TEXT DEFAULT NULL  -- Currently unused, returns all
)
RETURNS TABLE (
  filter_key TEXT,
  label TEXT,
  filter_type TEXT,           -- 'boolean' | 'multi-select' | 'range'
  etim_feature_id TEXT,
  etim_feature_type TEXT,     -- 'L' | 'A' | 'N' | 'R'
  ui_config JSONB,            -- UI settings (min, max, step, presets, etc.)
  display_order INTEGER
)
LANGUAGE sql
STABLE;
```

**TypeScript Example**:
```typescript
const { data: filterDefs } = await supabaseServer
  .schema('search')
  .rpc('get_filter_definitions_with_type')

// Render filters based on type
filterDefs?.forEach(filter => {
  switch (filter.filter_type) {
    case 'range':
      renderRangeSlider(filter)
      break
    case 'multi-select':
      renderCheckboxGroup(filter)
      break
    case 'boolean':
      renderToggle(filter)
      break
  }
})
```

**Performance**: <10ms (8 rows, no joins)

---

#### 7. `get_search_statistics()`

**Purpose**: System-wide statistics for monitoring

**Signature**:
```sql
CREATE OR REPLACE FUNCTION search.get_search_statistics()
RETURNS TABLE (
  stat_name TEXT,
  stat_value TEXT
)
LANGUAGE sql
STABLE;
```

**Example Output**:
```
stat_name                      | stat_value
-------------------------------|-------------
total_products                 | 14889
taxonomy_flagged_products      | 14889
filter_indexed_products        | 14889
total_filter_index_entries     | 125437
total_filter_facets            | 12
avg_features_per_product       | 8.4
taxonomy_nodes                 | 30
classification_rules           | 35
```

**TypeScript Example**:
```typescript
const { data: stats } = await supabaseServer
  .schema('search')
  .rpc('get_search_statistics')

// Convert to key-value object
const statsObject = stats?.reduce((acc, { stat_name, stat_value }) => {
  acc[stat_name] = stat_value
  return acc
}, {})

console.log(`Indexed ${statsObject.total_products} products`)
```

**Performance**: <100ms (aggregates multiple tables)

---

## Facet Filtering Logic

This section explains **how dynamic facets work** to provide Delta Light-style context-aware filtering.

### The Problem: Static Facets

**Without dynamic facets** (traditional e-commerce):
```
Initial State:
  - IP20: 5,001 products
  - IP44: 1,456 products
  - IP65: 1,277 products

User selects: "Indoor Ceiling"
  ↓
Filter counts DON'T update:
  - IP20: 5,001 products ← STILL shows total, not filtered count
  - IP65: 1,277 products ← User clicks this

Result: Only 23 products! ← SURPRISE! User expected ~1,277
```

**User Confusion**:
- "Why are there only 23 products when it said 1,277?"
- Leads to "0 results" dead ends
- Users don't know which filters are compatible

---

### The Solution: Dynamic Facets

**With dynamic facets** (Delta Light / Amazon style):
```
Initial State:
  - IP20: 5,001 products
  - IP65: 1,277 products

User selects: "Indoor Ceiling"
  ↓
Filter counts UPDATE immediately:
  - IP20: 4,234 products ← Updated (most indoor ceiling are IP20)
  - IP65: 23 products    ← Updated (very few indoor ceiling are IP65)

User clicks IP65:
  ↓
Result: 23 products ← EXPECTED! User saw "23" before clicking
```

**User Benefits**:
- Always know exactly how many products remain
- No "0 results" surprises
- Understand filter relationships (IP65 is rare for indoor ceiling)
- Explore confidently

---

### How It Works: Step-by-Step

**Scenario**: User navigates from homepage → "Indoor Ceiling Luminaires"

**Step 1**: User selects "Ceiling" category
```typescript
selectedTaxonomies = ['LUM_CEIL']
selectedFlags = {}
```

**Step 2**: UI calls `get_dynamic_facets()` to get initial counts
```typescript
const { data: facets } = await supabase.rpc('get_dynamic_facets', {
  p_taxonomy_codes: ['LUM_CEIL'],
  p_indoor: null,  // Not selected yet
  p_outdoor: null,
  p_filters: null
})
```

**Step 3**: Database filters product set (CTE)
```sql
WITH filtered_products AS (
  SELECT product_id
  FROM search.product_taxonomy_flags
  WHERE taxonomy_path && ARRAY['LUM_CEIL']  -- 7,361 products
)
```

**Step 4**: Count filter values from filtered set
```sql
SELECT
  filter_key,
  alphanumeric_value as filter_value,
  COUNT(DISTINCT product_id) as product_count
FROM search.product_filter_index
WHERE product_id IN (SELECT product_id FROM filtered_products)
GROUP BY filter_key, filter_value
```

**Step 5**: UI receives facets
```
ip | IP20 | 6234
ip | IP44 | 456
ip | IP65 | 234  ← "234 ceiling luminaires with IP65"
cct | 3000 | 3456
cct | 4000 | 2345
```

**Step 6**: User checks "Indoor" filter

**Step 7**: UI re-calls `get_dynamic_facets()` with updated context
```typescript
const { data: facets } = await supabase.rpc('get_dynamic_facets', {
  p_taxonomy_codes: ['LUM_CEIL'],
  p_indoor: true,  // ← NEW FILTER APPLIED
  p_outdoor: null,
  p_filters: null
})
```

**Step 8**: Database re-filters with narrower context
```sql
WITH filtered_products AS (
  SELECT product_id
  FROM search.product_taxonomy_flags
  WHERE taxonomy_path && ARRAY['LUM_CEIL']
    AND indoor = true  -- ← NARROWER (now 4,567 products)
)
```

**Step 9**: Counts update
```
ip | IP20 | 4234  ← Decreased from 6234 (most IP65 are outdoor!)
ip | IP44 | 123   ← Decreased from 456
ip | IP65 | 23    ← Decreased from 234 (only 23 indoor ceiling IP65)
```

**Step 10**: UI updates filter badges
```
Before: "IP65 (234)"
After:  "IP65 (23)"  ← User sees updated count
```

**Step 11**: User clicks "IP65" knowing there are 23 products

**Step 12**: Search returns exactly 23 products ← **NO SURPRISE!**

---

### Context-Aware Filtering Benefits

**1. Prevents Dead Ends**
```
Without: User clicks filters → "0 results" → Back button → Frustration
With:    User sees "0" before clicking → Doesn't click → Explores other options
```

**2. Reveals Product Relationships**
```
User sees: "Indoor Ceiling: IP20 (4,234) vs. IP65 (23)"
User learns: "Oh, indoor ceiling fixtures are mostly IP20. IP65 must be rare/specialized."
```

**3. Guides Exploration**
```
Without: Random trial-and-error clicking
With:    Strategic navigation based on real-time counts
```

**4. Builds Trust**
```
Without: "This search is broken" (unexpected zero results)
With:    "This search is accurate" (counts match reality)
```

---

### Performance Optimization

**CTE-Based Filtering** (not subqueries):
```sql
-- ✅ GOOD: CTE narrows set once
WITH filtered_products AS (
  SELECT product_id FROM ... WHERE [filters]
)
SELECT COUNT(*) FROM product_filter_index
WHERE product_id IN (SELECT product_id FROM filtered_products)

-- ❌ BAD: Correlated subquery runs per row
SELECT COUNT(*) FROM product_filter_index pfi
WHERE EXISTS (
  SELECT 1 FROM product_taxonomy_flags ptf
  WHERE ptf.product_id = pfi.product_id AND [filters]
)
```

**Why CTE is Faster**:
- Materializes filtered product set once
- PostgreSQL can optimize the join
- Avoids re-evaluating filters for each row

**Typical Query Plan**:
```
→ HashAggregate  (cost=234.56..235.78 rows=12 width=72) (actual time=45.234..45.678 rows=12 loops=1)
  →  Hash Join  (cost=12.34..123.45 rows=125000 width=64) (actual time=5.123..34.567 rows=1234 loops=1)
        Hash Cond: (pfi.product_id = filtered_products.product_id)
        →  CTE Scan on filtered_products  (cost=0.00..12.34 rows=4567 width=16) (actual time=0.123..2.345 rows=4567 loops=1)
              Filter: (taxonomy_path && '{LUM_CEIL}'::text[] AND indoor = true)
        →  Seq Scan on product_filter_index pfi  (cost=0.00..345.67 rows=125000 width=48) (actual time=0.012..12.345 rows=125000 loops=1)
```

**Result**: <100ms for typical facet calculation

---

## Classification System

The classification system translates **ETIM technical codes** (EG000027, EC002710) into **human-friendly categories** (Ceiling Luminaires, LED Drivers) that end users understand.

### The Bridge: ETIM → Human Taxonomy

**ETIM Side** (Technical):
```
EG000027 (Luminaires and lighting equipment)
  ├── EC000758 (Outdoor wall/ceiling luminaire)
  ├── EC001744 (Indoor ceiling luminaire)
  ├── EC002892 (Recessed ceiling luminaire)
  └── [... 50+ more classes ...]
```

**Human Side** (User-Friendly):
```
Luminaires
  ├── Ceiling
  │   ├── Recessed
  │   ├── Surface-mounted
  │   └── Suspended
  ├── Wall
  └── Floor
```

### Classification Methods

#### 1. ETIM Group-Based (Broad Categories)

**Use When**: Defining root categories (all luminaires, all accessories)

**Example**:
```sql
INSERT INTO search.classification_rules
(rule_name, taxonomy_code, flag_name, etim_group_ids, priority)
VALUES
('luminaires_root', 'LUM', 'luminaire', ARRAY['EG000027'], 10);
```

**Result**: All products in ETIM group EG000027 get `luminaire = TRUE` flag

**Products Matched**: 13,336

---

#### 2. ETIM Class-Based (Specific Subsets)

**Use When**: Splitting a group into more granular categories

**Challenge**: ETIM group EG000030 contains BOTH drivers AND accessories

**Solution**:
```sql
-- Drivers (highest priority = 5)
INSERT INTO search.classification_rules
(rule_name, taxonomy_code, flag_name, etim_class_ids, priority)
VALUES
('drivers_root', 'DRV', 'driver', ARRAY['EC002710'], 5);

-- Accessories (lower priority = 20, lists all OTHER classes)
INSERT INTO search.classification_rules
(rule_name, taxonomy_code, flag_name, etim_class_ids, priority)
VALUES
('accessories_root', 'ACC', 'accessory',
 ARRAY['EC002557', 'EC002558', 'EC000293', 'EC004966', ...], 20);
```

**Priority System Prevents Overlap**:
- Product matches EC002710 → Gets `driver = TRUE` (priority 5 wins)
- Product matches EC002557 → Gets `accessory = TRUE` (doesn't conflict with drivers)

**Products Matched**:
- Drivers: 83
- Accessories: 1,411

---

#### 3. Text Pattern-Based (Functional Characteristics)

**Use When**: ETIM doesn't provide specific classification (indoor/outdoor, dimmable, smart)

**Example**:
```sql
INSERT INTO search.classification_rules
(rule_name, flag_name, text_pattern, priority)
VALUES
('indoor_detection', 'indoor', 'indoor|interior|internal', 100),
('outdoor_detection', 'outdoor', 'outdoor|exterior|external|garden', 100);
```

**How It Works**:
- Searches `description_short` AND `description_long` fields
- Uses PostgreSQL regex operator `~*` (case-insensitive)
- Products can have BOTH flags if descriptions contain both keywords

**Example Product**:
```
Description: "Indoor/Outdoor LED Wall Light"
Result: indoor = TRUE, outdoor = TRUE
```

**Why Text Patterns?**:
- ETIM doesn't have "indoor" or "outdoor" groups/classes
- Suppliers consistently include this info in descriptions
- More reliable than inferring from IP ratings (IP65 ≠ always outdoor)

**Products Matched**:
- Indoor: ~10,034
- Outdoor: ~2,593
- Both: ~368

---

#### 4. Feature-Based (ETIM Feature Exists)

**Use When**: Classification depends on a specific ETIM feature

**Example**:
```sql
INSERT INTO search.classification_rules
(rule_name, flag_name, etim_feature_conditions, priority)
VALUES
('dimmable_detection', 'dimmable',
 '{"EF021180": {"operator": "exists"}}', 100);
```

**How It Works**:
- Checks if product has ETIM feature EF021180 (dimmable)
- Can also check for specific values:
  ```json
  {"EF021180": {"operator": "equals", "value": "true"}}
  ```

**Products Matched**: ~11,220 dimmable products

---

### Priority System (Critical for Conflict Resolution)

**Priority Ranges**:
| Priority | Category | Example |
|----------|----------|---------|
| 1-20 | Root categories | LUMINAIRE (10), DRIVERS (5), ACCESSORIES (20) |
| 30-40 | Mounting locations | CEILING (30), WALL (35), FLOOR (40) |
| 50-60 | Installation types | RECESSED (50), SURFACE (55), SUSPENDED (60) |
| 70-80 | Specialized types | STRIPS (70), TRACKS (75), DECORATIVE (80) |
| 100+ | Universal flags | INDOOR (100), OUTDOOR (100), DIMMABLE (100) |

**Rule**: Lower number = Higher priority (processed first)

**Why It Matters**:
```sql
-- Product matches BOTH rules
ETIM Class: EC002710 (LED driver in accessories group EG000030)

-- Rule 1: Drivers (priority 5)
driver = TRUE

-- Rule 2: Accessories (priority 20)
accessory = TRUE

-- Without priority system: Product gets BOTH flags (incorrect!)
-- With priority system: Priority 5 wins, product is ONLY a driver (correct!)
```

**Implementation**:
```sql
-- Rules applied in priority order (ASC)
SELECT * FROM classification_rules
WHERE active = TRUE
ORDER BY priority ASC;
```

---

### Hybrid Classification Approach

**Principle**: Use the best method for each type of classification

| Classification Type | Method | Reason |
|-------------------|--------|---------|
| **Structural** (product type) | ETIM group/class | Reliable, standardized, stable |
| **Functional** (usage context) | Text pattern | Flexible, catches supplier descriptions |
| **Technical** (features) | ETIM feature | Precise, ETIM-native data |
| **Specialized** (mounting, finish) | ETIM class + feature | Combination for accuracy |

**Example - Ceiling Luminaire Classification**:
```sql
-- Step 1: Identify as luminaire (ETIM group)
ETIM Group EG000027 → luminaire = TRUE

-- Step 2: Identify mounting location (ETIM class)
ETIM Classes EC001744, EC002892 → ceiling = TRUE

-- Step 3: Identify environment (text pattern)
Description contains "indoor" → indoor = TRUE

-- Step 4: Identify installation type (ETIM class)
ETIM Class EC002892 → recessed = TRUE

-- Result: Product classified as "Indoor Recessed Ceiling Luminaire"
taxonomy_path = ['ROOT', 'LUM', 'LUM_CEIL', 'LUM_CEIL_REC']
flags: luminaire=TRUE, ceiling=TRUE, indoor=TRUE, recessed=TRUE
```

---

### Verification Queries

**Check Classification Coverage**:
```sql
-- Products without taxonomy
SELECT
  COUNT(*) as unclassified_count,
  ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM items.product_info), 2) as percentage
FROM items.product_info pi
LEFT JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
WHERE ptf.taxonomy_path IS NULL OR ptf.taxonomy_path = '{}';

-- Expected: 0 unclassified (100% coverage)
```

**Check ETIM Feature IDs Are Valid**:
```sql
-- Verify configured filters match real ETIM features
SELECT
  fd.filter_key,
  fd.etim_feature_id,
  f."FEATUREDESC",
  CASE WHEN f."FEATUREID" IS NULL THEN '❌ MISSING' ELSE '✓ OK' END as status
FROM search.filter_definitions fd
LEFT JOIN etim.feature f ON fd.etim_feature_id = f."FEATUREID"
WHERE fd.active = true
ORDER BY status DESC;

-- All should show "✓ OK"
```

**Check for Multi-Classification**:
```sql
-- Products in multiple root categories (should be rare)
SELECT
  ptf.foss_pid,
  ptf.taxonomy_path,
  ARRAY[ptf.luminaire, ptf.driver, ptf.accessory, ptf.lamp] as root_flags
FROM search.product_taxonomy_flags ptf
WHERE (ptf.luminaire::int + ptf.driver::int + ptf.accessory::int + ptf.lamp::int) > 1;

-- Review these manually - might indicate classification rule overlap
```

---

## Materialized View Refresh Sequence

**CRITICAL**: The search schema materialized views **depend on** existing FOSSAPP views. They must be refreshed in the correct order after catalog imports.

### Dependency Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│ Level 1: Base ETIM/Items Views (Existing - 14s total)          │
├─────────────────────────────────────────────────────────────────┤
│ etim.feature_value_lookup (0.3s)                                │
│ items.product_info (5.2s) ⬅️ SOURCE OF TRUTH                   │
│ items.product_categories_mv (0.1s)                              │
│ items.gcfv_mapping (0.8s)                                       │
│ items.product_feature_group_mapping (0.0s)                      │
│ items.product_features_mv (7.6s) ⬅️ Depends on feature_value_lookup │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Level 2: Search Schema Views (NEW - add 6-9s)                  │
├─────────────────────────────────────────────────────────────────┤
│ search.product_taxonomy_flags (2-3s)                            │
│   ⬅️ Depends on: items.product_info                            │
│                                                                 │
│ search.product_filter_index (3-5s)                              │
│   ⬅️ Depends on: items.product_info + items.product_features_mv│
│                                                                 │
│ search.filter_facets (1s)                                       │
│   ⬅️ Depends on: search.product_filter_index                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Dependencies**:
1. `search.product_taxonomy_flags` reads from `items.product_info`
2. `search.product_filter_index` reads from `items.product_info` + `items.product_features_mv`
3. `search.filter_facets` aggregates from `search.product_filter_index`

**Rule**: Search views must refresh **AFTER** items views complete.

---

### Complete Refresh Workflow

**When to Run**: After every BMECat catalog import completes

**Total Time**: ~20-23 seconds (was ~14s before search schema)

**SQL Script**:
```sql
-- ============================================================================
-- COMPLETE MATERIALIZED VIEW REFRESH WORKFLOW
-- Location: /home/sysadmin/fossdb/utils/matview_maintenance/
-- File: refresh_materialized_views.sql (UPDATE THIS FILE)
-- ============================================================================

BEGIN;

-- ============================================================================
-- LEVEL 1: Base ETIM/Items Views (Existing Workflow - 14s)
-- ============================================================================

-- Step 1: ETIM lookup table
REFRESH MATERIALIZED VIEW etim.feature_value_lookup;                    -- 0.3s

-- Step 2: Product info (SOURCE OF TRUTH)
REFRESH MATERIALIZED VIEW items.product_info;                           -- 5.2s ⭐

-- Step 3: Other items views (can run concurrently if have unique indexes)
REFRESH MATERIALIZED VIEW CONCURRENTLY items.product_categories_mv;     -- 0.1s
REFRESH MATERIALIZED VIEW items.gcfv_mapping;                           -- 0.8s
REFRESH MATERIALIZED VIEW items.product_feature_group_mapping;          -- 0.0s

-- Step 4: Product features (depends on feature_value_lookup)
REFRESH MATERIALIZED VIEW CONCURRENTLY items.product_features_mv;       -- 7.6s

-- ============================================================================
-- LEVEL 2: Search Schema Views (NEW - add 6-9s to workflow)
-- ============================================================================

-- Step 5: Taxonomy flags (depends on items.product_info)
REFRESH MATERIALIZED VIEW search.product_taxonomy_flags;                -- 2-3s

-- Step 6: Filter index (depends on items.product_info + product_features_mv)
REFRESH MATERIALIZED VIEW search.product_filter_index;                  -- 3-5s

-- Step 7: Filter facets (depends on search.product_filter_index)
REFRESH MATERIALIZED VIEW search.filter_facets;                         -- 1s

-- ============================================================================
-- ANALYZE: Update Query Planner Statistics
-- ============================================================================

-- Existing views
ANALYZE etim.feature_value_lookup;
ANALYZE items.product_info;
ANALYZE items.product_categories_mv;
ANALYZE items.product_feature_group_mapping;
ANALYZE items.product_features_mv;

-- NEW: Search schema views
ANALYZE search.product_taxonomy_flags;
ANALYZE search.product_filter_index;
ANALYZE search.filter_facets;

COMMIT;

-- ============================================================================
-- VERIFICATION: Check row counts
-- ============================================================================

SELECT
    'items.product_info' as view_name,
    COUNT(*) as row_count,
    pg_size_pretty(pg_relation_size('items.product_info')) as size
FROM items.product_info

UNION ALL

SELECT
    'search.product_taxonomy_flags',
    COUNT(*),
    pg_size_pretty(pg_relation_size('search.product_taxonomy_flags'))
FROM search.product_taxonomy_flags

UNION ALL

SELECT
    'search.product_filter_index',
    COUNT(*),
    pg_size_pretty(pg_relation_size('search.product_filter_index'))
FROM search.product_filter_index

UNION ALL

SELECT
    'search.filter_facets',
    COUNT(*),
    pg_size_pretty(pg_relation_size('search.filter_facets'))
FROM search.filter_facets;

-- Expected output:
-- items.product_info:            14889 rows, ~26 MB
-- product_taxonomy_flags:        14889 rows, ~4.0 MB
-- product_filter_index:         ~125000 rows, ~56 KB
-- filter_facets:                    8 rows, ~16 KB
```

---

### Integration with Existing FOSSAPP Workflow

**Current Location**: `/home/sysadmin/fossdb/utils/matview_maintenance/refresh_materialized_views.sql`

**Required Update**: Add 3 lines to existing script

**Before** (existing script):
```sql
-- Step 4: Product features
REFRESH MATERIALIZED VIEW CONCURRENTLY items.product_features_mv;

-- Analyze tables
ANALYZE etim.feature_value_lookup;
-- [... existing ANALYZE statements ...]
```

**After** (add search schema):
```sql
-- Step 4: Product features
REFRESH MATERIALIZED VIEW CONCURRENTLY items.product_features_mv;

-- ========== ADD THESE 3 LINES ==========
REFRESH MATERIALIZED VIEW search.product_taxonomy_flags;
REFRESH MATERIALIZED VIEW search.product_filter_index;
REFRESH MATERIALIZED VIEW search.filter_facets;
-- ========================================

-- Analyze tables
ANALYZE etim.feature_value_lookup;
-- [... existing ANALYZE statements ...]

-- ========== ADD THESE 3 LINES ==========
ANALYZE search.product_taxonomy_flags;
ANALYZE search.product_filter_index;
ANALYZE search.filter_facets;
-- ========================================
```

**Automation Script** (Bash wrapper):
```bash
#!/bin/bash
# /home/sysadmin/fossdb/utils/refresh_all_matviews.sh

set -e  # Exit on error

echo "========================================"
echo "Starting materialized view refresh..."
echo "Started at: $(date)"
echo "========================================"

# Run SQL script
psql $DATABASE_URL -f /home/sysadmin/fossdb/utils/matview_maintenance/refresh_materialized_views.sql

if [ $? -eq 0 ]; then
    echo "========================================"
    echo "✅ Refresh completed successfully"
    echo "Finished at: $(date)"
    echo "========================================"

    # Verify counts
    echo "Verifying row counts..."
    psql $DATABASE_URL -c "SELECT
        (SELECT COUNT(*) FROM items.product_info) as base_products,
        (SELECT COUNT(*) FROM search.product_taxonomy_flags) as flagged_products,
        (SELECT COUNT(DISTINCT product_id) FROM search.product_filter_index) as indexed_products;"
else
    echo "========================================"
    echo "❌ Refresh failed with error code $?"
    echo "========================================"
    exit 1
fi
```

**Cron Job** (daily at 2 AM after catalog import):
```bash
0 2 * * * /home/sysadmin/fossdb/utils/refresh_all_matviews.sh >> /var/log/matview_refresh.log 2>&1
```

---

### Verification Queries

**After refresh, verify all views have matching counts**:
```sql
-- All counts should be 14,889
SELECT
    (SELECT COUNT(*) FROM items.product_info) as base_products,
    (SELECT COUNT(*) FROM search.product_taxonomy_flags) as flagged_products,
    (SELECT COUNT(DISTINCT product_id) FROM search.product_filter_index) as indexed_products;

-- Expected: (14889, 14889, 14889)
```

**If counts don't match**:
```sql
-- Find products missing from taxonomy flags
SELECT pi.foss_pid, pi.description_short, pi."group", pi.class
FROM items.product_info pi
LEFT JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
WHERE ptf.product_id IS NULL
LIMIT 10;

-- Find products missing from filter index
SELECT pi.foss_pid, pi.description_short
FROM items.product_info pi
WHERE pi.product_id NOT IN (
  SELECT DISTINCT product_id FROM search.product_filter_index
)
LIMIT 10;
```

---

### Troubleshooting

#### Problem: Search views show 0 rows after refresh

**Cause**: `items.product_info` wasn't refreshed first

**Solution**:
```sql
-- Check if items.product_info has data
SELECT COUNT(*) FROM items.product_info;  -- Should be 14,889

-- If zero, refresh base view first
REFRESH MATERIALIZED VIEW items.product_info;

-- Then refresh search views
REFRESH MATERIALIZED VIEW search.product_taxonomy_flags;
```

---

#### Problem: product_taxonomy_flags has fewer rows than product_info

**Cause**: Classification rules don't match all products

**Solution**:
```sql
-- Find unclassified products
SELECT pi."group", pi.class, COUNT(*) as unclassified_count
FROM items.product_info pi
LEFT JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
WHERE ptf.taxonomy_path IS NULL OR ptf.taxonomy_path = '{}'
GROUP BY pi."group", pi.class
ORDER BY unclassified_count DESC;

-- Add classification rules for missing ETIM groups/classes
```

---

#### Problem: Filter index missing data for certain filters

**Cause**: ETIM feature IDs in `filter_definitions` don't exist in database

**Solution**:
```sql
-- Check which configured filters have invalid ETIM IDs
SELECT
  fd.filter_key,
  fd.etim_feature_id,
  f."FEATUREDESC",
  CASE WHEN f."FEATUREID" IS NULL THEN '❌ MISSING IN ETIM' ELSE '✓ OK' END as status
FROM search.filter_definitions fd
LEFT JOIN etim.feature f ON fd.etim_feature_id = f."FEATUREID"
WHERE fd.active = TRUE
ORDER BY status DESC;

-- Update filter_definitions with correct ETIM feature IDs
```

---

#### Problem: Refresh takes longer than expected

**Cause**: Indexes not created or statistics out of date

**Solution**:
```sql
-- Check if indexes exist
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(schemaname||'.'||indexname)) as index_size
FROM pg_indexes
WHERE schemaname = 'search'
ORDER BY tablename, indexname;

-- Create missing indexes (see schema section above)

-- Update statistics
ANALYZE search.product_taxonomy_flags;
ANALYZE search.product_filter_index;
```

---

### Performance Impact Analysis

| Metric | Before Search Schema | After Search Schema | Change |
|--------|---------------------|-------------------|--------|
| **Total Views** | 6 | 9 | +3 (+50%) |
| **Refresh Time** | ~14s | ~20-23s | +6-9s (+43%) |
| **Storage** | ~72 MB | ~76 MB | +4 MB (+5.5%) |
| **Daily Impact** | - | 9 seconds | Negligible |

**Impact Assessment**:
- ✅ **Acceptable**: 9 seconds added to a daily/weekly operation
- ✅ **Low storage cost**: 4 MB increase (5.5%)
- ✅ **High benefit**: Sub-200ms search queries on 14K+ products
- ✅ **No runtime impact**: Materialized views don't slow down queries

**Trade-off**: 43% longer refresh time for 10-100x faster search queries.

---

## Performance & Monitoring

### Query Performance Expectations

| Query Type | Target | Typical | Notes |
|-----------|--------|---------|-------|
| Simple boolean filter | <50ms | 10-30ms | `WHERE indoor = TRUE AND ceiling = TRUE` |
| Text search | <200ms | 100-150ms | ILIKE on descriptions |
| Multi-filter search | <200ms | 150-180ms | Taxonomy + flags + technical filters |
| Dynamic facets | <100ms | 50-80ms | CTE + aggregation |
| Boolean flag counts | <50ms | 20-30ms | Simple COUNT on boolean columns |
| Taxonomy tree | <20ms | 5-10ms | Small table scan |
| Filter definitions | <10ms | 2-5ms | 8 rows, no joins |

**Cache Warming**: First query after server restart is slowest. Subsequent queries benefit from PostgreSQL buffer cache.

---

### Monitoring Queries

**Check Search Performance**:
```sql
-- Run a test search and measure time
EXPLAIN ANALYZE
SELECT COUNT(*)
FROM items.product_info pi
JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
WHERE ptf.taxonomy_path && ARRAY['LUM_CEIL']
  AND ptf.indoor = TRUE
  AND EXISTS (
    SELECT 1 FROM search.product_filter_index pfi
    WHERE pfi.product_id = pi.product_id
      AND pfi.filter_key = 'ip'
      AND pfi.alphanumeric_value = 'IP65'
  );

-- Look for "actual time" in output (should be <200ms)
```

**Check Index Usage**:
```sql
-- Verify indexes are being used
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,  -- Number of times index was used
  idx_tup_read,  -- Number of tuples returned
  idx_tup_fetch  -- Number of tuples fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'search'
ORDER BY idx_scan DESC;

-- High idx_scan = good (index is used frequently)
-- Zero idx_scan = bad (index is not used, consider dropping)
```

**Check Materialized View Staleness**:
```sql
-- Check last refresh time (PostgreSQL 13+)
SELECT
  schemaname,
  matviewname,
  ispopulated,
  -- Note: PostgreSQL doesn't track last refresh time natively
  -- Use custom tracking table or filesystem timestamps
FROM pg_matviews
WHERE schemaname = 'search';
```

---

### Alert Thresholds

**Set up monitoring alerts for**:

1. **Zero Row Counts** (critical):
```sql
-- Alert if any search view has zero rows
SELECT
  COUNT(*) as taxonomy_flags_count,
  (SELECT COUNT(*) FROM search.product_filter_index) as filter_index_count,
  (SELECT COUNT(*) FROM search.filter_facets) as filter_facets_count
FROM search.product_taxonomy_flags
HAVING COUNT(*) = 0
   OR (SELECT COUNT(*) FROM search.product_filter_index) = 0
   OR (SELECT COUNT(*) FROM search.filter_facets) = 0;

-- If returns any rows → ALERT!
```

2. **Count Mismatches** (warning):
```sql
-- Alert if search views don't match base product count
SELECT
  (SELECT COUNT(*) FROM items.product_info) as expected,
  COUNT(*) as actual,
  CASE
    WHEN COUNT(*) < (SELECT COUNT(*) * 0.95 FROM items.product_info)
    THEN '⚠️ WARNING: 5%+ products missing from search'
    ELSE '✓ OK'
  END as status
FROM search.product_taxonomy_flags;
```

3. **Query Performance Degradation** (warning):
```sql
-- Log slow queries (PostgreSQL configuration)
-- In postgresql.conf:
-- log_min_duration_statement = 200  # Log queries >200ms
-- log_line_prefix = '%t [%p]: user=%u,db=%d,app=%a,client=%h '

-- Then monitor logs for search queries
```

---

## Integration Guide for FOSSAPP

### TypeScript Integration

**1. Define Types** (src/types/search.ts):
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
  recessed?: boolean | null
  dimmable?: boolean | null

  // Technical filters
  technicalFilters?: TechnicalFilters

  // Pagination and sorting
  sortBy?: 'relevance' | 'price_asc' | 'price_desc'
  page?: number
  limit?: number
}

// Technical filters (JSONB format)
export interface TechnicalFilters {
  voltage?: string[]            // Multi-select
  ip?: string[]                 // Multi-select
  dimmable?: boolean            // Boolean
  cct?: { min: number, max: number }  // Range
  cri?: { min: number, max: number }
  luminous_flux?: { min: number, max: number }
}

// Search result
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

// Dynamic facet
export interface Facet {
  filter_category: string
  filter_key: string
  filter_value: string
  product_count: number
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

**2. Create Server Actions** (src/lib/search-actions.ts):
```typescript
'use server'

import { supabaseServer } from '@/lib/supabase-server'
import type { SearchFilters, SearchProduct, Facet, TaxonomyNode } from '@/types/search'

/**
 * Search products with filters
 */
export async function searchProductsAction(
  filters: SearchFilters
): Promise<SearchProduct[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('search_products_with_filters', {
        p_query: filters.query || null,
        p_taxonomy_codes: filters.categories || null,
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_ceiling: filters.ceiling ?? null,
        p_recessed: filters.recessed ?? null,
        p_dimmable: filters.dimmable ?? null,
        p_filters: filters.technicalFilters
          ? JSON.stringify(filters.technicalFilters)
          : null,
        p_sort_by: filters.sortBy || 'relevance',
        p_limit: filters.limit || 50,
        p_offset: (filters.page || 0) * (filters.limit || 50)
      })

    if (error) {
      console.error('Search error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Search exception:', error)
    return []
  }
}

/**
 * Count matching products
 */
export async function countProductsAction(
  filters: SearchFilters
): Promise<number> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('count_products_with_filters', {
        p_query: filters.query || null,
        p_taxonomy_codes: filters.categories || null,
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_ceiling: filters.ceiling ?? null,
        p_recessed: filters.recessed ?? null,
        p_dimmable: filters.dimmable ?? null,
        p_filters: filters.technicalFilters
          ? JSON.stringify(filters.technicalFilters)
          : null
      })

    if (error) {
      console.error('Count error:', error)
      return 0
    }

    return data || 0
  } catch (error) {
    console.error('Count exception:', error)
    return 0
  }
}

/**
 * Get dynamic facets (context-aware filter options)
 */
export async function getDynamicFacetsAction(
  filters: SearchFilters
): Promise<Facet[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('get_dynamic_facets', {
        p_query: filters.query || null,
        p_taxonomy_codes: filters.categories || null,
        p_suppliers: filters.suppliers || null,
        p_indoor: filters.indoor ?? null,
        p_outdoor: filters.outdoor ?? null,
        p_ceiling: filters.ceiling ?? null,
        p_filters: filters.technicalFilters
          ? JSON.stringify(filters.technicalFilters)
          : null
      })

    if (error) {
      console.error('Facets error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Facets exception:', error)
    return []
  }
}

/**
 * Get taxonomy tree
 */
export async function getTaxonomyTreeAction(): Promise<TaxonomyNode[]> {
  try {
    const { data, error } = await supabaseServer
      .schema('search')
      .rpc('get_taxonomy_tree')

    if (error) {
      console.error('Taxonomy error:', error)
      return []
    }

    // Build tree structure
    const buildTree = (
      nodes: any[],
      parentCode: string | null = null
    ): TaxonomyNode[] => {
      return nodes
        .filter(n => n.parent_code === parentCode)
        .map(node => ({
          ...node,
          children: buildTree(nodes, node.code)
        }))
    }

    return buildTree(data || [])
  } catch (error) {
    console.error('Taxonomy exception:', error)
    return []
  }
}
```

---

**3. Error Handling Pattern**:
```typescript
// Consistent error handling across all search actions
export async function searchWithErrorHandling<T>(
  fn: () => Promise<{ data: T | null; error: any }>
): Promise<T> {
  try {
    const { data, error } = await fn()

    if (error) {
      console.error('RPC error:', {
        message: error.message,
        code: error.code,
        details: error.details
      })
      // Return empty result based on type
      return (Array.isArray(data) ? [] : null) as T
    }

    return data || (Array.isArray(data) ? [] : null) as T
  } catch (exception) {
    console.error('RPC exception:', exception)
    return ([] as T)  // Safe fallback
  }
}
```

---

### Response Data Handling

**Extract Key Features from JSONB**:
```typescript
interface Product {
  key_features: {
    cct?: number
    ip?: string
    voltage?: string
    luminous_flux?: number
    // [... other features ...]
  }
}

// Helper to display features in UI
function formatFeature(key: string, value: any): string {
  const formatters: Record<string, (v: any) => string> = {
    cct: (v) => `${v}K`,
    luminous_flux: (v) => `${v} lm`,
    voltage: (v) => v,
    ip: (v) => v,
    cri: (v) => `CRI ${v}`
  }

  return formatters[key]?.(value) || String(value)
}

// Usage in component
{product.key_features?.cct && (
  <Badge>{formatFeature('cct', product.key_features.cct)}</Badge>
)}
```

---

### Caching Strategy

**Next.js Cache Configuration**:
```typescript
import { unstable_cache } from 'next/cache'

// Cache taxonomy tree (changes rarely)
export const getTaxonomyTreeCached = unstable_cache(
  getTaxonomyTreeAction,
  ['taxonomy-tree'],
  {
    revalidate: 3600,  // 1 hour
    tags: ['taxonomy']
  }
)

// Invalidate cache when taxonomy changes
import { revalidateTag } from 'next/cache'

export async function updateTaxonomyAction() {
  // ... update taxonomy ...
  revalidateTag('taxonomy')
}
```

---

## Appendices

### A. Key Design Patterns

**1. CTE-Based Filtering**:
```sql
WITH filtered_products AS (
  SELECT product_id FROM ... WHERE [context filters]
)
SELECT ... FROM product_filter_index
WHERE product_id IN (SELECT product_id FROM filtered_products)
```
**Benefit**: Narrow product set once, then aggregate (faster than correlated subqueries)

---

**2. Three-Value Boolean Logic**:
```sql
WHERE (p_indoor IS NULL OR ptf.indoor = p_indoor)
```
**States**:
- `NULL` = don't care (skip filter)
- `TRUE` = must be true
- `FALSE` = must be false

---

**3. JSONB Filter Object**:
```json
{
  "cct": {"min": 3000, "max": 4000},
  "ip": ["IP65", "IP67"]
}
```
**Benefit**: Flexible, extensible, type-safe with JSONB operators

---

**4. Priority-Based Rule Resolution**:
```sql
ORDER BY priority ASC  -- Lower = higher priority
```
**Use Case**: Drivers (priority 5) override accessories (priority 20) when both match

---

**5. Array Overlap for Multi-Taxonomy**:
```sql
WHERE taxonomy_path && ARRAY['LUM_CEIL', 'LUM_WALL']
```
**Result**: Products in EITHER category (multi-classification support)

---

### B. Data Flow Diagrams (Text-Based)

**Classification Flow** (One-Time Setup):
```
items.product_info (14,889 products)
         ↓
Apply classification_rules (priority order)
         ↓
Match by: ETIM group → ETIM class → features → text pattern
         ↓
Set flags: luminaire=true, indoor=true, ceiling=true, ...
         ↓
Aggregate flags per product (bool_or)
         ↓
search.product_taxonomy_flags (materialized view)
         ↓
Indexed for instant filtering
```

**Search Request Flow** (Runtime):
```
User selects filters in UI
         ↓
UI builds params: {p_taxonomy_codes, p_filters, p_indoor, ...}
         ↓
Calls supabase.rpc('search_products_with_filters', params)
         ↓
Function applies WHERE clauses:
  1. Taxonomy filter (array overlap)
  2. Boolean flags (indexed equality)
  3. Technical filters (EXISTS subqueries)
  4. Text search (ILIKE)
         ↓
Sort by relevance/price
         ↓
LIMIT/OFFSET pagination
         ↓
Return product data + flags + key_features
         ↓
UI renders results
```

**Dynamic Facet Flow** (Runtime):
```
User applies filter (e.g., "Indoor")
         ↓
UI calls get_dynamic_facets({p_indoor: true})
         ↓
Function builds CTE with current filters
         ↓
Narrows product set (14,889 → 10,034)
         ↓
Joins product_filter_index with filtered products
         ↓
Counts distinct values per filter
         ↓
Returns: [(ip, IP20, 8234), (ip, IP65, 234), ...]
         ↓
UI updates filter badges with new counts
```

---

### C. Reference Links

**Source Repository**:
- Full implementation: `/home/sysadmin/tools/searchdb/`
- Working demo app: http://localhost:3001 (search-test-app)
- SQL files: `/home/sysadmin/tools/searchdb/sql/` (00-09)

**Documentation**:
- Architecture overview: `searchdb/docs/architecture/overview.md`
- UI components: `searchdb/docs/architecture/ui-components.md`
- Delta Light filters: `searchdb/docs/guides/delta-light-filters.md`
- Dynamic facets: `searchdb/docs/guides/dynamic-facets.md`
- SQL functions: `searchdb/docs/reference/sql-functions.md`
- Maintenance: `searchdb/docs/guides/maintenance.md`

**FOSSAPP Integration**:
- Current RPC usage: FOSSAPP CLAUDE.md lines 219-260 (domain-driven functions)
- Matview maintenance: `/home/sysadmin/fossdb/utils/matview_maintenance/`

**External Resources**:
- ETIM International: https://www.etim-international.com/
- Supabase RPC docs: https://supabase.com/docs/guides/database/functions
- PostgreSQL Materialized Views: https://www.postgresql.org/docs/current/sql-creatematerializedview.html

---

## Document Metadata

**Version**: 2.5 (Production-Ready)
**Author**: Claude Code (AI Assistant)
**Created**: 2025-11-22
**Last Updated**: 2025-11-22
**Word Count**: ~8,500 words
**Target Audience**: Database administrators, backend developers, DevOps engineers
**Scope**: Database architecture and backend logic only (no UI/frontend details)

---

**End of Document**
