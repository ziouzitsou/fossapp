


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "analytics";


ALTER SCHEMA "analytics" OWNER TO "postgres";


COMMENT ON SCHEMA "analytics" IS 'Analytics and monitoring data (user events, metrics, etc.)';



CREATE SCHEMA IF NOT EXISTS "bsdd";


ALTER SCHEMA "bsdd" OWNER TO "postgres";


COMMENT ON SCHEMA "bsdd" IS 'buildingSMART Data Dictionary schema - enhanced version of ETIM with full bSDD data';



CREATE SCHEMA IF NOT EXISTS "customers";


ALTER SCHEMA "customers" OWNER TO "postgres";


COMMENT ON SCHEMA "customers" IS 'Customer management schema for Greek ERP customers';



CREATE SCHEMA IF NOT EXISTS "etim";


ALTER SCHEMA "etim" OWNER TO "postgres";


COMMENT ON SCHEMA "etim" IS 'The ETIM standards are implemented in this schema. Accurate tables and data derived directly from ETIM API';



CREATE SCHEMA IF NOT EXISTS "items";


ALTER SCHEMA "items" OWNER TO "postgres";


COMMENT ON SCHEMA "items" IS 'Our company''s (Foss SA) item schema. Contains suppliers, catalogs, products with details, extentions etc';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgsodium";






CREATE SCHEMA IF NOT EXISTS "projects";


ALTER SCHEMA "projects" OWNER TO "postgres";


COMMENT ON SCHEMA "projects" IS 'Lighting design project management schema - exposed to PostgREST API';



COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "rag";


ALTER SCHEMA "rag" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "retool";


ALTER SCHEMA "retool" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "search";


ALTER SCHEMA "search" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "undefined";


ALTER SCHEMA "undefined" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "analytics"."create_user_settings"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO analytics.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "analytics"."create_user_settings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "analytics"."get_most_active_users"("user_limit" integer DEFAULT 5) RETURNS TABLE("user_id" "text", "event_count" bigint, "last_active" timestamp with time zone, "login_count" bigint, "search_count" bigint, "product_view_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT user_id, COUNT(*) as event_count, MAX(created_at) as last_active,
    SUM(CASE WHEN event_type = 'login' THEN 1 ELSE 0 END) as login_count,
    SUM(CASE WHEN event_type = 'search' THEN 1 ELSE 0 END) as search_count,
    SUM(CASE WHEN event_type = 'product_view' THEN 1 ELSE 0 END) as product_view_count
  FROM analytics.user_events
  GROUP BY user_id ORDER BY event_count DESC LIMIT user_limit;
$$;


ALTER FUNCTION "analytics"."get_most_active_users"("user_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "analytics"."get_most_active_users"("user_limit" integer) IS 'Returns most active users (moved from public schema)';



CREATE OR REPLACE FUNCTION "analytics"."update_user_settings_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "analytics"."update_user_settings_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "analytics"."upsert_user_on_login"("p_email" "text", "p_name" "text" DEFAULT NULL::"text", "p_image" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "email" "text", "name" "text", "image" "text", "group_id" integer, "group_name" "text", "is_active" boolean, "first_login_at" timestamp with time zone, "last_login_at" timestamp with time zone, "login_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_user_id UUID;
  v_is_new BOOLEAN := FALSE;
BEGIN
  -- Check if user exists
  SELECT u.id INTO v_user_id FROM analytics.users u WHERE u.email = p_email;

  IF v_user_id IS NULL THEN
    -- First login: create user
    INSERT INTO analytics.users (email, name, image, first_login_at, last_login_at, login_count)
    VALUES (p_email, p_name, p_image, NOW(), NOW(), 1)
    RETURNING analytics.users.id INTO v_user_id;
    v_is_new := TRUE;
  ELSE
    -- Returning user: update last login
    UPDATE analytics.users u
    SET name = COALESCE(p_name, u.name),
        image = COALESCE(p_image, u.image),
        last_login_at = NOW(),
        login_count = u.login_count + 1,
        updated_at = NOW()
    WHERE u.id = v_user_id;
  END IF;

  -- Return user with group name
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    u.name,
    u.image,
    u.group_id,
    g.name AS group_name,
    u.is_active,
    u.first_login_at,
    u.last_login_at,
    u.login_count
  FROM analytics.users u
  JOIN analytics.user_groups g ON u.group_id = g.id
  WHERE u.id = v_user_id;
END;
$$;


ALTER FUNCTION "analytics"."upsert_user_on_login"("p_email" "text", "p_name" "text", "p_image" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "customers"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "customers"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "items"."auto_fill_etim_feature_data"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'items', 'etim', 'public', 'extensions'
    AS $$
BEGIN
    -- Get both feature name and feature type from etim.feature_value_lookup
    SELECT feature_description, feature_type 
    INTO NEW.etim_feature_name, NEW.etim_feature_type
    FROM etim.feature_value_lookup
    WHERE featureid = NEW.etim_feature
    LIMIT 1;
    
    -- If feature not found, raise an error
    IF NEW.etim_feature_name IS NULL THEN
        RAISE EXCEPTION 'ETIM Feature ID % not found', NEW.etim_feature;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "items"."auto_fill_etim_feature_data"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "items"."generate_product_categories_mv_sql"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'items', 'public', 'extensions'
    AS $$
DECLARE
    column_defs TEXT := '';
    join_defs TEXT := '';
    index_defs TEXT := '';
    combined_index_cols TEXT := '';
    result_sql TEXT;
    join_record RECORD;
BEGIN
    -- Generate the join definitions for feature IDs
    FOR join_record IN 
        SELECT DISTINCT join_feature_id, join_alias 
        FROM items.category_switches 
        WHERE join_feature_id IS NOT NULL AND join_alias IS NOT NULL
    LOOP
        join_defs := join_defs || format(
            E'LEFT JOIN items.product_feature %I ON p.id = %I.product_id AND %I.fname_id = ''%s''\\n',
            join_record.join_alias, join_record.join_alias, join_record.join_alias, join_record.join_feature_id
        );
    END LOOP;

    -- Generate the column definitions
    SELECT string_agg(
        CASE 
            WHEN switch_type = 'etim_group' THEN
                format(', (g."ARTGROUPID" = %L) AS %I', etim_group_id, switch_name)
            
            WHEN switch_type = 'etim_class' THEN
                format(', (cl."ARTCLASSID" = ANY (string_to_array(%L, '', ''))) AS %I', 
                       etim_class_ids, switch_name)
            
            WHEN switch_type = 'etim_feature' THEN
                format(', EXISTS (SELECT 1 FROM items.product_feature WHERE 
                         product_feature.product_id = p.id AND 
                         product_feature.fname_id = ANY (string_to_array(%L, '', '')) AND 
                         product_feature.fvalueb = true) AS %I', 
                       etim_feature_ids, switch_name)
            
            WHEN switch_type = 'combined' THEN
                format(', CASE WHEN %s THEN true ELSE false END AS %I',
                    CASE 
                        WHEN join_feature_id IS NOT NULL AND join_alias IS NOT NULL THEN
                            format('((cl."ARTCLASSID" = ANY (string_to_array(%L, '', ''))) AND 
                                   %I.fvalueb = true)', 
                                  etim_class_ids, join_alias)
                        ELSE
                            format('((cl."ARTCLASSID" = ANY (string_to_array(%L, '', ''))) AND 
                                   EXISTS (SELECT 1 FROM items.product_feature WHERE 
                                   product_feature.product_id = p.id AND 
                                   product_feature.fname_id = ANY (string_to_array(%L, '', '')) AND 
                                   product_feature.fvalueb = true))', 
                                  etim_class_ids, etim_feature_ids)
                    END,
                    switch_name)
            
            WHEN switch_type = 'text_pattern' THEN
                format(', CASE WHEN pd.description_long ~~* %L THEN true ELSE false END AS %I', 
                       text_pattern, switch_name)
            
            ELSE
                format(', NULL::boolean AS %I', switch_name)
        END, 
        ''
    ) INTO column_defs
    FROM items.category_switches;

    -- Generate the index definitions
    SELECT string_agg(
        format('CREATE INDEX idx_product_categories_mv_%s ON items.product_categories_mv USING btree (%s)%s;', 
            switch_name, 
            switch_name,
            CASE 
                WHEN switch_type != 'placeholder' THEN format(' WHERE (%s = true)', switch_name)
                ELSE ''
            END
        ),
        E'\n'
    ) INTO index_defs
    FROM items.category_switches;

    -- Generate the combined index columns (for main filtering)
    SELECT string_agg(
        quote_ident(switch_name), ', '
    ) INTO combined_index_cols
    FROM items.category_switches
    WHERE switch_type IN ('etim_group', 'combined', 'text_pattern')
    LIMIT 12;  -- Use the first 12 important columns for the combined index

    -- Build the final SQL
    result_sql := format(
        E'DROP MATERIALIZED VIEW IF EXISTS items.product_categories_mv;\n\n'
        'CREATE MATERIALIZED VIEW items.product_categories_mv AS\n'
        'SELECT p.id AS product_id%s\n'
        'FROM items.product p\n'
        'JOIN items.catalog c ON p.catalog_id = c.id AND c.active = true\n'
        'JOIN items.product_detail pd ON p.id = pd.product_id\n'
        'JOIN etim.class cl ON pd.class_id = cl."ARTCLASSID"\n'
        'JOIN etim.group g ON cl."ARTGROUPID" = g."ARTGROUPID"\n'
        '%s'
        'WITH DATA;\n\n'
        'CREATE UNIQUE INDEX idx_product_categories_mv_product_id ON items.product_categories_mv USING btree (product_id);\n'
        'CREATE INDEX idx_product_categories_mv_combined ON items.product_categories_mv USING btree (%s);\n'
        '%s',
        column_defs,
        join_defs,
        combined_index_cols,
        index_defs
    );

    RETURN result_sql;
END;
$$;


ALTER FUNCTION "items"."generate_product_categories_mv_sql"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "items"."get_active_catalogs_with_counts"() RETURNS TABLE("catalog_name" "text", "generation_date" "date", "supplier_name" "text", "country" "text", "country_flag" "text", "supplier_logo" "text", "supplier_logo_dark" "text", "product_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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
  GROUP BY c.catalog_name, c.generation_date, s.supplier_name, s.country, s.country_flag, s.logo, s.logo_dark
  ORDER BY c.generation_date DESC;
$$;


ALTER FUNCTION "items"."get_active_catalogs_with_counts"() OWNER TO "postgres";


COMMENT ON FUNCTION "items"."get_active_catalogs_with_counts"() IS 'Returns active catalogs with product counts (moved from public schema)';



CREATE OR REPLACE FUNCTION "items"."get_dashboard_stats"() RETURNS TABLE("total_products" bigint, "total_suppliers" bigint, "total_families" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    (SELECT COUNT(*) FROM items.product_info),
    (SELECT COUNT(DISTINCT supplier_name) FROM items.product_info WHERE supplier_name IS NOT NULL),
    (SELECT COUNT(DISTINCT family) FROM items.product_info WHERE family IS NOT NULL)
$$;


ALTER FUNCTION "items"."get_dashboard_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "items"."get_dashboard_stats"() IS 'Returns total products, suppliers, and families count in a single optimized query';



CREATE OR REPLACE FUNCTION "items"."get_supplier_stats"() RETURNS TABLE("supplier_name" "text", "product_count" bigint, "supplier_logo" "text", "supplier_logo_dark" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    supplier_name,
    COUNT(*) as product_count,
    MAX(supplier_logo) as supplier_logo,
    MAX(supplier_logo_dark) as supplier_logo_dark
  FROM items.product_info
  WHERE supplier_name IS NOT NULL
  GROUP BY supplier_name
  ORDER BY product_count DESC
$$;


ALTER FUNCTION "items"."get_supplier_stats"() OWNER TO "postgres";


COMMENT ON FUNCTION "items"."get_supplier_stats"() IS 'Returns supplier statistics with product counts, ordered by count descending';



CREATE OR REPLACE FUNCTION "items"."get_top_families"("p_limit" integer DEFAULT 10) RETURNS TABLE("family" "text", "product_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    family,
    COUNT(*) as product_count
  FROM items.product_info
  WHERE family IS NOT NULL
  GROUP BY family
  ORDER BY product_count DESC
  LIMIT p_limit
$$;


ALTER FUNCTION "items"."get_top_families"("p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "items"."get_top_families"("p_limit" integer) IS 'Returns top N families by product count';



CREATE OR REPLACE FUNCTION "items"."refresh_product_categories_mv"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'items', 'public', 'extensions'
    AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY items.product_categories_mv;
END;
$$;


ALTER FUNCTION "items"."refresh_product_categories_mv"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "projects"."generate_project_code"() RETURNS "text"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $_$
DECLARE
  current_prefix TEXT;
  max_serial INTEGER;
  new_serial INTEGER;
BEGIN
  -- Get current YYMM prefix
  current_prefix := TO_CHAR(NOW(), 'YYMM');

  -- Find max serial for this prefix
  SELECT MAX(
    CAST(SUBSTRING(project_code FROM 6 FOR 3) AS INTEGER)
  ) INTO max_serial
  FROM projects.projects
  WHERE project_code ~ ('^' || current_prefix || '-[0-9]{3}$');

  -- Calculate new serial
  IF max_serial IS NULL THEN
    new_serial := 1;
  ELSE
    new_serial := max_serial + 1;
  END IF;

  -- Return formatted code
  RETURN current_prefix || '-' || LPAD(new_serial::TEXT, 3, '0');
END;
$_$;


ALTER FUNCTION "projects"."generate_project_code"() OWNER TO "postgres";


COMMENT ON FUNCTION "projects"."generate_project_code"() IS 'Generates project code in YYMM-NNN format';



CREATE OR REPLACE FUNCTION "projects"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "projects"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_products_with_filters"("p_query" "text" DEFAULT NULL::"text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean) RETURNS bigint
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT search.count_products_with_filters(
        p_query, p_filters, p_taxonomy_codes, p_suppliers,
        p_indoor, p_outdoor, p_submersible, p_trimless,
        p_cut_shape_round, p_cut_shape_rectangular
    );
$$;


ALTER FUNCTION "public"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_search_products"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[]) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Call the search schema's count function (we'll create this next)
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM search.search_products(
    p_query := p_query,
    p_taxonomy_codes := p_taxonomy_codes,
    p_suppliers := p_suppliers,
    p_indoor := p_indoor,
    p_outdoor := p_outdoor,
    p_power_min := p_power_min,
    p_power_max := p_power_max,
    p_ip_ratings := p_ip_ratings,
    p_limit := NULL,  -- No limit for count
    p_offset := 0
  );
  
  RETURN v_count;
END;
$$;


ALTER FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) IS 'CLIENT-SIDE WRAPPER for search.count_search_products() - Version 1.

PURPOSE: Count matching products for pagination UI (client-side apps).

USED BY: search-test-app for "Results (X)" count display.

See public.search_products() for architecture details.';



CREATE OR REPLACE FUNCTION "public"."count_search_products"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[]) RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN search.count_search_products(
        p_query := p_query,
        p_indoor := p_indoor,
        p_outdoor := p_outdoor,
        p_submersible := p_submersible,
        p_ceiling := NULL,
        p_wall := NULL,
        p_pendant := NULL,
        p_recessed := NULL,
        p_dimmable := NULL,
        p_power_min := p_power_min,
        p_power_max := p_power_max,
        p_color_temp_min := NULL,
        p_color_temp_max := NULL,
        p_ip_ratings := p_ip_ratings,
        p_suppliers := p_suppliers,
        p_taxonomy_codes := p_taxonomy_codes
    );
END;
$$;


ALTER FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) IS 'CLIENT-SIDE WRAPPER for search.count_search_products() - Version 2 (with submersible).

See Version 1 comment for full documentation.';



CREATE OR REPLACE FUNCTION "public"."count_search_products"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[]) RETURNS bigint
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN search.count_search_products(
        p_query := p_query,
        p_indoor := p_indoor,
        p_outdoor := p_outdoor,
        p_submersible := p_submersible,
        p_trimless := p_trimless,
        p_cut_shape_round := p_cut_shape_round,
        p_cut_shape_rectangular := p_cut_shape_rectangular,
        p_ceiling := NULL,
        p_wall := NULL,
        p_pendant := NULL,
        p_recessed := NULL,
        p_dimmable := NULL,
        p_power_min := p_power_min,
        p_power_max := p_power_max,
        p_color_temp_min := NULL,
        p_color_temp_max := NULL,
        p_ip_ratings := p_ip_ratings,
        p_suppliers := p_suppliers,
        p_taxonomy_codes := p_taxonomy_codes
    );
END;
$$;


ALTER FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) IS 'CLIENT-SIDE WRAPPER for search.count_search_products() - Version 3 (LATEST - with cut shapes).

See Version 1 comment for full documentation.

CURRENT VERSION: Use this version for new client-side integrations.';



