'use client'

import { TaxonomyCategory } from '@/lib/taxonomy-data'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import * as LucideIcons from 'lucide-react'
import { InfoTooltip } from './InfoTooltip'
import { Badge } from '@/components/ui/badge'

interface CategoryLevel1Props {
  categories: TaxonomyCategory[]
  activeCategory: string | null
  onCategoryChange: (code: string) => void
}

export function CategoryLevel1({
  categories,
  activeCategory,
  onCategoryChange
}: CategoryLevel1Props) {
  return (
    <div className="border-b bg-gradient-to-b from-muted/30 to-background">
      <div className="mx-auto max-w-[1800px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Product Categories
            <InfoTooltip
              content="Select a main category to browse products. Click to see subcategories and refine your search."
              side="right"
            />
          </h2>
          <span className="text-sm text-muted-foreground">
            {activeCategory
              ? `${categories.find(c => c.code === activeCategory)?.productCount?.toLocaleString() || 0} products`
              : 'Select a category'}
          </span>
        </div>

        <ScrollArea className="w-full whitespace-nowrap pb-2">
          <div className="flex gap-4 py-1 px-1">
            {categories.map((category) => {
              const isActive = category.code === activeCategory
              const IconComponent = (LucideIcons[category.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || LucideIcons.Box

              return (
                <button
                  key={category.code}
                  onClick={() => onCategoryChange(category.code)}
                  aria-label={`Select ${category.name} category`}
                  aria-pressed={isActive}
                  className={cn(
                    "flex-shrink-0 min-w-[220px] p-4 rounded-xl border bg-card text-card-foreground transition-all duration-200",
                    "hover:shadow-md hover:border-primary/40 hover:bg-accent/50",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive
                      ? "border-primary shadow-md ring-1 ring-primary/20 bg-primary/5"
                      : "shadow-sm"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm truncate">{category.name}</span>
                        {isActive && (
                          <Badge variant="default" className="h-5 px-1.5 text-[10px]">
                            Active
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-normal">
                        {category.description}
                      </p>
                      <p className="text-xs font-medium text-primary mt-2">
                        {category.productCount?.toLocaleString()} products
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}
