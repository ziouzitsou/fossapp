-- Migration: Rename version → revision terminology
-- Created: 2025-12-28
-- Description: Changes "version" to "revision" (displayed as "RV" in UI) for area versioning feature

BEGIN;

-- ============================================================================
-- 1. RENAME project_area_versions TABLE → project_area_revisions
-- ============================================================================

ALTER TABLE projects.project_area_versions RENAME TO project_area_revisions;

-- ============================================================================
-- 2. RENAME COLUMNS in project_area_revisions
-- ============================================================================

ALTER TABLE projects.project_area_revisions
  RENAME COLUMN version_number TO revision_number;

ALTER TABLE projects.project_area_revisions
  RENAME COLUMN version_name TO revision_name;

-- ============================================================================
-- 3. RENAME COLUMN in project_areas
-- ============================================================================

ALTER TABLE projects.project_areas
  RENAME COLUMN current_version TO current_revision;

-- ============================================================================
-- 4. RENAME COLUMN in project_products
-- ============================================================================

ALTER TABLE projects.project_products
  RENAME COLUMN area_version_id TO area_revision_id;

-- ============================================================================
-- 5. RENAME CONSTRAINTS
-- ============================================================================

ALTER TABLE projects.project_area_revisions
  RENAME CONSTRAINT unique_area_version TO unique_area_revision;

ALTER TABLE projects.project_area_revisions
  RENAME CONSTRAINT positive_version TO positive_revision;

ALTER TABLE projects.project_areas
  RENAME CONSTRAINT positive_current_version TO positive_current_revision;

-- ============================================================================
-- 6. RENAME INDEXES
-- ============================================================================

ALTER INDEX projects.idx_area_versions_area_id RENAME TO idx_area_revisions_area_id;
ALTER INDEX projects.idx_area_versions_number RENAME TO idx_area_revisions_number;
ALTER INDEX projects.idx_area_versions_floor_plan_hash RENAME TO idx_area_revisions_floor_plan_hash;
ALTER INDEX projects.idx_project_products_area_version RENAME TO idx_project_products_area_revision;

-- ============================================================================
-- 7. UPDATE TRIGGER FUNCTION - create_initial_area_version → create_initial_area_revision
-- ============================================================================

-- Drop old trigger
DROP TRIGGER IF EXISTS create_initial_version ON projects.project_areas;

-- Create updated function with new name
CREATE OR REPLACE FUNCTION projects.create_initial_area_revision()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically create revision 1 when a new area is created
  INSERT INTO projects.project_area_revisions (
    area_id,
    revision_number,
    revision_name,
    created_by
  ) VALUES (
    NEW.id,
    1,
    'Initial Revision',
    COALESCE(NEW.notes, current_user)
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger with new name
CREATE TRIGGER create_initial_revision
  AFTER INSERT ON projects.project_areas
  FOR EACH ROW
  EXECUTE FUNCTION projects.create_initial_area_revision();

-- Drop old function
DROP FUNCTION IF EXISTS projects.create_initial_area_version();

-- ============================================================================
-- 8. UPDATE HELPER FUNCTION - get_area_version_summary → get_area_revision_summary
-- ============================================================================

-- Create new function
CREATE OR REPLACE FUNCTION projects.get_area_revision_summary(p_area_revision_id UUID)
RETURNS TABLE (
  product_count BIGINT,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as product_count,
    COALESCE(SUM(total_price), 0)::NUMERIC as total_cost
  FROM projects.project_products
  WHERE area_revision_id = p_area_revision_id;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION projects.get_area_revision_summary(UUID) TO authenticated;

-- Drop old function
DROP FUNCTION IF EXISTS projects.get_area_version_summary(UUID);

-- ============================================================================
-- 9. UPDATE COMMENTS
-- ============================================================================

COMMENT ON TABLE projects.project_areas IS
  'Logical areas within a project (floors, gardens, zones) with independent revision tracking';

COMMENT ON COLUMN projects.project_areas.current_revision IS
  'Currently active revision number for this area';

COMMENT ON TABLE projects.project_area_revisions IS
  'Revision history for each project area - each revision has its own products and Drive folder';

COMMENT ON COLUMN projects.project_products.area_revision_id IS
  'Links product to a specific area revision (NULL = unassigned to any area)';

COMMIT;
