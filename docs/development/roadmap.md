# Development Roadmap

Internal tracking for planned improvements, tech debt, and future features.

**Last Updated**: 2026-01-10

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `planned` | Approved, not started |
| `in-progress` | Currently being worked on |
| `blocked` | Waiting on dependency |
| `done` | Completed (move to changelog) |

---

## High Priority

_No high-priority items currently planned._

---

## Tech Debt

_No tech debt items currently planned._

---

## Future Enhancements

_Items here are ideas, not yet approved for implementation._

### Case Study: Origin Indicator Settings
- **Description**: Allow users to customize the origin indicator (0,0 crosshair) in Case Study viewer
- **Location**: `/settings/view` page
- **Settings**:
  - Color picker (default: green-500 `#22c55e`)
  - Size in mm (default: 125mm)
  - Toggle visibility on/off
- **Current implementation**: `src/components/case-study-viewer/origin-indicator.ts`
- **Design**: Classic CAD origin symbol - crosshair with quartered circle, opposite quadrants filled
- **Effort**: Low

### Case Study: Marker Mirroring (X/Y Keys)
- **Description**: Allow mirroring markers horizontally (X key) and vertically (Y key) in Case Study viewer
- **Database**: `mirror_x` and `mirror_y` boolean columns already added to `projects.planner_placements`
- **Implementation**: Extend `Edit2DMarkers` to support mirroring transforms, similar to rotation (R key)
- **Keyboard shortcuts**: X = mirror horizontal, Y = mirror vertical (toggle)
- **Effort**: Medium

### Case Study: User-Configurable Highlight Styles
- **Description**: Allow users to customize marker highlight styles (hover, selection, preview colors and line widths)
- **Location**: `/settings/view` page
- **Current defaults**: Defined in `src/components/case-study-viewer/edit2d-markers/style-manager.ts` (`STYLE_CONSTANTS`)
  - Hover: Blue-500, line width 5
  - Selected: Green-500, line width 2.5
  - Preview: Sky-400, line width 2
- **Edit2D Style Properties**:
  - `fillColor` (string) - Fill color
  - `fillAlpha` (0-1) - Fill opacity
  - `lineColor` (string) - Stroke color
  - `lineAlpha` (0-1) - Stroke opacity
  - `lineWidth` (number) - Stroke width in pixels
  - `lineStyle` (number) - Line pattern: 0=solid, 4=dashed (other values undocumented)
- **Implementation**: Store user prefs in database, merge with defaults at runtime
- **Effort**: Low-Medium

### Add Query Timeouts
- **Description**: Add timeout handling to database queries to prevent hanging
- **Example**: `AbortSignal.timeout(10000)` on Supabase calls
- **Effort**: Medium

### Improved Error Messages
- **Description**: More specific user-facing error messages based on PostgreSQL error codes
- **Example**: "A project with this code already exists" instead of generic "Failed to create project"
- **Effort**: Low

---

## Completed

_Move items here when done, then transfer to release notes._

### Remove Development Console.log Statements
- **Status**: `done`
- **Completed**: 2026-01-04
- **Release**: v1.13.x
- **Description**: Removed console.log statements from production code
- **Files cleaned**:
  - `src/lib/tiles/google-drive-tile-service.ts` (8 statements)
  - `packages/tiles/src/progress/progress-store.ts` (2 statements)
  - `src/components/case-study-viewer/case-study-viewer.tsx` (already clean)
- **Note**: `progress-store.ts` moved to packages during monorepo migration

### AI-Powered Feedback Assistant
- **Status**: `done`
- **Completed**: 2025-12
- **Release**: v1.12.x
- **Description**: Conversational AI bot that guides users through feature requests and bug reports
- **Implementation**:
  - `src/app/api/feedback/chat/route.ts` - streaming chat endpoint
  - `src/components/feedback/feedback-chat-panel.tsx` - chat UI
  - `src/lib/feedback/agent.ts` - Claude-powered agent logic
  - `src/lib/feedback/knowledge-base.ts` - app knowledge for AI context
- **Docs**: [features/feedback-assistant.md](../features/feedback-assistant.md)

### Migrate Products Page Search to Full-Text Search
- **Status**: `done`
- **Completed**: 2025-12
- **Release**: v1.12.x
- **Description**: Replaced ILIKE-based search with `search.search_products_fts` RPC function
- **Implementation**: `packages/products/src/actions/index.ts`
- **Benefit**: 3-5x faster search on 56K+ products

---

## How to Use This Document

1. **Adding items**: Add under appropriate section with status `planned`
2. **Starting work**: Change status to `in-progress`
3. **Completing work**: Move to "Completed" section, update release notes
4. **Quarterly review**: Archive old completed items, reprioritize backlog
