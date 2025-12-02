# Engineer Workflow

**Status**: Design Phase
**Last Updated**: 2025-12-02

---

## Overview

This document describes the typical workflow of a lighting design engineer using FOSSAPP to manage customer projects.

---

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LIGHTING DESIGN WORKFLOW                         │
└─────────────────────────────────────────────────────────────────────┘

[Customer] ──DWG──┐
                  ▼
         ┌────────────────┐
         │ 1. CREATE      │  Create project in FOSSAPP
         │    PROJECT     │  → Auto-generates project code (2512-001)
         │                │  → Creates folder structure in HUB
         │                │  → Creates v1 with skeleton files
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 2. UPLOAD      │  Place customer DWG in:
         │    INPUT       │  HUB/Projects/2512-001/v1/01_Input/
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 3. CLEANUP     │  Open in AutoCAD
         │    IN AUTOCAD  │  Remove unnecessary layers/objects/blocks
         │                │  Save working file to:
         │                │  HUB/Projects/2512-001/v1/02_Working/
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 4. PRODUCT     │  Use FOSSAPP product search
         │    SELECTION   │  Find luminaires + accessories
         │                │  Add to project products list
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 5. MARK        │  Place product marks on drawing
         │    POSITIONS   │  (Standard symbols/blocks)
         │                │  Reference codes map to legend
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 6. CREATE      │  Generate product tiles for legend area
         │    LEGEND      │  (Product info blocks)
         │                │  [More discussion needed on automation]
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 7. EXPORT      │  Print/export final layouts (PDF)
         │    OUTPUT      │  Save to:
         │                │  HUB/Projects/2512-001/v1/03_Output/
         └───────┬────────┘
                 │
                 ▼
         ┌────────────────┐
         │ 8. REVISIONS?  │──No──> [DONE]
         │                │
         └───────┬────────┘
                 │ Yes
                 ▼
         ┌────────────────┐
         │ 9. CREATE      │  "Create New Version" in FOSSAPP
         │    NEW VERSION │  → Copies v1 folder to v2
         │                │  → Engineer modifies v2 files
         └───────┬────────┘
                 │
                 └──────────> [Return to step 3]
```

---

## Step Details

### Step 1: Create Project

**In FOSSAPP:**
- Navigate to Projects → New Project
- Enter project details (name, customer, type, etc.)
- System auto-generates:
  - Project code: `YYMM-NNN` format (e.g., 2512-001)
  - Google Drive folder structure
  - Version 1 with skeleton files

**Automatic Actions:**
```
1. Generate project_code
2. Create HUB/Projects/{code}/
3. Create HUB/Projects/{code}/v1/
4. Copy skeleton files to v1
5. Store folder IDs in database
```

### Step 2: Upload Input

**Engineer Action:**
- Place customer's original DWG file in `01_Input/` folder
- Can upload via FOSSAPP UI or directly in Google Drive

### Step 3: Cleanup in AutoCAD

**Engineer Action (outside FOSSAPP):**
- Open customer DWG in AutoCAD
- Remove unnecessary:
  - Layers
  - Objects
  - Blocks
  - Text/annotations
- Save cleaned file to `02_Working/` folder

### Step 4: Product Selection

**In FOSSAPP:**
- Use `/products` search page
- Search by:
  - Product type (downlight, track, pendant, etc.)
  - Specifications (IP rating, wattage, color temp, etc.)
  - Supplier
- Add selected products to project
- Include accessories as needed

### Step 5: Mark Positions

**Engineer Action (in AutoCAD):**
- Place standard marks/symbols where luminaires go
- Use reference codes (A1, A2, B1, etc.)
- Codes correspond to legend entries

**Future Enhancement:**
- Symbol/block library managed by FOSSAPP
- Auto-insert from FOSSAPP?

### Step 6: Create Legend

**Engineer Action (in AutoCAD):**
- Create product tiles in legend area
- Each tile contains:
  - Reference code (A1, B1, etc.)
  - Product image/symbol
  - Product code
  - Key specifications
  - Quantity

**Future Enhancement:**
- FOSSAPP generates legend tiles automatically
- Export to AutoCAD-compatible format

### Step 7: Export Output

**Engineer Action:**
- Print/plot to PDF
- Save to `03_Output/` folder
- May create multiple layouts:
  - Floor plans
  - Ceiling plans
  - Details
  - Schedules

### Step 8-9: Revisions

**If customer requests changes:**
1. Click "Create New Version" in FOSSAPP
2. System copies entire v1 folder to v2
3. Engineer modifies v2 files
4. Original v1 preserved as history

---

## File Locations Summary

| Stage | Folder | File Types |
|-------|--------|------------|
| Input | `01_Input/` | Customer DWG, reference PDFs |
| Working | `02_Working/` | Cleaned DWG, work in progress |
| Output | `03_Output/` | Final PDFs, deliverables |
| Specs | `04_Specs/` | Product cut sheets, data sheets |

---

## Future Enhancements

1. **Symbol Library** - Managed luminaire symbols/blocks
2. **Auto-Legend** - Generate legend tiles from project products
3. **AutoCAD Plugin** - Direct integration with FOSSAPP
4. **Version Comparison** - Diff between versions
5. **Collaboration** - Multiple engineers on same project
