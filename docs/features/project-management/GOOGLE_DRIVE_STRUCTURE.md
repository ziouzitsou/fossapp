# Google Drive Structure

**Status**: Implemented
**Last Updated**: 2025-12-27

---

## Overview

All project files are stored in the **HUB Shared Drive** with a standardized folder structure. This document defines the organization, naming conventions, and file management rules.

---

## Folder Structure

```
HUB (Shared Drive)
│
└── Projects/                           ← All projects
    │
    ├── 2511-001/                       ← Project: Nov 2025, #001
    │   ├── 00_Customer/                ← Customer reference files
    │   │   ├── Drawings/
    │   │   ├── Photos/
    │   │   └── Documents/
    │   ├── 01_Working/                 ← Engineer work files
    │   │   ├── CAD/
    │   │   └── Calculations/
    │   ├── 02_Areas/                   ← Area-based versioning
    │   │   ├── GF-LOBBY/               ← Area: Ground Floor Lobby
    │   │   │   ├── v1/
    │   │   │   │   ├── Working/
    │   │   │   │   └── Output/
    │   │   │   └── v2/
    │   │   │       ├── Working/
    │   │   │       └── Output/
    │   │   └── FF-OFFICE/              ← Area: First Floor Office
    │   │       └── v1/
    │   │           ├── Working/
    │   │           └── Output/
    │   ├── 03_Output/                  ← Final deliverables
    │   │   ├── Drawings/
    │   │   ├── Presentations/
    │   │   └── Schedules/
    │   └── 04_Specs/                   ← Product specifications
    │       ├── Cut_Sheets/
    │       └── Photometrics/
    │
    └── 2512-001/                       ← Project: Dec 2025, #001
        └── ...
```

> **Note:** Archive folder removed in v1.12.6. Projects are permanently deleted. Future versions will implement ZIP-based archival to Google Drive.

---

## Folder Descriptions

### Project Root (`Projects/{project_code}/`)

- One folder per project
- Named with project code: `YYMM-NNN`
- Contains all version folders
- **Google Drive ID stored in:** `projects.google_drive_folder_id`

### Version Folder (`v{n}/`)

- One folder per version
- Named: `v1`, `v2`, `v3`, etc.
- Contains the 4 standard subfolders
- **Google Drive ID stored in:** `project_versions.google_drive_folder_id`

### Standard Subfolders

| Folder | Purpose | Typical Files |
|--------|---------|---------------|
| `01_Input/` | Customer-provided files | Original DWG, reference PDFs, site photos |
| `02_Working/` | Engineer work in progress | Cleaned DWG, draft layouts |
| `03_Output/` | Final deliverables | Printed PDFs, final DWG |
| `04_Specs/` | Product documentation | Cut sheets, data sheets, IES files |

---

## Skeleton Template

Located in FOSSAPP codebase:

```
fossapp/
└── templates/
    └── project-skeleton/
        ├── 01_Input/
        │   └── README.md
        ├── 02_Working/
        │   └── README.md
        ├── 03_Output/
        │   └── README.md
        └── 04_Specs/
            └── README.md
```

### README.md Contents

**01_Input/README.md:**
```markdown
# Input Files

Place customer-provided files here:
- Original AutoCAD drawings (DWG)
- Reference PDFs
- Site photos
- Any source material from customer
```

**02_Working/README.md:**
```markdown
# Working Files

Engineer work-in-progress files:
- Cleaned AutoCAD drawings
- Draft layouts
- Work files (not final)
```

**03_Output/README.md:**
```markdown
# Output Files

Final deliverables for customer:
- Printed PDFs
- Final AutoCAD files
- Presentation materials
```

**04_Specs/README.md:**
```markdown
# Specifications

Product documentation:
- Cut sheets
- Technical data sheets
- IES/LDT photometric files
- Installation guides
```

---

## Naming Conventions

### Project Folders
```
{YYMM}-{NNN}

Examples:
  2512-001    December 2025, first project
  2512-002    December 2025, second project
  2601-001    January 2026, first project
```

### Version Folders
```
v{n}

Examples:
  v1    Version 1 (always exists)
  v2    Version 2 (revision)
  v3    Version 3 (revision)
```

### Files (Recommended)
```
{project_code}_{description}_{version}.{ext}

Examples:
  2512-001_floor_plan_v1.dwg
  2512-001_ceiling_layout_v1.pdf
  2512-001_luminaire_schedule_v1.xlsx
```

---

## Operations

### Create Project

```
1. Create folder: Projects/{project_code}/
2. Create folder: Projects/{project_code}/v1/
3. Copy skeleton subfolders to v1/
4. Store folder IDs in database
```

### Create New Version

```
1. Get current version folder ID
2. Copy entire folder to: Projects/{project_code}/v{n+1}/
3. Store new folder ID in database
4. Update current_version in projects table
```

### Delete Project

```
1. Get project folder ID
2. Delete Google Drive folder (recursive)
3. Delete OSS bucket (floor plan files)
4. Delete all database records (areas, products, etc.)
5. Delete project record
```

> **Note:** Deletion is permanent. Future versions will implement ZIP-based archival before deletion.

### Delete Version

```
Precondition: More than 1 version exists

1. Get version folder ID
2. Delete folder from Google Drive
3. Delete record from project_versions table
4. If deleted version was current_version, update to latest remaining
```

---

## Google Drive API Parameters

All operations require these parameters for Shared Drives:

```typescript
{
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  corpora: "drive",
  driveId: process.env.GOOGLE_DRIVE_HUB_ID
}
```

---

## Environment Variables

```bash
# .env.local
GOOGLE_DRIVE_HUB_ID=0AIqVhsENOYQjUk9PVA    # HUB Shared Drive ID
GOOGLE_DRIVE_PROJECTS_FOLDER_ID=xxx         # Projects/ folder ID
```

---

## Storage Estimates

| Item | Typical Size |
|------|--------------|
| Customer DWG | 5-50 MB |
| Cleaned DWG | 2-20 MB |
| Output PDF | 1-10 MB |
| Spec sheets | 0.5-2 MB each |
| **Per version** | ~20-100 MB |
| **Per project (3 versions)** | ~60-300 MB |

**Note:** When creating new version, full folder copy occurs. Consider storage growth with many revisions.

---

## Security

- Access controlled by HUB Shared Drive membership
- Only `@foss.gr` domain users have access
- FOSSAPP enforces additional checks:
  - User must be authenticated
  - Archived projects are readonly
  - Delete version blocked if only one exists

---

## Future Considerations

1. **Automatic cleanup** - Delete old versions after X months?
2. **Compression** - Zip old versions?
3. **Sync indicator** - Show sync status in FOSSAPP UI
4. **Offline access** - Cache frequently used files?
5. **Version comparison** - Visual diff between versions?
