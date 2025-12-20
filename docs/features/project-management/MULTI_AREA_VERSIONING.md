# Multi-Area Project Versioning

**Status**: ✅ Implemented
**Last Updated**: 2025-12-19
**Migration**: `20251219_add_project_area_versioning.sql`

---

## Overview

This feature implements **independent versioning for project areas**, allowing each area within a project (floors, gardens, zones, etc.) to maintain its own version history. This is essential for lighting design workflows where different areas of a project iterate at different rates.

### Key Concept

Instead of versioning the entire project, we version individual **areas**:

```
Project: Luxury Villa
├─ Ground Floor (GF)  → v1, v2, v3 (current)
├─ First Floor (F1)   → v1, v2 (current)
└─ Garden (GARDEN)    → v1 (current)
```

Each version contains its own set of products, allowing designers to iterate on specific areas without affecting others.

---

## Architecture

### Data Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AREA VERSIONING MODEL                   │
└─────────────────────────────────────────────────────────────────┘

projects
  └─ project_areas (logical areas)
      ├─ id
      ├─ area_code (GF, F1, GARDEN)
      ├─ current_version (active version number)
      └─ project_area_versions (version history)
          ├─ version_number (1, 2, 3...)
          ├─ google_drive_folder_id
          └─ project_products (products for this version)
              └─ area_version_id → links to specific version
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
| `current_version` | INTEGER | Currently active version number |
| `display_order` | INTEGER | Custom ordering |

**Constraints**:
- `UNIQUE(project_id, area_code)` - Area codes unique per project
- `CHECK(current_version > 0)` - Version numbers start at 1

#### `projects.project_area_versions`

Represents a specific version of an area.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `area_id` | UUID | Reference to area |
| `version_number` | INTEGER | Version number (1, 2, 3...) |
| `version_name` | VARCHAR(255) | Optional name ("Initial", "Revision A") |
| `notes` | TEXT | Version description/changes |
| `google_drive_folder_id` | TEXT | Drive folder for this version |
| `status` | VARCHAR(50) | draft, submitted, approved, archived |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `created_by` | TEXT | Creator email |

**Constraints**:
- `UNIQUE(area_id, version_number)` - Version numbers unique per area
- `CHECK(version_number > 0)` - Version numbers start at 1

#### `projects.project_products` (Modified)

Links products to specific area versions.

| Column (New) | Type | Description |
|--------------|------|-------------|
| `area_version_id` | UUID | Reference to area version (nullable) |

**Relationship**: `NULL` = unassigned product, otherwise links to specific version.

---

## Automatic Behaviors

### Trigger: Create Initial Version

When a new area is created, **version 1 is automatically created**:

```sql
CREATE TRIGGER create_initial_version
  AFTER INSERT ON projects.project_areas
  FOR EACH ROW
  EXECUTE FUNCTION projects.create_initial_area_version();
```

This ensures every area always has at least one version.

### Helper Function: Version Summary

Get product count and total cost for a version:

```sql
SELECT * FROM projects.get_area_version_summary('area-version-uuid');
-- Returns: { product_count: 18, total_cost: 2450.00 }
```

---

## Server Actions

### Area Management

Located in: `src/lib/actions/project-areas.ts`

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
// Returns: { success: true, data: { id: 'area-uuid', version_id: 'v1-uuid' } }
// Note: Version 1 is auto-created!
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
// Deletes area and ALL versions (CASCADE)
const result = await deleteAreaAction('area-uuid')
```

### Version Management

#### Create New Version

```typescript
import { createAreaVersionAction } from '@/lib/actions'

// Create v2 by copying products from v1
const result = await createAreaVersionAction({
  area_id: 'area-uuid',
  copy_from_version: 1,  // Copy products from v1
  version_name: 'Client Revision',
  notes: 'Added dimmer controls per client request',
  created_by: 'designer@example.com'
})
// Returns: { success: true, data: { id: 'v2-uuid', version_number: 2 } }
// area.current_version is automatically updated to 2
```

#### Switch Current Version

```typescript
import { setAreaCurrentVersionAction } from '@/lib/actions'

