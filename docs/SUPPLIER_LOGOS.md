# Supplier Logo Implementation Guide

This document provides step-by-step instructions for adding theme-aware logos for new suppliers in FOSSAPP.

**Last Updated**: 2025-10-27

---

## Overview

FOSSAPP supports dual logos (light/dark theme) for suppliers. Logos are stored in Supabase Storage and automatically switch based on user theme preference.

**Implemented Suppliers:**
- ✅ Delta Light (active with products)
- ✅ Meyer Lighting (active with products)
- ✅ AQForm (logos ready, awaiting products)

---

## Logo Requirements

### Technical Specifications
- **Format**: SVG (preferred for scalability)
- **Dimensions**: 120x40 viewBox (aspect ratio 3:1)
- **File Size**: Keep under 50KB
- **Colors**:
  - Light theme: Black (`#000000`) or dark colors
  - Dark theme: White (`#FFFFFF`) or light colors

### Design Guidelines
- Clean, simple vector graphics
- Avoid gradients or complex effects
- Ensure text is readable at small sizes
- Test visibility on both light and dark backgrounds

---

## Step-by-Step Implementation

### 1. Create Logo Files

**Using Inkscape or SVG Editor:**

1. Open/create the original logo SVG
2. Create two versions:
   - `{supplier-name}-logo-light.svg` - Black/dark version
   - `{supplier-name}-logo-dark.svg` - White/light version

**Quick SVG Conversion Method:**

```bash
# Copy original to light version
cp "Original Logo.svg" "supplier-logo-light.svg"

# Edit light version - add fill="#000000" to main <path> or <g> element
# Remove any unused <style> sections

# Copy light version to dark version
cp "supplier-logo-light.svg" "supplier-logo-dark.svg"

# Edit dark version - change fill to fill="#FFFFFF"
```

**Example Light Logo Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
  <path d="..." fill="#000000" fill-rule="evenodd"/>
</svg>
```

**Example Dark Logo Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<svg version="1.1" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg">
  <path d="..." fill="#FFFFFF" fill-rule="evenodd"/>
</svg>
```

### 2. Verify Logo Quality

Use Playwright MCP to visually verify:

```bash
# Open light version in browser
navigate to file:///path/to/supplier-logo-light.svg
# Take screenshot
# Close browser

# Open dark version
navigate to file:///path/to/supplier-logo-dark.svg
# Take screenshot (will appear white on white - expected)
# Close browser
```

**Important**: Always close browser after verification per user preference.

### 3. Upload to Supabase Storage

**Manual Upload:**
1. Go to Supabase Dashboard → Storage → `images` bucket
2. Upload both files to the root level (not in subdirectory)
3. Verify files are public

**Verify Upload via SQL:**
```sql
SELECT name, created_at
FROM storage.objects
WHERE bucket_id = 'images'
  AND name LIKE '%supplier-name%'
ORDER BY created_at DESC;
```

### 4. Update Supplier Table

**Check if Supplier Exists:**
```sql
SELECT supplier_name, logo, logo_dark
FROM items.supplier
WHERE supplier_name ILIKE '%Supplier Name%';
```

**Update Logo URLs:**
```sql
UPDATE items.supplier
SET
  logo = 'https://hyppizgiozyyyelwdius.supabase.co/storage/v1/object/public/images/supplier-logo-light.svg',
  logo_dark = 'https://hyppizgiozyyyelwdius.supabase.co/storage/v1/object/public/images/supplier-logo-dark.svg'
WHERE supplier_name = 'Exact Supplier Name';

-- Verify update
SELECT supplier_name, logo, logo_dark
FROM items.supplier
WHERE supplier_name = 'Exact Supplier Name';
```

### 5. Refresh Materialized View

**CRITICAL**: Must refresh to propagate changes to product pages.

```sql
REFRESH MATERIALIZED VIEW items.product_info;

SELECT 'Materialized view refreshed successfully' as status;
```

### 6. Test on Product Pages

1. Find a product from the supplier:
```sql
SELECT product_id, foss_pid, description_short, supplier_name
FROM items.product_info
WHERE supplier_name = 'Exact Supplier Name'
LIMIT 5;
```

2. Navigate to product detail page:
   - Development: `http://localhost:8080/products/{product_id}`
   - Production: `https://app.titancnc.eu/products/{product_id}`

3. Test theme switching:
   - Toggle between light and dark mode
   - Verify logo changes color appropriately
   - Check logo doesn't have sizing/positioning issues

---

## Naming Conventions

**File Naming:**
- Use lowercase with hyphens
- Format: `{supplier-slug}-logo-{theme}.svg`
- Examples:
  - `delta-light-logo-light.svg`
  - `delta-light-logo-dark.svg`
  - `meyer-logo-light.svg`
  - `meyer-logo-dark.svg`
  - `aq-form-logo-light.svg`
  - `aq-form-logo-dark.svg`

**URL Pattern:**
```
https://hyppizgiozyyyelwdius.supabase.co/storage/v1/object/public/images/{filename}.svg
```

---

## Database Schema

### items.supplier Table
```sql
CREATE TABLE items.supplier (
  supplier_name TEXT PRIMARY KEY,
  logo TEXT,           -- URL to light theme logo
  logo_dark TEXT,      -- URL to dark theme logo
  -- other fields...
);
```

