# Case Study - Design Document

**Status:** In Development
**Created:** 2026-01-01
**Branch:** `feature/case-study`
**Route:** `/case-study`

---

## 1. Vision

> _What is the planner and why does it exist?_

FOSSAPP is a lighting design platform. The Case Study (Planner V2) is where users visualize product placements on architectural floor plans and prepare deliverables for AutoCAD.

---

## 2. Target Users

| User Type | Technical Level | Primary Goal |
|-----------|-----------------|--------------|
| Lighting Designer | Expert AutoCAD user | Place products on floor plans, generate DWG deliverables |

---

## 3. App Model (Important Context)

- **ONE project per browser tab** - No project switching. New tab = new project.
- **Products belong to Areas** - Not to Project directly
- **`/` command palette** - Quick search works globally anywhere in the app

---

## 4. Current Pain Points

> _What's wrong with the current planner?_

- [x] Large monolithic files (937+ lines in single component)
- [x] 12+ useState hooks in one file
- [x] 15+ useEffect hooks tightly coupled
- [x] Difficult to test individual features
- [x] Hard to iterate on UI without breaking logic

---

## 5. User Workflow

### Pre-Planner Setup

```
Step 1: Create Project → Bind to Customer
Step 2: Project becomes "current" (one per tab)
Step 3: Create Areas ("Ground Floor", "Garden", etc.)
Step 4: Each Area gets:
        ├── Architectural DWG (from client)
        └── Products (added via Products page or `/` quick search)
```

### Planner Workflow

```
Step 5: Upload architectural DWG (client's floor plan)
Step 6: View products panel (auto-assigned symbols: A1, A2, B1, N1...)
Step 7: Generate symbol drawings (modal → DWG/PNG/SVG)
Step 8: Place products on viewer (click-to-place, real-size symbols)
Step 9: Create tiles (photo + drawing + accessories + text)
Step 10: Press MAGIC BUTTON ✨
         ↓
Output: Professional DWG
        ├── Model Space: Floor plan + symbol drawings at coords
        └── Paper Space: Tile table (BOM-like) above title block
```

---

## 6. Page Layout

### Two Switchable Views

The page has two main views, toggled via toolbar. This keeps UI light and tablet-friendly.

---

### VIEW 1: Products View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Area ▼] │ [📋 Products | 🗺️ Viewer] │ [Upload DWG] [✨ Generate] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LUMINAIRES  ──────────────────────────────────────────────────────────────▶│
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐     │
│  │[Symbol] │ │[Symbol] │ │  A3     │ │[Symbol] │ │   N1    │ │  [+]  │     │
│  │  A1     │ │  A2     │ │ MINI    │ │  B1     │ │  TRACK  │ │  Add  │ ←───│
│  │ BOXY    │ │ BOXY S  │ │ GRID    │ │ PEND    │ │         │ │       │     │
│  │─────────│ │─────────│ │─────────│ │─────────│ │─────────│ └───────┘     │
│  │[Tile]   │ │ No tile │ │[Tile]   │ │ No tile │ │ No tile │   ← Horizontal│
│  │ preview │ │         │ │ preview │ │         │ │         │      scroll   │
│  │─────────│ │─────────│ │─────────│ │─────────│ │─────────│               │
│  │ 3/5 [+][-]│ │ 0/3 [+][-]│ │ 8/8 ✓  │ │ 1/2 [+][-]│ │ 2/4 [+][-]│               │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘               │
│                                                                              │
│  ACCESSORIES & DRIVERS  ───────────────────────────────────────────────────▶│
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌───────┐                 │
│  │ Driver  │ │ Optic   │ │ Optic   │ │ Mount   │ │  [+]  │                 │
│  │ 350mA   │ │ 24°     │ │ 36°     │ │ Bracket │ │  Add  │ ← Horizontal   │
│  │ DALI    │ │ Narrow  │ │ Medium  │ │         │ │       │      scroll    │
│  │─────────│ │─────────│ │─────────│ │─────────│ └───────┘                 │
│  │ Qty: 5 [+][-]│ │ Qty: 5 [+][-]│ │ Qty: 3 [+][-]│ │ Qty: 2 [+][-]│                 │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Horizontal scroll for both luminaires and accessories (scales to 100s of products)
- Product cards show: Symbol drawing + Tile preview (both as SVG if available)
- Placement progress bar (3/5) with inline `[+][-]` controls
- `[+ Add]` card at end opens quick search (`/`)

