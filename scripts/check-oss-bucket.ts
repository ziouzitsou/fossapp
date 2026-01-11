/**
 * Check APS OSS Bucket Existence and Contents
 *
 * Useful for verifying cleanup after project deletion.
 *
 * Usage:
 *   npx tsx scripts/check-oss-bucket.ts <bucket-name>
 *   npx tsx scripts/check-oss-bucket.ts fossapp_prj_929bbb544b42
 *
 * @module scripts/check-oss-bucket
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

// Load environment variables from .env.local BEFORE importing APS modules
dotenv.config({ path: path.join(process.cwd(), '.env.local') })

async function checkOssBucket(bucketName: string) {
  // Dynamic import after env vars are loaded
  const { APSAuthService } = await import('../src/lib/tiles/aps/auth-service')
  console.log(`\n🔍 Checking OSS bucket: ${bucketName}\n`)
  console.log('─'.repeat(50))

  const authService = new APSAuthService()
  const accessToken = await authService.getAccessToken()

  // Check if bucket exists
  const bucketResponse = await fetch(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/details`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  )

  if (bucketResponse.status === 404) {
    console.log('✅ Bucket does NOT exist (deleted or never created)')
    console.log('─'.repeat(50))
    return
  }

  if (!bucketResponse.ok) {
    console.error(`❌ Error checking bucket: ${bucketResponse.status} ${bucketResponse.statusText}`)
    const errorText = await bucketResponse.text()
    console.error('   ', errorText)
    process.exit(1)
  }

  const bucketDetails = await bucketResponse.json()
  console.log('⚠️  Bucket EXISTS')
  console.log('')
  console.log('Bucket Details:')
  console.log(`   Key:      ${bucketDetails.bucketKey}`)
  console.log(`   Owner:    ${bucketDetails.bucketOwner}`)
  console.log(`   Policy:   ${bucketDetails.policyKey}`)
  console.log(`   Created:  ${new Date(bucketDetails.createdDate).toISOString()}`)
  console.log('')

  // List objects in bucket
  console.log('Objects in bucket:')
  console.log('─'.repeat(50))

  const objectsResponse = await fetch(
    `https://developer.api.autodesk.com/oss/v2/buckets/${bucketName}/objects`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    }
  )

  if (objectsResponse.ok) {
    const objectsData = await objectsResponse.json()
    const items = objectsData.items || []

    if (items.length === 0) {
      console.log('   (empty)')
    } else {
      for (const obj of items) {
        const sizeKB = (obj.size / 1024).toFixed(1)
        console.log(`   📄 ${obj.objectKey} (${sizeKB} KB)`)
      }
    }
  }

  console.log('─'.repeat(50))
  console.log('')
  console.log('💡 To delete this bucket, run:')
  console.log(`   npx tsx scripts/delete-oss-bucket.ts ${bucketName}`)
}

// CLI entry point
const bucketName = process.argv[2]

if (!bucketName) {
  console.error('Usage: npx tsx scripts/check-oss-bucket.ts <bucket-name>')
  console.error('')
  console.error('Examples:')
  console.error('  npx tsx scripts/check-oss-bucket.ts fossapp_prj_929bbb544b42')
  console.error('  npx tsx scripts/check-oss-bucket.ts tile-processing-1234567890-abc123')
  process.exit(1)
}

checkOssBucket(bucketName).catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
