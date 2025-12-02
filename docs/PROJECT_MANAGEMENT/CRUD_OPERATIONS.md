# CRUD Operations

**Status**: Design Phase
**Last Updated**: 2025-12-02

---

## Overview

This document defines the Create, Read, Update, and Delete operations for projects and project versions, including database and Google Drive interactions.

---

## Operations Summary

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| **Project** | New project + v1 | List/Detail | Edit metadata | Archive to HUB/Archive/ |
| **Version** | Copy from current | List/Detail | Edit notes | Delete folder (if >1 version) |

---

## Project Operations

### CREATE Project

**Trigger:** User clicks "New Project" and submits form

**Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│                      CREATE PROJECT                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │ 1. Generate project_code │
               │    (YYMM-NNN format)     │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 2. Create project record │
               │    in database           │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 3. Create Google Drive   │
               │    folder: Projects/{code}/│
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 4. Create v1/ subfolder  │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 5. Copy skeleton files   │
               │    to v1/                │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 6. Create project_version│
               │    record (version 1)    │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 7. Update project with   │
               │    folder IDs            │
               └──────────────────────────┘
```

**Database Operations:**
```sql
-- 1. Generate code
SELECT generate_project_code(); -- Returns '2512-001'

-- 2. Insert project
INSERT INTO projects (
  id, project_code, name, customer_id, status, priority,
  google_drive_folder_id, current_version, is_archived,
  created_at, created_by
) VALUES (
  gen_random_uuid(), '2512-001', 'Customer Project Name',
  $customer_id, 'draft', 'medium',
  NULL, 1, FALSE,
  NOW(), $user_email
) RETURNING id;

-- 6. Insert version
INSERT INTO project_versions (
  project_id, version_number, google_drive_folder_id,
  created_by, notes
) VALUES (
  $project_id, 1, NULL,
  $user_email, 'Initial version'
);

-- 7. Update with folder IDs (after Google Drive creation)
UPDATE projects
SET google_drive_folder_id = $root_folder_id
WHERE id = $project_id;

UPDATE project_versions
SET google_drive_folder_id = $v1_folder_id
WHERE project_id = $project_id AND version_number = 1;
```

**Google Drive Operations:**
```typescript
// 3. Create project root folder
const projectFolder = await driveService.createFolder(
  projectCode,  // '2512-001'
  PROJECTS_FOLDER_ID
);

// 4. Create v1 folder
const v1Folder = await driveService.createFolder(
  'v1',
  projectFolder.id
);

// 5. Copy skeleton (create subfolders + README files)
for (const subfolder of ['01_Input', '02_Working', '03_Output', '04_Specs']) {
  const folder = await driveService.createFolder(subfolder, v1Folder.id);
  await driveService.uploadFile(
    'README.md',
    readmeContent[subfolder],
    'text/markdown',
    folder.id
  );
}
```

**Error Handling:**
- If Google Drive fails: Delete project record, return error
- If version insert fails: Delete project and Google Drive folder
- Transaction: Wrap in try/catch with cleanup

---

### READ Project

**List Projects:**
```sql
SELECT
  p.id, p.project_code, p.name, p.status, p.priority,
  p.current_version, p.is_archived,
  c.name as customer_name
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
WHERE p.is_archived = FALSE
ORDER BY p.created_at DESC
LIMIT $limit OFFSET $offset;
```

**Get Project Detail:**
```sql
SELECT
  p.*,
  c.name as customer_name,
  c.email as customer_email,
  pv.version_number,
  pv.google_drive_folder_id as version_folder_id,
  pv.notes as version_notes,
  pv.created_at as version_created_at
FROM projects p
LEFT JOIN customers c ON p.customer_id = c.id
LEFT JOIN project_versions pv
  ON p.id = pv.project_id
  AND p.current_version = pv.version_number
WHERE p.id = $project_id;
```

**Get All Versions:**
```sql
SELECT
  id, version_number, google_drive_folder_id,
  created_at, created_by, notes
FROM project_versions
WHERE project_id = $project_id
ORDER BY version_number DESC;
```

---

### UPDATE Project

**Editable Fields:**
- name, description
- customer_id
- status, priority
- project_type, project_category
- dates (start_date, expected_completion_date, etc.)
- team (project_manager, architect_firm, etc.)
- financial (estimated_budget, currency)
- location fields
- notes, tags

**NOT Editable:**
- project_code (immutable after creation)
- google_drive_folder_id (managed by system)
- current_version (managed by system)

**Database Operation:**
```sql
UPDATE projects SET
  name = $name,
  description = $description,
  customer_id = $customer_id,
  status = $status,
  -- ... other fields
  updated_at = NOW()
WHERE id = $project_id
  AND is_archived = FALSE;  -- Block edit if archived
```

---

### DELETE Project (Archive)

**Trigger:** User clicks "Delete" and confirms

**Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│                    DELETE (ARCHIVE) PROJECT                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │ 1. Get project folder ID │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 2. Move folder to        │
               │    Archive/{code}/       │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 3. Set is_archived=TRUE  │
               │    in database           │
               └──────────────────────────┘
```

