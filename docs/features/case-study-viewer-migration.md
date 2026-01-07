# Case Study Viewer Migration Guide

**Source:** `~/tools/aps-viewer` (APS Viewer Testing Sandbox)
**Target:** FOSSAPP Case Study Viewer
**Branch:** `feature/case-study-viewer-enhancements`
**Created:** 2026-01-07

---

## Overview

This document tracks components to cherry-pick from the aps-viewer testing sandbox into FOSSAPP's Case Study viewer. Each item includes migration status, adaptation notes, and testing checklist.

---

## Migration Checklist

### Legend

- [ ] Not started
- [~] In progress
- [x] Completed
- [!] Blocked / Needs discussion

---

## 1. Core Infrastructure

### 1.1 Type Definitions

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `core/types.ts` | `~/tools/aps-viewer/src/components/viewer/core/types.ts` | `src/components/case-study/viewer/core/types.ts` |

**What to take:**
- All Edit2D interfaces (`Edit2DStyle`, `Edit2DShape`, `Edit2DLayer`, `Edit2DSelection`, `Edit2DContext`)
- Snap types (`SnapType`, `SnapResult`, `ViewerSnapper`)
- Viewer instance types (`Viewer3DInstance`, `ViewerImpl`, `ToolController`)
- Placement types (`PlacementMode`, `PlacedShape`)
- Global `Autodesk` type declarations

**Adaptations needed:**
- `PlacementMode` type: Replace `'shape1' | 'shape2'` with dynamic fixture types or generic `'place'`
- Add FOSSAPP-specific fields to `PlacedShape` (e.g., `fixtureId`, `projectId`)

**Testing:**
- [ ] TypeScript compiles without errors
- [ ] All imported types resolve correctly

---

### 1.2 Runtime & Script Loading

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `core/runtime.ts` | `~/tools/aps-viewer/src/components/viewer/core/runtime.ts` | `src/components/case-study/viewer/core/runtime.ts` |

**What to take:**
- `loadViewerScript()` - Dynamic script loading for viewer3D.min.js
- `initializeViewerRuntime()` - Singleton runtime initialization
- `fetchAccessToken()` - Token fetching (adapt endpoint)
- `loadDocument()` - URN document loading

**Adaptations needed:**
- Change token endpoint from `/api/aps/token` to FOSSAPP's endpoint
- Consider caching strategy for tokens

**Testing:**
- [ ] Script loads correctly
- [ ] Token fetches successfully
- [ ] Document loads with valid URN

---

### 1.3 Core Viewer Hook

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `core/useViewerCore.ts` | `~/tools/aps-viewer/src/components/viewer/core/useViewerCore.ts` | `src/components/case-study/viewer/core/useViewerCore.ts` |

**What to take:**
- Viewer initialization pattern
- Edit2D extension loading
- Event handling (GEOMETRY_LOADED, SELECTION_CHANGED, etc.)
- Cleanup on unmount

**Adaptations needed:**
- Integrate with existing Case Study state management
- Add FOSSAPP-specific events if needed

**Testing:**
- [ ] Viewer initializes correctly
- [ ] Edit2D extension loads
- [ ] Events fire appropriately
- [ ] Cleanup runs on unmount

---

## 2. Coordinate System

### 2.1 Coordinate Transform

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `coordinate-transform.ts` | `~/tools/aps-viewer/src/components/viewer/features/coordinate-transform.ts` | `src/components/case-study/viewer/features/coordinate-transform.ts` |

**What to take:**
- `displayToDwg(x, y)` - Convert viewer display coords to DWG world coords
- `mmToDisplay(mm)` - Convert mm to display units
- `dwgToDisplay(x, y)` - Inverse transform (if implemented)
- Calibration constants/logic

**Adaptations needed:**
- Consider making calibration points configurable per project/DWG
- Current assumes CAL-ORIGIN (0,0) and CAL-UNIT (1,1) on `LUM-CENTER` layer

**Testing:**
- [ ] Coordinates match AutoCAD values
- [ ] Sub-millimeter accuracy verified
- [ ] Works with different DWG scales

**DWG Preparation Required:**
- Each Case Study DWG needs calibration points on `LUM-CENTER` layer
- Document this requirement in user guide

---

## 3. Hover Detection

### 3.1 Viewer Hover Hook

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `useViewerHover.ts` | `~/tools/aps-viewer/src/components/viewer/features/useViewerHover.ts` | `src/components/case-study/viewer/features/useViewerHover.ts` |

**What to take:**
- Mouse move tracking on viewer container
- `clientToWorld()` usage for coordinate detection
- Element name lookup via `getProperties()`
- Debouncing/throttling logic

**Returns:**
- `hoveredItemName: string | null` - Name of hovered DWG element
- `dwgCoords: { x: number, y: number } | null` - Current cursor position in DWG coords

**Adaptations needed:**
- None expected, should work as-is

**Testing:**
- [ ] Hover detection works
- [ ] Element names display correctly
- [ ] Coordinates update in real-time
- [ ] Performance is acceptable (no lag)

---

## 4. Shape Placement System