---

### VIEW 2: Viewer View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOOLBAR: [Area ▼] │ [📋 Products | 🗺️ Viewer] │ [Upload DWG] [✨ Generate] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────┐ ┌────────────────┐ │
│  │                                                     │ │ PRODUCTS PANEL │ │
│  │                                                     │ │ (pick & place) │ │
│  │                                                     │ │                │ │
│  │              DWG VIEWER                             │ │ ┌────────────┐ │ │
│  │              (AutoCAD-like)                         │ │ │ A1 BOXY   │ │ │
│  │                                                     │ │ │ 3/5 [Place]│ │ │
│  │         Floor plan + placed symbols                 │ │ └────────────┘ │ │
│  │         (A1)    (B1)    (N1)                        │ │ ┌────────────┐ │ │
│  │                   (A1)                              │ │ │ A2 MINI   │ │ │
│  │                          (A3)                       │ │ │ 0/3 [Place]│ │ │
│  │                                                     │ │ └────────────┘ │ │
│  │  ┌─────────────────────────────────┐               │ │ ┌────────────┐ │ │
│  │  │ [Select][Pan][Zoom+][Zoom-][Fit]│               │ │ │ B1 PEND   │ │ │
│  │  └─────────────────────────────────┘               │ │ │ 1/2 [Place]│ │ │
│  │                                                     │ │ └────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │                │ │
│                                                          │ [+ Add]        │ │
├──────────────────────────────────────────────────────────┴────────────────┤ │
│ STATUS: X: 4521.32  Y: 2847.91 mm │ Mode: Place A1 │ [Esc] Cancel         │ │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Status bar with coordinates (only in Viewer, not in Products view)
- Right panel shows luminaires for pick-and-place
- Viewer toolbar for navigation (pan, zoom, fit)
- Placement mode indicator + cancel option

---

### Product Card Design (Luminaire)

```
┌───────────────────────────┐
│      [Symbol SVG]         │  ← Generated symbol drawing (or letter badge)
│         A1                │
│        ████               │
│       ██████              │
├───────────────────────────┤
│      [Tile Preview]       │  ← Mini tile assembly preview (SVG)
│   ┌─────┐                 │
│   │Lum  │ + Driver        │
│   │     │ + Optic         │
│   └─────┘                 │
├───────────────────────────┤
│  BOXY XL                  │
│  MY8204045139             │
│  ─────────────────────    │  ← Placement progress
│  Placed: 3/5   [+] [-]    │
├───────────────────────────┤
│ [🎨 Symbol] [📦 Tile]     │  ← Action buttons (open modals)
└───────────────────────────┘
```

### Product Card Design (Accessory/Driver)

```
┌───────────────────────────┐
│       [Product Image]     │
│          📦               │
├───────────────────────────┤
│  Driver 350mA DALI        │
│  DRV350MA-DALI            │
│                           │
│  Qty: 5        [+] [-]    │
├───────────────────────────┤
│      [📦 Add to Tile]     │  ← Single action (add to existing tile)
└───────────────────────────┘
```

---

### Panel Details

| Panel | Contents | Notes |
|-------|----------|-------|
| **Toolbar** | Area selector, view toggle, upload, generate | Always visible |
| **Products View** | Horizontal scroll of luminaires + accessories | Scales to 100s of items |
| **Viewer View** | DWG canvas + right panel for placement | AutoCAD-like feel |
| **Status Bar** | Coordinates, mode, cancel | Only in Viewer view |

---

## 7. UX Principles (CRITICAL)

### No Locks / No Dead Ends

| Situation | BAD UX ❌ | GOOD UX ✅ |
|-----------|----------|-----------|
| Product has no symbol SVG | "Cannot place - generate symbol first" | Show letter badge (A1), placement works |
| Need more quantity | "Go to Projects → Area → Edit products" | `[+]` button inline, instant add |
| DWG not uploaded yet | Empty viewer, nothing works | Show product panel anyway, prompt upload |
| Symbol generation fails | Blocked | Log error, continue with letter fallback |

