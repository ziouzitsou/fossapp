# Google Drive Shared Drive Integration Guide

**Purpose**: Enable FOSSAPP to read and write files/folders to Google Workspace Shared Drive "HUB"

**Last Updated**: 2025-11-15

---

## Overview

This guide documents the technical implementation for integrating Google Drive Shared Drives (formerly Team Drives) into FOSSAPP for file operations. The integration allows FOSSAPP to:

- List files/folders in the HUB Shared Drive
- Read file contents from Shared Drive
- Create new files/folders in Shared Drive
- Update existing files in Shared Drive
- Search across Shared Drive contents

---

## Required Dependencies

```bash
npm install googleapis@latest
```

**Package**: `googleapis` (official Google APIs client library)
- Provides Drive API v3 client
- Handles OAuth2 authentication
- Type-safe TypeScript interfaces

**Note**: If using NextAuth for authentication, you already have the necessary OAuth infrastructure.

---

## Google Cloud Console Setup

### 1. Enable Required APIs

In Google Cloud Console → APIs & Services → Library:

- **Google Drive API** (required)

### 2. OAuth 2.0 Configuration

**Create OAuth 2.0 Client ID** (or use existing):

- Type: Web application
- Authorized JavaScript origins:
  - `http://localhost:8080` (development)
  - `https://app.titancnc.eu` (production)
- Authorized redirect URIs:
  - `http://localhost:8080/api/auth/callback/google`
  - `https://app.titancnc.eu/api/auth/callback/google`

### 3. Required OAuth Scopes

For **read-only** access:
```
https://www.googleapis.com/auth/drive.readonly
```

For **read/write** access (required for creating/updating files):
```
https://www.googleapis.com/auth/drive.file
```

For **full Drive access** (read/write all files):
```
https://www.googleapis.com/auth/drive
```

**Recommendation**: Use `drive.file` scope (files created/opened by the app only) for security, unless full access is required.

### 4. OAuth Consent Screen

- User Type: Internal (for Google Workspace `@foss.gr` domain)
- Add required scopes listed above
- Add test users if needed

---

## Environment Variables

Add to `.env.local`:

```bash
# Google OAuth Credentials
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Domain restriction (optional but recommended)
ALLOWED_DOMAIN=foss.gr

# Shared Drive configuration
SHARED_DRIVE_NAME=HUB
SHARED_DRIVE_ID=<drive-id>  # Get this from Drive URL or API call
```

**Finding Shared Drive ID**:
- Open Shared Drive in browser
- URL format: `https://drive.google.com/drive/folders/<DRIVE_ID>`
- Or use API call: `drive.drives.list()` and find by name

---

## Authentication Setup

### Option 1: Using NextAuth (Recommended for FOSSAPP)

**auth.ts** (or auth config file):

```typescript
import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request offline access for refresh tokens
          access_type: "offline",
          // Request both profile and Drive access
          scope: "openid email profile https://www.googleapis.com/auth/drive.file",
          // Restrict to Google Workspace domain
          hd: process.env.ALLOWED_DOMAIN,
        },
      },
    }),
  ],
  callbacks: {
    // Store access token in JWT
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    },
    // Pass access token to session
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      session.refreshToken = token.refreshToken as string
      return session
    },
    // Domain validation (server-side security)
    async signIn({ user }) {
      const allowedDomain = process.env.ALLOWED_DOMAIN
      if (allowedDomain && user.email) {
        return user.email.endsWith(`@${allowedDomain}`)
      }
      return true
    },
  },
})
```

**TypeScript types** (`types/next-auth.d.ts`):

```typescript
import "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    refreshToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
  }
}
```

### Option 2: Direct OAuth2 (Without NextAuth)

If not using NextAuth, implement OAuth2 flow manually using `googleapis` OAuth2Client.

---

## Google Drive Service Implementation

**lib/google-drive-shared.ts**:

```typescript
import { google } from "googleapis"

/**
 * Google Drive service for Shared Drive operations
 * Requires user's OAuth access token
 */
export class GoogleDriveSharedService {
  private drive

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })

    this.drive = google.drive({ version: "v3", auth })
  }

  /**
   * List files in Shared Drive folder
   * @param folderId - Folder ID (use Shared Drive ID for root)
   * @param sharedDriveId - Shared Drive ID
   */
  async listFiles(folderId: string, sharedDriveId: string) {
    const response = await this.drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink)",
      // CRITICAL for Shared Drives
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "drive",
      driveId: sharedDriveId,
    })

    return response.data.files || []
  }

  /**
   * Get file metadata
   * @param fileId - File ID
   */
  async getFile(fileId: string) {
    const response = await this.drive.files.get({
      fileId,
      fields: "id, name, mimeType, size, modifiedTime, webViewLink",
      supportsAllDrives: true,
    })

    return response.data
  }

  /**
   * Download file contents
   * @param fileId - File ID
   */
  async downloadFile(fileId: string) {
    const response = await this.drive.files.get(
      {
        fileId,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "arraybuffer" }
    )

    return response.data
  }

  /**
   * Create a new file in Shared Drive
   * @param name - File name
   * @param mimeType - MIME type
   * @param content - File content (string or Buffer)
   * @param parentFolderId - Parent folder ID
   * @param sharedDriveId - Shared Drive ID
   */
  async createFile(
    name: string,
    mimeType: string,
    content: string | Buffer,
    parentFolderId: string,
    sharedDriveId: string
  ) {
    const response = await this.drive.files.create({
      requestBody: {
        name,
        mimeType,
        parents: [parentFolderId],
      },
      media: {
        mimeType,
        body: content,
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    })

    return response.data
  }

  /**
   * Update existing file content
   * @param fileId - File ID
   * @param content - New file content
   * @param mimeType - MIME type
   */
  async updateFile(fileId: string, content: string | Buffer, mimeType: string) {
    const response = await this.drive.files.update({
      fileId,
      media: {
        mimeType,
        body: content,
      },
      supportsAllDrives: true,
    })

    return response.data
  }

  /**
   * Create a folder in Shared Drive
   * @param name - Folder name
   * @param parentFolderId - Parent folder ID (use Shared Drive ID for root)
   * @param sharedDriveId - Shared Drive ID
   */
  async createFolder(name: string, parentFolderId: string, sharedDriveId: string) {
    const response = await this.drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId],
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    })

    return response.data
  }

  /**
   * Search files in Shared Drive
   * @param query - Search query (e.g., "name contains 'invoice'")
   * @param sharedDriveId - Shared Drive ID
   */
  async searchFiles(query: string, sharedDriveId: string) {
    const response = await this.drive.files.list({
      q: `${query} and trashed=false`,
      fields: "files(id, name, mimeType, size, modifiedTime, webViewLink)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "drive",
      driveId: sharedDriveId,
    })

    return response.data.files || []
  }

  /**
   * Get Shared Drive details
   * @param sharedDriveId - Shared Drive ID
   */
  async getSharedDrive(sharedDriveId: string) {
    const response = await this.drive.drives.get({
      driveId: sharedDriveId,
      fields: "id, name",
    })

    return response.data
  }

  /**
   * List all accessible Shared Drives
   */
  async listSharedDrives() {
    const response = await this.drive.drives.list({
      fields: "drives(id, name)",
    })

    return response.data.drives || []
  }
}
```

---

## API Route Example