### 4.1 Placement Mode Hook (Main Feature)

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `usePlacementMode.ts` | `~/tools/aps-viewer/src/components/viewer/features/usePlacementMode.ts` | `src/components/case-study/viewer/features/usePlacementMode.ts` |

**What to take:**
- Geometry snapping integration (Autodesk.Extensions.Snapping.Snapper)
- Click-to-place logic with snap point detection
- Group-aware selection (all shapes in a group selected together)
- Move mode (M key) with ghost preview
- Rotate mode (R key) with configurable step
- Delete handling (Delete key)
- Selection state management
- Ctrl+click multi-select

**Returns:**
- `snapType: string | null` - Current snap type (VERTEX, MIDPOINT, CENTER, EDGE)
- `selectedShapeIds: number[]` - Currently selected group IDs
- `isMoving: boolean` - Whether in move mode

**Callbacks:**
- `onShapePlaced(shape: PlacedShape)` - Called when shape placed
- `onSelectionChange(ids: number[])` - Called when selection changes
- `onShapesDeleted(ids: number[])` - Called when shapes deleted

**Adaptations needed:**
- Replace `'shape1' | 'shape2'` modes with fixture type from FOSSAPP
- Connect `onShapePlaced` to Supabase storage
- Connect `onShapesDeleted` to Supabase deletion

**Testing:**
- [ ] Snapping works (vertex, midpoint, center, edge)
- [ ] Shapes place at correct coordinates
- [ ] Selection highlights correctly
- [ ] Move mode works with preview
- [ ] Rotate works in 15° increments
- [ ] Delete removes shapes
- [ ] Ctrl+click multi-select works
- [ ] ESC cancels operations

---

### 4.2 Placement Types & Constants

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `placement-types.ts` | `~/tools/aps-viewer/src/components/viewer/features/placement-types.ts` | `src/components/case-study/viewer/features/placement-types.ts` |

**What to take:**
- `PLACEMENT_CURSOR_TOOL` constant
- `SNAP_TYPE_NAMES` mapping (geomType number → readable name)
- `ROTATION_STEP` constant (15 degrees)
- `PREVIEW_THROTTLE_MS` constant
- `ShapeFactory` type definition
- `UsePlacementModeOptions` interface
- `UsePlacementModeResult` interface

**Adaptations needed:**
- May adjust `ROTATION_STEP` based on user feedback

---

### 4.3 Cursor Tool

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `cursor-tool.ts` | `~/tools/aps-viewer/src/components/viewer/features/cursor-tool.ts` | `src/components/case-study/viewer/features/cursor-tool.ts` |

**What to take:**
- `PlacementCursorTool` interface
- `createPlacementCursorTool()` factory
- Tool registration pattern for custom cursors

**How it works:**
- Registers a tool with `getCursor()` that returns `'crosshair'` when active
- Tool always activated but cursor only shows when `_isActive` is true
- `__checkCursor()` forces cursor refresh

**Adaptations needed:**
- None expected

---

### 4.4 Style Manager

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `style-manager.ts` | `~/tools/aps-viewer/src/components/viewer/features/style-manager.ts` | `src/components/case-study/viewer/features/style-manager.ts` |

**What to take:**
- `ShapeStyleManager` class - Stores original styles, applies hover/selection styles
- `applyPreviewStyle()` - For move mode preview shapes
- `applyGhostStyle()` - For ghosting original during move
- `restoreFullOpacity()` - Restore after move cancel

**Style definitions:**
- Hover: Cyan stroke (`#00FFFF`)
- Selected: Green stroke (`#00FF00`) with 30% fill
- Preview: 50% opacity
- Ghost: 20% opacity

**Adaptations needed:**
- May adjust colors to match FOSSAPP theme

---

## 5. SVG → Edit2D Pipeline

### 5.1 SVG to Edit2D Converter

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `svg-to-edit2d.ts` | `~/tools/aps-viewer/src/components/viewer/shapes/svg-to-edit2d.ts` | `src/components/case-study/viewer/shapes/svg-to-edit2d.ts` |

**What to take:**
- `createShapesFromSVG(edit2d, svg, originX, originY, rotation)` - Main conversion function
- SVG path parsing (M, L, H, V, Z, A commands)
- Element handlers: `<path>`, `<circle>`, `<rect>`, `<line>`, `<ellipse>`, `<polyline>`, `<polygon>`
- Rotation transform application
- Style parsing (stroke, fill, opacity, lineWidth)

**Dependencies:**
- Uses `flatten-svg` npm package for path normalization
- Uses `mmToDisplay()` from coordinate-transform

**Adaptations needed:**
- None expected - this is the most reusable piece

**Testing:**
- [ ] Paths render correctly
- [ ] Circles render correctly
- [ ] Rectangles render correctly
- [ ] Lines render correctly
- [ ] Rotation works
- [ ] Colors/styles apply correctly

---

### 5.2 Shape Factory

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `shape-factory.ts` | `~/tools/aps-viewer/src/components/viewer/shapes/shape-factory.ts` | `src/components/case-study/viewer/shapes/fixture-factory.ts` |

