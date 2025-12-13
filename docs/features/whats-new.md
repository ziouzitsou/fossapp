# What's New Dialog System

**Feature Version**: 2.0.0
**Route**: N/A (global component)
**Added**: 2025-12-13

## Overview

The "What's New" dialog automatically shows users new features when they visit after a version update. It uses a single source of truth (`releases.json`) to ensure consistency across the dialog and any future changelog pages.

## Architecture

```
src/
├── data/
│   └── releases.json              # Single source of truth for all releases
└── components/
    └── whats-new-dialog.tsx       # Dialog component (reads from releases.json)
```

### Data Flow

```
releases.json ─────────────────────────────────────────────────────────────────
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           WhatsNewDialog Component                            │
├──────────────────────────────────────────────────────────────────────────────┤
│  1. Import releases.json                                                      │
│  2. Get latest release (first entry)                                         │
│  3. Compare version with user's lastSeenVersion                              │
│  4. Show dialog if versions differ                                           │
│  5. On close: save version to localStorage + sync to DB (if authenticated)   │
└──────────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                          UserSettingsContext                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  - lastSeenVersion: stored in localStorage (instant) + Supabase (synced)     │
│  - Cross-device sync: authenticated users see dialog once across all devices │
└──────────────────────────────────────────────────────────────────────────────┘
```

## releases.json Structure

Location: `src/data/releases.json`

```json
{
  "releases": [
    {
      "version": "1.9.7",
      "date": "2025-12-13",
      "title": "Settings Sync & Filter UX",
      "description": "Your preferences now sync across devices...",
      "features": [
        "Cross-device settings sync",
        "Filter categories start collapsed"
      ],
      "tagline": "Your preferences, everywhere you work."
    }
  ]
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Semantic version (must match package.json for current release) |
| `date` | string | Release date in YYYY-MM-DD format |
| `title` | string | Short headline (3-5 words) |
| `description` | string | One sentence summary |
| `features` | string[] | Bullet points of key changes (3-6 items recommended) |
| `tagline` | string | Memorable closing phrase (italicized in dialog) |

## Adding a New Release

### Step 1: Add Entry to releases.json

Add the new release at the **top** of the releases array:

```json
{
  "releases": [
    {
      "version": "1.10.0",
      "date": "2025-12-15",
      "title": "New Feature Name",
      "description": "Brief description of what's new.",
      "features": [
        "Feature 1 - brief explanation",
        "Feature 2 - brief explanation",
        "Feature 3 - brief explanation"
      ],
      "tagline": "A memorable closing phrase."
    },
    // ... existing releases below
  ]
}
```

### Step 2: Bump Version in package.json

```bash
npm version patch   # or minor/major
```

### Step 3: Deploy

The dialog will automatically show the new content to all users who haven't seen this version.

## Version Comparison Logic

The dialog uses exact string matching:

```typescript
if (lastSeenVersion !== LATEST_RELEASE.version) {
  // Show dialog
}
```

This means:
- `1.8.3` stored, `1.9.7` current → Dialog shows
- `1.9.7` stored, `1.9.7` current → Dialog hidden
- `null` stored (new user), any version → Dialog shows

## User Settings Sync

For authenticated users, `lastSeenVersion` is synced to Supabase:

```sql
-- Table: public.user_settings
-- Column: last_seen_version (text)
```

This ensures:
- Users see the dialog only once across all devices
- New devices pick up the stored version from the database
- Unauthenticated users fall back to localStorage

## Writing Good Release Notes

### Do

- Focus on **user benefits**, not technical details
- Use action verbs: "Create", "Find", "Export"
- Keep features to 3-6 bullet points
- Include a memorable tagline
- Write at a 6th-grade reading level

### Don't

- Include technical jargon (no "refactored", "optimized queries")
- List bug fixes (save those for CHANGELOG.md)
- Write more than one sentence per feature
- Include version numbers in feature text

### Examples

```json
// Good
{
  "title": "AI Symbol Generator",
  "features": [
    "AI-powered symbol generation - describe what you need, get a symbol",
    "New 'Public' project type for shared projects"
  ],
  "tagline": "Let AI help you create lighting symbols."
}

// Bad
{
  "title": "Symbol Gen v2 with Gemini Integration",
  "features": [
    "Implemented Gemini 1.5 Flash model for symbol analysis",
    "Fixed race condition in project creation",
    "Refactored API endpoint to use streaming responses"
  ],
  "tagline": "Technical improvements to the symbol generation pipeline."
}
```

## Testing the Dialog

### Force Show Dialog (Development)

Clear the stored version in browser console:

```javascript
localStorage.removeItem('fossapp_last_seen_version')
```

Then refresh the page. The dialog will appear after 1.5 seconds.

### Verify Database Sync

For authenticated users, check Supabase:

```sql
SELECT last_seen_version
FROM public.user_settings
WHERE email = 'user@example.com';
```

## Migration from Old System

The previous system used hardcoded content in `whats-new-dialog.tsx`. The new system:

1. Reads from `releases.json` at build time
2. Exports types for use in other components
3. Maintains all historical releases for potential changelog page

### Files to Delete (After Verification)

- `WHATS_NEW.md` - Content now in releases.json

## Future Enhancements

Potential improvements:

1. **Changelog Page** (`/changelog`) - Display all releases from releases.json
2. **Release Notifications** - Toast notifications for minor updates
3. **Release Categories** - Tag releases as "feature", "improvement", "fix"
4. **Search/Filter** - Find releases by keyword or date range

## Related Files

| File | Purpose |
|------|---------|
| `src/data/releases.json` | Release data (single source of truth) |
| `src/components/whats-new-dialog.tsx` | Dialog component |
| `src/lib/user-settings-context.tsx` | Settings sync (includes lastSeenVersion) |
| `docs/deployment/checklist.md` | Deployment steps (includes releases.json reminder) |

---

**Last Updated**: 2025-12-13