CREATE OR REPLACE FUNCTION "public"."execute_sql"("query" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    result jsonb;
BEGIN
    EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query || ') t' INTO result;
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."execute_sql"("query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."execute_sql"("query" "text") IS '⚠️ POTENTIALLY DANGEROUS - Review security';



CREATE OR REPLACE FUNCTION "public"."get_active_catalogs_with_counts"() RETURNS TABLE("catalog_name" "text", "generation_date" "date", "supplier_name" "text", "country" "text", "country_flag" "text", "supplier_logo" "text", "supplier_logo_dark" "text", "product_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."get_active_catalogs_with_counts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_active_catalogs_with_counts"() IS '⚠️ OBSOLETE - Use items.get_active_catalogs_with_counts()';



CREATE OR REPLACE FUNCTION "public"."get_available_facets"() RETURNS TABLE("filter_key" "text", "filter_type" "text", "label" "text", "facet_data" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.get_available_facets();
END;
$$;


ALTER FUNCTION "public"."get_available_facets"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_facets"() IS 'CLIENT-SIDE WRAPPER for search.get_available_facets().

PURPOSE: Get available filters with current value distributions for filter UI.

RETURNS: Filter metadata with statistics (min/max, histograms, value counts).

USED BY:
  - Dynamic filter UI components
  - Filter panels that show current value distributions
  - Search interfaces needing to display available filter options

EXAMPLE (Client-side):
  const { data: facets } = await supabase.rpc("get_available_facets");
  // Returns: [
  //   {
  //     filter_key: "power",
  //     filter_type: "numeric_range",
  //     label: "Power (W)",
  //     facet_data: { min: 3.5, max: 250, avg: 18.2, histogram: [...] }
  //   },
  //   {
  //     filter_key: "ip_rating",
  //     filter_type: "alphanumeric",
  //     label: "IP Rating",
  //     facet_data: { "IP20": 5600, "IP44": 3200, "IP65": 2100 }
  //   }
  // ]

PERFORMANCE: Fast (<50ms) - reads from filter_facets materialized view.

NOTE: If filter_definitions table is empty, this will return empty array.
      Populate filter_definitions first to enable this feature.

SEE ALSO: search.get_available_facets() for full documentation.';



CREATE OR REPLACE FUNCTION "public"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("flag_name" "text", "true_count" bigint, "false_count" bigint, "total_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT * FROM search.get_boolean_flag_counts(p_taxonomy_codes);
$$;


ALTER FUNCTION "public"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dynamic_facets"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_query" "text" DEFAULT NULL::"text") RETURNS TABLE("filter_category" "text", "filter_key" "text", "filter_value" "text", "product_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT * FROM search.get_dynamic_facets(
        p_taxonomy_codes, p_filters, p_suppliers,
        p_indoor, p_outdoor, p_submersible, p_trimless,
        p_cut_shape_round, p_cut_shape_rectangular,
        p_query
    );
$$;


ALTER FUNCTION "public"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filter_definitions_with_type"("p_taxonomy_code" "text" DEFAULT 'LUMINAIRE'::"text") RETURNS TABLE("filter_key" "text", "label" "text", "filter_type" "text", "etim_feature_id" "text", "etim_feature_type" "text", "ui_config" "jsonb", "display_order" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.get_filter_definitions_with_type(p_taxonomy_code);
END;
$$;


ALTER FUNCTION "public"."get_filter_definitions_with_type"("p_taxonomy_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_filter_facets_with_context"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean) RETURNS TABLE("flag_name" "text", "true_count" bigint, "false_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT * FROM search.get_filter_facets_with_context(
        p_query := p_query,
        p_taxonomy_codes := p_taxonomy_codes,
        p_suppliers := p_suppliers,
        p_indoor := p_indoor,
        p_outdoor := p_outdoor,
        p_submersible := p_submersible,
        p_trimless := p_trimless,
        p_cut_shape_round := p_cut_shape_round,
        p_cut_shape_rectangular := p_cut_shape_rectangular
    );
$$;


ALTER FUNCTION "public"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_most_active_users"("user_limit" integer DEFAULT 5) RETURNS TABLE("user_id" "text", "event_count" bigint, "last_active" timestamp with time zone, "login_count" bigint, "search_count" bigint, "product_view_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."get_most_active_users"("user_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_most_active_users"("user_limit" integer) IS '⚠️ OBSOLETE - Use analytics.get_most_active_users()';



CREATE OR REPLACE FUNCTION "public"."get_product_verification_data"("p_foss_pid" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'product', jsonb_build_object(
            'id', p.id,
            'foss_pid', p.foss_pid,
            'description_short', pd.description_short,
            'description_long', pd.description_long,
            'manufacturer_pid', pd.manufacturer_pid,
            'class_id', pd.class_id,
            'family', pd.family,
            'supplier_name', s.supplier_name
        ),
        'features', (
            SELECT jsonb_agg(jsonb_build_object(
                'feature_id', f."FEATUREID",
                'feature_name', f."FEATUREDESC",
                'feature_def_ai', f."FEATUREDEFAI",
                'value_code', pf.fvaluec,
                'value_desc', v."VALUEDESC",
                'value_numeric', pf.fvaluen,
                'value_bool', pf.fvalueb,
                'value_range', pf.fvaluer,
                'unit', u."UNITDESC"
            ))
            FROM items.product_feature pf
            JOIN etim.feature f ON f."FEATUREID" = pf.fname_id
            LEFT JOIN etim.value v ON v."VALUEID" = pf.fvaluec
            LEFT JOIN etim.unit u ON u."UNITOFMEASID" = pf.funit
            WHERE pf.product_id = p.id
        )
    ) INTO result
    FROM items.product p
    JOIN items.product_detail pd ON pd.product_id = p.id
    JOIN items.supplier s ON s.id = p.supplier_id
    WHERE p.foss_pid = p_foss_pid;
    
    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_product_verification_data"("p_foss_pid" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_products_by_taxonomy_and_supplier"("p_taxonomy_ids" "uuid"[], "p_supplier_name" "text") RETURNS TABLE("product_id" "uuid")
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT DISTINCT pfi.product_id
  FROM search.product_filter_index pfi
  WHERE pfi.product_id = ANY(p_taxonomy_ids)
    AND pfi.filter_key = 'supplier'
    AND pfi.alphanumeric_value = p_supplier_name;
$$;


ALTER FUNCTION "public"."get_products_by_taxonomy_and_supplier"("p_taxonomy_ids" "uuid"[], "p_supplier_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_root_categories"() RETURNS TABLE("code" "text", "name" "text", "icon" "text", "description" "text", "display_order" integer)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
    SELECT 
        t.code,
        t.name,
        t.icon,
        t.description,
        t.display_order
    FROM search.taxonomy t
    WHERE t.level = 1 
      AND t.active = true
    ORDER BY t.display_order NULLS LAST, t.name;
$$;


ALTER FUNCTION "public"."get_root_categories"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_search_statistics"() RETURNS TABLE("stat_name" "text", "stat_value" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.get_search_statistics();
END;
$$;


ALTER FUNCTION "public"."get_search_statistics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_search_statistics"() IS 'CLIENT-SIDE WRAPPER for search.get_search_statistics().

PURPOSE: System-wide search statistics for dashboard/monitoring.

RETURNS: Statistics like total products, indoor/outdoor counts, dimmable count.

USED BY:
  - search-test-app ("Load System Stats" button)
  - Dashboard components
  - Health monitoring

EXAMPLE (Client-side):
  const { data: stats } = await supabase.rpc("get_search_statistics");
  // Returns: [
  //   { stat_name: "total_products", stat_value: 14889 },
  //   { stat_name: "indoor_products", stat_value: 10402 },
  //   ...
  // ]

PERFORMANCE: Fast (<100ms) - reads from materialized views.

SEE ALSO: search.get_search_statistics() for full documentation.';



CREATE OR REPLACE FUNCTION "public"."get_taxonomy_tree"() RETURNS TABLE("code" "text", "parent_code" "text", "level" integer, "name" "text", "product_count" bigint, "icon" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.get_taxonomy_tree();
END;
$$;


ALTER FUNCTION "public"."get_taxonomy_tree"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_taxonomy_tree"() IS 'CLIENT-SIDE WRAPPER for search.get_taxonomy_tree().

PURPOSE: Retrieve hierarchical product categories for navigation UI.

RETURNS: Complete taxonomy tree with product counts per category.

USED BY:
  - search-test-app (FacetedCategoryNavigation component)
  - Any client-side app needing category navigation

EXAMPLE (Client-side):
  const { data: categories } = await supabase.rpc("get_taxonomy_tree");
  // Returns: [
  //   { code: "LUMINAIRE", name: "Luminaires", product_count: 13336, ... },
  //   { code: "LUMINAIRE-INDOOR-CEILING", name: "Ceiling", product_count: 7361, ... }
  // ]

PERFORMANCE: Fast (<50ms) - cached taxonomy data.

SEE ALSO: search.get_taxonomy_tree() for full documentation.';



CREATE OR REPLACE FUNCTION "public"."match_n8n_rag"("query_embedding" "extensions"."vector", "match_count" integer DEFAULT NULL::integer, "filter" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("id" bigint, "content" "text", "metadata" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (n8n_rag.embedding <=> query_embedding) as similarity
  from n8n_rag
  where metadata @> filter
  order by n8n_rag.embedding <=> query_embedding
  limit match_count;
end;
$$;


ALTER FUNCTION "public"."match_n8n_rag"("query_embedding" "extensions"."vector", "match_count" integer, "filter" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."match_n8n_rag"("query_embedding" "extensions"."vector", "match_count" integer, "filter" "jsonb") IS '⚠️ OBSOLETE - N8N related';



CREATE OR REPLACE FUNCTION "public"."search_products"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        sp.product_id,
        sp.foss_pid,
        sp.description_short,
        sp.description_long,
        sp.supplier_name,
        sp.class_name,
        sp.price,
        sp.image_url,
        sp.flags,
        sp.key_features,
        sp.relevance_score
    FROM search.search_products(
        p_query := p_query,
        p_taxonomy_codes := p_taxonomy_codes,
        p_suppliers := p_suppliers,
        p_indoor := p_indoor,
        p_outdoor := p_outdoor,
        p_power_min := p_power_min,
        p_power_max := p_power_max,
        p_ip_ratings := p_ip_ratings,
        p_limit := p_limit,
        p_offset := p_offset
    ) sp;
END;
$$;


ALTER FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) IS 'CLIENT-SIDE WRAPPER for search.search_products() - Version 1 (basic filters).

PURPOSE: Allows client-side applications using anon/publishable key to search products.

USED BY:
  - search-test-app (verified working)
  - Browser-based applications with Supabase client
  - External API consumers with anon key

ARCHITECTURE:
  - SECURITY DEFINER: Bypasses RLS to allow authenticated users to search
  - Thin wrapper: Just calls search.search_products() with same parameters
  - Performance: Adds ~5-10ms overhead vs direct search.* call

WHEN TO USE:
  ✅ Client-side apps (browser, mobile)
  ✅ Applications using NEXT_PUBLIC_SUPABASE_ANON_KEY
  ✅ supabase.rpc("search_products", {...}) calls from client

WHEN NOT TO USE:
  ❌ Server-side apps with service_role key (call search.search_products directly)
  ❌ FOSSAPP server actions (has direct search schema access)

EXAMPLE (Client-side):
  const { data } = await supabase.rpc("search_products", {
    p_query: "LED",
    p_indoor: true,
    p_limit: 24
  });

SEE ALSO: search.search_products() for full documentation';



CREATE OR REPLACE FUNCTION "public"."search_products"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.search_products(
        p_query := p_query,
        p_indoor := p_indoor,
        p_outdoor := p_outdoor,
        p_submersible := p_submersible,
        p_ceiling := NULL,
        p_wall := NULL,
        p_pendant := NULL,
        p_recessed := NULL,
        p_dimmable := NULL,
        p_power_min := p_power_min,
        p_power_max := p_power_max,
        p_color_temp_min := NULL,
        p_color_temp_max := NULL,
        p_ip_ratings := p_ip_ratings,
        p_suppliers := p_suppliers,
        p_taxonomy_codes := p_taxonomy_codes,
        p_sort_by := 'relevance',
        p_limit := p_limit,
        p_offset := p_offset
    );
END;
$$;


ALTER FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) IS 'CLIENT-SIDE WRAPPER for search.search_products() - Version 2 (with submersible filter).

Same purpose as Version 1, adds p_submersible parameter.
See Version 1 comment for full documentation.';



CREATE OR REPLACE FUNCTION "public"."search_products"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.search_products(
        p_query := p_query,
        p_indoor := p_indoor,
        p_outdoor := p_outdoor,
        p_submersible := p_submersible,
        p_trimless := p_trimless,
        p_cut_shape_round := p_cut_shape_round,
        p_cut_shape_rectangular := p_cut_shape_rectangular,
        p_ceiling := NULL,
        p_wall := NULL,
        p_pendant := NULL,
        p_recessed := NULL,
        p_dimmable := NULL,
        p_power_min := p_power_min,
        p_power_max := p_power_max,
        p_color_temp_min := NULL,
        p_color_temp_max := NULL,
        p_ip_ratings := p_ip_ratings,
        p_suppliers := p_suppliers,
        p_taxonomy_codes := p_taxonomy_codes,
        p_sort_by := 'relevance',
        p_limit := p_limit,
        p_offset := p_offset
    );
END;
$$;


ALTER FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) IS 'CLIENT-SIDE WRAPPER for search.search_products() - Version 3 (LATEST - with cut shape filters).

Same purpose as Version 1, adds p_trimless, p_cut_shape_round, p_cut_shape_rectangular.
See Version 1 comment for full documentation.

CURRENT VERSION: Use this version for new client-side integrations.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "etim"."class" (
    "ARTCLASSID" "text" NOT NULL,
    "ARTGROUPID" "text",
    "ARTCLASSDESC" "text",
    "ARTCLASSVERSION" bigint,
    "ARTCLASSVERSIONDATE" timestamp with time zone,
    "RELEASE" "text"
);


ALTER TABLE "etim"."class" OWNER TO "postgres";


COMMENT ON TABLE "etim"."class" IS 'Contains all ETIM classes';



COMMENT ON COLUMN "etim"."class"."ARTCLASSID" IS 'The class ID as defined in ETIM standards';



COMMENT ON COLUMN "etim"."class"."ARTGROUPID" IS 'The group ID as defined in ETIM standards';



COMMENT ON COLUMN "etim"."class"."ARTCLASSDESC" IS 'The description of the class. Synonyms for each class are described in classsynonymmap table';



COMMENT ON COLUMN "etim"."class"."ARTCLASSVERSION" IS 'The version of the class';



COMMENT ON COLUMN "etim"."class"."ARTCLASSVERSIONDATE" IS 'Date the version released';



COMMENT ON COLUMN "etim"."class"."RELEASE" IS 'The version release type';



CREATE TABLE IF NOT EXISTS "etim"."classfeaturemap" (
    "ARTCLASSFEATURENR" bigint NOT NULL,
    "ARTCLASSID" "text",
    "FEATUREID" "text",
    "FEATURETYPE" "text",
    "UNITOFMEASID" "text",
    "SORTNR" bigint
);


ALTER TABLE "etim"."classfeaturemap" OWNER TO "postgres";


COMMENT ON TABLE "etim"."classfeaturemap" IS 'Contains mappings of each class with specific features. ETIM standard forces classes to have very specific features';



COMMENT ON COLUMN "etim"."classfeaturemap"."ARTCLASSFEATURENR" IS 'The primary key of the table';



COMMENT ON COLUMN "etim"."classfeaturemap"."ARTCLASSID" IS 'The id of the class. References class table';



COMMENT ON COLUMN "etim"."classfeaturemap"."FEATUREID" IS 'The id of the feature. References feature table';



COMMENT ON COLUMN "etim"."classfeaturemap"."FEATURETYPE" IS 'The type of the feature. Can only be:
A – Alphanumeric (means a set of mixed text and numbers. The table classfeaturevaluemap contains this set)
N – Numeric (means any number)
R – Range (means a range of numbers)
L – Logic (means boolean, true of false)
';



COMMENT ON COLUMN "etim"."classfeaturemap"."UNITOFMEASID" IS 'The unit of measurement. References unit table';



COMMENT ON COLUMN "etim"."classfeaturemap"."SORTNR" IS 'Useful for sorting the importance of the feature. The lower the more important.';



CREATE TABLE IF NOT EXISTS "etim"."feature" (
    "FEATUREID" "text" NOT NULL,
    "FEATUREDESC" "text",
    "FEATUREDEF" "text",
    "FEATUREGROUPID" "text",
    "FEATUREDEFAI" "text"
);


ALTER TABLE "etim"."feature" OWNER TO "postgres";


COMMENT ON TABLE "etim"."feature" IS 'Contains all ETIM features';



COMMENT ON COLUMN "etim"."feature"."FEATUREID" IS 'The id of the feature as defined in ETIM standards';



COMMENT ON COLUMN "etim"."feature"."FEATUREDESC" IS 'The description of the feature';



COMMENT ON COLUMN "etim"."feature"."FEATUREDEF" IS 'The definition or detailed description of the feature';



COMMENT ON COLUMN "etim"."feature"."FEATUREGROUPID" IS 'The ID of the feature group this feature belongs to. References featuregroup table';



COMMENT ON COLUMN "etim"."feature"."FEATUREDEFAI" IS 'AI-proposed feature definition, enhanced or generated to provide clear, comprehensive descriptions with allowed values for Alphanumeric types';



CREATE TABLE IF NOT EXISTS "etim"."featuregroup" (
    "FEATUREGROUPID" "text" NOT NULL,
    "FEATUREGROUPDESC" "text",
    "FEATUREGROUPDEFAI" "text"
);


ALTER TABLE "etim"."featuregroup" OWNER TO "postgres";


COMMENT ON TABLE "etim"."featuregroup" IS 'Contains all ETIM feature groups that categorize features';



COMMENT ON COLUMN "etim"."featuregroup"."FEATUREGROUPID" IS 'Group of features';



COMMENT ON COLUMN "etim"."featuregroup"."FEATUREGROUPDESC" IS 'The description of the feature group';



COMMENT ON COLUMN "etim"."featuregroup"."FEATUREGROUPDEFAI" IS 'AI-friendly definition to help LLMs understand what features to extract for this group';



CREATE TABLE IF NOT EXISTS "etim"."group" (
    "ARTGROUPID" "text" NOT NULL,
    "GROUPDESC" "text"
);


ALTER TABLE "etim"."group" OWNER TO "postgres";


COMMENT ON TABLE "etim"."group" IS 'Contains all ETIM groups';



COMMENT ON COLUMN "etim"."group"."ARTGROUPID" IS 'The id of the group in ETIM standards';



COMMENT ON COLUMN "etim"."group"."GROUPDESC" IS 'The description of the group';



CREATE TABLE IF NOT EXISTS "etim"."unit" (
    "UNITOFMEASID" "text" NOT NULL,
    "UNITDESC" "text",
    "UNITABBREV" "text",
    "DEPRECATED" boolean NOT NULL
);


ALTER TABLE "etim"."unit" OWNER TO "postgres";


COMMENT ON TABLE "etim"."unit" IS 'Contains all ETIM units of measurement';



COMMENT ON COLUMN "etim"."unit"."UNITOFMEASID" IS 'The id of the unit';



COMMENT ON COLUMN "etim"."unit"."UNITDESC" IS 'The description of the unit';



COMMENT ON COLUMN "etim"."unit"."UNITABBREV" IS 'The unit abbreviation';



COMMENT ON COLUMN "etim"."unit"."DEPRECATED" IS 'Whether unit is deprecated or not';



CREATE TABLE IF NOT EXISTS "etim"."value" (
    "VALUEID" "text" NOT NULL,
    "VALUEDESC" "text",
    "DEPRECATED" boolean NOT NULL,
    "REMARK" "text"
);


ALTER TABLE "etim"."value" OWNER TO "postgres";


COMMENT ON TABLE "etim"."value" IS 'Contains all values of ETIM standard';



COMMENT ON COLUMN "etim"."value"."VALUEID" IS 'The id of the value';



COMMENT ON COLUMN "etim"."value"."VALUEDESC" IS 'The description of the value';



COMMENT ON COLUMN "etim"."value"."DEPRECATED" IS 'Whether value is deprecated or not';



COMMENT ON COLUMN "etim"."value"."REMARK" IS 'A remark or definition of the value';



CREATE TABLE IF NOT EXISTS "items"."catalog" (
    "id" integer NOT NULL,
    "catalog_id" "text" NOT NULL,
    "catalog_version" "text",
    "catalog_name" "text",
    "generation_date" "date",
    "territory" "text",
    "currency" "text",
    "supplier_id" integer,
    "active" boolean DEFAULT false NOT NULL,
    "group_id" "text"
);


ALTER TABLE "items"."catalog" OWNER TO "postgres";


COMMENT ON TABLE "items"."catalog" IS 'Contains all product catalogs. Current and archived ones.';



COMMENT ON COLUMN "items"."catalog"."id" IS 'The primary key';



COMMENT ON COLUMN "items"."catalog"."catalog_id" IS 'The id of the catalog as defined in BMEcat XML in <CATALOG_ID>';



COMMENT ON COLUMN "items"."catalog"."catalog_version" IS 'The version of the catalog as defined in BMEcat XML in <CATALOG_VERSION>';



COMMENT ON COLUMN "items"."catalog"."catalog_name" IS 'The name of the catalog as defined in BMEcat XML in <CATALOG_NAME>';



COMMENT ON COLUMN "items"."catalog"."generation_date" IS 'The generation date of the catalog as defined in BMEcat XML in <DATETIME type="generation_date">';



COMMENT ON COLUMN "items"."catalog"."territory" IS 'The territory of the catalog as defined in BMECat XML in <TERRITORY>';



COMMENT ON COLUMN "items"."catalog"."currency" IS 'The currency that will be used for this catalog as defined in BMECat XML in <CURRENCY>';



COMMENT ON COLUMN "items"."catalog"."supplier_id" IS 'The id of the supplier. References supplier table';



COMMENT ON COLUMN "items"."catalog"."active" IS 'Whether the catalog is active.';



CREATE TABLE IF NOT EXISTS "items"."price_catalog" (
    "manufacturer" "text",
    "itemcode" "text",
    "description" "text",
    "color" "text",
    "startprice" double precision,
    "disc1" numeric(5,2),
    "disc2" numeric(5,2),
    "disc3" numeric(5,2),
    "indate" "text",
    "markup1" bigint,
    "markup2" bigint,
    "markup3" bigint,
    "comments" "text",
    "priceflag" "text",
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "items"."price_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "items"."product" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "catalog_id" integer NOT NULL,
    "foss_pid" "text" NOT NULL,
    "supplier_id" integer NOT NULL
);


ALTER TABLE "items"."product" OWNER TO "postgres";


COMMENT ON TABLE "items"."product" IS 'The product main table. From this table we can reference many others to get information we need';



COMMENT ON COLUMN "items"."product"."id" IS 'The product''s primary key';



COMMENT ON COLUMN "items"."product"."catalog_id" IS 'The catalog of the product. References catalog table';



COMMENT ON COLUMN "items"."product"."foss_pid" IS 'Out part number. The official part number of Foss SA.';



COMMENT ON COLUMN "items"."product"."supplier_id" IS 'The id of product''s supplier. References supplier table';



CREATE TABLE IF NOT EXISTS "items"."product_detail" (
    "id" integer NOT NULL,
    "product_id" "uuid",
    "description_short" "text",
    "description_long" "text",
    "manufacturer_pid" "text",
    "class_id" "text",
    "family" "text",
    "subfamily" "text"
);


ALTER TABLE "items"."product_detail" OWNER TO "postgres";


COMMENT ON TABLE "items"."product_detail" IS 'A table that has details of the product. It is like an addition to product table';



COMMENT ON COLUMN "items"."product_detail"."id" IS 'The primary key';



COMMENT ON COLUMN "items"."product_detail"."product_id" IS 'The id product. References product table';



COMMENT ON COLUMN "items"."product_detail"."description_short" IS 'A short description of the product. It derives from <DESCRIPTION_SHORT> of the BMECat XML file';



COMMENT ON COLUMN "items"."product_detail"."description_long" IS 'A descriptive information about the product. It contains very useful data that do not fit in regular tables. It is derived from <DESCRIPTION_LONG> of BMECat XML file';



COMMENT ON COLUMN "items"."product_detail"."manufacturer_pid" IS 'The official supplier part number. It is derived from <SUPPLIER_PID> of BMECat XML file';



COMMENT ON COLUMN "items"."product_detail"."class_id" IS 'The id of the product''s class. It references to the etim.class table';



COMMENT ON COLUMN "items"."product_detail"."family" IS 'The product''s family per supplier terms. It is derived from <MANUFACTURER_TYPE_DESCR> of BMECat XML';



COMMENT ON COLUMN "items"."product_detail"."subfamily" IS 'The product''s subfamily per supplier terms';



CREATE TABLE IF NOT EXISTS "items"."product_feature" (
    "feature_id" bigint NOT NULL,
    "product_id" "uuid",
    "fname_id" "text",
    "fvaluec" "text",
    "fvaluen" bigint,
    "fvalueb" boolean,
    "fvaluer" "numrange",
    "funit" "text",
    "fvalue_detail" "text",
    "etim_version" "text"
);


ALTER TABLE "items"."product_feature" OWNER TO "postgres";


COMMENT ON TABLE "items"."product_feature" IS 'The features a product can have. It is an addition to product table';



COMMENT ON COLUMN "items"."product_feature"."feature_id" IS 'The primary key';



COMMENT ON COLUMN "items"."product_feature"."product_id" IS 'The id of the product. References the product table';



COMMENT ON COLUMN "items"."product_feature"."fname_id" IS 'The id of the feature. It references etim.feature table';



COMMENT ON COLUMN "items"."product_feature"."fvaluec" IS 'The alphanumeric feature of product. This references the etim.feature table. ';



COMMENT ON COLUMN "items"."product_feature"."fvaluen" IS 'The numeric feature of product.';



COMMENT ON COLUMN "items"."product_feature"."fvalueb" IS 'The logic (boolean) feature of product.';



COMMENT ON COLUMN "items"."product_feature"."fvaluer" IS 'The range feature of product.';



COMMENT ON COLUMN "items"."product_feature"."funit" IS 'The unit of measurements feature of product. This references the etim.unit table. ';



COMMENT ON COLUMN "items"."product_feature"."fvalue_detail" IS 'Any details of the feature. Not very common';



COMMENT ON COLUMN "items"."product_feature"."etim_version" IS 'The ETIM version the product was registered. It is derived from <REFERENCE_FEATURE_SYSTEM_NAME> of BMECat XML file';



CREATE TABLE IF NOT EXISTS "items"."product_udx" (
    "id" integer NOT NULL,
    "product_id" "uuid",
    "udx_data" "jsonb"
);


ALTER TABLE "items"."product_udx" OWNER TO "postgres";


COMMENT ON TABLE "items"."product_udx" IS 'A table of product user defined extensions. It is an addition to product table';



COMMENT ON COLUMN "items"."product_udx"."id" IS 'The primary key';



COMMENT ON COLUMN "items"."product_udx"."product_id" IS 'The id of the product. It references the product table';



COMMENT ON COLUMN "items"."product_udx"."udx_data" IS 'A JSON object that contains the gtin number and a multimedia object. The mutimedia consists of
    {
      "mime_code": "MD01",
      "mime_source": "--Product picture usually a URL link to a JPG/PNG file-- "
    },
    {
      "mime_code": "MD12",
      "mime_source": "--Dimensioned drawing usually a URL link to SVG file--"
    },
    {
      "mime_code": "MD16",
      "mime_source": "--Light Distribution Curve usually a URL link--"
    },
    {
      "mime_code": "MD04",
      "mime_source": "--Deeplink product page. The product''s main web page--"
    }';



CREATE TABLE IF NOT EXISTS "items"."supplier" (
    "id" integer NOT NULL,
    "supplier_name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "country" "text",
    "email" "text",
    "url" "text",
    "logo" "text",
    "country_flag" "text",
    "logo_dark" "text"
);


ALTER TABLE "items"."supplier" OWNER TO "postgres";


COMMENT ON TABLE "items"."supplier" IS 'The supplier table stores the companies from where we buy products';



COMMENT ON COLUMN "items"."supplier"."code" IS 'The supplier code. We hardcoded this to prefix our part numbers (foss_pid)';



COMMENT ON COLUMN "items"."supplier"."logo_dark" IS 'Logo URL optimized for dark theme display';



CREATE MATERIALIZED VIEW "items"."product_info" AS
 WITH "product_prices" AS (
         SELECT "price_catalog"."itemcode",
            "jsonb_agg"("jsonb_build_object"('start_price', "price_catalog"."startprice", 'disc1', "price_catalog"."disc1", 'disc2', "price_catalog"."disc2", 'disc3', "price_catalog"."disc3", 'date', "price_catalog"."indate") ORDER BY "price_catalog"."indate" DESC) AS "price_data"
           FROM "items"."price_catalog"
          GROUP BY "price_catalog"."itemcode"
        )
 SELECT "p"."id" AS "product_id",
    "p"."foss_pid",
    "p"."catalog_id",
    "c"."catalog_version",
    "pd"."description_short",
    "pd"."description_long",
    "pd"."manufacturer_pid",
    "pd"."family",
    "pd"."subfamily",
    "cl"."ARTCLASSID" AS "class",
    "cl"."ARTCLASSDESC" AS "class_name",
    "g"."ARTGROUPID" AS "group",
    "g"."GROUPDESC" AS "group_name",
    "s"."supplier_name",
    "s"."logo" AS "supplier_logo",
    "s"."logo_dark" AS "supplier_logo_dark",
    "pp"."price_data" AS "prices",
    ("udx"."udx_data" -> 'multimedia'::"text") AS "multimedia",
    "jsonb_agg"("feature_data"."feature_json") AS "features"
   FROM (((((((("items"."product" "p"
     JOIN "items"."catalog" "c" ON (("p"."catalog_id" = "c"."id")))
     JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
     JOIN "etim"."class" "cl" ON (("pd"."class_id" = "cl"."ARTCLASSID")))
     JOIN "etim"."group" "g" ON (("cl"."ARTGROUPID" = "g"."ARTGROUPID")))
     LEFT JOIN "items"."supplier" "s" ON (("c"."supplier_id" = "s"."id")))
     LEFT JOIN "items"."product_udx" "udx" ON (("p"."id" = "udx"."product_id")))
     LEFT JOIN "product_prices" "pp" ON (("p"."foss_pid" = "pp"."itemcode")))
     LEFT JOIN LATERAL ( SELECT "jsonb_build_object"('FEATUREID', "f"."FEATUREID", 'feature_name', "f"."FEATUREDESC", 'FEATUREGROUPID', "fg"."FEATUREGROUPID", 'FEATUREGROUPDESC', "fg"."FEATUREGROUPDESC", 'fvalueC', "pf"."fvaluec", 'fvalueC_desc', COALESCE("v"."VALUEDESC", "pf"."fvaluec"), 'fvalueN', "pf"."fvaluen", 'fvalueR', "pf"."fvaluer", 'fvalueB', "pf"."fvalueb", 'fvalue_detail', "pf"."fvalue_detail", 'unit', "pf"."funit", 'unit_desc', "u"."UNITDESC", 'unit_abbrev', "u"."UNITABBREV") AS "feature_json"
           FROM ((((("items"."product_feature" "pf"
             JOIN "etim"."feature" "f" ON (("pf"."fname_id" = "f"."FEATUREID")))
             LEFT JOIN "etim"."featuregroup" "fg" ON (("f"."FEATUREGROUPID" = "fg"."FEATUREGROUPID")))
             LEFT JOIN "etim"."value" "v" ON (("pf"."fvaluec" = "v"."VALUEID")))
             LEFT JOIN "etim"."unit" "u" ON (("pf"."funit" = "u"."UNITOFMEASID")))
             LEFT JOIN "etim"."classfeaturemap" "cf" ON ((("pf"."fname_id" = "cf"."FEATUREID") AND ("cl"."ARTCLASSID" = "cf"."ARTCLASSID"))))
          WHERE (("pf"."product_id" = "p"."id") AND (NOT (("pf"."fvaluec" IS NULL) AND ("pf"."fvaluen" IS NULL) AND ("pf"."fvaluer" IS NULL) AND ("pf"."fvalueb" IS NULL))) AND (("pf"."fvalueb" IS NULL) OR ("pf"."fvalueb" = true)))
          ORDER BY "cf"."SORTNR") "feature_data" ON (true))
  WHERE ("c"."active" = true)
  GROUP BY "p"."id", "p"."foss_pid", "p"."catalog_id", "c"."catalog_version", "pd"."description_short", "pd"."description_long", "pd"."manufacturer_pid", "pd"."family", "pd"."subfamily", "cl"."ARTCLASSID", "cl"."ARTCLASSDESC", "g"."ARTGROUPID", "g"."GROUPDESC", "s"."supplier_name", "s"."logo", "s"."logo_dark", "pp"."price_data", ("udx"."udx_data" -> 'multimedia'::"text")
  ORDER BY "p"."id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "items"."product_info" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "items"."product_info" IS 'Product catalog view. Access restricted to service_role only.';



CREATE OR REPLACE FUNCTION "public"."search_products_fts"("search_query" "text", "result_limit" integer DEFAULT 20) RETURNS SETOF "items"."product_info"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'items', 'public'
    AS $$
DECLARE
  tsquery_simple tsquery;
  tsquery_english tsquery;
BEGIN
  -- Create tsquery for both simple (codes) and english (text) configs
  -- This allows matching both exact codes and stemmed words
  tsquery_simple := plainto_tsquery('simple', search_query);
  tsquery_english := plainto_tsquery('english', search_query);

  RETURN QUERY
  SELECT pi.*
  FROM items.product_search_index psi
  JOIN items.product_info pi ON psi.product_id = pi.product_id
  WHERE 
    psi.search_vector @@ tsquery_simple 
    OR psi.search_vector @@ tsquery_english
  ORDER BY 
    -- Prioritize exact foss_pid matches first
    CASE WHEN psi.foss_pid ILIKE search_query || '%' THEN 0 ELSE 1 END,
    -- Then by FTS rank (higher = more relevant)
    GREATEST(
      ts_rank(psi.search_vector, tsquery_simple),
      ts_rank(psi.search_vector, tsquery_english)
    ) DESC
  LIMIT result_limit;
END;
$$;


ALTER FUNCTION "public"."search_products_fts"("search_query" "text", "result_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."search_products_fts"("search_query" "text", "result_limit" integer) IS 'Full-text search for products with ranking. Searches codes (foss_pid, mpn) and text (description, supplier, class).';



CREATE OR REPLACE FUNCTION "public"."search_products_with_filters"("p_query" "text" DEFAULT NULL::"text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_sort_by" "text" DEFAULT 'relevance'::"text", "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.search_products_with_filters(
        p_query,
        p_filters,
        p_taxonomy_codes,
        p_suppliers,
        p_indoor,
        p_outdoor,
        p_submersible,
        p_trimless,
        p_cut_shape_round,
        p_cut_shape_rectangular,
        p_sort_by,
        p_limit,
        p_offset
    );
END;
$$;


ALTER FUNCTION "public"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_modified_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_modified_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "rag"."match_products"("query_embedding" "extensions"."vector", "match_class" "text" DEFAULT NULL::"text", "match_count" integer DEFAULT 3, "similarity_threshold" double precision DEFAULT 0.5) RETURNS TABLE("id" integer, "class_id" "text", "product_text" "text", "product_name" "text", "manufacturer" "text", "features" "jsonb", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'rag', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    etim_rag.id,
    etim_rag.class_id,
    etim_rag.product_text,
    etim_rag.product_name,
    etim_rag.manufacturer,
    etim_rag.features,
    1 - (etim_rag.embedding <=> query_embedding) AS similarity
  FROM rag.etim_rag
  WHERE 
    (match_class IS NULL OR etim_rag.class_id = match_class)
    AND (1 - (etim_rag.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY etim_rag.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "rag"."match_products"("query_embedding" "extensions"."vector", "match_class" "text", "match_count" integer, "similarity_threshold" double precision) OWNER TO "postgres";


COMMENT ON FUNCTION "rag"."match_products"("query_embedding" "extensions"."vector", "match_class" "text", "match_count" integer, "similarity_threshold" double precision) IS 'Vector similarity search for products. SECURITY: Uses fixed search_path to prevent search_path injection attacks.';



CREATE OR REPLACE FUNCTION "rag"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'rag', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "rag"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "rag"."update_updated_at_column"() IS 'Trigger function to auto-update updated_at timestamp. SECURITY: Uses fixed search_path to prevent injection attacks.';



CREATE OR REPLACE FUNCTION "search"."build_histogram"("value_array" numeric[], "bucket_count" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
DECLARE
    min_val NUMERIC;
    max_val NUMERIC;
    bucket_width NUMERIC;
    histogram JSONB := '[]'::JSONB;
    bucket_start NUMERIC;
    bucket_end NUMERIC;
    bucket_label TEXT;
    count INTEGER;
BEGIN
    min_val := (SELECT MIN(v) FROM unnest(value_array) v);
    max_val := (SELECT MAX(v) FROM unnest(value_array) v);

    IF min_val = max_val THEN
        RETURN jsonb_build_array(
            jsonb_build_object(
                'range', min_val::TEXT,
                'min', min_val,
                'max', max_val,
                'count', array_length(value_array, 1)
            )
        );
    END IF;

    bucket_width := (max_val - min_val) / bucket_count;

    FOR i IN 0..(bucket_count - 1) LOOP
        bucket_start := min_val + (i * bucket_width);
        bucket_end := bucket_start + bucket_width;
        bucket_label := bucket_start::TEXT || '-' || bucket_end::TEXT;

        SELECT COUNT(*) INTO count
        FROM unnest(value_array) v
        WHERE v >= bucket_start AND v < bucket_end;

        histogram := histogram || jsonb_build_object(
            'range', bucket_label,
            'min', bucket_start,
            'max', bucket_end,
            'count', count
        );
    END LOOP;

    RETURN histogram;
END;
$$;


ALTER FUNCTION "search"."build_histogram"("value_array" numeric[], "bucket_count" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."count_affected_products"("p_etim_group_ids" "text"[] DEFAULT NULL::"text"[], "p_etim_class_ids" "text"[] DEFAULT NULL::"text"[], "p_text_pattern" "text" DEFAULT NULL::"text") RETURNS bigint
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    result_count BIGINT;
BEGIN
    SELECT COUNT(*) INTO result_count
    FROM items.product_info pi
    WHERE (
        (p_etim_group_ids IS NULL OR pi."group" = ANY(p_etim_group_ids))
        AND
        (p_etim_class_ids IS NULL OR pi.class = ANY(p_etim_class_ids))
        AND
        (p_text_pattern IS NULL OR
         pi.description_short ~* p_text_pattern OR
         pi.description_long ~* p_text_pattern)
    );

    RETURN result_count;
END;
$$;


ALTER FUNCTION "search"."count_affected_products"("p_etim_group_ids" "text"[], "p_etim_class_ids" "text"[], "p_text_pattern" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "search"."count_affected_products"("p_etim_group_ids" "text"[], "p_etim_class_ids" "text"[], "p_text_pattern" "text") IS 'Count total products affected by a classification rule';



CREATE OR REPLACE FUNCTION "search"."count_products_with_filters"("p_query" "text" DEFAULT NULL::"text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean) RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(DISTINCT pi.product_id)
    INTO v_count
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
        AND (p_suppliers IS NULL OR cardinality(p_suppliers) = 0 OR pi.supplier_name = ANY(p_suppliers))
        AND (NOT (p_filters ? 'voltage') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'voltage'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'voltage'))
              )
        ))
        AND (NOT (p_filters ? 'dimmable') OR
             (p_filters->>'dimmable')::BOOLEAN = ptf.dimmable)
        AND (NOT (p_filters ? 'class') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'class'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'class'))
              )
        ))
        AND (NOT (p_filters ? 'ip') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'ip'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'ip'))
              )
        ))
        AND (NOT (p_filters ? 'finishing_colour') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'finishing_colour'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'finishing_colour'))
              )
        ))
        -- FIXED: cct range filters using IS NULL pattern
        AND (p_filters->'cct'->>'min' IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'cct'
              AND pfi.numeric_value >= (p_filters->'cct'->>'min')::NUMERIC
        ))
        AND (p_filters->'cct'->>'max' IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'cct'
              AND pfi.numeric_value <= (p_filters->'cct'->>'max')::NUMERIC
        ))
        AND (NOT (p_filters ? 'cri') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'cri'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'cri'))
              )
        ))
        -- FIXED: lumens_output range filters using IS NULL pattern
        AND (p_filters->'lumens_output'->>'min' IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'lumens_output'
              AND pfi.numeric_value >= (p_filters->'lumens_output'->>'min')::NUMERIC
        ))
        AND (p_filters->'lumens_output'->>'max' IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'lumens_output'
              AND pfi.numeric_value <= (p_filters->'lumens_output'->>'max')::NUMERIC
        ))
        AND (NOT (p_filters ? 'beam_angle_type') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'beam_angle_type'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'beam_angle_type'))
              )
        ))
        AND (NOT (p_filters ? 'light_source') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'light_source'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'light_source'))
              )
        ))
        AND (NOT (p_filters ? 'light_distribution') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'light_distribution'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'light_distribution'))
              )
        ));

    RETURN v_count;
