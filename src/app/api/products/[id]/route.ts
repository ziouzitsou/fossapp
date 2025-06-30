import { NextRequest, NextResponse } from 'next/server'
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

    const product = await getProductByIdAction(productId)
    
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ data: product })
  } catch (error) {
    console.error('Product detail error:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}