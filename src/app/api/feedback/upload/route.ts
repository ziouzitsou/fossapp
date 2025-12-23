/**
 * Feedback Upload API Route
 *
 * POST: Upload screenshot, image, or PDF to Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'
import { supabaseServer } from '@/lib/supabase-server'
import type { AttachmentType } from '@/types/feedback'

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES: Record<string, AttachmentType> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
}

export async function POST(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  const userEmail = session.user.email

  // Rate limiting
  const rateLimit = checkRateLimit(userEmail, 'feedback-upload')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please wait before uploading more files.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const chatId = formData.get('chat_id') as string | null
    const isScreenshot = formData.get('is_screenshot') === 'true'

    // Validate file
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    const attachmentType = ALLOWED_TYPES[file.type]
    if (!attachmentType) {
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Allowed types: ${Object.keys(ALLOWED_TYPES).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Generate unique path
    // Format: user_folder/chat_id/timestamp.extension
    const userFolder = userEmail.replace('@', '_at_').replace(/\./g, '_')
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || getExtensionFromMime(file.type)
    const fileName = `${userFolder}/${chatId || 'unassigned'}/${timestamp}.${extension}`

    // Upload to Supabase Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await supabaseServer.storage
      .from('feedback-attachments')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[Upload API] Supabase error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabaseServer.storage.from('feedback-attachments').getPublicUrl(fileName)

    // Determine final attachment type
    const finalType: AttachmentType = isScreenshot ? 'screenshot' : attachmentType

    return NextResponse.json({
      url: publicUrl,
      filename: file.name,
      size: file.size,
      type: finalType,
      path: fileName,
    })
  } catch (error) {
    console.error('[Upload API] Error:', error)
    return NextResponse.json(
      { error: 'Upload failed' },
      { status: 500 }
    )
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  }
  return map[mimeType] || 'bin'
}
