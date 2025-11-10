# Google Drive Shared Drive Integration for FOSSAPP

**Last Updated:** 2025-11-10
**Status:** Documentation & Testing Phase
**Test Tool Location:** `/home/sysadmin/tools/gdrive-sync/`

---

## Overview

FOSSAPP will integrate with Google Drive's Shared Drives (specifically the **HUB** shared drive) to manage product catalogs, supplier data, and documentation files. This integration provides full CRUD operations (Create, Read, Update, Delete) with automatic OAuth token refresh.

**Why Shared Drives:**
- Centralized storage for team access
- No single-user ownership (files belong to the organization)
- Better for collaborative work and automation
- Survives user account changes

**Test Tool Purpose:**
The `gdrive-sync` Next.js application serves as:
1. **Testing environment** for Google Drive API operations
2. **Documentation reference** for implementation patterns
3. **OAuth flow prototype** without complicating FOSSAPP codebase
4. **Interactive debugging tool** for API behavior

---

## Architecture

### Authentication Flow

```
┌─────────────────┐
│  FOSSAPP User   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   NextAuth v4 (FOSSAPP)             │
│   - Google OAuth Provider           │
│   - Domain Restriction: @foss.gr    │
│   - Scopes: drive (full access)     │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   JWT Token Storage                 │
│   - Access Token (expires ~1hr)     │
│   - Refresh Token (long-lived)      │
│   - Expiration Timestamp            │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Automatic Token Refresh           │
│   - Checks expiration before API    │
│   - Uses refresh token              │
│   - Updates JWT automatically       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│   Google Drive API v3               │
│   - HUB Shared Drive Operations     │
│   - File/Folder CRUD                │
└─────────────────────────────────────┘
```

---

## OAuth Configuration

### 1. Google Cloud Console Setup

**Required APIs:**
- Google Drive API v3

**OAuth 2.0 Credentials:**
```
Type: Web application
Authorized JavaScript origins:
  - https://app.titancnc.eu
  - http://localhost:8080 (development)

Authorized redirect URIs:
  - https://app.titancnc.eu/api/auth/callback/google
  - http://localhost:8080/api/auth/callback/google

Scopes needed:
  - openid
  - email
  - profile
  - https://www.googleapis.com/auth/drive (full read/write access)
```

**Important:** Do NOT use `drive.readonly` scope - it blocks delete/rename operations.

### 2. NextAuth Configuration

**File:** `app/api/auth/[...nextauth]/route.ts` (NextAuth v4) or `auth.ts` (NextAuth v5)

```typescript
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline", // Request refresh token
          response_type: "code",
          scope: "openid email profile https://www.googleapis.com/auth/drive",
          hd: "foss.gr", // Restrict OAuth UI to @foss.gr domain
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Server-side domain validation (critical security layer)
      const email = user.email;
      const allowedDomain = "foss.gr";

      if (!email || !email.endsWith(`@${allowedDomain}`)) {
        return false; // Reject unauthorized domains
      }

      return true;
    },
    async jwt({ token, account }) {
      // Initial sign-in: Store tokens and expiration
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : Date.now() + 3600 * 1000; // Default 1 hour
      }

      // Token still valid
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token expired - refresh it
      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Pass access token to client-side session
      session.accessToken = token.accessToken as string;
      session.error = token.error;
      return session;
    },
  },
};

async function refreshAccessToken(token: any) {
  try {
    const url =
      "https://oauth2.googleapis.com/token?" +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      });

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      method: "POST",
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### 3. Environment Variables

**File:** `.env.local`

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Domain Restriction
ALLOWED_DOMAIN=foss.gr

# NextAuth Configuration
NEXTAUTH_URL=https://app.titancnc.eu
NEXTAUTH_SECRET=your-random-secret-here

# HUB Shared Drive ID (get from gdrive-sync test tool)
GOOGLE_DRIVE_HUB_ID=0AIqVhsENOYQjUk9PVA
```

**Generate NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

### 4. TypeScript Types

**File:** `types/next-auth.d.ts`

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    error?: string;
  }
}
```

---

## Google Drive Service Layer

### Service Class Implementation

**File:** `lib/google-drive-service.ts`

```typescript
import { google } from "googleapis";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  iconLink?: string;
  webViewLink?: string;
  thumbnailLink?: string;
  isFolder: boolean;
}

