/**
 * Search utility functions (client-side helpers)
 */

import type { TaxonomyNode } from '@/types/search'

/**
 * Build hierarchical taxonomy tree from flat array
 * @param nodes - Flat array of taxonomy nodes
 * @param parentCode - Parent code to filter by (null for root)
 * @returns Hierarchical tree structure
 */
export function buildTaxonomyTree(
  nodes: TaxonomyNode[],
  parentCode: string | null = null
): TaxonomyNode[] {
  return nodes
    .filter(n => n.parent_code === parentCode)
    .map(node => ({
      ...node,
      children: nodes
        .filter(n => n.parent_code === node.code)
        .map(childNode => ({
          ...childNode,
          children: nodes.filter(n => n.parent_code === childNode.code)
        }))
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Get all descendant taxonomy codes for a given code
 * @param nodes - All taxonomy nodes
 * @param code - Parent taxonomy code
 * @returns Array of all descendant codes (including the parent)
 */
export function getDescendantCodes(nodes: TaxonomyNode[], code: string): string[] {
  const descendants: string[] = [code]

  const findChildren = (parentCode: string) => {
    const children = nodes.filter(n => n.parent_code === parentCode)
    children.forEach(child => {
      descendants.push(child.code)
      findChildren(child.code)
    })
  }

  findChildren(code)
  return descendants
}

/**
 * Format price with currency symbol
 */
export function formatPrice(price: number | undefined, currency: 'EUR' | 'USD' = 'EUR'): string {
  if (price === undefined || price === null) return 'N/A'

  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${price.toFixed(2)}`
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}
