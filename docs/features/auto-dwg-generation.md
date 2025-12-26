# Auto DWG Generation - Study & Roadmap

**Branch:** `auto-dwg-study`
**Created:** 2024-12-24
**Status:** Planning Phase

> **Note:** This is a living document. The plan WILL evolve as we implement.
> If something doesn't work or proves too complex, we pivot and find alternatives.
> Each phase is a hypothesis to validate, not a fixed requirement.

---

## Vision

When a lighting design project is complete, the user presses **"Generate Light Design DWG"** and receives a professional DWG file in their Google Drive containing:

- **Model Space:** Floor plan with luminaire symbols (A1, B1, C1...) at placed positions
- **Paper Space:** Table with product tiles (photos, drawings, specs) keyed to symbols

---

## The Symbol Code System

```
Symbol = Category Letter + Sequence Number
         ───────────────   ───────────────
         A, B, C...        1, 2, 3...
         (product type)    (per project/area)

Example: "A3" = 3rd Interior Spot model in this area
```

### Category Letters (from CSV proposal)

| Code | Category | ETIM Class | Condition |
|------|----------|------------|-----------|
| A | Interior Spots | EC001744 | IP < 65 |
| B | Suspension | EC001743 | - |
| C | Exterior Spots | EC001744 | IP ≥ 65 |
| D | LED Tapes | EC002706 | IP < 67 |
| E | LED Tapes IP67 | EC002706 | IP ≥ 67 |
| F | Interior Wall | EC002892 | IP < 65 |
| G | Exterior Wall | EC002892 | IP ≥ 65 |
| H | Floor Lights | EC000300 | - |
| I | Bollards | EC000301 | - |
| J | Street/Pole | EC000062 | - |
| K | Table | EC000302 | - |
| L | Floodlights | EC001744 | TBD (beam angle?) |
| M | Profiles | EC004966 | - |
| N | Track Light | EC000101 | - |
| O | Step/Orientation | EC000481 | - |
| P | Underwater | EC000758 | IP68 |
| Q | In-ground | EC000758 | IP < 68 |
| T | Linear Systems | EC000986 | - |

**Key Features for Classification:**
- `EF003118` - IP rating (front side) - values like "IP65", "IP67"
- `EF006760` - Built-in/recessed mounting
- `EF007793` - Surface mounting
- `EF001265` - Suspended mounting

---

## Rough Implementation Phases

### Phase 1: Category Symbol Database Structure ✅
- [x] Design category rules table (`items.foss_category_rules`)
- [x] Create function to determine category from product (`items.get_foss_category()`)
- [x] Helper function for IP extraction (`items.get_product_ip_rating()`)
- [x] Add `symbol_sequence` to `projects.project_products`
- [x] Test with sample products (25,726 categorized, ~2K accessories excluded)

**Migration:** `20251224100000_add_foss_category_system.sql`

### Phase 2: Planner Symbol Display ✅
- [x] Pass symbol code through planner data flow
- [x] Update marker rendering to show "A1" instead of first letter
- [x] Symbol computed from project_products via RPC (not stored in placements)
- [x] Products panel passes symbol to placement mode

**Migration:** `20251226100000_add_planner_symbol_support.sql`

### Phase 3: Symbol Generator Integration
- [ ] Connect Symbol Generator page to use category codes
- [ ] Generate DWG blocks with symbol labels
- [ ] Store generated symbols for reuse

### Phase 4: Tiles Integration
- [ ] Link tiles to symbol codes
- [ ] Display symbol on tile preview
- [ ] Prepare tile data for paper space table

### Phase 5: LISP Script Generation
- [ ] Template for inserting symbol blocks at XY
- [ ] Template for creating paper space table
- [ ] Template for tile placement in table cells

### Phase 6: DWG Generation Pipeline
- [ ] DWT template preparation
- [ ] APS Design Automation job setup
- [ ] Assembly: floor plan + symbols + table
- [ ] Google Drive delivery

---

## Key Existing Features to Leverage

| Feature | Location | Purpose |
|---------|----------|---------|
| Planner | `/planner` | Floor plan + product XY positions |
| Tiles | `/tiles` | Assembled luminaire configurations |
| Symbol Generator | `/symbol-generator` | SVG/DWG symbol creation |
| APS Integration | `lib/planner/aps-*` | Autodesk Platform Services |
| Project Products | `projects.project_products` | Products per area/version |

---

## Database Tables Involved

- `items.product_info` - Product data with ETIM classification
- `items.product_feature` - Feature values (IP rating, mounting)
- `etim.class` - ETIM class definitions
- `etim.value` - ETIM feature values (IP20, IP65, etc.)
- `projects.project_products` - Products in projects
- `projects.project_area_versions` - Area versioning
- **NEW:** Category rules/mapping table

---

## Open Questions

1. **Floodlight (L) distinction** - How to separate from regular spots? Beam angle?
2. **Manual override** - Should users be able to change category?
3. **Paper space layout** - How many tiles per page? Format?
4. **DWT template** - What's already prepared? Title block?
5. **Multiple areas** - One DWG per area or combined?

---

## Next Session Focus

**Phase 2: Planner Symbol Display**
- Query category when loading project products
- Assign symbol_sequence per category within area
- Update planner markers to show "A1", "B2" etc.

---

## Phase 1 Results (2024-12-24)

### Category Distribution
| Code | Category | Products |
|------|----------|----------|
| A | Interior Spots | 5,393 |
| B | Suspension | 1,090 |
| C | Exterior Spots | 8,199 |
| D | LED Tapes | 56 |
| F | Interior Wall Lights | 417 |
| G | Exterior Wall Lights | 3,762 |
| H | Floor Lights | 56 |
| I | Bollards | 222 |
| J | Street / Pole Lights | 313 |
| K | Table | 17 |
| M | Profiles | 65 |
| N | Track Light | 59 |
| O | Step / Orientation Lights | 167 |
| P | Underwater | 336 |
| Q | In-ground / Landscape | 1,925 |
| T | Linear Systems | 3,938 |
| **Total** | | **26,015** |

### Uncategorized (by design)
- Accessories/spare parts: ~1,600
- LED drivers/modules: ~120
- Products missing IP rating: ~25

---

## Reference: CSV Proposal Location

`/mnt/c/Users/chris/Downloads/FOSS_Categories_Proposal - FOSS Categories.csv`
