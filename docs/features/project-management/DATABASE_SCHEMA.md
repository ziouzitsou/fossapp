# Database Schema

**Status**: Design Phase
**Last Updated**: 2025-12-02

---

## Overview

This document defines the database schema for project management with version control and Google Drive integration.

---

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DATABASE SCHEMA                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐       ┌─────────────────────┐
│     customers       │       │      projects       │
├─────────────────────┤       ├─────────────────────┤
│ id (PK)             │◄──────│ customer_id (FK)    │
│ name                │       │ id (PK)             │
│ email               │       │ project_code        │──────┐
│ ...                 │       │ name                │      │
└─────────────────────┘       │ status              │      │
                              │ google_drive_       │      │
                              │   folder_id  ●──────┼──────┼──► HUB/Projects/{code}/
                              │ current_version     │      │
                              │ is_archived         │      │
                              │ ...                 │      │
                              └──────────┬──────────┘      │
                                         │                 │
                                         │ 1:N             │
                                         ▼                 │
                              ┌─────────────────────┐      │
                              │  project_versions   │      │
                              ├─────────────────────┤      │
                              │ id (PK)             │      │
                              │ project_id (FK)     │      │
                              │ version_number      │      │
                              │ google_drive_       │      │
                              │   folder_id  ●──────┼──────┴──► HUB/Projects/{code}/v{n}/
                              │ created_at          │
                              │ created_by          │
                              │ notes               │
                              └─────────────────────┘
```

---

## Table Definitions

### projects (modify existing)

Add these fields to the existing `projects` table:

```sql
-- New fields to add:
ALTER TABLE projects ADD COLUMN IF NOT EXISTS
  google_drive_folder_id TEXT;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS
  current_version INTEGER DEFAULT 1;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS
  is_archived BOOLEAN DEFAULT FALSE;
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `google_drive_folder_id` | TEXT | Google Drive folder ID for `HUB/Projects/{code}/` |
| `current_version` | INTEGER | Currently active version number |
| `is_archived` | BOOLEAN | TRUE if project moved to Archive |

---

### project_versions (new table)

```sql
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  google_drive_folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  notes TEXT,

  CONSTRAINT unique_project_version UNIQUE(project_id, version_number),
  CONSTRAINT positive_version CHECK (version_number > 0)
);

-- Index for fast lookups
CREATE INDEX idx_project_versions_project_id
  ON project_versions(project_id);

-- Index for ordering
CREATE INDEX idx_project_versions_number
  ON project_versions(project_id, version_number DESC);
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `project_id` | UUID | Foreign key to projects |
| `version_number` | INTEGER | Version number (1, 2, 3...) |
| `google_drive_folder_id` | TEXT | Google Drive folder ID for `v{n}/` |
| `created_at` | TIMESTAMPTZ | When version was created |
| `created_by` | TEXT | Email of user who created version |
| `notes` | TEXT | Version notes ("Initial", "Zone B revision", etc.) |

---

## Project Code Generation

### Format
```
YYMM-NNN

Where:
  YY  = 2-digit year (25 for 2025)
  MM  = 2-digit month (01-12)
  NNN = 3-digit serial number (001-999)

Example: 2512-001 = December 2025, first project
```

### Generation Logic

```sql
-- Function to generate next project code
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
DECLARE
  current_prefix TEXT;
  max_serial INTEGER;
  new_serial INTEGER;
BEGIN
  -- Get current YYMM prefix
  current_prefix := TO_CHAR(NOW(), 'YYMM');

  -- Find max serial for this prefix
  SELECT MAX(
    CAST(SUBSTRING(project_code FROM 6 FOR 3) AS INTEGER)
  ) INTO max_serial
  FROM projects
  WHERE project_code LIKE current_prefix || '-%';

  -- Calculate new serial
  IF max_serial IS NULL THEN
    new_serial := 1;
  ELSE
    new_serial := max_serial + 1;
  END IF;

  -- Return formatted code
  RETURN current_prefix || '-' || LPAD(new_serial::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
```

### Usage

```sql
-- Get next project code
SELECT generate_project_code();
-- Returns: '2512-001' (or '2512-002' if 001 exists)
```

---

## Queries

### Get Project with Current Version

```sql
SELECT
  p.*,
  pv.version_number,
  pv.google_drive_folder_id as version_folder_id,
  pv.notes as version_notes,
  pv.created_at as version_created_at
FROM projects p
LEFT JOIN project_versions pv
  ON p.id = pv.project_id
  AND p.current_version = pv.version_number
WHERE p.id = $1;
```

### Get All Versions for Project

```sql
SELECT
  version_number,
  google_drive_folder_id,
  created_at,
  created_by,
  notes
FROM project_versions
WHERE project_id = $1
ORDER BY version_number DESC;
```

### Get Latest Version Number

```sql
SELECT COALESCE(MAX(version_number), 0) as latest_version
FROM project_versions
WHERE project_id = $1;
```

### Count Versions (for delete validation)

```sql
SELECT COUNT(*) as version_count
FROM project_versions
WHERE project_id = $1;
```

---

## Migration Script

```sql
-- Migration: Add project version support
-- File: supabase/migrations/YYYYMMDD_add_project_versions.sql

-- 1. Add new columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT,
  ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 2. Create project_versions table
CREATE TABLE IF NOT EXISTS project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  google_drive_folder_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  notes TEXT,

  CONSTRAINT unique_project_version UNIQUE(project_id, version_number),
  CONSTRAINT positive_version CHECK (version_number > 0)
);

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id
  ON project_versions(project_id);

CREATE INDEX IF NOT EXISTS idx_project_versions_number
  ON project_versions(project_id, version_number DESC);

-- 4. Create project code generator function
CREATE OR REPLACE FUNCTION generate_project_code()
RETURNS TEXT AS $$
DECLARE
  current_prefix TEXT;
  max_serial INTEGER;
  new_serial INTEGER;
BEGIN
  current_prefix := TO_CHAR(NOW(), 'YYMM');

  SELECT MAX(
    CAST(SUBSTRING(project_code FROM 6 FOR 3) AS INTEGER)
  ) INTO max_serial
  FROM projects
  WHERE project_code LIKE current_prefix || '-%';

  IF max_serial IS NULL THEN
    new_serial := 1;
  ELSE
    new_serial := max_serial + 1;
  END IF;

  RETURN current_prefix || '-' || LPAD(new_serial::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- 5. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON project_versions TO authenticated;
GRANT EXECUTE ON FUNCTION generate_project_code() TO authenticated;
```

---

## Notes

- `ON DELETE CASCADE` ensures versions are deleted when project is deleted
- `is_archived` is used for soft delete (project moved to Archive folder)
- `current_version` always points to the active working version
- Version numbers are immutable once created (no renumbering)
