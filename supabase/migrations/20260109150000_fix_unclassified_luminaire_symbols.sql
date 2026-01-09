-- Fix symbol sequencing for unclassified luminaires
--
-- Previously: Products without a symbol_rules match got symbol_sequence = NULL
-- Now: Luminaires (EG000027) without a category get their own sequence (?1, ?2, ?3...)
--
-- Changes:
-- 1. assign_symbol_sequence() - Trigger function now handles unclassified luminaires
-- 2. get_area_version_products() - Query function now returns "?N" for unclassified luminaires

-- ============================================================================
-- 1. Fix trigger function: assign_symbol_sequence
-- ============================================================================

CREATE OR REPLACE FUNCTION projects.assign_symbol_sequence()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    v_category_code VARCHAR(2);
    v_max_sequence INT;
    v_foss_pid TEXT;
    v_etim_group TEXT;
    v_is_luminaire BOOLEAN;
BEGIN
    -- Get the foss_pid for this product
    SELECT p.foss_pid INTO v_foss_pid
    FROM items.product p
    WHERE p.id = NEW.product_id;

    -- Check if this product is a luminaire (ETIM group EG000027)
    SELECT c."ARTGROUPID" INTO v_etim_group
    FROM items.product_detail pd
    JOIN etim.class c ON pd.class_id = c."ARTCLASSID"
    WHERE pd.product_id = NEW.product_id;

    v_is_luminaire := (v_etim_group = 'EG000027');

    -- Get the category code using get_product_symbol (which uses symbol_rules)
    SELECT items.get_product_symbol(v_foss_pid) INTO v_category_code;

    -- If product has a category code, use per-category numbering
    IF v_category_code IS NOT NULL THEN
        -- Find the max sequence for this category in this area revision
        SELECT COALESCE(MAX(pp.symbol_sequence), 0) INTO v_max_sequence
        FROM projects.project_products pp
        JOIN items.product p ON p.id = pp.product_id
        WHERE pp.area_revision_id = NEW.area_revision_id
          AND items.get_product_symbol(p.foss_pid) = v_category_code
          AND pp.id != NEW.id;

        NEW.symbol_sequence := v_max_sequence + 1;
        RETURN NEW;
    END IF;

    -- If it's a luminaire but no category (unclassified), use own sequence for "?" category
    IF v_is_luminaire THEN
        -- Find max sequence among OTHER unclassified luminaires in this area revision
        SELECT COALESCE(MAX(pp.symbol_sequence), 0) INTO v_max_sequence
        FROM projects.project_products pp
        JOIN items.product p ON p.id = pp.product_id
        JOIN items.product_detail pd ON pd.product_id = pp.product_id
        JOIN etim.class c ON pd.class_id = c."ARTCLASSID"
        WHERE pp.area_revision_id = NEW.area_revision_id
          AND c."ARTGROUPID" = 'EG000027'  -- Is a luminaire
          AND items.get_product_symbol(p.foss_pid) IS NULL  -- Also unclassified
          AND pp.id != NEW.id;

        NEW.symbol_sequence := v_max_sequence + 1;
        RETURN NEW;
    END IF;

    -- Not a luminaire and no category - no sequence needed (accessories, etc.)
    NEW.symbol_sequence := NULL;
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION projects.assign_symbol_sequence() IS
'Trigger function to auto-assign symbol_sequence on INSERT to project_products.
- Luminaires with category: per-category numbering (A1, A2, B1, B2...)
- Luminaires without category: own sequence for unclassified (?1, ?2, ?3...)
- Non-luminaires: no sequence (NULL)';

-- ============================================================================
-- 2. Fix query function: get_area_version_products
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
  symbol text,
  etim_group_id text
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
    -- Symbol classification from get_product_symbol
    items.get_product_symbol(p.foss_pid)::character(1) as category_code,
    pp.symbol_sequence,
    -- Symbol: combine letter + sequence, or "?" for unclassified luminaires
    CASE
        -- Classified product: use category letter + sequence (e.g., "A1", "B2")
        WHEN items.get_product_symbol(p.foss_pid) IS NOT NULL
             AND pp.symbol_sequence IS NOT NULL
        THEN items.get_product_symbol(p.foss_pid) || pp.symbol_sequence::text
        -- Unclassified luminaire: use "?" + sequence (e.g., "?1", "?2")
        WHEN ec."ARTGROUPID" = 'EG000027'
             AND pp.symbol_sequence IS NOT NULL
        THEN '?' || pp.symbol_sequence::text
        -- Non-luminaire or no sequence: no symbol
        ELSE NULL
    END as symbol,
    -- ETIM group for luminaire vs accessory classification
    ec."ARTGROUPID" as etim_group_id
  FROM projects.project_products pp
  JOIN items.product p ON p.id = pp.product_id
  LEFT JOIN items.product_detail pd ON pd.product_id = pp.product_id
  LEFT JOIN etim.class ec ON ec."ARTCLASSID" = pd.class_id
  WHERE pp.area_revision_id = p_area_version_id
  ORDER BY pp.added_at;
END;
$function$;

COMMENT ON FUNCTION projects.get_area_version_products(uuid) IS
'Returns products for an area revision with symbol classification.
- Classified luminaires: letter + sequence (A1, B2, C1...)
- Unclassified luminaires: ? + sequence (?1, ?2, ?3...)
- Non-luminaires: no symbol (NULL)';
