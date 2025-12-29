# Planner Feature

**Status**: Phase 2 (Active Development)
**Route**: `/planner`
**Last Updated**: 2025-12-29

---

## Overview

The Planner allows users to visualize and place lighting products on customer floor plans. Users upload DWG floor plans, see products assigned to each area, and place them as markers on the plan with symbol letters (A1, B2, etc.) and eventually symbol images.

**Key Concept**: Products are assigned to areas via the Project page. The Planner provides visualization and placement on actual floor plans.

---

## Core Concepts

### Project Context (Always Present)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [Project Badge: Villa Design]                              User Menu   │
├─────────────────────────────────────────────────────────────────────────┤
│ Planner (beta)              Area: [Ground Floor    ▼]                   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Current Project**: Always visible in top-left header badge
- **Current Area**: Selected via dropdown in planner header
- **Current Revision**: Each area has an active revision (products + placements)

### Hierarchy

```
Project (e.g., "Villa Design")
├── Area: Ground Floor
│   └── Revision 1 (current)
│       ├── Products: A1, A2, B1, N1...
│       ├── Floor Plan: ground.dwg
│       └── Placements: [A1 at (x,y), B1 at (x,y)...]
├── Area: First Floor
│   └── Revision 1 (current)
│       ├── Products: A3, A4, B2...
│       ├── Floor Plan: floor1.dwg
│       └── Placements: [...]
└── Area: Exterior
    └── Revision 1 (current)
        └── (no products yet)
```

---

## User Interface

### Page Layout: Area Overview (Default)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Planner (beta)              Area: [Ground Floor    ▼]      [Settings]  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  FLOOR PLAN ─────────────────────────────────────────────────────────  │
│  ┌──────────────┐                                                       │
│  │  Thumbnail   │  ground_floor.dwg  ·  2.4 MB                         │
│  │   preview    │  Uploaded: Dec 28, 2025  ·  ⚠️ 2 warnings            │
│  └──────────────┘                                                       │
│                                        [🗑️ Delete]  [🗺️ Open Planner]  │
│                                                                         │
│  PRODUCTS (6) ──────────────────────────────────────── Placed: 5 / 6   │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ A1             │  │ A2             │  │ A3             │            │
│  │ DIRO SBL 927 W │  │ DIRO SBL 927 W │  │ DIRO SBL 930 W │            │
│  │ Qty: 5         │  │ Qty: 3         │  │ Qty: 2         │            │
│  │ ● Placed (5)   │  │ ● Placed (2)   │  │ ○ Not placed   │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                         │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │ B1             │  │ B2             │  │ N1             │            │
│  │ Pendant 1200   │  │ Pendant 600    │  │ Track System   │            │
│  │ Qty: 2         │  │ Qty: 1         │  │ Qty: 1         │            │
│  │ ● Placed (2)   │  │ ○ Not placed   │  │ ○ Not placed   │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                         │
│  Symbol Summary: [A]×3  [B]×2  [N]×1                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Page Layout: Planner Mode (Graphics View)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Planner (beta)      Area: [Ground Floor ▼]     [← Back]    [Settings]  │
├─────────────────────────────────────────────────────────────────────────┤
│ ground_floor.dwg · 2.4 MB · mm    ● Unsaved        [💾 Save] [Panel ▼] │
├───────────────────────────────────────────────────┬─────────────────────┤
│                                                   │ Products            │
│                                                   ├─────────────────────┤
│                                                   │ Click to select,    │
│                                                   │ then click on plan  │
│           Floor Plan Viewer                       │                     │
│           (DWG with markers)                      │ ┌─────────────────┐ │
│                                                   │ │ ○ A1 DIRO 927   │ │
│              [A1]     [A2]                        │ │   5/5 placed    │ │
│                   [B1]                            │ └─────────────────┘ │
│                                                   │ ┌─────────────────┐ │
│                                                   │ │ ○ A2 DIRO 927   │ │
│                                                   │ │   2/3 placed    │ │
│                                                   │ └─────────────────┘ │
│                                                   │ ...                 │
│                                                   ├─────────────────────┤
│                                                   │ Placed: 12 markers  │
├───────────────────────────────────────────────────┴─────────────────────┤
│ [📏 Measure] [📐 Area] [🗑️ Clear]              [⊞ Fit] [🏠 Home]        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Navigation Flow

