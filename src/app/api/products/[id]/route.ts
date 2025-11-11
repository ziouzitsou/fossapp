import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getProductByIdAction } from '@/lib/actions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const productId = resolvedParams.id

    if (!productId) {
      return NextResponse.json({ error: 'Product ID required' }, { status: 400 })
    }

    // Get user session for event logging
    const session = await getServerSession(authOptions)
    const userId = session?.user?.email || undefined

    const product = await getProductByIdAction(productId, userId)

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ data: product })
  } catch (error) {
    console.error('Product detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}