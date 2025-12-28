# Symbol Classification System

**Status**: Production
**Settings Route**: `/settings/symbols`
**Last Updated**: 2025-12-28

## Overview

The Symbol Classification System automatically assigns single-letter codes (A-P) to lighting products for use in architectural drawings and lighting design documentation. These symbols provide a standardized way to identify product types in AutoCAD plan views and specification schedules.

**Key Concept**: Products are classified based on their **ETIM class** (product category) and **IP rating** (indoor/outdoor suitability). The system uses a rule-based approach with priority ordering to handle edge cases.

## Symbol Reference

| Symbol | Name | ETIM Class | IP Range | Description |
|--------|------|------------|----------|-------------|
| **A** | Interior Spots | EC001744 | < 54 | Indoor recessed/surface spots, downlights |
| **B** | Suspension | EC001743 | Any | Pendant/hanging luminaires |
| **C** | Exterior Spots | EC001744 | ≥ 54 | Outdoor recessed/surface spots |
| **D** | LED Tapes | EC002706 | < 67 | Indoor flexible LED strips |
| **E** | LED Tapes IP67 | EC002706 | ≥ 67 | Waterproof LED strips |
| **F** | Interior Wall | EC002892 | < 54 | Indoor wall-mounted fixtures |
| **G** | Exterior Wall | EC002892 | ≥ 54 | Outdoor wall-mounted fixtures |
| **H** | Floor Lights | EC000300 | Any | Standing floor lamps |
| **K** | Table | EC000302 | Any | Desk and table lamps |
| **M** | Profiles | EC004966 | Any | Aluminum profiles (inactive) |
| **N** | Track Light | EC000101 | Any | Track lighting systems |
| **P** | Underwater | EC000758 | ≥ 67 | Pool & fountain lights (priority 50) |

> **Note**: Symbol "P" (Underwater) has priority 50 to ensure it's evaluated before other in-ground luminaires.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Product Classification Flow                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Product (foss_pid)                                              │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────┐                                         │
│  │ get_product_symbol()│  ◄── PostgreSQL function                │
│  └─────────────────────┘                                         │
│       │                                                          │
│       ├── 1. Lookup product → Get ETIM class                     │
│       ├── 2. Extract IP rating (EF003118 or EF005474)            │
│       ├── 3. Loop through rules (ordered by priority)            │
│       │      ├── Match ETIM class (required)                     │
│       │      ├── Match IP range (optional)                       │
│       │      ├── Match text pattern (optional)                   │
│       │      ├── Check required features (optional)              │
│       │      └── Check excluded features (optional)              │
│       │                                                          │
│       ▼                                                          │
│  Return: Symbol (A-P) or NULL                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Database Schema

### Table: `items.symbol_rules`

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Primary key (auto-increment) |
| `symbol` | varchar | 1-2 character code (A, B, C...) |
| `name` | text | Human-readable name |
| `description` | text | Detailed description |
| `etim_class` | text | ETIM class ID (e.g., EC001744) - **required** |
| `etim_class_desc` | text | ETIM class description (cached) |
| `etim_group` | text | Optional ETIM group filter |
| `ip_min` | integer | Minimum IP rating (inclusive) |
| `ip_max` | integer | Maximum IP rating (exclusive) |
| `text_pattern` | text | Optional ILIKE pattern for description |
| `required_features` | text[] | ETIM feature IDs that MUST be present |
| `excluded_features` | text[] | ETIM feature IDs that MUST NOT be present |
| `priority` | integer | Lower = evaluated first (default: 100) |
| `is_active` | boolean | Whether rule is active (default: true) |
| `notes` | text | Internal notes |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### Function: `items.get_product_symbol(foss_pid text)`

Returns the symbol code for a product based on the classification rules.

```sql
-- Example usage
SELECT items.get_product_symbol('DT20229692W');  -- Returns 'A'

-- Bulk classification
SELECT foss_pid, items.get_product_symbol(foss_pid) as symbol
FROM items.product
WHERE supplier_id = 'some-supplier'
LIMIT 100;
```

**Algorithm**:
1. Lookup product details (ETIM class, description)
2. Extract IP rating from features EF003118 (front) or EF005474 (general)
3. Default IP to 20 if not found (assume indoor)
4. Loop through active rules ordered by priority ASC, symbol ASC
5. For each rule, check all conditions (ETIM class, IP range, text pattern, features)
6. Return first matching symbol, or NULL if no match