END;
$$;


ALTER FUNCTION "search"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."count_search_products"("p_query" "text" DEFAULT NULL::"text", "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_ceiling" boolean DEFAULT NULL::boolean, "p_wall" boolean DEFAULT NULL::boolean, "p_pendant" boolean DEFAULT NULL::boolean, "p_recessed" boolean DEFAULT NULL::boolean, "p_dimmable" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_color_temp_min" numeric DEFAULT NULL::numeric, "p_color_temp_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    result_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO result_count
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')

        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR
             p_taxonomy_codes = ARRAY[]::TEXT[] OR
             ptf.taxonomy_path && p_taxonomy_codes)

        -- Boolean flags
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_ceiling IS NULL OR ptf.ceiling = p_ceiling)
        AND (p_wall IS NULL OR ptf.wall = p_wall)
        AND (p_pendant IS NULL OR ptf.decorative_pendant = p_pendant)
        AND (p_recessed IS NULL OR ptf.recessed = p_recessed)

        -- Numeric filters
        AND (p_power_min IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'power'
              AND pfi.numeric_value >= p_power_min
        ))
        AND (p_power_max IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'power'
              AND pfi.numeric_value <= p_power_max
        ))
        AND (p_color_temp_min IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'color_temp'
              AND pfi.numeric_value >= p_color_temp_min
        ))
        AND (p_color_temp_max IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'color_temp'
              AND pfi.numeric_value <= p_color_temp_max
        ))

        -- Alphanumeric filters
        AND (p_ip_ratings IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'ip_rating'
              AND pfi.alphanumeric_value = ANY(p_ip_ratings)
        ))

        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers));

    RETURN result_count;
END;
$$;


ALTER FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."count_search_products"("p_query" "text" DEFAULT NULL::"text", "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_ceiling" boolean DEFAULT NULL::boolean, "p_wall" boolean DEFAULT NULL::boolean, "p_pendant" boolean DEFAULT NULL::boolean, "p_recessed" boolean DEFAULT NULL::boolean, "p_dimmable" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_color_temp_min" numeric DEFAULT NULL::numeric, "p_color_temp_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    result_count bigint;
BEGIN
    SELECT COUNT(*)
    INTO result_count
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')

        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR
             p_taxonomy_codes = ARRAY[]::TEXT[] OR
             ptf.taxonomy_path && p_taxonomy_codes)

        -- Boolean flags
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
        AND (p_ceiling IS NULL OR ptf.ceiling = p_ceiling)
        AND (p_wall IS NULL OR ptf.wall = p_wall)
        AND (p_pendant IS NULL OR ptf.decorative_pendant = p_pendant)
        AND (p_recessed IS NULL OR ptf.recessed = p_recessed)

        -- Numeric filters
        AND (p_power_min IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'power'
              AND pfi.numeric_value >= p_power_min
        ))
        AND (p_power_max IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'power'
              AND pfi.numeric_value <= p_power_max
        ))
        AND (p_color_temp_min IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'color_temp'
              AND pfi.numeric_value >= p_color_temp_min
        ))
        AND (p_color_temp_max IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'color_temp'
              AND pfi.numeric_value <= p_color_temp_max
        ))

        -- Alphanumeric filters
        AND (p_ip_ratings IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'ip_rating'
              AND pfi.alphanumeric_value = ANY(p_ip_ratings)
        ))

        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers));

    RETURN result_count;
END;
$$;


ALTER FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."count_simple_test"("p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(DISTINCT pi.product_id)
    INTO v_count
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (NOT (p_filters ? 'dimmable') OR
             (p_filters->>'dimmable')::BOOLEAN = ptf.dimmable);

    RETURN v_count;
END;
$$;


ALTER FUNCTION "search"."count_simple_test"("p_filters" "jsonb", "p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."evaluate_feature_condition"("feature" "jsonb", "condition" "jsonb") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
DECLARE
    feature_id TEXT;
    operator TEXT;
    expected_value TEXT;
BEGIN
    -- FIX: Return false for SQL NULL or JSON null features
    IF feature IS NULL OR jsonb_typeof(feature) = 'null' THEN
        RETURN false;
    END IF;

    feature_id := (SELECT jsonb_object_keys(condition) LIMIT 1);

    -- FIX: Use uppercase FEATUREID to match actual data structure
    IF (feature->>'FEATUREID') != feature_id THEN
        RETURN false;
    END IF;

    operator := condition->feature_id->>'operator';
    expected_value := condition->feature_id->>'value';

    CASE operator
        WHEN 'exists' THEN
            RETURN true;
        WHEN 'equals' THEN
            RETURN (feature->>'fvalueC' = expected_value
                    OR (feature->>'fvalueB')::TEXT = expected_value);
        WHEN 'contains' THEN
            RETURN (feature->>'fvalueC_desc' ILIKE '%' || expected_value || '%');
        WHEN 'greater_than' THEN
            RETURN (feature->>'fvalueN')::NUMERIC > expected_value::NUMERIC;
        WHEN 'less_than' THEN
            RETURN (feature->>'fvalueN')::NUMERIC < expected_value::NUMERIC;
        WHEN 'in_range' THEN
            RETURN (feature->>'fvalueN')::NUMERIC BETWEEN
                (condition->feature_id->>'min')::NUMERIC AND
                (condition->feature_id->>'max')::NUMERIC;
        ELSE
            RETURN false;
    END CASE;
END;
$$;


ALTER FUNCTION "search"."evaluate_feature_condition"("feature" "jsonb", "condition" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."get_available_facets"() RETURNS TABLE("filter_key" "text", "filter_type" "text", "label" "text", "facet_data" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        -- Filter identification
        fd.filter_key,
        fd.filter_type,
        fd.label,
        
        -- Type-specific facet data from filter_facets materialized view
        CASE 
            -- Numeric range filters (e.g., power: 10-50W, color temp: 2700-6500K)
            WHEN fd.filter_type = 'numeric_range' THEN
                COALESCE(ff.numeric_stats, '{}'::JSONB)
            
            -- Alphanumeric filters (e.g., IP rating: IP20, IP44, IP65)
            WHEN fd.filter_type = 'alphanumeric' THEN
                COALESCE(ff.alphanumeric_counts, '{}'::JSONB)
            
            -- Boolean filters (e.g., dimmable: true/false)
            WHEN fd.filter_type = 'boolean' THEN
                jsonb_build_object('true_count', COALESCE(ff.boolean_true_count, 0))
            
            ELSE '{}'::JSONB
        END as facet_data
        
    FROM search.filter_definitions fd
    
    -- LEFT JOIN to include filters even if they have no data yet
    -- (allows UI to show all configured filters)
    LEFT JOIN search.filter_facets ff 
        ON fd.filter_key = ff.filter_key
    
    WHERE 
        fd.active = true  -- Only return active filters
    
    ORDER BY 
        fd.display_order,  -- UI display order (lower = shown first)
        fd.label;           -- Alphabetical fallback
END;
$$;


ALTER FUNCTION "search"."get_available_facets"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_available_facets"() IS 'Returns available filter facets with statistics for the search UI.
Used by the search UI to display available filters and their current values.
Combines filter metadata from filter_definitions with aggregated statistics from filter_facets materialized view.';



CREATE OR REPLACE FUNCTION "search"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("flag_name" "text", "true_count" bigint, "false_count" bigint, "total_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    
    WITH filtered_products AS (
        SELECT product_id
        FROM search.product_taxonomy_flags
        WHERE p_taxonomy_codes IS NULL 
           OR taxonomy_path && p_taxonomy_codes
    )
    
    SELECT 
        'indoor'::TEXT as flag_name,
        COUNT(*) FILTER (WHERE ptf.indoor = true) as true_count,
        COUNT(*) FILTER (WHERE ptf.indoor = false OR ptf.indoor IS NULL) as false_count,
        COUNT(*) as total_count
    FROM filtered_products fp
    INNER JOIN search.product_taxonomy_flags ptf ON fp.product_id = ptf.product_id
    
    UNION ALL
    
    SELECT 
        'outdoor'::TEXT,
        COUNT(*) FILTER (WHERE ptf.outdoor = true),
        COUNT(*) FILTER (WHERE ptf.outdoor = false OR ptf.outdoor IS NULL),
        COUNT(*)
    FROM filtered_products fp
    INNER JOIN search.product_taxonomy_flags ptf ON fp.product_id = ptf.product_id
    
    UNION ALL
    
    SELECT 
        'submersible'::TEXT,
        COUNT(*) FILTER (WHERE ptf.submersible = true),
        COUNT(*) FILTER (WHERE ptf.submersible = false OR ptf.submersible IS NULL),
        COUNT(*)
    FROM filtered_products fp
    INNER JOIN search.product_taxonomy_flags ptf ON fp.product_id = ptf.product_id
    
    UNION ALL
    
    SELECT 
        'trimless'::TEXT,
        COUNT(*) FILTER (WHERE ptf.trimless = true),
        COUNT(*) FILTER (WHERE ptf.trimless = false OR ptf.trimless IS NULL),
        COUNT(*)
    FROM filtered_products fp
    INNER JOIN search.product_taxonomy_flags ptf ON fp.product_id = ptf.product_id
    
    UNION ALL
    
    SELECT 
        'cut_shape_round'::TEXT,
        COUNT(*) FILTER (WHERE ptf.cut_shape_round = true),
        COUNT(*) FILTER (WHERE ptf.cut_shape_round = false OR ptf.cut_shape_round IS NULL),
        COUNT(*)
    FROM filtered_products fp
    INNER JOIN search.product_taxonomy_flags ptf ON fp.product_id = ptf.product_id
    
    UNION ALL
    
    SELECT 
        'cut_shape_rectangular'::TEXT,
        COUNT(*) FILTER (WHERE ptf.cut_shape_rectangular = true),
        COUNT(*) FILTER (WHERE ptf.cut_shape_rectangular = false OR ptf.cut_shape_rectangular IS NULL),
        COUNT(*)
    FROM filtered_products fp
    INNER JOIN search.product_taxonomy_flags ptf ON fp.product_id = ptf.product_id;
    
END;
$$;


ALTER FUNCTION "search"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."get_dynamic_facets"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_query" "text" DEFAULT NULL::"text") RETURNS TABLE("filter_category" "text", "filter_key" "text", "filter_value" "text", "product_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY

    -- Get all available filter values with counts from products matching current criteria
    WITH filtered_products AS (
        SELECT DISTINCT pi.product_id
        FROM items.product_info pi
        INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
        WHERE
            -- Text search
            (p_query IS NULL OR
             pi.description_short ILIKE '%' || p_query || '%' OR
             pi.description_long ILIKE '%' || p_query || '%')

            -- Taxonomy filter
            AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)

            -- Boolean flags from UI
            AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
            AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
            AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
            AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
            AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
            AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)

            -- Supplier filter
            AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
    )

    -- Part 1: ETIM-based facets from product_filter_index
    SELECT
        fd.ui_config->>'filter_category' as filter_category,
        pfi.filter_key,
        -- Standardize boolean values to Yes/No format
        CASE 
            WHEN pfi.alphanumeric_value IS NOT NULL THEN pfi.alphanumeric_value
            WHEN pfi.boolean_value = true THEN 'Yes'
            WHEN pfi.boolean_value = false THEN 'No'
            ELSE NULL
        END as filter_value,
        COUNT(DISTINCT pfi.product_id) as product_count
    FROM search.product_filter_index pfi
    INNER JOIN filtered_products fp ON pfi.product_id = fp.product_id
    INNER JOIN search.filter_definitions fd ON pfi.filter_key = fd.filter_key
    WHERE
        fd.active = true
        AND (
            (fd.filter_type = 'multi-select' AND pfi.alphanumeric_value IS NOT NULL)
            OR (fd.filter_type = 'boolean' AND pfi.boolean_value IS NOT NULL)
        )
    GROUP BY
        fd.ui_config->>'filter_category',
        pfi.filter_key,
        pfi.alphanumeric_value,
        pfi.boolean_value

    UNION ALL

    -- Part 2: Flag-based boolean filters (already use Yes/No)
    SELECT 'location'::TEXT, 'indoor'::TEXT, 'Yes'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.indoor = true

    UNION ALL
    SELECT 'location'::TEXT, 'indoor'::TEXT, 'No'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.indoor = false

    UNION ALL
    SELECT 'location'::TEXT, 'outdoor'::TEXT, 'Yes'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.outdoor = true

    UNION ALL
    SELECT 'location'::TEXT, 'outdoor'::TEXT, 'No'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.outdoor = false

    UNION ALL
    SELECT 'location'::TEXT, 'submersible'::TEXT, 'Yes'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.submersible = true

    UNION ALL
    SELECT 'location'::TEXT, 'submersible'::TEXT, 'No'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.submersible = false

    UNION ALL
    SELECT 'options'::TEXT, 'trimless'::TEXT, 'Yes'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.trimless = true

    UNION ALL
    SELECT 'options'::TEXT, 'trimless'::TEXT, 'No'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.trimless = false

    UNION ALL
    SELECT 'options'::TEXT, 'cut_shape_round'::TEXT, 'Yes'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.cut_shape_round = true

    UNION ALL
    SELECT 'options'::TEXT, 'cut_shape_round'::TEXT, 'No'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.cut_shape_round = false

    UNION ALL
    SELECT 'options'::TEXT, 'cut_shape_rectangular'::TEXT, 'Yes'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.cut_shape_rectangular = true

    UNION ALL
    SELECT 'options'::TEXT, 'cut_shape_rectangular'::TEXT, 'No'::TEXT,
        COUNT(DISTINCT ptf.product_id)
    FROM search.product_taxonomy_flags ptf
    INNER JOIN filtered_products fp ON ptf.product_id = fp.product_id
    WHERE ptf.cut_shape_rectangular = false

    ORDER BY filter_category, filter_key, product_count DESC;
END;
$$;


ALTER FUNCTION "search"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") IS 'Returns available filter options and their product counts based on current taxonomy
and filter selection. Includes both ETIM-based filters and flag-based boolean filters.';



CREATE OR REPLACE FUNCTION "search"."get_filter_definitions_with_type"("p_taxonomy_code" "text" DEFAULT 'LUMINAIRE'::"text") RETURNS TABLE("filter_key" "text", "label" "text", "filter_type" "text", "etim_feature_id" "text", "etim_feature_type" "text", "ui_config" "jsonb", "display_order" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        fd.filter_key,
        fd.label,
        fd.filter_type,
        fd.etim_feature_id,
        'A'::TEXT as etim_feature_type,  -- Default to 'A' (Alphanumeric)
        fd.ui_config,
        fd.display_order
    FROM search.filter_definitions fd
    WHERE fd.active = true
      AND (
        fd.applicable_taxonomy_codes IS NULL
        OR p_taxonomy_code = ANY(fd.applicable_taxonomy_codes)
      )
    ORDER BY fd.display_order;
END;
$$;


ALTER FUNCTION "search"."get_filter_definitions_with_type"("p_taxonomy_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."get_filter_facets_with_context"("p_query" "text" DEFAULT NULL::"text", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean) RETURNS TABLE("flag_name" "text", "true_count" bigint, "false_count" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        'indoor'::TEXT,
        COUNT(*) FILTER (WHERE ptf.indoor = TRUE)::BIGINT,
        COUNT(*) FILTER (WHERE ptf.indoor = FALSE)::BIGINT
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        
        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        
        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
        
        -- Already applied filters (only count products matching these)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
    
    UNION ALL
    
    SELECT
        'outdoor'::TEXT,
        COUNT(*) FILTER (WHERE ptf.outdoor = TRUE)::BIGINT,
        COUNT(*) FILTER (WHERE ptf.outdoor = FALSE)::BIGINT
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        
        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        
        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
        
        -- Already applied filters (only count products matching these)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
    
    UNION ALL
    
    SELECT
        'submersible'::TEXT,
        COUNT(*) FILTER (WHERE ptf.submersible = TRUE)::BIGINT,
        COUNT(*) FILTER (WHERE ptf.submersible = FALSE)::BIGINT
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        
        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        
        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
        
        -- Already applied filters (only count products matching these)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
    
    UNION ALL
    
    SELECT
        'trimless'::TEXT,
        COUNT(*) FILTER (WHERE ptf.trimless = TRUE)::BIGINT,
        COUNT(*) FILTER (WHERE ptf.trimless = FALSE)::BIGINT
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        
        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        
        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
        
        -- Already applied filters (only count products matching these)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
    
    UNION ALL
    
    SELECT
        'cut_shape_round'::TEXT,
        COUNT(*) FILTER (WHERE ptf.cut_shape_round = TRUE)::BIGINT,
        COUNT(*) FILTER (WHERE ptf.cut_shape_round = FALSE)::BIGINT
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        
        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        
        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
        
        -- Already applied filters (only count products matching these)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
    
    UNION ALL
    
    SELECT
        'cut_shape_rectangular'::TEXT,
        COUNT(*) FILTER (WHERE ptf.cut_shape_rectangular = TRUE)::BIGINT,
        COUNT(*) FILTER (WHERE ptf.cut_shape_rectangular = FALSE)::BIGINT
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        
        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        
        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))
        
        -- Already applied filters (only count products matching these)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round);
END;
$$;


ALTER FUNCTION "search"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) IS 'Returns filter counts based on currently applied filters.
Shows how many products have each flag value within the current result set.
Used for dynamic faceted search UI.';



CREATE TABLE IF NOT EXISTS "search"."filter_definitions" (
    "id" integer NOT NULL,
    "filter_key" "text" NOT NULL,
    "filter_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "etim_feature_id" "text" NOT NULL,
    "etim_unit_id" "text",
    "display_order" integer DEFAULT 0,
    "ui_component" "text",
    "ui_config" "jsonb",
    "applicable_taxonomy_codes" "text"[],
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "group" "text",
    CONSTRAINT "chk_valid_filter_group" CHECK ((("group" = ANY (ARRAY['Location'::"text", 'Options'::"text", 'Electricals'::"text", 'Design'::"text", 'Light'::"text", 'Source'::"text"])) OR ("group" IS NULL)))
);


ALTER TABLE "search"."filter_definitions" OWNER TO "postgres";


COMMENT ON TABLE "search"."filter_definitions" IS 'Defines available filters for faceted search. Controls UI rendering and
maps to ETIM features via product_filter_index materialized view.';



COMMENT ON COLUMN "search"."filter_definitions"."ui_config" IS 'JSONB configuration for UI rendering. 
   Special data_source values:
   - "suppliers": Fetch from items.catalog WHERE active=true JOIN items.supplier
   - "etim_feature": Fetch distinct values from items.product_feature
   - null/undefined: Use static options array in ui_config.options';



COMMENT ON COLUMN "search"."filter_definitions"."group" IS 'Filter group for organized UI display. Valid values: Location, Options, Electricals, Design, Light';



CREATE OR REPLACE FUNCTION "search"."get_filters_for_taxonomy"("p_taxonomy_code" "text") RETURNS SETOF "search"."filter_definitions"
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    ancestors TEXT[];
BEGIN
    -- Get all ancestors including the code itself
    ancestors := search.get_taxonomy_ancestors(p_taxonomy_code);
    
    -- Return filters where:
    -- 1. applicable_taxonomy_codes is NULL (applies to all), OR
    -- 2. applicable_taxonomy_codes overlaps with any ancestor
    RETURN QUERY
    SELECT fd.*
    FROM search.filter_definitions fd
    WHERE fd.active = true
      AND (
          fd.applicable_taxonomy_codes IS NULL
          OR fd.applicable_taxonomy_codes && ancestors  -- && = array overlap operator
      )
    ORDER BY fd."group", fd.display_order;
END;
$$;


ALTER FUNCTION "search"."get_filters_for_taxonomy"("p_taxonomy_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_filters_for_taxonomy"("p_taxonomy_code" "text") IS 'Returns all applicable filter definitions for a taxonomy code, checking the full hierarchy.';



CREATE OR REPLACE FUNCTION "search"."get_global_supplier_counts"() RETURNS TABLE("supplier_name" "text", "product_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT 
    alphanumeric_value as supplier_name,
    COUNT(DISTINCT product_id) as product_count
  FROM search.product_filter_index
  WHERE filter_key = 'supplier'
  GROUP BY alphanumeric_value
  ORDER BY product_count DESC;
$$;


ALTER FUNCTION "search"."get_global_supplier_counts"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_global_supplier_counts"() IS 'Returns supplier names with their total product counts across all categories. 
Used by SupplierFilter when no taxonomy is selected.';



CREATE OR REPLACE FUNCTION "search"."get_misc_products"() RETURNS TABLE("product_id" "uuid", "class" "text", "class_name" "text", "group_id" "text", "group_name" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
  classified_classes text[];
BEGIN
  -- Collect all classes from non-MISC classification rules
  WITH rule_classes AS (
    -- Direct class_ids from rules
    SELECT UNNEST(etim_class_ids) AS class_id
    FROM search.classification_rules
    WHERE taxonomy_code NOT LIKE 'MISC%'
      AND etim_class_ids IS NOT NULL
      AND active = true
    
    UNION
    
    -- Expand group_ids to their classes
    SELECT c."ARTCLASSID" AS class_id
    FROM search.classification_rules r
    CROSS JOIN LATERAL UNNEST(r.etim_group_ids) AS g(group_id)
    JOIN etim.class c ON c."ARTGROUPID" = g.group_id
    WHERE r.taxonomy_code NOT LIKE 'MISC%'
      AND r.etim_group_ids IS NOT NULL
      AND r.active = true
  )
  SELECT ARRAY_AGG(DISTINCT class_id) INTO classified_classes
  FROM rule_classes;

  -- Return products NOT in classified classes
  RETURN QUERY
  SELECT 
    p.product_id,
    p.class,
    p.class_name,
    p."group" AS group_id,
    p.group_name
  FROM items.product_info p
  WHERE p.class IS NOT NULL
    AND NOT (p.class = ANY(classified_classes));
END;
$$;


ALTER FUNCTION "search"."get_misc_products"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."get_search_statistics"() RETURNS TABLE("stat_name" "text", "stat_value" bigint)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT 'total_products'::TEXT, COUNT(*)::BIGINT 
    FROM search.product_taxonomy_flags
    
    UNION ALL
    
    SELECT 'indoor_products'::TEXT, COUNT(*)::BIGINT 
    FROM search.product_taxonomy_flags 
    WHERE indoor = true
    
    UNION ALL
    
    SELECT 'outdoor_products'::TEXT, COUNT(*)::BIGINT 
    FROM search.product_taxonomy_flags 
    WHERE outdoor = true
    
    UNION ALL
    
    SELECT 'dimmable_products'::TEXT, COUNT(DISTINCT ptf.product_id)::BIGINT
    FROM search.product_taxonomy_flags ptf
    JOIN items.product_info pi ON pi.product_id = ptf.product_id
    WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(pi.features) f
        WHERE f->>'FEATUREID' = 'EF000137' -- Dimmable feature
          AND (f->>'fvalueB')::BOOLEAN = true
    )
    
    UNION ALL
    
    SELECT 'filter_entries'::TEXT, COUNT(*)::BIGINT 
    FROM search.product_filter_index
    
    UNION ALL
    
    SELECT 'taxonomy_nodes'::TEXT, COUNT(*)::BIGINT 
    FROM search.taxonomy 
    WHERE active = true;
END;
$$;


ALTER FUNCTION "search"."get_search_statistics"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_search_statistics"() IS 'Returns system statistics for the search dashboard.
Used by the stats panel in the search UI.';



CREATE OR REPLACE FUNCTION "search"."get_supplier_counts_by_taxonomy"("p_taxonomy_code" "text") RETURNS TABLE("supplier_name" "text", "product_count" bigint)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
  SELECT
    pfi.alphanumeric_value as supplier_name,
    COUNT(DISTINCT pfi.product_id) as product_count
  FROM search.product_filter_index pfi
  INNER JOIN search.product_taxonomy_flags ptf
    ON ptf.product_id = pfi.product_id
  WHERE pfi.filter_key = 'supplier'
    AND p_taxonomy_code = ANY(ptf.taxonomy_path)
  GROUP BY pfi.alphanumeric_value
  ORDER BY product_count DESC;
$$;


ALTER FUNCTION "search"."get_supplier_counts_by_taxonomy"("p_taxonomy_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."get_taxonomy_ancestors"("p_taxonomy_code" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
DECLARE
    ancestors TEXT[] := ARRAY[p_taxonomy_code];
    current_code TEXT := p_taxonomy_code;
    parent TEXT;
BEGIN
    LOOP
        SELECT parent_code INTO parent
        FROM search.taxonomy
        WHERE code = current_code;
        
        EXIT WHEN parent IS NULL;
        
        ancestors := array_append(ancestors, parent);
        current_code := parent;
    END LOOP;
    
    RETURN ancestors;
END;
$$;


ALTER FUNCTION "search"."get_taxonomy_ancestors"("p_taxonomy_code" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_taxonomy_ancestors"("p_taxonomy_code" "text") IS 'Returns all ancestor codes for a taxonomy code, including itself. Used for hierarchical filter scoping.';



CREATE OR REPLACE FUNCTION "search"."get_taxonomy_tree"() RETURNS TABLE("code" "text", "parent_code" "text", "level" integer, "name" "text", "product_count" bigint, "icon" "text", "description" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "search"."get_taxonomy_tree"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."get_taxonomy_tree"() IS 'Returns the complete taxonomy tree with product counts and descriptions for each node';



CREATE OR REPLACE FUNCTION "search"."preview_classification_rule"("p_etim_group_ids" "text"[] DEFAULT NULL::"text"[], "p_etim_class_ids" "text"[] DEFAULT NULL::"text"[], "p_text_pattern" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 10) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description" "text", "etim_group" "text", "etim_class" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        pi.description_short AS description,
        pi."group" AS etim_group,
        pi.class AS etim_class
    FROM items.product_info pi
    WHERE (
        -- Match ETIM groups if provided
        (p_etim_group_ids IS NULL OR pi."group" = ANY(p_etim_group_ids))
        AND
        -- Match ETIM classes if provided
        (p_etim_class_ids IS NULL OR pi.class = ANY(p_etim_class_ids))
        AND
        -- Match text pattern if provided
        (p_text_pattern IS NULL OR
         pi.description_short ~* p_text_pattern OR
         pi.description_long ~* p_text_pattern)
    )
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "search"."preview_classification_rule"("p_etim_group_ids" "text"[], "p_etim_class_ids" "text"[], "p_text_pattern" "text", "p_limit" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "search"."preview_classification_rule"("p_etim_group_ids" "text"[], "p_etim_class_ids" "text"[], "p_text_pattern" "text", "p_limit" integer) IS 'Preview products that would be affected by a classification rule';



CREATE OR REPLACE FUNCTION "search"."refresh_all_product_views"() RETURNS TABLE("view_name" "text", "refresh_time_ms" bigint, "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    -- PHASE 1: items.product_info
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_info;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'items.product_info'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'items.product_info'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    -- PHASE 2: items schema views
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_categories_mv;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'items.product_categories_mv'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'items.product_categories_mv'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_features_mv;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'items.product_features_mv'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'items.product_features_mv'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.product_feature_group_mapping;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'items.product_feature_group_mapping'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'items.product_feature_group_mapping'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW items.gcfv_mapping;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'items.gcfv_mapping'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'items.gcfv_mapping'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    -- PHASE 3: search.product_filter_index
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW search.product_filter_index;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'search.product_filter_index'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'search.product_filter_index'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    -- PHASE 3.5: Update MISC rule (dynamic catch-all)
    start_time := clock_timestamp();
    BEGIN
        PERFORM search.update_misc_rule_classes();
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'search.update_misc_rule_classes'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'search.update_misc_rule_classes'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    -- PHASE 4: search.product_taxonomy_flags
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW search.product_taxonomy_flags;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'search.product_taxonomy_flags'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'search.product_taxonomy_flags'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    -- PHASE 5: search.filter_facets
    start_time := clock_timestamp();
    BEGIN
        REFRESH MATERIALIZED VIEW search.filter_facets;
        end_time := clock_timestamp();
        RETURN QUERY SELECT 'search.filter_facets'::TEXT,
            EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
    EXCEPTION WHEN OTHERS THEN
        RETURN QUERY SELECT 'search.filter_facets'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
    END;

    -- PHASE 6: search.taxonomy_product_counts (if exists)
    IF EXISTS (
        SELECT 1 FROM pg_matviews WHERE schemaname = 'search' AND matviewname = 'taxonomy_product_counts'
    ) THEN
        start_time := clock_timestamp();
        BEGIN
            REFRESH MATERIALIZED VIEW search.taxonomy_product_counts;
            end_time := clock_timestamp();
            RETURN QUERY SELECT 'search.taxonomy_product_counts'::TEXT,
                EXTRACT(MILLISECONDS FROM (end_time - start_time))::BIGINT, TRUE, NULL::TEXT;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT 'search.taxonomy_product_counts'::TEXT, 0::BIGINT, FALSE, SQLERRM::TEXT;
        END;
    END IF;

    RETURN;
END;
$$;


ALTER FUNCTION "search"."refresh_all_product_views"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."refresh_search_views"() RETURNS TABLE("view_name" "text", "refresh_duration_ms" bigint, "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Call the comprehensive function in search schema
    RETURN QUERY SELECT * FROM search.refresh_all_product_views();
END;
$$;


ALTER FUNCTION "search"."refresh_search_views"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."refresh_search_views"() IS 'Alias for refresh_all_product_views(). Maintained for backward compatibility.';



CREATE OR REPLACE FUNCTION "search"."refresh_taxonomy_only"() RETURNS TABLE("view_name" "text", "refresh_duration_ms" bigint, "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "search"."refresh_taxonomy_only"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."refresh_taxonomy_only"() IS 'Lightweight refresh for taxonomy changes only (e.g., updating classification_rules, taxonomy table).
Does NOT refresh items.product_info or other product views.
Use this after:
  - Adding/modifying classification rules
  - Changing taxonomy structure
  - Updating taxonomy flags

For catalog.active changes, use refresh_all_product_views() instead.';



CREATE OR REPLACE FUNCTION "search"."refresh_taxonomy_only_with_timeout"() RETURNS TABLE("view_name" "text", "refresh_duration_ms" bigint, "success" boolean, "error_message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Set timeout for this function execution
    PERFORM set_config('statement_timeout', '60000', true); -- 60 seconds
    
    -- Call the actual refresh function
    RETURN QUERY SELECT * FROM taxonomy_admin.refresh_taxonomy_only();
END;
$$;


ALTER FUNCTION "search"."refresh_taxonomy_only_with_timeout"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."search_products"("p_query" "text" DEFAULT NULL::"text", "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_ceiling" boolean DEFAULT NULL::boolean, "p_wall" boolean DEFAULT NULL::boolean, "p_pendant" boolean DEFAULT NULL::boolean, "p_recessed" boolean DEFAULT NULL::boolean, "p_dimmable" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_color_temp_min" numeric DEFAULT NULL::numeric, "p_color_temp_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_sort_by" "text" DEFAULT 'relevance'::"text", "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        pi.description_short,
        pi.description_long,
        pi.supplier_name,
        pi.class_name,
        (pi.prices->0->>'start_price')::NUMERIC as price,
        (pi.multimedia->0->>'mime_source') as image_url,
        ptf.taxonomy_path,
        jsonb_build_object(
            'indoor', ptf.indoor,
            'outdoor', ptf.outdoor,
            'submersible', ptf.submersible,
            'trimless', ptf.trimless,
            'cut_shape_round', ptf.cut_shape_round,
            'cut_shape_rectangular', ptf.cut_shape_rectangular,
            'ceiling', ptf.ceiling,
            'wall', ptf.wall,
            'floor', ptf.floor,
            'recessed', ptf.recessed,
            'surface_mounted', ptf.surface_mounted,
            'suspended', ptf.suspended
        ) as flags,
        jsonb_build_object(
            'power', (SELECT pfi.numeric_value FROM search.product_filter_index pfi
                      WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'power' LIMIT 1),
            'color_temp', (SELECT pfi.numeric_value FROM search.product_filter_index pfi
                          WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'color_temp' LIMIT 1),
            'ip_rating', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                         WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'ip_rating' LIMIT 1)
        ) as key_features,
        CASE
            WHEN p_query IS NOT NULL AND pi.description_short ILIKE p_query THEN 1
            WHEN p_query IS NOT NULL AND pi.description_short ILIKE '%' || p_query || '%' THEN 2
            ELSE 3
        END as relevance_score
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        -- Text search
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')

        -- Taxonomy filter
        AND (p_taxonomy_codes IS NULL OR
             p_taxonomy_codes = ARRAY[]::TEXT[] OR
             ptf.taxonomy_path && p_taxonomy_codes)

        -- Boolean flags
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
        AND (p_ceiling IS NULL OR ptf.ceiling = p_ceiling)
        AND (p_wall IS NULL OR ptf.wall = p_wall)
        AND (p_pendant IS NULL OR ptf.decorative_pendant = p_pendant)
        AND (p_recessed IS NULL OR ptf.recessed = p_recessed)

        -- Numeric filters
        AND (p_power_min IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'power'
              AND pfi.numeric_value >= p_power_min
        ))
        AND (p_power_max IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'power'
              AND pfi.numeric_value <= p_power_max
        ))
        AND (p_color_temp_min IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'color_temp'
              AND pfi.numeric_value >= p_color_temp_min
        ))
        AND (p_color_temp_max IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'color_temp'
              AND pfi.numeric_value <= p_color_temp_max
        ))

        -- Alphanumeric filters
        AND (p_ip_ratings IS NULL OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'ip_rating'
              AND pfi.alphanumeric_value = ANY(p_ip_ratings)
        ))

        -- Supplier filter
        AND (p_suppliers IS NULL OR pi.supplier_name = ANY(p_suppliers))

    ORDER BY
        CASE
            WHEN p_sort_by = 'relevance' THEN relevance_score
            WHEN p_sort_by = 'price_asc' THEN (pi.prices->0->>'start_price')::INTEGER
            WHEN p_sort_by = 'price_desc' THEN -(pi.prices->0->>'start_price')::INTEGER
            ELSE relevance_score
        END,
        pi.foss_pid

    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "search"."search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "search"."search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) IS 'Consolidated search function with all 22 parameters. PostgREST-compatible (no overloads).';



CREATE OR REPLACE FUNCTION "search"."search_products_v2"("p_query" "text" DEFAULT NULL::"text", "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_ceiling" boolean DEFAULT NULL::boolean, "p_wall" boolean DEFAULT NULL::boolean, "p_pendant" boolean DEFAULT NULL::boolean, "p_recessed" boolean DEFAULT NULL::boolean, "p_dimmable" boolean DEFAULT NULL::boolean, "p_power_min" numeric DEFAULT NULL::numeric, "p_power_max" numeric DEFAULT NULL::numeric, "p_color_temp_min" numeric DEFAULT NULL::numeric, "p_color_temp_max" numeric DEFAULT NULL::numeric, "p_ip_ratings" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_sort_by" "text" DEFAULT 'relevance'::"text", "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search.search_products(
        p_query,
        p_indoor,
        p_outdoor,
        p_submersible,
        p_trimless,
        p_cut_shape_round,
        p_cut_shape_rectangular,
        p_ceiling,
        p_wall,
        p_pendant,
        p_recessed,
        p_dimmable,
        p_power_min,
        p_power_max,
        p_color_temp_min,
        p_color_temp_max,
        p_ip_ratings,
        p_suppliers,
        p_taxonomy_codes,
        p_sort_by,
        p_limit,
        p_offset
    );
END;
$$;


ALTER FUNCTION "search"."search_products_v2"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "search"."search_products_v2"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) IS 'Wrapper function for search_products. Single entry point with no overloads - PostgREST compatible.';



CREATE OR REPLACE FUNCTION "search"."search_products_with_filters"("p_query" "text" DEFAULT NULL::"text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_outdoor" boolean DEFAULT NULL::boolean, "p_submersible" boolean DEFAULT NULL::boolean, "p_trimless" boolean DEFAULT NULL::boolean, "p_cut_shape_round" boolean DEFAULT NULL::boolean, "p_cut_shape_rectangular" boolean DEFAULT NULL::boolean, "p_sort_by" "text" DEFAULT 'relevance'::"text", "p_limit" integer DEFAULT 24, "p_offset" integer DEFAULT 0) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "description_long" "text", "supplier_name" "text", "class_name" "text", "price" numeric, "image_url" "text", "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO ''
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        pi.description_short,
        pi.description_long,
        pi.supplier_name,
        pi.class_name,
        (pi.prices->0->>'start_price')::NUMERIC as price,
        -- Prioritize MD47 (Supabase thumbnail) → MD02 (print-ready) → MD01 (supplier external)
        COALESCE(
            (SELECT elem->>'mime_source' FROM jsonb_array_elements(pi.multimedia) AS elem WHERE elem->>'mime_code' = 'MD47' LIMIT 1),
            (SELECT elem->>'mime_source' FROM jsonb_array_elements(pi.multimedia) AS elem WHERE elem->>'mime_code' = 'MD02' LIMIT 1),
            (SELECT elem->>'mime_source' FROM jsonb_array_elements(pi.multimedia) AS elem WHERE elem->>'mime_code' = 'MD01' LIMIT 1)
        ) as image_url,
        ptf.taxonomy_path,
        jsonb_build_object(
            'indoor', ptf.indoor,
            'outdoor', ptf.outdoor,
            'ceiling', ptf.ceiling,
            'wall', ptf.wall,
            'recessed', ptf.recessed,
            'dimmable', ptf.dimmable,
            'submersible', ptf.submersible,
            'trimless', ptf.trimless,
            'cut_shape_round', ptf.cut_shape_round,
            'cut_shape_rectangular', ptf.cut_shape_rectangular
        ) as flags,
        jsonb_build_object(
            'voltage', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                       WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'voltage' LIMIT 1),
            'class', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                     WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'class' LIMIT 1),
            'ip', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                  WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'ip' LIMIT 1),
            'finishing_colour', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                               WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'finishing_colour' LIMIT 1),
            'cct', (SELECT pfi.numeric_value FROM search.product_filter_index pfi
                   WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cct' LIMIT 1),
            'cri', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                   WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cri' LIMIT 1),
            'lumens_output', (SELECT pfi.numeric_value FROM search.product_filter_index pfi
                            WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'lumens_output' LIMIT 1)
        ) as key_features,
        CASE
            WHEN p_query IS NOT NULL AND pi.description_short ILIKE p_query THEN 1
            WHEN p_query IS NOT NULL AND pi.description_short ILIKE '%' || p_query || '%' THEN 2
            ELSE 3
        END as relevance_score
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (p_outdoor IS NULL OR ptf.outdoor = p_outdoor)
        AND (p_submersible IS NULL OR ptf.submersible = p_submersible)
        AND (p_trimless IS NULL OR ptf.trimless = p_trimless)
        AND (p_cut_shape_round IS NULL OR ptf.cut_shape_round = p_cut_shape_round)
        AND (p_cut_shape_rectangular IS NULL OR ptf.cut_shape_rectangular = p_cut_shape_rectangular)
        AND (p_suppliers IS NULL OR cardinality(p_suppliers) = 0 OR pi.supplier_name = ANY(p_suppliers))
        AND (NOT (p_filters ? 'voltage') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'voltage' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'voltage')))))
        AND (NOT (p_filters ? 'dimmable') OR (p_filters->>'dimmable')::BOOLEAN = ptf.dimmable)
        AND (NOT (p_filters ? 'class') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'class' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'class')))))
        AND (NOT (p_filters ? 'ip') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'ip' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'ip')))))
        AND (NOT (p_filters ? 'finishing_colour') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'finishing_colour' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'finishing_colour')))))
        AND (p_filters->'cct'->>'min' IS NULL OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cct' AND pfi.numeric_value >= (p_filters->'cct'->>'min')::NUMERIC))
        AND (p_filters->'cct'->>'max' IS NULL OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cct' AND pfi.numeric_value <= (p_filters->'cct'->>'max')::NUMERIC))
        AND (NOT (p_filters ? 'cri') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cri' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'cri')))))
        AND (p_filters->'lumens_output'->>'min' IS NULL OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'lumens_output' AND pfi.numeric_value >= (p_filters->'lumens_output'->>'min')::NUMERIC))
        AND (p_filters->'lumens_output'->>'max' IS NULL OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'lumens_output' AND pfi.numeric_value <= (p_filters->'lumens_output'->>'max')::NUMERIC))
        AND (NOT (p_filters ? 'beam_angle_type') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'beam_angle_type' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'beam_angle_type')))))
        AND (NOT (p_filters ? 'light_source') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'light_source' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'light_source')))))
        AND (NOT (p_filters ? 'light_distribution') OR EXISTS (SELECT 1 FROM search.product_filter_index pfi WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'light_distribution' AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'light_distribution')))))
    ORDER BY relevance_score, foss_pid
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;


