-- Migration: Add project area versioning support
-- Created: 2025-12-19
-- Description: Adds support for multi-area projects with independent versioning per area

BEGIN;

-- ============================================================================
-- 1. CREATE project_areas TABLE
-- ============================================================================
-- Represents logical areas within a project (Ground Floor, Garden, etc.)
-- Each area can have multiple versions

CREATE TABLE IF NOT EXISTS projects.project_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects.projects(id) ON DELETE CASCADE,

  -- Area identification
  area_code VARCHAR(50) NOT NULL,  -- "GF", "F1", "GARDEN", etc.
  area_name VARCHAR(255) NOT NULL,  -- "Ground Floor", "First Floor", "Garden"
  area_name_en VARCHAR(255),

  -- Area classification
  area_type VARCHAR(50),  -- "floor", "outdoor", "common_area", "room", "parking", "technical", "other"
  floor_level INTEGER,  -- For sorting: -5 to 99 (basement to upper floors)

  -- Physical properties (informational)
  area_sqm NUMERIC(10,2),  -- Area size in square meters
  ceiling_height_m NUMERIC(5,2),  -- Ceiling height in meters

  -- VERSION TRACKING - Each area maintains its own version
  current_version INTEGER DEFAULT 1 NOT NULL,

  -- Metadata
  display_order INTEGER DEFAULT 0,  -- Custom ordering of areas
  is_active BOOLEAN DEFAULT TRUE,  -- Soft delete flag
  description TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_project_area_code UNIQUE(project_id, area_code),
  CONSTRAINT positive_current_version CHECK (current_version > 0),
  CONSTRAINT valid_floor_level CHECK (floor_level IS NULL OR (floor_level >= -5 AND floor_level <= 99)),
  CONSTRAINT positive_area CHECK (area_sqm IS NULL OR area_sqm > 0),
  CONSTRAINT positive_ceiling CHECK (ceiling_height_m IS NULL OR ceiling_height_m > 0)
);

-- Indexes for performance
CREATE INDEX idx_project_areas_project_id ON projects.project_areas(project_id);
CREATE INDEX idx_project_areas_display_order ON projects.project_areas(project_id, display_order);
CREATE INDEX idx_project_areas_floor_level ON projects.project_areas(project_id, floor_level) WHERE floor_level IS NOT NULL;

-- ============================================================================
-- 2. CREATE project_area_versions TABLE
-- ============================================================================
-- Represents a specific version of an area (v1, v2, v3, etc.)
-- Each version has its own set of products

CREATE TABLE IF NOT EXISTS projects.project_area_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id UUID NOT NULL REFERENCES projects.project_areas(id) ON DELETE CASCADE,

  -- Version identification
  version_number INTEGER NOT NULL,
  version_name VARCHAR(255),  -- Optional: "Initial Design", "Client Revision", etc.
  notes TEXT,  -- Version description/changes

  -- Google Drive integration
  google_drive_folder_id TEXT,  -- Folder for this specific version

  -- Version status and approval
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'archived')),
  approved_at TIMESTAMPTZ,
  approved_by TEXT,  -- Email of approver

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,  -- Email of creator

  -- Constraints
  CONSTRAINT unique_area_version UNIQUE(area_id, version_number),
  CONSTRAINT positive_version CHECK (version_number > 0)
);

-- Indexes for performance
CREATE INDEX idx_area_versions_area_id ON projects.project_area_versions(area_id);
CREATE INDEX idx_area_versions_number ON projects.project_area_versions(area_id, version_number DESC);
CREATE INDEX idx_area_versions_status ON projects.project_area_versions(status) WHERE status != 'archived';

-- ============================================================================
-- 3. MODIFY project_products TABLE
-- ============================================================================
-- Add area_version_id to link products to specific area versions

ALTER TABLE projects.project_products
  ADD COLUMN IF NOT EXISTS area_version_id UUID REFERENCES projects.project_area_versions(id) ON DELETE CASCADE;

-- Add index for area version lookups
CREATE INDEX IF NOT EXISTS idx_project_products_area_version
  ON projects.project_products(area_version_id) WHERE area_version_id IS NOT NULL;

-- Add updated_at trigger for project_products if not exists
CREATE OR REPLACE FUNCTION projects.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to project_products
DROP TRIGGER IF EXISTS update_project_products_updated_at ON projects.project_products;
CREATE TRIGGER update_project_products_updated_at
  BEFORE UPDATE ON projects.project_products
  FOR EACH ROW
  EXECUTE FUNCTION projects.update_updated_at_column();

-- Apply trigger to project_areas
DROP TRIGGER IF EXISTS update_project_areas_updated_at ON projects.project_areas;
CREATE TRIGGER update_project_areas_updated_at
  BEFORE UPDATE ON projects.project_areas
  FOR EACH ROW
  EXECUTE FUNCTION projects.update_updated_at_column();

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

-- Function to create initial version when area is created
CREATE OR REPLACE FUNCTION projects.create_initial_area_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Automatically create version 1 when a new area is created
  INSERT INTO projects.project_area_versions (
    area_id,
    version_number,
    version_name,
    created_by
  ) VALUES (
    NEW.id,
    1,
    'Initial Version',
    COALESCE(NEW.notes, current_user)  -- Use notes as creator or fallback to current_user
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create initial version
DROP TRIGGER IF EXISTS create_initial_version ON projects.project_areas;
CREATE TRIGGER create_initial_version
  AFTER INSERT ON projects.project_areas
  FOR EACH ROW
  EXECUTE FUNCTION projects.create_initial_area_version();

-- Function to get area version summary (product count and cost)
CREATE OR REPLACE FUNCTION projects.get_area_version_summary(p_area_version_id UUID)
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
  WHERE area_version_id = p_area_version_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON projects.project_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects.project_area_versions TO authenticated;
GRANT EXECUTE ON FUNCTION projects.get_area_version_summary(UUID) TO authenticated;

-- ============================================================================
-- 6. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE projects.project_areas IS
  'Logical areas within a project (floors, gardens, zones) with independent versioning';

COMMENT ON COLUMN projects.project_areas.current_version IS
  'Currently active version number for this area';

COMMENT ON TABLE projects.project_area_versions IS
  'Version history for each project area - each version has its own products and Drive folder';

COMMENT ON COLUMN projects.project_products.area_version_id IS
  'Links product to a specific area version (NULL = unassigned to any area)';

COMMIT;
