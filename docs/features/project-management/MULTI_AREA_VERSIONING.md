# Multi-Area Project Revisioning

**Status**: ✅ Implemented
**Last Updated**: 2025-12-28
**Migration**: `20251228120000_rename_version_to_revision.sql`

---

## Overview

This feature implements **independent revisioning for project areas**, allowing each area within a project (floors, gardens, zones, etc.) to maintain its own revision history. This is essential for lighting design workflows where different areas of a project iterate at different rates.

### Key Concept

Instead of revisioning the entire project, we revision individual **areas**:

```
Project: Luxury Villa
├─ Ground Floor (GF)  → RV1, RV2, RV3 (current)
├─ First Floor (F1)   → RV1, RV2 (current)
└─ Garden (GARDEN)    → RV1 (current)
```

Each revision contains its own set of products, allowing designers to iterate on specific areas without affecting others.

---

## Architecture

### Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AREA REVISIONING MODEL                   │
└─────────────────────────────────────────────────────────────────┘

projects
  └─ project_areas (logical areas)
      ├─ id
      ├─ area_code (GF, F1, GARDEN)
      ├─ current_revision (active revision number)
      └─ project_area_revisions (revision history)
          ├─ revision_number (1, 2, 3...)
          ├─ google_drive_folder_id
          └─ project_products (products for this revision)
              └─ area_revision_id → links to specific revision
```

### Database Schema

#### `projects.project_areas`

Represents a logical area within a project.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `project_id` | UUID | Reference to project |
| `area_code` | VARCHAR(50) | Unique code (e.g., "GF", "F1") |
| `area_name` | VARCHAR(255) | Display name (e.g., "Ground Floor") |
| `area_type` | VARCHAR(50) | Type: floor, outdoor, room, etc. |
| `floor_level` | INTEGER | Floor number (-1=basement, 0=ground, 1+) |
| `current_revision` | INTEGER | Currently active revision number |
| `display_order` | INTEGER | Custom ordering |

**Constraints**:
- `UNIQUE(project_id, area_code)` - Area codes unique per project
- `CHECK(current_revision > 0)` - Revision numbers start at 1

#### `projects.project_area_revisions`

Represents a specific revision of an area.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `area_id` | UUID | Reference to area |
| `revision_number` | INTEGER | Revision number (1, 2, 3...) |
| `revision_name` | VARCHAR(255) | Optional name ("Initial", "Rev A") |
| `notes` | TEXT | Revision description/changes |
| `google_drive_folder_id` | TEXT | Drive folder for this revision |
| `status` | VARCHAR(50) | draft, submitted, approved, archived |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `created_by` | TEXT | Creator email |

**Constraints**:
- `UNIQUE(area_id, revision_number)` - Revision numbers unique per area
- `CHECK(revision_number > 0)` - Revision numbers start at 1

#### `projects.project_products` (Modified)

Links products to specific area revisions.

| Column (New) | Type | Description |
|--------------|------|-------------|
| `area_revision_id` | UUID | Reference to area revision (nullable) |

**Relationship**: `NULL` = unassigned product, otherwise links to specific revision.

---

## Automatic Behaviors

### Trigger: Create Initial Revision

When a new area is created, **revision 1 is automatically created**:

```sql
CREATE TRIGGER create_initial_revision
  AFTER INSERT ON projects.project_areas
  FOR EACH ROW
  EXECUTE FUNCTION projects.create_initial_area_revision();
```

This ensures every area always has at least one revision.

### Helper Function: Revision Summary

Get product count and total cost for a revision:

```sql
SELECT * FROM projects.get_area_revision_summary('area-revision-uuid');
-- Returns: { product_count: 18, total_cost: 2450.00 }
```

---

## Server Actions

### Area Management

Located in: `src/lib/actions/areas/`

#### Create Area

```typescript
import { createAreaAction } from '@/lib/actions'

