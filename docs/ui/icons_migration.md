# Icon Migration Guide

**Date**: 2025-11-23
**Status**: Active

## Overview

FOSSAPP uses **Lucide React** icons instead of emojis for consistent, professional-looking icons across all platforms and browsers. This guide explains how to migrate from emoji-based icons to Lucide icons.

## Why Lucide Icons?

- **Consistency**: Same appearance across all operating systems and browsers
- **Scalability**: Vector-based icons that scale perfectly at any size
- **Customization**: Easy to style with Tailwind CSS classes
- **Professional**: Modern, clean icon design
- **Integration**: Works seamlessly with shadcn/ui components

## Architecture

### IconMapper Component

**Location**: `src/components/icon-mapper.tsx`

The `IconMapper` component maps string icon names from the database to actual Lucide React icon components.

```tsx
// Usage
import { IconMapper } from '@/components/icon-mapper'

<IconMapper name="Lightbulb" className="w-6 h-6" />
<IconMapper name="Scissors" className="w-5 h-5 text-blue-500" />
```

### Icon Storage

Icons are stored as **text strings** (not emojis) in the database:

1. **Taxonomy Icons** (`search.taxonomy` table)
   - Column: `icon` (TEXT)
   - Example: `"Lightbulb"`, `"Package"`, `"Zap"`

2. **Filter Icons** (`search.filter_definitions` table)
   - Column: `ui_config` (JSONB)
   - Path: `ui_config.icon`
   - Example: `{"icon": "Scissors", "filter_category": "options"}`

## Migration Procedure

### Step 1: Find Icons to Migrate

#### For Taxonomy Icons
```sql
SELECT code, name, icon, level
FROM search.taxonomy
WHERE icon ~ '[^\x00-\x7F]'  -- Find non-ASCII (emojis)
ORDER BY level, display_order;
```

#### For Filter Icons
```sql
SELECT id, filter_key, label, ui_config
FROM search.filter_definitions
WHERE ui_config::text ~ '[^\x00-\x7F]'  -- Find emojis in JSONB
ORDER BY display_order;
```

### Step 2: Choose Lucide Icons

1. Browse available icons at: https://lucide.dev
2. Search for icons that match the concept (e.g., "scissors", "lightbulb")
3. Note the exact icon name (PascalCase, e.g., `Scissors`, `Lightbulb`)

### Step 3: Add Icon to IconMapper

Edit `src/components/icon-mapper.tsx`:

```tsx
// 1. Import the icon
import {
  Lightbulb,
  Scissors,  // Add new import
  // ... other imports
  LucideIcon
} from 'lucide-react'

// 2. Add to iconMap
const iconMap: Record<string, LucideIcon> = {
  Lightbulb: Lightbulb,
  Scissors: Scissors,  // Add to map
  // ... other mappings
}
```

### Step 4: Update Database

#### For Taxonomy Icons
```sql
-- Single update
UPDATE search.taxonomy
SET icon = 'Lightbulb'
WHERE code = 'LUMINAIRE';

-- Batch update
UPDATE search.taxonomy
SET icon = CASE code
    WHEN 'LUMINAIRE' THEN 'Lightbulb'
    WHEN 'ACCESSORIES' THEN 'Plug'
    WHEN 'DRIVERS' THEN 'Zap'
    WHEN 'LAMPS' THEN 'Lamp'
    WHEN 'MISC' THEN 'Package'
    ELSE icon
END
WHERE code IN ('LUMINAIRE', 'ACCESSORIES', 'DRIVERS', 'LAMPS', 'MISC');
```

#### For Filter Icons
```sql
-- Update icon in JSONB ui_config
UPDATE search.filter_definitions
SET ui_config = jsonb_set(ui_config, '{icon}', '"Scissors"'::jsonb)
WHERE filter_key = 'trimless';
```

### Step 5: Create Migration File

Create a migration file for production deployment:

```sql
-- supabase/migrations/YYYYMMDD_migrate_icons_description.sql

-- Add comment for documentation
COMMENT ON COLUMN search.taxonomy.icon IS
'Lucide React icon name (e.g., "Lightbulb", "Zap"). See https://lucide.dev';

-- Update taxonomy icons
UPDATE search.taxonomy
SET icon = CASE code
    WHEN 'YOUR_CODE' THEN 'IconName'
    -- ... more cases
END
WHERE code IN ('YOUR_CODE', ...);

-- Update filter icons
UPDATE search.filter_definitions
SET ui_config = jsonb_set(ui_config, '{icon}', '"IconName"'::jsonb)
WHERE filter_key = 'your_filter';
```

### Step 6: Update UI Components

Ensure your UI components use `IconMapper`:

```tsx
// ❌ OLD: Rendering emoji directly
<span className="text-2xl">{category.icon}</span>

// ✅ NEW: Using IconMapper
<IconMapper name={category.icon} className="w-8 h-8" />
```

