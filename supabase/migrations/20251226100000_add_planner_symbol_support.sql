-- Migration: Add Planner Symbol Support
-- Purpose: Auto-assign symbol_sequence and expose symbol in RPCs
-- Part of: Auto DWG Generation - Phase 2
--
-- Changes:
-- 1. Trigger to auto-assign symbol_sequence on product insert
-- 2. Updated get_area_version_products RPC with category_code, symbol_sequence, symbol
-- 3. Updated get_area_placements RPC with symbol
-- 4. Backfill existing products with symbol_sequence

-- ============================================================================
-- 1. TRIGGER FUNCTION: Auto-assign symbol_sequence on product insert
-- ============================================================================

CREATE OR REPLACE FUNCTION projects.assign_symbol_sequence()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_category_code CHAR(1);
    v_max_sequence INT;
BEGIN
    -- Get the category code for this product
    SELECT fc.category_code INTO v_category_code
    FROM items.product_info pi
    CROSS JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc
    WHERE pi.product_id = NEW.product_id;

    -- If no category found, skip sequence assignment
    IF v_category_code IS NULL THEN
        NEW.symbol_sequence := NULL;
        RETURN NEW;
    END IF;

    -- Find the max sequence for this category in this area version
    SELECT COALESCE(MAX(pp.symbol_sequence), 0) INTO v_max_sequence
    FROM projects.project_products pp
    JOIN items.product_info pi ON pi.product_id = pp.product_id
    CROSS JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc
    WHERE pp.area_version_id = NEW.area_version_id
      AND fc.category_code = v_category_code
      AND pp.id != NEW.id;  -- Exclude self on UPDATE

    -- Assign next sequence number
    NEW.symbol_sequence := v_max_sequence + 1;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION projects.assign_symbol_sequence IS 'Auto-assigns symbol_sequence based on category within area version';

-- ============================================================================
-- 2. CREATE TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS trg_assign_symbol_sequence ON projects.project_products;

CREATE TRIGGER trg_assign_symbol_sequence
    BEFORE INSERT ON projects.project_products
    FOR EACH ROW
    WHEN (NEW.symbol_sequence IS NULL)
    EXECUTE FUNCTION projects.assign_symbol_sequence();

-- ============================================================================
-- 3. UPDATE RPC: Add category_code and symbol to product query
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
    category_code char(1),
    symbol_sequence integer,
    symbol text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
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
    fc.category_code,
    pp.symbol_sequence,
    -- Compose symbol: category_code + symbol_sequence (e.g., "A1", "B2")
    CASE
        WHEN fc.category_code IS NOT NULL AND pp.symbol_sequence IS NOT NULL
        THEN fc.category_code || pp.symbol_sequence::text
        ELSE NULL
    END as symbol
  FROM projects.project_products pp
  JOIN items.product p ON p.id = pp.product_id
  LEFT JOIN items.product_detail pd ON pd.product_id = pp.product_id
  LEFT JOIN items.product_info pi ON pi.product_id = pp.product_id
  LEFT JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc ON true
  WHERE pp.area_version_id = p_area_version_id
  ORDER BY pp.added_at;
END;
$$;

COMMENT ON FUNCTION projects.get_area_version_products IS 'Returns products for an area version with category symbol (A1, B2, etc.)';

-- ============================================================================
-- 4. BACKFILL: Assign symbol_sequence to existing products
-- ============================================================================

-- Create a function to backfill existing products
CREATE OR REPLACE FUNCTION projects.backfill_symbol_sequences()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_area_version_id uuid;
    v_category_code char(1);
    v_seq int;
    v_product_record RECORD;
BEGIN
    -- Loop through each area_version
    FOR v_area_version_id IN
        SELECT DISTINCT area_version_id
        FROM projects.project_products
        WHERE area_version_id IS NOT NULL
    LOOP
        -- For each category in this area version, assign sequences
        FOR v_category_code IN
            SELECT DISTINCT fc.category_code
            FROM projects.project_products pp
            JOIN items.product_info pi ON pi.product_id = pp.product_id
            CROSS JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc
            WHERE pp.area_version_id = v_area_version_id
              AND fc.category_code IS NOT NULL
        LOOP
            v_seq := 0;
            -- Update each product in order of added_at
            FOR v_product_record IN
                SELECT pp.id
                FROM projects.project_products pp
                JOIN items.product_info pi ON pi.product_id = pp.product_id
                CROSS JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc
                WHERE pp.area_version_id = v_area_version_id
                  AND fc.category_code = v_category_code
                ORDER BY pp.added_at
            LOOP
                v_seq := v_seq + 1;
                UPDATE projects.project_products
                SET symbol_sequence = v_seq
                WHERE id = v_product_record.id;
            END LOOP;
        END LOOP;
    END LOOP;
END;
$$;

-- Run the backfill
SELECT projects.backfill_symbol_sequences();

-- Drop the backfill function (one-time use)
DROP FUNCTION projects.backfill_symbol_sequences();

-- ============================================================================
-- 5. UPDATE RPC: Add symbol to placements query
-- ============================================================================

DROP FUNCTION IF EXISTS projects.get_area_placements(uuid);

CREATE OR REPLACE FUNCTION projects.get_area_placements(p_area_version_id uuid)
RETURNS TABLE(
    id uuid,
    project_product_id uuid,
    product_id uuid,
    product_name text,
    world_x numeric,
    world_y numeric,
    rotation numeric,
    symbol text
)
LANGUAGE plpgsql
STABLE
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pp.id,
    pp.project_product_id,
    pp.product_id,
    pp.product_name,
    pp.world_x,
    pp.world_y,
    pp.rotation,
    -- Get symbol from project_products
    CASE
        WHEN fc.category_code IS NOT NULL AND ppr.symbol_sequence IS NOT NULL
        THEN fc.category_code || ppr.symbol_sequence::text
        ELSE NULL
    END as symbol
  FROM projects.planner_placements pp
  LEFT JOIN projects.project_products ppr ON ppr.id = pp.project_product_id
  LEFT JOIN items.product_info pi ON pi.product_id = pp.product_id
  LEFT JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc ON true
  WHERE pp.area_version_id = p_area_version_id
  ORDER BY pp.created_at;
END;
$function$;

COMMENT ON FUNCTION projects.get_area_placements IS 'Returns placements for an area version with category symbol';
