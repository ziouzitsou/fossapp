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

### Phase 1: Category Symbol Database Structure
- [ ] Design category rules table
- [ ] Create function to determine category from product
- [ ] Add `foss_category` to product_info mat view (or separate approach)
- [ ] Add `symbol_sequence` to project_products
- [ ] Test with sample products

### Phase 2: Planner Symbol Display
- [ ] Pass symbol code through planner data flow
- [ ] Update marker rendering to show "A1" instead of first letter
- [ ] Store symbol in placements table
- [ ] UI to show symbol in product panel

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

**Database structure for product categorization:**
- Table design for category rules
- Function to evaluate rules
- Where to store category (mat view vs separate)
- Performance considerations

---

## Reference: CSV Proposal Location

`/mnt/c/Users/chris/Downloads/FOSS_Categories_Proposal - FOSS Categories.csv`
