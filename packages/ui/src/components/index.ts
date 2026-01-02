/**
 * UI Component Library
 *
 * Barrel export of all shadcn/ui components used in FOSSAPP.
 * These are client components built on Radix UI primitives.
 *
 * @remarks
 * Most components are standard shadcn/ui with minimal customization.
 * Custom/modified components:
 * - `color-picker`: OKLch color picker for theme customization
 * - `markdown-description`: Rich text rendering with Markdown support
 * - `sonner`: Toast notifications (wrapper around sonner library)
 * - `spinner`: Loading spinner (custom addition)
 * - `sidebar`: Collapsible navigation (heavily customized)
 *
 * @example
 * import { Button, Card, Input } from '@fossapp/ui'
 *
 * @module @fossapp/ui
 * @see {@link https://ui.shadcn.com} shadcn/ui documentation
 */

export * from './accordion'
export * from './alert'
export * from './alert-dialog'
export * from './avatar'
export * from './badge'
export * from './button'
export * from './card'
export * from './checkbox'
export * from './collapsible'
export * from './color-picker'
export * from './command'
export * from './dialog'
export * from './dropdown-menu'
export * from './input'
export * from './label'
export * from './markdown-description'
export * from './pagination'
export * from './popover'
export * from './progress'
export * from './radio-group'
export * from './scroll-area'
export * from './select'
export * from './separator'
export * from './sheet'
export * from './sidebar'
export * from './skeleton'
export * from './slider'
export * from './sonner'
export * from './spinner'
export * from './switch'
export * from './table'
export * from './tabs'
export * from './textarea'
export * from './toggle'
export * from './toggle-group'
export * from './tooltip'
