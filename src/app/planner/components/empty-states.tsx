'use client'

/**
 * Planner Empty States
 * Placeholder views for various loading/empty states in the planner
 */

import Link from 'next/link'
import { FolderOpen, AlertCircle, MapPin, Loader2 } from 'lucide-react'
import { Button } from '@fossapp/ui'

/**
 * Shown when no project is selected
 */
export function NoProjectView() {
  return (
    <div className="h-full p-6">
      <div className="h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30">
        <FolderOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-lg font-medium text-muted-foreground mb-2">
          Please select a project first
        </p>
        <p className="text-sm text-muted-foreground/70 mb-4 text-center max-w-md">
          Floor plans are saved to your project for persistent storage.
          <br />
          The same file won&apos;t need re-translation next time.
        </p>
        <Link href="/projects">
          <Button variant="default">
            <FolderOpen className="h-4 w-4 mr-2" />
            Go to Projects
          </Button>
        </Link>
      </div>
    </div>
  )
}

/**
 * Shown when project has no areas
 */
export function NoAreasView({ projectId }: { projectId: string }) {
  return (
    <div className="h-full p-6">
      <div className="h-full flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-500/30 bg-amber-500/5">
        <AlertCircle className="h-16 w-16 mx-auto mb-4 text-amber-500/50" />
        <p className="text-lg font-medium text-foreground mb-2">
          Create an area first
        </p>
        <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
          Floor plans are organized by area and revision.
          <br />
          Create at least one area in your project to upload floor plans.
        </p>
        <Link href={`/projects/${projectId}`}>
          <Button variant="default">
            <MapPin className="h-4 w-4 mr-2" />
            Go to Project Details
          </Button>
        </Link>
      </div>
    </div>
  )
}

/**
 * Generic loading view with customizable message
 */
export function LoadingView({ message }: { message: string }) {
  return (
    <div className="h-full p-6">
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">{message}</span>
      </div>
    </div>
  )
}
