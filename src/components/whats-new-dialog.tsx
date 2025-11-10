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

// Import version from package.json
import packageJson from '../../package.json'

const CURRENT_VERSION = packageJson.version
const VERSION_STORAGE_KEY = 'fossapp_last_seen_version'

// Latest version content - update this when releasing new versions
const LATEST_CHANGES = {
  version: '1.3.7',
  date: 'November 10, 2025',
  changes: [
    {
      category: 'New Features',
      emoji: '✨',
      items: [
        'Animated Logo Effects: The FOSSAPP logo now features lighting-themed animations including glow, shimmer, neon, and floating effects',
        'Enhanced visual branding for the lighting products database',
      ],
    },
  ],
}

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Check if user has seen this version
    const lastSeenVersion = localStorage.getItem(VERSION_STORAGE_KEY)

    if (lastSeenVersion !== CURRENT_VERSION) {
      // Show dialog after a short delay for better UX
      const timer = setTimeout(() => {
        setOpen(true)
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Mark current version as seen
      localStorage.setItem(VERSION_STORAGE_KEY, CURRENT_VERSION)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span>What&apos;s New in FOSSAPP</span>
            <Badge variant="outline" className="text-sm">
              v{LATEST_CHANGES.version}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Released on {LATEST_CHANGES.date}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {LATEST_CHANGES.changes.map((section, idx) => (
            <div key={idx} className="space-y-3">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <span>{section.emoji}</span>
                <span>{section.category}</span>
              </h3>
              <ul className="space-y-2 ml-6">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="text-sm text-muted-foreground list-disc">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t text-center">
          <p className="text-sm text-muted-foreground">
            View full changelog at{' '}
            <a
              href="https://github.com/ziouzitsou/fossapp/blob/main/WHATS_NEW.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              WHATS_NEW.md
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
