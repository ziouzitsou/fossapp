/**
 * Centralized Navigation Configuration
 *
 * This file contains the main navigation structure used across all pages.
 * Update this file to add/remove/modify navigation items.
 */

import { MdDashboard, MdWork, MdGridView, MdCode, MdEventNote } from 'react-icons/md'
import { FaUsers, FaFolderOpen } from 'react-icons/fa'
import type { IconType } from 'react-icons'

export interface NavigationItem {
  name: string
  icon: IconType
  href: string
  current: boolean
  badge?: string // Optional badge text (e.g., "Beta", "New")
}

/**
 * Get navigation items with the current page marked
 * @param currentPath - The current page path (e.g., '/dashboard', '/products')
 * @returns Array of navigation items with the current page marked
 */
export function getNavigation(currentPath: string): NavigationItem[] {
  const allItems = [
    { name: 'Dashboard', icon: MdDashboard, href: '/dashboard' },
    { name: 'Projects', icon: FaFolderOpen, href: '/projects' },
    { name: 'Customers', icon: FaUsers, href: '/customers' },
    { name: 'Products', icon: MdWork, href: '/products' },
    { name: 'Tiles', icon: MdGridView, href: '/tiles' },
    { name: 'Playground', icon: MdCode, href: '/playground' },
    { name: 'Planner', icon: MdEventNote, href: '/planner', badge: 'Beta' },
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
  { name: 'Projects', icon: FaFolderOpen, href: '/projects' },
  { name: 'Customers', icon: FaUsers, href: '/customers' },
  { name: 'Products', icon: MdWork, href: '/products' },
  { name: 'Tiles', icon: MdGridView, href: '/tiles' },
  { name: 'Playground', icon: MdCode, href: '/playground' },
  { name: 'Planner', icon: MdEventNote, href: '/planner', badge: 'Beta' },
] as const