### AutoCAD Familiarity

- Coordinate display (X, Y in model units)
- Pan/zoom feels like CAD
- Keyboard shortcuts (Esc = cancel, R = rotate, Del = delete)
- Real-size symbols (not screen-fixed icons)

### Everything Works at Any State

- No required sequence (can place before generating symbols)
- Partial data OK (some products placed, some not)
- Save anytime, resume anytime

---

## 8. Product Types & Their Roles

### In the Products Panel

| Type | Gets Symbol? | Placed on Viewer? | Goes in Tiles? |
|------|--------------|-------------------|----------------|
| **Luminaires** | Yes (A1, B1, N1...) | Yes (with symbol drawing) | Yes (as main item) |
| **Drivers** | No | No | Yes (as accessory) |
| **Accessories** | No | No | Yes (as accessory) |
| **Optics** | No | No | Yes (as accessory) |

### Symbol Letters (ETIM-based)

| Letter | Category | Example |
|--------|----------|---------|
| A | Interior Spots | Recessed downlight |
| B | Suspension | Pendant |
| C | Exterior Spots | IP65+ spot |
| N | Track Light | Track system |
| ... | (see symbol_rules table) | |

---

## 9. Tile System (Integrated in Planner)

### What is a Tile?

A tile is a **vertical assembly** of a luminaire + its accessories for the BOM table.

```
┌─────────────────────────────────────────┐
│  TILE: "A1 - BOXY Package"              │
├─────────────────────────────────────────┤
│  ┌─────────┐                            │
│  │ Drawing │  BOXY Luminaire            │
│  │  Photo  │  MY8204045139              │
│  └─────────┘  "Main spotlight"          │
├─────────────────────────────────────────┤
│  ┌─────────┐                            │
│  │ Drawing │  LED Driver 350mA          │
│  │  Photo  │  DRV350MA-DALI             │
│  └─────────┘  "DALI dimmable"           │
├─────────────────────────────────────────┤
│  ┌─────────┐                            │
│  │ Drawing │  Optic 24° Narrow          │
│  │  Photo  │  OPT-24-BOXY               │
│  └─────────┘                            │
└─────────────────────────────────────────┘
```

### Tile Creation in Planner

- Drag-and-drop from products panel to tile builder
- Group luminaire + its drivers/accessories
- Reorder, add notes
- Each luminaire symbol (A1) links to its tile

---

## 10. File Structure

```
src/app/case-study/
├── page.tsx                    # Redirect → /gf/products
├── types.ts                    # ~210 lines - Types + mock data
├── components/
│   ├── index.ts                # Barrel export
│   ├── case-study-toolbar.tsx  # ~107 lines - Area selector, view toggle, buttons
│   ├── products-view.tsx       # ~95 lines - Horizontal scroll container
│   ├── viewer-view.tsx         # ~270 lines - DWG canvas + right panel
│   ├── luminaire-card.tsx      # ~130 lines - Symbol + tile preview + actions
│   ├── accessory-card.tsx      # ~94 lines - Simpler card for drivers/optics
│   ├── status-bar.tsx          # ~48 lines - Coordinates display
│   ├── symbol-modal.tsx        # (Phase 5) Symbol generation
│   └── tile-modal.tsx          # (Phase 5) Tile assembly
├── hooks/
│   ├── index.ts                # Barrel export
│   ├── use-case-study-state.ts # ~173 lines - Data state management
│   └── use-viewer-controls.ts  # ~173 lines - Viewer interactions
└── [areaCode]/                 # URL-based routing
    ├── layout.tsx              # ~17 lines - Server component wrapper
    ├── case-study-shell.tsx    # ~95 lines - Client shell + context
    ├── page.tsx                # Redirect → products
    ├── products/
    │   └── page.tsx            # ~26 lines - Products view route
    └── viewer/
        └── page.tsx            # ~24 lines - Viewer route
```

**Actual**: ~1,517 lines across 16 files (~95 lines average) ✅
**Compare**: Current planner has 2,575 lines in 3 files (~858 lines average)

---

## 11. Development Phases

### Phase 1: UI Shell (Mock Data) ✅ COMPLETE

Build UI components with hardcoded mock data. Focus on layout and interactions.

