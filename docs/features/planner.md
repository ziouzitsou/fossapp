# Planner Feature

**Status**: Phase 1 (In Development)
**Route**: `/planner`
**Branch**: `planner`

---

## Overview

The Planner allows users to upload a customer's floor plan DWG and visually place products from their project onto the layout. This creates a lighting plan showing where each fixture should be installed.

## User Flow (Target)

```
1. User selects a project (with products already added)
2. User uploads customer's floor plan DWG
3. Floor plan displays in APS Viewer
4. User drags products from sidebar onto the plan
5. Placements are saved to database
6. User can export the completed lighting plan
```

---

## Implementation Phases

### Phase 1: Viewer + Upload (Current)

- [x] Planner page with protected layout
- [x] Active project display in header
- [x] DWG file upload (drag & drop + file picker)
- [x] Dedicated `PlannerViewer` component (separate from tiles)
- [x] **Viewer3D** (no built-in GUI) with custom external toolbar
- [x] Custom toolbar with Measure (Distance/Area), Fit, Home
- [x] Mouse-based navigation (pan drag, scroll zoom - AutoCAD style)
- [ ] Basic testing with real floor plans

**Files:**
- `src/app/planner/page.tsx` - Main page component
- `src/components/planner/planner-viewer.tsx` - Dedicated viewer with custom toolbar
- `src/components/planner/index.ts` - Component exports
- `src/lib/navigation.ts` - Added nav entry (MdEventNote icon)

**Planner APS Infrastructure (Persistent Storage):**
- `src/lib/planner/aps-planner-service.ts` - Bucket management, upload, caching
- `src/lib/planner/actions.ts` - Server actions for upload/cache
- `src/lib/planner/index.ts` - Library exports
- `src/app/api/planner/upload/route.ts` - Upload API (POST + GET)
- `src/app/api/planner/status/[urn]/route.ts` - Translation status API

**Shared Types:**
- `src/types/autodesk-viewer.d.ts` - Shared viewer types (GuiViewer3D + Viewer3D)

**Reused Infrastructure:**
- `src/lib/tiles/aps-viewer.ts` - Fallback transient upload (without project)
- `src/app/api/viewer/*` - Fallback viewer API endpoints

### Phase 2: Project Products Panel

- [ ] Load products from active project
- [ ] Display products in collapsible sidebar
- [ ] Product cards with image, name, code
- [ ] Make cards draggable

### Phase 3: Click-to-Place

- [ ] Select product from panel
- [ ] Click on viewer to place marker
- [ ] Convert screen coordinates to world coordinates
- [ ] Visual marker/overlay at placement point

### Phase 4: Drag & Drop

- [ ] Drag product card from panel
- [ ] Drop onto viewer canvas
- [ ] Visual feedback during drag
- [ ] Proper coordinate conversion

### Phase 5: Persistence

- [ ] Database table for placements (`planner_placements`)
- [ ] Save placement: project_id, product_id, x, y, rotation
- [ ] Load existing placements when opening a plan
- [ ] Edit/delete placements

### Phase 6: Export

- [ ] Export as PDF/image with product legend
- [ ] Export as DWG with product symbols (via APS Design Automation)

---

## Autodesk Free Viewer Analysis

We analyzed https://viewer.autodesk.com to understand their UI patterns:

### Their Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: Logo + Filename + Help/Apps/User                        │
├────────┬────────────────────────────────────────────────────────┤
│ Tabs:  │ Views | Layers | Properties | Settings    Comments... │
├────────┼────────────────────────────────┬───────────────────────┤
│ Left   │                                │ Right Panel           │
│ Panel  │   Canvas (WebGL Viewer)        │ (Properties/Comments) │
│ Views  │                                │                       │
│ tree   │                                │                       │
├────────┴────────────────────────────────┴───────────────────────┤
│ Bottom Toolbar: Home | Fit | Pan | Zoom | Measure | Markup      │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features Observed

