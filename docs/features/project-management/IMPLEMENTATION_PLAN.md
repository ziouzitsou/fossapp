# Implementation Plan

**Status**: Design Phase
**Last Updated**: 2025-12-02

---

## Overview

This document outlines the implementation phases for the Project Management module with Google Drive integration.

---

## Prerequisites

Before starting implementation:

- [x] Google Drive API enabled in Google Cloud Console
- [x] Service Account credentials configured
- [x] HUB Shared Drive ID obtained
- [x] `Projects/` folder created in HUB
- [x] `googleapis` package installed

---

## Phase 1: Database Schema

**Goal:** Add version support to database

### Tasks

- [ ] Create migration file
- [ ] Add fields to `projects` table:
  - `google_drive_folder_id`
  - `current_version`
  - `is_archived`
- [ ] Create `project_versions` table
- [ ] Create `generate_project_code()` function
- [ ] Run migration
- [ ] Generate TypeScript types

### Files to Create/Modify

```
supabase/migrations/YYYYMMDD_add_project_versions.sql
src/lib/types/project.ts (if separate types file)
```

### Verification

```sql
-- Test project code generation
SELECT generate_project_code();

-- Verify tables exist
SELECT * FROM project_versions LIMIT 1;
```

---

## Phase 2: Local Skeleton Template

**Goal:** Create template files for new projects

### Tasks

- [ ] Create template folder structure
- [ ] Create README.md files for each subfolder
- [ ] Add to .gitignore if needed (or commit templates)

### Files to Create

```
templates/project-skeleton/
├── 01_Input/
│   └── README.md
├── 02_Working/
│   └── README.md
├── 03_Output/
│   └── README.md
└── 04_Specs/
    └── README.md
```

---

## Phase 3: Google Drive Service

**Goal:** Create service layer for Drive operations

### Tasks

- [ ] Install `googleapis` package
- [ ] Create `GoogleDriveProjectService` class
- [x] Implement methods:
  - `createProjectFolder(projectCode)`
  - `createAreaFolder(areasFolderId, areaCode)`
  - `createAreaVersionFolder(areaFolderId, versionNumber)`
  - `deleteProject(projectFolderId)`
  - `deleteAreaFolder(areaFolderId)`
  - `deleteAreaVersionFolder(versionFolderId)`
  - `listFiles(folderId)`
- [x] Add environment variables
- [x] Test each method independently

### Files to Create/Modify

```
src/lib/google-drive-project-service.ts
.env.local (add GOOGLE_DRIVE_* variables)
```

### Environment Variables

```bash
GOOGLE_DRIVE_HUB_ID=xxx
GOOGLE_DRIVE_PROJECTS_FOLDER_ID=xxx
```

---

## Phase 4: Server Actions

**Goal:** Create backend logic for project/version CRUD

### Tasks

- [ ] Update `createProjectAction` to:
  - Generate project code
  - Create Drive folders
  - Create version 1 record
- [x] Update `deleteProjectAction` to:
  - Delete Google Drive folder
  - Delete OSS bucket
  - Delete all related DB records
- [ ] Create `createVersionAction`:
  - Copy folder
  - Create version record
  - Update current_version
- [ ] Create `deleteVersionAction`:
  - Validate version count
  - Delete folder
  - Delete record
- [ ] Create `updateVersionAction`:
  - Update notes
- [ ] Create `listVersionsAction`
- [ ] Create `switchVersionAction`:
  - Update current_version

### Files to Modify

```
src/lib/actions/projects.ts
```

---

## Phase 5: API Routes (if needed)

**Goal:** Create REST endpoints for Drive operations

### Tasks

- [ ] Create `/api/projects/[id]/versions` route
- [ ] Create `/api/projects/[id]/versions/[version]/files` route
- [ ] Create `/api/projects/[id]/drive-sync` route (manual sync)

### Files to Create

```
src/app/api/projects/[id]/versions/route.ts
src/app/api/projects/[id]/versions/[version]/files/route.ts
```

---

## Phase 6: UI - Project Form Updates

**Goal:** Update project creation/edit forms

