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
      cursor: pointer;
    }
    .edit2d-label.marker-hoverable:hover {
      filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.9));
    }
  `
  document.head.appendChild(style)
  cssInjected = true
}
