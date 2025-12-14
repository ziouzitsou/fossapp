/**
 * Symbol Generator Analyze API
 *
 * POST /api/symbol-generator/analyze
 *
 * Analyzes a luminaire product using Claude Vision to generate
 * a text description suitable for AutoCAD symbol creation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit, rateLimitHeaders } from '@/lib/ratelimit'
import { analyzeForSymbol } from '@/lib/symbol-generator/vision-service'
import { extractDimensions } from '@/lib/symbol-generator/dimension-utils'
import { ProductInfo } from '@/types/product'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for vision analysis

interface AnalyzePayload {
  product: ProductInfo
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Rate limiting
    const rateLimit = checkRateLimit(session.user.email, 'symbol-generator')
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Max 20 analyses per minute.',
        },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
      )
    }

    // Parse request body
    const payload: AnalyzePayload = await request.json()

    if (!payload.product) {
      return NextResponse.json(
        { success: false, error: 'Product is required' },
        { status: 400 }
      )
    }

    if (!payload.product.foss_pid) {
      return NextResponse.json(
        { success: false, error: 'Product must have a foss_pid' },
        { status: 400 }
      )
    }

    // Extract dimensions from ETIM features
    const dimensions = extractDimensions(payload.product)

    // Get image URLs from multimedia (prioritize MD02/MD64, fall back to MD01/MD12)
    const imageUrl = payload.product.multimedia?.find(
      m => m.mime_code === 'MD02'
    )?.mime_source || payload.product.multimedia?.find(
      m => m.mime_code === 'MD01'
    )?.mime_source

    const drawingUrl = payload.product.multimedia?.find(
      m => m.mime_code === 'MD64'
    )?.mime_source || payload.product.multimedia?.find(
      m => m.mime_code === 'MD12'
    )?.mime_source

    console.log(`[symbol-generator] Analyzing ${payload.product.foss_pid}`)
    console.log(`[symbol-generator] Image URL: ${imageUrl?.substring(0, 50)}...`)
    console.log(`[symbol-generator] Drawing URL: ${drawingUrl?.substring(0, 50)}...`)

    // Call vision service
    const result = await analyzeForSymbol({
      product: payload.product,
      dimensions,
      imageUrl,
      drawingUrl,
    })

    console.log(
      `[symbol-generator] Analysis complete: success=${result.success}, ` +
      `hadImage=${result.hadImage}, hadDrawing=${result.hadDrawing}, ` +
      `tokens=${result.tokensIn}/${result.tokensOut}, cost=$${result.costUsd.toFixed(4)}`
    )

    return NextResponse.json(result, {
      headers: rateLimitHeaders(rateLimit),
    })
  } catch (error) {
    console.error('[symbol-generator] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    )
  }
}