| Feature | How They Do It | Our Planner Adaptation |
|---------|----------------|------------------------|
| **Views Panel** | Tree of sheets/views | Could show saved plans |
| **Layers Panel** | Toggle layer visibility + filter | Filter product types |
| **Properties Panel** | Shows on element selection | Show product details on click |
| **Comments** | Pin to location + view snapshot | Similar to product placements |
| **Markup Tools** | Pencil, Arrow, Cloud, Text | Use for placing product markers |
| **Measure** | Distance, Angle, Area | Useful for spacing products |

### Critical Discovery: Toolbar Placement

**Problem**: Our initial viewer (GuiViewer3D) had toolbar INSIDE the WebGL canvas.
**Their Solution**: Autodesk uses toolbars OUTSIDE the canvas (custom HTML/React).

**Our Fix**: Switch from `GuiViewer3D` to `Viewer3D`:

```typescript
// OLD - toolbar inside canvas
const viewer = new window.Autodesk.Viewing.GuiViewer3D(container, {...})

// NEW - no built-in toolbar, we control everything
const viewer = new window.Autodesk.Viewing.Viewer3D(container, {...})
```

---

## Technical Architecture

### Current Implementation (Phase 1)

```
┌─────────────────────────────────────────────────────────────┐
│ Planner Page                                                │
├─────────────────────────────────────────────────────────────┤
│ Header: Title + Active Project Badge                        │
├─────────────────────────────────────────────────────────────┤
│ File Info Bar: filename + size + Close button               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │   Viewer3D Canvas (WebGL only - no built-in GUI)   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Custom Toolbar: [Ruler] [Area] [Clear] | [Fit] [Home]           │  ← React/Lucide
└─────────────────────────────────────────────────────────────┘
```

### Target Layout (Phase 4+)

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Title + Project Badge + Export Button               │
├──────────────────────────────────────┬──────────────────────┤
│                                      │ Products Panel       │
│                                      │ ┌──────────────────┐ │
│   Viewer3D Canvas                    │ │ [Product Card 1] │ │
│   (Floor Plan with markers)          │ │ [Product Card 2] │ │
│                                      │ │ [Product Card 3] │ │
│                                      │ │ ...              │ │
│                                      │ └──────────────────┘ │
├──────────────────────────────────────┴──────────────────────┤
│ Custom Toolbar: [Ruler] [Area] [Place] | [Fit] [Home]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Details

### PlannerViewer Component

**Location**: `src/components/planner/planner-viewer.tsx`

**Key Props:**
```typescript
interface PlannerViewerProps {
  file?: File                    // DWG file to upload
  urn?: string                   // Pre-uploaded URN
  theme?: 'light' | 'dark'       // Viewer theme
  onReady?: (viewer) => void     // Viewer instance callback
  onError?: (error) => void      // Error callback
  onViewerClick?: (worldCoords, screenCoords) => void  // Click handler
}
```

**Exported Types:**
```typescript
export type ViewerTool = 'pan' | 'orbit' | 'zoom' | 'select'
export interface WorldCoordinates { x: number; y: number; z: number }
export interface Viewer3DInstance { /* viewer methods */ }
```

### Icons Used (Lucide)

| Icon | Usage |
|------|-------|
| `Ruler` | Measure distance tool |
| `Square` | Measure area tool |
| `Trash2` | Clear measurement |
| `Maximize` | Fit to view |
| `Home` | Reset view |
| `Upload` | File drop zone |
| `FileIcon` | File info bar |
| `X` | Close button |
| `FolderOpen` | Project badge |
| `Loader2` | Loading spinner |
| `AlertCircle` | Error state |
| `CheckCircle2` | Cache hit indicator |

**Navigation Icon**: `MdEventNote` from react-icons/md (in sidebar)

---

## Viewer3D vs GuiViewer3D

| Aspect | GuiViewer3D | Viewer3D (our choice) |
|--------|-------------|----------------------|
| Built-in toolbar | Yes (inside canvas) | No |
| Customization | Limited | Full control |
| React integration | Awkward | Clean |
| Styling | Autodesk's CSS | Our Tailwind |
| Bundle size | Larger | Smaller |

**Tool Controller Methods:**
```typescript
viewer.toolController.activateTool('pan')    // Pan mode
viewer.toolController.activateTool('dolly')  // Zoom mode
viewer.toolController.activateTool('select') // Select mode
viewer.toolController.deactivateTool('pan')  // Deactivate
```

