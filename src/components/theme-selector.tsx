'use client'

import { useMultiTheme } from '@/lib/theme-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
            <div className="h-4 w-4 rounded-full bg-[hsl(223.8136,0%,63.0163%)]" />
            <span>Default</span>
          </div>
        </SelectItem>
        <SelectItem value="supabase">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[hsl(151.3274,66.8639%,66.8627%)]" />
            <span>Supabase</span>
          </div>
        </SelectItem>
        <SelectItem value="graphite">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-[hsl(0,0%,37.6471%)]" />
            <span>Graphite</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
