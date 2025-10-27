import { NextResponse } from 'next/server'
import packageJson from '@/../../package.json'

export async function GET() {
  try {
    // Basic health check
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: packageJson.version,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    }

    return NextResponse.json(healthStatus, { status: 200 })
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json(
      { 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      }, 
      { status: 503 }
    )
  }
}