ALTER FUNCTION "search"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_complete"("p_query" "text" DEFAULT NULL::"text", "p_filters" "jsonb" DEFAULT '{}'::"jsonb", "p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_suppliers" "text"[] DEFAULT NULL::"text"[], "p_sort_by" "text" DEFAULT 'relevance'::"text", "p_limit" integer DEFAULT 24) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "price" numeric, "taxonomy_path" "text"[], "flags" "jsonb", "key_features" "jsonb", "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        pi.description_short,
        (pi.prices->0->>'start_price')::NUMERIC as price,
        ptf.taxonomy_path,
        jsonb_build_object(
            'indoor', ptf.indoor,
            'outdoor', ptf.outdoor
        ) as flags,
        jsonb_build_object(
            'ip', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                  WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'ip' LIMIT 1)
        ) as key_features,
        CASE
            WHEN p_query IS NOT NULL AND pi.description_short ILIKE p_query THEN 1
            WHEN p_query IS NOT NULL AND pi.description_short ILIKE '%' || p_query || '%' THEN 2
            ELSE 3
        END as relevance_score
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_query IS NULL OR
         pi.description_short ILIKE '%' || p_query || '%' OR
         pi.description_long ILIKE '%' || p_query || '%')
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (p_suppliers IS NULL OR cardinality(p_suppliers) = 0 OR pi.supplier_name = ANY(p_suppliers))
        AND (NOT (p_filters ? 'beam_angle_type') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'beam_angle_type'
              AND pfi.alphanumeric_value = ANY(
                  ARRAY(SELECT jsonb_array_elements_text(p_filters->'beam_angle_type'))
              )
        ))
    ORDER BY relevance_score, foss_pid
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION "search"."test_complete"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_sort_by" "text", "p_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_count_simple"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean) RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(DISTINCT pi.product_id)
    INTO v_count
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor);

    RETURN v_count;
END;
$$;


ALTER FUNCTION "search"."test_count_simple"("p_taxonomy_codes" "text"[], "p_indoor" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_count_with_voltage"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_indoor" boolean DEFAULT NULL::boolean, "p_filters" "jsonb" DEFAULT '{}'::"jsonb") RETURNS bigint
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
DECLARE
    v_count BIGINT;
BEGIN
    SELECT COUNT(DISTINCT pi.product_id)
    INTO v_count
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (p_indoor IS NULL OR ptf.indoor = p_indoor)
        AND (NOT (p_filters ? 'voltage') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id
              AND pfi.filter_key = 'voltage'
              AND pfi.alphanumeric_value = ANY(ARRAY(SELECT jsonb_array_elements_text(p_filters->'voltage')))
        ));

    RETURN v_count;
END;
$$;


ALTER FUNCTION "search"."test_count_with_voltage"("p_taxonomy_codes" "text"[], "p_indoor" boolean, "p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_dimmable_filter"("p_filters" "jsonb" DEFAULT '{}'::"jsonb") RETURNS TABLE("test_name" "text", "result_value" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'p_filters value'::TEXT,
        p_filters::TEXT
    UNION ALL
    SELECT 
        'has dimmable key'::TEXT,
        (p_filters ? 'dimmable')::TEXT
    UNION ALL
    SELECT
        'dimmable value'::TEXT,
        (p_filters->>'dimmable')::TEXT
    UNION ALL
    SELECT
        'count with filter'::TEXT,
        (SELECT COUNT(*)::TEXT
         FROM items.product_info pi
         INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
         WHERE ptf.taxonomy_path && ARRAY['LUMINAIRE-INDOOR-CEILING']
           AND (NOT (p_filters ? 'dimmable') OR
                (p_filters->>'dimmable')::BOOLEAN = ptf.dimmable));
END;
$$;


ALTER FUNCTION "search"."test_dimmable_filter"("p_filters" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_minimal"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        pi.description_short
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (NULL IS NULL OR
         pi.description_short ILIKE '%' || NULL || '%' OR
         pi.description_long ILIKE '%' || NULL || '%')
        AND (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (NULL IS NULL OR ptf.indoor = NULL)
        AND (NULL IS NULL OR ptf.outdoor = NULL)
        AND (NULL IS NULL OR cardinality(NULL::TEXT[]) = 0 OR pi.supplier_name = ANY(NULL::TEXT[]))
        AND (NOT ('{}'::JSONB ? 'voltage') OR EXISTS (
            SELECT 1 FROM search.product_filter_index pfi
            WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'voltage'
        ))
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_minimal"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_minimal_search"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "price" numeric)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        (pi.prices->0->>'start_price')::NUMERIC as price
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    ORDER BY foss_pid
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_minimal_search"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_search"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pi.product_id,
        pi.foss_pid
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    LIMIT 5;
END;
$$;


ALTER FUNCTION "search"."test_search"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_simple"() RETURNS TABLE("product_id" "uuid", "foss_pid" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT pi.product_id, pi.foss_pid
    FROM items.product_info pi
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_simple"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_case_order"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_sort_by" "text" DEFAULT 'relevance'::"text") RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "price" numeric, "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        (pi.prices->0->>'start_price')::NUMERIC as price,
        3 as relevance_score
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    ORDER BY
        CASE
            WHEN p_sort_by = 'relevance' THEN relevance_score
            WHEN p_sort_by = 'price_asc' THEN price::INTEGER
            WHEN p_sort_by = 'price_desc' THEN -price::INTEGER
            ELSE relevance_score
        END,
        foss_pid
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_case_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_flags"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "flags" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        jsonb_build_object(
            'indoor', ptf.indoor,
            'outdoor', ptf.outdoor,
            'ceiling', ptf.ceiling,
            'wall', ptf.wall,
            'recessed', ptf.recessed,
            'dimmable', ptf.dimmable,
            'submersible', ptf.submersible,
            'trimless', ptf.trimless,
            'cut_shape_round', ptf.cut_shape_round,
            'cut_shape_rectangular', ptf.cut_shape_rectangular
        ) as flags
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_flags"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_join"() RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "taxonomy_path" "text"[])
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT pi.product_id, pi.foss_pid, ptf.taxonomy_path
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_key_features"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "key_features" "jsonb")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        jsonb_build_object(
            'voltage', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                       WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'voltage' LIMIT 1),
            'class', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                     WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'class' LIMIT 1),
            'ip', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                  WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'ip' LIMIT 1),
            'finishing_colour', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                               WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'finishing_colour' LIMIT 1),
            'cct', (SELECT pfi.numeric_value FROM search.product_filter_index pfi
                   WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cct' LIMIT 1),
            'cri', (SELECT pfi.alphanumeric_value FROM search.product_filter_index pfi
                   WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'cri' LIMIT 1),
            'lumens_output', (SELECT pfi.numeric_value FROM search.product_filter_index pfi
                            WHERE pfi.product_id = pi.product_id AND pfi.filter_key = 'lumens_output' LIMIT 1)
        ) as key_features
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_key_features"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_more_fields"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "description_short" "text", "price" numeric, "image_url" "text")
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        pi.description_short,
        (pi.prices->0->>'start_price')::NUMERIC as price,
        (SELECT elem->>'mime_source' FROM jsonb_array_elements(pi.multimedia) AS elem WHERE elem->>'mime_code' = 'MD01' LIMIT 1) as image_url
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
        AND (NULL IS NULL OR cardinality(NULL::TEXT[]) = 0 OR pi.supplier_name = ANY(NULL::TEXT[]))
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_more_fields"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_order"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[], "p_sort_by" "text" DEFAULT 'relevance'::"text") RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "price" numeric, "relevance_score" integer)
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        pi.product_id,
        pi.foss_pid,
        (pi.prices->0->>'start_price')::NUMERIC as price,
        3 as relevance_score
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE
        (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    ORDER BY
        CASE
            WHEN p_sort_by = 'relevance' THEN relevance_score
            WHEN p_sort_by = 'price_asc' THEN price::INTEGER
            WHEN p_sort_by = 'price_desc' THEN -price::INTEGER
            ELSE relevance_score
        END,
        foss_pid
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."test_with_where"("p_taxonomy_codes" "text"[] DEFAULT NULL::"text"[]) RETURNS TABLE("product_id" "uuid", "foss_pid" "text", "taxonomy_path" "text"[])
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'search', 'items', 'etim', 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT pi.product_id, pi.foss_pid, ptf.taxonomy_path
    FROM items.product_info pi
    INNER JOIN search.product_taxonomy_flags ptf ON pi.product_id = ptf.product_id
    WHERE (p_taxonomy_codes IS NULL OR ptf.taxonomy_path && p_taxonomy_codes)
    LIMIT 3;
END;
$$;


ALTER FUNCTION "search"."test_with_where"("p_taxonomy_codes" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."update_misc_rule_classes"() RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
DECLARE
  classified_classes text[];
  misc_classes text[];
BEGIN
  -- Collect all classes from non-MISC classification rules
  WITH rule_classes AS (
    -- Direct class_ids from rules
    SELECT UNNEST(etim_class_ids) AS class_id
    FROM search.classification_rules
    WHERE taxonomy_code NOT LIKE 'MISC%'
      AND etim_class_ids IS NOT NULL
      AND active = true
    
    UNION
    
    -- Expand group_ids to their classes
    SELECT c."ARTCLASSID" AS class_id
    FROM search.classification_rules r
    CROSS JOIN LATERAL UNNEST(r.etim_group_ids) AS g(group_id)
    JOIN etim.class c ON c."ARTGROUPID" = g.group_id
    WHERE r.taxonomy_code NOT LIKE 'MISC%'
      AND r.etim_group_ids IS NOT NULL
      AND r.active = true
  )
  SELECT ARRAY_AGG(DISTINCT class_id) INTO classified_classes
  FROM rule_classes;

  -- Get classes that exist in product_info but are NOT classified
  SELECT ARRAY_AGG(DISTINCT p.class) INTO misc_classes
  FROM items.product_info p
  WHERE p.class IS NOT NULL
    AND NOT (p.class = ANY(classified_classes));

  -- Update misc_root rule with dynamic classes
  UPDATE search.classification_rules
  SET etim_class_ids = misc_classes,
      etim_group_ids = NULL,
      updated_at = now()
  WHERE rule_name = 'misc_root';

  RAISE NOTICE 'Updated misc_root with % classes: %', array_length(misc_classes, 1), misc_classes;
END;
$$;


ALTER FUNCTION "search"."update_misc_rule_classes"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "search"."validate_taxonomy_hierarchy"() RETURNS TABLE("error_type" "text", "code" "text", "message" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
BEGIN
    -- Check for orphaned nodes (parent_code doesn't exist)
    RETURN QUERY
    SELECT
        'orphaned_node'::TEXT,
        t.code,
        'Parent code "' || t.parent_code || '" does not exist'
    FROM search.taxonomy t
    WHERE t.parent_code IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM search.taxonomy p
        WHERE p.code = t.parent_code
    );

    -- Check for level inconsistencies
    RETURN QUERY
    SELECT
        'level_inconsistency'::TEXT,
        t.code,
        'Level ' || t.level::TEXT || ' does not match parent level + 1'
    FROM search.taxonomy t
    INNER JOIN search.taxonomy p ON t.parent_code = p.code
    WHERE t.level != p.level + 1;

    RETURN;
END;
$$;


ALTER FUNCTION "search"."validate_taxonomy_hierarchy"() OWNER TO "postgres";


COMMENT ON FUNCTION "search"."validate_taxonomy_hierarchy"() IS 'Validate taxonomy hierarchy for errors';



CREATE TABLE IF NOT EXISTS "analytics"."user_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_id" "text",
    "pathname" "text",
    "event_data" "jsonb",
    "user_agent" "text"
);


ALTER TABLE "analytics"."user_events" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."user_events" IS 'User event tracking. RLS enabled - only accessible via service_role (server-side).';



COMMENT ON COLUMN "analytics"."user_events"."user_id" IS 'User email from NextAuth session';



COMMENT ON COLUMN "analytics"."user_events"."event_type" IS 'Type of event: login, logout, search, product_view, etc.';



COMMENT ON COLUMN "analytics"."user_events"."created_at" IS 'Timestamp when the event occurred';



COMMENT ON COLUMN "analytics"."user_events"."session_id" IS 'Session identifier for grouping related events';



COMMENT ON COLUMN "analytics"."user_events"."pathname" IS 'Route/page path where event occurred (e.g., /products, /dashboard)';



COMMENT ON COLUMN "analytics"."user_events"."event_data" IS 'Flexible JSON metadata: search_query, product_id, result_count, etc.';



COMMENT ON COLUMN "analytics"."user_events"."user_agent" IS 'Browser and device information from User-Agent header';



CREATE TABLE IF NOT EXISTS "analytics"."user_groups" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "description" "text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."user_groups" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "analytics"."user_groups_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "analytics"."user_groups_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "analytics"."user_groups_id_seq" OWNED BY "analytics"."user_groups"."id";



CREATE TABLE IF NOT EXISTS "analytics"."user_settings" (
    "user_id" "uuid" NOT NULL,
    "theme" "text" DEFAULT 'default'::"text",
    "sidebar_expanded" boolean DEFAULT true,
    "active_project_id" "uuid",
    "active_project_code" "text",
    "active_project_name" "text",
    "last_seen_version" "text",
    "search_history_tiles" "text"[] DEFAULT '{}'::"text"[],
    "search_history_symbols" "text"[] DEFAULT '{}'::"text"[],
    "search_history_customers" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_settings_theme_check" CHECK (("theme" = ANY (ARRAY['default'::"text", 'supabase'::"text", 'graphite'::"text"])))
);


ALTER TABLE "analytics"."user_settings" OWNER TO "postgres";


COMMENT ON TABLE "analytics"."user_settings" IS 'User preferences and settings. RLS enabled - only accessible via service_role (server-side).';



CREATE TABLE IF NOT EXISTS "analytics"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "name" "text",
    "image" "text",
    "group_id" integer DEFAULT 3,
    "is_active" boolean DEFAULT true,
    "first_login_at" timestamp with time zone,
    "last_login_at" timestamp with time zone,
    "login_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "analytics"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "bsdd"."class" (
    "ARTCLASSID" "text" NOT NULL,
    "ARTGROUPID" "text",
    "ARTCLASSDESC" "text",
    "ARTCLASSVERSION" bigint,
    "ARTCLASSVERSIONDATE" timestamp with time zone,
    "RELEASE" "text",
    "definition" "text",
    "parent_class_code" "text",
    "related_ifc_entities" "text"[],
    "class_type" "text",
    "status" "text",
    "replaced_object_codes" "text"[],
    "replacing_object_codes" "text"[],
    "countries_of_use" "text"[],
    "subdivisions_of_use" "text"[],
    "uid" "text",
    "visual_representation_uri" "text"
);


ALTER TABLE "bsdd"."class" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."class" IS 'Contains all bSDD/ETIM classes with enhanced metadata';



COMMENT ON COLUMN "bsdd"."class"."ARTCLASSID" IS 'The class ID as defined in ETIM standards';



COMMENT ON COLUMN "bsdd"."class"."ARTGROUPID" IS 'The group ID as defined in ETIM standards';



COMMENT ON COLUMN "bsdd"."class"."ARTCLASSDESC" IS 'The description of the class';



COMMENT ON COLUMN "bsdd"."class"."definition" IS 'Detailed definition from bSDD';



COMMENT ON COLUMN "bsdd"."class"."parent_class_code" IS 'Parent class code for hierarchical structure';



COMMENT ON COLUMN "bsdd"."class"."related_ifc_entities" IS 'Array of related IFC entity names';



COMMENT ON COLUMN "bsdd"."class"."class_type" IS 'Type of class (e.g., Class, GroupOfProperties)';



COMMENT ON COLUMN "bsdd"."class"."status" IS 'Status of the class (Active, Inactive, Preview)';



CREATE TABLE IF NOT EXISTS "bsdd"."classfeaturemap" (
    "ARTCLASSFEATURENR" bigint NOT NULL,
    "ARTCLASSID" "text",
    "FEATUREID" "text",
    "FEATURETYPE" "text",
    "UNITOFMEASID" "text",
    "SORTNR" bigint,
    "property_set" "text",
    "predefined_value" "text",
    "mapping_code" "text"
);


ALTER TABLE "bsdd"."classfeaturemap" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."classfeaturemap" IS 'Contains mappings of each class with specific features. bSDD/ETIM standard forces classes to have very specific features';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."ARTCLASSFEATURENR" IS 'The primary key of the table';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."ARTCLASSID" IS 'The id of the class. References class table';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."FEATUREID" IS 'The id of the feature. References feature table';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."FEATURETYPE" IS 'The type of the feature (A=Alphanumeric, N=Numeric, R=Range, L=Logic)';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."UNITOFMEASID" IS 'The unit of measurement. References unit table';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."SORTNR" IS 'Useful for sorting the importance of the feature. The lower the more important';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."property_set" IS 'Property set grouping (e.g., Measurements, Model/Type, Operating conditions)';



COMMENT ON COLUMN "bsdd"."classfeaturemap"."mapping_code" IS 'Unique code for class-property mapping from bSDD';



CREATE SEQUENCE IF NOT EXISTS "bsdd"."classfeaturemap_ARTCLASSFEATURENR_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "bsdd"."classfeaturemap_ARTCLASSFEATURENR_seq" OWNER TO "postgres";


ALTER SEQUENCE "bsdd"."classfeaturemap_ARTCLASSFEATURENR_seq" OWNED BY "bsdd"."classfeaturemap"."ARTCLASSFEATURENR";



CREATE TABLE IF NOT EXISTS "bsdd"."classfeaturevaluemap" (
    "ARTCLASSFEATUREVALUENR" bigint NOT NULL,
    "ARTCLASSFEATURENR" bigint,
    "VALUEID" "text",
    "SORTNR" bigint
);


ALTER TABLE "bsdd"."classfeaturevaluemap" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."classfeaturevaluemap" IS 'Contains mapping for features that have alphanumeric data';



COMMENT ON COLUMN "bsdd"."classfeaturevaluemap"."ARTCLASSFEATUREVALUENR" IS 'The primary key';



COMMENT ON COLUMN "bsdd"."classfeaturevaluemap"."ARTCLASSFEATURENR" IS 'The feature that can have several alphanumeric values. It references bsdd.classfeaturemap';



COMMENT ON COLUMN "bsdd"."classfeaturevaluemap"."VALUEID" IS 'The id of the value. References bsdd.value';



COMMENT ON COLUMN "bsdd"."classfeaturevaluemap"."SORTNR" IS 'Number used for sorting the value to a uniform way';



CREATE SEQUENCE IF NOT EXISTS "bsdd"."classfeaturevaluemap_ARTCLASSFEATUREVALUENR_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "bsdd"."classfeaturevaluemap_ARTCLASSFEATUREVALUENR_seq" OWNER TO "postgres";


ALTER SEQUENCE "bsdd"."classfeaturevaluemap_ARTCLASSFEATUREVALUENR_seq" OWNED BY "bsdd"."classfeaturevaluemap"."ARTCLASSFEATUREVALUENR";



CREATE TABLE IF NOT EXISTS "bsdd"."classynonymmap" (
    "id" bigint NOT NULL,
    "ARTCLASSID" "text" NOT NULL,
    "CLASSSYNONYM" "text" NOT NULL
);


ALTER TABLE "bsdd"."classynonymmap" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."classynonymmap" IS 'The synonyms of classes. Useful when searching class description with similar keywords';



COMMENT ON COLUMN "bsdd"."classynonymmap"."ARTCLASSID" IS 'The specific id of the class';



COMMENT ON COLUMN "bsdd"."classynonymmap"."CLASSSYNONYM" IS 'The synonym of the class';



CREATE SEQUENCE IF NOT EXISTS "bsdd"."classynonymmap_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "bsdd"."classynonymmap_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "bsdd"."classynonymmap_id_seq" OWNED BY "bsdd"."classynonymmap"."id";



CREATE TABLE IF NOT EXISTS "bsdd"."feature" (
    "FEATUREID" "text" NOT NULL,
    "FEATUREDESC" "text",
    "FEATUREDEF" "text",
    "FEATUREGROUPID" "text",
    "data_type" "text",
    "units" "text"[],
    "dimension" "text",
    "method_of_measurement" "text",
    "property_value_kind" "text",
    "example" "text",
    "replaced_object_codes" "text"[],
    "replacing_object_codes" "text"[],
    "status" "text",
    "countries_of_use" "text"[],
    "subdivisions_of_use" "text"[],
    "uid" "text",
    "version_date_utc" timestamp with time zone,
    "visual_representation_uri" "text"
);


ALTER TABLE "bsdd"."feature" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."feature" IS 'Contains all bSDD features/properties with enhanced metadata';



COMMENT ON COLUMN "bsdd"."feature"."FEATUREID" IS 'The id of the feature as defined in ETIM standards';



COMMENT ON COLUMN "bsdd"."feature"."FEATUREDESC" IS 'The description of the feature';



COMMENT ON COLUMN "bsdd"."feature"."FEATUREDEF" IS 'The definition or detailed description of the feature';



COMMENT ON COLUMN "bsdd"."feature"."FEATUREGROUPID" IS 'The ID of the feature group this feature belongs to';



COMMENT ON COLUMN "bsdd"."feature"."data_type" IS 'Data type (Real, String, Boolean, Integer)';



COMMENT ON COLUMN "bsdd"."feature"."units" IS 'Array of allowed units of measurement';



COMMENT ON COLUMN "bsdd"."feature"."dimension" IS 'Physical dimension notation (e.g., "1 0 0 0 0 0 0" for length)';



COMMENT ON COLUMN "bsdd"."feature"."property_value_kind" IS 'Value kind (Single, Range, List, Complex)';



CREATE TABLE IF NOT EXISTS "bsdd"."featuregroup" (
    "FEATUREGROUPID" "text" NOT NULL,
    "FEATUREGROUPDESC" "text"
);


ALTER TABLE "bsdd"."featuregroup" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."featuregroup" IS 'Contains all bSDD feature groups that categorize features';



COMMENT ON COLUMN "bsdd"."featuregroup"."FEATUREGROUPID" IS 'Group of features';



COMMENT ON COLUMN "bsdd"."featuregroup"."FEATUREGROUPDESC" IS 'The description of the feature group';



CREATE TABLE IF NOT EXISTS "bsdd"."group" (
    "ARTGROUPID" "text" NOT NULL,
    "GROUPDESC" "text"
);


ALTER TABLE "bsdd"."group" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."group" IS 'Contains all bSDD/ETIM groups';



COMMENT ON COLUMN "bsdd"."group"."ARTGROUPID" IS 'The id of the group in ETIM standards';



COMMENT ON COLUMN "bsdd"."group"."GROUPDESC" IS 'The description of the group';



CREATE TABLE IF NOT EXISTS "bsdd"."unit" (
    "UNITOFMEASID" "text" NOT NULL,
    "UNITDESC" "text",
    "UNITABBREV" "text",
    "DEPRECATED" boolean DEFAULT false
);


ALTER TABLE "bsdd"."unit" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."unit" IS 'Contains all bSDD units of measurement';



COMMENT ON COLUMN "bsdd"."unit"."UNITOFMEASID" IS 'The id of the unit';



COMMENT ON COLUMN "bsdd"."unit"."UNITDESC" IS 'The description of the unit';



COMMENT ON COLUMN "bsdd"."unit"."UNITABBREV" IS 'The unit abbreviation';



COMMENT ON COLUMN "bsdd"."unit"."DEPRECATED" IS 'Whether unit is deprecated or not';



CREATE TABLE IF NOT EXISTS "bsdd"."value" (
    "VALUEID" "text" NOT NULL,
    "VALUEDESC" "text",
    "DEPRECATED" boolean DEFAULT false,
    "REMARK" "text",
    "sort_number" integer
);


ALTER TABLE "bsdd"."value" OWNER TO "postgres";


COMMENT ON TABLE "bsdd"."value" IS 'Contains all values of bSDD/ETIM standard';



COMMENT ON COLUMN "bsdd"."value"."VALUEID" IS 'The id of the value';



COMMENT ON COLUMN "bsdd"."value"."VALUEDESC" IS 'The description of the value';



COMMENT ON COLUMN "bsdd"."value"."DEPRECATED" IS 'Whether value is deprecated or not';



COMMENT ON COLUMN "bsdd"."value"."REMARK" IS 'A remark or definition of the value';



COMMENT ON COLUMN "bsdd"."value"."sort_number" IS 'Sort order for display';



CREATE TABLE IF NOT EXISTS "customers"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "name_en" "text",
    "email" "text",
    "phone" "text",
    "mobile" "text",
    "fax" "text",
    "website" "text",
    "street_address" "text",
    "postal_code" "text",
    "city" "text",
    "region" "text",
    "prefecture" "text",
    "country" "text" DEFAULT 'Greece'::"text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "industry" "text",
    "company_type" "text",
    "size_category" "text",
    "tax_id" "text",
    "notes" "text",
    "data_source" "text" DEFAULT 'csv_import'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "customers_size_category_check" CHECK (("size_category" = ANY (ARRAY['small'::"text", 'medium'::"text", 'large'::"text", 'enterprise'::"text"])))
);