const result = await createAreaAction({
  project_id: 'project-uuid',
  area_code: 'GF',
  area_name: 'Ground Floor',
  area_type: 'floor',
  floor_level: 0,
  area_sqm: 120.5,
  ceiling_height_m: 3.2,
  created_by: 'user@example.com'
})
// Returns: { success: true, data: { id: 'area-uuid', revision_id: 'rv1-uuid' } }
// Note: Revision 1 is auto-created!
```

#### Update Area

```typescript
const result = await updateAreaAction('area-uuid', {
  area_name: 'Ground Floor - Updated',
  area_sqm: 125.0
})
```

#### Delete Area

```typescript
// Deletes area and ALL revisions (CASCADE)
const result = await deleteAreaAction('area-uuid')
```

### Revision Management

#### Create New Revision

```typescript
import { createAreaRevisionAction } from '@/lib/actions'

// Create RV2 by copying products from RV1
const result = await createAreaRevisionAction({
  area_id: 'area-uuid',
  copy_from_revision: 1,  // Copy products from RV1
  revision_name: 'Client Revision',
  notes: 'Added dimmer controls per client request',
  created_by: 'designer@example.com'
})
// Returns: { success: true, data: { id: 'rv2-uuid', revision_number: 2 } }
// area.current_revision is automatically updated to 2
```

#### Switch Current Revision

```typescript
import { setAreaCurrentRevisionAction } from '@/lib/actions'

// Make RV1 the current revision
const result = await setAreaCurrentRevisionAction('area-uuid', 1)
// Updates area.current_revision = 1
```

#### Get Revision History

```typescript
import { getAreaRevisionsAction } from '@/lib/actions'

const result = await getAreaRevisionsAction('area-uuid')
// Returns: {
//   success: true,
//   data: [
//     { revision_number: 3, product_count: 18, total_cost: 2450, ... },
//     { revision_number: 2, product_count: 16, total_cost: 2200, ... },
//     { revision_number: 1, product_count: 12, total_cost: 1800, ... }
//   ]
// }
```

#### Delete Revision

```typescript
import { deleteAreaRevisionAction } from '@/lib/actions'

// Can only delete non-current revisions
const result = await deleteAreaRevisionAction('revision-uuid')
// Error if revision is current: "Cannot delete the current active revision"
```

### Product-Area Assignment

#### Add Product to Area Revision

```typescript
import { addProductToProjectAction } from '@/lib/actions'

const result = await addProductToProjectAction({
  project_id: 'project-uuid',
  product_id: 'product-uuid',
  area_revision_id: 'rv2-uuid',  // Assign to specific revision
  quantity: 10,
  room_location: 'Living Room'  // Optional sub-area detail
})
```

---

## UI Components

### `ProjectAreasCard`

Main interface for managing areas.

**Location**: `src/components/projects/project-areas-card.tsx`

**Features**:
- List all areas with current revision info
- Show product count and cost per area
- Create new area (opens `AreaFormDialog`)
- Edit area metadata
- Create new revision (with product copy option)
- View revision history (opens `AreaRevisionHistoryDialog`)
- Delete area

**Usage**:
```tsx
<ProjectAreasCard
  projectId={project.id}
  projectCode={project.project_code}
  areas={project.areas}
  onAreaChange={loadProject}
/>
```

### `AreaFormDialog`

Dialog for creating/editing areas.

**Location**: `src/components/projects/area-form-dialog.tsx`

**Fields**:
- Area Code (required, unique)
- Area Name (required)
- Area Type (dropdown)
- Floor Level (number)
- Area Size (m²)
- Ceiling Height (m)
- Description
- Notes

**Usage**:
```tsx
<AreaFormDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  projectId={project.id}
  area={editingArea}  // null for create, area object for edit
  onSuccess={handleSuccess}
