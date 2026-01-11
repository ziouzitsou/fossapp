/**
 * Check Google Drive Folder Existence and Contents
 *
 * Useful for verifying cleanup after project deletion.
 * Works with both Shared Drives and regular folders.
 *
 * Usage:
 *   npx tsx scripts/check-drive-folder.ts <folder-id>
 *   npx tsx scripts/check-drive-folder.ts 1KpDkstH2wEna_OKHUVKdsU6NQUx9gwon
 *
 * @module scripts/check-drive-folder
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

async function checkDriveFolder(folderId: string) {
  console.log(`\n🔍 Checking Google Drive folder: ${folderId}\n`)
  console.log('─'.repeat(60))

  // Load service account credentials
  const credentialsPath = path.join(process.cwd(), 'credentials', 'google-service-account.json')

  if (!fs.existsSync(credentialsPath)) {
    console.error('❌ Credentials file not found:', credentialsPath)
    process.exit(1)
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  const drive = google.drive({ version: 'v3', auth })

  try {
    // Get folder metadata
    const folderResponse = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType, trashed, parents, createdTime',
      supportsAllDrives: true,
    })

    const folder = folderResponse.data

    if (folder.trashed) {
      console.log('🗑️  Folder EXISTS but is in TRASH')
    } else {
      console.log('⚠️  Folder EXISTS')
    }

    console.log('')
    console.log('Folder Details:')
    console.log(`   Name:     ${folder.name}`)
    console.log(`   ID:       ${folder.id}`)
    console.log(`   Type:     ${folder.mimeType}`)
    console.log(`   Created:  ${folder.createdTime}`)
    console.log(`   Trashed:  ${folder.trashed ? 'Yes' : 'No'}`)
    if (folder.parents && folder.parents.length > 0) {
      console.log(`   Parent:   ${folder.parents[0]}`)
    }
    console.log('')

    // List contents
    console.log('Contents:')
    console.log('─'.repeat(60))

    const contentsResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, size)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = contentsResponse.data.files || []

    if (files.length === 0) {
      console.log('   (empty)')
    } else {
      for (const file of files) {
        const isFolder = file.mimeType === 'application/vnd.google-apps.folder'
        const icon = isFolder ? '📁' : '📄'
        const size = file.size ? ` (${(parseInt(file.size) / 1024).toFixed(1)} KB)` : ''
        console.log(`   ${icon} ${file.name}${size}`)
      }
    }

    console.log('─'.repeat(60))
    console.log('')
    console.log('💡 To view in browser:')
    console.log(`   https://drive.google.com/drive/folders/${folderId}`)

  } catch (error: unknown) {
    const err = error as { code?: number; message?: string }

    if (err.code === 404) {
      console.log('✅ Folder does NOT exist (deleted or never created)')
      console.log('─'.repeat(60))
      return
    }

    console.error(`❌ Error: ${err.message}`)

    if (err.code === 403) {
      console.log('')
      console.log('   Possible causes:')
      console.log('   - Service account not added to the Shared Drive')
      console.log('   - Folder is in a different drive without access')
    }

    process.exit(1)
  }
}

// CLI entry point
const folderId = process.argv[2]

if (!folderId) {
  console.error('Usage: npx tsx scripts/check-drive-folder.ts <folder-id>')
  console.error('')
  console.error('Examples:')
  console.error('  npx tsx scripts/check-drive-folder.ts 1KpDkstH2wEna_OKHUVKdsU6NQUx9gwon')
  console.error('')
  console.error('Folder ID can be found in the Google Drive URL:')
  console.error('  https://drive.google.com/drive/folders/<folder-id>')
  process.exit(1)
}

checkDriveFolder(folderId).catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
