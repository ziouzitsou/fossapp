#!/usr/bin/env npx tsx
/**
 * Refresh FOSS.dwt template in a project bucket
 *
 * Usage: npx tsx scripts/refresh-template.ts <bucket-name>
 * Example: npx tsx scripts/refresh-template.ts fossapp_prj_929bbb544b42
 */

import { deleteTemplateFromBucket, uploadTemplateToProjectBucket } from '../src/lib/planner'
import { getGoogleDriveTemplateService } from '../src/lib/planner/google-drive-template-service'

async function main() {
  const bucketName = process.argv[2]

  if (!bucketName) {
    console.error('Usage: npx tsx scripts/refresh-template.ts <bucket-name>')
    console.error('Example: npx tsx scripts/refresh-template.ts fossapp_prj_929bbb544b42')
    process.exit(1)
  }

  console.log(`Refreshing FOSS.dwt in bucket: ${bucketName}`)

  // Step 1: Delete existing template
  console.log('1. Deleting existing template...')
  await deleteTemplateFromBucket(bucketName)

  // Step 2: Clear Google Drive cache and fetch fresh template
  console.log('2. Fetching fresh template from Google Drive...')
  const templateService = getGoogleDriveTemplateService()
  templateService.clearCache()
  const templateBuffer = await templateService.fetchFossTemplate()
  console.log(`   Template size: ${templateBuffer.length} bytes`)

  // Step 3: Upload to bucket
  console.log('3. Uploading to bucket...')
  await uploadTemplateToProjectBucket(bucketName, templateBuffer)

  console.log('✓ Template refreshed successfully!')
  console.log('  Now re-upload your floor plan to use the new template.')
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
