'use client'

import { FilterCategoryProps } from './types'
import { ChevronDown, Factory, Zap, Palette, Lightbulb, MapPin, Settings, ClipboardList } from 'lucide-react'

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
  const getCategoryIcon = (categoryLabel: string) => {
    const lower = categoryLabel.toLowerCase()
    const iconClass = "w-4 h-4"
    if (lower.includes('source')) return <Factory className={iconClass} />
    if (lower.includes('electrical')) return <Zap className={iconClass} />
    if (lower.includes('design')) return <Palette className={iconClass} />
    if (lower.includes('light')) return <Lightbulb className={iconClass} />
    if (lower.includes('location')) return <MapPin className={iconClass} />
    if (lower.includes('option')) return <Settings className={iconClass} />
    return <ClipboardList className={iconClass} />
  }

  return (
    <div className="border-b border-border last:border-b-0">
      {/* Category Header */}
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center justify-between px-4
          font-semibold text-sm uppercase tracking-wide
          transition-all duration-200
          ${isExpanded
            ? 'py-3 bg-accent text-accent-foreground'
            : 'py-2 text-muted-foreground hover:bg-accent/50'
          }
        `}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2">
          {getCategoryIcon(label)}
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
        <div className="px-4 py-3 space-y-4 bg-card">
          {children}
        </div>
      )}
    </div>
  )
}