### items.product_info Materialized View
Includes `supplier_logo` and `supplier_logo_dark` fields propagated from supplier table.

---

## Frontend Implementation

The product detail page (`src/app/products/[id]/page.tsx`) handles logo display:

```typescript
interface ProductDetail {
  supplier_name: string
  supplier_logo?: string      // Light theme URL
  supplier_logo_dark?: string // Dark theme URL
  // ...
}

// Logo selection logic
const { resolvedTheme } = useTheme()
const [mounted, setMounted] = useState(false)

useEffect(() => {
  setMounted(true)
}, [])

// Render logo with theme awareness
{mounted && !logoError && (product.supplier_logo || product.supplier_logo_dark) && (() => {
  const logoUrl = resolvedTheme === 'dark' && product.supplier_logo_dark
    ? product.supplier_logo_dark
    : product.supplier_logo
  return logoUrl ? (
    <Image
      src={logoUrl}
      alt={product.supplier_name}
      width={60}
      height={40}
      className="object-contain"
      onError={() => setLogoError(true)}
    />
  ) : null
})()}
```

**Key Points:**
- Uses `resolvedTheme` from `next-themes`
- Waits for `mounted` state to prevent SSR hydration mismatch
- Falls back to light logo if dark logo not available
- Graceful error handling with `onError`

---

## Troubleshooting

### Logo Not Displaying

**Check 1: Verify URLs are correct**
```sql
SELECT supplier_name, logo, logo_dark
FROM items.supplier
WHERE supplier_name = 'Supplier Name';
```

**Check 2: Verify files exist in storage**
```sql
SELECT name, bucket_id, created_at
FROM storage.objects
WHERE name LIKE '%supplier%';
```

**Check 3: Test URL directly in browser**
```
https://hyppizgiozyyyelwdius.supabase.co/storage/v1/object/public/images/supplier-logo-light.svg
```

**Check 4: Verify materialized view was refreshed**
```sql
SELECT supplier_name, supplier_logo, supplier_logo_dark
FROM items.product_info
WHERE supplier_name = 'Supplier Name'
LIMIT 1;
```

**Check 5: Verify Next.js image domain is allowed**

In `next.config.ts`, ensure Supabase storage domain is in `remotePatterns`:
```typescript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'hyppizgiozyyyelwdius.supabase.co',
      port: '',
      pathname: '/storage/v1/object/public/**',
    },
  ],
}
```

### Logo Not Switching Themes

**Check 1: Verify server action returns both logos**

In `src/lib/actions.ts`, ensure `getProductByIdAction` includes:
```typescript
return {
  // ...
  supplier_logo: data.supplier_logo,
  supplier_logo_dark: data.supplier_logo_dark,  // Must be present!
  // ...
}
```

**Check 2: Verify theme detection**
```typescript
const { theme, resolvedTheme } = useTheme()
console.log('Theme:', theme, 'Resolved:', resolvedTheme)
```

**Check 3: Check mounted state**
```typescript
const [mounted, setMounted] = useState(false)
useEffect(() => {
  setMounted(true)
}, [])
```

### Logo Quality Issues

**SVG appears pixelated:**
- Ensure SVG has proper viewBox attribute
- Use vector paths, not embedded images
- Check if SVG was exported correctly from design tool

**Logo too large/small:**
- Adjust `width` and `height` props on Image component
- Use `className="object-contain"` for proper scaling

**Logo colors look wrong:**
- Verify fill colors are exactly `#000000` (light) and `#FFFFFF` (dark)
- Remove any CSS styles that override fill colors
- Check if gradients or filters were accidentally included

---

## Quick Reference Commands

### Create logos from original
```bash
cd "/mnt/c/Users/chris/Foss Google Drive/Images/Logos/SupplierName"
cp "Original.svg" "supplier-logo-light.svg"
# Edit: add fill="#000000"
cp "supplier-logo-light.svg" "supplier-logo-dark.svg"
# Edit: change to fill="#FFFFFF"
```

### Verify upload
```sql
SELECT name FROM storage.objects
WHERE bucket_id = 'images' AND name LIKE '%supplier%';
```

### Update supplier
```sql
UPDATE items.supplier SET
  logo = 'https://hyppizgiozyyyelwdius.supabase.co/storage/v1/object/public/images/supplier-logo-light.svg',
  logo_dark = 'https://hyppizgiozyyyelwdius.supabase.co/storage/v1/object/public/images/supplier-logo-dark.svg'
WHERE supplier_name = 'Supplier Name';

REFRESH MATERIALIZED VIEW items.product_info;
```

---

## Future Suppliers

**Pending Logo Creation:**
- DGA (if/when products are added)
- Any new suppliers added to the catalog

**Storage Location:**
`/mnt/c/Users/chris/Foss Google Drive/Images/Logos/{SupplierName}/`

---

## Notes

- Always close Playwright browser after verification (user preference)
- Logo files should be stored in Google Drive for backup
- Supabase Storage is the source of truth for production
- Materialized view refresh can take 10-30 seconds depending on data volume
- Test on both development and production before considering complete

---

**Maintained by**: Claude Code
**Last Updated**: 2025-10-27
