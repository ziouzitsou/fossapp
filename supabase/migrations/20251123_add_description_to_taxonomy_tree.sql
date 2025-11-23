-- Migration: Add description field to get_taxonomy_tree function
-- Date: 2025-11-23
-- Description: The get_taxonomy_tree function was missing the description field,
--              causing root category descriptions to not display in the UI.

-- Drop existing function
DROP FUNCTION IF EXISTS search.get_taxonomy_tree();

-- Recreate function with description field
CREATE OR REPLACE FUNCTION search.get_taxonomy_tree()
RETURNS TABLE(
    code text,
    parent_code text,
    level integer,
    name text,
    product_count bigint,
    icon text,
    description text
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'search', 'items', 'etim', 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        t.code,
        t.parent_code,
        t.level,
        t.name,
        COUNT(DISTINCT ptf.product_id) as product_count,
        t.icon,
        t.description
    FROM search.taxonomy t
    LEFT JOIN search.product_taxonomy_flags ptf
        ON t.code = ANY(ptf.taxonomy_path)
    WHERE t.active = true
    GROUP BY t.code, t.parent_code, t.level, t.name, t.icon, t.description, t.display_order
    ORDER BY t.level, t.display_order, t.name;
END;
$function$;

-- Add comment
COMMENT ON FUNCTION search.get_taxonomy_tree() IS
'Returns the complete taxonomy tree with product counts and descriptions for each node';