| Task | File | Status |
|------|------|--------|
| Create page with view toggle | `page.tsx` | [x] |
| Toolbar component | `case-study-toolbar.tsx` | [x] |
| Products view (horizontal scroll) | `products-view.tsx` | [x] |
| Luminaire card | `luminaire-card.tsx` | [x] |
| Accessory card | `accessory-card.tsx` | [x] |
| Viewer view with right panel | `viewer-view.tsx` | [x] |
| Status bar | `status-bar.tsx` | [x] |
| Symbol modal (shell) | `symbol-modal.tsx` | [ ] deferred to Phase 5 |
| Tile modal (shell) | `tile-modal.tsx` | [ ] deferred to Phase 5 |

### Phase 2: State & Hooks (Real Types) ✅ COMPLETE

Wire up state management with proper TypeScript types. Added URL-based routing.

| Task | File | Status |
|------|------|--------|
| Define local types | `types.ts` | [x] |
| Main state hook | `use-case-study-state.ts` | [x] |
| Viewer controls hook | `use-viewer-controls.ts` | [x] |
| Connect components to state | All components | [x] |
| URL-based routing | `[areaCode]/products\|viewer` | [x] |
| Server/client split (hydration fix) | `layout.tsx` + `case-study-shell.tsx` | [x] |

### Phase 3: Data Integration (Supabase)

Connect to real data from the database.

| Task | Status |
|------|--------|
| Fetch area products | [ ] |
| Fetch/save placements | [ ] |
| Fetch/save tiles | [ ] |
| Area selector with real data | [ ] |
| Quantity updates (inline +/-) | [ ] |

### Phase 4: Viewer Integration (DWG)

Integrate Autodesk Forge viewer for DWG display.

| Task | Status |
|------|--------|
| DWG upload component | [ ] |
| Forge viewer setup | [ ] |
| Symbol placement on viewer | [ ] |
| Click-to-place interaction | [ ] |
| Coordinate tracking | [ ] |
| Pan/zoom controls | [ ] |

### Phase 5: Polish & Migration

Final touches and migration from old planner.

| Task | Status |
|------|--------|
| Keyboard shortcuts | [ ] |
| Symbol generation (copy from existing) | [ ] |
| Tile builder (copy from tiles page) | [ ] |
| Magic generate button | [ ] |
| Rename routes (`/case-study` → `/planner`) | [ ] |
| Archive old planner (`/planner-legacy`) | [ ] |

---

## 12. Core Features Checklist

### Must Have (MVP)

- [ ] Upload/view architectural DWG
- [ ] Products panel with auto-assigned symbols (A1, A2, B1...)
- [ ] Inline quantity adjustment `[+][-]`
- [ ] Click-to-place luminaires on viewer
- [ ] Symbol display: SVG (real-size) or letter fallback
- [ ] Save placements (coords, rotation) to database
- [ ] Generate symbol modal (existing feature)
- [ ] Status bar with coordinates
- [ ] Area selector dropdown

### Should Have (MVP+)

- [ ] Tile builder panel (drag-and-drop assembly)
- [ ] Keyboard shortcuts (R=rotate, Del=delete, Esc=cancel)
- [ ] Inline product search (`/` or `[+ Add]` button)

### Nice to Have (V2.1+)

- [ ] Magic Generate button (final DWG output)
- [ ] Multi-select and bulk operations
- [ ] Snap to grid option
- [ ] Layers visibility toggle

### Out of Scope (V3+)

- [ ] Real-time collaboration
- [ ] Version comparison view
- [ ] 3D preview
- [ ] PDF export

---

## 13. References

- Current planner: `src/app/planner/page.tsx`
- Tiles page (for tile UI): `src/app/tiles/page.tsx`
- Test mockup: `src/app/planner-v2-test/page.tsx` (DELETE after Phase 1)
- Previous attempt: `feature/planner-v2` branch (reference only)

---

## Revision History

| Date | Change |
|------|--------|
| 2026-01-01 | Initial skeleton created |
| 2026-01-01 | Added layout diagrams, UX principles |
| 2026-01-01 | Added file structure and development phases |
| 2026-01-01 | Phase 1 complete - UI shell with mock data |
| 2026-01-02 | Phase 2 complete - State hooks, URL-based routing, hydration fix |

