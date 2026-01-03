# Case Study Feature

**Status**: Active Development (Phase 5 planned)
**Route**: `/case-study`
**Last Updated**: 2026-01-03 (Phase 4 complete)

---

## Overview

The Case Study page allows lighting designers to visualize product placements on customer floor plans and prepare deliverables for AutoCAD. Users upload DWG architectural drawings, see products assigned to areas, and place them as interactive markers.

**Design Document**: See [../plans/planner-v2-design.md](../plans/planner-v2-design.md) for original design vision and UX principles.

---

## Quick Reference

| Item | Value |
|------|-------|
| **Route** | `/case-study/[areaCode]/products` or `/case-study/[areaCode]/viewer` |
| **Entry Point** | `src/app/case-study/page.tsx` |
| **State Hook** | `src/app/case-study/hooks/use-case-study-state.ts` |
| **Viewer Component** | `src/components/case-study-viewer/case-study-viewer.tsx` |
| **Viewer Hooks** | `src/components/case-study-viewer/hooks/` (5 specialized hooks) |
| **Server Actions** | `src/app/case-study/actions/index.ts` |

---

## User Workflow

### Prerequisites (Project Setup)

```
1. Create Project → Bind to Customer
2. Project becomes "current" (one per browser tab)
3. Create Areas ("Ground Floor", "Garden", etc.)
4. Add Products to areas (via Products page or `/` quick search)
```

### Case Study Workflow

```
1. Navigate to Case Study page
2. Select area from dropdown (URL updates: /case-study/gf/products)
3. View products panel with auto-assigned symbols (A1, A2, B1, N1...)
4. Upload architectural DWG (client's floor plan)
5. Switch to Viewer view
6. Click product → click on floor plan to place
7. Repeat until all products placed
8. Generate symbol drawings (coming: Phase 5)
9. Export final DWG with placements (coming: Phase 5)
```

---

## Two-View System

The page has two switchable views, toggled via toolbar buttons:

### Products View (`/case-study/[areaCode]/products`)

Horizontal scrolling cards showing all products for the selected area.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Area ▼] │ [📋 Products | 🗺️ Viewer] │ [Upload DWG] [🗑️ Delete]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LUMINAIRES  ──────────────────────────────────────────────────────────────▶│
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │[Symbol] │ │[Symbol] │ │  A3     │ │[Symbol] │ │   N1    │               │
│  │  A1     │ │  A2     │ │         │ │  B1     │ │  TRACK  │   ← Horizontal│
│  │ BOXY    │ │ BOXY S  │ │ MINI    │ │ PEND    │ │         │      scroll   │
│  │─────────│ │─────────│ │─────────│ │─────────│ │─────────│               │
│  │ 3/5 [+][-]│ │ 0/3 [+][-]│ │ 8/8 ✓  │ │ 1/2 [+][-]│ │ 2/4 [+][-]│               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                              │
│  ACCESSORIES & DRIVERS  ───────────────────────────────────────────────────▶│
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                                       │
│  │ Driver  │ │ Optic   │ │ Mount   │                   ← Horizontal        │
│  │ 350mA   │ │ 24°     │ │ Bracket │                      scroll           │
│  │─────────│ │─────────│ │─────────│                                       │
│  │ Qty: 5 [+][-]│ │ Qty: 5 [+][-]│ │ Qty: 2 [+][-]│                                       │
│  └─────────┘ └─────────┘ └─────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Horizontal scroll for luminaires and accessories (scales to 100s of products)
- Inline quantity adjustment with `[+][-]` buttons
- Placement progress (3/5 placed) with visual indicator
- Symbol badge showing assigned letter (A1, B1, N1)
- Yellow `?` badge for products without classification

### Viewer View (`/case-study/[areaCode]/viewer`)

