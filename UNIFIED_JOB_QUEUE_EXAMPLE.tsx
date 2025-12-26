/**
 * EXAMPLE: Unified Job Queue Component (Post-Monorepo)
 *
 * Shows how to create a shared job queue that displays progress from
 * all three generators (tiles, playground, symbol-generator).
 *
 * All use the same progress-store from @fossapp/tiles package!
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@fossapp/ui/components/card'
import { Progress } from '@fossapp/ui/components/progress'
import { Badge } from '@fossapp/ui/components/badge'
import { Button } from '@fossapp/ui/components/button'
import { Download, ExternalLink, Loader2, CheckCircle2, XCircle } from 'lucide-react'

// Import shared progress store from tiles package
import type { JobProgress, ProgressMessage } from '@fossapp/tiles/progress'
import { useJobProgress } from '@fossapp/tiles/hooks/use-job-progress'

interface UnifiedJobQueueProps {
  filterType?: 'tiles' | 'playground' | 'symbols' | 'all'
}

export function UnifiedJobQueue({ filterType = 'all' }: UnifiedJobQueueProps) {
  const [jobs, setJobs] = useState<JobProgress[]>([])

  // Subscribe to all active jobs
  // (The progress-store is shared across all three generators!)
  useEffect(() => {
    // In real implementation, this would fetch from /api/jobs
    // and filter based on job metadata
  }, [filterType])

  return (
    <Card className="h-full overflow-hidden flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Job Queue</span>
          <Badge variant="secondary">
            {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-4">
        {jobs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>No active jobs</p>
            <p className="text-sm mt-2">Submit a generation request to see progress here</p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard key={job.jobId} job={job} />
          ))
        )}
      </CardContent>
    </Card>
  )
}

function JobCard({ job }: { job: JobProgress }) {
  const progress = calculateProgress(job)
  const latestMessage = job.messages[job.messages.length - 1]

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Job Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium truncate">{job.tileName}</h4>
            <p className="text-sm text-muted-foreground">
              {getJobTypeLabel(latestMessage?.phase)}
            </p>
          </div>
          <JobStatusBadge status={job.status} />
        </div>

        {/* Progress Bar */}
        {job.status === 'running' && (
          <div className="space-y-1">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {latestMessage?.message || 'Processing...'}
            </p>
          </div>
        )}

        {/* Latest Message */}
        {latestMessage && (
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <PhaseIcon phase={latestMessage.phase} />
              <span className="text-muted-foreground">{latestMessage.message}</span>
            </div>
            {latestMessage.detail && (
              <p className="text-xs text-muted-foreground ml-6">{latestMessage.detail}</p>
            )}
          </div>
        )}

        {/* Actions */}
        {job.result && (
          <div className="flex gap-2 pt-2">
            {/* Download DWG (Tiles & Playground) */}
            {job.result.hasDwgBuffer && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/download/${job.jobId}/dwg`} download>
                  <Download className="h-4 w-4 mr-1" />
                  DWG
                </a>
              </Button>
            )}

            {/* Download PNG (Symbol Generator) */}
            {job.result.hasPngBuffer && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/api/download/${job.jobId}/png`} download>
                  <Download className="h-4 w-4 mr-1" />
                  PNG
                </a>
              </Button>
            )}

            {/* Google Drive Link (Tiles) */}
            {job.result.driveLink && (
              <Button size="sm" variant="outline" asChild>
                <a href={job.result.driveLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Drive
                </a>
              </Button>
            )}

            {/* APS Viewer (All) */}
            {job.result.viewerUrn && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/viewer?urn=${job.result.viewerUrn}`} target="_blank">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View 3D
                </a>
              </Button>
            )}
          </div>
        )}

        {/* Cost Display (Playground only) */}
        {job.result?.costEur && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <div className="flex justify-between">
              <span>Cost:</span>
              <span className="font-medium">€{job.result.costEur.toFixed(4)}</span>
            </div>
            {job.result.llmModel && (
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="font-mono">{job.result.llmModel}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function JobStatusBadge({ status }: { status: JobProgress['status'] }) {
  if (status === 'running') {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running
      </Badge>
    )
  }

  if (status === 'complete') {
    return (
      <Badge variant="default" className="flex items-center gap-1 bg-green-500">
        <CheckCircle2 className="h-3 w-3" />
        Complete
      </Badge>
    )
  }

  return (
    <Badge variant="destructive" className="flex items-center gap-1">
      <XCircle className="h-3 w-3" />
      Error
    </Badge>
  )
}

function PhaseIcon({ phase }: { phase: ProgressMessage['phase'] }) {
  const icons = {
    images: '🖼️',
    script: '📝',
    aps: '☁️',
    drive: '💾',
    llm: '🤖',
    complete: '✅',
    error: '❌',
  }

  return <span>{icons[phase] || '⚙️'}</span>
}

function getJobTypeLabel(phase?: ProgressMessage['phase']): string {
  if (!phase) return 'Processing...'

  // Detect job type from phase
  if (phase === 'llm') return 'AI Playground'
  if (phase === 'images') return 'Tile Builder'
  if (phase === 'script') return 'Symbol Generator'

  return 'DWG Generator'
}

function calculateProgress(job: JobProgress): number {
  if (job.status === 'complete') return 100
  if (job.status === 'error') return 100

  const latestMessage = job.messages[job.messages.length - 1]
  if (!latestMessage) return 0

  // Estimate progress based on phase
  const phaseProgress: Record<ProgressMessage['phase'], number> = {
    images: 20,
    script: 40,
    llm: 50,
    aps: 70,
    drive: 90,
    complete: 100,
    error: 100,
  }

  return phaseProgress[latestMessage.phase] || 10
}