### Tasks

- [ ] Remove manual project_code input (auto-generated)
- [ ] Show generated code after creation
- [ ] Add loading state during Drive folder creation
- [ ] Show error if Drive creation fails
- [ ] Update form validation

### Files to Modify

```
src/components/projects/project-form-sheet.tsx
```

---

## Phase 7: UI - Version Management

**Goal:** Add version UI to project detail page

### Tasks

- [ ] Add version selector dropdown
- [ ] Add "Create New Version" button
- [ ] Add version creation dialog (with notes input)
- [ ] Add version delete confirmation dialog
- [ ] Add version notes edit functionality
- [ ] Show version history list
- [ ] Update current version indicator

### Files to Modify

```
src/app/projects/[id]/page.tsx
src/components/projects/version-selector.tsx (new)
src/components/projects/create-version-dialog.tsx (new)
src/components/projects/version-history.tsx (new)
```

---

## Phase 8: UI - Documents Tab Enhancement

**Goal:** Integrate Google Drive file browser

### Tasks

- [ ] List files from current version's Drive folder
- [ ] Show folder navigation (01_Input, 02_Working, etc.)
- [ ] Add "Open in Drive" button
- [ ] Show file metadata (size, modified date)
- [ ] Add upload functionality (optional - can use Drive directly)
- [ ] Add refresh button

### Files to Modify

```
src/app/projects/[id]/page.tsx (Documents tab)
src/components/projects/drive-file-browser.tsx (new)
```

---

## Phase 9: Testing

**Goal:** Verify all functionality works correctly

### Test Cases

**Project Creation:**
- [ ] Creates project with auto-generated code
- [ ] Creates Drive folder structure
- [ ] Creates version 1 record
- [ ] Handles Drive API errors gracefully

**Project Deletion:**
- [x] Deletes Google Drive folder (recursive)
- [x] Deletes OSS bucket (floor plans)
- [x] Deletes all related DB records
- [x] Confirmation requires typing project code

**Version Creation:**
- [ ] Copies all files from current version
- [ ] Creates new version record
- [ ] Updates current_version
- [ ] Handles large folders

**Version Deletion:**
- [ ] Blocks if only version
- [ ] Deletes folder from Drive
- [ ] Deletes record from DB
- [ ] Updates current_version if needed

---

## Phase 10: Documentation & Cleanup

**Goal:** Finalize documentation and code cleanup

### Tasks

- [ ] Update CLAUDE.md with new features
- [ ] Update CHANGELOG.md
- [ ] Update What's New dialog
- [ ] Remove any debug code
- [ ] Add code comments where needed
- [ ] Review error messages for user-friendliness

---

## Dependencies

```json
{
  "dependencies": {
    "googleapis": "^144.0.0"
  }
}
```

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Drive API rate limits | Medium | Implement retry with backoff |
| Large folder copy timeout | High | Show progress, async processing |
| OAuth token expiration | Medium | Auto-refresh (already documented) |
| Folder sync issues | Medium | Manual sync button, error logging |
| Storage costs | Low | Monitor usage, cleanup old versions |

---

## Timeline Estimate

| Phase | Dependencies |
|-------|--------------|
| Phase 1 | None |
| Phase 2 | None |
| Phase 3 | Phase 1, 2 |
| Phase 4 | Phase 3 |
| Phase 5 | Phase 4 |
| Phase 6 | Phase 4 |
| Phase 7 | Phase 4, 6 |
| Phase 8 | Phase 4, 7 |
| Phase 9 | Phase 1-8 |
| Phase 10 | Phase 9 |

---

## Open Questions

1. **File upload in FOSSAPP** - Direct upload or always via Google Drive UI?
2. **Notifications** - Email when new version created?
3. **Permissions** - Who can create/delete versions?
4. **ZIP Archive** - Create ZIP backup before permanent deletion?
5. **Search** - Search across project files?

---

## Notes

- Start with Phase 1-4 (backend foundation)
- UI can be iterated incrementally
- Test thoroughly before production deployment
- Consider feature flag for gradual rollout