**Navigation Methods:**
```typescript
viewer.fitToView()                           // Fit all
viewer.navigation.setZoomTowardsPivot(true)  // Zoom behavior
```

**Coordinate Conversion:**
```typescript
viewer.clientToWorld(clientX, clientY)       // Screen → World
viewer.worldToClient({x, y, z})              // World → Screen
```

**Measurement Extension:**
```typescript
// Load extension on viewer init
const viewer = new Viewer3D(container, {
  extensions: ['Autodesk.Measure']
})

// Activate measurement modes
const measureExt = viewer.getExtension('Autodesk.Measure')
measureExt.activate('distance')  // Two-point distance
measureExt.activate('area')      // Polygon area
measureExt.deactivate()          // Exit measure mode

// Clear measurements
measureExt.deleteCurrentMeasurement()
```

---

## APS Viewer Flow

### With Project (Persistent Storage + Caching)

```
DWG File → Calculate SHA256 Hash
         → Check Database Cache
         ├─ Cache Hit → Return URN (INSTANT!)
         └─ Cache Miss → Create/Use Project Bucket
                       → Upload to OSS
                       → Start SVF2 Translation
                       → Save URN to Database
                       → Load in Viewer3D
```

- **Bucket**: `fossapp_prj_{project_id}` (PERSISTENT, never expires)
- **Caching**: SHA256 hash → URN mapping in database
- **Same file = instant load** (no re-translation)

### Without Project (Legacy Transient)

```
DWG File → Upload to OSS (transient bucket)
         → Start SVF2 Translation
         → Poll Translation Status
         → Load in Viewer3D
```

- **Bucket**: `fossapp-tile-viewer` (transient, 24-hour retention)

### Common Settings

- **Region**: EMEA (`streamingV2_EU`)
- **Environment**: `AutodeskProduction2`
- **Translation**: SVF2 with 2D/3D views

### Bucket Naming Rules (Autodesk OSS)

| Constraint | Requirement |
|------------|-------------|
| Length | 3-128 characters |
| Case | Lowercase only |
| Characters | `a-z`, `0-9`, `_` (no hyphens!) |
| Uniqueness | Globally unique across ALL Autodesk users |

---

## Database Schema

### Current (Phase 1) - Floor Plan Storage

Added to `projects.projects` table:

```sql
-- Migration: add_planner_fields_to_projects
ALTER TABLE projects.projects
ADD COLUMN oss_bucket TEXT,           -- 'fossapp_prj_{short_id}'
ADD COLUMN floor_plan_urn TEXT,       -- APS URN for viewer
ADD COLUMN floor_plan_filename TEXT,  -- Original filename
ADD COLUMN floor_plan_hash TEXT;      -- SHA256 for duplicate detection

CREATE INDEX idx_projects_floor_plan_hash
ON projects.projects(floor_plan_hash)
WHERE floor_plan_hash IS NOT NULL;
```

### Future (Phase 5) - Placements

