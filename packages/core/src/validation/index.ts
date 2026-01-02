/**
 * Shared Validation Utilities
 *
 * Pure validation functions for server actions and API routes.
 * All functions throw on invalid input - use try/catch in calling code.
 *
 * @remarks
 * - Functions sanitize input (trim, length limits) before validation
 * - UUID validation uses RFC 4122 format
 * - Constants for limits come from `@fossapp/core/config`
 *
 * @module @fossapp/core/validation
 * @see {@link ../config/constants.ts} for validation limits
 */

import { VALIDATION } from '../config/constants'

/**
 * Validates and sanitizes a search query string.
 *
 * @remarks
 * Trims whitespace and enforces max length from VALIDATION.SEARCH_QUERY_MAX_LENGTH.
 *
 * @param query - Raw search query from user input
 * @returns Sanitized query string
 * @throws {Error} If query is empty, null, or not a string
 *
 * @example
 * const clean = validateSearchQuery('  led downlight  ')  // 'led downlight'
 * const clean = validateSearchQuery('')  // throws Error
 */
export function validateSearchQuery(query: string): string {
  if (!query || typeof query !== 'string') {
    throw new Error('Invalid search query')
  }

  const sanitized = query.trim().slice(0, VALIDATION.SEARCH_QUERY_MAX_LENGTH)
  if (sanitized.length === 0) {
    throw new Error('Search query cannot be empty')
  }

  return sanitized
}

/**
 * Validates a product ID in UUID format.
 *
 * @param productId - Product UUID from database
 * @returns The validated product ID
 * @throws {Error} If productId is not a valid UUID
 */
export function validateProductId(productId: string): string {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Invalid product ID')
  }

  if (!VALIDATION.UUID_REGEX.test(productId)) {
    throw new Error('Invalid product ID format')
  }

  return productId
}

/**
 * Validates a customer ID (UUID or legacy numeric ID).
 *
 * @remarks
 * FOSSAPP supports both UUID and numeric customer IDs for backwards
 * compatibility with legacy systems.
 *
 * @param customerId - Customer identifier (UUID or numeric string)
 * @returns The validated customer ID
 * @throws {Error} If customerId is neither a valid UUID nor numeric string
 */
export function validateCustomerId(customerId: string): string {
  if (!customerId || typeof customerId !== 'string') {
    throw new Error('Invalid customer ID')
  }

  // Customer IDs can be either UUIDs or numeric strings
  const numericRegex = /^\d+$/
  if (!VALIDATION.UUID_REGEX.test(customerId) && !numericRegex.test(customerId)) {
    throw new Error('Invalid customer ID format')
  }

  return customerId
}

/**
 * Validates a project ID in UUID format.
 *
 * @param projectId - Project UUID from database
 * @returns The validated project ID
 * @throws {Error} If projectId is not a valid UUID
 */
export function validateProjectId(projectId: string): string {
  if (!projectId || typeof projectId !== 'string') {
    throw new Error('Invalid project ID')
  }

  // Project IDs are UUIDs
  if (!VALIDATION.UUID_REGEX.test(projectId)) {
    throw new Error('Invalid project ID format')
  }

  return projectId
}

/**
 * Validates an ETIM taxonomy code.
 *
 * @remarks
 * ETIM codes follow patterns like "EC000123" (class) or "EF000456" (feature).
 * Allows alphanumeric, dots, hyphens, and underscores for flexibility.
 *
 * @param code - ETIM taxonomy code
 * @returns The sanitized and validated code
 * @throws {Error} If code contains invalid characters or exceeds max length
 */
export function validateTaxonomyCode(code: string): string {
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid taxonomy code')
  }

  const sanitized = code.trim()
  // Allow alphanumeric, dots, and hyphens for taxonomy codes
  const validPattern = /^[a-zA-Z0-9.\-_]+$/

  if (!validPattern.test(sanitized) || sanitized.length > VALIDATION.TAXONOMY_CODE_MAX_LENGTH) {
    throw new Error('Invalid taxonomy code format')
  }

  return sanitized
}

/**
 * Validates a supplier ID as a positive integer.
 *
 * @param supplierId - Numeric supplier identifier from database
 * @returns The validated supplier ID
 * @throws {Error} If supplierId is not a positive integer
 */
export function validateSupplierId(supplierId: number): number {
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('Invalid supplier ID')
  }
  return supplierId
}

/**
 * Generic UUID validator with customizable field name in error messages.
 *
 * @remarks
 * Use this for any UUID field that doesn't have a specific validator.
 * The fieldName parameter makes error messages more descriptive.
 *
 * @param uuid - The UUID string to validate
 * @param fieldName - Name to use in error messages (default: 'ID')
 * @returns The validated UUID
 * @throws {Error} If uuid is not a valid RFC 4122 UUID format
 *
 * @example
 * validateUUID(areaId, 'Area ID')  // throws 'Invalid Area ID format' if invalid
 */
export function validateUUID(uuid: string, fieldName = 'ID'): string {
  if (!uuid || typeof uuid !== 'string') {
    throw new Error(`Invalid ${fieldName}`)
  }

  if (!VALIDATION.UUID_REGEX.test(uuid)) {
    throw new Error(`Invalid ${fieldName} format`)
  }

  return uuid
}