ALTER TABLE "customers"."customers" OWNER TO "postgres";


COMMENT ON TABLE "customers"."customers" IS 'Main customer table with Greek names and LLM-translated English names';



COMMENT ON COLUMN "customers"."customers"."customer_code" IS 'Unique customer code from ERP system (Κωδικός) - no duplicates allowed';



COMMENT ON COLUMN "customers"."customers"."name" IS 'Greek customer name (Επωνυμία)';



COMMENT ON COLUMN "customers"."customers"."name_en" IS 'English translation of customer name (generated by LLM)';



ALTER TABLE "etim"."classfeaturemap" ALTER COLUMN "ARTCLASSFEATURENR" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "etim"."classfeaturemap_ARTCLASSFEATURENR_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "etim"."classfeaturevaluemap" (
    "ARTCLASSFEATUREVALUENR" bigint NOT NULL,
    "ARTCLASSFEATURENR" bigint,
    "VALUEID" "text",
    "SORTNR" bigint
);


ALTER TABLE "etim"."classfeaturevaluemap" OWNER TO "postgres";


COMMENT ON TABLE "etim"."classfeaturevaluemap" IS 'Contains mapping for features that have alphanumeric data. ';



COMMENT ON COLUMN "etim"."classfeaturevaluemap"."ARTCLASSFEATUREVALUENR" IS 'The primary key';



COMMENT ON COLUMN "etim"."classfeaturevaluemap"."ARTCLASSFEATURENR" IS 'The feature that can have several alphanumeric values. It references etim.classfeaturemap';



COMMENT ON COLUMN "etim"."classfeaturevaluemap"."VALUEID" IS 'The id of the value. References etim.value';



COMMENT ON COLUMN "etim"."classfeaturevaluemap"."SORTNR" IS 'Number used for sorting the value to a uniform way';



ALTER TABLE "etim"."classfeaturevaluemap" ALTER COLUMN "ARTCLASSFEATUREVALUENR" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "etim"."classfeaturevaluemap_ARTCLASSFEATUREVALUENR_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "etim"."classynonymmap" (
    "id" bigint NOT NULL,
    "ARTCLASSID" "text" NOT NULL,
    "CLASSSYNONYM" "text" NOT NULL
);


ALTER TABLE "etim"."classynonymmap" OWNER TO "postgres";


COMMENT ON TABLE "etim"."classynonymmap" IS 'The synonyms of classes. Useful when searching class description with similar keywords';



COMMENT ON COLUMN "etim"."classynonymmap"."id" IS 'id for the table';



COMMENT ON COLUMN "etim"."classynonymmap"."ARTCLASSID" IS 'The specific id of the class';



COMMENT ON COLUMN "etim"."classynonymmap"."CLASSSYNONYM" IS 'The synonym of the class';



ALTER TABLE "etim"."classynonymmap" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "etim"."classynonymmap_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE MATERIALIZED VIEW "etim"."feature_value_lookup" AS
 SELECT DISTINCT "f"."FEATUREID" AS "featureid",
    "f"."FEATUREDESC" AS "feature_description",
    "f"."FEATUREDEF" AS "feature_definition",
    "cfm"."FEATURETYPE" AS "feature_type",
    "v"."VALUEID" AS "value_id",
    "v"."VALUEDESC" AS "value_description",
    "u"."UNITOFMEASID" AS "unit_id",
    "u"."UNITABBREV" AS "unit_abbrev",
    "u"."UNITDESC" AS "unit_desc"
   FROM (((("etim"."classfeaturemap" "cfm"
     JOIN "etim"."feature" "f" ON (("cfm"."FEATUREID" = "f"."FEATUREID")))
     LEFT JOIN "etim"."classfeaturevaluemap" "cfvm" ON (("cfvm"."ARTCLASSFEATURENR" = "cfm"."ARTCLASSFEATURENR")))
     LEFT JOIN "etim"."value" "v" ON (("cfvm"."VALUEID" = "v"."VALUEID")))
     LEFT JOIN "etim"."unit" "u" ON (("cfm"."UNITOFMEASID" = "u"."UNITOFMEASID")))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "etim"."feature_value_lookup" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "etim"."llm_optimized_feature_lookup" AS
 WITH "critical_features" AS (
         SELECT "t"."feature_id",
            "t"."priority_group",
            "t"."feature_group_name"
           FROM ( VALUES ('EF005474'::"text",1,'Safety & Protection'::"text"), ('EF000136'::"text",1,'Physical Properties'::"text"), ('EF009347'::"text",1,'Power & Performance'::"text"), ('EF018714'::"text",1,'Light Output'::"text"), ('EF009346'::"text",1,'Light Quality'::"text"), ('EF000137'::"text",1,'Control Features'::"text"), ('EF005905'::"text",1,'Light Source'::"text"), ('EF000004'::"text",2,'Safety & Protection'::"text"), ('EF000008'::"text",2,'Physical Properties'::"text"), ('EF000015'::"text",2,'Physical Properties'::"text"), ('EF000187'::"text",2,'Power & Performance'::"text"), ('EF003118'::"text",2,'Safety & Protection'::"text")) "t"("feature_id", "priority_group", "feature_group_name")
        ), "ip_rating_optimized" AS (
         SELECT "fvl"."featureid",
            "fvl"."feature_description",
            "fvl"."feature_type",
            "fvl"."value_id",
            "fvl"."value_description",
            "fvl"."unit_id",
            "fvl"."unit_abbrev",
            "fvl"."unit_desc",
            "cf"."priority_group",
            "cf"."feature_group_name",
                CASE "fvl"."value_description"
                    WHEN 'IP20'::"text" THEN 1
                    WHEN 'IP40'::"text" THEN 2
                    WHEN 'IP44'::"text" THEN 3
                    WHEN 'IP54'::"text" THEN 4
                    WHEN 'IP65'::"text" THEN 5
                    WHEN 'IP67'::"text" THEN 6
                    WHEN 'IP68'::"text" THEN 7
                    ELSE 99
                END AS "display_order"
           FROM ("etim"."feature_value_lookup" "fvl"
             JOIN "critical_features" "cf" ON (("fvl"."featureid" = "cf"."feature_id")))
          WHERE (("fvl"."featureid" = 'EF005474'::"text") AND ("fvl"."value_description" ~ '^IP[0-9]{2}$'::"text") AND ("fvl"."value_description" = ANY (ARRAY['IP20'::"text", 'IP40'::"text", 'IP44'::"text", 'IP54'::"text", 'IP65'::"text", 'IP67'::"text", 'IP68'::"text"])))
        ), "other_features" AS (
         SELECT "fvl"."featureid",
            "fvl"."feature_description",
            "fvl"."feature_type",
            "fvl"."value_id",
            "fvl"."value_description",
            "fvl"."unit_id",
            "fvl"."unit_abbrev",
            "fvl"."unit_desc",
            "cf"."priority_group",
            "cf"."feature_group_name",
            "row_number"() OVER (PARTITION BY "fvl"."featureid" ORDER BY "fvl"."value_description") AS "display_order"
           FROM ("etim"."feature_value_lookup" "fvl"
             JOIN "critical_features" "cf" ON (("fvl"."featureid" = "cf"."feature_id")))
          WHERE (("fvl"."featureid" <> 'EF005474'::"text") AND ("fvl"."value_description" IS NOT NULL))
        )
 SELECT "ip_rating_optimized"."featureid",
    "ip_rating_optimized"."feature_description",
    "ip_rating_optimized"."feature_type",
    "ip_rating_optimized"."value_id",
    "ip_rating_optimized"."value_description",
    "ip_rating_optimized"."unit_id",
    "ip_rating_optimized"."unit_abbrev",
    "ip_rating_optimized"."unit_desc",
    "ip_rating_optimized"."priority_group",
    "ip_rating_optimized"."feature_group_name",
    "ip_rating_optimized"."display_order"
   FROM "ip_rating_optimized"
UNION ALL
 SELECT "other_features"."featureid",
    "other_features"."feature_description",
    "other_features"."feature_type",
    "other_features"."value_id",
    "other_features"."value_description",
    "other_features"."unit_id",
    "other_features"."unit_abbrev",
    "other_features"."unit_desc",
    "other_features"."priority_group",
    "other_features"."feature_group_name",
    "other_features"."display_order"
   FROM "other_features"
  WHERE ("other_features"."display_order" <= 20)
  ORDER BY 9, 10, 1, 11
  WITH NO DATA;


ALTER MATERIALIZED VIEW "etim"."llm_optimized_feature_lookup" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "items"."catalog_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "items"."catalog_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "items"."catalog_id_seq" OWNED BY "items"."catalog"."id";



CREATE TABLE IF NOT EXISTS "items"."categories" (
    "id" integer NOT NULL,
    "parent_id" integer,
    "name" "text" NOT NULL,
    "description" "text",
    "code" "text" NOT NULL,
    "group_mappings" "text"[],
    "class_mappings" "text"[],
    "feature_mappings" "text"[],
    "label" "text",
    "keywords" "text"[]
);


ALTER TABLE "items"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "items"."category_switches" (
    "id" integer NOT NULL,
    "switch_name" "text" NOT NULL,
    "switch_type" "text" NOT NULL,
    "etim_group_id" "text",
    "etim_class_ids" "text",
    "etim_feature_ids" "text",
    "text_pattern" "text",
    "join_feature_id" "text",
    "join_alias" "text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "category_switches2_switch_type_check" CHECK (("switch_type" = ANY (ARRAY['etim_group'::"text", 'etim_class'::"text", 'etim_feature'::"text", 'text_pattern'::"text", 'combined'::"text", 'placeholder'::"text", 'custom'::"text"])))
);


ALTER TABLE "items"."category_switches" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "items"."category_switches_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "items"."category_switches_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "items"."category_switches_id_seq" OWNED BY "items"."category_switches"."id";



