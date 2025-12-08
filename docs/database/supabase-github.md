# Supabase GitHub Integration

**Configured**: 2025-11-22
**Status**: ✅ Active
**Purpose**: Automatic preview databases for pull requests + migration management

---

## Overview

FOSSAPP's Supabase project is connected to the GitHub repository for automatic database migration management and preview environment creation.

**Benefits**:
- Safe testing of database changes via preview databases
- Automatic migration application on PR merge
- Isolated test environments per feature branch
- No risk to production database during development

---

## Current Configuration

### Connection Details

- **Supabase Project**: `hyppizgiozyyyelwdius`
- **Production URL**: https://hyppizgiozyyyelwdius.supabase.co
- **GitHub Repository**: `ziouzitsou/fossapp`
- **Monitored Branch**: `main`
- **Watched Folder**: `supabase/migrations/`

### Integration Status

**Active Features**:
- ✅ Preview database creation for PRs
- ✅ Automatic migration application
- ✅ GitHub status checks
- ✅ Automatic cleanup on PR merge/close

---

## How It Works

### 1. Regular Development (No Database Changes)

```
Code changes only → Push to GitHub → No Supabase action
```

### 2. Database Migration Development

```
1. Create feature branch: git checkout -b feature/add-reviews
2. Add migration file: supabase/migrations/20250122_add_reviews.sql
3. Write SQL in the file
4. Commit: git add . && git commit -m "Add reviews table"
5. Push: git push origin feature/add-reviews
6. Create PR on GitHub
   ↓
7. Supabase automatically:
   - Creates preview database
   - Applies all migrations (including new one)
   - Runs status checks
   - Posts preview credentials
   ↓
8. Test your app against preview database
9. If tests pass → Merge PR
   ↓
10. Supabase automatically:
    - Applies migration to production
    - Deletes preview database
```

---

## Migration Workflow

### Creating Migrations

**Manual Creation** (current approach - Supabase CLI not installed):

```bash
# Create file with timestamp format
cd supabase/migrations
touch YYYYMMDD_HHMMSS_description.sql

# Example
touch 20250122_143000_add_product_reviews.sql
```

**File Naming Convention**:
- Format: `YYYYMMDD_HHMMSS_description.sql`
- Date: Current date (YYYYMMDD)
- Time: Current time in 24h format (HHMMSS)
- Description: Snake_case description of change

**Example Migration File**:
```sql
-- Migration: Add product reviews table
-- Created: 2025-01-22
-- Author: Dimitri

BEGIN;

CREATE TABLE IF NOT EXISTS items.product_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER REFERENCES items.product_info(id),
    user_id TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reviews_product_id ON items.product_reviews(product_id);
CREATE INDEX idx_reviews_user_id ON items.product_reviews(user_id);

COMMIT;

-- Rollback (keep for reference):
-- DROP TABLE IF EXISTS items.product_reviews;
```

### Current Migrations

**In Repository** (2 files):
1. `20251111_create_user_events_table.sql` - Analytics tracking
2. `20251115_reorganize_functions_to_domain_schemas.sql` - Function reorganization

**In Production Database**: 55 total migrations
- View all: Supabase Dashboard → Database → Migrations
- Many were applied before GitHub integration was set up

---

## Preview Databases

### What Are They?

Temporary Supabase databases created automatically for each pull request that modifies `supabase/migrations/`.

### Lifecycle

```
PR Created → Preview Database Created
    ↓
All migrations applied (including new ones)
    ↓
Preview credentials available in PR checks
    ↓
You test your app against preview
    ↓
PR Merged/Closed → Preview Database Deleted
```

### Using Preview Databases

**Credentials Location**:
- GitHub PR → Checks tab → "Supabase Preview" check
- Shows preview URL and API keys

**Testing Against Preview**:
```bash
# Option 1: Temporary environment variables
NEXT_PUBLIC_SUPABASE_URL=<preview-url> npm run dev

# Option 2: Create .env.preview
cp .env.local .env.preview
# Edit .env.preview with preview credentials
```

