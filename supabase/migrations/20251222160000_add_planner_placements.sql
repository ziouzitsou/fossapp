-- Migration: Add planner_placements table
-- Purpose: Store product placements on floor plans (explicit save model)

-- Create planner_placements table
CREATE TABLE projects.planner_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_version_id UUID NOT NULL REFERENCES projects.project_area_versions(id) ON DELETE CASCADE,
  project_product_id UUID NOT NULL REFERENCES projects.project_products(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,  -- denormalized from project_products for convenience
  product_name TEXT NOT NULL, -- denormalized (FOSS PID or description) for display
  world_x NUMERIC NOT NULL,   -- DWG model space X coordinate
  world_y NUMERIC NOT NULL,   -- DWG model space Y coordinate
  rotation NUMERIC DEFAULT 0, -- Rotation in degrees
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for loading placements by area version (primary access pattern)
CREATE INDEX idx_planner_placements_area_version
ON projects.planner_placements(area_version_id);

-- Index for finding placements by product (for cascade detection)
CREATE INDEX idx_planner_placements_project_product
ON projects.planner_placements(project_product_id);

-- Comment for documentation
COMMENT ON TABLE projects.planner_placements IS
  'Product placements on floor plans. Coordinates are in DWG model space (not screen pixels).';

-- RPC function for atomic save (delete + insert in transaction)
CREATE OR REPLACE FUNCTION projects.save_area_placements(
  p_area_version_id UUID,
  p_placements JSONB  -- array of placement objects
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete existing placements for this area version
  DELETE FROM projects.planner_placements
  WHERE area_version_id = p_area_version_id;

  -- Insert new placements (if any)
  IF p_placements IS NOT NULL AND jsonb_array_length(p_placements) > 0 THEN
    INSERT INTO projects.planner_placements (
      id,
      area_version_id,
      project_product_id,
      product_id,
      product_name,
      world_x,
      world_y,
      rotation
    )
    SELECT
      COALESCE((elem->>'id')::UUID, gen_random_uuid()),
      p_area_version_id,
      (elem->>'projectProductId')::UUID,
      (elem->>'productId')::UUID,
      elem->>'productName',
      (elem->>'worldX')::NUMERIC,
      (elem->>'worldY')::NUMERIC,
      COALESCE((elem->>'rotation')::NUMERIC, 0)
    FROM jsonb_array_elements(p_placements) AS elem;
  END IF;
END;
$$;

-- RPC function to load placements for an area version
CREATE OR REPLACE FUNCTION projects.get_area_placements(
  p_area_version_id UUID
)
RETURNS TABLE (
  id UUID,
  project_product_id UUID,
  product_id UUID,
  product_name TEXT,
  world_x NUMERIC,
  world_y NUMERIC,
  rotation NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.project_product_id,
    pp.product_id,
    pp.product_name,
    pp.world_x,
    pp.world_y,
    pp.rotation
  FROM projects.planner_placements pp
  WHERE pp.area_version_id = p_area_version_id
  ORDER BY pp.created_at;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION projects.save_area_placements(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION projects.get_area_placements(UUID) TO authenticated;

-- Enable RLS
ALTER TABLE projects.planner_placements ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can access placements for projects they have access to
-- (Simplified - in production you'd check project membership)
CREATE POLICY "Users can manage placements for their projects"
ON projects.planner_placements
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM projects.project_area_versions pav
    JOIN projects.project_areas pa ON pa.id = pav.area_id
    JOIN projects.projects p ON p.id = pa.project_id
    WHERE pav.id = area_version_id
    -- For now allow all authenticated users (matches existing project access pattern)
    -- In production: AND p.owner_id = auth.uid() OR user is team member
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM projects.project_area_versions pav
    JOIN projects.project_areas pa ON pa.id = pav.area_id
    JOIN projects.projects p ON p.id = pa.project_id
    WHERE pav.id = area_version_id
  )
);
