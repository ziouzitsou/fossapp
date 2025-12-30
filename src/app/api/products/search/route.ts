import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { searchProductsFTSAction } from '@fossapp/products'
import { checkRateLimit, rateLimitHeaders } from '@fossapp/core/ratelimit'

export async function GET(request: NextRequest) {
  // Require authentication
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Unauthorized - Authentication required' },
      { status: 401 }
    )
  }

  // Rate limiting
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
    const results = await searchProductsFTSAction(query, userId)
    return NextResponse.json({ data: results })
  } catch (error) {
    console.error('Product search API error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}