// Shared validation utilities for server actions
// Note: No 'use server' directive - these are pure utility functions called by server actions

import { VALIDATION } from '@/lib/constants'

/**
 * Shared validation utilities for server actions
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

export function validateProductId(productId: string): string {
  if (!productId || typeof productId !== 'string') {
    throw new Error('Invalid product ID')
  }

  if (!VALIDATION.UUID_REGEX.test(productId)) {
    throw new Error('Invalid product ID format')
  }

  return productId
}

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

export function validateSupplierId(supplierId: number): number {
  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    throw new Error('Invalid supplier ID')
  }
  return supplierId
}
