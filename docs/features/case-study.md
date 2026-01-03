# Case Study Feature

**Status**: Active Development (Phase 4B in progress)
**Route**: `/case-study`
**Last Updated**: 2026-01-03 (Phase 4B.2 complete: Edit2D markers with SVG primitive parsing)

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

### In Progress (Phase 4B) - Edit2D Refactoring

**Goal**: Replace MarkupsCore SVG manipulation with Edit2D extension for proper shape management.

**Problem with Current MarkupsCore Approach**:
- We manipulate the MarkupsCore SVG layer directly (`markupsExt.svg.appendChild()`)
- Shapes are NOT registered with MarkupsCore's internal tracking
- Result: "Phantom clicks" - hidden markers still capture mouse events
- No built-in move/resize tools
- No undo/redo support

**Solution**: Migrate to `Autodesk.Edit2D` extension which provides managed shape objects.

See **[Phase 4B: Edit2D Migration](#phase-4b-edit2d-migration)** section below for full details.

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

---

## Phase 4B: Edit2D Migration

**Branch**: `feature/edit2d-markers`
**Status**: Phase 4B.1 & 4B.2 COMPLETE ✅

### Background

The current implementation uses `Autodesk.Viewing.MarkupsCore` extension with direct SVG manipulation. While this works for basic placement, it has fundamental limitations that prevent advanced features.

### Current Architecture (MarkupsCore)

```typescript
// Current approach - direct SVG manipulation
this.markupsExt = viewer.getExtension('Autodesk.Viewing.MarkupsCore')
this.markupsExt.enterEditMode()
const svg = this.markupsExt.svg as SVGSVGElement
svg.appendChild(group)  // Raw SVG - NOT tracked by MarkupsCore
```

**Problems:**
| Issue | Impact |
|-------|--------|
| Phantom clicks | Hidden markers still capture mouse events |
| No move/drag | Had to implement manually (not done) |
| No resize | Had to implement manually (not done) |
| No undo/redo | State changes are permanent |
| Manual hit-testing | Selection logic is fragile |
| Visibility broken | `removeShape()` doesn't prevent interaction |

### Target Architecture (Edit2D)

```typescript
// Target approach - managed shapes
const edit2d = await viewer.loadExtension('Autodesk.Edit2D')
edit2d.registerDefaultTools()

const ctx = edit2d.defaultContext
const layer = ctx.layer

// Import SVG as managed shape
const shape = Autodesk.Edit2D.Shape.fromSVG('<path d="..."/>')
ctx.addShape(shape)  // Tracked, with undo support

// Add label
const label = new Autodesk.Edit2D.ShapeLabel(shape, layer)
label.setText('A1')

// Hide: remove from layer (proper hit-testing removal)
ctx.removeShape(shape)

// Show: restore
ctx.addShape(shape)
```

### Edit2D API Reference

#### Core Structure

```typescript
const edit2d = viewer.getExtension('Autodesk.Edit2D')
const ctx = edit2d.defaultContext

ctx.layer        // EditLayer - contains shapes
ctx.gizmoLayer   // Temporary shapes (snap indicators)
ctx.undoStack    // Undo/redo manager
ctx.selection    // Selection & hover manager
ctx.snapper      // Geometry snapping
```

#### Shape Operations

| Operation | API | Notes |
|-----------|-----|-------|
| Add shape | `ctx.addShape(shape)` | With undo tracking |
| Remove shape | `ctx.removeShape(shape)` | With undo tracking |
| Clear all | `ctx.clearLayer()` | Removes all shapes |
| Update display | `layer.update()` | After style changes |

#### SVG Import/Export

```typescript
// Import from SVG path
const shape = Autodesk.Edit2D.Shape.fromSVG('<path d="M 10,20 L 30,40 Z"/>')

// Export single shape
const svgString = shape.toSVG({ exportStyle: true })

// Export entire layer
const svgElement = Autodesk.Edit2D.Svg.createSvgElement(layer.shapes, { dstBox: pixelBox })
```

#### Built-in Tools (`edit2d.defaultTools`)

| Tool | Purpose | Our Use Case |
|------|---------|--------------|
| `insertSymbolTool` | Click to place custom symbol | ⭐ Luminaire placement |
| `polygonTool` | Draw polygons/rectangles | Room zones (future) |
| `polylineTool` | Draw lines | Wiring paths (future) |
| `polygonEditTool` | Edit existing polygons | - |

**Using insertSymbolTool:**
```typescript
// Set custom symbol
const symbol = Autodesk.Edit2D.Shape.fromSVG('<path d="..."/>')
tools.insertSymbolTool.symbol = symbol

// Activate tool
viewer.toolController.activateTool(tools.insertSymbolTool.getName())
// User clicks → symbol placed at click location
```

#### Labels

```typescript
// Shape label (attached to shape center)
const label = new Autodesk.Edit2D.ShapeLabel(shape, layer)
label.setText('A1')

// Edge label (attached to specific edge)
const edgeLabel = new Autodesk.Edit2D.EdgeLabel(layer)
edgeLabel.attachToEdge(shape, 0)  // Edge index 0
edgeLabel.setText('A1')

// Built-in measurement labels
tools.polygonEditTool.setAreaLabelVisible(true)
tools.polygonEditTool.setLengthLabelVisible(true)
```

#### Selection & Events

```typescript
// Listen for selection changes
ctx.selection.addEventListener(
  Autodesk.Edit2D.Selection.Events.SELECTION_CHANGED,
  (event) => { /* handle */ }
)

// Listen for hover changes
ctx.selection.addEventListener(
  Autodesk.Edit2D.Selection.Events.SELECTION_HOVER_CHANGED,
  (event) => { /* handle */ }
)

// Programmatic selection
ctx.selection.selectOnly(shape)
ctx.selection.setHoverID(shape.id)
```

#### Styling

```typescript
// Shape style
shape.style.fillColor = 'rgb(255, 128, 0)'
shape.style.fillAlpha = 0.3
shape.style.lineWidth = 2.0
shape.style.lineStyle = 11  // Dashed
layer.update()

// Custom highlight modifier
layer.addStyleModifier((shape, style) => {
  if (isMyHighlight(shape)) {
    const modified = style.clone()
    modified.fillColor = 'rgb(255, 200, 0)'
    return modified
  }
  return undefined  // No change
})
```

#### Unit Handling

```typescript
const unitHandler = new Autodesk.Edit2D.SimpleUnitHandler(viewer)
unitHandler.layerUnit = 'mm'     // Layer coordinates in mm
unitHandler.displayUnits = 'mm'  // Display in mm
unitHandler.digits = 1           // Decimal places

// Query model units
model.getUnitScale()    // → 0.001 (mm to meters)
model.getUnitString()   // → "mm"
```

### Verification Required

The following must be verified during implementation:

| Question | Risk | Verification Method |
|----------|------|---------------------|
| **1:1 Symbol Scaling** | 🔴 High | Place 300mm symbol, measure in DWG |
| **Coordinate System** | 🔴 High | Compare Edit2D coords with DWG world coords |
| **Label Rotation** | 🟡 Medium | Rotate shape, check if ShapeLabel stays upright |
| **SVG Path Import** | 🟡 Medium | Import our luminaire SVGs, verify rendering |
| **Hit-testing** | 🟢 Low | Remove shape, verify no click capture |

### Migration Plan

#### Phase 4B.1: Extension Setup ✅
- [x] Load `Autodesk.Edit2D` alongside existing extensions
- [x] Call `registerDefaultTools()` after model load
- [x] Verify Edit2D layer renders on top of DWG

#### Phase 4B.2: Symbol Placement ✅
- [x] Create `Edit2DMarkers` class (parallel to `MarkupMarkers`)
- [x] Implement SVG primitive parsing (rect, circle, line → Polygon)
- [x] Wire test button for placement verification
- [x] Add `ShapeLabel` for symbol letters (A1, B2)
- [x] Verify 1:1 scaling with DWG units (148x80mm symbol renders correctly)

**Key Discovery**: `Shape.fromSVG()` has issues with bezier curves. Our SVG symbols use primitives (rect, circle, line), so we convert them directly to `Edit2D.Polygon` shapes. This approach works perfectly and preserves colors from the original SVG.

#### Phase 4B.3: Selection & Manipulation
- [ ] Selection events → update sidebar highlighting
- [ ] Delete key → `ctx.removeShape()`
- [ ] R key → rotation (via transform or recreate)
- [ ] Drag → built-in move (verify it works)

#### Phase 4B.4: Visibility Toggle
- [ ] Store hidden shapes in Map (symbol → Shape[])
- [ ] Hide: `ctx.removeShape()` for each
- [ ] Show: `ctx.addShape()` for each
- [ ] Verify no phantom clicks when hidden

#### Phase 4B.5: Persistence
- [ ] Extract coordinates from Edit2D shapes
- [ ] Convert to DWG coordinates for database
- [ ] Load placements → create shapes at positions
- [ ] Ensure rotation is preserved

#### Phase 4B.6: Cleanup
- [ ] Remove `MarkupMarkers` class
- [ ] Remove `markup-markers.ts`
- [ ] Update hook imports
- [ ] Update documentation

### Files to Modify

| File | Action |
|------|--------|
| `use-viewer-init.ts` | Load Edit2D, register tools |
| `markup-markers.ts` | Replace with `edit2d-markers.ts` |
| `placement-tool.ts` | May be replaced by `insertSymbolTool` |
| `case-study-viewer.tsx` | Update refs and callbacks |
| `viewer-view.tsx` | Update visibility toggle logic |
| `use-case-study-state.ts` | Visibility state already done |

### API Documentation Sources

- [Edit2D Manual Drawing](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-manual)
- [Edit2D Toolset Usage](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-use)
- [Edit2D Setup](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-setup)
- [Edit2D Customization](https://aps.autodesk.com/en/docs/viewer/v7/developers_guide/advanced_options/edit2d-customize)

### Feature Comparison

| Feature | MarkupsCore (Current) | Edit2D (Target) |
|---------|----------------------|-----------------|
| Shape tracking | ❌ Manual | ✅ Built-in |
| Selection | ❌ Manual | ✅ `ctx.selection` |
| Move/drag | ❌ Not implemented | ✅ Built-in gizmo |
| Rotate | ⚠️ Manual (R key) | ✅ Built-in gizmo |
| Scale/resize | ❌ Not implemented | ✅ Built-in gizmo |
| Delete | ⚠️ Manual | ✅ With undo |
| Undo/redo | ❌ None | ✅ `ctx.undoStack` |
| Hide/show | ❌ Phantom clicks | ✅ Proper removal |
| Snapping | ⚠️ Partial | ✅ `ctx.snapper` |
| Labels | ⚠️ Manual badge | ✅ `ShapeLabel` |
| SVG import | ⚠️ Manual parsing | ✅ `Shape.fromSVG()` |
| SVG export | ❌ Not implemented | ✅ `shape.toSVG()` |

### Notes from Research

1. **Gemini Recommendation**: Edit2D is the correct tool for SVG-based shape manipulation with selection/move/rotate support.

2. **SVG Path Limitation**: Edit2D works best with SVG `<path>` elements. Complex groups may need flattening. Our luminaire symbols use paths, so this should work.

3. **Coordinate System**: Edit2D likely uses page coordinates like MarkupsCore. The `getPageToModelTransform()` approach may still be needed for DWG unit conversion.

4. **Label Rotation**: Unknown if `ShapeLabel` stays upright when shape rotates. May need to counter-rotate or use alternative approach.

5. **Viewer Configuration**: We're already using SVF2 (`AutodeskProduction2` + `streamingV2_EU`) which is compatible with Edit2D.
