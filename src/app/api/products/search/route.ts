import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { searchProductsBasicAction } from '@/lib/actions'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'

export async function GET(request: NextRequest) {
  // ✅ Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  // ✅ Rate limiting
  const rateLimit = checkRateLimit(session.user.email, 'products-search')
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please slow down.' },
      { status: 429, headers: rateLimitHeaders(rateLimit) }
    )
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
  }

  try {
    const userId = session.user.email
    const results = await searchProductsBasicAction(query, userId)
    return NextResponse.json({ data: results })
  } catch (error) {
    // Sanitized error logging
    console.error('API search error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}