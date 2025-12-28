-- Migration: Fix symbol classification to use symbol_rules table
-- The previous functions used get_foss_category() which queries the empty foss_category_rules table.
-- This migration updates them to use get_product_symbol() which uses the populated symbol_rules table.
-- Also fixes column name mismatches (area_version_id vs area_revision_id parameter names)

-- ============================================================================
-- 1. Update get_area_version_products to use get_product_symbol()
-- ============================================================================
CREATE OR REPLACE FUNCTION projects.get_area_version_products(p_area_version_id uuid)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  foss_pid text,
  description_short text,
  quantity integer,
  unit_price numeric,
  discount_percent numeric,
  room_location text,
  mounting_height numeric,
  status text,
  notes text,
  category_code character,
  symbol_sequence integer,
  symbol text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.product_id,
    p.foss_pid,
    pd.description_short,
    pp.quantity,
    pp.unit_price,
    pp.discount_percent,
    pp.room_location,
    pp.mounting_height,
    pp.status,
    pp.notes,
    -- Use get_product_symbol instead of get_foss_category
    items.get_product_symbol(p.foss_pid)::character(1) as category_code,
    pp.symbol_sequence,
    CASE
        WHEN items.get_product_symbol(p.foss_pid) IS NOT NULL
             AND pp.symbol_sequence IS NOT NULL
        THEN items.get_product_symbol(p.foss_pid) || pp.symbol_sequence::text
        ELSE NULL
    END as symbol
  FROM projects.project_products pp
  JOIN items.product p ON p.id = pp.product_id
  LEFT JOIN items.product_detail pd ON pd.product_id = pp.product_id
  WHERE pp.area_revision_id = p_area_version_id
  ORDER BY pp.added_at;
END;
$function$;

-- ============================================================================
-- 2. Create get_area_revision_products as an alias (for code consistency)
-- ============================================================================
CREATE OR REPLACE FUNCTION projects.get_area_revision_products(p_area_revision_id uuid)
RETURNS TABLE(
  id uuid,
  product_id uuid,
  foss_pid text,
  description_short text,
  quantity integer,
  unit_price numeric,
  discount_percent numeric,
  room_location text,
  mounting_height numeric,
  status text,
  notes text,
  category_code character,
  symbol_sequence integer,
  symbol text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM projects.get_area_version_products(p_area_revision_id);
END;
$function$;

-- ============================================================================
-- 3. Update assign_symbol_sequence trigger to use get_product_symbol()
-- ============================================================================
CREATE OR REPLACE FUNCTION projects.assign_symbol_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_category_code VARCHAR(2);
    v_max_sequence INT;
    v_foss_pid TEXT;
BEGIN
    -- Get the foss_pid for this product
    SELECT p.foss_pid INTO v_foss_pid
    FROM items.product p
    WHERE p.id = NEW.product_id;

    -- Get the category code using get_product_symbol (which uses symbol_rules)
    SELECT items.get_product_symbol(v_foss_pid) INTO v_category_code;

    -- If no category found, skip sequence assignment
    IF v_category_code IS NULL THEN
        NEW.symbol_sequence := NULL;
        RETURN NEW;
    END IF;

    -- Find the max sequence for this category in this area version
    SELECT COALESCE(MAX(pp.symbol_sequence), 0) INTO v_max_sequence
    FROM projects.project_products pp
    JOIN items.product p ON p.id = pp.product_id
    WHERE pp.area_revision_id = NEW.area_revision_id
      AND items.get_product_symbol(p.foss_pid) = v_category_code
      AND pp.id != NEW.id;

    -- Assign next sequence number
    NEW.symbol_sequence := v_max_sequence + 1;

    RETURN NEW;
END;
$function$;

-- ============================================================================
-- 4. Add symbol column to planner_placements for persistence
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'projects'
      AND table_name = 'planner_placements'
      AND column_name = 'symbol'
  ) THEN
    ALTER TABLE projects.planner_placements ADD COLUMN symbol TEXT;
    COMMENT ON COLUMN projects.planner_placements.symbol IS 'Symbol label (e.g., A1, B2) for display on floor plan';
  END IF;
END $$;

-- ============================================================================
-- 5. Update get_area_placements to include symbol (using correct column name)
-- ============================================================================
DROP FUNCTION IF EXISTS projects.get_area_placements(uuid);

CREATE FUNCTION projects.get_area_placements(p_area_revision_id uuid)
RETURNS TABLE(
  id uuid,
  project_product_id uuid,
  product_id uuid,
  product_name text,
  world_x double precision,
  world_y double precision,
  rotation double precision,
  symbol text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pl.id,
    pl.project_product_id,
    pl.product_id,
    pl.product_name,
    pl.world_x::double precision,
    pl.world_y::double precision,
    pl.rotation::double precision,
    pl.symbol
  FROM projects.planner_placements pl
  WHERE pl.area_version_id = p_area_revision_id  -- Table column is area_version_id
  ORDER BY pl.created_at;
END;
$function$;

-- ============================================================================
-- 6. Update save_area_placements to include symbol (using correct column name)
-- ============================================================================
DROP FUNCTION IF EXISTS projects.save_area_placements(uuid, jsonb);

CREATE FUNCTION projects.save_area_placements(p_area_revision_id uuid, p_placements jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Delete existing placements for this area revision
  DELETE FROM projects.planner_placements
  WHERE area_version_id = p_area_revision_id;  -- Table column is area_version_id

  -- Insert new placements (if any)
  IF p_placements IS NOT NULL AND jsonb_array_length(p_placements) > 0 THEN
    INSERT INTO projects.planner_placements (
      id,
      area_version_id,  -- Table column is area_version_id
      project_product_id,
      product_id,
      product_name,
      symbol,
      world_x,
      world_y,
      rotation
    )
    SELECT
      COALESCE((elem->>'id')::UUID, gen_random_uuid()),
      p_area_revision_id,
      (elem->>'projectProductId')::UUID,
      (elem->>'productId')::UUID,
      elem->>'productName',
      elem->>'symbol',
      (elem->>'worldX')::NUMERIC,
      (elem->>'worldY')::NUMERIC,
      COALESCE((elem->>'rotation')::NUMERIC, 0)
    FROM jsonb_array_elements(p_placements) AS elem;
  END IF;
END;
$function$;

-- ============================================================================
-- Add helpful comments
-- ============================================================================
COMMENT ON FUNCTION projects.get_area_version_products IS
  'Get products for an area version with symbol classification from symbol_rules table';
COMMENT ON FUNCTION projects.get_area_revision_products IS
  'Alias for get_area_version_products (revision = version terminology)';
COMMENT ON FUNCTION projects.assign_symbol_sequence IS
  'Trigger to auto-assign symbol sequence numbers using symbol_rules classification';
COMMENT ON FUNCTION projects.save_area_placements IS
  'Atomic save of placements for an area revision, including symbol labels';
COMMENT ON FUNCTION projects.get_area_placements IS
  'Get placements for an area revision including symbol labels';
