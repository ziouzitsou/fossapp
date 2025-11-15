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

const VERSION_STORAGE_KEY = 'fossapp_last_seen_version'

// Latest version content - update this when releasing new versions
const LATEST_CHANGES = {
  version: '1.4.5',
  date: 'November 15, 2025',
  title: 'Manage Your Projects All in One Place',
  description: 'You asked for it, we built it! Now you can track all your lighting projects right here in FOSSAPP.',
  features: [
    'See all your projects in a clean table - just click any project to dive in',
    'Everything you need in one view: budget, timeline, customer info, team members',
    "Track products you've used in each project with pricing",
    "Keep contacts organized - no more hunting for that electrician's phone number!",
    'Upload documents - store drawings, specs, and quotes alongside your projects',
  ],
  tagline: 'Perfect for architects and designers juggling multiple lighting installations.',
}

export function WhatsNewDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Check if user has seen this version
    const lastSeenVersion = localStorage.getItem(VERSION_STORAGE_KEY)

    if (lastSeenVersion !== LATEST_CHANGES.version) {
      // Show dialog after a short delay for better UX
      const timer = setTimeout(() => {
        setOpen(true)
      }, 1500)

      return () => clearTimeout(timer)
    }
  }, [])

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      // Mark current version as seen
      localStorage.setItem(VERSION_STORAGE_KEY, LATEST_CHANGES.version)
      setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span>🎉 What&apos;s New in FOSSAPP</span>
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
              📊 {LATEST_CHANGES.title}
            </h3>
            <p className="text-muted-foreground">
              {LATEST_CHANGES.description}
            </p>
            <ul className="space-y-2 mt-4">
              {LATEST_CHANGES.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground italic mt-4 pl-4 border-l-2 border-muted">
              {LATEST_CHANGES.tagline}
            </p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t text-center space-y-2">
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
          <p className="text-xs text-muted-foreground">
            💡 This dialog appears once per version update
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