**Google Drive Operation:**
```typescript
// Move project folder to Archive
await driveService.moveFile(
  projectFolderId,
  ARCHIVE_FOLDER_ID
);
```

**Database Operation:**
```sql
UPDATE projects
SET
  is_archived = TRUE,
  updated_at = NOW()
WHERE id = $project_id;
```

**UI Behavior:**
- Archived projects hidden from main list
- Can show in "Archived" filter/view
- All operations blocked for archived projects

---

## Version Operations

### CREATE Version

**Trigger:** User clicks "Create New Version"

**Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│                      CREATE VERSION                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │ 1. Get current version   │
               │    folder ID             │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 2. Copy folder to        │
               │    v{n+1}/               │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 3. Insert version record │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 4. Update current_version│
               │    in projects table     │
               └──────────────────────────┘
```

**Google Drive Operation:**
```typescript
// Copy entire folder recursively
async function copyFolderRecursive(
  sourceFolderId: string,
  destinationParentId: string,
  newFolderName: string
): Promise<string> {
  // Create new folder
  const newFolder = await driveService.createFolder(
    newFolderName,
    destinationParentId
  );

  // List all items in source
  const items = await driveService.listFiles(sourceFolderId);

  for (const item of items) {
    if (item.isFolder) {
      // Recursively copy subfolder
      await copyFolderRecursive(item.id, newFolder.id, item.name);
    } else {
      // Copy file
      await driveService.copyFile(item.id, newFolder.id);
    }
  }

  return newFolder.id;
}

// Usage
const newVersionFolderId = await copyFolderRecursive(
  currentVersionFolderId,
  projectFolderId,
  `v${nextVersionNumber}`
);
```

**Database Operations:**
```sql
-- Get next version number
SELECT COALESCE(MAX(version_number), 0) + 1 as next_version
FROM project_versions
WHERE project_id = $project_id;

-- Insert new version
INSERT INTO project_versions (
  project_id, version_number, google_drive_folder_id,
  created_by, notes
) VALUES (
  $project_id, $next_version, $new_folder_id,
  $user_email, $notes
);

-- Update current version
UPDATE projects
SET
  current_version = $next_version,
  updated_at = NOW()
WHERE id = $project_id;
```

---

### READ Version

**Get Version Detail:**
```sql
SELECT
  id, version_number, google_drive_folder_id,
  created_at, created_by, notes
FROM project_versions
WHERE project_id = $project_id
  AND version_number = $version_number;
```

**List Files in Version:**
```typescript
const files = await driveService.listSharedDriveFiles(
  versionFolderId,
  HUB_DRIVE_ID
);
```

---

### UPDATE Version

**Editable Fields:**
- notes (version description/reason)

**Database Operation:**
```sql
UPDATE project_versions
SET notes = $notes
WHERE project_id = $project_id
  AND version_number = $version_number;
```

---

### DELETE Version

**Precondition:** Project must have more than 1 version

**Flow:**
```
┌─────────────────────────────────────────────────────────────┐
│                      DELETE VERSION                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │ 1. Check version count   │
               │    (must be > 1)         │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 2. Delete folder from    │
               │    Google Drive          │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 3. Delete version record │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌──────────────────────────┐
               │ 4. If deleted current,   │
               │    update to latest      │
               └──────────────────────────┘
```

**Validation:**
```sql
-- Check version count
SELECT COUNT(*) as count
FROM project_versions
WHERE project_id = $project_id;

-- If count <= 1, block deletion with error:
-- "Cannot delete the only version. Delete the project instead."
```

**Google Drive Operation:**
```typescript
await driveService.deleteFile(versionFolderId);
```

**Database Operations:**
```sql
-- Delete version record
DELETE FROM project_versions
WHERE project_id = $project_id
  AND version_number = $version_number;

-- If deleted version was current, update to latest remaining
UPDATE projects
SET current_version = (
  SELECT MAX(version_number)
  FROM project_versions
  WHERE project_id = $project_id
)
WHERE id = $project_id
  AND current_version = $deleted_version_number;
```

---

## Error Handling

### Transaction Pattern

```typescript
async function createProject(data: ProjectInput) {
  let projectId: string | null = null;
  let driveFolderId: string | null = null;

  try {
    // 1. Create project in DB
    projectId = await db.createProject(data);

    // 2. Create Google Drive folders
    driveFolderId = await driveService.createProjectFolders(data.projectCode);

    // 3. Update DB with folder IDs
    await db.updateProjectFolderIds(projectId, driveFolderId);

    return { success: true, projectId };

  } catch (error) {
    // Cleanup on failure
    if (driveFolderId) {
      await driveService.deleteFile(driveFolderId).catch(console.error);
    }
    if (projectId) {
      await db.deleteProject(projectId).catch(console.error);
    }

    throw error;
  }
}
```

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `Unauthorized` | No valid session | Redirect to login |
| `Forbidden` | No Drive access | Check OAuth scopes |
| `NotFound` | Folder doesn't exist | Sync issue - recreate? |
| `QuotaExceeded` | Drive storage full | Alert user |
| `VersionDeleteBlocked` | Only one version | Show message to delete project instead |
| `ArchivedProject` | Project is archived | Block all modifications |
