// @fossapp/ui - Shared UI components package
// Re-exports all components, hooks, utilities, and theme

// Utilities
export { cn } from './utils'

// Hooks
export { useIsMobile, useIsTablet } from './hooks'

// Theme
export { ThemeProvider } from './theme'

// Components (use subpath @fossapp/ui/components for tree-shaking)
// Or import individual components via @fossapp/ui/components/{name}
export * from './components'
