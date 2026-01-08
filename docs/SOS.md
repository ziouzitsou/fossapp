Here is a ready-to-use prompt you can give to your coding agent to implement a cleanup script for orphaned Autodesk Platform Services (APS) Model Derivative manifests when you no longer have access to the original buckets or object lists.

---

**Prompt for your coding agent:**

You are tasked with building a tool/script that helps clean up orphaned Model Derivative translations (manifests and associated SVF/SVF2 files, thumbnails, etc.) in Autodesk Platform Services (APS, formerly Forge) for cases where the original OSS buckets and objects have been deleted.

Key facts about APS behavior:
- Model Derivative translations are stored separately from OSS buckets.
- Deleting an OSS bucket (or its objects) does **not** automatically delete the corresponding derivatives.
- Derivatives persist indefinitely on Autodesk's servers until explicitly deleted via `DELETE /modelderivative/v2/designdata/{urn}/manifest`.
- There is **no official API endpoint** to list all existing translated URNs across an account or application.
- The URN of a translated file is the base64-encoded string of `urn:adsk.objects:os.object:{bucketKey}/{objectName}`.

Goal:
Create a script (preferably in Node.js or Python) that allows the user to provide a list of possible **bucketKeys** and **objectNames** (or patterns) from past uploads, reconstruct the corresponding base64 URNs, check if a manifest still exists for each, and optionally delete the orphaned derivatives.

Requirements:
1. Use 2-legged or 3-legged authentication (preferably 2-legged with appropriate scopes: `data:read` and `data:write`).
2. Implement the following functions:
   - Generate the correct base64 URN from bucketKey + objectName.
   - Check if a manifest exists: `GET /modelderivative/v2/designdata/{urn}/manifest` (handle 200 vs 404).
   - Delete the manifest and all derivatives: `DELETE /modelderivative/v2/designdata/{urn}/manifest`.
3. Input options:
   - Accept a text file or JSON array containing entries like:
     ```json
     [
       { "bucketKey": "my-old-bucket-123", "objectName": "design.rvt" },
       { "bucketKey": "project-abc", "objectName": "floor-plan.dwg" },
       ...
     ]
     ```
   - Or accept a CSV with columns: bucketKey, objectName
4. Script modes:
   - `--check` or `--dry-run`: Only list which URNs still have active manifests (do not delete).
   - `--delete`: Permanently delete the manifests for those that still exist.
   - `--verbose`: Show progress and results.
5. Safety features:
   - Require explicit confirmation before deletion unless `--force` is used.
   - Log all actions (which URNs were checked, found, deleted, or not found).
   - Handle rate limits gracefully (with retries and delays if needed).
6. Output a summary at the end:
   - Total checked
   - Still existing (orphaned)
   - Successfully deleted
   - Failed

Bonus (optional):
- Support wildcard patterns in objectName (e.g., "*.rvt") if the user has partial names.
- Allow loading from application logs if they contain past translation URNs.

Important notes:
- This is the only practical way to clean up orphaned derivatives after buckets are deleted.
- There is no way to discover all derivatives without knowing possible URNs — so the user must provide candidates from backups, logs, databases, or memory.

Please implement this as a standalone CLI tool with clear usage instructions.

---