/>
```

### `AreaRevisionHistoryDialog`

Timeline view of all revisions for an area.

**Location**: `src/components/projects/area-revision-history-dialog.tsx`

**Features**:
- Shows all revisions in descending order
- Current revision highlighted
- Product count and cost per revision
- Creation date and creator
- Actions:
  - Set as current (for non-current revisions)
  - Delete (for non-current revisions only)

**Usage**:
```tsx
<AreaRevisionHistoryDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  areaId={area.id}
  onRevisionChange={loadProject}
/>
```

---

## Google Drive Integration

### Folder Structure

```
HUB/
└─ Projects/
    └─ 2512-001_Luxury_Villa/
        ├─ General/              # Project-level documents
        └─ Areas/
            ├─ GF/               # Ground Floor
            │   ├─ RV1/
            │   │   ├─ BOM_GF_RV1.xlsx
            │   │   └─ Layout_GF_RV1.pdf
            │   ├─ RV2/
            │   │   ├─ BOM_GF_RV2.xlsx
            │   │   └─ Layout_GF_RV2.pdf
            │   └─ RV3/           # Current revision
            │       ├─ BOM_GF_RV3.xlsx
            │       └─ Layout_GF_RV3.pdf
            ├─ F1/               # First Floor
            │   ├─ RV1/
            │   └─ RV2/           # Current revision
            └─ GARDEN/
                └─ RV1/           # Current revision
```

### Folder IDs

- `project_areas.google_drive_folder_id` - NOT used (can be removed)
- `project_area_revisions.google_drive_folder_id` - Stores folder ID for each revision

---

## Workflows

### Creating a Project with Areas

```typescript
// 1. Create project
const project = await createProjectWithDriveAction({
  name: 'Luxury Villa',
  customer_id: 'customer-uuid',
  // ... other fields
})

// 2. Create areas
const gf = await createAreaAction({
  project_id: project.id,
  area_code: 'GF',
  area_name: 'Ground Floor',
  floor_level: 0
})
// Auto-creates RV1 for GF

const f1 = await createAreaAction({
  project_id: project.id,
  area_code: 'F1',
  area_name: 'First Floor',
  floor_level: 1
})
// Auto-creates RV1 for F1

// 3. Add products to revisions
await addProductToProjectAction({
  project_id: project.id,
  product_id: 'downlight-uuid',
  area_revision_id: gf.revision_id,  // GF RV1
  quantity: 10
})

await addProductToProjectAction({
  project_id: project.id,
  product_id: 'wall-light-uuid',
  area_revision_id: f1.revision_id,  // F1 RV1
  quantity: 6
})
```

### Iterating on an Area

```typescript
// Client requests changes to Ground Floor only

// 1. Create new revision, copy products from RV1
const rv2 = await createAreaRevisionAction({
  area_id: gf.id,
  copy_from_revision: 1,
  notes: 'Client requested dimmer controls',
  created_by: 'designer@example.com'
})
// GF is now at RV2 (current_revision = 2)
// F1 is still at RV1 (unaffected)

// 2. Modify products in RV2
await addProductToProjectAction({
  project_id: project.id,
  product_id: 'dimmer-uuid',
  area_revision_id: rv2.data.id,  // GF RV2
  quantity: 5
})

// 3. View project: shows GF RV2 + F1 RV1
```

### Comparing Revisions

```typescript
// Get all revisions for Ground Floor
const revisions = await getAreaRevisionsAction(gf.id)

// revisions.data:
// [
//   { revision_number: 2, product_count: 15, total_cost: 2200 },
//   { revision_number: 1, product_count: 10, total_cost: 1800 }
// ]

// Switch to RV1 to compare
await setAreaCurrentRevisionAction(gf.id, 1)
// Now viewing GF RV1 + F1 RV1

