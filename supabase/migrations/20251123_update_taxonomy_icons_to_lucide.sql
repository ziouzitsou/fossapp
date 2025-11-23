-- Migration: Update taxonomy icons from emojis to Lucide icon names
-- Date: 2025-11-23
-- Description: Replace emoji icons with Lucide React icon names for consistent rendering

-- Update root category icons
UPDATE search.taxonomy
SET icon = CASE code
    WHEN 'LUMINAIRE' THEN 'Lightbulb'
    WHEN 'ACCESSORIES' THEN 'Plug'
    WHEN 'DRIVERS' THEN 'Zap'
    WHEN 'LAMPS' THEN 'Lamp'
    WHEN 'MISC' THEN 'Package'
    ELSE icon
END
WHERE level = 1 AND code IN ('LUMINAIRE', 'ACCESSORIES', 'DRIVERS', 'LAMPS', 'MISC');

-- Add comment to document the change
COMMENT ON COLUMN search.taxonomy.icon IS
'Lucide React icon name (e.g., "Lightbulb", "Zap", "Package"). See https://lucide.dev for available icons.';
