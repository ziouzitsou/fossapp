import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    await request.json()
    
    // Direct SQL execution disabled for security
    // Use specific API endpoints instead (e.g., /api/products/search)
    return NextResponse.json({ 
      error: 'Direct SQL execution disabled for security. Use specific API endpoints instead.' 
    }, { status: 400 })
    
  } catch (error) {
    console.error('Database query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}