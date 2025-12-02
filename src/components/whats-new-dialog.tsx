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

const VERSION_STORAGE_KEY = 'fossapp_last_seen_version'

// Latest version content - update this when releasing new versions
const LATEST_CHANGES = {
  version: '1.7.0',
  date: 'December 2, 2025',
  title: 'Google Drive Integration',
  description: 'Projects now integrate with Google Drive. Create a project and get an organized folder structure in HUB Shared Drive automatically.',
  features: [
    'Auto-generated project codes (YYMM-NNN format)',
    'Automatic Google Drive folder creation with standard structure',
    'Project version management - create snapshots of your project files',
    'Customer selector - link projects to your customers',
    'Files & Versions tab to manage project documents',
  ],
  tagline: 'Your project files, organized automatically.',
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
