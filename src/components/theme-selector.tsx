'use client'

import { useMultiTheme } from '@/lib/theme-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fossapp/ui'
import { Paintbrush } from 'lucide-react'

export function ThemeSelector() {
  const { theme, setTheme } = useMultiTheme()

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className="w-[180px]">
        <div className="flex items-center gap-2">
          <Paintbrush className="h-4 w-4" />
          <SelectValue placeholder="Select theme" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[oklch(0.556_0_0)]" />
            <span>Default</span>
          </div>
        </SelectItem>
        <SelectItem value="minimal">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[oklch(0.623_0.188_260)]" />
            <span>Minimal</span>
          </div>
        </SelectItem>
        <SelectItem value="emerald">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[oklch(0.835_0.130_161)]" />
            <span>Emerald</span>
          </div>
        </SelectItem>
        <SelectItem value="ocean">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[oklch(0.672_0.161_245)]" />
            <span>Ocean</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