## Settings Page

**Route**: `/settings/symbols`
**Access**: Authenticated users only

The settings page displays all classification rules in a read-only table format:

- **Symbol**: Badge showing the letter code
- **Name**: Rule name (e.g., "Interior Spots")
- **ETIM Class**: Class ID and description
- **IP Range**: Formatted range (e.g., "IP 54+", "IP <54", "54-67")
- **Status**: Active/Inactive badge
- **Notes**: Additional information

### File Structure

```
src/
├── app/settings/symbols/
│   └── page.tsx              # Read-only rules table
└── lib/actions/
    └── symbols.ts            # Server action: getSymbolRulesAction()
```

## Rule Matching Logic

### Priority System

Rules are evaluated in order of:
1. `priority` ASC (lower numbers first)
2. `symbol` ASC (alphabetical tiebreaker)

This allows special cases (like underwater lights) to be checked before general rules.

### IP Rating Interpretation

| `ip_min` | `ip_max` | Meaning |
|----------|----------|---------|
| NULL | 54 | IP < 54 (indoor) |
| 54 | NULL | IP ≥ 54 (outdoor) |
| 54 | 67 | 54 ≤ IP < 67 |
| NULL | NULL | Any IP rating |

### Feature Matching

- **required_features**: ALL listed ETIM feature IDs must be present
- **excluded_features**: NONE of the listed ETIM feature IDs may be present

Example: A rule could require `EF009351` (adjustability) to only match adjustable fixtures.

## Usage in the Application

### Where Symbols Are Used

1. **Tile Generation**: Symbols appear in DWG block names and attributes
2. **Product Schedules**: Grouped by symbol in lighting schedules
3. **Drawing Legends**: Symbol key for plan view interpretation
4. **Export Reports**: Classification column in exports

### Example Integration

```typescript
// In a server action or API route
import { supabaseServer } from '@fossapp/core/db'

async function getProductWithSymbol(fossPid: string) {
  const { data } = await supabaseServer
    .schema('items')
    .rpc('get_product_symbol', { p_foss_pid: fossPid })

  return data  // 'A', 'B', 'C', etc. or null
}
```

## Future Enhancement: CRUD Interface

> **Status**: Planned (not implemented)

For users managing many products or requiring custom classification rules, a full CRUD interface could be added:

### Proposed Features

1. **Create Rules**
   - Form to add new symbol rules
   - ETIM class picker (searchable dropdown)
   - IP range inputs with validation
   - Priority ordering with drag-and-drop

2. **Edit Rules**
   - Inline editing or modal form
   - Update ETIM class, IP ranges, features
   - Toggle active/inactive status

3. **Delete Rules**
   - Soft delete (set `is_active = false`) or hard delete
   - Confirmation dialog with impact preview

4. **Bulk Operations**
   - Import rules from CSV/JSON
   - Export current ruleset
   - Clone rules for variations

### Implementation Considerations

```
src/
├── app/settings/symbols/
│   ├── page.tsx              # Rules list with CRUD actions
│   └── components/
│       ├── symbol-rule-form.tsx    # Create/Edit form
│       ├── symbol-rule-table.tsx   # DataTable with actions
│       └── etim-class-picker.tsx   # Searchable class selector
└── lib/actions/symbols/
    ├── index.ts              # Barrel export
    ├── get-rules.ts          # Read operations
    ├── create-rule.ts        # Create with validation
    ├── update-rule.ts        # Update with validation
    └── delete-rule.ts        # Delete operations
```

### Validation Rules

- Symbol must be unique per ETIM class + IP range combination
- Priority must be positive integer
- ETIM class must exist in `etim.class` table
- IP ranges must be valid (min < max when both specified)

### When to Implement

Consider implementing CRUD when:
- Users need to add custom product categories not in ETIM
- Multiple suppliers have different classification needs
- Frequent rule updates are required
- Self-service rule management is preferred over developer changes

## Related Documentation

- [Symbol Generator](./symbol-generator.md) - Vision LLM tool for AutoCAD symbol specs (different feature)
- [Tiles](./tiles.md) - DWG tile generation (uses symbol classification)
- [Database Schema](../database/schema.md) - Full database documentation

---

**Last Updated**: 2025-12-28
