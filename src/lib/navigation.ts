/**
 * Centralized Navigation Configuration
 *
 * This file contains the main navigation structure used across all pages.
 * Update this file to add/remove/modify navigation items.
 */

import { MdDashboard, MdWork } from 'react-icons/md'
import type { IconType } from 'react-icons'

export interface NavigationItem {
  name: string
  icon: IconType
  href: string
  current: boolean
}

/**
 * Get navigation items with the current page marked
 * @param currentPath - The current page path (e.g., '/dashboard', '/products')
 * @returns Array of navigation items with the current page marked
 */
export function getNavigation(currentPath: string): NavigationItem[] {
  const allItems = [
    { name: 'Dashboard', icon: MdDashboard, href: '/dashboard' },
    { name: 'Products', icon: MdWork, href: '/products' },
    { name: 'Projects', icon: MdWork, href: '/projects' },
  ]

  return allItems.map(item => ({
    ...item,
    current: item.href === currentPath
  }))
}

/**
 * Navigation items without current state
 * Use getNavigation() instead for automatic current page detection
 */
export const navigationItems = [
  { name: 'Dashboard', icon: MdDashboard, href: '/dashboard' },
  { name: 'Products', icon: MdWork, href: '/products' },
  { name: 'Projects', icon: MdWork, href: '/projects' },
] as const
