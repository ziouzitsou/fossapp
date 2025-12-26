import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge
 * This is the standard shadcn/ui utility function
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
