# Theming System

FOSSAPP uses a dual-layer theming system combining light/dark mode with customizable color themes.

---

## Overview

The theming system has two independent layers:

1. **Mode** (Light/Dark/System): Controls brightness using `next-themes`
2. **Style** (Color Theme): Controls accent colors using CSS custom properties

Users can access both settings from the user dropdown menu (top-right avatar).

---

## Available Themes

| Theme | Accent Color | Description | Best For |
|-------|--------------|-------------|----------|
| **Default** | Neutral gray | Clean, professional baseline | Business, productivity |
| **Minimal** | Purple/violet | Modern, clean with purple accents | Creative, modern apps |
| **Emerald** | Green/teal | Fresh, vibrant with green accents | Nature, sustainability |
| **Ocean** | Blue | Friendly, modern with blue accents | Trust, communication |

---

## Technical Architecture

### Files Involved

| File | Purpose |
|------|---------|
| `src/app/globals.css` | CSS custom properties for all themes |
| `src/lib/theme-context.tsx` | React context for theme state |
| `src/lib/user-settings-context.tsx` | Persists theme to database |
| `src/components/user-dropdown.tsx` | UI for theme selection |
| `tailwind.config.js` | Safelist for dynamic theme classes |

### Color Format: OKLch (CSS Color Level 4)

Themes use **OKLch** color format for perceptually uniform colors:

```css
--primary: oklch(0.6231 0.188 259.8145);
/*         oklch(L     C     H)
           L = Lightness (0-1)
           C = Chroma (0-0.4, saturation)
           H = Hue (0-360, color wheel angle) */
```

**Why OKLch?**
- Perceptually uniform: Equal changes in values = equal visual changes
- Better for generating accessible color palettes
- Consistent saturation across different hues
- Modern CSS standard (CSS Color Level 4)

### Theme Class Application

Themes are applied via CSS classes on the `<html>` element:

```html
<!-- Light mode, Default theme -->
<html class="light">

<!-- Dark mode, Emerald theme -->
<html class="dark theme-emerald">

<!-- Light mode, Ocean theme -->
<html class="light theme-ocean">
```

### Tailwind Safelist (Critical)

Theme classes are added dynamically via JavaScript, so they must be safelisted in `tailwind.config.js` to prevent purging:

```javascript
module.exports = {
  safelist: [
    'theme-minimal',
    'theme-emerald',
    'theme-ocean',
  ],
  // ...
}
```

Without this, Tailwind's JIT compiler will purge the light-mode theme rules.

---

## Adding New Themes

### Step 1: Create Theme with tweakcn

1. Go to https://tweakcn.com/editor/theme
2. Design your theme (adjust colors, radius, fonts)
3. Export as JSON or get the URL

### Step 2: Convert to CSS

Run the shadcn CLI to see the CSS output:

```bash
npx shadcn@latest add https://tweakcn.com/r/themes/your-theme.json
```

This will show you the CSS custom properties. Copy them manually since shadcn doesn't support multi-theme switching natively.

### Step 3: Add Theme to globals.css

Add both light and dark mode variants:

```css
/* In @layer base */

/* Light mode */
.theme-mytheme {
  --background: oklch(...);
  --foreground: oklch(...);
  --primary: oklch(...);
  /* ... all other properties */
}

/* Dark mode */
.dark.theme-mytheme,
.dark .theme-mytheme {
  --background: oklch(...);
  --foreground: oklch(...);
  --primary: oklch(...);
  /* ... all other properties */
}
```

### Step 4: Update TypeScript Types

In `src/lib/theme-context.tsx`:

```typescript
export type Theme = 'default' | 'minimal' | 'emerald' | 'ocean' | 'mytheme'
```

In `src/lib/actions/user-settings.ts`:

```typescript
theme: 'default' | 'minimal' | 'emerald' | 'ocean' | 'mytheme'
```

### Step 5: Add to Safelist

In `tailwind.config.js`:

```javascript
safelist: [
  'theme-minimal',
  'theme-emerald',
  'theme-ocean',
  'theme-mytheme', // Add new theme
],
```

### Step 6: Update UI

In `src/components/user-dropdown.tsx`, add to `styleOptions`:

```typescript
const styleOptions = [
  // ... existing themes
  { name: 'My Theme', value: 'mytheme', color: 'oklch(...)' },
]
```

---

## Theme Sources

Current themes were created using tweakcn:

| Theme | Source |
|-------|--------|
| Default | shadcn default (neutral) |
| Minimal | https://tweakcn.com/r/themes/modern-minimal.json |
| Emerald | https://tweakcn.com/r/themes/supabase.json |
| Ocean | https://tweakcn.com/r/themes/twitter.json |

---

## CSS Custom Properties Reference

Each theme defines these CSS custom properties:

### Core Colors
- `--background` / `--foreground`
- `--card` / `--card-foreground`
- `--popover` / `--popover-foreground`
- `--primary` / `--primary-foreground`
- `--secondary` / `--secondary-foreground`
- `--muted` / `--muted-foreground`
- `--accent` / `--accent-foreground`
- `--destructive` / `--destructive-foreground`

### UI Elements
- `--border`
- `--input`
- `--ring`
- `--radius`

### Sidebar (specific to FOSSAPP)
- `--sidebar` / `--sidebar-foreground`
- `--sidebar-primary` / `--sidebar-primary-foreground`
- `--sidebar-accent` / `--sidebar-accent-foreground`
- `--sidebar-border`
- `--sidebar-ring`
- `--sidebar-background`

### Charts
- `--chart-1` through `--chart-5`

### Typography
- `--font-sans`
- `--font-serif`
- `--font-mono`

---

## Troubleshooting

### Theme not applying in light mode

**Symptom**: Dark mode works but light mode shows wrong colors.

**Cause**: Tailwind purged the light-mode theme class rules.

**Fix**: Add the theme class to `safelist` in `tailwind.config.js`.

### Background appears transparent

**Symptom**: Page background is transparent/see-through.

**Cause**: Using `hsl()` wrapper with `oklch()` values in Tailwind config.

**Fix**: Use `var(--prop)` directly without `hsl()` wrapper:

```javascript
// WRONG
background: 'hsl(var(--background))',

// CORRECT
background: 'var(--background)',
```

### Theme persists across sessions unexpectedly

**Symptom**: Theme persists for logged-in users.

**Cause**: Theme is stored in `user_settings` database table.

**Fix**: This is expected behavior. Clear via user dropdown or database.

---

## Resources

- **tweakcn Theme Editor**: https://tweakcn.com/editor/theme
- **OKLch Color Picker**: https://oklch.com/
- **shadcn/ui Theming**: https://ui.shadcn.com/docs/theming
- **CSS Color Level 4**: https://www.w3.org/TR/css-color-4/

---

**Last Updated**: 2025-12-27 (v1.12.5)
