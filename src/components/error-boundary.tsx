'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { logEventClient } from '@fossapp/core/logging/client'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Error Boundary Component
 * Catches client-side errors and logs them to analytics
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)

    // Log error event to analytics
    logEventClient('client_error', {
      error_message: error.message,
      error_name: error.name,
      component_stack: errorInfo.componentStack?.slice(0, 500), // Truncate for storage
      error_stack: error.stack?.slice(0, 500),
    }).catch(err => {
      console.error('[ErrorBoundary] Failed to log error event:', err)
    })
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="max-w-md text-center space-y-4">
            <h2 className="text-2xl font-bold text-destructive">
              Something went wrong
            </h2>
            <p className="text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Global error handler for unhandled promise rejections
 * Call this once in your root layout or app component
 */
export function initializeGlobalErrorHandling() {
  if (typeof window === 'undefined') return

  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Global] Unhandled promise rejection:', event.reason)

    logEventClient('client_error', {
      error_type: 'unhandled_promise_rejection',
      error_message: event.reason?.message || String(event.reason),
      error_stack: event.reason?.stack?.slice(0, 500),
    })
  })

  // Handle global errors
  window.addEventListener('error', (event) => {
    console.error('[Global] Uncaught error:', event.error)

    logEventClient('client_error', {
      error_type: 'uncaught_error',
      error_message: event.error?.message || event.message,
      error_stack: event.error?.stack?.slice(0, 500),
      filename: event.filename,
      line_number: event.lineno,
      column_number: event.colno,
    })
  })
}
