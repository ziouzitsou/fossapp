/**
 * @fossapp/core/validation
 *
 * Shared validation utilities for server actions.
 * These are pure utility functions - no 'use server' directive needed.
 */

import { VALIDATION } from '../config/constants'

/**
 * Validate and sanitize a search query string.
 * @throws Error if query is invalid or empty
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
 * Validate a product ID (UUID format).
 * @throws Error if product ID is invalid
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
 * Validate a customer ID (UUID or numeric string).
 * @throws Error if customer ID is invalid
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
 * Validate a project ID (UUID format).
 * @throws Error if project ID is invalid
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
 * Validate a taxonomy code (alphanumeric with dots, hyphens, underscores).
 * @throws Error if taxonomy code is invalid
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
 * Validate a supplier ID (positive integer).
 * @throws Error if supplier ID is invalid
 */
export function validateSupplierId(supplierId: number): number {
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('Invalid supplier ID')
  }
  return supplierId
}

/**
 * Validate a UUID string.
 * @throws Error if UUID is invalid
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
