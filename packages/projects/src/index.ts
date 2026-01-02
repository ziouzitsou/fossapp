/**
 * @fossapp/projects - Project Management Domain Package
 *
 * Provides TypeScript types for the project management system.
 * Projects contain areas (physical spaces) with revision-controlled
 * product selections.
 *
 * @remarks
 * Import patterns:
 * - `@fossapp/projects` - All exports
 * - `@fossapp/projects/types` - Project types only
 * - `@fossapp/projects/types/areas` - Area/revision types only
 *
 * This package contains types only - server actions for projects
 * remain in the main app at `src/lib/actions/`.
 *
 * @example
 * ```ts
 * import { ProjectDetail, CreateAreaInput } from '@fossapp/projects'
 * import type { AreaRevision } from '@fossapp/projects/types/areas'
 * ```
 *
 * @packageDocumentation
 */

// Re-export all types
export * from './types'