// Switch back to RV2
await setAreaCurrentRevisionAction(gf.id, 2)
// Back to GF RV2 + F1 RV1
```

---

## Business Rules

### Safety Constraints

1. **Cannot delete current revision**
   ```typescript
   // If GF current_revision = 2
   await deleteAreaRevisionAction(rv2_id)
   // Error: "Cannot delete the current active revision"
   ```

2. **Area codes are unique per project**
   ```typescript
   // If "GF" already exists in project
   await createAreaAction({ project_id, area_code: 'GF', ... })
   // Error: "An area with this code already exists in this project"
   ```

3. **Revision numbers are immutable**
   - Once created, revision numbers never change
   - No renumbering when revisions are deleted

### Cascade Delete

1. **Deleting an area** → Deletes all revisions → Deletes all products in those revisions
2. **Deleting a revision** → Deletes all products in that revision

---

## Database Queries

### Get Project with Current Revisions

```sql
SELECT
  p.id AS project_id,
  p.name AS project_name,
  pa.id AS area_id,
  pa.area_code,
  pa.area_name,
  pa.current_revision,
  par.id AS current_revision_id,
  par.revision_name,
  par.notes,
  COUNT(pp.id) AS product_count,
  SUM(pp.total_price) AS total_cost
FROM projects.projects p
JOIN projects.project_areas pa ON p.id = pa.project_id
JOIN projects.project_area_revisions par
  ON pa.id = par.area_id AND pa.current_revision = par.revision_number
LEFT JOIN projects.project_products pp ON par.id = pp.area_revision_id
WHERE p.id = $1
GROUP BY p.id, pa.id, par.id
ORDER BY pa.display_order, pa.floor_level;
```

### Get All Products for Current Revisions

```sql
SELECT
  pp.*,
  pa.area_code,
  pa.area_name,
  par.revision_number
FROM projects.project_products pp
JOIN projects.project_area_revisions par ON pp.area_revision_id = par.id
JOIN projects.project_areas pa ON par.area_id = pa.id
WHERE pa.project_id = $1
  AND pa.current_revision = par.revision_number
ORDER BY pa.display_order, pp.room_location;
```

### Compare Two Revisions of an Area

```sql
-- Get products in RV1 vs RV2
WITH rv1_products AS (
  SELECT product_id, quantity
  FROM projects.project_products pp
  JOIN projects.project_area_revisions par ON pp.area_revision_id = par.id
  WHERE par.area_id = $1 AND par.revision_number = 1
),
rv2_products AS (
  SELECT product_id, quantity
  FROM projects.project_products pp
  JOIN projects.project_area_revisions par ON pp.area_revision_id = par.id
  WHERE par.area_id = $1 AND par.revision_number = 2
)
SELECT
  COALESCE(rv1.product_id, rv2.product_id) AS product_id,
  rv1.quantity AS rv1_qty,
  rv2.quantity AS rv2_qty,
  COALESCE(rv2.quantity, 0) - COALESCE(rv1.quantity, 0) AS diff
FROM rv1_products rv1
FULL OUTER JOIN rv2_products rv2 ON rv1.product_id = rv2.product_id;
```

---

## Migration

### Running the Migration

```bash
# Connect to Supabase database
psql $DATABASE_URL -f supabase/migrations/20251228120000_rename_version_to_revision.sql
```

### Migration Contents

1. Renames `project_area_versions` table to `project_area_revisions`
2. Renames columns: `version_number` → `revision_number`, `version_name` → `revision_name`
3. Renames `current_version` → `current_revision` in `project_areas`
4. Renames `area_version_id` → `area_revision_id` in `project_products`
5. Updates trigger and helper function names

---

## Testing Checklist

### Basic Operations

- [ ] Create project
- [ ] Add area (verify RV1 auto-created)
- [ ] Edit area metadata
- [ ] Delete empty area
- [ ] Try to create duplicate area code (should fail)

### Revisioning

- [ ] Add products to area RV1
- [ ] Create RV2 without copying products
- [ ] Create RV3 by copying from RV2
- [ ] View revision history
- [ ] Switch to RV1 (verify products change)
- [ ] Delete RV1 (should work if not current)
- [ ] Try to delete current revision (should fail)

### Products

- [ ] Add product to area revision
- [ ] Add same product to different revision (should create separate entries)
- [ ] Remove product from revision
- [ ] Verify area summaries update (count, cost)

### Edge Cases

- [ ] Create area with special characters in code
- [ ] Create area with negative floor level (basement)
- [ ] Delete area with multiple revisions and products
- [ ] Switch revision back and forth rapidly
- [ ] Create many revisions (10+) for an area

---

## Performance Considerations

### Indexes

All critical paths are indexed:

```sql
-- Fast area lookup by project
CREATE INDEX idx_project_areas_project_id ON project_areas(project_id);

