'use client'

import { FilterCategoryProps } from './types'
import { ChevronDown } from 'lucide-react'

/**
 * FilterCategory - Collapsible container for filter groups
 * Groups related filters together (Electricals, Design, Light, etc.)
 */
export default function FilterCategory({
  label,
  isExpanded,
  onToggle,
  children
}: FilterCategoryProps) {
  // Category icons
  const getCategoryIcon = (label: string) => {
    const lower = label.toLowerCase()
    if (lower.includes('source')) return '🏭'
    if (lower.includes('electrical')) return '⚡'
    if (lower.includes('design')) return '🎨'
    if (lower.includes('light')) return '💡'
    if (lower.includes('location')) return '📍'
    if (lower.includes('option')) return '⚙️'
    return '📋'
  }

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center justify-between px-6 py-4
          font-semibold text-sm uppercase tracking-wide
          transition-all duration-200
          ${isExpanded
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/50'
          }
        `}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{getCategoryIcon(label)}</span>
          <span className="font-bold">{label}</span>
        </div>
        <div className={`
          transition-transform duration-200
          ${isExpanded ? 'rotate-180' : ''}
        `}>
          <ChevronDown
            size={18}
            className={isExpanded ? 'text-primary' : 'text-muted-foreground'}
          />
        </div>
      </button>

      {/* Category Content */}
      {isExpanded && (
        <div className="px-6 py-4 space-y-6 bg-card">
          {children}
        </div>
      )}
    </div>
  )
}