DWG canvas with pick-and-place functionality.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Area ▼] │ [📋 Products | 🗺️ Viewer] │ [Upload DWG] [🗑️ Delete]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────┐ ┌────────────────────┐ │
│  │                                                 │ │ PRODUCTS PANEL     │ │
│  │                                                 │ │ (pick & place)     │ │
│  │              DWG VIEWER                         │ │                    │ │
│  │              (Autodesk APS)                     │ │ ┌────────────────┐ │ │
│  │                                                 │ │ │ A1 BOXY        │ │ │
│  │         Floor plan + placed symbols             │ │ │ 3/5 placed     │ │ │
│  │         (A1)    (B1)    (N1)                    │ │ └────────────────┘ │ │
│  │                   (A1)                          │ │ ┌────────────────┐ │ │
│  │                          (A3)                   │ │ │ A2 MINI        │ │ │
│  │                                                 │ │ │ 0/3 placed     │ │ │
│  │                                                 │ │ └────────────────┘ │ │
│  │                                                 │ │ ...               │ │ │
│  └─────────────────────────────────────────────────┘ │ [+ Add Product]   │ │
│                                                      └────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Features:**
- Autodesk APS (Forge) viewer for DWG display
- Right panel shows luminaires for selection
- Click product → click on floor plan to place
- Markers show symbol (A1, B1) with scaled rendering
- Pan/zoom with mouse (AutoCAD-style navigation)

---

## Product Types

| Type | Gets Symbol? | Placed on Viewer? | Example |
|------|--------------|-------------------|---------|
| **Luminaires** | Yes (A1, B1, N1...) | Yes | Recessed downlight |
| **Drivers** | No | No | LED Driver 350mA |
| **Optics** | No | No | 24° Narrow beam |
| **Accessories** | No | No | Mounting bracket |

### Symbol Letters (ETIM-based)

Products are automatically assigned symbol letters based on ETIM classification:

| Letter | Category | Example |
|--------|----------|---------|
| A | Interior Spots (IP < 54) | Recessed downlight |
| B | Suspension | Pendant |
| C | Exterior Spots (IP ≥ 54) | IP65 spot |
| N | Track Light | Track system |
| ... | See [symbol-classification.md](./symbol-classification.md) | |

---

## File Structure

```
src/app/case-study/
├── page.tsx                          # Redirect → /case-study/[firstArea]/products
├── types.ts                          # Local TypeScript types (~180 lines)
├── actions/
│   └── index.ts                      # Server actions for Supabase (~310 lines)
├── components/
│   ├── index.ts                      # Barrel export
│   ├── case-study-toolbar.tsx        # Area selector, view toggle, buttons
│   ├── products-view.tsx             # Horizontal scroll container
│   ├── viewer-view.tsx               # DWG viewer wrapper + products panel
│   ├── luminaire-card.tsx            # Product card with symbol badge
│   ├── accessory-card.tsx            # Simpler card for drivers/optics
│   ├── status-bar.tsx                # Coordinates display (future)
│   └── delete-floor-plan-dialog.tsx  # Confirmation dialog
├── hooks/
│   ├── index.ts                      # Barrel export
│   ├── use-case-study-state.ts       # Data + Supabase integration (~370 lines)
│   ├── use-viewer-controls.ts        # Placement mode, viewer state (~175 lines)
│   └── use-floor-plan-upload.ts      # Upload handling, delete flow
└── [areaCode]/
    ├── layout.tsx                    # Server component wrapper
    ├── case-study-shell.tsx          # Client shell + context provider (~260 lines)
    ├── page.tsx                      # Redirect → products
    ├── products/
    │   └── page.tsx                  # Products view route
    └── viewer/
        └── page.tsx                  # Viewer route

src/components/case-study-viewer/
├── index.ts                          # Barrel export
├── case-study-viewer.tsx             # Main APS viewer wrapper (~360 lines)
├── case-study-viewer-utils.ts        # Utility functions
├── viewer-toolbar.tsx                # Bottom toolbar controls
├── viewer-overlays.tsx               # Loading/error overlays
├── case-study-markups.tsx            # Markup rendering layer
├── markup-markers.ts                 # Marker creation/management
├── placement-tool.ts                 # Click-to-place coordinate logic
├── products-panel.tsx                # Product selection panel
├── types.ts                          # Viewer-specific types
└── hooks/                            # Extracted viewer hooks (see below)
    ├── index.ts                      # Barrel export
    ├── use-coordinate-transform.ts   # Page ↔ DWG coordinate conversion
    ├── use-viewer-api.ts             # Auth, upload, translation polling
    ├── use-measurement.ts            # Measurement tool state & handlers
    ├── use-viewer-events.ts          # DOM events, keyboard, mouse tracking
    └── use-viewer-init.ts            # Viewer initialization lifecycle (~510 lines)

src/components/symbols/
├── index.ts                          # Barrel export
├── symbol-modal.tsx                  # Symbol generation modal
├── symbol-gallery.tsx                # Symbol display gallery
└── generate-symbol-button.tsx        # Generate button
```

