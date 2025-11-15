-- Reorganize functions into domain schemas
-- Migration: 20251115_reorganize_functions_to_domain_schemas
-- Purpose: Move functions from public schema to their appropriate domain schemas (items, analytics)
-- Best Practice: Functions should live close to their data

-- ============================================================================
-- ITEMS SCHEMA FUNCTIONS
-- ============================================================================

-- Create function in items schema (works with items.catalog, items.supplier, items.product)
CREATE OR REPLACE FUNCTION items.get_active_catalogs_with_counts()
 RETURNS TABLE(
   catalog_name text,
   generation_date date,
   supplier_name text,
   country text,
   country_flag text,
   supplier_logo text,
   supplier_logo_dark text,
   product_count bigint
 )
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    c.catalog_name,
    c.generation_date,
    COALESCE(s.supplier_name, 'Unknown') as supplier_name,
    COALESCE(s.country, '') as country,
    s.country_flag,
    s.logo as supplier_logo,
    s.logo_dark as supplier_logo_dark,
    COUNT(p.id) as product_count
  FROM items.catalog c
  LEFT JOIN items.supplier s ON c.supplier_id = s.id
  LEFT JOIN items.product p ON p.catalog_id = c.id
  WHERE c.active = true
  GROUP BY
    c.catalog_name,
    c.generation_date,
    s.supplier_name,
    s.country,
    s.country_flag,
    s.logo,
    s.logo_dark
  ORDER BY c.generation_date DESC;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION items.get_active_catalogs_with_counts() TO service_role;
GRANT EXECUTE ON FUNCTION items.get_active_catalogs_with_counts() TO authenticated;

COMMENT ON FUNCTION items.get_active_catalogs_with_counts() IS 'Returns active catalogs with product counts and supplier information (moved from public schema for better organization)';

-- ============================================================================
-- ANALYTICS SCHEMA FUNCTIONS
-- ============================================================================

-- Create function in analytics schema (works with analytics.user_events)
CREATE OR REPLACE FUNCTION analytics.get_most_active_users(user_limit integer DEFAULT 5)
 RETURNS TABLE(
   user_id text,
   event_count bigint,
   last_active timestamp with time zone,
   login_count bigint,
   search_count bigint,
   product_view_count bigint
 )
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    user_id,
    COUNT(*) as event_count,
    MAX(created_at) as last_active,
    SUM(CASE WHEN event_type = 'login' THEN 1 ELSE 0 END) as login_count,
    SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) as search_count,
    SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) as product_view_count
  FROM analytics.user_events
  GROUP BY user_id
  ORDER BY event_count DESC
  LIMIT user_limit;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION analytics.get_most_active_users(integer) TO service_role;
GRANT EXECUTE ON FUNCTION analytics.get_most_active_users(integer) TO authenticated;

COMMENT ON FUNCTION analytics.get_most_active_users(integer) IS 'Returns most active users based on event tracking (moved from public schema for better organization)';

-- ============================================================================
-- MARK OLD PUBLIC SCHEMA FUNCTIONS AS OBSOLETE
-- ============================================================================

-- Add deprecation comment to old public.get_active_catalogs_with_counts
COMMENT ON FUNCTION public.get_active_catalogs_with_counts() IS
'⚠️ OBSOLETE - Use items.get_active_catalogs_with_counts() instead. This function will be removed in a future migration. Kept for backwards compatibility only.';

-- Add deprecation comment to old public.get_most_active_users
COMMENT ON FUNCTION public.get_most_active_users(integer) IS
'⚠️ OBSOLETE - Use analytics.get_most_active_users() instead. This function will be removed in a future migration. Kept for backwards compatibility only.';

-- ============================================================================
-- MARK UNUSED PUBLIC SCHEMA FUNCTIONS AS OBSOLETE
-- ============================================================================

-- count_search_products (3 overloaded versions)
COMMENT ON FUNCTION public.count_search_products(p_query text, p_taxonomy_codes text[], p_suppliers text[], p_indoor boolean, p_outdoor boolean, p_power_min numeric, p_power_max numeric, p_ip_ratings text[]) IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

COMMENT ON FUNCTION public.count_search_products(p_query text, p_taxonomy_codes text[], p_suppliers text[], p_indoor boolean, p_outdoor boolean, p_submersible boolean, p_power_min numeric, p_power_max numeric, p_ip_ratings text[]) IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

COMMENT ON FUNCTION public.count_search_products(p_query text, p_taxonomy_codes text[], p_suppliers text[], p_indoor boolean, p_outdoor boolean, p_submersible boolean, p_trimless boolean, p_cut_shape_round boolean, p_cut_shape_rectangular boolean, p_power_min numeric, p_power_max numeric, p_ip_ratings text[]) IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

-- search_products (3 overloaded versions)
COMMENT ON FUNCTION public.search_products(p_query text, p_taxonomy_codes text[], p_suppliers text[], p_indoor boolean, p_outdoor boolean, p_power_min numeric, p_power_max numeric, p_ip_ratings text[], p_limit integer, p_offset integer) IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

COMMENT ON FUNCTION public.search_products(p_query text, p_taxonomy_codes text[], p_suppliers text[], p_indoor boolean, p_outdoor boolean, p_submersible boolean, p_power_min numeric, p_power_max numeric, p_ip_ratings text[], p_limit integer, p_offset integer) IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

COMMENT ON FUNCTION public.search_products(p_query text, p_taxonomy_codes text[], p_suppliers text[], p_indoor boolean, p_outdoor boolean, p_submersible boolean, p_trimless boolean, p_cut_shape_round boolean, p_cut_shape_rectangular boolean, p_power_min numeric, p_power_max numeric, p_ip_ratings text[], p_limit integer, p_offset integer) IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

-- Other unused functions
COMMENT ON FUNCTION public.get_available_facets() IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to items schema.';

COMMENT ON FUNCTION public.get_search_statistics() IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to analytics schema.';

COMMENT ON FUNCTION public.get_taxonomy_tree() IS
'⚠️ OBSOLETE - Never used in application code. Candidate for removal. If needed, should be moved to etim schema.';

COMMENT ON FUNCTION public.execute_sql(query text) IS
'⚠️ POTENTIALLY DANGEROUS - Executes arbitrary SQL. Review security implications before use. Consider removal if not needed.';

COMMENT ON FUNCTION public.match_n8n_rag(query_embedding vector, match_count integer, filter jsonb) IS
'⚠️ OBSOLETE - Never used in application code. Related to N8N integration. Candidate for removal if N8N not actively used.';

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- This migration:
-- ✅ Created items.get_active_catalogs_with_counts() - new home for catalog functions
-- ✅ Created analytics.get_most_active_users() - new home for analytics functions
-- ✅ Marked old public schema versions as OBSOLETE (kept for backwards compatibility)
-- ✅ Marked 10 unused public functions as OBSOLETE candidates for removal
--
-- Next steps:
-- 1. Update src/lib/actions.ts to use new schema-specific functions
-- 2. Test thoroughly
-- 3. In future migration: DROP old public schema functions
