# Supabase GitHub Integration

**Last Updated**: 2025-12-19
**Status**: Active
**CLI Version**: 2.67.1 (installed at `~/.local/bin/supabase`)

---

## Overview

FOSSAPP uses Supabase GitHub integration for:
- Automatic preview databases for pull requests
- Migration management via git
- Isolated test environments per feature branch

**Project Details**:
| Item | Value |
|------|-------|
| Project ID | `hyppizgiozyyyelwdius` |
| Production URL | https://hyppizgiozyyyelwdius.supabase.co |
| Repository | `ziouzitsou/fossapp` |
| Supabase Directory | `.` (root - looks for `supabase/` folder) |

---

## Branch Types

### Preview Branches (Ephemeral)
- Created automatically when PR has migration changes
- **Auto-deleted**: After 24h inactivity OR when PR is merged/closed
- Paused first, then deleted
- Good for: Short-lived feature PRs

### Persistent Branches
- Never auto-deleted
- Stay until manually deleted
- Good for: Long-running features, staging environments

**Convert to persistent**:
```bash
source .env.local  # Has SUPABASE_ACCESS_TOKEN
~/.local/bin/supabase branches update <branch-id> --persistent
```

---

## Migration File Format

**CRITICAL**: Filename must use `YYYYMMDDHHMMSS` format (14 digits, no separators).

```
supabase/migrations/
├── 00000000000000_baseline.sql      # Full schema baseline
└── 20251219150000_my_feature.sql    # New migration
```

**Correct**: `20251219150000_add_reviews.sql`
**Wrong**: `20251219_add_reviews.sql` (missing HHMMSS)

### Creating Migrations

```bash
# Manual (recommended for simple changes)
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql

# With CLI
~/.local/bin/supabase migration new description
```

---

## Baseline Migration

Preview branches build from scratch using migrations in the repo. If your production database has migrations not in the repo, preview branches will fail.

**Our setup**: `00000000000000_baseline.sql` (8793 lines) captures the full production schema.

### Creating/Updating Baseline

```bash
# 1. Login
~/.local/bin/supabase login

# 2. Link project
~/.local/bin/supabase link --project-ref hyppizgiozyyyelwdius

# 3. Dump schema
~/.local/bin/supabase db dump -f supabase/migrations/00000000000000_baseline.sql

# 4. Mark as applied in production (so it doesn't re-run)
# Run in Supabase SQL Editor:
INSERT INTO supabase_migrations.schema_migrations (version, name, statements_applied)
VALUES ('00000000000000', 'baseline', 0)
ON CONFLICT (version) DO NOTHING;
```

---

## Seed Data

Preview branches have schema only, no production data. Use `supabase/seed.sql` for test data.

**Location**: `supabase/seed.sql`
**Config**: `supabase/config.toml` → `sql_paths = ["./seed.sql"]`

**Current seed includes**:
- 2 customers
- 2 projects
- 2 project versions

**Not seeded** (complex FK dependencies):
- Products (requires `catalog_id`, `supplier_id` FKs)
- Project products (requires product IDs)

### Seed Best Practices

```sql
BEGIN;

INSERT INTO table (id, ...)
VALUES (...)
ON CONFLICT (id) DO NOTHING;  -- Idempotent

COMMIT;
```

- Use `ON CONFLICT DO NOTHING` for idempotency
- Use explicit UUIDs (not `gen_random_uuid()`) for reproducibility
- Don't insert into generated columns
- Comment complex FK dependencies you're skipping

---

## Workflow

### New Feature with Database Changes

```bash
# 1. Create branch
git checkout -b feature/my-change

# 2. Create migration
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_my_change.sql
# Write SQL

# 3. Push and create PR
git add . && git commit -m "feat: add my_change migration"
git push -u origin feature/my-change
gh pr create

# 4. Supabase creates preview branch automatically
#    - Applies baseline + all migrations
#    - Runs seed.sql
#    - Posts preview URL in PR

# 5. Test against preview database
NEXT_PUBLIC_SUPABASE_URL=https://<preview-ref>.supabase.co npm run dev

# 6. Merge PR
#    - Migration applied to production
#    - Preview branch deleted (unless persistent)
```

### Destructive Changes (DROP, ALTER)

**Important**: Supabase applies migrations forward-only. There's no automatic rollback.

For destructive changes:
1. Test thoroughly on preview branch
2. Have a rollback migration ready (don't apply, just have it)
3. Consider backup before merge

```sql
-- Migration: 20251220120000_drop_old_table.sql
DROP TABLE IF EXISTS old_table;

-- Rollback (keep as comment):
-- CREATE TABLE old_table (...);  -- Restore from backup
```

---

## CLI Commands

```bash
# Authentication
~/.local/bin/supabase login
~/.local/bin/supabase link --project-ref hyppizgiozyyyelwdius

# Branches
~/.local/bin/supabase branches list
~/.local/bin/supabase branches update <id> --persistent

# Schema dump
~/.local/bin/supabase db dump -f output.sql

# Push migrations to production (alternative to GitHub)
~/.local/bin/supabase db push
```

**Note**: CLI respects `SUPABASE_ACCESS_TOKEN` env var (stored in `.env.local`).

---

## Troubleshooting

### Preview Branch Shows MIGRATIONS_FAILED

**Common causes**:
1. Migration filename wrong format (needs `YYYYMMDDHHMMSS`)
2. Missing baseline migration
3. SQL syntax error

**Fix**: Check Supabase Dashboard → Branches → View logs

### Main Branch Shows MIGRATIONS_FAILED

This is normal if production has migrations not in repo. Preview branches use their own baseline.

### Seed Errors

**"column X does not exist"**: Wrong column name - check actual schema
**"violates foreign key constraint"**: Missing parent record - seed parents first
**"cannot insert into generated column"**: Remove that column from INSERT

### Branch Not Created for PR

1. Check PR modifies `supabase/migrations/`
2. Verify GitHub integration active: Supabase Dashboard → Settings → Integrations
3. Check "Supabase directory" setting (should be `.`)

---

## Files Reference

```
supabase/
├── config.toml                    # Supabase config (created by init)
├── seed.sql                       # Test data for preview branches
├── .gitignore                     # Ignores .branches, .temp
└── migrations/
    ├── 00000000000000_baseline.sql    # Full schema (8793 lines)
    └── 20251219150000_*.sql           # Feature migrations
```

---

## Environment Variables

In `.env.local`:
```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx...     # CLI authentication
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # Server-side only!
```

---

## Related Docs

- [Database Schema](./schema.md)
- [Deployment Checklist](../deployment/checklist.md)