**Statistics:**
- ~2,850 lines across ~26 files
- Average ~110 lines per file
- Main viewer component: 360 lines (was 1,032 before hook extraction)
- Compared to old planner: 2,575 lines in 3 files (858 lines average)

---

## CaseStudyViewer Hook Architecture

The `CaseStudyViewer` component uses a modular hook architecture for maintainability. Each hook encapsulates a specific concern:

### Hook Overview

| Hook | Lines | Responsibility |
|------|-------|----------------|
| `useCoordinateTransform` | ~140 | Page ↔ DWG coordinate conversion |
| `useViewerApi` | ~200 | Auth tokens, file upload, translation polling |
| `useMeasurement` | ~130 | Distance/area measurement tool state |
| `useViewerEvents` | ~200 | Click, resize, wheel, keyboard events |
| `useViewerInit` | ~510 | Complete viewer initialization lifecycle |

### Adding New Features

When extending the Case Study Viewer:

| Feature Type | Add To |
|--------------|--------|
| New event handlers | `use-viewer-events.ts` |
| New API calls | `use-viewer-api.ts` |
| New measurement modes | `use-measurement.ts` |
| Coordinate-related logic | `use-coordinate-transform.ts` |
| New tool modes | Create new hook (e.g., `use-viewer-tools.ts`) |

### Example: Adding a New Tool

```typescript
// hooks/use-viewer-tools.ts
export function useViewerTools({ viewerRef }: Options) {
  const [activeTool, setActiveTool] = useState<'pan' | 'rotate' | 'custom'>('pan')

  const handleToolChange = useCallback((tool) => {
    viewerRef.current?.toolController.activateTool(tool)
    setActiveTool(tool)
  }, [viewerRef])

  return { activeTool, handleToolChange }
}
```

---

## State Management

### Context Provider Pattern

The `CaseStudyShell` component provides context to all child pages:

```typescript
interface CaseStudyContextValue {
  state: CaseStudyStateValue        // Products, placements, loading
  viewerControls: ViewerControlsValue // Placement mode, viewer state
  floorPlanUpload: FloorPlanUploadValue // Upload/delete handlers
  viewPreferences: ViewPreferences  // User preferences
  areas: CaseStudyArea[]            // Available areas
  selectedArea: CaseStudyArea | null
  areaCode: string                  // From URL param
  viewMode: ViewMode                // 'products' | 'viewer'
  projectId: string | null
}
```

### Main State Hook

`useCaseStudyState(areaRevisionId)` manages:

```typescript
const {
  // Data
  luminaires,           // LuminaireProduct[] with placed counts
  accessories,          // AccessoryProduct[]
  placements,           // Placement[] on floor plan

  // Product actions
  updateLuminaireQuantity,
  updateAccessoryQuantity,

  // Placement actions
  addPlacement,
  removePlacement,
  updatePlacementRotation,
  updatePlacementPosition,

  // Loading
  isLoading,
  error,
} = useCaseStudyState(revisionId)
```

**Key Features:**
- Fetches data from Supabase on area change
- Optimistic updates with debounced persistence
- Auto-save placements after 1 second of inactivity

---

## Server Actions

Located in `src/app/case-study/actions/index.ts`:

```typescript
// Area data
getCaseStudyAreasAction(projectId)          // Get areas with floor plan info
getCaseStudyProductsAction(revisionId)      // Get luminaires + accessories
getCaseStudyPlacementsAction(revisionId)    // Get existing placements

// Mutations
updateCaseStudyQuantityAction(productId, quantity)
saveCaseStudyPlacementsAction(revisionId, placements, luminaires)
```

---

## Database Schema

### Floor Plan Storage (on area revision)

