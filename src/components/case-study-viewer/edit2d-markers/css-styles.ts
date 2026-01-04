/**
 * Edit2D Markers - CSS Styles
 *
 * CSS injection for marker label hover effects.
 */

// CSS injection flag (only inject once per page)
let cssInjected = false

/**
 * Inject CSS for marker label hover effects (once per page)
 *
 * Creates smooth scale + glow animation on hover for better interactivity feel.
 */
export function injectHoverStyles(): void {
  if (cssInjected) return

  const style = document.createElement('style')
  style.id = 'edit2d-marker-hover-styles'
  style.textContent = `
    .edit2d-label.marker-hoverable {
      transition: transform 0.15s ease, box-shadow 0.15s ease !important;
      cursor: pointer;
    }
    .edit2d-label.marker-hoverable:hover {
      transform: scale(1.15) !important;
      box-shadow: 0 0 10px rgba(59, 130, 246, 0.8) !important;
    }
  `
  document.head.appendChild(style)
  cssInjected = true
}
