-- Migration: Add lightweight taxonomy refresh function
-- Purpose: Refresh only taxonomy-related views when taxonomy rules change
-- This is much faster than full refresh since it skips items.product_info
-- Date: 2025-11-23

-- Lightweight refresh for taxonomy/rule changes only
CREATE OR REPLACE FUNCTION taxonomy_admin.refresh_taxonomy_only()
RETURNS TABLE(
    view_name TEXT,
    refresh_duration_ms BIGINT,
    success BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    -- ============================================================================
    -- Refresh search.product_taxonomy_flags
    -- This is where taxonomy assignments happen based on classification_rules
    -- ============================================================================

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW search.product_taxonomy_flags;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'search.product_taxonomy_flags'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'search.product_taxonomy_flags'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- ============================================================================
    -- Refresh search.taxonomy_product_counts (if exists)
    -- ============================================================================

    IF EXISTS (
        SELECT 1 FROM pg_matviews
        WHERE schemaname = 'search'
        AND matviewname = 'taxonomy_product_counts'
    ) THEN
        start_time := clock_timestamp();
        BEGIN
            REFRESH MATERIALIZED VIEW search.taxonomy_product_counts;
            end_time := clock_timestamp();

            RETURN QUERY SELECT
                'search.taxonomy_product_counts'::TEXT,
                EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
                TRUE,
                NULL::TEXT;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT
                'search.taxonomy_product_counts'::TEXT,
                0::BIGINT,
                FALSE,
                SQLERRM::TEXT;
        END;
    END IF;

    RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION taxonomy_admin.refresh_taxonomy_only() TO authenticated;

COMMENT ON FUNCTION taxonomy_admin.refresh_taxonomy_only() IS
'Lightweight refresh for taxonomy changes only (e.g., updating classification_rules, taxonomy table).
Does NOT refresh items.product_info or other product views.
Use this after:
  - Adding/modifying classification rules
  - Changing taxonomy structure
  - Updating taxonomy flags

For catalog.active changes, use refresh_all_product_views() instead.';

-- Update the comprehensive function comment to clarify when to use it
COMMENT ON FUNCTION taxonomy_admin.refresh_all_product_views() IS
'FULL refresh of all product-related materialized views.
Use this ONLY after changing items.catalog.active status or major product data changes.

For taxonomy/rule changes only, use refresh_taxonomy_only() instead (much faster).

Order:
1. items.product_info (foundation - filters by catalog.active)
2. items schema views (product_categories_mv, product_features_mv, etc.)
3. search.product_filter_index (depends on catalog.active)
4. search.product_taxonomy_flags (depends on items.product_info)
5. search.filter_facets (depends on product_filter_index)
6. search.taxonomy_product_counts (optional)

Returns timing and success status for each view refresh.';