**Important**:
- ⚠️ Preview databases have NO production data (empty)
- ⚠️ If you need data for testing, add seed data to migration
- ✅ Preview is deleted automatically - don't worry about cleanup

---

## Supabase CLI

### Installation Status

**Currently**: ❌ Not installed

**Why It's Optional**:
- ✅ Migrations created manually (works fine)
- ✅ GitHub integration doesn't require it
- ✅ Testing can be done on preview databases
- ✅ Production updates via Supabase dashboard/GitHub

### If You Want to Install

```bash
# Install globally
npm install -g supabase

# Initialize in project (if needed)
cd /home/sysadmin/nextjs/fossapp
supabase init
```

**Benefits of Installing**:
- Auto-generate migration filenames with timestamps
- Local development database for testing
- Direct CLI access to remote project
- Better migration tooling

**Current Workflow Without CLI**:
- ✅ Create `.sql` files manually
- ✅ Test on preview databases (via PRs)
- ✅ Production updates via GitHub integration
- ✅ Simple and works well

---

## Quick Reference

### Create Migration

```bash
# Manual (current approach)
cd supabase/migrations
touch 20250122_143000_my_change.sql
# Write SQL in the file

# With CLI (if installed)
supabase migration new my_change
```

### Standard PR Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-change

# 2. Create migration
cd supabase/migrations
touch 20250122_143000_my_change.sql
# Edit file with SQL

# 3. Commit and push
git add .
git commit -m "Add migration: my change"
git push origin feature/my-change

# 4. Create PR on GitHub
# → Supabase creates preview automatically

# 5. Test, then merge
# → Supabase applies to production automatically
```

### View Migrations

**In Code**:
```bash
ls -la /home/sysadmin/nextjs/fossapp/supabase/migrations/
```

**In Supabase Dashboard**:
1. Go to https://supabase.com/dashboard
2. Select project: hyppizgiozyyyelwdius
3. Database → Migrations

**Via Git**:
```bash
git log -- supabase/migrations/
```

---

## Troubleshooting

### Preview Database Not Created

**Check**:
1. Does PR modify files in `supabase/migrations/`?
2. Is GitHub integration still active? (Supabase Dashboard → Settings → Integrations)
3. Check PR "Checks" tab for Supabase status

### Migration Failed on Preview

**Common Issues**:
- SQL syntax error → Check migration file
- Missing dependencies → Ensure migrations run in order
- Conflicting changes → Check if migration references non-existent objects

**How to Fix**:
1. Fix the migration file locally
2. Commit and push
3. Preview database automatically recreated with fix

### Production Migration Failed

**If migration fails on merge**:
1. Supabase will show error in dashboard
2. Fix the migration file
3. Create new PR with fix
4. DO NOT directly edit production database

---

## Best Practices

### Migration File Best Practices

✅ **DO**:
- Use transactions (`BEGIN; ... COMMIT;`)
- Include rollback SQL in comments
- Add descriptive comments
- Check for existence (`IF NOT EXISTS`)
- Create indexes for foreign keys

❌ **DON'T**:
- Hardcode values that might change
- Drop tables without backup plan
- Skip `ROLLBACK` reference
- Make irreversible changes without testing

### Example Good Migration

```sql
-- Migration: Add email notifications table
-- Created: 2025-01-22
-- Purpose: Track email notification status for user events

BEGIN;

-- Create table
CREATE TABLE IF NOT EXISTS analytics.email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT CHECK (status IN ('sent', 'failed', 'pending')),
    error_message TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_email_notifications_user_id
    ON analytics.email_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_sent_at
    ON analytics.email_notifications(sent_at DESC);

-- Enable RLS (if needed)
ALTER TABLE analytics.email_notifications ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Rollback (keep for reference):
-- DROP TABLE IF EXISTS analytics.email_notifications;
```

---

## Related Documentation

- **Database Schema**: [ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md](../ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md)
- **Deployment**: [PRODUCTION_DEPLOYMENT_CHECKLIST.md](../PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- **Supabase Tools**: `/home/sysadmin/tools/supabase/CLAUDE.md`

---

**Last Updated**: 2025-11-22
**Maintained By**: Claude Code + Dimitri