CREATE MATERIALIZED VIEW "items"."gcfv_mapping" AS
 SELECT "group_id",
    "class_id",
    "feature_group_id",
    "feature_id",
    "feature_name",
    "featurec",
    "fvaluec_desc",
    "featuren",
    "featurer",
    "featureb",
    "unit_name",
    "count"(DISTINCT "product_id") AS "product_count",
    "array_agg"("product_id" ORDER BY "sortnr") AS "product_ids"
   FROM ( SELECT "c"."ARTGROUPID" AS "group_id",
            "pd"."class_id",
            "f"."FEATUREGROUPID" AS "feature_group_id",
            "pf"."fname_id" AS "feature_id",
            "f"."FEATUREDESC" AS "feature_name",
            "pf"."fvaluec" AS "featurec",
            COALESCE("v"."VALUEDESC", "pf"."fvaluec") AS "fvaluec_desc",
            "pf"."fvaluen" AS "featuren",
            "pf"."fvaluer" AS "featurer",
            "pf"."fvalueb" AS "featureb",
                CASE
                    WHEN (COALESCE("u"."UNITABBREV", ''::"text") = ''::"text") THEN NULL::"text"
                    ELSE "u"."UNITABBREV"
                END AS "unit_name",
            "pf"."product_id",
            COALESCE("cf"."SORTNR", (9999)::bigint) AS "sortnr"
           FROM ((((((("items"."product_feature" "pf"
             JOIN "items"."product" "p" ON (("pf"."product_id" = "p"."id")))
             JOIN "etim"."feature" "f" ON (("pf"."fname_id" = "f"."FEATUREID")))
             LEFT JOIN "etim"."value" "v" ON (("pf"."fvaluec" = "v"."VALUEID")))
             LEFT JOIN "etim"."unit" "u" ON (("pf"."funit" = "u"."UNITOFMEASID")))
             JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
             JOIN "etim"."class" "c" ON (("pd"."class_id" = "c"."ARTCLASSID")))
             LEFT JOIN "etim"."classfeaturemap" "cf" ON ((("pf"."fname_id" = "cf"."FEATUREID") AND ("pd"."class_id" = "cf"."ARTCLASSID"))))
          WHERE (NOT (("pf"."fvaluec" IS NULL) AND ("pf"."fvaluen" IS NULL) AND ("pf"."fvaluer" IS NULL) AND ("pf"."fvalueb" IS NULL)))) "sorted_data"
  GROUP BY "group_id", "class_id", "feature_group_id", "feature_id", "feature_name", "featurec", "fvaluec_desc", "featuren", "featurer", "featureb", "unit_name"
  ORDER BY ("min"("sortnr"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "items"."gcfv_mapping" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "items"."gcfv_mapping" IS 'View that populates products with group, class, features and their values.';



CREATE MATERIALIZED VIEW "items"."product_categories_mv" AS
 SELECT "p"."id" AS "product_id",
    ("g"."ARTGROUPID" = 'EG000027'::"text") AS "luminaires",
        CASE
            WHEN (("cl"."ARTCLASSID" = ANY ("string_to_array"('EC001744, EC002892'::"text", ', '::"text"))) AND ("pf_ceiling"."fvalueb" = true)) THEN true
            ELSE false
        END AS "ceiling",
    (EXISTS ( SELECT 1
           FROM "items"."product_feature"
          WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF006760'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true)))) AS "ceiling_recessed",
    (EXISTS ( SELECT 1
           FROM "items"."product_feature"
          WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF007793'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true)))) AS "ceiling_surface",
    (EXISTS ( SELECT 1
           FROM "items"."product_feature"
          WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF001265'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true)))) AS "ceiling_suspended",
    (EXISTS ( SELECT 1
           FROM "items"."product_feature"
          WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF006760'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true)))) AS "wall_recessed",
    (EXISTS ( SELECT 1
           FROM "items"."product_feature"
          WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF007793'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true)))) AS "wall_surface",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000758'::"text", ', '::"text"))) AS "floor_recessed",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000301'::"text", ', '::"text"))) AS "floor_surface",
    NULL::boolean AS "decorative",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000302'::"text", ', '::"text"))) AS "decorative_table",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC001743'::"text", ', '::"text"))) AS "decorative_pendant",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000300'::"text", ', '::"text"))) AS "decorative_floorlamps",
    NULL::boolean AS "special",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC002706'::"text", ', '::"text"))) AS "special_strips",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000986'::"text", ', '::"text"))) AS "special_tracks",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000109'::"text", ', '::"text"))) AS "special_batten",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000062'::"text", ', '::"text"))) AS "pole",
        CASE
            WHEN ("pd"."description_long" ~~* '%indoor%'::"text") THEN true
            ELSE false
        END AS "indoor",
        CASE
            WHEN ("pd"."description_long" ~~* '%outdoor%'::"text") THEN true
            ELSE false
        END AS "outdoor",
        CASE
            WHEN ("pd"."description_long" ~~* '%submersible%'::"text") THEN true
            ELSE false
        END AS "submersible",
        CASE
            WHEN ("pd"."description_long" ~~* '%trimless%'::"text") THEN true
            ELSE false
        END AS "trimless",
    ("g"."ARTGROUPID" = 'EG000030'::"text") AS "accessories",
        CASE
            WHEN (("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000758, EC000301, EC000300'::"text", ', '::"text"))) OR (("cl"."ARTCLASSID" = ANY (ARRAY['EC002892'::"text", 'EC000481'::"text"])) AND ("pd"."description_long" ~~* '%%floor%%'::"text"))) THEN true
            ELSE false
        END AS "floor",
        CASE
            WHEN ((("cl"."ARTCLASSID" = 'EC001744'::"text") AND ("pf_wall"."fvalueb" = true)) OR (("cl"."ARTCLASSID" = 'EC002892'::"text") AND ("pf_wall"."fvalueb" = true)) OR ("cl"."ARTCLASSID" = 'EC000481'::"text")) THEN true
            ELSE false
        END AS "wall",
    NULL::boolean AS "tracks",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000101'::"text", ', '::"text"))) AS "tracks_profiles",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000293'::"text", ', '::"text"))) AS "tracks_spares",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC002710'::"text", ', '::"text"))) AS "drivers",
        CASE
            WHEN (("cl"."ARTCLASSID" = ANY ("string_to_array"('EC002710'::"text", ', '::"text"))) AND (EXISTS ( SELECT 1
               FROM "items"."product_feature"
              WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF009471'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true))))) THEN true
            ELSE false
        END AS "drivers_constantcurrent",
        CASE
            WHEN (("cl"."ARTCLASSID" = ANY ("string_to_array"('EC002710'::"text", ', '::"text"))) AND (EXISTS ( SELECT 1
               FROM "items"."product_feature"
              WHERE (("product_feature"."product_id" = "p"."id") AND ("product_feature"."fname_id" = ANY ("string_to_array"('EF009472'::"text", ', '::"text"))) AND ("product_feature"."fvalueb" = true))))) THEN true
            ELSE false
        END AS "drivers_constantvoltage",
    ("g"."ARTGROUPID" = 'EG000028'::"text") AS "lamps",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC001959'::"text", ', '::"text"))) AS "filaments",
    ("cl"."ARTCLASSID" = ANY ("string_to_array"('EC000996'::"text", ', '::"text"))) AS "modules"
   FROM (((((("items"."product" "p"
     JOIN "items"."catalog" "c" ON ((("p"."catalog_id" = "c"."id") AND ("c"."active" = true))))
     JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
     JOIN "etim"."class" "cl" ON (("pd"."class_id" = "cl"."ARTCLASSID")))
     JOIN "etim"."group" "g" ON (("cl"."ARTGROUPID" = "g"."ARTGROUPID")))
     LEFT JOIN "items"."product_feature" "pf_ceiling" ON ((("p"."id" = "pf_ceiling"."product_id") AND ("pf_ceiling"."fname_id" = 'EF021180'::"text"))))
     LEFT JOIN "items"."product_feature" "pf_wall" ON ((("p"."id" = "pf_wall"."product_id") AND ("pf_wall"."fname_id" = 'EF000664'::"text"))))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "items"."product_categories_mv" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "items"."product_custom_feature_group" (
    "id" integer NOT NULL,
    "custom_feature_group" "text" DEFAULT 'Luminaires'::"text" NOT NULL,
    "custom_feature_name" "text" NOT NULL,
    "etim_feature" "text" NOT NULL,
    "etim_feature_name" "text" NOT NULL,
    "active" boolean DEFAULT false NOT NULL,
    "custom_group" "text" NOT NULL,
    "etim_feature_type" "text"
);


ALTER TABLE "items"."product_custom_feature_group" OWNER TO "postgres";


COMMENT ON TABLE "items"."product_custom_feature_group" IS 'Categorizes feature groups according to Foss SA needs';



CREATE SEQUENCE IF NOT EXISTS "items"."product_detail_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "items"."product_detail_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "items"."product_detail_id_seq" OWNED BY "items"."product_detail"."id";



ALTER TABLE "items"."product_feature" ALTER COLUMN "feature_id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "items"."product_feature_feature_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE SEQUENCE IF NOT EXISTS "items"."product_feature_filter_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "items"."product_feature_filter_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "items"."product_feature_filter_id_seq" OWNED BY "items"."product_custom_feature_group"."id";



CREATE MATERIALIZED VIEW "items"."product_feature_group_mapping" AS
 WITH "used_features" AS (
         SELECT DISTINCT "pd"."class_id",
            "pf"."fname_id" AS "feature_id"
           FROM (("items"."product_feature" "pf"
             JOIN "items"."product" "p" ON (("pf"."product_id" = "p"."id")))
             JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
          WHERE ((NOT (("pf"."fvaluec" IS NULL) AND ("pf"."fvaluen" IS NULL) AND ("pf"."fvaluer" IS NULL) AND ("pf"."fvalueb" IS NULL))) AND (("pf"."fvalueb" IS NULL) OR ("pf"."fvalueb" = true)))
        )
 SELECT "c"."ARTCLASSID" AS "class_id",
    "c"."ARTCLASSDESC" AS "class_name",
    "fg"."FEATUREGROUPID" AS "feature_group_id",
    "fg"."FEATUREGROUPDESC" AS "feature_group_name",
    "min"("cfm"."SORTNR") AS "group_sort_order",
    "jsonb_build_object"('L', "jsonb_agg"("jsonb_build_object"('id', "f"."FEATUREID", 'name', "f"."FEATUREDESC", 'sortnr', "cfm"."SORTNR") ORDER BY "cfm"."SORTNR") FILTER (WHERE ("cfm"."FEATURETYPE" = 'L'::"text")), 'N', "jsonb_agg"("jsonb_build_object"('id', "f"."FEATUREID", 'name', "f"."FEATUREDESC", 'unit', "u"."UNITABBREV", 'sortnr', "cfm"."SORTNR", 'used_values', ( SELECT "jsonb_agg"("distinct_vals"."val" ORDER BY (("distinct_vals"."val" ->> 'value'::"text"))::numeric) AS "jsonb_agg"
           FROM ( SELECT DISTINCT "jsonb_build_object"('value', "pf"."fvaluen", 'unit', "pfu"."funit") AS "val"
                   FROM ((("items"."product_feature" "pf"
                     JOIN "items"."product" "p" ON (("pf"."product_id" = "p"."id")))
                     JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
                     LEFT JOIN "items"."product_feature" "pfu" ON ((("pf"."product_id" = "pfu"."product_id") AND ("pf"."fname_id" = "pfu"."fname_id"))))
                  WHERE (("pd"."class_id" = "c"."ARTCLASSID") AND ("pf"."fname_id" = "f"."FEATUREID") AND ("pf"."fvaluen" IS NOT NULL))) "distinct_vals")) ORDER BY "cfm"."SORTNR") FILTER (WHERE ("cfm"."FEATURETYPE" = 'N'::"text")), 'R', "jsonb_agg"("jsonb_build_object"('id', "f"."FEATUREID", 'name', "f"."FEATUREDESC", 'unit', "u"."UNITABBREV", 'sortnr', "cfm"."SORTNR", 'used_values', ( SELECT "jsonb_agg"("distinct_vals"."val" ORDER BY ("distinct_vals"."val" ->> 'value'::"text")) AS "jsonb_agg"
           FROM ( SELECT DISTINCT "jsonb_build_object"('value', "pf"."fvaluer", 'unit', "pfu"."funit") AS "val"
                   FROM ((("items"."product_feature" "pf"
                     JOIN "items"."product" "p" ON (("pf"."product_id" = "p"."id")))
                     JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
                     LEFT JOIN "items"."product_feature" "pfu" ON ((("pf"."product_id" = "pfu"."product_id") AND ("pf"."fname_id" = "pfu"."fname_id"))))
                  WHERE (("pd"."class_id" = "c"."ARTCLASSID") AND ("pf"."fname_id" = "f"."FEATUREID") AND ("pf"."fvaluer" IS NOT NULL))) "distinct_vals")) ORDER BY "cfm"."SORTNR") FILTER (WHERE ("cfm"."FEATURETYPE" = 'R'::"text")), 'A', "jsonb_agg"("jsonb_build_object"('id', "f"."FEATUREID", 'name', "f"."FEATUREDESC", 'sortnr', "cfm"."SORTNR", 'used_values', ( SELECT "jsonb_agg"("distinct_vals"."val" ORDER BY ("distinct_vals"."val" ->> 'value_desc'::"text")) AS "jsonb_agg"
           FROM ( SELECT DISTINCT "jsonb_build_object"('value_id', "pf"."fvaluec", 'value_desc', COALESCE("v"."VALUEDESC", "pf"."fvaluec")) AS "val"
                   FROM ((("items"."product_feature" "pf"
                     JOIN "items"."product" "p" ON (("pf"."product_id" = "p"."id")))
                     JOIN "items"."product_detail" "pd" ON (("p"."id" = "pd"."product_id")))
                     LEFT JOIN "etim"."value" "v" ON (("pf"."fvaluec" = "v"."VALUEID")))
                  WHERE (("pd"."class_id" = "c"."ARTCLASSID") AND ("pf"."fname_id" = "f"."FEATUREID") AND ("pf"."fvaluec" IS NOT NULL))) "distinct_vals")) ORDER BY "cfm"."SORTNR") FILTER (WHERE ("cfm"."FEATURETYPE" = 'A'::"text"))) AS "features_by_type"
   FROM ((((("used_features" "uf"
     JOIN "etim"."class" "c" ON (("uf"."class_id" = "c"."ARTCLASSID")))
     JOIN "etim"."classfeaturemap" "cfm" ON ((("c"."ARTCLASSID" = "cfm"."ARTCLASSID") AND ("uf"."feature_id" = "cfm"."FEATUREID"))))
     JOIN "etim"."feature" "f" ON (("cfm"."FEATUREID" = "f"."FEATUREID")))
     JOIN "etim"."featuregroup" "fg" ON (("f"."FEATUREGROUPID" = "fg"."FEATUREGROUPID")))
     LEFT JOIN "etim"."unit" "u" ON (("cfm"."UNITOFMEASID" = "u"."UNITOFMEASID")))
  GROUP BY "c"."ARTCLASSID", "c"."ARTCLASSDESC", "fg"."FEATUREGROUPID", "fg"."FEATUREGROUPDESC"
  ORDER BY "c"."ARTCLASSID", ("min"("cfm"."SORTNR"))
  WITH NO DATA;


ALTER MATERIALIZED VIEW "items"."product_feature_group_mapping" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "items"."product_features_mv" AS
 SELECT "pf"."product_id",
    "pf"."fname_id" AS "feature_id",
    "pcfg"."custom_feature_group" AS "feature_group",
    "pcfg"."custom_group",
    "pcfg"."custom_feature_name" AS "custom_name",
    "pcfg"."etim_feature_type" AS "feature_type",
        CASE
            WHEN ("pcfg"."etim_feature_type" = 'L'::"text") THEN ("pf"."fvalueb")::"text"
            WHEN (("pcfg"."etim_feature_type" = 'N'::"text") OR ("pcfg"."etim_feature_type" = 'R'::"text")) THEN
            CASE
                WHEN ("pf"."fvaluen" IS NOT NULL) THEN ("pf"."fvaluen")::"text"
                WHEN ("pf"."fvaluer" IS NOT NULL) THEN "lower"(("pf"."fvaluer")::"text")
                ELSE NULL::"text"
            END
            WHEN ("pcfg"."etim_feature_type" = 'A'::"text") THEN "pf"."fvaluec"
            ELSE NULL::"text"
        END AS "feature_value",
        CASE
            WHEN ("pcfg"."etim_feature_type" = 'A'::"text") THEN "fvl"."value_description"
            ELSE NULL::"text"
        END AS "feature_value_description",
    COALESCE("pf"."funit", ''::"text") AS "unit_id",
    "eu"."UNITABBREV" AS "unit_name",
        CASE
            WHEN ("pcfg"."etim_feature_type" = 'L'::"text") THEN
            CASE
                WHEN ("pf"."fvalueb" = true) THEN 'yes'::"text"
                WHEN ("pf"."fvalueb" = false) THEN 'no'::"text"
                ELSE NULL::"text"
            END
            WHEN (("pcfg"."etim_feature_type" = 'N'::"text") OR ("pcfg"."etim_feature_type" = 'R'::"text")) THEN
            CASE
                WHEN ("pf"."fvaluen" IS NOT NULL) THEN ("pf"."fvaluen")::"text"
                WHEN ("pf"."fvaluer" IS NOT NULL) THEN "lower"(("pf"."fvaluer")::"text")
                ELSE NULL::"text"
            END
            WHEN ("pcfg"."etim_feature_type" = 'A'::"text") THEN "lower"(COALESCE("fvl"."value_description", "pf"."fvaluec"))
            ELSE NULL::"text"
        END AS "search_value"
   FROM ((("items"."product_feature" "pf"
     JOIN "items"."product_custom_feature_group" "pcfg" ON (("pf"."fname_id" = "pcfg"."etim_feature")))
     LEFT JOIN "etim"."unit" "eu" ON (("pf"."funit" = "eu"."UNITOFMEASID")))
     LEFT JOIN "etim"."feature_value_lookup" "fvl" ON ((("pf"."fname_id" = "fvl"."featureid") AND ("pf"."fvaluec" = "fvl"."value_id"))))
  WHERE ("pf"."product_id" IN ( SELECT "p"."id"
           FROM ("items"."product" "p"
             JOIN "items"."catalog" "c" ON ((("p"."catalog_id" = "c"."id") AND ("c"."active" = true))))))
  ORDER BY "pf"."product_id", "pcfg"."custom_feature_group", "pcfg"."custom_feature_name"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "items"."product_features_mv" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "items"."product_features_mv" IS 'Stores product features with standardized values and human-readable descriptions for filtering and display';



CREATE TABLE IF NOT EXISTS "items"."product_filter" (
    "id" bigint NOT NULL,
    "filter_name" "text",
    "sql_snippet" "text",
    "sql_description" "text"
);


ALTER TABLE "items"."product_filter" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "items"."product_search_index" (
    "product_id" "uuid" NOT NULL,
    "foss_pid" "text" NOT NULL,
    "search_vector" "tsvector" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "items"."product_search_index" OWNER TO "postgres";


COMMENT ON TABLE "items"."product_search_index" IS 'Full-text search index for products. Populated from product_info matview.';



COMMENT ON COLUMN "items"."product_search_index"."search_vector" IS 'Weighted tsvector: A=foss_pid/mpn, B=description_short, C=description_long/family, D=supplier/class';



CREATE SEQUENCE IF NOT EXISTS "items"."product_udx_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "items"."product_udx_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "items"."product_udx_id_seq" OWNED BY "items"."product_udx"."id";



CREATE SEQUENCE IF NOT EXISTS "items"."supplier_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "items"."supplier_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "items"."supplier_id_seq" OWNED BY "items"."supplier"."id";



CREATE TABLE IF NOT EXISTS "projects"."project_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "contact_type" "text" NOT NULL,
    "name" "text" NOT NULL,
    "company" "text",
    "email" "text",
    "phone" "text",
    "mobile" "text",
    "role" "text",
    "is_primary" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_contacts_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['architect'::"text", 'engineer'::"text", 'contractor'::"text", 'owner'::"text", 'facility_manager'::"text", 'other'::"text"])))
);


ALTER TABLE "projects"."project_contacts" OWNER TO "postgres";


COMMENT ON TABLE "projects"."project_contacts" IS 'Additional contacts associated with projects';



CREATE TABLE IF NOT EXISTS "projects"."project_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "file_path" "text",
    "file_url" "text",
    "mime_type" "text",
    "file_size_bytes" bigint,
    "version" "text" DEFAULT '1.0'::"text",
    "is_latest" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    CONSTRAINT "project_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['quotation'::"text", 'drawing'::"text", 'specification'::"text", 'calculation'::"text", 'photo'::"text", 'contract'::"text", 'invoice'::"text", 'other'::"text"])))
);


ALTER TABLE "projects"."project_documents" OWNER TO "postgres";


COMMENT ON TABLE "projects"."project_documents" IS 'Documents associated with projects (drawings, specs, quotes, etc.)';



COMMENT ON COLUMN "projects"."project_documents"."file_path" IS 'Path in Supabase storage bucket';



COMMENT ON COLUMN "projects"."project_documents"."file_url" IS 'External URL or Google Drive link';



COMMENT ON COLUMN "projects"."project_documents"."created_by" IS 'User email from NextAuth';



CREATE TABLE IF NOT EXISTS "projects"."project_phases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "phase_number" integer NOT NULL,
    "phase_name" "text" NOT NULL,
    "description" "text",
    "budget" numeric,
    "status" "text" DEFAULT 'planned'::"text",
    "start_date" "date",
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_phases_status_check" CHECK (("status" = ANY (ARRAY['planned'::"text", 'active'::"text", 'completed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "projects"."project_phases" OWNER TO "postgres";


COMMENT ON TABLE "projects"."project_phases" IS 'Project phases for multi-phase lighting projects';



CREATE TABLE IF NOT EXISTS "projects"."project_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric,
    "discount_percent" numeric DEFAULT 0,
    "total_price" numeric GENERATED ALWAYS AS (((("quantity")::numeric * "unit_price") * ((1)::numeric - ("discount_percent" / (100)::numeric)))) STORED,
    "room_location" "text",
    "mounting_height" numeric,
    "notes" "text",
    "status" "text" DEFAULT 'specified'::"text",
    "added_at" timestamp with time zone DEFAULT "now"(),
    "added_by" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "project_products_discount_percent_check" CHECK ((("discount_percent" >= (0)::numeric) AND ("discount_percent" <= (100)::numeric))),
    CONSTRAINT "project_products_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "project_products_status_check" CHECK (("status" = ANY (ARRAY['specified'::"text", 'quoted'::"text", 'ordered'::"text", 'delivered'::"text", 'installed'::"text"])))
);


ALTER TABLE "projects"."project_products" OWNER TO "postgres";


COMMENT ON TABLE "projects"."project_products" IS 'Junction table linking projects to products with quantities and specifications';



COMMENT ON COLUMN "projects"."project_products"."room_location" IS 'Living Room, Bedroom 1, Corridor, etc.';



COMMENT ON COLUMN "projects"."project_products"."mounting_height" IS 'Mounting height in meters';



COMMENT ON COLUMN "projects"."project_products"."added_by" IS 'User email from NextAuth';



CREATE TABLE IF NOT EXISTS "projects"."project_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "google_drive_folder_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "notes" "text",
    CONSTRAINT "positive_version" CHECK (("version_number" > 0))
);


ALTER TABLE "projects"."project_versions" OWNER TO "postgres";


COMMENT ON TABLE "projects"."project_versions" IS 'Project version tracking. RLS enabled. App uses service_role (bypasses RLS). Direct API access requires authenticated role.';



CREATE TABLE IF NOT EXISTS "projects"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "name_en" "text",
    "description" "text",
    "customer_id" "uuid",
    "street_address" "text",
    "postal_code" "text",
    "city" "text",
    "region" "text",
    "prefecture" "text",
    "country" "text" DEFAULT 'Greece'::"text",
    "latitude" numeric,
    "longitude" numeric,
    "project_type" "text",
    "project_category" "text",
    "building_area_sqm" numeric,
    "estimated_budget" numeric,
    "currency" "text" DEFAULT 'EUR'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "priority" "text" DEFAULT 'medium'::"text",
    "start_date" "date",
    "expected_completion_date" "date",
    "actual_completion_date" "date",
    "project_manager" "text",
    "architect_firm" "text",
    "electrical_engineer" "text",
    "lighting_designer" "text",
    "notes" "text",
    "tags" "text"[],
    "data_source" "text" DEFAULT 'manual_entry'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "text",
    "google_drive_folder_id" "text",
    "current_version" integer DEFAULT 1,
    "is_archived" boolean DEFAULT false,
    "oss_bucket" "text",
    "floor_plan_urn" "text",
    "floor_plan_filename" "text",
    "floor_plan_hash" "text",
    CONSTRAINT "projects_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'urgent'::"text"]))),
    CONSTRAINT "projects_project_type_check" CHECK ((("project_type" IS NULL) OR ("project_type" = ANY (ARRAY['residential'::"text", 'commercial'::"text", 'industrial'::"text", 'public'::"text", 'hospitality'::"text", 'retail'::"text", 'office'::"text", 'outdoor'::"text", 'healthcare'::"text", 'education'::"text", 'cultural'::"text", 'other'::"text"])))),
    CONSTRAINT "projects_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'quotation'::"text", 'approved'::"text", 'in_progress'::"text", 'completed'::"text", 'cancelled'::"text", 'on_hold'::"text"])))
);


ALTER TABLE "projects"."projects" OWNER TO "postgres";


COMMENT ON TABLE "projects"."projects" IS 'Project management. RLS enabled - only accessible via service_role (server-side).';



COMMENT ON COLUMN "projects"."projects"."customer_id" IS 'Reference to customer who owns this project';



COMMENT ON COLUMN "projects"."projects"."project_category" IS 'Hotel, Office Building, Shopping Mall, etc.';



COMMENT ON COLUMN "projects"."projects"."project_manager" IS 'User email from NextAuth';



COMMENT ON COLUMN "projects"."projects"."created_by" IS 'User email from NextAuth';



COMMENT ON COLUMN "projects"."projects"."google_drive_folder_id" IS 'Google Drive folder ID for project root folder';



COMMENT ON COLUMN "projects"."projects"."current_version" IS 'Currently active version number';



COMMENT ON COLUMN "projects"."projects"."is_archived" IS 'TRUE if project has been archived/deleted';



COMMENT ON COLUMN "projects"."projects"."oss_bucket" IS 'APS OSS bucket name for this project (format: fossapp_prj_{id})';



COMMENT ON COLUMN "projects"."projects"."floor_plan_urn" IS 'APS URN for the translated floor plan SVF2';



COMMENT ON COLUMN "projects"."projects"."floor_plan_filename" IS 'Original DWG filename';



COMMENT ON COLUMN "projects"."projects"."floor_plan_hash" IS 'SHA256 hash of DWG file for duplicate detection';



CREATE TABLE IF NOT EXISTS "public"."n8n_chat_histories" (
    "id" integer NOT NULL,
    "session_id" character varying(255) NOT NULL,
    "message" "jsonb" NOT NULL
);


ALTER TABLE "public"."n8n_chat_histories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."n8n_chat_histories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."n8n_chat_histories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."n8n_chat_histories_id_seq" OWNED BY "public"."n8n_chat_histories"."id";



CREATE TABLE IF NOT EXISTS "public"."n8n_rag" (
    "id" bigint NOT NULL,
    "content" "text",
    "metadata" "jsonb",
    "embedding" "extensions"."vector"(1536)
);


ALTER TABLE "public"."n8n_rag" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."n8n_rag_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."n8n_rag_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."n8n_rag_id_seq" OWNED BY "public"."n8n_rag"."id";



