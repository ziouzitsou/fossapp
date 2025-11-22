import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { logEvent, type EventType, type EventData } from '@/lib/event-logger'

/**
 * POST /api/analytics/log-event
 * Client-side event logging endpoint
 *
 * Accepts events from browser and logs them server-side with session context
 */
export async function POST(request: NextRequest) {
  try {
    // Get session to identify user
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { eventType, eventData } = body as {
      eventType: EventType
      eventData?: EventData
    }

    if (!eventType) {
      return NextResponse.json(
        { error: 'Missing eventType' },
        { status: 400 }
      )
    }

    // Extract pathname and user agent from request
    const pathname = request.headers.get('referer')
      ? new URL(request.headers.get('referer')!).pathname
      : undefined

    const userAgent = request.headers.get('user-agent') || undefined

    // Log the event
    const success = await logEvent(eventType, session.user.email, {
      eventData,
      pathname,
      userAgent,
    })

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to log event' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[API] Event logging error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
