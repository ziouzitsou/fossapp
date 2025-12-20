# Project Management Module

**Status**: ✅ Implemented (Multi-Area Versioning)
**Last Updated**: 2025-12-19

---

## Overview

The Project Management module enables lighting design engineers to manage customer projects through their complete lifecycle - from initial customer files through final deliverables, with full version control and Google Drive integration.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [WORKFLOW.md](./WORKFLOW.md) | Engineer workflow and use cases |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Database tables and relationships |
| [**MULTI_AREA_VERSIONING.md**](./MULTI_AREA_VERSIONING.md) | **✅ Multi-area versioning feature (NEW)** |
| [GOOGLE_DRIVE_STRUCTURE.md](./GOOGLE_DRIVE_STRUCTURE.md) | HUB Shared Drive folder organization |
| [CRUD_OPERATIONS.md](./CRUD_OPERATIONS.md) | Create, Read, Update, Delete logic |
| [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) | Development phases and tasks |

---

## Quick Reference

### Project Code Format
```
YYMM-NNN
Example: 2512-001 (December 2025, first project of the month)
```

### Folder Structure in HUB (Multi-Area)
```
HUB/
├── Projects/
│   └── {project_code}/
│       ├── General/           # Project-level documents
│       └── Areas/             # Area-specific versioning (NEW)
│           ├── GF/            # Ground Floor
│           │   ├── v1/
│           │   ├── v2/
│           │   └── v3/
│           ├── F1/            # First Floor
│           │   ├── v1/
│           │   └── v2/
│           └── GARDEN/        # Garden
│               └── v1/
└── Archive/
    └── {archived_projects}/
```

### Key Decisions Made

| Decision | Choice |
|----------|--------|
| Version storage | Full folder copy (all files) |
| Project deletion | Archive to `HUB/Archive/`, mark readonly |
| Version deletion | Blocked if only version exists |
| Version editing | Notes field editable |
| Serial number | Auto-generated per YYMM |

---

## Related Documentation

- [Google Drive Integration Guide](../GOOGLE_DRIVE_INTEGRATION.md) - OAuth and API setup
- [Google Drive Shared Drive Guide](../GOOGLE_DRIVE_SHARED_DRIVE_INTEGRATION.md) - Shared Drive specifics

---

## Features

### ✅ Multi-Area Versioning (Implemented)

Independent versioning for project areas (floors, gardens, zones). Each area maintains its own version history, allowing different areas to iterate at different rates.

**Key Benefits**:
- Ground Floor at v3, First Floor at v2, Garden at v1
- Products linked to specific area versions
- Complete version history per area
- Area-level summaries and reporting

**See**: [MULTI_AREA_VERSIONING.md](./MULTI_AREA_VERSIONING.md)

---

## Implementation Status

- [x] Workflow defined
- [x] Database schema designed
- [x] Google Drive structure agreed
- [x] CRUD operations defined
- [x] **Multi-area versioning implemented**
- [x] **UI components created**
- [ ] Testing completed
- [ ] Production deployment
