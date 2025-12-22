-- Migration: Add floor plan fields to project_area_versions
-- Purpose: Each area-version can have its own DWG floor plan
-- This moves floor plan storage from project-level to area-version level

-- 1. Add floor plan columns to project_area_versions
ALTER TABLE projects.project_area_versions
  ADD COLUMN IF NOT EXISTS floor_plan_urn TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_filename TEXT,
  ADD COLUMN IF NOT EXISTS floor_plan_hash TEXT;

-- 2. Add index for hash-based cache lookup (find existing translations)
CREATE INDEX IF NOT EXISTS idx_area_versions_floor_plan_hash
  ON projects.project_area_versions(floor_plan_hash)
  WHERE floor_plan_hash IS NOT NULL;

-- 3. Add comments for documentation
COMMENT ON COLUMN projects.project_area_versions.floor_plan_urn IS
  'Base64-encoded URN for APS Viewer - unique per area version';
COMMENT ON COLUMN projects.project_area_versions.floor_plan_filename IS
  'Original DWG filename uploaded by user';
COMMENT ON COLUMN projects.project_area_versions.floor_plan_hash IS
  'SHA256 hash for cache detection - same hash across versions means same file, skip re-translation';

-- Note: The existing project-level columns (oss_bucket, floor_plan_urn, floor_plan_filename, floor_plan_hash)
-- are kept for backward compatibility. The oss_bucket column on projects table is still used
-- as the single bucket per project. Only the floor_plan_* fields move to area_versions.
