/**
 * Project Areas Actions - Backward Compatibility Re-exports
 *
 * This file maintains backward compatibility for existing imports.
 * New code should import directly from '@/lib/actions/areas'.
 *
 * The actual implementations are now in:
 * - areas/area-crud-actions.ts - list, get, create, update, delete areas
 * - areas/revision-actions.ts - revision management
 * - areas/revision-products-actions.ts - dropdown items, revision products
 * - areas/floorplan-actions.ts - floor plan and placement management
 *
 * Note: 'use server' is declared in each action file, not here.
 */

// Re-export everything from the new modular structure
export * from './areas'