```sql
CREATE TABLE planner_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects.projects(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,        -- Reference to product
  x NUMERIC NOT NULL,              -- World X coordinate
  y NUMERIC NOT NULL,              -- World Y coordinate
  rotation NUMERIC DEFAULT 0,      -- Rotation in degrees
  label TEXT,                      -- Optional label
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Key Technical Challenges

### 1. Coordinate Conversion
The Autodesk Viewer uses world coordinates. When user clicks/drops on canvas:
- Get screen coordinates from mouse event
- Convert to viewer's world coordinates using `viewer.clientToWorld()`
- Store world coordinates for persistence

### 2. Overlay Markers
Options for showing placed products:
- **HTML Overlays** - Position HTML elements over viewer (likely approach)
- **Viewer Markup Extension** - Native viewer overlays
- **Custom Extension** - Draw directly on viewer canvas

### 3. Drag Detection Over WebGL
The viewer is a WebGL canvas, not standard DOM:
- Need to detect drag-over events on the canvas element
- Convert drop coordinates to world space
- May need custom drag preview handling

---

## Dependencies

**NPM Packages:**
- `@aps_sdk/authentication` - APS auth
- `@aps_sdk/oss` - Object Storage
- `@aps_sdk/autodesk-sdkmanager` - SDK manager

**CDN (loaded dynamically):**
- `viewer3D.min.js` - Autodesk Viewer 7.x
- `style.min.css` - Viewer styles (minimal usage)

**UI Components:**
- `@/components/ui/button` - Toolbar buttons
- `@/components/ui/tooltip` - Button tooltips
- `@/components/ui/progress` - Translation progress
- Lucide icons - All toolbar icons

---

## Related Documentation

- [Tiles Feature](./tiles.md) - Similar APS infrastructure
- [Playground Feature](./playground.md) - DWG viewer modal implementation
- [APS Viewer API](https://aps.autodesk.com/en/docs/viewer/v7/)
- [APS Node.js SDK](https://github.com/autodesk-platform-services/aps-sdk-node)

---

## MarkupsCore Extension - Programmatic Markers (CRITICAL)

**Status**: Working - Key breakthrough for product placement

The Autodesk Viewer's `MarkupsCore` extension is the solution for placing markers that correctly follow pan/zoom in 2D views.

### Why MarkupsCore?

**The Problem**: In 2D mode, the viewer's pan operation doesn't update accessible camera/viewport properties. Methods like `worldToClient()`, `clientToWorld()`, and camera position return the same values during pan, making HTML overlays impossible to sync.

**The Solution**: MarkupsCore creates an SVG layer with the correct `viewBox` and `transform: scale(1, -1)` that automatically follows pan/zoom. Elements added to this SVG inherit the correct positioning.

### Critical Implementation Details

#### 1. Load the Extension

```typescript
const viewer = new window.Autodesk.Viewing.Viewer3D(container, {
  extensions: ['Autodesk.Measure', 'Autodesk.Viewing.MarkupsCore'],
})
```

#### 2. Enter Edit Mode (Creates SVG Layer)

```typescript
const markupExt = viewer.getExtension('Autodesk.Viewing.MarkupsCore')
markupExt.enterEditMode()
```

#### 3. CRITICAL: Set Z-Index on SVG

**Without this, the SVG renders BEHIND the WebGL canvas and is invisible!**

```typescript
const svg = markupExt.svg
svg.style.zIndex = '9999'
```

#### 4. Programmatic Circle Creation (Using Action Class)

**WRONG** - Direct instantiation doesn't attach to DOM properly:
```typescript
// DON'T DO THIS - circle won't be visible
const circle = new MarkupCircle(id, markupExt)
circle.set(position, size)
markupExt.addMarkup(circle)  // Added to data but NOT rendered!
```

**CORRECT** - Use the CreateCircle action class:
```typescript
const MarkupsCore = window.Autodesk.Viewing.Extensions.Markups.Core
const CreateCircle = MarkupsCore.CreateCircle

markupExt.beginActionGroup()

const id = markupExt.getId()
const position = { x: 105, y: 148 }  // Markup coordinates (NOT screen pixels!)
const size = { x: 30, y: 30 }
const rotation = 0
const style = {
  'stroke-width': 4,
  'stroke-color': '#00ff00',
  'stroke-opacity': 1,
  'fill-color': '#00ff00',
  'fill-opacity': 0.6
}

const createAction = new CreateCircle(markupExt, id, position, size, rotation, style)
createAction.execute()

markupExt.closeActionGroup()
```

#### 5. Custom SVG Elements (For Product Markers)

For custom markers with labels, add SVG elements directly to the markup group:

```typescript
const svg = markupExt.svg
const ns = 'http://www.w3.org/2000/svg'

// Create marker group
const g = document.createElementNS(ns, 'g')
g.setAttribute('id', 'product-marker-1')
g.setAttribute('transform', 'translate(150, 200)')  // Markup coordinates
g.style.cursor = 'pointer'

// Circle marker
const circle = document.createElementNS(ns, 'circle')
circle.setAttribute('r', '12')
circle.setAttribute('fill', '#3b82f6')
circle.setAttribute('stroke', '#ffffff')
circle.setAttribute('stroke-width', '2')

