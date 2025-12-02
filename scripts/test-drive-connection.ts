/**
 * Test Google Drive Service Account Connection
 * Run with: npx tsx scripts/test-drive-connection.ts
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

async function testDriveConnection() {
  console.log('🔄 Testing Google Drive connection...\n')

  // Load service account credentials
  const credentialsPath = path.join(process.cwd(), 'credentials', 'google-service-account.json')

  if (!fs.existsSync(credentialsPath)) {
    console.error('❌ Credentials file not found:', credentialsPath)
    process.exit(1)
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))
  console.log('✅ Credentials loaded')
  console.log('   Service Account:', credentials.client_email)
  console.log('')

  // Create auth client
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  const drive = google.drive({ version: 'v3', auth })

  // List all Shared Drives
  console.log('📂 Listing Shared Drives...\n')

  try {
    const response = await drive.drives.list({
      fields: 'drives(id, name)',
    })

    const drives = response.data.drives || []

    if (drives.length === 0) {
      console.log('⚠️  No Shared Drives found.')
      console.log('   Make sure the service account is added to the Shared Drive.')
      process.exit(1)
    }

    console.log('Found Shared Drives:')
    console.log('─'.repeat(50))

    for (const d of drives) {
      console.log(`   📁 ${d.name}`)
      console.log(`      ID: ${d.id}`)
      console.log('')
    }

    // Find HUB drive
    const hubDrive = drives.find(d => d.name === 'HUB')

    if (hubDrive) {
      console.log('─'.repeat(50))
      console.log('✅ HUB Shared Drive found!')
      console.log('')
      console.log('Add this to your .env.local:')
      console.log('─'.repeat(50))
      console.log(`GOOGLE_DRIVE_HUB_ID=${hubDrive.id}`)
      console.log('─'.repeat(50))
      console.log('')

      // List root folders in HUB
      console.log('📂 Listing root folders in HUB...\n')

      const filesResponse = await drive.files.list({
        q: `'${hubDrive.id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        driveId: hubDrive.id!,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'drive',
        fields: 'files(id, name)',
      })

      const folders = filesResponse.data.files || []

      if (folders.length === 0) {
        console.log('   (No folders in root)')
      } else {
        for (const folder of folders) {
          console.log(`   📁 ${folder.name}`)
          console.log(`      ID: ${folder.id}`)
        }
      }

      console.log('')
      console.log('✅ Connection test successful!')

    } else {
      console.log('⚠️  HUB drive not found in the list.')
      console.log('   Available drives:', drives.map(d => d.name).join(', '))
    }

  } catch (error: any) {
    console.error('❌ Error connecting to Google Drive:')
    console.error('   ', error.message)

    if (error.code === 403) {
      console.log('\n   Possible causes:')
      console.log('   - Google Drive API not enabled')
      console.log('   - Service account not added to Shared Drive')
    }

    process.exit(1)
  }
}

testDriveConnection()
