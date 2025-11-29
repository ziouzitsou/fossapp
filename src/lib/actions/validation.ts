'use server'

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

  const numericRegex = /^\d+$/
  if (!numericRegex.test(projectId)) {
    throw new Error('Invalid project ID format')
  }

  return projectId
}
