/**
 * @fossapp/ui - Shared UI Components Package
 *
 * Provides all UI components, hooks, and utilities for the FOSSAPP monorepo.
 * Built on shadcn/ui patterns with Radix UI primitives and Tailwind CSS.
 *
 * @remarks
 * **Import patterns:**
 * - Root import: `import { Button, cn } from '@fossapp/ui'`
 * - Subpath (tree-shaking): `import { Button } from '@fossapp/ui/components/button'`
 *
 * **Key exports:**
 * - 35+ shadcn/ui components (Button, Card, Dialog, etc.)
 * - `cn()` utility for Tailwind class merging
 * - `useIsMobile()`, `useIsTablet()` responsive hooks
 * - `ThemeProvider` for light/dark/system themes
 *
 * @module @fossapp/ui
 * @see {@link https://ui.shadcn.com} shadcn/ui documentation
 */

// Utilities
export { cn } from './utils'

// Hooks
export { useIsMobile, useIsTablet } from './hooks'

// Theme
export { ThemeProvider } from './theme'

// Components (use subpath @fossapp/ui/components for tree-shaking)
// Or import individual components via @fossapp/ui/components/{name}
export * from './components'
