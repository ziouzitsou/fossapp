# Feedback Assistant: LLM Knowledge Gap Analysis

**Date**: 2025-12-23
**Author**: Claude Code (deep analysis session)

## Executive Summary

After running 10 experiments against the FOSSAPP database, I've identified **critical gaps** between what users ask and what the LLM can find. The current `search_products` tool only searches 3 fields (`description_short`, `foss_pid`, `family`), missing most user-friendly terms.

---

## Experiment Results

### 1. Vocabulary Mismatch (Critical)

| User Term | description_short | description_long | class_name |
|-----------|------------------|------------------|------------|
| spotlight | 0 | - | **13,607** |
| downlight | 54 | - | **13,607** |
| wall light | 0 | - | **4,184** |
| pendant | 0 | - | **1,090** |
| track light | 0 | - | **59** |

**Problem**: Users use common terms that exist in `class_name` but NOT in `description_short`.

### 2. Technical Specs Not Searchable (Critical)

| Specification | description_short | description_long |
|---------------|------------------|------------------|
| 3000K | 0 | **6,356** |
| 4000K | 0 | **923** |
| 2700K | 0 | **4,999** |
| lumens (lm) | 114 | **25,046** |

**Problem**: CCT and lumens are in `description_long`, which isn't searched.

### 3. Application-Based Queries Fail

| User Query | Matches |
|------------|---------|
| "bathroom light" | 0 |
| "kitchen light" | 0 |
| "office lighting" | 0 |
| "outdoor" (in desc_long) | 2,453 |

**Problem**: No application/room-based classification exists.

### 4. Feature Filtering Not Available

Users ask: "dimmable IP65 downlight under €300"

Current capability:
- [x] Search "downlight" (if in description)
- [ ] Filter by IP rating (stored in features JSONB)
- [ ] Filter by dimmable (stored in features JSONB)
- [ ] Filter by price

---

## Database Structure Insights

### Where Data Lives

```
description_short  → Product names, family codes (BOXY, ENTERO, etc.)
description_long   → Technical specs (3000K, 2500lm, etc.), detailed descriptions
class_name         → ETIM categories (Downlight/spot/floodlight, Pendant luminaire)
features (JSONB)   → Structured specs (IP rating, beam angle, CRI, dimmable)
prices (JSONB)     → Pricing with discount tiers
```

### Top ETIM Classes (product counts)

1. Downlight/spot/floodlight: **13,607**
2. Ceiling-/wall luminaire: **4,184**
3. Electrical unit for light-line system: **3,692**
4. In-ground luminaire: **2,265**
5. Pendant luminaire: **1,090**

### Top Searchable Terms in Descriptions

- monospot (2,736), ecoline (1,670), entero (1,398)
- superlight (1,334), trimless (1,270), metaspot (1,194)
- wallwash (579), linear (545)

---

## Recommendations

### Priority 1: Expand Search Fields

**Current `search_products`:**
```sql
.or(`description_short.ilike.%${query}%,foss_pid.ilike.%${query}%,family.ilike.%${query}%`)
```

**Recommended:**
```sql
.or(`
  description_short.ilike.%${query}%,
  description_long.ilike.%${query}%,
  class_name.ilike.%${query}%,
  foss_pid.ilike.%${query}%,
  family.ilike.%${query}%
`)
```

**Impact**: Would enable finding 13,607 products with "spotlight", 25,046 with "lm", etc.

### Priority 2: Add Vocabulary Mapping

Create a synonym map in the knowledge base or system prompt:

```javascript
const SYNONYMS = {
  'spotlight': ['spot', 'downlight'],
  'ceiling light': ['ceiling', 'recessed', 'surface'],
  'wall light': ['wall', 'sconce', 'wall-mounted'],
  'track light': ['track', 'rail', 'light-track'],
  'pendant': ['hanging', 'suspended'],
  'outdoor': ['IP65', 'IP67', 'exterior'],
  'bathroom': ['IP44', 'IP65', 'wet'],
  'dimmable': ['DIM', 'dim5', 'dim8', 'phase'],
}
```

### Priority 3: Add Feature Filter Tool

New tool: `search_products_advanced`

```typescript
{
  name: 'search_products_advanced',
  input_schema: {
    properties: {
      query: { type: 'string' },
      ip_rating: { type: 'string', enum: ['IP20', 'IP44', 'IP54', 'IP65', 'IP67'] },
      min_lumens: { type: 'number' },
      max_price: { type: 'number' },
      dimmable: { type: 'boolean' },
      class_name: { type: 'string' }
    }
  }
}
```

### Priority 4: Improve System Prompt Knowledge

Add to the assistant's system prompt:

```markdown
## Product Vocabulary Guide

When users ask for:
- "spotlight" → search for "spot" (products use "monospot", "metaspot", etc.)
- "3000K" or "warm white" → this is in description_long, get product details
- "IP65" or "outdoor" → use the IP rating feature filter
- "downlight" → search class "Downlight/spot/floodlight"
- "pendant" → search class "Pendant luminaire"

## Common Product Families
- BOXY, ENTERO, SUPERLIGHT, MONOSPOT, FLUXA (Delta Light)
- ECOLINE, LOGIC, INFORM (Meyer Lighting)
```

---

## Quick Wins (Can implement now)

1. **Add `description_long` to search** - simple SQL change
2. **Add `class_name` to search** - simple SQL change
3. **Update knowledge-base.ts** with vocabulary mapping
4. **Add search tips to system prompt**

## Medium-term (Requires more work)

1. Feature filtering tool with JSONB queries
2. Price range filtering
3. Full-text search with PostgreSQL `tsvector`

## Long-term (Architectural)

1. Embedding-based semantic search
2. Product recommendation engine
3. Natural language to SQL translation

---

## Test Queries for Validation

After implementing changes, test these:

1. "Find me a spotlight with 2000 lumens" → Should find products
2. "Show wall lights under €200" → Should filter by price
3. "Dimmable IP65 downlights" → Should filter features
4. "What pendants do you have?" → Should search class_name
5. "Outdoor garden lighting" → Should find in-ground/bollard
6. "3000K warm white spots" → Should search description_long

---

## Appendix: Feature Distribution

| Feature | Products with Value |
|---------|-------------------|
| IP Rating | 17,771 |
| Beam Angle | 22,131 |
| Dimmable | 17,829 |
| Lumens | 25,613 |
| CRI | 25,226 |
| Housing Color | 25,356 |

| IP Rating | Count |
|-----------|-------|
| IP67 | 6,008 |
| IP65 | 5,937 |
| IP20 | 5,001 |
| IP44 | 492 |

| Price Range | Products |
|-------------|----------|
| €0-50 | 565 |
| €50-100 | 638 |
| €100-200 | 2,567 |
| €200-500 | 8,523 |
| €500-1000 | 10,651 |
| €1000+ | 5,089 |