// Text label (flip Y due to scale(1,-1) on parent SVG)
const text = document.createElementNS(ns, 'text')
text.setAttribute('y', '-20')
text.setAttribute('text-anchor', 'middle')
text.setAttribute('fill', '#ffffff')
text.setAttribute('font-size', '10')
text.setAttribute('transform', 'scale(1, -1)')  // Flip text to be readable
text.textContent = 'Product Name'

g.appendChild(circle)
g.appendChild(text)

// Add to markup group (first <g> child of SVG)
const markupGroup = svg.querySelector('g')
markupGroup.appendChild(g)
```

### Coordinate System

The MarkupsCore SVG uses a custom coordinate system defined by its `viewBox`:

```
viewBox: "-29.078 -0.225 268.607 297.0"
         ↑        ↑      ↑        ↑
      minX     minY   width   height
```

- **Markup coordinates** are NOT screen pixels
- **Markup coordinates** roughly correspond to model/world units
- Use `markupExt.clientToMarkups(screenX, screenY)` to convert screen → markup coords
- Use `markupExt.markupsToClient(markupX, markupY)` to convert markup → screen coords

### Product Drag-Drop Flow

```
1. User drags product from sidebar
2. On drop over viewer canvas:
   - Get screen coordinates from drop event (e.clientX, e.clientY)
   - Convert to markup coords: markupExt.clientToMarkups(e.clientX, e.clientY)
   - Create custom SVG group at those coordinates
   - Store placement in database with markup coordinates
3. On viewer load:
   - Load placements from database
   - Create SVG groups at stored coordinates
   - They automatically follow pan/zoom!
```

### Available Action Classes

| Class | Description |
|-------|-------------|
| `CreateCircle` | Create circle/ellipse markup |
| `CreateRectangle` | Create rectangle markup |
| `CreateArrow` | Create arrow markup |
| `CreateText` | Create text markup |
| `CreateCloud` | Create revision cloud |
| `CreatePolyline` | Create polyline/freehand |
| `DeleteCircle` | Delete circle markup |

### Persistence

Markups can be saved and restored:

```typescript
// Save markups
const svgData = markupExt.generateData()  // Returns SVG string

// Restore markups
markupExt.loadMarkups(svgData, 'layer1')
```

### Database Schema (for product placements)

```sql
CREATE TABLE planner_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects.projects(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  markup_x NUMERIC NOT NULL,        -- Markup X coordinate (NOT world/screen!)
  markup_y NUMERIC NOT NULL,        -- Markup Y coordinate
  rotation NUMERIC DEFAULT 0,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Legacy: Markup Tools (Manual Drawing)

The extension also supports manual drawing tools for user annotations:

### Available Markup Tools

| Tool | Description |
|------|-------------|
| Arrow | Point to specific areas |
| Circle/Ellipse | Highlight circular regions |
| Rectangle | Highlight rectangular areas |
| Cloud | Revision cloud (common in CAD) |
| Polyline/Freehand | Free drawing |
| Text | Add labels and notes |
| Highlight | Semi-transparent overlay |

### Manual Drawing Mode

```typescript
// Enter circle drawing mode
const EditModeCircle = window.Autodesk.Viewing.Extensions.Markups.Core.EditModeCircle
const circleMode = new EditModeCircle(markupExt)
markupExt.changeEditMode(circleMode)

// User clicks and drags to draw circles
// Circles automatically follow pan/zoom
```

### Use Cases

- Annotate floor plans with installation notes
- Mark product placement zones before actual placement
- Add text labels for areas (e.g., "Reception", "Meeting Room")
- Draw cable routing paths
- Highlight problem areas or special requirements

---

## Notes

- Floor plan DWGs are typically 2D layouts (ironic use of Viewer**3D**)
- Viewer3D gives us full UI control vs GuiViewer3D's built-in toolbar
- Product symbols could come from the symbol-generator feature
- Mouse navigation: drag to pan, scroll to zoom (AutoCAD-style UX)
- May need to handle different DWG units (mm, inches, etc.)

---

**Last Updated**: 2025-12-17 (Added MarkupsCore programmatic markers - CRITICAL z-index fix, action classes, custom SVG markers)