export class GoogleDriveService {
  private drive;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    this.drive = google.drive({
      version: "v3",
      auth,
    });
  }

  /**
   * List files in HUB Shared Drive folder
   * @param folderId - Folder ID or "root" for drive root
   * @param driveId - HUB Shared Drive ID (default: from env)
   */
  async listSharedDriveFiles(
    folderId: string = "root",
    driveId: string = process.env.GOOGLE_DRIVE_HUB_ID!
  ): Promise<DriveFile[]> {
    try {
      // For shared drives, "root" means the driveId itself
      const parentId = folderId === "root" ? driveId : folderId;
      const query = `'${parentId}' in parents and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        driveId: driveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: "drive", // Search within this specific drive
        fields:
          "files(id, name, mimeType, size, modifiedTime, iconLink, webViewLink, thumbnailLink)",
        orderBy: "folder,name", // Folders first, then alphabetical
        pageSize: 1000, // Adjust based on needs
      });

      const files = response.data.files || [];

      return files.map((file) => ({
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: file.size,
        modifiedTime: file.modifiedTime || undefined,
        iconLink: file.iconLink || undefined,
        webViewLink: file.webViewLink || undefined,
        thumbnailLink: file.thumbnailLink || undefined,
        isFolder: file.mimeType === "application/vnd.google-apps.folder",
      }));
    } catch (error) {
      console.error("Error listing shared drive files:", error);
      throw error;
    }
  }

  /**
   * Create a folder in HUB Shared Drive
   * @param folderName - Name of the new folder
   * @param parentId - Parent folder ID (default: root)
   * @param driveId - HUB Shared Drive ID
   */
  async createFolder(
    folderName: string,
    parentId: string = process.env.GOOGLE_DRIVE_HUB_ID!,
    driveId: string = process.env.GOOGLE_DRIVE_HUB_ID!
  ): Promise<DriveFile> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [parentId],
        },
        supportsAllDrives: true,
        fields: "id, name, mimeType, modifiedTime",
      });

      const folder = response.data;

      return {
        id: folder.id!,
        name: folder.name!,
        mimeType: folder.mimeType!,
        modifiedTime: folder.modifiedTime || undefined,
        isFolder: true,
      };
    } catch (error) {
      console.error("Error creating folder:", error);
      throw error;
    }
  }

  /**
   * Upload a file to HUB Shared Drive
   * @param fileName - Name of the file
   * @param fileContent - File content (Buffer or Stream)
   * @param mimeType - MIME type of the file
   * @param parentId - Parent folder ID
   */
  async uploadFile(
    fileName: string,
    fileContent: Buffer | NodeJS.ReadableStream,
    mimeType: string,
    parentId: string = process.env.GOOGLE_DRIVE_HUB_ID!
  ): Promise<DriveFile> {
    try {
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [parentId],
        },
        media: {
          mimeType: mimeType,
          body: fileContent,
        },
        supportsAllDrives: true,
        fields: "id, name, mimeType, size, modifiedTime",
      });

      const file = response.data;

      return {
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: file.size || undefined,
        modifiedTime: file.modifiedTime || undefined,
        isFolder: false,
      };
    } catch (error) {
      console.error("Error uploading file:", error);
      throw error;
    }
  }

  /**
   * Rename a file or folder
   * @param fileId - ID of the file/folder to rename
   * @param newName - New name
   */
  async renameFile(fileId: string, newName: string): Promise<DriveFile> {
    try {
      const response = await this.drive.files.update({
        fileId,
        requestBody: {
          name: newName,
        },
        supportsAllDrives: true,
        fields: "id, name, mimeType, size, modifiedTime",
      });

      const file = response.data;

      return {
        id: file.id!,
        name: file.name!,
        mimeType: file.mimeType!,
        size: file.size || undefined,
        modifiedTime: file.modifiedTime || undefined,
        isFolder: file.mimeType === "application/vnd.google-apps.folder",
      };
    } catch (error) {
      console.error("Error renaming file:", error);
      throw error;
    }
  }

  /**
   * Delete a file or folder
   * @param fileId - ID of the file/folder to delete
   */
  async deleteFile(fileId: string): Promise<void> {
    try {
      await this.drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
    } catch (error) {
      console.error("Error deleting file:", error);
      throw error;
    }
  }

  /**
   * Download file content
   * @param fileId - ID of the file to download
   */
  async downloadFile(fileId: string): Promise<Buffer> {
    try {
      const response = await this.drive.files.get(
        {
          fileId,
          alt: "media",
          supportsAllDrives: true,
        },
        { responseType: "arraybuffer" }
      );

      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      console.error("Error downloading file:", error);
      throw error;
    }
  }

  /**
   * Move a file to a different folder
   * @param fileId - ID of the file to move
   * @param newParentId - ID of the destination folder
   */
  async moveFile(fileId: string, newParentId: string): Promise<DriveFile> {
    try {
      // First, get current parents
      const file = await this.drive.files.get({
        fileId,
        fields: "parents",
        supportsAllDrives: true,
      });

      const previousParents = file.data.parents?.join(",");

      // Move file
      const response = await this.drive.files.update({
        fileId,
        addParents: newParentId,
        removeParents: previousParents,
        supportsAllDrives: true,
        fields: "id, name, mimeType, parents",
      });

      const movedFile = response.data;

      return {
        id: movedFile.id!,
        name: movedFile.name!,
        mimeType: movedFile.mimeType!,
        isFolder: movedFile.mimeType === "application/vnd.google-apps.folder",
      };
    } catch (error) {
      console.error("Error moving file:", error);
      throw error;
    }
  }
}
```

---

## API Routes

### List Files Endpoint

**File:** `app/api/drive/files/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleDriveService } from "@/lib/google-drive-service";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for token refresh error
    if (session.error === "RefreshAccessTokenError") {
      return NextResponse.json(
        { error: "Token refresh failed. Please sign in again." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId") || "root";

    const driveService = new GoogleDriveService(session.accessToken);
    const files = await driveService.listSharedDriveFiles(folderId);

    return NextResponse.json({ files });
  } catch (error) {
    console.error("Error fetching files:", error);
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    );
  }
}
```

### Create Folder Endpoint

**File:** `app/api/drive/folders/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleDriveService } from "@/lib/google-drive-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderName, parentId } = body;

    if (!folderName) {
      return NextResponse.json(
        { error: "Missing folderName parameter" },
        { status: 400 }
      );
    }

    const driveService = new GoogleDriveService(session.accessToken);
    const folder = await driveService.createFolder(folderName, parentId);

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: "Failed to create folder" },
      { status: 500 }
    );
  }
}
```

### Upload File Endpoint

**File:** `app/api/drive/upload/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleDriveService } from "@/lib/google-drive-service";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const parentId = formData.get("parentId") as string;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const driveService = new GoogleDriveService(session.accessToken);
    const uploadedFile = await driveService.uploadFile(
      file.name,
      buffer,
      file.type,
      parentId
    );

    return NextResponse.json({ file: uploadedFile });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
```

### Rename Endpoint

**File:** `app/api/drive/rename/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleDriveService } from "@/lib/google-drive-service";

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileId, newName } = body;

    if (!fileId || !newName) {
      return NextResponse.json(
        { error: "Missing fileId or newName parameter" },
        { status: 400 }
      );
    }

    const driveService = new GoogleDriveService(session.accessToken);
    const updatedFile = await driveService.renameFile(fileId, newName);

    return NextResponse.json({ file: updatedFile });
  } catch (error) {
    console.error("Error renaming file:", error);
    return NextResponse.json(
      { error: "Failed to rename file" },
      { status: 500 }
    );
  }
}
```

### Delete Endpoint

**File:** `app/api/drive/delete/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { GoogleDriveService } from "@/lib/google-drive-service";

export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    if (!fileId) {
      return NextResponse.json(
        { error: "Missing fileId parameter" },
        { status: 400 }
      );
    }

    const driveService = new GoogleDriveService(session.accessToken);
    await driveService.deleteFile(fileId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    return NextResponse.json(
      { error: "Failed to delete file" },
      { status: 500 }
    );
  }
}
```

---

## Token Auto-Refresh Mechanism

### How It Works

1. **Token Storage:**
   - Access token stored in encrypted JWT
   - Refresh token stored alongside (never exposed to client)
   - Expiration timestamp tracked

2. **Automatic Check:**
   - Every API request checks token expiration
   - Happens in `jwt()` callback before session creation
   - Transparent to the user

3. **Refresh Process:**
   ```
   Token Expired? → Yes → Call Google OAuth Token Endpoint
                          → Get New Access Token
                          → Update JWT with new token & expiry
                          → Continue API request

   Token Valid?   → Yes → Use existing token
                          → Continue API request
   ```

4. **Error Handling:**
   - If refresh fails: Set `error: "RefreshAccessTokenError"` in session
   - Client receives 401 with clear message
   - User prompted to sign in again

### Token Lifespan

- **Access Token:** ~1 hour (Google's standard)
- **Refresh Token:** Long-lived (until revoked)
- **JWT Session:** Configurable in NextAuth (default: 30 days)

### Testing Token Refresh

**Simulate token expiration:**
```typescript
// In auth.ts jwt callback, temporarily override expiration
token.accessTokenExpires = Date.now() - 1000; // Already expired
```

**Monitor refresh in logs:**
```bash
# Watch for automatic refresh
npm run dev | grep "refresh"
```

---

## HUB Shared Drive Structure

### Recommended Folder Organization

```
HUB Shared Drive (0AIqVhsENOYQjUk9PVA)
├── Catalogs/
│   ├── Meyer/
│   │   ├── meyer_catalog_2025.xml
│   │   ├── families/
│   │   └── archived/
│   ├── Foss/
│   └── Other_Suppliers/
│
├── ETIM/
│   ├── mappings/
│   ├── validation_reports/
│   └── reference_data/
│
├── Documentation/
│   ├── API_Docs/
│   ├── User_Guides/
│   └── Technical_Specs/
│
└── Temp/
    └── uploads/
```

### Getting Folder IDs

**Via gdrive-sync test tool:**
1. Navigate to the folder in the UI
2. Check browser URL or API logs
3. Copy folder ID from URL or response

**Via API:**
```typescript
const driveService = new GoogleDriveService(accessToken);
const files = await driveService.listSharedDriveFiles("root");
const catalogsFolder = files.find(f => f.name === "Catalogs");
console.log(catalogsFolder.id); // Use this ID for operations
```

---

## Usage Examples

### Example 1: List Catalogs Folder

```typescript
import { GoogleDriveService } from "@/lib/google-drive-service";

// In API route or server component
const session = await getServerSession(authOptions);
const driveService = new GoogleDriveService(session.accessToken);

// List root HUB drive
const rootFiles = await driveService.listSharedDriveFiles("root");

// Find Catalogs folder
const catalogsFolder = rootFiles.find(f => f.name === "Catalogs");

// List files in Catalogs folder
const catalogFiles = await driveService.listSharedDriveFiles(catalogsFolder.id);
```

### Example 2: Upload Supplier Catalog

```typescript
import fs from "fs";
import { GoogleDriveService } from "@/lib/google-drive-service";

async function uploadSupplierCatalog(
  catalogPath: string,
  supplierName: string
) {
  const session = await getServerSession(authOptions);
  const driveService = new GoogleDriveService(session.accessToken);

  // Get or create supplier folder
  const rootFiles = await driveService.listSharedDriveFiles("root");
  const catalogsFolder = rootFiles.find(f => f.name === "Catalogs");

  let supplierFolder = await driveService.listSharedDriveFiles(catalogsFolder.id);
  supplierFolder = supplierFolder.find(f => f.name === supplierName);

  if (!supplierFolder) {
    supplierFolder = await driveService.createFolder(
      supplierName,
      catalogsFolder.id
    );
  }

  // Upload catalog XML
  const fileBuffer = fs.readFileSync(catalogPath);
  const fileName = `${supplierName}_catalog_${new Date().toISOString().split('T')[0]}.xml`;

  const uploadedFile = await driveService.uploadFile(
    fileName,
    fileBuffer,
    "application/xml",
    supplierFolder.id
  );

  return uploadedFile;
}
```

### Example 3: Backup and Replace File

```typescript
async function backupAndReplaceFile(
  fileId: string,
  newFileContent: Buffer,
  fileName: string
) {
  const driveService = new GoogleDriveService(session.accessToken);

  // Rename old file to include timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await driveService.renameFile(fileId, `${fileName}_backup_${timestamp}`);

  // Upload new file with original name
  const parentId = /* get parent folder ID */;
  const newFile = await driveService.uploadFile(
    fileName,
    newFileContent,
    "application/xml",
    parentId
  );

  return { backup: fileId, new: newFile.id };
}
```

---

## Error Handling

### Common Errors & Solutions

**1. Token Expired (401)**
```typescript
// Client receives this response
{
  "error": "Token refresh failed. Please sign in again."
}

// User action: Sign out and sign back in
// Prevention: Automatic refresh should handle this
```

**2. Insufficient Scopes (403)**
```typescript
// Error in logs
Error: Request had insufficient authentication scopes

// Solution: Update OAuth scope to 'drive' instead of 'drive.readonly'
// Must re-authenticate after scope change
```

**3. File Not Found (404)**
```typescript
try {
  await driveService.deleteFile(fileId);
} catch (error) {
  if (error.code === 404) {
    console.log("File already deleted or doesn't exist");
  }
}
```

**4. Rate Limit Exceeded (429)**
```typescript
// Implement exponential backoff
async function retryWithBackoff(fn: Function, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.code === 429 && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
}
```

---

## Testing Strategy

### 1. Unit Tests (Service Layer)

```typescript
// lib/__tests__/google-drive-service.test.ts
import { GoogleDriveService } from "../google-drive-service";

describe("GoogleDriveService", () => {
  let service: GoogleDriveService;

  beforeEach(() => {
    service = new GoogleDriveService(mockAccessToken);
  });

  test("listSharedDriveFiles returns files", async () => {
    const files = await service.listSharedDriveFiles("root");
    expect(files).toBeInstanceOf(Array);
  });

  test("createFolder creates folder successfully", async () => {
    const folder = await service.createFolder("Test Folder");
    expect(folder.isFolder).toBe(true);
    expect(folder.name).toBe("Test Folder");
  });
});
```

### 2. Integration Tests (gdrive-sync tool)

**Manual Testing Checklist:**
- [ ] Sign in with @foss.gr account
- [ ] Navigate to HUB shared drive
- [ ] List files in root folder
- [ ] Navigate into subfolder
- [ ] Create new folder
- [ ] Upload test file
- [ ] Rename file/folder
- [ ] Delete file/folder
- [ ] Wait 1 hour and verify auto-refresh
- [ ] Test with expired token

### 3. API Endpoint Tests

```typescript
// app/api/drive/__tests__/files.test.ts
import { GET } from "../files/route";

describe("GET /api/drive/files", () => {
  test("returns 401 without session", async () => {
    const response = await GET(new Request("http://localhost/api/drive/files"));
    expect(response.status).toBe(401);
  });

  test("returns files with valid session", async () => {
    // Mock session
    const response = await GET(
      new Request("http://localhost/api/drive/files?folderId=root")
    );
    const data = await response.json();
    expect(data.files).toBeDefined();
  });
});
```

---

## Security Considerations

### 1. Token Storage

**✅ Secure:**
- Tokens stored in encrypted JWT
- HttpOnly cookies (can't access via JavaScript)
- Secure flag in production (HTTPS only)
- SameSite=Lax to prevent CSRF

**❌ Never Do:**
- Store tokens in localStorage
- Expose tokens in client-side code
- Log tokens in production
- Send tokens in URL parameters

### 2. Domain Restriction

**Two-layer validation:**
```typescript
// Layer 1: OAuth consent screen restriction (hd parameter)
// Limits which accounts can even START sign-in flow

// Layer 2: Server-side validation (signIn callback)
// Final check - rejects sign-in if domain doesn't match
if (!email.endsWith("@foss.gr")) {
  return false;
}
```

### 3. Scope Minimization

**Current scope:** `https://www.googleapis.com/auth/drive`
- Grants full read/write access
- Required for delete and rename operations

**Future consideration:**
- Consider file-level permissions for sensitive catalogs
- Use separate service account for automated tasks
- Implement audit logging for all operations

### 4. Rate Limiting

**Implement on FOSSAPP side:**
```typescript
// Simple in-memory rate limiter
const rateLimiter = new Map();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userRequests = rateLimiter.get(userId) || [];

  // Remove requests older than 1 minute
  const recentRequests = userRequests.filter(
    (time: number) => now - time < 60000
  );

  if (recentRequests.length >= 100) {
    return false; // Rate limit exceeded
  }

  recentRequests.push(now);
  rateLimiter.set(userId, recentRequests);
  return true;
}
```

---

## Performance Optimization

### 1. Caching Strategy

```typescript
// Cache folder structure (expires after 5 minutes)
const folderCache = new Map<string, { files: DriveFile[]; expires: number }>();

async function getCachedFiles(folderId: string): Promise<DriveFile[]> {
  const cached = folderCache.get(folderId);

  if (cached && Date.now() < cached.expires) {
    return cached.files;
  }

  const files = await driveService.listSharedDriveFiles(folderId);
  folderCache.set(folderId, {
    files,
    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
  });

  return files;
}
```

### 2. Batch Operations

```typescript
// Upload multiple files in parallel
async function uploadMultipleFiles(
  files: Array<{ name: string; content: Buffer; mimeType: string }>,
  parentId: string
) {
  const driveService = new GoogleDriveService(accessToken);

  // Upload in batches of 5
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const uploads = batch.map(file =>
      driveService.uploadFile(file.name, file.content, file.mimeType, parentId)
    );

    const batchResults = await Promise.all(uploads);
    results.push(...batchResults);
  }

  return results;
}
```

### 3. Pagination for Large Folders

```typescript
async function listAllFiles(folderId: string): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      pageSize: 1000,
      pageToken,
      // ... other params
    });

    allFiles.push(...response.data.files);
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);

  return allFiles;
}
```

---

## Migration Path (Current to Future)

### Phase 1: Testing (Current)
- ✅ Use gdrive-sync tool for API exploration
- ✅ Document all patterns and edge cases
- ✅ Test OAuth flow and token refresh
- ✅ Validate shared drive operations

### Phase 2: FOSSAPP Integration (Next)
1. Copy `GoogleDriveService` class to FOSSAPP
2. Add NextAuth configuration with Google provider
3. Create API endpoints for catalog management
4. Update environment variables
5. Test in development environment

### Phase 3: Production Deployment
1. Create production OAuth credentials
2. Update FOSSAPP OAuth settings
3. Deploy with environment variables
4. Test end-to-end in production
5. Monitor logs for token refresh

### Phase 4: Feature Enhancement
- Add file versioning
- Implement audit logging
- Create UI for catalog uploads
- Add scheduled sync jobs
- Implement webhook notifications

---

## Dependencies

### npm Packages Required

```json
{
  "dependencies": {
    "next": "^16.0.0",
    "next-auth": "^4.24.0",
    "react": "^19.0.0",
    "googleapis": "^144.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Install:**
```bash
npm install googleapis next-auth
```

---

## Monitoring & Debugging

### 1. Enable Debug Logging

```bash
# In .env.local
NEXTAUTH_DEBUG=true
NODE_ENV=development
```

### 2. Log Important Operations

```typescript
// Add to GoogleDriveService methods
console.log(`[GoogleDrive] Listing files in folder: ${folderId}`);
console.log(`[GoogleDrive] Upload complete: ${fileName} (${file.id})`);
console.log(`[GoogleDrive] Token refreshed at ${new Date().toISOString()}`);
```

### 3. Monitor API Usage

**Check Google Cloud Console:**
- APIs & Services → Dashboard
- View quota usage
- Monitor error rates
- Track request patterns

---

## Troubleshooting Guide

### Issue: "This app hasn't been verified"

**Solution:**
- Click "Advanced" → "Go to [app name] (unsafe)"
- Or: Submit app for Google verification (for production)

### Issue: Files not showing in shared drive

**Check:**
1. User has access to HUB shared drive
2. Using correct drive ID
3. Query includes `supportsAllDrives: true`
4. Scope includes `drive` access

### Issue: Token refresh not working

**Check:**
1. `access_type: "offline"` in OAuth config
2. Refresh token stored in JWT
3. No errors in token refresh function
4. Client ID/Secret correct in env vars

### Issue: Rate limit errors

**Solution:**
- Implement exponential backoff
- Cache frequently accessed data
- Reduce API call frequency
- Consider service account for batch operations

---

## Reference Links

**Google Drive API:**
- [API Reference](https://developers.google.com/drive/api/v3/reference)
- [Shared Drives Guide](https://developers.google.com/drive/api/guides/about-shareddrives)
- [OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

**NextAuth:**
- [Documentation](https://next-auth.js.org/getting-started/introduction)
- [Google Provider](https://next-auth.js.org/providers/google)
- [JWT Callback](https://next-auth.js.org/configuration/callbacks#jwt-callback)

**Test Tool:**
- Location: `/home/sysadmin/tools/gdrive-sync/`
- Documentation: `CLAUDE.md`, `NEXTAUTH_V5_SETUP.md`
- GitHub: https://github.com/gagarinyury/claude-config-editor

---

## Contact & Support

**For FOSSAPP Development:**
- Developer: Dimitri (@foss.gr)
- Location: Athens, Greece
- Environment: WSL2 on Windows 10 HP Zbook 17

**Questions About This Integration:**
- Check gdrive-sync test tool first
- Review logs at `http://localhost:3002` (when server running)
- Test operations manually before coding

---

**Last Updated:** 2025-11-10
**Status:** ✅ Ready for FOSSAPP integration
**Test Tool:** ✅ Fully functional with all CRUD operations
