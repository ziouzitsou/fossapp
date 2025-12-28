/**
 * Projects Actions - Backward Compatibility Re-exports
 *
 * This file maintains backward compatibility for existing imports.
 * New code should import directly from '@/lib/actions/projects'.
 *
 * The actual implementations are now in:
 * - projects/project-crud-actions.ts - list, get, create, update, delete
 * - projects/project-product-actions.ts - add, update, remove products
 * - projects/project-utility-actions.ts - generate code, update Drive folder
 *
 * Note: 'use server' is declared in each action file, not here.
 */

// Re-export everything from the new modular structure
export * from './projects/index'
