-- Migration: Add filter grouping and activate Phase 2/3 filters
-- Date: 2025-11-23
-- Description:
--   1. Add 'group' column to filter_definitions for organized filter display
--   2. Activate 12 Phase 2/3 filters (light_source, ik, adjustability, etc.)
--   3. Assign all 26 filters to their respective groups
--   4. Add constraint and index for group column

-- ============================================================================
-- PART 1: Schema Changes
-- ============================================================================

-- Add group column
ALTER TABLE search.filter_definitions
ADD COLUMN IF NOT EXISTS "group" TEXT;

-- Add CHECK constraint for valid groups
ALTER TABLE search.filter_definitions
ADD CONSTRAINT chk_valid_filter_group CHECK (
  "group" IN ('Location', 'Options', 'Electricals', 'Design', 'Light')
  OR "group" IS NULL
);

-- Create index on group column for efficient filtering
CREATE INDEX IF NOT EXISTS idx_filter_definitions_group
ON search.filter_definitions("group")
WHERE "group" IS NOT NULL;

-- ============================================================================
-- PART 2: Update Existing Active Filters with Groups (14 filters)
-- ============================================================================

-- Location Group (3 filters)
UPDATE search.filter_definitions
SET "group" = 'Location'
WHERE filter_key IN ('indoor', 'outdoor', 'submersible')
AND active = true;

-- Options Group (3 filters)
UPDATE search.filter_definitions
SET "group" = 'Options'
WHERE filter_key IN ('trimless', 'cut_shape_round', 'cut_shape_rectangular')
AND active = true;

-- Electricals Group (3 existing filters)
UPDATE search.filter_definitions
SET "group" = 'Electricals'
WHERE filter_key IN ('voltage', 'dimmable', 'class')
AND active = true;

-- Design Group (2 existing filters)
UPDATE search.filter_definitions
SET "group" = 'Design'
WHERE filter_key IN ('ip', 'finishing_colour')
AND active = true;

-- Light Group (3 existing filters - rename from "light_engine")
UPDATE search.filter_definitions
SET "group" = 'Light'
WHERE filter_key IN ('cct', 'cri', 'lumens_output')
AND active = true;

-- ============================================================================
-- PART 3: Activate Phase 2 Filters (6 filters)
-- ============================================================================

-- Electricals: light_source
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Electricals'
WHERE filter_key = 'light_source';

-- Electricals: dimming_dali (if exists)
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Electricals'
WHERE filter_key = 'dimming_dali';

-- Design: ik (IK rating)
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Design'
WHERE filter_key = 'ik';

-- Design: adjustability
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Design'
WHERE filter_key = 'adjustability';

-- Light: light_distribution
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Light'
WHERE filter_key = 'light_distribution';

-- Light: beam_angle (or beam_angle_type)
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Light'
WHERE filter_key IN ('beam_angle', 'beam_angle_type');

-- ============================================================================
-- PART 4: Activate Phase 3 Filters (3 filters)
-- ============================================================================

-- Electricals: driver_included (power supply included)
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Electricals'
WHERE filter_key = 'driver_included';

-- Design: builtin_height (min. recessed depth)
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Design'
WHERE filter_key = 'builtin_height';

-- Light: efficacy
UPDATE search.filter_definitions
SET
  active = true,
  "group" = 'Light'
WHERE filter_key = 'efficacy';

-- ============================================================================
-- PART 5: Verify and Report
-- ============================================================================

-- Add comment to document the grouping
COMMENT ON COLUMN search.filter_definitions."group" IS
'Filter group for organized UI display. Valid values: Location, Options, Electricals, Design, Light';

-- Display summary of filters by group
DO $$
DECLARE
  location_count INTEGER;
  options_count INTEGER;
  electricals_count INTEGER;
  design_count INTEGER;
  light_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO location_count FROM search.filter_definitions WHERE "group" = 'Location' AND active = true;
  SELECT COUNT(*) INTO options_count FROM search.filter_definitions WHERE "group" = 'Options' AND active = true;
  SELECT COUNT(*) INTO electricals_count FROM search.filter_definitions WHERE "group" = 'Electricals' AND active = true;
  SELECT COUNT(*) INTO design_count FROM search.filter_definitions WHERE "group" = 'Design' AND active = true;
  SELECT COUNT(*) INTO light_count FROM search.filter_definitions WHERE "group" = 'Light' AND active = true;
  SELECT COUNT(*) INTO total_count FROM search.filter_definitions WHERE active = true;

  RAISE NOTICE 'Filter Groups Summary:';
  RAISE NOTICE '  Location: % filters', location_count;
  RAISE NOTICE '  Options: % filters', options_count;
  RAISE NOTICE '  Electricals: % filters', electricals_count;
  RAISE NOTICE '  Design: % filters', design_count;
  RAISE NOTICE '  Light: % filters', light_count;
  RAISE NOTICE '  ========================';
  RAISE NOTICE '  TOTAL ACTIVE: % filters', total_count;
END $$;
