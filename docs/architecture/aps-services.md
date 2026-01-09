# APS (Autodesk Platform Services) Architecture

**Last Updated**: 2026-01-08

This document covers FOSSAPP's integration with Autodesk Platform Services (formerly Forge) for DWG processing and viewing.

---

## Services Used

| Service | Purpose | Region |
|---------|---------|--------|
| **OSS** (Object Storage) | Store DWG files in buckets | EMEA |
| **Model Derivative** | Convert DWG to SVF2 for viewer | EMEA |
| **Design Automation** | Run AutoCAD in cloud (FOSS.dwt processing) | US-East (only option) |

---

## OSS Bucket Structure

OSS uses a **flat structure** (like S3). There are no real folders.

"Folders" are simulated by using `/` in the object key name:

```
bucket: fossapp_prj_046eb0a0306a
objects:
  - FOSS.dwt                    ← Template (uploaded at project creation)
  - F1_v1_FloorPlan.dwg         ← Area F1, version 1
  - F1_v2_FloorPlan.dwg         ← Area F1, version 2
  - _temp/abc123/input.dwg      ← Temporary DA files (cleaned up)
```

**Implications:**
- Can't move/rename a "folder" (must copy each object individually)
- Can't set permissions on a "folder"
- Empty "folders" don't exist (no objects with that prefix = no folder)
- List "folder" contents using prefix filter: `GET /objects?beginsWith=prefix/`
- No cross-bucket copy API (must download from bucket A, upload to bucket B)

---

## Model Derivative Lifecycle

### The Orphan Problem

**CRITICAL**: Model Derivative translations (SVF2 files, thumbnails, property databases) are stored **separately** from OSS buckets.

```
┌─────────────────┐     ┌─────────────────┐
│   OSS Bucket    │     │ Model Derivative│
│                 │     │    Service      │
│  FloorPlan.dwg ─┼────>│  SVF2 files     │
│                 │     │  Thumbnails     │
│                 │     │  Properties.db  │
└─────────────────┘     └─────────────────┘
         │                      │
    DELETE bucket         Files PERSIST!
         │                      │
         ▼                      ▼
      Gone ✓              Still exists ✗
```

**Key facts:**
- Deleting an OSS bucket/object does **NOT** delete the corresponding derivatives
- Derivatives persist **indefinitely** on Autodesk servers until explicitly deleted
- There is **no API** to list all derivatives for an account
- The only way to delete is: `DELETE /modelderivative/v2/regions/eu/designdata/{urn}/manifest`

### URN Structure

URN = base64-encoded object identifier (without padding):

```
urn:adsk.objects:os.object:{bucketKey}/{objectKey}
↓ base64 encode
dXJuOmFkc2sub2JqZWN0czpvcy5vYmplY3Q6Zm9zc2FwcF9wcmpfMDQ2ZWIwYTAzMDZhL0YxX3YxX0Zsb29yUGxhbi5kd2c
```

### Cleanup Implementation

When deleting a floor plan, we **must** delete both:

1. **OSS object**: `deleteFloorPlanObject(projectId, objectKey)`
2. **Derivatives**: `deleteDerivatives(urn)`

```typescript
// src/lib/planner/aps-planner-service.ts
export async function deleteDerivatives(urn: string): Promise<void> {
  const response = await fetch(
    `https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/${urn}/manifest`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  )
  // 200/202 = deleted, 404 = already gone
}
```

This is called from `deleteAreaRevisionFloorPlanAction()` in `floorplan-actions.ts`.

---

## Design Automation Workflow

DA processes uploaded DWGs through the FOSS.dwt template:

```
User DWG ──┐
           │
FOSS.dwt ──┼──> AutoCAD (cloud) ──> Processed DWG ──> SVF2 Translation
           │
Script ────┘
```

### Signed URL Types

**IMPORTANT**: DA requires OSS signed URLs, NOT S3-compatible URLs.

| Method | Works with DA | Format |
|--------|---------------|--------|
| `/signed?access=readwrite` | ✅ Yes | OSS signed URL |
| `signedS3Upload()` SDK | ❌ No | S3-compatible URL |

```typescript
// CORRECT - for DA
const url = await fetch(
  `/oss/v2/buckets/${bucket}/objects/${key}/signed?access=readwrite`,
  { method: 'POST', body: JSON.stringify({ minutesExpiration: 60 }) }
)

// WRONG - doesn't work with DA
const result = await ossClient.signedS3Upload(bucket, key, options)
```

---

## Orphan Cleanup Script

If you need to clean up orphaned derivatives (from deleted buckets), you must:

1. Have a list of possible bucket/object combinations (from logs, DB, backups)
2. Reconstruct URNs: `base64(urn:adsk.objects:os.object:{bucket}/{object})`
3. Check if manifest exists: `GET .../designdata/{urn}/manifest`
4. Delete if found: `DELETE .../designdata/{urn}/manifest`

**There is no way to discover all derivatives** without knowing the URNs.

In FOSSAPP, we store URNs in `project_area_revisions.floor_plan_urn`, so we can query orphaned ones from the database.

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/planner/aps-planner-service.ts` | OSS operations, translation, derivative cleanup |
| `src/lib/planner/design-automation-service.ts` | DA WorkItem submission |
| `src/lib/actions/areas/floorplan-actions.ts` | Delete floor plan (calls both OSS + derivative delete) |
| `src/lib/tiles/aps/oss-service.ts` | Tiles OSS operations (separate from planner) |
