-- ============================================================================
-- Migration: Remove "INDOOR" from taxonomy codes
-- Date: 2025-11-22
-- Description: Simplifies taxonomy by removing redundant "INDOOR" from codes
--              Affects 11 taxonomy entries and 8,336 product references
-- ============================================================================

-- SAFETY: This migration uses a transaction to ensure atomicity
BEGIN;

-- ============================================================================
-- STEP 1: Temporarily disable FK constraints to allow circular update
-- ============================================================================

-- Disable both FK constraints temporarily
ALTER TABLE search.classification_rules
    DROP CONSTRAINT IF EXISTS classification_rules_taxonomy_code_fkey;

ALTER TABLE search.taxonomy
    DROP CONSTRAINT IF EXISTS taxonomy_parent_code_fkey;

-- ============================================================================
-- STEP 2: Update parent categories (level 2) - codes only
-- ============================================================================

UPDATE search.taxonomy
SET code = 'LUMINAIRE-CEILING'
WHERE code = 'LUMINAIRE-INDOOR-CEILING';

UPDATE search.taxonomy
SET code = 'LUMINAIRE-WALL'
WHERE code = 'LUMINAIRE-INDOOR-WALL';

UPDATE search.taxonomy
SET code = 'LUMINAIRE-FLOOR'
WHERE code = 'LUMINAIRE-INDOOR-FLOOR';

-- ============================================================================
-- STEP 3: Update child categories (level 3) - codes and parent_code
-- ============================================================================

-- Update children of CEILING (parent_code already updated above)
UPDATE search.taxonomy
SET
    code = REPLACE(code, 'LUMINAIRE-INDOOR-', 'LUMINAIRE-'),
    parent_code = 'LUMINAIRE-CEILING'
WHERE parent_code = 'LUMINAIRE-INDOOR-CEILING';

-- Update children of WALL (parent_code already updated above)
UPDATE search.taxonomy
SET
    code = REPLACE(code, 'LUMINAIRE-INDOOR-', 'LUMINAIRE-'),
    parent_code = 'LUMINAIRE-WALL'
WHERE parent_code = 'LUMINAIRE-INDOOR-WALL';

-- Update children of FLOOR (parent_code already updated above)
UPDATE search.taxonomy
SET
    code = REPLACE(code, 'LUMINAIRE-INDOOR-', 'LUMINAIRE-'),
    parent_code = 'LUMINAIRE-FLOOR'
WHERE parent_code = 'LUMINAIRE-INDOOR-FLOOR';

-- ============================================================================
-- STEP 4: Update classification_rules
-- ============================================================================

-- Update classification rules to use new taxonomy codes
UPDATE search.classification_rules
SET taxonomy_code = REPLACE(taxonomy_code, 'LUMINAIRE-INDOOR-', 'LUMINAIRE-')
WHERE taxonomy_code LIKE '%LUMINAIRE-INDOOR-%';

-- ============================================================================
-- STEP 5: Refresh materialized view to pick up updated taxonomy codes
-- ============================================================================

-- Refresh the materialized view to reflect updated classification_rules
-- The taxonomy_path array will be automatically rebuilt with new codes
REFRESH MATERIALIZED VIEW search.product_taxonomy_flags;

-- ============================================================================
-- VERIFICATION: Check that old codes no longer exist
-- ============================================================================

DO $$
DECLARE
    old_taxonomy_count INTEGER;
    old_product_count INTEGER;
BEGIN
    -- Check taxonomy table
    SELECT COUNT(*) INTO old_taxonomy_count
    FROM search.taxonomy
    WHERE code LIKE '%INDOOR%' OR parent_code LIKE '%INDOOR%';

    IF old_taxonomy_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: Found % taxonomy entries still containing INDOOR', old_taxonomy_count;
    END IF;

    -- Check product_taxonomy_flags
    SELECT COUNT(*) INTO old_product_count
    FROM search.product_taxonomy_flags
    WHERE EXISTS (
        SELECT 1 FROM unnest(taxonomy_path) AS code
        WHERE code LIKE '%INDOOR%'
    );

    IF old_product_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: Found % products still referencing INDOOR codes', old_product_count;
    END IF;

    RAISE NOTICE 'Migration successful: All INDOOR references removed';
END $$;

-- ============================================================================
-- STEP 6: Re-create the FK constraints
-- ============================================================================

-- Restore the taxonomy parent_code FK constraint
ALTER TABLE search.taxonomy
    ADD CONSTRAINT taxonomy_parent_code_fkey
    FOREIGN KEY (parent_code)
    REFERENCES search.taxonomy(code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

-- Restore the classification_rules taxonomy_code FK constraint
ALTER TABLE search.classification_rules
    ADD CONSTRAINT classification_rules_taxonomy_code_fkey
    FOREIGN KEY (taxonomy_code)
    REFERENCES search.taxonomy(code)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;

COMMIT;

-- ============================================================================
-- POST-MIGRATION NOTES
-- ============================================================================
--
-- Changed codes:
--   LUMINAIRE-INDOOR-CEILING          → LUMINAIRE-CEILING
--   LUMINAIRE-INDOOR-CEILING-RECESSED → LUMINAIRE-CEILING-RECESSED
--   LUMINAIRE-INDOOR-CEILING-SURFACE  → LUMINAIRE-CEILING-SURFACE
--   LUMINAIRE-INDOOR-CEILING-SUSPENDED → LUMINAIRE-CEILING-SUSPENDED
--   LUMINAIRE-INDOOR-CEILING-TRACK    → LUMINAIRE-CEILING-TRACK
--   LUMINAIRE-INDOOR-WALL             → LUMINAIRE-WALL
--   LUMINAIRE-INDOOR-WALL-RECESSED    → LUMINAIRE-WALL-RECESSED
--   LUMINAIRE-INDOOR-WALL-SURFACE     → LUMINAIRE-WALL-SURFACE
--   LUMINAIRE-INDOOR-FLOOR            → LUMINAIRE-FLOOR
--   LUMINAIRE-INDOOR-FLOOR-RECESSED   → LUMINAIRE-FLOOR-RECESSED
--   LUMINAIRE-INDOOR-FLOOR-SURFACE    → LUMINAIRE-FLOOR-SURFACE
--
-- Updated: 11 classification rules
-- Updated: 11 taxonomy entries
-- Updated: 8,336 product references
-- ============================================================================
