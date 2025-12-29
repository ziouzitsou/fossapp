/**
 * Planner Viewer Utilities
 * Helper functions for the PlannerViewer component
 */

/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const pattern = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i
  const match = pattern.test(hex) ? hex.match(pattern) : null
  return match
    ? {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
}

// Script loading state (module-level singleton)
let scriptsLoaded = false
let scriptsLoading = false
const loadCallbacks: Array<() => void> = []

/**
 * Load Autodesk Viewer scripts (CSS + JS)
 * Uses singleton pattern to prevent duplicate loads
 */
export function loadAutodeskScripts(): Promise<void> {
  return new Promise((resolve) => {
    if (scriptsLoaded) {
      resolve()
      return
    }

    if (scriptsLoading) {
      loadCallbacks.push(resolve)
      return
    }

    scriptsLoading = true

    // Load CSS (minimal - we're not using their GUI)
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css'
    document.head.appendChild(link)

    // Load JS
    const script = document.createElement('script')
    script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js'
    script.onload = () => {
      scriptsLoaded = true
      scriptsLoading = false
      resolve()
      loadCallbacks.forEach(cb => cb())
      loadCallbacks.length = 0
    }
    script.onerror = () => {
      scriptsLoading = false
      console.error('Failed to load Autodesk Viewer scripts')
    }
    document.head.appendChild(script)
  })
}