```
Area Overview                           Planner Mode
┌─────────────────┐                    ┌─────────────────┐
│                 │  [Open Planner]    │                 │
│  Floor plan     │ ────────────────►  │  Floor plan     │
│  thumbnail      │                    │  viewer         │
│                 │  [← Back]          │                 │
│  Products       │ ◄────────────────  │  Products       │
│  grid           │                    │  panel          │
│                 │                    │                 │
└─────────────────┘                    └─────────────────┘
        │                                      │
        │  Area dropdown                       │  Area dropdown
        ▼                                      ▼
   Switch areas                           Switch areas
   (stays in overview)                    (stays in planner)
```

---

## Symbol System

### Symbol Letters (Implemented)

Products are automatically assigned symbol letters based on ETIM classification + IP rating.

| Symbol | Category | ETIM Class | IP Condition |
|--------|----------|------------|--------------|
| **A** | Interior Spots | EC001744 | IP < 54 |
| **B** | Suspension | EC001743 | Any |
| **C** | Exterior Spots | EC001744 | IP ≥ 54 |
| **D** | LED Tapes | EC002706 | IP < 67 |
| **E** | LED Tapes IP67 | EC002706 | IP ≥ 67 |
| **F** | Interior Wall | EC002892 | IP < 54 |
| **G** | Exterior Wall | EC002892 | IP ≥ 54 |
| **H** | Floor Lights | EC000300 | Any |
| **K** | Table Lights | EC000302 | Any |
| **N** | Track Light | EC000101 | Any |
| **P** | Underwater | EC000758 | IP ≥ 67 |

**Assignment Flow:**
1. Product added to area revision
2. Database trigger calls `items.get_product_symbol(foss_pid)`
3. Returns letter code (A, B, C...) based on rules
4. Sequence number assigned per letter in revision (1, 2, 3...)
5. Combined symbol: `A1`, `A2`, `B1`, etc.

See [Symbol Classification](./symbol-classification.md) for full details.

### Symbol Images (Planned)

Each product will have a generated AutoCAD symbol image stored in Supabase.

**Generation Pipeline:**
1. Vision Analysis (Claude) - Analyze product photos/drawings
2. AutoLISP Generation (Claude) - Create drawing script
3. APS Execution - Run script in cloud AutoCAD
4. Storage - Save DWG/PNG to Supabase bucket

**Marker Display Modes:**
- **Current**: Letter labels only (A1, B2)
- **Future**: Symbol images (actual CAD graphics)

---

## Symbol Storage System

### Database Table: `items.product_symbols`

```sql
CREATE TABLE items.product_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foss_pid TEXT NOT NULL UNIQUE,           -- Immutable product identifier
  symbol_code CHAR(1),                     -- Current classification (can change)

  -- Storage paths (relative to bucket)
  dwg_path TEXT,                           -- '{foss_pid}/symbol.dwg'
  png_path TEXT,                           -- '{foss_pid}/symbol.png'
  svg_path TEXT,                           -- '{foss_pid}/symbol.svg' (optional)

  -- Generation metadata
  generated_at TIMESTAMPTZ,
  generation_model TEXT,                   -- 'claude-sonnet-4' etc.
  generation_cost_usd NUMERIC(10,4),

  -- For regeneration detection
  input_hash TEXT,                         -- Hash of dimensions + images used

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_product_symbols_foss_pid ON items.product_symbols(foss_pid);
```