**What to take:**
- Factory pattern: `(edit2d, x, y, type, rotation) => Edit2DShape[]`
- Integration with SVG map lookup
- Automatic layer.addShape() calls

**Adaptations needed:**
- Replace hardcoded `SHAPE_SVG_MAP` with dynamic fixture symbol lookup
- Fetch SVG from FOSSAPP's fixture/symbol database

---

## 6. UI Components

### 6.1 Spinner Hide Styles (Critical)

| Status | File | Source | Target |
|--------|------|--------|--------|
| [ ] | `ViewerSpinnerHideStyles` | `~/tools/aps-viewer/src/components/viewer/overlays/ViewerOverlays.tsx` | Inline in Case Study component |

**What to take:**
```tsx
<style>{`
  .adsk-viewing-viewer .spinner,
  .adsk-viewing-viewer .loading-spinner,
  .adsk-viewing-viewer .progressbg {
    display: none !important;
  }
`}</style>
```

**Why needed:**
- Autodesk's white loading spinner flashes before our overlay can cover it
- This CSS hides it directly

---

### 6.2 Other Overlays (Pattern Reference Only)

| Component | Reuse Level | Notes |
|-----------|-------------|-------|
| `LoadingOverlay` | Pattern | Use FOSSAPP loading components |
| `ErrorOverlay` | Pattern | Use FOSSAPP error handling |
| `CoordinateBadge` | Adapt | Restyle with @fossapp/ui, keep logic |
| `PlacementModeIndicator` | Optional | Case Study has its own toolbar |
| `SelectionInfoOverlay` | Pattern | Already have equivalent in Case Study |
| `HoverInfoOverlay` | Pattern | Already have equivalent in Case Study |

---

## 7. Documented Knowledge (viewer-insights.md)

### 7.1 Known Limitations to Remember

| Topic | Finding | Impact |
|-------|---------|--------|
| 2D Rollover Color | Hardcoded yellow, can't change | Don't try to customize |
| 2D Hit Test Radius | Hardcoded 5px (45px touch) | Accept this limitation |
| `lineStyle` property | Stored but not rendered | No dashed lines in Edit2D |
| Background flash | Use CSS + high z-index overlay | Follow the pattern |
| Cursor system | Register tool with `getCursor()` | Use cursor-tool.ts pattern |
| Event timing | Wait for GEOMETRY_LOADED_EVENT | Don't rely on promise alone |

### 7.2 Working APIs to Use

| API | Purpose |
|-----|---------|
| `matman.set2dSelectionColor()` | Change selection highlight color |
| `viewer.disableSelection(bool)` | Toggle DWG selection |
| `layer.hitTest(x, y, tolerance)` | Find Edit2D shape at point |
| `layer.canvasToLayer(x, y)` | Convert canvas coords to layer coords |
| `selection.selectOnly(shape)` | Select single shape |
| `selection.setSelection(shapes)` | Set multiple selected |

---

## 8. Exclusions (Do NOT Copy)

| Item | Reason |
|------|--------|
| `TEST_URN` constant | Test-specific URN |
| `shape-definitions.ts` | Test shapes ('shape1', 'shape2') |
| `SHAPE_LABELS` ('A1', 'B2') | Test labels |
| `page.tsx` | Test harness UI |
| Hardcoded modes `'shape1' \| 'shape2'` | Replace with dynamic fixture types |

---

## 9. Recommended Target Structure

```
src/components/case-study/viewer/
├── core/
│   ├── index.ts              # Barrel exports
│   ├── types.ts              # From aps-viewer + FOSSAPP additions
│   ├── runtime.ts            # Adapted from aps-viewer
│   └── useViewerCore.ts      # Adapted for Case Study
├── features/
│   ├── index.ts              # Barrel exports
│   ├── coordinate-transform.ts  # From aps-viewer (as-is)
│   ├── useViewerHover.ts        # From aps-viewer (as-is)
│   ├── usePlacementMode.ts      # Adapted for fixtures
│   ├── placement-types.ts       # Adapted for fixtures
│   ├── cursor-tool.ts           # From aps-viewer (as-is)
│   └── style-manager.ts         # From aps-viewer (colors may change)
├── shapes/
│   ├── index.ts              # Barrel exports
│   ├── svg-to-edit2d.ts      # From aps-viewer (as-is)
│   └── fixture-factory.ts    # New: Creates shapes from fixture data
└── CaseStudyViewer.tsx       # Main component (existing, enhanced)
```

---

## 10. Migration Order (Recommended)

1. **Core types** - Foundation for everything else
2. **Coordinate transform** - Needed for accurate positioning
3. **Runtime & useViewerCore** - Get viewer working
4. **SVG → Edit2D pipeline** - Enable shape rendering
5. **Fixture factory** - Connect to FOSSAPP fixture data
6. **Placement mode** - Full placement functionality
7. **Hover detection** - Nice-to-have UX enhancement
8. **Style manager & cursor tool** - Polish

---

## Notes

- Keep this document updated as migration progresses
- Test each component in isolation before integration
- Document any FOSSAPP-specific adaptations made

---

**Last Updated:** 2026-01-07