```sql
ALTER TABLE projects.project_area_revisions
ADD COLUMN floor_plan_urn TEXT,           -- APS URN after translation
ADD COLUMN floor_plan_filename TEXT,      -- Original filename
ADD COLUMN floor_plan_hash TEXT,          -- SHA256 for dedup
ADD COLUMN floor_plan_status TEXT;        -- pending|inprogress|success|failed
```

### Placements Table

```sql
CREATE TABLE projects.planner_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_revision_id UUID REFERENCES project_area_revisions(id),
  project_product_id UUID REFERENCES project_products(id),
  world_x NUMERIC NOT NULL,               -- DWG X coordinate (mm)
  world_y NUMERIC NOT NULL,               -- DWG Y coordinate (mm)
  rotation NUMERIC DEFAULT 0,             -- Degrees (0-360)
  symbol TEXT,                            -- Display label (A1, B2)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Coordinate Systems

The viewer works with multiple coordinate systems, handled by `useCoordinateTransform` hook:

| System | Use | Conversion |
|--------|-----|------------|
| Screen (pixels) | Mouse events | `clientToMarkups()` |
| Page (viewer internal) | Marker positioning | Native to MarkupsCore |
| DWG Model Space (mm) | Persistence/Export | `pageToDwgCoords()` / `dwgToPageCoords()` |

**Implementation**: The `useCoordinateTransform` hook extracts the page-to-model transform matrix from `model.getPageToModelTransform(1)` and provides bidirectional conversion functions. This is essential for:
- Storing placements in DWG coordinates for LISP script export
- Rendering markers at correct positions when loading from database

**Important**: MarkupsCore handles zoom/pan transforms automatically.

---

## User Preferences

Stored in `projects.user_preferences`:

| Preference | Default | Purpose |
|------------|---------|---------|
| `marker_min_screen_px` | 12 | Minimum marker size when zoomed out |
| `viewer_bg_top_color` | #2a2a2a | Viewer background gradient top |
| `viewer_bg_bottom_color` | #0a0a0a | Viewer background gradient bottom |
| `reverse_zoom_direction` | false | Invert mouse wheel zoom |

---

## Development Status

### Completed

- [x] **Phase 1**: UI Shell - Components with mock data
- [x] **Phase 2**: State & Hooks - Real types, URL-based routing
- [x] **Phase 3**: Data Integration - Supabase connection, optimistic updates
- [x] **Phase 4**: Viewer Integration - APS viewer, placements, symbols, shortcuts
  - APS Viewer with DWG floor plan loading
  - Pick-and-place workflow with snapping
  - SVG symbol rendering on markers (with fossPid lookup)
  - Coordinate transforms (Page ↔ DWG) for correct positioning
  - Keyboard shortcuts (R=rotate, Del=delete, Esc=exit)
  - DWG info popover with unit info and shortcuts reference
  - Placement coordinates saved with 0.1mm precision

### Planned (Phase 5)

- [ ] Symbol generation modal integration
- [ ] Tile builder integration
- [ ] Magic generate button (final DWG output)
- [ ] Export as PDF with legend

---

## UX Principles

### No Dead Ends

| Situation | Behavior |
|-----------|----------|
| Product has no symbol SVG | Shows letter badge (A1), placement works |
| Need more quantity | `[+]` button inline, instant add |
| DWG not uploaded | Shows upload prompt, products panel works |
| No project selected | Redirects to Projects page |
| No areas in project | Shows "Manage Areas" button |

### AutoCAD Familiarity

- Pan with drag, zoom with scroll
- Real-size symbols (scale with zoom)
- Coordinate-aware (future: status bar with X, Y)

---

## Related Documentation

- [Symbol Classification](./symbol-classification.md) - Letter assignment rules
- [Symbol Generator](./symbol-generator.md) - Image generation pipeline
- [Project Management](./project-management/) - Projects and areas
- [Design Document](../plans/planner-v2-design.md) - Original vision and UX specs

---

**Migration Note**: This page replaced the legacy `/planner` route. The old planner code was removed in commit `6926857` (2026-01-02). See [../archive/planner-legacy.md](../archive/planner-legacy.md) for historical reference.