**Design Decisions:**
- **Flat folder structure** by `foss_pid` (not by symbol letter)
- Symbol code is metadata only - files don't move if rules change
- `input_hash` tracks if regeneration needed (product data changed)

### Supabase Storage Bucket

```
Bucket: product-symbols/
├── DT20229692W/
│   ├── symbol.dwg          # AutoCAD 2018 format
│   ├── symbol.png          # Preview image
│   └── symbol.svg          # Web-friendly (optional)
├── DT20229693W/
│   ├── symbol.dwg
│   ├── symbol.png
│   └── symbol.svg
└── ...
```

**Access Pattern:**
```typescript
// Check if symbol exists
const { data } = await supabaseServer
  .from('product_symbols')
  .select('png_path, dwg_path')
  .eq('foss_pid', fossPid)
  .single()

if (data?.png_path) {
  // Use existing symbol
  const url = supabase.storage.from('product-symbols').getPublicUrl(data.png_path)
} else {
  // Generate new symbol (or show letter only)
}
```

---

## Implementation Status

### Phase 1: Viewer + Upload ✅

- [x] Planner page with project context
- [x] Area cards with floor plan management
- [x] DWG upload (drag & drop + file picker)
- [x] Persistent storage with SHA256 caching
- [x] PlannerViewer (Viewer3D + custom toolbar)
- [x] Measurement tools (distance, area)
- [x] DWG unit information display
- [x] Translation status polling + warnings

### Phase 2: Products + Placement ✅

- [x] Products panel (sidebar with groups)
- [x] Click-to-place mode
- [x] Marker system (MarkupsCore SVG layer)
- [x] Placement persistence (save/load)
- [x] Unsaved changes detection
- [x] Symbol letters on markers (A1, B2)
- [x] User preferences (marker size, colors, zoom)

### Phase 3: Area Overview UI 🚧

- [ ] Area dropdown selector (replace card grid)
- [ ] Products grid in overview mode (Option D layout)
- [ ] Placement status per product (placed vs pending)
- [ ] Symbol summary badges
- [ ] Mode toggle (Overview ↔ Planner)

### Phase 4: Symbol Images 📋

- [ ] Symbol storage table migration
- [ ] Supabase bucket setup
- [ ] Symbol generation integration (from symbol-generator)
- [ ] On-demand generation trigger
- [ ] Symbol images on markers (replace letters)

### Phase 5: Export 📋

- [ ] Export as PDF with legend
- [ ] Export as DWG with actual symbols (APS Design Automation)
- [ ] Print-ready layouts

---

## Technical Architecture

### State Management

**File**: `src/app/planner/use-planner-state.ts` (~685 lines)

Central hook managing all planner logic:

```typescript
const {
  // Data
  activeProject,
  areaRevisions,
  selectedAreaRevision,
  products,
  placements,

  // UI State
  isDirty,
  isSaving,
  dwgUnitInfo,

  // User Preferences
  markerMinScreenPx,
  viewerBgTopColor,
  viewerBgBottomColor,
  reverseZoomDirection,

  // Handlers
  handleAreaSelect,
  handleFileChange,
  handlePlacementAdd,
  handlePlacementDelete,
  handleSavePlacements,
  // ... 30+ handlers
} = usePlannerState()
```

### Coordinate Systems

The planner works with multiple coordinate systems:

| System | Use | Conversion |
|--------|-----|------------|
| Screen (pixels) | Mouse events | `clientToMarkups()` |
| Markup (SVG) | Marker positioning | Native to MarkupsCore |
| DWG World | Persistence | `viewerToDwgCoords()` |

**Critical**: MarkupsCore handles zoom/pan automatically. HTML overlays break during 2D pan.

### Marker System (MarkupsCore)

```typescript
// Initialize
const markupExt = viewer.getExtension('Autodesk.Viewing.MarkupsCore')
markupExt.enterEditMode()
markupExt.svg.style.zIndex = '9999'  // CRITICAL: render above canvas

// Add marker
const g = document.createElementNS(ns, 'g')
g.setAttribute('transform', `translate(${x}, ${y})`)
// ... add circle + text
markupGroup.appendChild(g)
```

