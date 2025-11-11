import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { searchProductsAction } from '@/lib/actions'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query parameter required' }, { status: 400 })
  }

  try {
    // Get user session for event logging
    const session = await getServerSession(authOptions)
    const userId = session?.user?.email || undefined

    const results = await searchProductsAction(query, userId)
    return NextResponse.json({ data: results })
  } catch (error) {
    // Sanitized error logging
    console.error('API search error:',
      error instanceof Error ? error.message : 'Unknown error'
    )
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}