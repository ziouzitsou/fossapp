/**
 * Test GoogleDriveProjectService
 * Run with: npx tsx scripts/test-project-service.ts
 *
 * This creates a test project folder, then cleans it up.
 */

// Load environment variables first
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getGoogleDriveProjectService } from '../src/lib/google-drive-project-service'
import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

async function testProjectService() {
  console.log('🔄 Testing GoogleDriveProjectService...\n')

  const service = getGoogleDriveProjectService()

  // Test project code
  const testProjectCode = 'TEST-9999-001'

  try {
    // 1. Create project folder
    console.log(`📁 Creating project folder: ${testProjectCode}`)
    const result = await service.createProjectFolder(testProjectCode)

    console.log(`   ✅ Project folder created: ${result.projectFolderId}`)
    console.log(`   ✅ Version 1 folder created: ${result.versionFolderId}`)
    console.log('')

    // 2. List files in v1 folder
    console.log('📂 Listing v1 folder contents...')
    const v1Files = await service.listFiles(result.versionFolderId)

    for (const file of v1Files) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 3. List files in one subfolder
    const inputFolder = v1Files.find(f => f.name === '01_Input')
    if (inputFolder) {
      console.log('📂 Listing 01_Input contents...')
      const inputFiles = await service.listFiles(inputFolder.id)
      for (const file of inputFiles) {
        console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
      }
      console.log('')
    }

    // 4. Test creating a new version
    console.log('📁 Creating version 2 (copy of v1)...')
    const v2Result = await service.createVersion(
      result.projectFolderId,
      result.versionFolderId,
      2
    )
    console.log(`   ✅ Version 2 folder created: ${v2Result.versionFolderId}`)
    console.log('')

    // 5. List project folder to see both versions
    console.log('📂 Listing project folder...')
    const projectFiles = await service.listFiles(result.projectFolderId)
    for (const file of projectFiles) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 6. Test archiving
    console.log('📦 Archiving project...')
    await service.archiveProject(result.projectFolderId)
    console.log('   ✅ Project moved to Archive folder')
    console.log('')

    // 7. Clean up - delete the test project from Archive
    console.log('🧹 Cleaning up (deleting test project)...')

    try {
      // Need direct drive access to delete from archive
      const credentialsPath = path.join(process.cwd(), 'credentials', 'google-service-account.json')
      const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      })
      const drive = google.drive({ version: 'v3', auth })

      await drive.files.delete({
        fileId: result.projectFolderId,
        supportsAllDrives: true,
      })
      console.log('   ✅ Test project deleted')
    } catch (cleanupError: unknown) {
      const err = cleanupError as Error
      console.log('   ⚠️  Cleanup failed (manual cleanup may be needed):', err.message)
      console.log('   Project folder ID:', result.projectFolderId)
    }
    console.log('')

    console.log('─'.repeat(50))
    console.log('✅ All service tests passed!')
    console.log('─'.repeat(50))

  } catch (error: unknown) {
    const err = error as Error
    console.error('❌ Test failed:', err.message)
    console.error(err)
    process.exit(1)
  }
}

testProjectService()
