/**
 * Class Name Utility
 *
 * The standard shadcn/ui className merging utility.
 * Combines clsx for conditional classes with tailwind-merge for
 * proper Tailwind CSS class deduplication.
 *
 * @module @fossapp/ui
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges Tailwind CSS classes with proper deduplication.
 *
 * @remarks
 * Uses clsx for conditional class handling and tailwind-merge to
 * resolve conflicting Tailwind classes (e.g., 'p-4' + 'p-2' → 'p-2').
 *
 * @param inputs - Class values (strings, objects, arrays, undefined, etc.)
 * @returns Merged, deduplicated class string
 *
 * @example
 * cn('p-4', 'bg-red-500')                    // 'p-4 bg-red-500'
 * cn('p-4', isLarge && 'p-8')                // 'p-8' if isLarge
 * cn('text-sm', className)                   // allows className override
 * cn('px-4 py-2', { 'bg-blue-500': active }) // conditional classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
