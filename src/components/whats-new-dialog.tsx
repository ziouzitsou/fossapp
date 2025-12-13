'use client'

import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Zap, Check } from 'lucide-react'
import { useUserSettings } from '@/lib/user-settings-context'

// Latest version content - update this when releasing new versions
const LATEST_CHANGES = {
  version: '1.8.3',
  date: 'December 6, 2025',
  title: 'Tile Builder UX & DWG Viewer',
  description: 'Major improvements to the tile creation experience with mobile-friendly layout and built-in DWG viewer.',
  features: [
    'Built-in DWG Viewer - view generated tiles directly in browser with Autodesk Viewer',
    'Dark/Light mode toggle - switch viewer background to match your preference',
    'Mobile-friendly layout - bucket now scrolls horizontally, tiles stack vertically',
    'Improved drag-and-drop - easier to add products to existing tiles',
    'Touch support - hold-to-drag works on mobile devices',
    'Parallel processing - faster image conversion and Google Drive uploads',
  ],
  tagline: 'Create and view AutoCAD tiles without leaving your browser.',
}

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false)
  const { lastSeenVersion, setLastSeenVersion, isLoading } = useUserSettings()

  useEffect(() => {
    // Wait for settings to load before checking version
    if (isLoading) return

    // Check if user has seen this version
    if (lastSeenVersion !== LATEST_CHANGES.version) {
      // Show dialog after a short delay for better UX
      const timer = setTimeout(() => {
        setOpen(true)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [lastSeenVersion, isLoading])

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Mark current version as seen (syncs to DB for authenticated users)
      setLastSeenVersion(LATEST_CHANGES.version)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="h-6 w-6 text-primary" />
            <span>What&apos;s New in FOSSAPP</span>
            <Badge variant="outline" className="text-sm">
              v{LATEST_CHANGES.version}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Released {LATEST_CHANGES.date}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <div className="space-y-3">
            <h3 className="font-semibold text-xl flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {LATEST_CHANGES.title}
            </h3>
            <p className="text-muted-foreground">
              {LATEST_CHANGES.description}
            </p>
            <ul className="space-y-2 mt-4">
              {LATEST_CHANGES.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground italic mt-4 pl-4 border-l-2 border-muted">
              {LATEST_CHANGES.tagline}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-xs text-muted-foreground">
            This dialog appears once per version update
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
