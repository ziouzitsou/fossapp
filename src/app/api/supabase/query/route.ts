import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Input validation
function validateQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid query')
  }
  
  // Basic SQL injection prevention - only allow specific safe queries
  const allowedPatterns = [
    /^SELECT.*FROM items\.product_info.*$/i,
    /^SELECT.*FROM public\..*$/i
  ]
  
  const isAllowed = allowedPatterns.some(pattern => pattern.test(query.trim()))
  if (!isAllowed) {
    throw new Error('Query not allowed')
  }
  
  return query.trim()
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'SQL query required' }, { status: 400 })
    }

    // Validate and sanitize the query
    const validatedQuery = validateQuery(query)
    
    // For now, return a controlled error since direct SQL execution is not recommended
    // This endpoint should be replaced with specific API endpoints for each use case
    return NextResponse.json({ 
      error: 'Direct SQL execution disabled for security. Use specific API endpoints instead.' 
    }, { status: 400 })
    
    if (error) {
      console.error('Database query failed:', error)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
    
    return NextResponse.json({ data: data || [] })
  } catch (error) {
    console.error('Database query error:', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}