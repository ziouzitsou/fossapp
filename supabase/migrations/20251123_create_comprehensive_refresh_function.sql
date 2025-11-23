-- Migration: Create comprehensive materialized view refresh function
-- Purpose: Refresh all product-related materialized views in correct dependency order
-- This should be used after changing items.catalog.active status
-- Date: 2025-11-23

-- Drop existing incomplete function if it exists
DROP FUNCTION IF EXISTS taxonomy_admin.refresh_search_views();

-- Create comprehensive refresh function that handles ALL materialized views
CREATE OR REPLACE FUNCTION taxonomy_admin.refresh_all_product_views()
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
    -- PHASE 1: Refresh items.product_info (FOUNDATION - must be first!)
    -- This view filters products by catalog.active = true
    -- All other views depend on this directly or indirectly
    -- ============================================================================

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_info;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'items.product_info'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'items.product_info'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- ============================================================================
    -- PHASE 2: Refresh other items schema materialized views
    -- These depend on items.product_info or catalog.active
    -- ============================================================================

    -- Refresh items.product_categories_mv
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_categories_mv;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'items.product_categories_mv'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'items.product_categories_mv'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- Refresh items.product_features_mv
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_features_mv;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'items.product_features_mv'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'items.product_features_mv'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- Refresh items.product_feature_group_mapping
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_feature_group_mapping;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'items.product_feature_group_mapping'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'items.product_feature_group_mapping'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- Refresh items.gcfv_mapping
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.gcfv_mapping;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'items.gcfv_mapping'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'items.gcfv_mapping'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- ============================================================================
    -- PHASE 3: Refresh search.product_filter_index
    -- Depends on items.catalog.active directly
    -- Must come before filter_facets
    -- ============================================================================

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW search.product_filter_index;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'search.product_filter_index'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'search.product_filter_index'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- ============================================================================
    -- PHASE 4: Refresh search.product_taxonomy_flags
    -- Depends on items.product_info
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
    -- PHASE 5: Refresh search.filter_facets
    -- Depends on search.product_filter_index
    -- Must come AFTER product_filter_index
    -- ============================================================================

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW search.filter_facets;
        end_time := clock_timestamp();

        RETURN QUERY SELECT
            'search.filter_facets'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT,
            TRUE,
            NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT
            'search.filter_facets'::TEXT,
            0::BIGINT,
            FALSE,
            SQLERRM::TEXT;
    END;

    -- ============================================================================
    -- PHASE 6: Refresh search.taxonomy_product_counts (if exists)
    -- Optional view that may or may not exist
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION taxonomy_admin.refresh_all_product_views() TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION taxonomy_admin.refresh_all_product_views() IS
'Refreshes all product-related materialized views in correct dependency order.
Use this after changing items.catalog.active status or when product data changes.

Order:
1. items.product_info (foundation - filters by catalog.active)
2. items schema views (product_categories_mv, product_features_mv, etc.)
3. search.product_filter_index (depends on catalog.active)
4. search.product_taxonomy_flags (depends on items.product_info)
5. search.filter_facets (depends on product_filter_index)
6. search.taxonomy_product_counts (optional)

Returns timing and success status for each view refresh.';

-- Create a simpler alias for backward compatibility
CREATE OR REPLACE FUNCTION taxonomy_admin.refresh_search_views()
RETURNS TABLE(
    view_name TEXT,
    refresh_duration_ms BIGINT,
    success BOOLEAN,
    error_message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Just call the comprehensive function
    RETURN QUERY SELECT * FROM taxonomy_admin.refresh_all_product_views();
END;
$$;

GRANT EXECUTE ON FUNCTION taxonomy_admin.refresh_search_views() TO authenticated;

COMMENT ON FUNCTION taxonomy_admin.refresh_search_views() IS
'Alias for refresh_all_product_views(). Maintained for backward compatibility.';