-- Fast revision lookup by area
CREATE INDEX idx_area_revisions_area_id ON project_area_revisions(area_id);

-- Fast product lookup by revision
CREATE INDEX idx_project_products_area_revision ON project_products(area_revision_id);
```

### Query Optimization

- Use `get_area_revision_summary()` function instead of manual aggregation
- Fetch areas with revisions in single query (see `listProjectAreasAction`)
- Use `includeRevisions` parameter wisely (only fetch when needed)

---

## Future Enhancements

### Planned Features

1. **Revision Comparison UI**
   - Side-by-side comparison of two revisions
   - Highlight added/removed/changed products

2. **Revision Approval Workflow**
   - Set revision status to "submitted"
   - Manager approves → status "approved"
   - Lock approved revisions (no edits)

3. **Revision Branching**
   - Create multiple revisions from same parent
   - Merge revisions (reconcile products)

4. **Export Area BOM**
   - Generate Excel BOM per area revision
   - Include drawings, specifications

5. **Area Templates**
   - Save area configuration as template
   - Apply template to new project

### Considerations

- **Performance**: Large projects (50+ areas) may need pagination
- **Google Drive**: Consider quota limits for folder creation
- **Permissions**: Future RLS policies for multi-user access
- **Audit Log**: Track who changed what and when

---

## Troubleshooting

### Products Not Showing in Area

**Problem**: Added products but they don't appear in area.

**Solution**: Verify `area_revision_id` matches the **current revision**:

```sql
SELECT pa.current_revision, par.revision_number, pp.*
FROM project_products pp
JOIN project_area_revisions par ON pp.area_revision_id = par.id
JOIN project_areas pa ON par.area_id = pa.id
WHERE pa.id = 'area-uuid';
```

### Cannot Delete Revision

**Problem**: "Cannot delete the current active revision" error.

**Solution**: Switch to different revision first:

```typescript
await setAreaCurrentRevisionAction(area.id, 2)  // Switch to RV2
await deleteAreaRevisionAction(rv1_id)  // Now can delete RV1
```

### Revision Numbers Skipped

**Problem**: Area has RV1 and RV3, but no RV2.

**Explanation**: RV2 was deleted. This is by design - revision numbers are never reused or renumbered.

---

## Related Documentation

- [Project Management Overview](./README.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Google Drive Integration](./GOOGLE_DRIVE_INTEGRATION.md)

---

## Changelog

### 2025-12-28 - Terminology Update

- Renamed all "version" terminology to "revision" (RV)
- Database migration: `20251228120000_rename_version_to_revision.sql`
- Updated table: `project_area_versions` → `project_area_revisions`
- Updated columns: `version_number` → `revision_number`, etc.
- Updated UI to display "RV1", "RV2" instead of "v1", "v2"

### 2025-12-19 - Initial Implementation

- Created `project_areas` and `project_area_revisions` tables
- Modified `project_products` to link to area revisions
- Implemented server actions for CRUD operations
- Created UI components (ProjectAreasCard, AreaFormDialog, AreaRevisionHistoryDialog)
- Added "Areas" tab to project detail page
