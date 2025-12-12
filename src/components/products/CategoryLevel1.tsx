'use client'

import { TaxonomyCategory } from '@/lib/taxonomy-data'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import * as LucideIcons from 'lucide-react'
import { InfoTooltip } from './InfoTooltip'

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
    <div className="border-b bg-muted/50">
      <div className="mx-auto max-w-[1800px] 3xl:max-w-[2200px] 4xl:max-w-[2560px] px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center">
            Product Categories
            <InfoTooltip
              content="Select a main category to browse products. Click to see subcategories and refine your search."
              side="right"
            />
          </h2>
          <span className="text-sm text-muted-foreground">
            {activeCategory
              ? `${categories.find(c => c.code === activeCategory)?.productCount || 0} products`
              : 'Select a category'}
          </span>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <ToggleGroup
            type="single"
            value={activeCategory || ''}
            onValueChange={(value) => {
              if (value) {
                onCategoryChange(value)
              }
            }}
            className="flex gap-3 py-2 px-3 justify-start"
          >
            {categories.map((category) => {
              const isActive = category.code === activeCategory
              const IconComponent = (LucideIcons[category.icon as keyof typeof LucideIcons] as React.ComponentType<{ className?: string }>) || LucideIcons.Box

              return (
                <ToggleGroupItem
                  key={category.code}
                  value={category.code}
                  aria-label={`Select ${category.name} category`}
                  className={cn(
                    "flex-shrink-0 p-4 rounded-lg border-2 transition-all min-w-[200px] h-auto",
                    "data-[state=on]:border-primary data-[state=on]:shadow-lg data-[state=on]:scale-105",
                    "hover:border-primary/50",
                    isActive && "data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent className={cn("h-6 w-6", isActive ? "text-primary-foreground" : "text-primary")} />
                    <div className="text-left">
                      <div className="font-semibold text-base">{category.name}</div>
                      <div className={cn("text-xs", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                        {category.description}
                      </div>
                      <div className={cn("text-xs mt-1", isActive ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {category.productCount} products
                      </div>
                    </div>
                  </div>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  )
}