CREATE TABLE IF NOT EXISTS "rag"."etim_rag" (
    "id" integer NOT NULL,
    "class_id" "text" NOT NULL,
    "product_text" "text" NOT NULL,
    "product_name" "text",
    "manufacturer" "text",
    "article_number" "text",
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source" "text",
    "validated_by" "text",
    "extraction_date" "date",
    "extraction_rate" numeric(5,4),
    "validation_accuracy" numeric(5,4),
    "notes" "text",
    "embedding" "extensions"."vector"(1536),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "rag"."etim_rag" OWNER TO "postgres";


COMMENT ON TABLE "rag"."etim_rag" IS 'RAG training data for ETIM feature extraction with vector embeddings for semantic search';



CREATE SEQUENCE IF NOT EXISTS "rag"."etim_rag_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "rag"."etim_rag_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "rag"."etim_rag_id_seq" OWNED BY "rag"."etim_rag"."id";



CREATE TABLE IF NOT EXISTS "retool"."buckets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "user_name" "text" NOT NULL,
    "product_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "retool"."buckets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "search"."audit_log" (
    "id" integer NOT NULL,
    "table_name" "text" NOT NULL,
    "operation" "text" NOT NULL,
    "record_id" "text" NOT NULL,
    "old_data" "jsonb",
    "new_data" "jsonb",
    "changed_by" "text" NOT NULL,
    "changed_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "search"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "search"."audit_log" IS 'Tracks all changes made to taxonomy and classification rules';



CREATE SEQUENCE IF NOT EXISTS "search"."audit_log_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "search"."audit_log_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "search"."audit_log_id_seq" OWNED BY "search"."audit_log"."id";



CREATE TABLE IF NOT EXISTS "search"."classification_rules" (
    "id" integer NOT NULL,
    "rule_name" "text" NOT NULL,
    "description" "text",
    "taxonomy_code" "text",
    "flag_name" "text",
    "priority" integer DEFAULT 100,
    "etim_group_ids" "text"[],
    "etim_class_ids" "text"[],
    "etim_feature_conditions" "jsonb",
    "text_pattern" "text",
    "active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "search"."classification_rules" OWNER TO "postgres";


COMMENT ON TABLE "search"."classification_rules" IS 'Configuration-driven rules for product classification. Applied to populate product_taxonomy_flags.';



CREATE SEQUENCE IF NOT EXISTS "search"."classification_rules_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "search"."classification_rules_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "search"."classification_rules_id_seq" OWNED BY "search"."classification_rules"."id";



CREATE SEQUENCE IF NOT EXISTS "search"."filter_definitions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "search"."filter_definitions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "search"."filter_definitions_id_seq" OWNED BY "search"."filter_definitions"."id";



CREATE MATERIALIZED VIEW "search"."product_filter_index" AS
 SELECT "row_number"() OVER () AS "id",
    "pf"."product_id",
    "fd"."filter_key",
    "fd"."filter_type",
    COALESCE(("pf"."fvaluen")::numeric, (("lower"("pf"."fvaluer") + "upper"("pf"."fvaluer")) / 2.0)) AS "numeric_value",
    COALESCE("v"."VALUEDESC", "pf"."fvaluec") AS "alphanumeric_value",
    "pf"."fvalueb" AS "boolean_value",
    "lower"("pf"."fvaluer") AS "numeric_min",
    "upper"("pf"."fvaluer") AS "numeric_max",
    "pf"."fname_id" AS "source_feature_id",
    "now"() AS "created_at"
   FROM (((((("items"."product_feature" "pf"
     JOIN "search"."filter_definitions" "fd" ON ((("fd"."etim_feature_id" = "pf"."fname_id") AND ("fd"."active" = true))))
     JOIN "items"."product" "p" ON (("p"."id" = "pf"."product_id")))
     JOIN "items"."catalog" "c" ON ((("c"."id" = "p"."catalog_id") AND ("c"."active" = true))))
     JOIN "items"."product_detail" "pd" ON (("pd"."product_id" = "p"."id")))
     JOIN "etim"."class" "ec" ON ((("ec"."ARTCLASSID" = "pd"."class_id") AND ("ec"."ARTGROUPID" = 'EG000027'::"text"))))
     LEFT JOIN "etim"."value" "v" ON (("v"."VALUEID" = "pf"."fvaluec")))
  WHERE (("pf"."fvaluen" IS NOT NULL) OR ("pf"."fvaluec" IS NOT NULL) OR ("pf"."fvalueb" IS NOT NULL) OR ("pf"."fvaluer" IS NOT NULL))
UNION ALL
 SELECT "row_number"() OVER () AS "id",
    "pi"."product_id",
    'supplier'::"text" AS "filter_key",
    'alphanumeric'::"text" AS "filter_type",
    NULL::numeric AS "numeric_value",
    "pi"."supplier_name" AS "alphanumeric_value",
    NULL::boolean AS "boolean_value",
    NULL::numeric AS "numeric_min",
    NULL::numeric AS "numeric_max",
    'META-supplier'::"text" AS "source_feature_id",
    "now"() AS "created_at"
   FROM "items"."product_info" "pi"
  WHERE ("pi"."supplier_name" IS NOT NULL)
  WITH NO DATA;


ALTER MATERIALIZED VIEW "search"."product_filter_index" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "search"."product_filter_index" IS 'Product filter index for search. Access restricted to service_role only.';



CREATE MATERIALIZED VIEW "search"."product_taxonomy_flags" AS
 SELECT "product_id",
    "foss_pid",
    "taxonomy_path",
    "luminaire",
    "lamp",
    "driver",
    "accessory",
    "indoor",
    "outdoor",
    "submersible",
    "trimless",
    "cut_shape_round",
    "cut_shape_rectangular",
    "ceiling",
    "wall",
    "floor",
    "recessed",
    "surface_mounted",
    "suspended",
    "ceiling_recessed",
    "ceiling_surface",
    "ceiling_suspended",
    "wall_recessed",
    "wall_surface",
    "floor_recessed",
    "floor_surface",
    "decorative_table",
    "decorative_pendant",
    "decorative_floor",
    "led_strip",
    "track_system",
    "batten",
    "pole_mounted",
    "constant_current",
    "constant_voltage",
    "driver_accessory",
    "filament",
    "led_module",
    "dimmable",
    "accessory_track",
    "accessory_strip",
    "accessory_pole",
    "accessory_optics",
    "accessory_electrical",
    "accessory_mechanical",
    "track_profile",
    "track_spare",
    "optics_lens",
    "electrical_boxes",
    "electrical_connectors",
    "mechanical_kits",
    ("decorative_table" OR "decorative_pendant" OR "decorative_floor") AS "decorative",
    ("led_strip" OR "track_system" OR "batten" OR "pole_mounted") AS "special"
   FROM ( WITH "product_classifications" AS (
                 SELECT DISTINCT "pi"."product_id",
                    "pi"."foss_pid",
                    "cr"."taxonomy_code",
                    "cr"."flag_name"
                   FROM ("items"."product_info" "pi"
                     CROSS JOIN "search"."classification_rules" "cr")
                  WHERE (("cr"."active" = true) AND ((("cr"."etim_group_ids" IS NOT NULL) AND ("pi"."group" = ANY ("cr"."etim_group_ids"))) OR (("cr"."etim_class_ids" IS NOT NULL) AND ("pi"."class" = ANY ("cr"."etim_class_ids"))) OR (("cr"."etim_feature_conditions" IS NOT NULL) AND (EXISTS ( SELECT 1
                           FROM "jsonb_array_elements"("pi"."features") "f"("value")
                          WHERE "search"."evaluate_feature_condition"("f"."value", "cr"."etim_feature_conditions")))) OR (("cr"."text_pattern" IS NOT NULL) AND (("pi"."description_short" ~* "cr"."text_pattern") OR ("pi"."description_long" ~* "cr"."text_pattern")))))
                ), "product_taxonomy_paths" AS (
                 SELECT "pc_1"."product_id",
                    "array_agg"(DISTINCT "ancestor"."ancestor" ORDER BY "ancestor"."ancestor") FILTER (WHERE ("ancestor"."ancestor" <> 'ROOT'::"text")) AS "taxonomy_path"
                   FROM ("product_classifications" "pc_1"
                     CROSS JOIN LATERAL "unnest"("search"."get_taxonomy_ancestors"("pc_1"."taxonomy_code")) "ancestor"("ancestor"))
                  GROUP BY "pc_1"."product_id"
                )
         SELECT "pc"."product_id",
            "pc"."foss_pid",
            "ptp"."taxonomy_path",
            "bool_or"(("pc"."flag_name" = 'luminaire'::"text")) AS "luminaire",
            "bool_or"(("pc"."flag_name" = 'lamp'::"text")) AS "lamp",
            "bool_or"(("pc"."flag_name" = 'driver'::"text")) AS "driver",
            "bool_or"(("pc"."flag_name" = 'accessory'::"text")) AS "accessory",
            "bool_or"(("pc"."flag_name" = 'indoor'::"text")) AS "indoor",
            "bool_or"(("pc"."flag_name" = 'outdoor'::"text")) AS "outdoor",
            "bool_or"(("pc"."flag_name" = 'submersible'::"text")) AS "submersible",
            "bool_or"(("pc"."flag_name" = 'trimless'::"text")) AS "trimless",
            "bool_or"(("pc"."flag_name" = 'cut_shape_round'::"text")) AS "cut_shape_round",
            "bool_or"(("pc"."flag_name" = 'cut_shape_rectangular'::"text")) AS "cut_shape_rectangular",
            "bool_or"(("pc"."flag_name" = 'ceiling'::"text")) AS "ceiling",
            "bool_or"(("pc"."flag_name" = 'wall'::"text")) AS "wall",
            "bool_or"(("pc"."flag_name" = 'floor'::"text")) AS "floor",
            "bool_or"(("pc"."flag_name" = 'recessed'::"text")) AS "recessed",
            "bool_or"(("pc"."flag_name" = 'surface_mounted'::"text")) AS "surface_mounted",
            "bool_or"(("pc"."flag_name" = 'suspended'::"text")) AS "suspended",
            "bool_or"(("pc"."flag_name" = 'ceiling_recessed'::"text")) AS "ceiling_recessed",
            "bool_or"(("pc"."flag_name" = 'ceiling_surface'::"text")) AS "ceiling_surface",
            "bool_or"(("pc"."flag_name" = 'ceiling_suspended'::"text")) AS "ceiling_suspended",
            "bool_or"(("pc"."flag_name" = 'wall_recessed'::"text")) AS "wall_recessed",
            "bool_or"(("pc"."flag_name" = 'wall_surface'::"text")) AS "wall_surface",
            "bool_or"(("pc"."flag_name" = 'floor_recessed'::"text")) AS "floor_recessed",
            "bool_or"(("pc"."flag_name" = 'floor_surface'::"text")) AS "floor_surface",
            "bool_or"(("pc"."flag_name" = 'decorative_table'::"text")) AS "decorative_table",
            "bool_or"(("pc"."flag_name" = 'decorative_pendant'::"text")) AS "decorative_pendant",
            "bool_or"(("pc"."flag_name" = 'decorative_floor'::"text")) AS "decorative_floor",
            "bool_or"(("pc"."flag_name" = 'led_strip'::"text")) AS "led_strip",
            "bool_or"(("pc"."flag_name" = 'track_system'::"text")) AS "track_system",
            "bool_or"(("pc"."flag_name" = 'batten'::"text")) AS "batten",
            "bool_or"(("pc"."flag_name" = 'pole_mounted'::"text")) AS "pole_mounted",
            "bool_or"(("pc"."flag_name" = 'constant_current'::"text")) AS "constant_current",
            "bool_or"(("pc"."flag_name" = 'constant_voltage'::"text")) AS "constant_voltage",
            "bool_or"(("pc"."flag_name" = 'driver_accessory'::"text")) AS "driver_accessory",
            "bool_or"(("pc"."flag_name" = 'filament'::"text")) AS "filament",
            "bool_or"(("pc"."flag_name" = 'led_module'::"text")) AS "led_module",
            "bool_or"(("pc"."flag_name" = 'dimmable'::"text")) AS "dimmable",
            "bool_or"(("pc"."flag_name" = 'accessory_track'::"text")) AS "accessory_track",
            "bool_or"(("pc"."flag_name" = 'accessory_strip'::"text")) AS "accessory_strip",
            "bool_or"(("pc"."flag_name" = 'accessory_pole'::"text")) AS "accessory_pole",
            "bool_or"(("pc"."flag_name" = 'accessory_optics'::"text")) AS "accessory_optics",
            "bool_or"(("pc"."flag_name" = 'accessory_electrical'::"text")) AS "accessory_electrical",
            "bool_or"(("pc"."flag_name" = 'accessory_mechanical'::"text")) AS "accessory_mechanical",
            "bool_or"(("pc"."flag_name" = 'track_profile'::"text")) AS "track_profile",
            "bool_or"(("pc"."flag_name" = 'track_spare'::"text")) AS "track_spare",
            "bool_or"(("pc"."flag_name" = 'optics_lens'::"text")) AS "optics_lens",
            "bool_or"(("pc"."flag_name" = 'electrical_boxes'::"text")) AS "electrical_boxes",
            "bool_or"(("pc"."flag_name" = 'electrical_connectors'::"text")) AS "electrical_connectors",
            "bool_or"(("pc"."flag_name" = 'mechanical_kits'::"text")) AS "mechanical_kits"
           FROM ("product_classifications" "pc"
             JOIN "product_taxonomy_paths" "ptp" ON (("ptp"."product_id" = "pc"."product_id")))
          GROUP BY "pc"."product_id", "pc"."foss_pid", "ptp"."taxonomy_path") "base"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "search"."product_taxonomy_flags" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "search"."product_taxonomy_flags" IS 'Product taxonomy flags for filtering. Access restricted to service_role only.';



CREATE TABLE IF NOT EXISTS "search"."taxonomy" (
    "id" integer NOT NULL,
    "code" "text" NOT NULL,
    "parent_code" "text",
    "level" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "display_order" integer DEFAULT 0,
    "active" boolean DEFAULT true,
    "full_path" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "search"."taxonomy" OWNER TO "postgres";


COMMENT ON TABLE "search"."taxonomy" IS 'Hierarchical product taxonomy for navigation. Maps business-friendly categories
to technical ETIM classifications via classification_rules. English only.';



COMMENT ON COLUMN "search"."taxonomy"."code" IS 'Unique taxonomy code (e.g., LUM_CEIL_REC for Luminaires > Ceiling > Recessed)';



COMMENT ON COLUMN "search"."taxonomy"."level" IS '0=root, 1=main category, 2=subcategory, 3=type';



COMMENT ON COLUMN "search"."taxonomy"."icon" IS 'Lucide React icon name (e.g., "Lightbulb", "Zap", "Package"). See https://lucide.dev for available icons.';



COMMENT ON COLUMN "search"."taxonomy"."full_path" IS 'Array of codes from root to current node';



CREATE SEQUENCE IF NOT EXISTS "search"."taxonomy_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "search"."taxonomy_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "search"."taxonomy_id_seq" OWNED BY "search"."taxonomy"."id";



ALTER TABLE ONLY "analytics"."user_groups" ALTER COLUMN "id" SET DEFAULT "nextval"('"analytics"."user_groups_id_seq"'::"regclass");



ALTER TABLE ONLY "bsdd"."classfeaturemap" ALTER COLUMN "ARTCLASSFEATURENR" SET DEFAULT "nextval"('"bsdd"."classfeaturemap_ARTCLASSFEATURENR_seq"'::"regclass");



ALTER TABLE ONLY "bsdd"."classfeaturevaluemap" ALTER COLUMN "ARTCLASSFEATUREVALUENR" SET DEFAULT "nextval"('"bsdd"."classfeaturevaluemap_ARTCLASSFEATUREVALUENR_seq"'::"regclass");



ALTER TABLE ONLY "bsdd"."classynonymmap" ALTER COLUMN "id" SET DEFAULT "nextval"('"bsdd"."classynonymmap_id_seq"'::"regclass");



ALTER TABLE ONLY "items"."catalog" ALTER COLUMN "id" SET DEFAULT "nextval"('"items"."catalog_id_seq"'::"regclass");



ALTER TABLE ONLY "items"."category_switches" ALTER COLUMN "id" SET DEFAULT "nextval"('"items"."category_switches_id_seq"'::"regclass");



ALTER TABLE ONLY "items"."product_custom_feature_group" ALTER COLUMN "id" SET DEFAULT "nextval"('"items"."product_feature_filter_id_seq"'::"regclass");



ALTER TABLE ONLY "items"."product_detail" ALTER COLUMN "id" SET DEFAULT "nextval"('"items"."product_detail_id_seq"'::"regclass");



ALTER TABLE ONLY "items"."product_udx" ALTER COLUMN "id" SET DEFAULT "nextval"('"items"."product_udx_id_seq"'::"regclass");



ALTER TABLE ONLY "items"."supplier" ALTER COLUMN "id" SET DEFAULT "nextval"('"items"."supplier_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."n8n_chat_histories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."n8n_chat_histories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."n8n_rag" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."n8n_rag_id_seq"'::"regclass");



ALTER TABLE ONLY "rag"."etim_rag" ALTER COLUMN "id" SET DEFAULT "nextval"('"rag"."etim_rag_id_seq"'::"regclass");



ALTER TABLE ONLY "search"."audit_log" ALTER COLUMN "id" SET DEFAULT "nextval"('"search"."audit_log_id_seq"'::"regclass");



ALTER TABLE ONLY "search"."classification_rules" ALTER COLUMN "id" SET DEFAULT "nextval"('"search"."classification_rules_id_seq"'::"regclass");



ALTER TABLE ONLY "search"."filter_definitions" ALTER COLUMN "id" SET DEFAULT "nextval"('"search"."filter_definitions_id_seq"'::"regclass");



ALTER TABLE ONLY "search"."taxonomy" ALTER COLUMN "id" SET DEFAULT "nextval"('"search"."taxonomy_id_seq"'::"regclass");



ALTER TABLE ONLY "analytics"."user_events"
    ADD CONSTRAINT "user_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."user_groups"
    ADD CONSTRAINT "user_groups_name_key" UNIQUE ("name");



ALTER TABLE ONLY "analytics"."user_groups"
    ADD CONSTRAINT "user_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "analytics"."user_settings"
    ADD CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "analytics"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "analytics"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "bsdd"."class"
    ADD CONSTRAINT "class_pkey" PRIMARY KEY ("ARTCLASSID");



ALTER TABLE ONLY "bsdd"."classfeaturemap"
    ADD CONSTRAINT "classfeaturemap_pkey" PRIMARY KEY ("ARTCLASSFEATURENR");



ALTER TABLE ONLY "bsdd"."classfeaturevaluemap"
    ADD CONSTRAINT "classfeaturevaluemap_pkey" PRIMARY KEY ("ARTCLASSFEATUREVALUENR");



ALTER TABLE ONLY "bsdd"."classynonymmap"
    ADD CONSTRAINT "classynonymmap_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "bsdd"."feature"
    ADD CONSTRAINT "feature_pkey" PRIMARY KEY ("FEATUREID");



ALTER TABLE ONLY "bsdd"."featuregroup"
    ADD CONSTRAINT "featuregroup_pkey" PRIMARY KEY ("FEATUREGROUPID");



ALTER TABLE ONLY "bsdd"."group"
    ADD CONSTRAINT "group_pkey" PRIMARY KEY ("ARTGROUPID");



ALTER TABLE ONLY "bsdd"."unit"
    ADD CONSTRAINT "unit_pkey" PRIMARY KEY ("UNITOFMEASID");



ALTER TABLE ONLY "bsdd"."value"
    ADD CONSTRAINT "value_pkey" PRIMARY KEY ("VALUEID");



ALTER TABLE ONLY "customers"."customers"
    ADD CONSTRAINT "customers_customer_code_key" UNIQUE ("customer_code");



ALTER TABLE ONLY "customers"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "etim"."class"
    ADD CONSTRAINT "class_pkey" PRIMARY KEY ("ARTCLASSID");



ALTER TABLE ONLY "etim"."classfeaturemap"
    ADD CONSTRAINT "classfeaturemap_pkey" PRIMARY KEY ("ARTCLASSFEATURENR");



ALTER TABLE ONLY "etim"."classfeaturevaluemap"
    ADD CONSTRAINT "classfeaturevaluemap_pkey" PRIMARY KEY ("ARTCLASSFEATUREVALUENR");



ALTER TABLE ONLY "etim"."classynonymmap"
    ADD CONSTRAINT "classynonymmap_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "etim"."feature"
    ADD CONSTRAINT "feature_pkey" PRIMARY KEY ("FEATUREID");



ALTER TABLE ONLY "etim"."featuregroup"
    ADD CONSTRAINT "featuregroup_pkey" PRIMARY KEY ("FEATUREGROUPID");



ALTER TABLE ONLY "etim"."group"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("ARTGROUPID");



ALTER TABLE ONLY "etim"."classynonymmap"
    ADD CONSTRAINT "unique_class_synonym" UNIQUE ("ARTCLASSID", "CLASSSYNONYM");



ALTER TABLE ONLY "etim"."unit"
    ADD CONSTRAINT "unit_pkey" PRIMARY KEY ("UNITOFMEASID");



ALTER TABLE ONLY "etim"."value"
    ADD CONSTRAINT "value_pkey" PRIMARY KEY ("VALUEID");



ALTER TABLE ONLY "items"."catalog"
    ADD CONSTRAINT "catalog_catalog_id_key" UNIQUE ("catalog_id");



ALTER TABLE ONLY "items"."catalog"
    ADD CONSTRAINT "catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."categories"
    ADD CONSTRAINT "categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "items"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."category_switches"
    ADD CONSTRAINT "category_switches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."category_switches"
    ADD CONSTRAINT "category_switches_switch_name_key" UNIQUE ("switch_name");



ALTER TABLE ONLY "items"."price_catalog"
    ADD CONSTRAINT "price_catalog_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."product_custom_feature_group"
    ADD CONSTRAINT "product_custom_feature_group_etim_feature_key" UNIQUE ("etim_feature");



ALTER TABLE ONLY "items"."product_detail"
    ADD CONSTRAINT "product_detail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."product_custom_feature_group"
    ADD CONSTRAINT "product_feature_filter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."product_feature"
    ADD CONSTRAINT "product_feature_pkey" PRIMARY KEY ("feature_id");



ALTER TABLE ONLY "items"."product_filter"
    ADD CONSTRAINT "product_filter_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."product"
    ADD CONSTRAINT "product_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."product_search_index"
    ADD CONSTRAINT "product_search_index_pkey" PRIMARY KEY ("product_id");



ALTER TABLE ONLY "items"."product_udx"
    ADD CONSTRAINT "product_udx_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "items"."product"
    ADD CONSTRAINT "product_unique_foss_pid_catalog" UNIQUE ("foss_pid", "catalog_id");



ALTER TABLE ONLY "items"."supplier"
    ADD CONSTRAINT "supplier_code_key" UNIQUE ("code");



ALTER TABLE ONLY "items"."supplier"
    ADD CONSTRAINT "supplier_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."project_contacts"
    ADD CONSTRAINT "project_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."project_documents"
    ADD CONSTRAINT "project_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."project_phases"
    ADD CONSTRAINT "project_phases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."project_phases"
    ADD CONSTRAINT "project_phases_project_id_phase_number_key" UNIQUE ("project_id", "phase_number");



ALTER TABLE ONLY "projects"."project_products"
    ADD CONSTRAINT "project_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."project_products"
    ADD CONSTRAINT "project_products_project_id_product_id_room_location_key" UNIQUE ("project_id", "product_id", "room_location");



ALTER TABLE ONLY "projects"."project_versions"
    ADD CONSTRAINT "project_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "projects"."projects"
    ADD CONSTRAINT "projects_project_code_key" UNIQUE ("project_code");



ALTER TABLE ONLY "projects"."project_versions"
    ADD CONSTRAINT "unique_project_version" UNIQUE ("project_id", "version_number");



ALTER TABLE ONLY "public"."n8n_chat_histories"
    ADD CONSTRAINT "n8n_chat_histories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."n8n_rag"
    ADD CONSTRAINT "n8n_rag_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "rag"."etim_rag"
    ADD CONSTRAINT "etim_rag_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "retool"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "search"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "search"."classification_rules"
    ADD CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "search"."classification_rules"
    ADD CONSTRAINT "classification_rules_rule_name_key" UNIQUE ("rule_name");



ALTER TABLE ONLY "search"."filter_definitions"
    ADD CONSTRAINT "filter_definitions_filter_key_key" UNIQUE ("filter_key");



ALTER TABLE ONLY "search"."filter_definitions"
    ADD CONSTRAINT "filter_definitions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "search"."taxonomy"
    ADD CONSTRAINT "taxonomy_code_key" UNIQUE ("code");



ALTER TABLE ONLY "search"."taxonomy"
    ADD CONSTRAINT "taxonomy_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_analytics_users_group_id" ON "analytics"."users" USING "btree" ("group_id");



CREATE INDEX "idx_user_events_created_at" ON "analytics"."user_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_user_events_user_time" ON "analytics"."user_events" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_users_email" ON "analytics"."users" USING "btree" ("email");



CREATE INDEX "idx_bsdd_class_artgroupid" ON "bsdd"."class" USING "btree" ("ARTGROUPID");



CREATE INDEX "idx_bsdd_classfeaturemap_artclassid" ON "bsdd"."classfeaturemap" USING "btree" ("ARTCLASSID");



CREATE INDEX "idx_bsdd_classfeaturemap_featureid" ON "bsdd"."classfeaturemap" USING "btree" ("FEATUREID");



CREATE INDEX "idx_bsdd_classfeaturemap_unitofmeasid" ON "bsdd"."classfeaturemap" USING "btree" ("UNITOFMEASID");



CREATE INDEX "idx_bsdd_classfeaturevaluemap_artclassfeaturenr" ON "bsdd"."classfeaturevaluemap" USING "btree" ("ARTCLASSFEATURENR");



CREATE INDEX "idx_bsdd_classfeaturevaluemap_valueid" ON "bsdd"."classfeaturevaluemap" USING "btree" ("VALUEID");



CREATE INDEX "idx_bsdd_classynonymmap_artclassid" ON "bsdd"."classynonymmap" USING "btree" ("ARTCLASSID");



CREATE INDEX "idx_bsdd_feature_featuregroupid" ON "bsdd"."feature" USING "btree" ("FEATUREGROUPID");



CREATE INDEX "idx_class_status" ON "bsdd"."class" USING "btree" ("status");



CREATE INDEX "idx_customers_city" ON "customers"."customers" USING "btree" ("city");



CREATE INDEX "idx_class_id" ON "etim"."class" USING "btree" ("ARTCLASSID");



CREATE INDEX "idx_classfeaturemap_on_artclassid_featureid" ON "etim"."classfeaturemap" USING "btree" ("ARTCLASSID", "FEATUREID");



CREATE INDEX "idx_etim_class_artgroupid" ON "etim"."class" USING "btree" ("ARTGROUPID");



CREATE INDEX "idx_etim_classfeaturemap_featureid" ON "etim"."classfeaturemap" USING "btree" ("FEATUREID");



CREATE INDEX "idx_etim_classfeaturemap_unitofmeasid" ON "etim"."classfeaturemap" USING "btree" ("UNITOFMEASID");



CREATE INDEX "idx_etim_classfeaturevaluemap_artclassfeaturenr" ON "etim"."classfeaturevaluemap" USING "btree" ("ARTCLASSFEATURENR");



CREATE INDEX "idx_etim_classfeaturevaluemap_valueid" ON "etim"."classfeaturevaluemap" USING "btree" ("VALUEID");



CREATE INDEX "idx_etim_feature_featuregroupid" ON "etim"."feature" USING "btree" ("FEATUREGROUPID");



CREATE INDEX "idx_group_id" ON "etim"."group" USING "btree" ("ARTGROUPID");



CREATE INDEX "idx_catalog_id" ON "items"."product" USING "btree" ("catalog_id");



CREATE INDEX "idx_items_catalog_supplier_id" ON "items"."catalog" USING "btree" ("supplier_id");



CREATE INDEX "idx_items_categories_parent_id" ON "items"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_items_product_detail_class_id" ON "items"."product_detail" USING "btree" ("class_id");



CREATE INDEX "idx_items_product_supplier_id" ON "items"."product" USING "btree" ("supplier_id");



CREATE INDEX "idx_price_catalog_itemcode_indate" ON "items"."price_catalog" USING "btree" ("itemcode", "indate" DESC);



CREATE INDEX "idx_product_categories_mv2_combined" ON "items"."product_categories_mv" USING "btree" ("luminaires", "ceiling", "indoor", "outdoor", "submersible", "trimless", "accessories", "floor", "wall", "drivers_constantcurrent", "drivers_constantvoltage", "lamps");



CREATE UNIQUE INDEX "idx_product_categories_mv2_product_id" ON "items"."product_categories_mv" USING "btree" ("product_id");



CREATE INDEX "idx_product_categories_mv2_tracks" ON "items"."product_categories_mv" USING "btree" ("tracks");



CREATE INDEX "idx_product_detail_product_id" ON "items"."product_detail" USING "btree" ("product_id");



CREATE INDEX "idx_product_feature_fname_id" ON "items"."product_feature" USING "btree" ("fname_id");



CREATE INDEX "idx_product_feature_funit" ON "items"."product_feature" USING "btree" ("funit");



CREATE INDEX "idx_product_feature_fvaluec" ON "items"."product_feature" USING "btree" ("fvaluec");



CREATE INDEX "idx_product_feature_product_id" ON "items"."product_feature" USING "btree" ("product_id");



CREATE INDEX "idx_product_features_mv_custom_group" ON "items"."product_features_mv" USING "btree" ("custom_group");



CREATE INDEX "idx_product_features_mv_feature_id" ON "items"."product_features_mv" USING "btree" ("feature_id");



CREATE UNIQUE INDEX "idx_product_features_mv_product_feature" ON "items"."product_features_mv" USING "btree" ("product_id", "feature_id");



CREATE INDEX "idx_product_features_mv_product_id" ON "items"."product_features_mv" USING "btree" ("product_id");



CREATE INDEX "idx_product_foss_pid" ON "items"."product" USING "btree" ("foss_pid");



CREATE INDEX "idx_product_id" ON "items"."product" USING "btree" ("id");



CREATE INDEX "idx_product_info_foss_pid" ON "items"."product_info" USING "btree" ("foss_pid");



CREATE INDEX "idx_product_info_product_id" ON "items"."product_info" USING "btree" ("product_id");



CREATE INDEX "idx_product_info_supplier" ON "items"."product_info" USING "btree" ("supplier_name");



CREATE INDEX "idx_product_search_foss_pid" ON "items"."product_search_index" USING "btree" ("foss_pid");



CREATE INDEX "idx_product_search_fts" ON "items"."product_search_index" USING "gin" ("search_vector");



CREATE INDEX "idx_product_udx_product_id" ON "items"."product_udx" USING "btree" ("product_id");



CREATE INDEX "idx_project_contacts_project_id" ON "projects"."project_contacts" USING "btree" ("project_id");



CREATE INDEX "idx_project_documents_project_id" ON "projects"."project_documents" USING "btree" ("project_id");



CREATE INDEX "idx_project_phases_project_id" ON "projects"."project_phases" USING "btree" ("project_id");



CREATE INDEX "idx_project_products_product_id" ON "projects"."project_products" USING "btree" ("product_id");



CREATE INDEX "idx_project_products_project_id" ON "projects"."project_products" USING "btree" ("project_id");



CREATE INDEX "idx_project_versions_number" ON "projects"."project_versions" USING "btree" ("project_id", "version_number" DESC);



CREATE INDEX "idx_projects_created_at" ON "projects"."projects" USING "btree" ("created_at");



CREATE INDEX "idx_projects_floor_plan_hash" ON "projects"."projects" USING "btree" ("floor_plan_hash") WHERE ("floor_plan_hash" IS NOT NULL);



CREATE INDEX "idx_projects_projects_customer_id" ON "projects"."projects" USING "btree" ("customer_id");



CREATE INDEX "idx_etim_rag_class_id" ON "rag"."etim_rag" USING "btree" ("class_id");



CREATE INDEX "idx_classification_rules_active" ON "search"."classification_rules" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "idx_classification_rules_priority" ON "search"."classification_rules" USING "btree" ("priority");



CREATE INDEX "idx_classification_rules_taxonomy" ON "search"."classification_rules" USING "btree" ("taxonomy_code");



CREATE INDEX "idx_filter_definitions_active" ON "search"."filter_definitions" USING "btree" ("active") WHERE ("active" = true);



CREATE INDEX "idx_filter_definitions_feature" ON "search"."filter_definitions" USING "btree" ("etim_feature_id");



CREATE INDEX "idx_product_filter_index_filter_key" ON "search"."product_filter_index" USING "btree" ("filter_key");



CREATE INDEX "idx_product_filter_index_product_id" ON "search"."product_filter_index" USING "btree" ("product_id");



CREATE INDEX "idx_ptf_ceiling" ON "search"."product_taxonomy_flags" USING "btree" ("ceiling") WHERE ("ceiling" = true);



CREATE INDEX "idx_ptf_foss_pid" ON "search"."product_taxonomy_flags" USING "btree" ("foss_pid");



CREATE INDEX "idx_ptf_product_id" ON "search"."product_taxonomy_flags" USING "btree" ("product_id");



CREATE INDEX "idx_ptf_track_system" ON "search"."product_taxonomy_flags" USING "btree" ("track_system") WHERE ("track_system" = true);



CREATE INDEX "idx_taxonomy_code" ON "search"."taxonomy" USING "btree" ("code");



CREATE INDEX "idx_taxonomy_parent" ON "search"."taxonomy" USING "btree" ("parent_code");



CREATE OR REPLACE TRIGGER "user_created_settings" AFTER INSERT ON "analytics"."users" FOR EACH ROW EXECUTE FUNCTION "analytics"."create_user_settings"();



CREATE OR REPLACE TRIGGER "user_settings_updated_at" BEFORE UPDATE ON "analytics"."user_settings" FOR EACH ROW EXECUTE FUNCTION "analytics"."update_user_settings_timestamp"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "customers"."customers" FOR EACH ROW EXECUTE FUNCTION "customers"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trigger_autofill_etim_feature_data" BEFORE INSERT OR UPDATE ON "items"."product_custom_feature_group" FOR EACH ROW WHEN (("new"."etim_feature" IS NOT NULL)) EXECUTE FUNCTION "items"."auto_fill_etim_feature_data"();



CREATE OR REPLACE TRIGGER "update_category_switches_timestamp" BEFORE UPDATE ON "items"."category_switches" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



CREATE OR REPLACE TRIGGER "update_project_products_updated_at" BEFORE UPDATE ON "projects"."project_products" FOR EACH ROW EXECUTE FUNCTION "projects"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "projects"."projects" FOR EACH ROW EXECUTE FUNCTION "projects"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_etim_rag_updated_at" BEFORE UPDATE ON "rag"."etim_rag" FOR EACH ROW EXECUTE FUNCTION "rag"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_buckets_modtime" BEFORE UPDATE ON "retool"."buckets" FOR EACH ROW EXECUTE FUNCTION "public"."update_modified_column"();



ALTER TABLE ONLY "analytics"."user_settings"
    ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "analytics"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "analytics"."users"
    ADD CONSTRAINT "users_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "analytics"."user_groups"("id");



ALTER TABLE ONLY "bsdd"."class"
    ADD CONSTRAINT "fk_class_group" FOREIGN KEY ("ARTGROUPID") REFERENCES "bsdd"."group"("ARTGROUPID") ON DELETE SET NULL;



ALTER TABLE ONLY "bsdd"."classfeaturemap"
    ADD CONSTRAINT "fk_classfeature_class" FOREIGN KEY ("ARTCLASSID") REFERENCES "bsdd"."class"("ARTCLASSID") ON DELETE CASCADE;



ALTER TABLE ONLY "bsdd"."classfeaturemap"
    ADD CONSTRAINT "fk_classfeature_feature" FOREIGN KEY ("FEATUREID") REFERENCES "bsdd"."feature"("FEATUREID") ON DELETE CASCADE;



ALTER TABLE ONLY "bsdd"."classfeaturemap"
    ADD CONSTRAINT "fk_classfeature_unit" FOREIGN KEY ("UNITOFMEASID") REFERENCES "bsdd"."unit"("UNITOFMEASID") ON DELETE SET NULL;



ALTER TABLE ONLY "bsdd"."classfeaturevaluemap"
    ADD CONSTRAINT "fk_classfeaturevalue_mapping" FOREIGN KEY ("ARTCLASSFEATURENR") REFERENCES "bsdd"."classfeaturemap"("ARTCLASSFEATURENR") ON DELETE CASCADE;



ALTER TABLE ONLY "bsdd"."classfeaturevaluemap"
    ADD CONSTRAINT "fk_classfeaturevalue_value" FOREIGN KEY ("VALUEID") REFERENCES "bsdd"."value"("VALUEID") ON DELETE CASCADE;



ALTER TABLE ONLY "bsdd"."feature"
    ADD CONSTRAINT "fk_feature_group" FOREIGN KEY ("FEATUREGROUPID") REFERENCES "bsdd"."featuregroup"("FEATUREGROUPID") ON DELETE SET NULL;



ALTER TABLE ONLY "bsdd"."classynonymmap"
    ADD CONSTRAINT "fk_synonym_class" FOREIGN KEY ("ARTCLASSID") REFERENCES "bsdd"."class"("ARTCLASSID") ON DELETE CASCADE;



ALTER TABLE ONLY "etim"."class"
    ADD CONSTRAINT "etim_class_artgroupid_fkey" FOREIGN KEY ("ARTGROUPID") REFERENCES "etim"."group"("ARTGROUPID");



ALTER TABLE ONLY "etim"."classfeaturemap"
    ADD CONSTRAINT "etim_classfeaturemap_artclassid_fkey" FOREIGN KEY ("ARTCLASSID") REFERENCES "etim"."class"("ARTCLASSID");



ALTER TABLE ONLY "etim"."classfeaturemap"
    ADD CONSTRAINT "etim_classfeaturemap_featureid_fkey" FOREIGN KEY ("FEATUREID") REFERENCES "etim"."feature"("FEATUREID");



ALTER TABLE ONLY "etim"."classfeaturemap"
    ADD CONSTRAINT "etim_classfeaturemap_unitofmeasid_fkey" FOREIGN KEY ("UNITOFMEASID") REFERENCES "etim"."unit"("UNITOFMEASID");



ALTER TABLE ONLY "etim"."classfeaturevaluemap"
    ADD CONSTRAINT "etim_classfeaturevaluemap_artclassfeaturenr_fkey" FOREIGN KEY ("ARTCLASSFEATURENR") REFERENCES "etim"."classfeaturemap"("ARTCLASSFEATURENR");



ALTER TABLE ONLY "etim"."classfeaturevaluemap"
    ADD CONSTRAINT "etim_classfeaturevaluemap_valueid_fkey" FOREIGN KEY ("VALUEID") REFERENCES "etim"."value"("VALUEID");



ALTER TABLE ONLY "etim"."classynonymmap"
    ADD CONSTRAINT "etim_classynonymmap_artclassid_fkey" FOREIGN KEY ("ARTCLASSID") REFERENCES "etim"."class"("ARTCLASSID");



ALTER TABLE ONLY "etim"."feature"
    ADD CONSTRAINT "feature_FEATUREGROUPID_fkey" FOREIGN KEY ("FEATUREGROUPID") REFERENCES "etim"."featuregroup"("FEATUREGROUPID") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "items"."catalog"
    ADD CONSTRAINT "catalog_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "items"."supplier"("id");



ALTER TABLE ONLY "items"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "items"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "items"."product_feature"
    ADD CONSTRAINT "feature_fname_id_fkey" FOREIGN KEY ("fname_id") REFERENCES "etim"."feature"("FEATUREID");



ALTER TABLE ONLY "items"."product_feature"
    ADD CONSTRAINT "feature_funit_fkey" FOREIGN KEY ("funit") REFERENCES "etim"."unit"("UNITOFMEASID");



ALTER TABLE ONLY "items"."product_feature"
    ADD CONSTRAINT "feature_fvaluec_fkey" FOREIGN KEY ("fvaluec") REFERENCES "etim"."value"("VALUEID");



ALTER TABLE ONLY "items"."product_detail"
    ADD CONSTRAINT "fk_product_detail_class" FOREIGN KEY ("class_id") REFERENCES "etim"."class"("ARTCLASSID") ON DELETE CASCADE;



ALTER TABLE ONLY "items"."product"
    ADD CONSTRAINT "product_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "items"."catalog"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "items"."product_detail"
    ADD CONSTRAINT "product_detail_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "items"."product"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "items"."product_feature"
    ADD CONSTRAINT "product_feature_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "items"."product"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "items"."product"
    ADD CONSTRAINT "product_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "items"."supplier"("id");



ALTER TABLE ONLY "items"."product_udx"
    ADD CONSTRAINT "product_udx_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "items"."product"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."project_contacts"
    ADD CONSTRAINT "project_contacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."project_documents"
    ADD CONSTRAINT "project_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."project_phases"
    ADD CONSTRAINT "project_phases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."project_products"
    ADD CONSTRAINT "project_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "items"."product"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."project_products"
    ADD CONSTRAINT "project_products_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."project_versions"
    ADD CONSTRAINT "project_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "projects"."projects"
    ADD CONSTRAINT "projects_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "search"."classification_rules"
    ADD CONSTRAINT "classification_rules_taxonomy_code_fkey" FOREIGN KEY ("taxonomy_code") REFERENCES "search"."taxonomy"("code") ON UPDATE CASCADE ON DELETE RESTRICT;



ALTER TABLE ONLY "search"."taxonomy"
    ADD CONSTRAINT "taxonomy_parent_code_fkey" FOREIGN KEY ("parent_code") REFERENCES "search"."taxonomy"("code") ON UPDATE CASCADE ON DELETE RESTRICT;



CREATE POLICY "Service role has full access to user_events" ON "analytics"."user_events" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to user_settings" ON "analytics"."user_settings" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "analytics"."user_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "analytics"."user_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "etim"."class" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "class_select_anon_policy" ON "etim"."class" FOR SELECT TO "anon" USING (true);



CREATE POLICY "class_select_service_role_policy" ON "etim"."class" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."classfeaturemap" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classfeaturemap_select_anon_policy" ON "etim"."classfeaturemap" FOR SELECT TO "anon" USING (true);



CREATE POLICY "classfeaturemap_select_service_role_policy" ON "etim"."classfeaturemap" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."classfeaturevaluemap" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classfeaturevaluemap_select_anon_policy" ON "etim"."classfeaturevaluemap" FOR SELECT TO "anon" USING (true);



CREATE POLICY "classfeaturevaluemap_select_service_role_policy" ON "etim"."classfeaturevaluemap" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."classynonymmap" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "classynonymmap_select_anon_policy" ON "etim"."classynonymmap" FOR SELECT TO "anon" USING (true);



CREATE POLICY "classynonymmap_select_service_role_policy" ON "etim"."classynonymmap" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."feature" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feature_select_anon_policy" ON "etim"."feature" FOR SELECT TO "anon" USING (true);



CREATE POLICY "feature_select_service_role_policy" ON "etim"."feature" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."featuregroup" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "featuregroup_select_anon_policy" ON "etim"."featuregroup" FOR SELECT TO "anon" USING (true);



CREATE POLICY "featuregroup_select_service_role_policy" ON "etim"."featuregroup" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."group" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_select_anon_policy" ON "etim"."group" FOR SELECT TO "anon" USING (true);



CREATE POLICY "group_select_service_role_policy" ON "etim"."group" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."unit" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "unit_select_anon_policy" ON "etim"."unit" FOR SELECT TO "anon" USING (true);



CREATE POLICY "unit_select_service_role_policy" ON "etim"."unit" FOR SELECT TO "service_role" USING (true);



ALTER TABLE "etim"."value" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "value_select_anon_policy" ON "etim"."value" FOR SELECT TO "anon" USING (true);



CREATE POLICY "value_select_service_role_policy" ON "etim"."value" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Allow authenticated users to search products" ON "items"."product_search_index" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "items"."catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "catalog_delete_policy" ON "items"."catalog" FOR DELETE USING (true);



CREATE POLICY "catalog_insert_policy" ON "items"."catalog" FOR INSERT WITH CHECK (true);



CREATE POLICY "catalog_select_policy" ON "items"."catalog" FOR SELECT USING (true);



CREATE POLICY "catalog_update_policy" ON "items"."catalog" FOR UPDATE USING (true);



ALTER TABLE "items"."price_catalog" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "price_catalog_delete_policy" ON "items"."price_catalog" FOR DELETE USING (true);



CREATE POLICY "price_catalog_insert_policy" ON "items"."price_catalog" FOR INSERT WITH CHECK (true);



CREATE POLICY "price_catalog_select_policy" ON "items"."price_catalog" FOR SELECT USING (true);



CREATE POLICY "price_catalog_update_policy" ON "items"."price_catalog" FOR UPDATE USING (true);



ALTER TABLE "items"."product" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "items"."product_custom_feature_group" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_custom_feature_group_delete_policy" ON "items"."product_custom_feature_group" FOR DELETE USING (true);



CREATE POLICY "product_custom_feature_group_insert_policy" ON "items"."product_custom_feature_group" FOR INSERT WITH CHECK (true);



CREATE POLICY "product_custom_feature_group_select_policy" ON "items"."product_custom_feature_group" FOR SELECT USING (true);



CREATE POLICY "product_custom_feature_group_update_policy" ON "items"."product_custom_feature_group" FOR UPDATE USING (true);



CREATE POLICY "product_delete_policy" ON "items"."product" FOR DELETE USING (true);



ALTER TABLE "items"."product_detail" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_detail_delete_policy" ON "items"."product_detail" FOR DELETE USING (true);



CREATE POLICY "product_detail_insert_policy" ON "items"."product_detail" FOR INSERT WITH CHECK (true);



CREATE POLICY "product_detail_select_policy" ON "items"."product_detail" FOR SELECT USING (true);



CREATE POLICY "product_detail_update_policy" ON "items"."product_detail" FOR UPDATE USING (true);



ALTER TABLE "items"."product_feature" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_feature_delete_policy" ON "items"."product_feature" FOR DELETE USING (true);



CREATE POLICY "product_feature_insert_policy" ON "items"."product_feature" FOR INSERT WITH CHECK (true);



CREATE POLICY "product_feature_select_policy" ON "items"."product_feature" FOR SELECT USING (true);



CREATE POLICY "product_feature_update_policy" ON "items"."product_feature" FOR UPDATE USING (true);



ALTER TABLE "items"."product_filter" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_filter_delete_policy" ON "items"."product_filter" FOR DELETE USING (true);



CREATE POLICY "product_filter_insert_policy" ON "items"."product_filter" FOR INSERT WITH CHECK (true);



CREATE POLICY "product_filter_select_policy" ON "items"."product_filter" FOR SELECT USING (true);



CREATE POLICY "product_filter_update_policy" ON "items"."product_filter" FOR UPDATE USING (true);



CREATE POLICY "product_insert_policy" ON "items"."product" FOR INSERT WITH CHECK (true);



ALTER TABLE "items"."product_search_index" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_select_policy" ON "items"."product" FOR SELECT USING (true);



ALTER TABLE "items"."product_udx" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_udx_delete_policy" ON "items"."product_udx" FOR DELETE USING (true);



CREATE POLICY "product_udx_insert_policy" ON "items"."product_udx" FOR INSERT WITH CHECK (true);



CREATE POLICY "product_udx_select_policy" ON "items"."product_udx" FOR SELECT USING (true);



CREATE POLICY "product_udx_update_policy" ON "items"."product_udx" FOR UPDATE USING (true);



CREATE POLICY "product_update_policy" ON "items"."product" FOR UPDATE USING (true);



CREATE POLICY "service_role_all_access" ON "items"."product_feature" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "items"."supplier" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "supplier_delete_policy" ON "items"."supplier" FOR DELETE USING (true);



CREATE POLICY "supplier_insert_policy" ON "items"."supplier" FOR INSERT WITH CHECK (true);



CREATE POLICY "supplier_select_policy" ON "items"."supplier" FOR SELECT USING (true);



CREATE POLICY "supplier_update_policy" ON "items"."supplier" FOR UPDATE USING (true);



CREATE POLICY "Authenticated users can create project versions" ON "projects"."project_versions" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can update project versions" ON "projects"."project_versions" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can view project versions" ON "projects"."project_versions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service role has full access to project_contacts" ON "projects"."project_contacts" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to project_documents" ON "projects"."project_documents" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to project_phases" ON "projects"."project_phases" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to project_products" ON "projects"."project_products" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to projects" ON "projects"."projects" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "projects"."project_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "projects"."project_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "projects"."project_phases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "projects"."project_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "projects"."project_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "projects"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."n8n_chat_histories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "n8n_chat_histories_anon_policy" ON "public"."n8n_chat_histories" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "n8n_chat_histories_authenticated_policy" ON "public"."n8n_chat_histories" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "n8n_chat_histories_service_role_policy" ON "public"."n8n_chat_histories" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "public"."n8n_rag" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "n8n_rag_anon_policy" ON "public"."n8n_rag" TO "anon" USING (true) WITH CHECK (true);



CREATE POLICY "n8n_rag_authenticated_policy" ON "public"."n8n_rag" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "n8n_rag_service_role_policy" ON "public"."n8n_rag" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public read access to classification_rules" ON "search"."classification_rules" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "Allow public read access to filter_definitions" ON "search"."filter_definitions" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "Allow public read access to taxonomy" ON "search"."taxonomy" FOR SELECT TO "anon", "authenticated" USING (true);



CREATE POLICY "Restrict classification_rules writes to service_role" ON "search"."classification_rules" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Restrict filter_definitions writes to service_role" ON "search"."filter_definitions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Restrict taxonomy writes to service_role" ON "search"."taxonomy" TO "service_role" USING (true) WITH CHECK (true);



ALTER TABLE "search"."classification_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "search"."filter_definitions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "search"."taxonomy" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "analytics" TO "service_role";
GRANT USAGE ON SCHEMA "analytics" TO "authenticated";



GRANT USAGE ON SCHEMA "bsdd" TO PUBLIC;



GRANT USAGE ON SCHEMA "customers" TO "service_role";



GRANT USAGE ON SCHEMA "etim" TO "service_role";
GRANT USAGE ON SCHEMA "etim" TO "anon";



GRANT USAGE ON SCHEMA "items" TO "service_role";
GRANT USAGE ON SCHEMA "items" TO "authenticated";
GRANT USAGE ON SCHEMA "items" TO "anon";



GRANT USAGE ON SCHEMA "projects" TO "service_role";
GRANT USAGE ON SCHEMA "projects" TO "authenticated";
GRANT USAGE ON SCHEMA "projects" TO "anon";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "rag" TO "authenticated";
GRANT USAGE ON SCHEMA "rag" TO "service_role";



GRANT USAGE ON SCHEMA "search" TO "anon";
GRANT USAGE ON SCHEMA "search" TO "authenticated";
GRANT USAGE ON SCHEMA "search" TO "service_role";



























































































































GRANT ALL ON FUNCTION "analytics"."get_most_active_users"("user_limit" integer) TO "service_role";
GRANT ALL ON FUNCTION "analytics"."get_most_active_users"("user_limit" integer) TO "authenticated";



GRANT ALL ON FUNCTION "analytics"."upsert_user_on_login"("p_email" "text", "p_name" "text", "p_image" "text") TO "service_role";

















































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "items"."get_active_catalogs_with_counts"() TO "service_role";
GRANT ALL ON FUNCTION "items"."get_active_catalogs_with_counts"() TO "authenticated";



GRANT ALL ON FUNCTION "items"."get_dashboard_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "items"."get_dashboard_stats"() TO "service_role";



GRANT ALL ON FUNCTION "items"."get_supplier_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "items"."get_supplier_stats"() TO "service_role";



GRANT ALL ON FUNCTION "items"."get_top_families"("p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "items"."get_top_families"("p_limit" integer) TO "service_role";












GRANT ALL ON FUNCTION "projects"."generate_project_code"() TO "authenticated";
GRANT ALL ON FUNCTION "projects"."generate_project_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_sql"("query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_sql"("query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_sql"("query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_catalogs_with_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_catalogs_with_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_catalogs_with_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_facets"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_facets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_facets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filter_definitions_with_type"("p_taxonomy_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_filter_definitions_with_type"("p_taxonomy_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filter_definitions_with_type"("p_taxonomy_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_most_active_users"("user_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_most_active_users"("user_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_most_active_users"("user_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_product_verification_data"("p_foss_pid" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_product_verification_data"("p_foss_pid" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_product_verification_data"("p_foss_pid" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_products_by_taxonomy_and_supplier"("p_taxonomy_ids" "uuid"[], "p_supplier_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_products_by_taxonomy_and_supplier"("p_taxonomy_ids" "uuid"[], "p_supplier_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_products_by_taxonomy_and_supplier"("p_taxonomy_ids" "uuid"[], "p_supplier_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_root_categories"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_root_categories"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_root_categories"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_search_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_search_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_search_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_taxonomy_tree"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_taxonomy_tree"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_taxonomy_tree"() TO "service_role";






GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_ip_ratings" "text"[], "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT SELECT ON TABLE "etim"."class" TO "service_role";
GRANT SELECT ON TABLE "etim"."class" TO "anon";



GRANT SELECT ON TABLE "etim"."classfeaturemap" TO "service_role";
GRANT SELECT ON TABLE "etim"."classfeaturemap" TO "anon";



GRANT SELECT ON TABLE "etim"."feature" TO "service_role";
GRANT SELECT ON TABLE "etim"."feature" TO "anon";



GRANT SELECT ON TABLE "etim"."featuregroup" TO "service_role";
GRANT SELECT ON TABLE "etim"."featuregroup" TO "anon";



GRANT SELECT ON TABLE "etim"."group" TO "service_role";
GRANT SELECT ON TABLE "etim"."group" TO "anon";



GRANT SELECT ON TABLE "etim"."unit" TO "service_role";
GRANT SELECT ON TABLE "etim"."unit" TO "anon";



GRANT SELECT ON TABLE "etim"."value" TO "service_role";
GRANT SELECT ON TABLE "etim"."value" TO "anon";



GRANT SELECT ON TABLE "items"."catalog" TO "service_role";
GRANT SELECT ON TABLE "items"."catalog" TO "authenticated";



GRANT SELECT ON TABLE "items"."product" TO "service_role";
GRANT SELECT ON TABLE "items"."product" TO "authenticated";



GRANT SELECT ON TABLE "items"."product_feature" TO "service_role";
GRANT SELECT ON TABLE "items"."product_feature" TO "anon";
GRANT SELECT ON TABLE "items"."product_feature" TO "authenticated";



GRANT SELECT ON TABLE "items"."supplier" TO "service_role";
GRANT SELECT ON TABLE "items"."supplier" TO "authenticated";



GRANT SELECT ON TABLE "items"."product_info" TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_fts"("search_query" "text", "result_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_fts"("search_query" "text", "result_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_fts"("search_query" "text", "result_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_modified_column"() TO "service_role";



GRANT ALL ON FUNCTION "search"."build_histogram"("value_array" numeric[], "bucket_count" integer) TO "anon";
GRANT ALL ON FUNCTION "search"."build_histogram"("value_array" numeric[], "bucket_count" integer) TO "authenticated";
GRANT ALL ON FUNCTION "search"."build_histogram"("value_array" numeric[], "bucket_count" integer) TO "service_role";



GRANT ALL ON FUNCTION "search"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "anon";
GRANT ALL ON FUNCTION "search"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "search"."count_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "service_role";



GRANT ALL ON FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."count_search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."count_simple_test"("p_filters" "jsonb", "p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."count_simple_test"("p_filters" "jsonb", "p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."count_simple_test"("p_filters" "jsonb", "p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."evaluate_feature_condition"("feature" "jsonb", "condition" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "search"."evaluate_feature_condition"("feature" "jsonb", "condition" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "search"."evaluate_feature_condition"("feature" "jsonb", "condition" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "search"."get_available_facets"() TO "anon";
GRANT ALL ON FUNCTION "search"."get_available_facets"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_available_facets"() TO "service_role";



GRANT ALL ON FUNCTION "search"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_boolean_flag_counts"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_dynamic_facets"("p_taxonomy_codes" "text"[], "p_filters" "jsonb", "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_query" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."get_filter_definitions_with_type"("p_taxonomy_code" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."get_filter_definitions_with_type"("p_taxonomy_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_filter_definitions_with_type"("p_taxonomy_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "anon";
GRANT ALL ON FUNCTION "search"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_filter_facets_with_context"("p_query" "text", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean) TO "service_role";



GRANT SELECT ON TABLE "search"."filter_definitions" TO "anon";
GRANT SELECT ON TABLE "search"."filter_definitions" TO "authenticated";
GRANT SELECT ON TABLE "search"."filter_definitions" TO "service_role";



GRANT ALL ON FUNCTION "search"."get_filters_for_taxonomy"("p_taxonomy_code" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."get_filters_for_taxonomy"("p_taxonomy_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_filters_for_taxonomy"("p_taxonomy_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."get_global_supplier_counts"() TO "anon";
GRANT ALL ON FUNCTION "search"."get_global_supplier_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_global_supplier_counts"() TO "service_role";



GRANT ALL ON FUNCTION "search"."get_misc_products"() TO "anon";
GRANT ALL ON FUNCTION "search"."get_misc_products"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_misc_products"() TO "service_role";



GRANT ALL ON FUNCTION "search"."get_search_statistics"() TO "anon";
GRANT ALL ON FUNCTION "search"."get_search_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_search_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "search"."get_supplier_counts_by_taxonomy"("p_taxonomy_code" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."get_supplier_counts_by_taxonomy"("p_taxonomy_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_supplier_counts_by_taxonomy"("p_taxonomy_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."get_taxonomy_ancestors"("p_taxonomy_code" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."get_taxonomy_ancestors"("p_taxonomy_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_taxonomy_ancestors"("p_taxonomy_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."get_taxonomy_tree"() TO "anon";
GRANT ALL ON FUNCTION "search"."get_taxonomy_tree"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."get_taxonomy_tree"() TO "service_role";



GRANT ALL ON FUNCTION "search"."refresh_all_product_views"() TO "anon";
GRANT ALL ON FUNCTION "search"."refresh_all_product_views"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."refresh_all_product_views"() TO "service_role";



GRANT ALL ON FUNCTION "search"."refresh_search_views"() TO "authenticated";



GRANT ALL ON FUNCTION "search"."refresh_taxonomy_only"() TO "authenticated";



GRANT ALL ON FUNCTION "search"."refresh_taxonomy_only_with_timeout"() TO "service_role";



GRANT ALL ON FUNCTION "search"."search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "search"."search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "search"."search_products"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "search"."search_products_v2"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "search"."search_products_v2"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "search"."search_products_v2"("p_query" "text", "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_ceiling" boolean, "p_wall" boolean, "p_pendant" boolean, "p_recessed" boolean, "p_dimmable" boolean, "p_power_min" numeric, "p_power_max" numeric, "p_color_temp_min" numeric, "p_color_temp_max" numeric, "p_ip_ratings" "text"[], "p_suppliers" "text"[], "p_taxonomy_codes" "text"[], "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "search"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "search"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "search"."search_products_with_filters"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_indoor" boolean, "p_outdoor" boolean, "p_submersible" boolean, "p_trimless" boolean, "p_cut_shape_round" boolean, "p_cut_shape_rectangular" boolean, "p_sort_by" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_complete"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_sort_by" "text", "p_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "search"."test_complete"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_sort_by" "text", "p_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_complete"("p_query" "text", "p_filters" "jsonb", "p_taxonomy_codes" "text"[], "p_suppliers" "text"[], "p_sort_by" "text", "p_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_count_simple"("p_taxonomy_codes" "text"[], "p_indoor" boolean) TO "anon";
GRANT ALL ON FUNCTION "search"."test_count_simple"("p_taxonomy_codes" "text"[], "p_indoor" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_count_simple"("p_taxonomy_codes" "text"[], "p_indoor" boolean) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_count_with_voltage"("p_taxonomy_codes" "text"[], "p_indoor" boolean, "p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "search"."test_count_with_voltage"("p_taxonomy_codes" "text"[], "p_indoor" boolean, "p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_count_with_voltage"("p_taxonomy_codes" "text"[], "p_indoor" boolean, "p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "search"."test_dimmable_filter"("p_filters" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "search"."test_dimmable_filter"("p_filters" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_dimmable_filter"("p_filters" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "search"."test_minimal"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_minimal"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_minimal"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_minimal_search"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_minimal_search"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_minimal_search"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_search"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_search"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_search"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_simple"() TO "anon";
GRANT ALL ON FUNCTION "search"."test_simple"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_simple"() TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_case_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_case_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_case_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_flags"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_flags"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_flags"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_join"() TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_join"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_join"() TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_key_features"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_key_features"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_key_features"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_more_fields"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_more_fields"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_more_fields"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_order"("p_taxonomy_codes" "text"[], "p_sort_by" "text") TO "service_role";



GRANT ALL ON FUNCTION "search"."test_with_where"("p_taxonomy_codes" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "search"."test_with_where"("p_taxonomy_codes" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "search"."test_with_where"("p_taxonomy_codes" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "search"."update_misc_rule_classes"() TO "anon";
GRANT ALL ON FUNCTION "search"."update_misc_rule_classes"() TO "authenticated";
GRANT ALL ON FUNCTION "search"."update_misc_rule_classes"() TO "service_role";
























GRANT SELECT,INSERT ON TABLE "analytics"."user_events" TO "service_role";
GRANT SELECT,INSERT ON TABLE "analytics"."user_events" TO "authenticated";



GRANT SELECT ON TABLE "analytics"."user_groups" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "analytics"."user_groups_id_seq" TO "service_role";



GRANT ALL ON TABLE "analytics"."user_settings" TO "service_role";
GRANT SELECT,UPDATE ON TABLE "analytics"."user_settings" TO "authenticated";



GRANT SELECT,INSERT,UPDATE ON TABLE "analytics"."users" TO "service_role";



GRANT SELECT ON TABLE "bsdd"."class" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."classfeaturemap" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."classfeaturevaluemap" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."classynonymmap" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."feature" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."featuregroup" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."group" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."unit" TO PUBLIC;



GRANT SELECT ON TABLE "bsdd"."value" TO PUBLIC;



GRANT SELECT ON TABLE "customers"."customers" TO "service_role";



GRANT SELECT ON TABLE "etim"."classfeaturevaluemap" TO "service_role";
GRANT SELECT ON TABLE "etim"."classfeaturevaluemap" TO "anon";



GRANT SELECT ON TABLE "etim"."classynonymmap" TO "service_role";
GRANT SELECT ON TABLE "etim"."classynonymmap" TO "anon";



GRANT SELECT ON TABLE "etim"."feature_value_lookup" TO "service_role";






GRANT SELECT ON TABLE "items"."product_search_index" TO "authenticated";












GRANT ALL ON TABLE "projects"."project_contacts" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "projects"."project_contacts" TO "authenticated";



GRANT ALL ON TABLE "projects"."project_documents" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "projects"."project_documents" TO "authenticated";



GRANT ALL ON TABLE "projects"."project_phases" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "projects"."project_phases" TO "authenticated";



GRANT ALL ON TABLE "projects"."project_products" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "projects"."project_products" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "projects"."project_versions" TO "authenticated";
GRANT ALL ON TABLE "projects"."project_versions" TO "service_role";



GRANT ALL ON TABLE "projects"."projects" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "projects"."projects" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."n8n_chat_histories" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."n8n_chat_histories" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."n8n_chat_histories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."n8n_chat_histories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."n8n_chat_histories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."n8n_chat_histories_id_seq" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."n8n_rag" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."n8n_rag" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."n8n_rag" TO "service_role";



GRANT ALL ON SEQUENCE "public"."n8n_rag_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."n8n_rag_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."n8n_rag_id_seq" TO "service_role";



GRANT SELECT ON TABLE "search"."classification_rules" TO "anon";
GRANT SELECT ON TABLE "search"."classification_rules" TO "authenticated";
GRANT SELECT ON TABLE "search"."classification_rules" TO "service_role";



GRANT SELECT ON TABLE "search"."product_filter_index" TO "service_role";



GRANT SELECT ON TABLE "search"."product_taxonomy_flags" TO "service_role";



GRANT SELECT ON TABLE "search"."taxonomy" TO "anon";
GRANT SELECT ON TABLE "search"."taxonomy" TO "authenticated";
GRANT SELECT ON TABLE "search"."taxonomy" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "projects" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "projects" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "search" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "search" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "search" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "search" GRANT SELECT ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "search" GRANT SELECT ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "search" GRANT SELECT ON TABLES TO "service_role";




























