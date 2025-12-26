/**
 * Event Logger Utility
 *
 * @deprecated Import from '@fossapp/core/logging' or '@fossapp/core/logging/client' instead.
 *
 * This file re-exports from @fossapp/core for backward compatibility.
 */

// Re-export everything from the core package
export {
  logEvent,
  logEventsBatch,
  generateSessionId,
  logEventClient,
  type EventType,
  type EventData,
} from '@fossapp/core/logging'