## Common Icon Mappings

### Taxonomy Categories

| Category | Emoji | Lucide Icon |
|----------|-------|-------------|
| Luminaires | 💡 | `Lightbulb` |
| Accessories | 🔌 | `Plug` |
| Drivers | ⚡ | `Zap` |
| Lamps | 🔦 | `Lamp` |
| Miscellaneous | 📦 | `Package` |

### Filter Options

| Filter | Emoji | Lucide Icon |
|--------|-------|-------------|
| Trimless | ✂️ | `Scissors` |
| Round Cut | ⭕ | `Circle` |
| Rectangular Cut | ⬜ | `Square` |

## Available Icons in IconMapper

Current icons available (see `src/components/icon-mapper.tsx`):

- `Lightbulb` - Light sources
- `Plug` - Power/connections
- `Zap` - Electricity/drivers
- `Lamp` - Lamp products
- `Package` - Miscellaneous items
- `Scissors` - Cutting/trimless
- `Home` - Residential
- `Building` - Commercial
- `Factory` - Industrial
- `ShoppingCart` - Orders/purchases
- `Settings` - Configuration
- `HelpCircle` - Fallback/unknown

## Adding New Icons

To add a new icon to the system:

1. **Choose icon** from https://lucide.dev
2. **Import in IconMapper**:
   ```tsx
   import { YourIcon } from 'lucide-react'
   ```
3. **Add to iconMap**:
   ```tsx
   const iconMap: Record<string, LucideIcon> = {
     YourIcon: YourIcon,
     // ...
   }
   ```
4. **Store in database** as `"YourIcon"` (string, not emoji)
5. **Render with IconMapper**:
   ```tsx
   <IconMapper name="YourIcon" className="w-6 h-6" />
   ```

## Styling Icons

Icons inherit text color and can be styled with Tailwind:

```tsx
// Size
<IconMapper name="Lightbulb" className="w-4 h-4" />  // Small
<IconMapper name="Lightbulb" className="w-6 h-6" />  // Medium
<IconMapper name="Lightbulb" className="w-8 h-8" />  // Large

// Color
<IconMapper name="Lightbulb" className="w-6 h-6 text-blue-500" />
<IconMapper name="Lightbulb" className="w-6 h-6 text-primary" />

// Combined with other styles
<IconMapper
  name="Lightbulb"
  className="w-6 h-6 text-amber-500 hover:text-amber-600 transition-colors"
/>
```

## Fallback Handling

IconMapper uses `HelpCircle` as fallback for:
- Unknown icon names
- Null/undefined values
- Icons not yet added to iconMap

You can specify a custom fallback:

```tsx
import { AlertTriangle } from 'lucide-react'

<IconMapper
  name={unknownIcon}
  fallback={AlertTriangle}
  className="w-6 h-6"
/>
```

## Verification

After migration, verify icons are working:

1. **Visual Check**: Load pages with icons in browser
2. **Console Check**: No errors about missing icons
3. **Database Check**:
   ```sql
   -- Verify no emojis remain
   SELECT code, name, icon
   FROM search.taxonomy
   WHERE icon ~ '[^\x00-\x7F]';

   -- Should return empty
   ```

## Troubleshooting

### Icon Not Displaying

1. Check icon is imported in `IconMapper`
2. Check icon is added to `iconMap`
3. Check database value matches icon name exactly (case-sensitive)
4. Check `IconMapper` component is used (not rendering string directly)

### Wrong Icon Appearing

- Verify database value matches intended icon name
- Check for typos (icon names are case-sensitive)
- Clear browser cache and refresh

### HelpCircle (?) Icon Shows

- Icon name not found in `iconMap`
- Add icon to IconMapper following "Adding New Icons" procedure

## Related Files

- **Component**: `src/components/icon-mapper.tsx`
- **Taxonomy Usage**: `src/app/products/page.tsx` (line 552)
- **Migrations**: `supabase/migrations/20251123_update_taxonomy_icons_to_lucide.sql`
- **Icon Library**: https://lucide.dev

## Migration History

### 2025-11-23: Initial Icon Migration
- Migrated taxonomy category icons (5 icons)
- Migrated filter icon: Trimless/Scissors
- Created IconMapper component
- Established migration procedures

## Future Enhancements

- [ ] Migrate all remaining emoji icons in `filter_definitions`
- [ ] Add icon picker UI for admin panel
- [ ] Document additional commonly-used icons
- [ ] Consider icon size variants (sm, md, lg helpers)

## Questions?

For questions about icon migration or to request new icons, see:
- **Lucide Docs**: https://lucide.dev
- **shadcn/ui Icons**: https://ui.shadcn.com/docs/components/icons
- **Project CLAUDE.md**: Component architecture section