**Why MarkupsCore?** The 2D viewer doesn't expose camera position during pan. MarkupsCore's SVG layer has correct `viewBox` transforms.

### Database Schema

```sql
-- Floor plan storage (on area revision)
ALTER TABLE projects.project_area_revisions
ADD COLUMN floor_plan_urn TEXT,
ADD COLUMN floor_plan_filename TEXT,
ADD COLUMN floor_plan_hash TEXT;

-- Product placements
CREATE TABLE projects.planner_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_revision_id UUID REFERENCES project_area_revisions(id),
  project_product_id UUID REFERENCES project_products(id),
  world_x NUMERIC NOT NULL,
  world_y NUMERIC NOT NULL,
  rotation NUMERIC DEFAULT 0,
  symbol TEXT,                    -- Display label (A1, B2)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## File Structure

```
src/
├── app/planner/
│   ├── page.tsx                    # Main page component
│   ├── use-planner-state.ts        # Central state hook (685 lines)
│   ├── area-card.tsx               # Area card with upload/thumbnail
│   ├── planner-dialogs.tsx         # Delete, warnings, unsaved dialogs
│   └── types.ts                    # Page-specific types
│
├── components/planner/
│   ├── index.ts                    # Barrel exports
│   ├── planner-viewer.tsx          # Viewer3D wrapper
│   ├── products-panel.tsx          # Sidebar product list
│   ├── viewer-toolbar.tsx          # Bottom toolbar
│   ├── markup-markers.ts           # MarkupsCore marker management
│   ├── placement-tool.ts           # Coordinate conversion
│   └── types.ts                    # Component types
│
├── lib/planner/
│   ├── index.ts                    # Library exports
│   ├── aps-planner-service.ts      # APS bucket/upload/caching
│   └── actions.ts                  # Server actions wrapper
│
└── app/api/planner/
    ├── upload/route.ts             # POST: upload, GET: URN
    ├── status/[urn]/route.ts       # Translation polling
    ├── manifest/route.ts           # Warning details
    └── thumbnail/route.ts          # Area thumbnail
```

---

## Server Actions

```typescript
// Area management
listProjectAreasAction(projectId)           // Get all areas
listAreaRevisionProductsAction(revisionId)  // Get products with symbols

// Floor plan
deleteAreaRevisionFloorPlanAction(revisionId)

// Placements
loadAreaPlacementsAction(revisionId)
saveAreaPlacementsAction(revisionId, placements)
```

---

## User Preferences

Stored in `projects.user_preferences`:

| Preference | Default | Purpose |
|------------|---------|---------|
| `marker_min_screen_px` | 12 | Minimum marker size when zoomed out |
| `viewer_bg_top_color` | #374151 | Viewer background gradient top |
| `viewer_bg_bottom_color` | #111827 | Viewer background gradient bottom |
| `reverse_zoom_direction` | false | Invert mouse wheel zoom |

---

## Related Documentation

- [Symbol Classification](./symbol-classification.md) - Letter assignment rules
- [Symbol Generator](./symbol-generator.md) - Image generation pipeline (test page)
- [Project Management](./project-management/) - Projects and areas
- [APS Viewer API](https://aps.autodesk.com/en/docs/viewer/v7/)

---

## Notes

- Floor plan DWGs are typically 2D layouts (ironic use of Viewer**3D**)
- Viewer3D gives full UI control vs GuiViewer3D's built-in toolbar
- Mouse navigation: drag to pan, scroll to zoom (AutoCAD-style)
- SHA256 caching: same file = instant load (no re-translation)
- APS token pricing is negligible (~$0.01 per symbol generation)

---

**Last Updated**: 2025-12-29 (v1.13.x - Comprehensive rewrite with symbol storage system)
