# Project Management Module

**Status**: Design Phase
**Last Updated**: 2025-12-02

---

## Overview

The Project Management module enables lighting design engineers to manage customer projects through their complete lifecycle - from initial customer files through final deliverables, with full version control and Google Drive integration.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [WORKFLOW.md](./WORKFLOW.md) | Engineer workflow and use cases |
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Database tables and relationships |
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

### Folder Structure in HUB
```
HUB/
├── Projects/
│   └── {project_code}/
│       └── v{n}/
│           ├── 01_Input/
│           ├── 02_Working/
│           ├── 03_Output/
│           └── 04_Specs/
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

## Status

- [x] Workflow defined
- [x] Database schema designed
- [x] Google Drive structure agreed
- [x] CRUD operations defined
- [ ] Implementation started
- [ ] Testing completed
- [ ] Production deployment