// Make v1 the current version
const result = await setAreaCurrentVersionAction('area-uuid', 1)
// Updates area.current_version = 1
```

#### Get Version History

```typescript
import { getAreaVersionsAction } from '@/lib/actions'

const result = await getAreaVersionsAction('area-uuid')
// Returns: {
//   success: true,
//   data: [
//     { version_number: 3, product_count: 18, total_cost: 2450, ... },
//     { version_number: 2, product_count: 16, total_cost: 2200, ... },
//     { version_number: 1, product_count: 12, total_cost: 1800, ... }
//   ]
// }
```

#### Delete Version

```typescript
import { deleteAreaVersionAction } from '@/lib/actions'

// Can only delete non-current versions
const result = await deleteAreaVersionAction('version-uuid')
// Error if version is current: "Cannot delete the current active version"
```

### Product-Area Assignment

#### Add Product to Area Version

```typescript
import { addProductToProjectAction } from '@/lib/actions'

const result = await addProductToProjectAction({
  project_id: 'project-uuid',
  product_id: 'product-uuid',
  area_version_id: 'v2-uuid',  // NEW: Assign to specific version
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
- List all areas with current version info
- Show product count and cost per area
- Create new area (opens `AreaFormDialog`)
- Edit area metadata
- Create new version (with product copy option)
- View version history (opens `AreaVersionHistoryDialog`)
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

### `AreaVersionHistoryDialog`

Timeline view of all versions for an area.

**Location**: `src/components/projects/area-version-history-dialog.tsx`

**Features**:
- Shows all versions in descending order
- Current version highlighted
- Product count and cost per version
- Creation date and creator
- Actions:
  - Set as current (for non-current versions)
  - Delete (for non-current versions only)

**Usage**:
```tsx
<AreaVersionHistoryDialog
  open={isOpen}
  onOpenChange={setIsOpen}
  areaId={area.id}
  onVersionChange={loadProject}
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
            │   ├─ v1/
            │   │   ├─ BOM_GF_v1.xlsx
            │   │   └─ Layout_GF_v1.pdf
            │   ├─ v2/
            │   │   ├─ BOM_GF_v2.xlsx
            │   │   └─ Layout_GF_v2.pdf
            │   └─ v3/           # Current version
            │       ├─ BOM_GF_v3.xlsx
            │       └─ Layout_GF_v3.pdf
            ├─ F1/               # First Floor
            │   ├─ v1/
            │   └─ v2/           # Current version
            └─ GARDEN/
                └─ v1/           # Current version
```

### Folder IDs

- `project_areas.google_drive_folder_id` - NOT used (can be removed)
- `project_area_versions.google_drive_folder_id` - Stores folder ID for each version

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
// Auto-creates v1 for GF

const f1 = await createAreaAction({
  project_id: project.id,
  area_code: 'F1',
  area_name: 'First Floor',
  floor_level: 1
})
// Auto-creates v1 for F1

// 3. Add products to versions
await addProductToProjectAction({
  project_id: project.id,
  product_id: 'downlight-uuid',
  area_version_id: gf.version_id,  // GF v1
  quantity: 10
})

await addProductToProjectAction({
  project_id: project.id,
  product_id: 'wall-light-uuid',
  area_version_id: f1.version_id,  // F1 v1
  quantity: 6
})
```

### Iterating on an Area

```typescript
// Client requests changes to Ground Floor only

// 1. Create new version, copy products from v1
const v2 = await createAreaVersionAction({
  area_id: gf.id,
  copy_from_version: 1,
  notes: 'Client requested dimmer controls',
  created_by: 'designer@example.com'
})
// GF is now at v2 (current_version = 2)
// F1 is still at v1 (unaffected)

// 2. Modify products in v2
await addProductToProjectAction({
  project_id: project.id,
  product_id: 'dimmer-uuid',
  area_version_id: v2.data.id,  // GF v2
  quantity: 5
})

// 3. View project: shows GF v2 + F1 v1
```

### Comparing Versions

```typescript
// Get all versions for Ground Floor
const versions = await getAreaVersionsAction(gf.id)

// versions.data:
// [
//   { version_number: 2, product_count: 15, total_cost: 2200 },
//   { version_number: 1, product_count: 10, total_cost: 1800 }
// ]

// Switch to v1 to compare
await setAreaCurrentVersionAction(gf.id, 1)
// Now viewing GF v1 + F1 v1

// Switch back to v2
await setAreaCurrentVersionAction(gf.id, 2)
// Back to GF v2 + F1 v1
```

---

## Business Rules

### Safety Constraints

1. **Cannot delete current version**
   ```typescript
   // If GF current_version = 2
   await deleteAreaVersionAction(v2_id)
   // Error: "Cannot delete the current active version"
   ```

2. **Area codes are unique per project**
   ```typescript
   // If "GF" already exists in project
   await createAreaAction({ project_id, area_code: 'GF', ... })
   // Error: "An area with this code already exists in this project"
   ```

3. **Version numbers are immutable**
   - Once created, version numbers never change
   - No renumbering when versions are deleted

### Cascade Delete

1. **Deleting an area** → Deletes all versions → Deletes all products in those versions
2. **Deleting a version** → Deletes all products in that version

---

## Database Queries

### Get Project with Current Versions

```sql
SELECT
  p.id AS project_id,
  p.name AS project_name,
  pa.id AS area_id,
  pa.area_code,
  pa.area_name,
  pa.current_version,
  pav.id AS current_version_id,
  pav.version_name,
  pav.notes,
  COUNT(pp.id) AS product_count,
  SUM(pp.total_price) AS total_cost
FROM projects.projects p
JOIN projects.project_areas pa ON p.id = pa.project_id
JOIN projects.project_area_versions pav
  ON pa.id = pav.area_id AND pa.current_version = pav.version_number
LEFT JOIN projects.project_products pp ON pav.id = pp.area_version_id
WHERE p.id = $1
GROUP BY p.id, pa.id, pav.id
ORDER BY pa.display_order, pa.floor_level;
```

### Get All Products for Current Versions

```sql
SELECT
  pp.*,
  pa.area_code,
  pa.area_name,
  pav.version_number
FROM projects.project_products pp
JOIN projects.project_area_versions pav ON pp.area_version_id = pav.id
JOIN projects.project_areas pa ON pav.area_id = pa.id
WHERE pa.project_id = $1
  AND pa.current_version = pav.version_number
ORDER BY pa.display_order, pp.room_location;
```

### Compare Two Versions of an Area

```sql
-- Get products in v1 vs v2
WITH v1_products AS (
  SELECT product_id, quantity
  FROM projects.project_products pp
  JOIN projects.project_area_versions pav ON pp.area_version_id = pav.id
  WHERE pav.area_id = $1 AND pav.version_number = 1
),
v2_products AS (
  SELECT product_id, quantity
  FROM projects.project_products pp
  JOIN projects.project_area_versions pav ON pp.area_version_id = pav.id
  WHERE pav.area_id = $1 AND pav.version_number = 2
)
SELECT
  COALESCE(v1.product_id, v2.product_id) AS product_id,
  v1.quantity AS v1_qty,
  v2.quantity AS v2_qty,
  COALESCE(v2.quantity, 0) - COALESCE(v1.quantity, 0) AS diff
FROM v1_products v1
FULL OUTER JOIN v2_products v2 ON v1.product_id = v2.product_id;
```

---

## Migration

### Running the Migration

```bash
# Connect to Supabase database
psql $DATABASE_URL -f supabase/migrations/20251219_add_project_area_versioning.sql
```

### Migration Contents

1. Creates `project_areas` table
2. Creates `project_area_versions` table
3. Adds `area_version_id` column to `project_products`
4. Creates indexes for performance
5. Creates trigger for auto-creating v1
6. Creates helper function `get_area_version_summary()`
7. Grants permissions to `authenticated` role

### No Data Migration Required

Since this is a new feature with no existing data to migrate, the migration simply adds the new schema. Existing projects will have `areas = []`.

---

## Testing Checklist

### Basic Operations

- [ ] Create project
- [ ] Add area (verify v1 auto-created)
- [ ] Edit area metadata
- [ ] Delete empty area
- [ ] Try to create duplicate area code (should fail)

### Versioning

- [ ] Add products to area v1
- [ ] Create v2 without copying products
- [ ] Create v3 by copying from v2
- [ ] View version history
- [ ] Switch to v1 (verify products change)
- [ ] Delete v1 (should work if not current)
- [ ] Try to delete current version (should fail)

### Products

- [ ] Add product to area version
- [ ] Add same product to different version (should create separate entries)
- [ ] Remove product from version
- [ ] Verify area summaries update (count, cost)

### Edge Cases

- [ ] Create area with special characters in code
- [ ] Create area with negative floor level (basement)
- [ ] Delete area with multiple versions and products
- [ ] Switch version back and forth rapidly
- [ ] Create many versions (10+) for an area

---

## Performance Considerations

### Indexes

All critical paths are indexed:

```sql
-- Fast area lookup by project
CREATE INDEX idx_project_areas_project_id ON project_areas(project_id);

-- Fast version lookup by area
CREATE INDEX idx_area_versions_area_id ON project_area_versions(area_id);

-- Fast product lookup by version
CREATE INDEX idx_project_products_area_version ON project_products(area_version_id);
```

### Query Optimization

- Use `get_area_version_summary()` function instead of manual aggregation
- Fetch areas with versions in single query (see `listProjectAreasAction`)
- Use `includeVersions` parameter wisely (only fetch when needed)

---

## Future Enhancements

### Planned Features

1. **Version Comparison UI**
   - Side-by-side comparison of two versions
   - Highlight added/removed/changed products

2. **Version Approval Workflow**
   - Set version status to "submitted"
   - Manager approves → status "approved"
   - Lock approved versions (no edits)

3. **Version Branching**
   - Create multiple versions from same parent
   - Merge versions (reconcile products)

4. **Export Area BOM**
   - Generate Excel BOM per area version
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

**Solution**: Verify `area_version_id` matches the **current version**:

```sql
SELECT pa.current_version, pav.version_number, pp.*
FROM project_products pp
JOIN project_area_versions pav ON pp.area_version_id = pav.id
JOIN project_areas pa ON pav.area_id = pa.id
WHERE pa.id = 'area-uuid';
```

### Cannot Delete Version

**Problem**: "Cannot delete the current active version" error.

**Solution**: Switch to different version first:

```typescript
await setAreaCurrentVersionAction(area.id, 2)  // Switch to v2
await deleteAreaVersionAction(v1_id)  // Now can delete v1
```

### Version Numbers Skipped

**Problem**: Area has v1 and v3, but no v2.

**Explanation**: v2 was deleted. This is by design - version numbers are never reused or renumbered.

---

## Related Documentation

- [Project Management Overview](./README.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Google Drive Integration](./GOOGLE_DRIVE_INTEGRATION.md)

---

## Changelog

### 2025-12-19 - Initial Implementation

- Created `project_areas` and `project_area_versions` tables
- Modified `project_products` to link to area versions
- Implemented server actions for CRUD operations
- Created UI components (ProjectAreasCard, AreaFormDialog, AreaVersionHistoryDialog)
- Added "Areas" tab to project detail page
- Migration: `20251219_add_project_area_versioning.sql`
