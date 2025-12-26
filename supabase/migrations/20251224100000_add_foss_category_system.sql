-- Migration: Add FOSS Category System for DWG Symbol Generation
-- Purpose: Categorize luminaires (A, B, C, etc.) based on ETIM class and IP rating
-- Used by: Planner symbol codes, DWG generation pipeline

-- ============================================================================
-- 1. CATEGORY RULES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS items.foss_category_rules (
    id SERIAL PRIMARY KEY,
    category_code CHAR(1) NOT NULL,
    category_name TEXT NOT NULL,
    etim_class TEXT NOT NULL,
    ip_min INT,                      -- NULL = no minimum (inclusive)
    ip_max INT,                      -- NULL = no maximum (exclusive)
    priority INT DEFAULT 100,        -- Lower = checked first
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- Note: category_code is NOT unique - multiple ETIM classes can map to same category
    CONSTRAINT unique_etim_class_ip UNIQUE (etim_class, COALESCE(ip_min, -1), COALESCE(ip_max, -1)),
    CONSTRAINT valid_ip_range CHECK (ip_min IS NULL OR ip_max IS NULL OR ip_min < ip_max)
);

COMMENT ON TABLE items.foss_category_rules IS 'Rules for assigning FOSS category codes (A-Z) to products based on ETIM class and IP rating';
COMMENT ON COLUMN items.foss_category_rules.ip_min IS 'Minimum IP rating (inclusive). NULL means no minimum.';
COMMENT ON COLUMN items.foss_category_rules.ip_max IS 'Maximum IP rating (exclusive). NULL means no maximum.';
COMMENT ON COLUMN items.foss_category_rules.priority IS 'Lower priority = checked first. Used for overlapping rules.';

-- ============================================================================
-- 2. HELPER FUNCTION: Extract IP rating from product features
-- ============================================================================

CREATE OR REPLACE FUNCTION items.get_product_ip_rating(p_features JSONB)
RETURNS INT
LANGUAGE SQL
IMMUTABLE
AS $$
    SELECT NULLIF(
        REGEXP_REPLACE(
            COALESCE(
                -- Primary: EF003118 (Degree of protection IP, front side) - 83% of products
                (SELECT f->>'fvalueC_desc'
                 FROM jsonb_array_elements(p_features) f
                 WHERE f->>'FEATUREID' = 'EF003118'
                 LIMIT 1),
                -- Fallback: EF005474 (Degree of protection IP) - includes IP68 cases
                (SELECT f->>'fvalueC_desc'
                 FROM jsonb_array_elements(p_features) f
                 WHERE f->>'FEATUREID' = 'EF005474'
                 LIMIT 1)
            ),
            '[^0-9]', '', 'g'  -- Extract numeric part: "IP65" -> "65"
        ),
        ''  -- Handle empty string case
    )::INT
$$;

COMMENT ON FUNCTION items.get_product_ip_rating IS 'Extracts numeric IP rating from product features JSONB. Returns NULL if no IP rating found.';

-- ============================================================================
-- 3. MAIN FUNCTION: Determine FOSS category for a product
-- ============================================================================

CREATE OR REPLACE FUNCTION items.get_foss_category(
    p_etim_class TEXT,
    p_features JSONB
)
RETURNS TABLE (
    category_code CHAR(1),
    category_name TEXT
)
LANGUAGE SQL
STABLE
AS $$
    WITH product_ip AS (
        SELECT items.get_product_ip_rating(p_features) AS ip_rating
    )
    SELECT
        r.category_code,
        r.category_name
    FROM items.foss_category_rules r
    CROSS JOIN product_ip
    WHERE r.is_active = true
      AND r.etim_class = p_etim_class
      AND (r.ip_min IS NULL OR product_ip.ip_rating >= r.ip_min)
      AND (r.ip_max IS NULL OR product_ip.ip_rating < r.ip_max)
    ORDER BY r.priority ASC
    LIMIT 1
$$;

COMMENT ON FUNCTION items.get_foss_category IS 'Returns FOSS category code and name for a product based on ETIM class and IP rating.';

-- ============================================================================
-- 4. CONVENIENCE FUNCTION: Get category from product_id
-- ============================================================================

