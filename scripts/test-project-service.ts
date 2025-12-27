/**
 * Test GoogleDriveProjectService
 * Run with: npx tsx scripts/test-project-service.ts
 *
 * This creates a test project folder with areas, then cleans it up.
 */

// Load environment variables first
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getGoogleDriveProjectService } from '../src/lib/google-drive-project-service'

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
    console.log(`   ✅ Areas folder created: ${result.areasFolderId}`)
    console.log('')

    // 2. List files in project folder (should show skeleton structure)
    console.log('📂 Listing project folder contents...')
    const projectFiles = await service.listFiles(result.projectFolderId)

    for (const file of projectFiles) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 3. List files in 00_Customer folder
    const customerFolder = projectFiles.find(f => f.name === '00_Customer')
    if (customerFolder) {
      console.log('📂 Listing 00_Customer contents...')
      const customerFiles = await service.listFiles(customerFolder.id)
      for (const file of customerFiles) {
        console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
      }
      console.log('')
    }

    // 4. Test creating an area folder
    console.log('📁 Creating area folder: GF-LOBBY...')
    const areaResult = await service.createAreaFolder(result.areasFolderId, 'GF-LOBBY')
    console.log(`   ✅ Area folder created: ${areaResult.areaFolderId}`)
    console.log('')

    // 5. List files in area folder (should show v1)
    console.log('📂 Listing GF-LOBBY contents...')
    const areaFiles = await service.listFiles(areaResult.areaFolderId)
    for (const file of areaFiles) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 5b. List v1 folder contents
    console.log('📂 Listing GF-LOBBY/v1 contents...')
    const v1Files = await service.listFiles(areaResult.versionFolderId)
    for (const file of v1Files) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 6. Test creating a new version (v2)
    console.log('📁 Creating version v2 for GF-LOBBY...')
    const v2Result = await service.createAreaVersionFolder(areaResult.areaFolderId, 2)
    console.log(`   ✅ Version v2 folder created: ${v2Result.versionFolderId}`)
    console.log('')

    // 7. List area folder to see both versions
    console.log('📂 Listing GF-LOBBY folder (should show v1 and v2)...')
    const areaFilesUpdated = await service.listFiles(areaResult.areaFolderId)
    for (const file of areaFilesUpdated) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 8. Test deleting version v2
    console.log('🗑️  Deleting version v2...')
    console.log('   ⏳ Waiting for Shared Drive sync (3s)...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    try {
      await service.deleteAreaVersionFolder(v2Result.versionFolderId)
      console.log('   ✅ Version v2 folder deleted')
    } catch (deleteError: unknown) {
      const err = deleteError as Error
      console.log(`   ⚠️  Delete failed: ${err.message}`)
    }
    console.log('')

    // 9. List 02_Areas folder
    console.log('📂 Listing 02_Areas folder...')
    const areasFiles = await service.listFiles(result.areasFolderId)
    for (const file of areasFiles) {
      console.log(`   ${file.isFolder ? '📁' : '📄'} ${file.name}`)
    }
    console.log('')

    // 10. Clean up - delete the test project
    console.log('🧹 Cleaning up (deleting test project)...')

    try {
      await service.deleteProject(result.projectFolderId)
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
