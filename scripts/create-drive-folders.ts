/**
 * Create Projects folder in HUB Shared Drive
 * Run with: npx tsx scripts/create-drive-folders.ts
 */

import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

async function createDriveFolders() {
  console.log('🔄 Creating folders in HUB Shared Drive...\n')

  // Load credentials
  const credentialsPath = path.join(process.cwd(), 'credentials', 'google-service-account.json')
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'))

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  })

  const drive = google.drive({ version: 'v3', auth })

  const HUB_DRIVE_ID = '0AIqVhsENOYQjUk9PVA'

  // Create Projects folder
  console.log('📁 Creating "Projects" folder...')

  const projectsFolder = await drive.files.create({
    requestBody: {
      name: 'Projects',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [HUB_DRIVE_ID],
    },
    supportsAllDrives: true,
    fields: 'id, name',
  })

  console.log(`   ✅ Created: ${projectsFolder.data.name}`)
  console.log(`      ID: ${projectsFolder.data.id}`)
  console.log('')

  // Output environment variables
  console.log('─'.repeat(50))
  console.log('Add this to your .env.local:')
  console.log('─'.repeat(50))
  console.log(`GOOGLE_DRIVE_PROJECTS_FOLDER_ID=${projectsFolder.data.id}`)
  console.log('─'.repeat(50))
  console.log('')
  console.log('✅ Done!')
}

createDriveFolders().catch(console.error)
