// Logging exports

// Types
export type { EventType, EventData } from './types'

// Client-side logger (browser-safe)
export { logEventClient } from './client'

// Server-side logger (requires supabaseServer)
export { logEvent, logEventsBatch, generateSessionId } from './server'