**app/api/drive/shared/files/route.ts**:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { GoogleDriveSharedService } from "@/lib/google-drive-shared"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const folderId = searchParams.get("folderId") || process.env.SHARED_DRIVE_ID!
  const sharedDriveId = process.env.SHARED_DRIVE_ID!

  try {
    const driveService = new GoogleDriveSharedService(session.accessToken)
    const files = await driveService.listFiles(folderId, sharedDriveId)

    return NextResponse.json({ files })
  } catch (error) {
    console.error("Drive API error:", error)
    return NextResponse.json(
      { error: "Failed to fetch files" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!session?.accessToken) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    )
  }

  const { name, content, mimeType, parentFolderId } = await request.json()
  const sharedDriveId = process.env.SHARED_DRIVE_ID!

  try {
    const driveService = new GoogleDriveSharedService(session.accessToken)
    const file = await driveService.createFile(
      name,
      mimeType,
      content,
      parentFolderId || sharedDriveId,
      sharedDriveId
    )

    return NextResponse.json({ file })
  } catch (error) {
    console.error("Drive API error:", error)
    return NextResponse.json(
      { error: "Failed to create file" },
      { status: 500 }
    )
  }
}
```

---

## Critical Parameters for Shared Drives

**All Drive API calls MUST include these parameters when working with Shared Drives:**

```typescript
{
  supportsAllDrives: true,        // Required for Shared Drives
  includeItemsFromAllDrives: true, // Include Shared Drive items in results
  corpora: "drive",               // Scope to specific drive
  driveId: sharedDriveId,         // The Shared Drive ID
}
```

**Without these parameters**, API calls will only work with "My Drive" and ignore Shared Drives.

---

## Common Use Cases

### 1. List Files in HUB Root

```typescript
const driveService = new GoogleDriveSharedService(accessToken)
const files = await driveService.listFiles(
  process.env.SHARED_DRIVE_ID!,  // Use drive ID as folder ID for root
  process.env.SHARED_DRIVE_ID!
)
```

### 2. Upload a File

```typescript
const driveService = new GoogleDriveSharedService(accessToken)
const file = await driveService.createFile(
  "invoice-2024.pdf",
  "application/pdf",
  fileBuffer,
  parentFolderId,  // Folder where file should be created
  process.env.SHARED_DRIVE_ID!
)
```

### 3. Search for Files

```typescript
const driveService = new GoogleDriveSharedService(accessToken)
const files = await driveService.searchFiles(
  "name contains 'invoice' and mimeType = 'application/pdf'",
  process.env.SHARED_DRIVE_ID!
)
```

### 4. Create a Folder

```typescript
const driveService = new GoogleDriveSharedService(accessToken)
const folder = await driveService.createFolder(
  "2024 Invoices",
  process.env.SHARED_DRIVE_ID!,  // Parent (root of Shared Drive)
  process.env.SHARED_DRIVE_ID!
)
```

---

## Query Syntax for Search

Google Drive API uses a query language for `q` parameter:

**Common operators:**
```
name contains 'text'              # File name contains text
mimeType = 'application/pdf'      # Specific MIME type
modifiedTime > '2024-01-01'       # Modified after date
'parentId' in parents             # Files in specific folder
trashed = false                   # Not in trash
```

**MIME types:**
```
application/vnd.google-apps.folder         # Folders
application/pdf                            # PDF files
text/plain                                 # Text files
application/vnd.google-apps.spreadsheet    # Google Sheets
application/vnd.google-apps.document       # Google Docs
```

**Combining queries:**
```typescript
const query = "name contains 'invoice' and mimeType = 'application/pdf' and trashed = false"
```

---

## Error Handling

### Access Token Expiration

OAuth access tokens typically expire after 1 hour. Implement token refresh:

```typescript
// In NextAuth jwt callback
async jwt({ token, account }) {
  if (account) {
    token.accessToken = account.access_token
    token.refreshToken = account.refresh_token
    token.expiresAt = account.expires_at
  }

  // Refresh token if expired
  if (Date.now() < token.expiresAt * 1000) {
    return token
  }

  return refreshAccessToken(token)
}
```

### Common Errors

**401 Unauthorized**: Access token expired or invalid → Re-authenticate user

**403 Forbidden**:
- Insufficient permissions → Check OAuth scopes
- File not shared → Verify Shared Drive access
- Drive API not enabled → Enable in Google Cloud Console

**404 Not Found**: File/folder doesn't exist → Verify ID

**429 Rate Limit**: Too many requests → Implement exponential backoff

---

## Security Considerations

1. **Domain Restriction**: Always validate user's email domain in `signIn` callback
2. **Token Storage**: Store access tokens securely in encrypted JWTs (NextAuth handles this)
3. **Scope Limitation**: Use narrowest scope possible (`drive.file` vs `drive`)
4. **Server-side Only**: Never expose access tokens to client-side code
5. **HTTPS Only**: Use HTTPS in production for OAuth callbacks

---

## Testing

### 1. Get Shared Drive ID

```bash
# In browser, open Shared Drive and copy ID from URL
# Or use API:
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://www.googleapis.com/drive/v3/drives?fields=drives(id,name)"
```

### 2. Test List Files

```bash
curl -H "Authorization: Bearer ACCESS_TOKEN" \
  "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=SHARED_DRIVE_ID"
```

### 3. Test File Upload

```bash
curl -X POST \
  -H "Authorization: Bearer ACCESS_TOKEN" \
  -F "metadata={name:'test.txt',parents:['FOLDER_ID']};type=application/json" \
  -F "file=@test.txt;type=text/plain" \
  "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true"
```

---

## Performance Considerations

1. **Caching**: Google Drive API responses are cached server-side by Google (5-15 minutes)
2. **Pagination**: Use `pageSize` and `pageToken` for large file lists
3. **Batch Requests**: Use batch API for multiple operations
4. **Partial Response**: Use `fields` parameter to request only needed fields

---

## Migration from "My Drive" to Shared Drive

If migrating existing code:

**Before (My Drive)**:
```typescript
await drive.files.list({
  q: "'folderId' in parents",
})
```

**After (Shared Drive)**:
```typescript
await drive.files.list({
  q: "'folderId' in parents and trashed=false",
  supportsAllDrives: true,        // ADD
  includeItemsFromAllDrives: true, // ADD
  corpora: "drive",               // ADD
  driveId: sharedDriveId,         // ADD
})
```

**Apply to all operations**: `files.list`, `files.get`, `files.create`, `files.update`, `files.delete`

---

## References

- [Google Drive API v3 Documentation](https://developers.google.com/drive/api/v3/reference)
- [Shared Drives Guide](https://developers.google.com/drive/api/guides/enable-shareddrives)
- [googleapis npm package](https://www.npmjs.com/package/googleapis)
- [NextAuth.js Documentation](https://authjs.dev)

---

**Document Status**: Ready for implementation
**Next Steps**:
1. Enable Google Drive API in Google Cloud Console
2. Configure OAuth credentials
3. Add environment variables
4. Implement GoogleDriveSharedService class
5. Create API routes
6. Test with HUB Shared Drive