CREATE OR REPLACE FUNCTION items.get_foss_category_by_product_id(p_product_id UUID)
RETURNS TABLE (
    category_code CHAR(1),
    category_name TEXT
)
LANGUAGE SQL
STABLE
AS $$
    SELECT fc.category_code, fc.category_name
    FROM items.product_info pi
    CROSS JOIN LATERAL items.get_foss_category(pi.class, pi.features) fc
    WHERE pi.product_id = p_product_id
$$;

COMMENT ON FUNCTION items.get_foss_category_by_product_id IS 'Returns FOSS category for a product by its UUID.';

-- ============================================================================
-- 5. POPULATE INITIAL CATEGORY RULES
-- ============================================================================

INSERT INTO items.foss_category_rules (category_code, category_name, etim_class, ip_min, ip_max, priority, notes)
VALUES
    -- CURRENT CATEGORIES (from CSV)
    ('A', 'Interior Spots', 'EC001744', NULL, 65, 100, 'Downlight/spot/floodlight, IP < 65'),
    ('B', 'Suspension', 'EC001743', NULL, NULL, 100, 'Pendant luminaire'),
    ('C', 'Exterior Spots', 'EC001744', 65, NULL, 100, 'Downlight/spot/floodlight, IP >= 65'),
    ('D', 'LED Tapes', 'EC002706', NULL, 67, 100, 'Light ribbon/-hose/-strip, IP < 67'),
    ('E', 'LED Tapes IP67', 'EC002706', 67, NULL, 100, 'Light ribbon/-hose/-strip, IP >= 67'),
    ('F', 'Interior Wall Lights', 'EC002892', NULL, 65, 100, 'Ceiling-/wall luminaire, IP < 65'),
    ('G', 'Exterior Wall Lights', 'EC002892', 65, NULL, 100, 'Ceiling-/wall luminaire, IP >= 65'),
    ('H', 'Floor Lights', 'EC000300', NULL, NULL, 100, 'Floor luminaire'),
    ('K', 'Table', 'EC000302', NULL, NULL, 100, 'Table luminaire'),
    ('M', 'Profiles', 'EC004966', NULL, NULL, 100, 'Profile for light ribbon'),
    ('N', 'Track Light', 'EC000101', NULL, NULL, 100, 'Light-track'),
    ('P', 'Underwater', 'EC000758', 68, NULL, 50, 'In-ground luminaire, IP68 (submersible)'),
    ('Q', 'In-ground / Landscape', 'EC000758', NULL, 68, 100, 'In-ground luminaire, IP < 68'),

    -- PROPOSED ADDITIONS (from CSV)
    ('I', 'Bollards', 'EC000301', NULL, NULL, 100, 'Luminaire bollard'),
    ('J', 'Street / Pole Lights', 'EC000062', NULL, NULL, 100, 'Luminaire for streets and places'),
    ('J', 'Street / Pole Lights', 'EC000061', NULL, NULL, 100, 'Light pole'),
    ('O', 'Step / Orientation Lights', 'EC000481', NULL, NULL, 100, 'Orientation luminaire'),
    ('T', 'Linear Systems', 'EC000986', NULL, NULL, 100, 'Electrical unit for light-line system'),
    ('T', 'Linear Systems', 'EC000109', NULL, NULL, 100, 'Batten luminaire')
ON CONFLICT ON CONSTRAINT unique_etim_class_ip DO NOTHING;

-- Note: Category 'L' (Floodlights) is intentionally omitted - needs beam angle distinction
-- Note: Categories R, S, U, V (Optional) are not included in initial setup

-- ============================================================================
-- 6. ADD symbol_sequence TO project_products
-- ============================================================================

ALTER TABLE projects.project_products
ADD COLUMN IF NOT EXISTS symbol_sequence INT;

COMMENT ON COLUMN projects.project_products.symbol_sequence IS 'Sequence number for symbol code within category (e.g., 1 in "A1", 2 in "A2")';

-- ============================================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_foss_category_rules_lookup
ON items.foss_category_rules (etim_class, is_active, priority)
WHERE is_active = true;

-- ============================================================================
-- 8. GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON items.foss_category_rules TO authenticated;
GRANT SELECT ON items.foss_category_rules TO anon;

GRANT EXECUTE ON FUNCTION items.get_product_ip_rating(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION items.get_product_ip_rating(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION items.get_foss_category(text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION items.get_foss_category(text, jsonb) TO anon;
GRANT EXECUTE ON FUNCTION items.get_foss_category_by_product_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION items.get_foss_category_by_product_id(uuid) TO anon;
