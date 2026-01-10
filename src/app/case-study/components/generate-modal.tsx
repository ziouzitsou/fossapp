/**
 * Generate Modal - Case Study DWG Generation Dialog
 *
 * Two-state modal for generating XREF-based DWG output:
 * 1. **Preview state**: Shows floor plan info, placement summary, warnings
 * 2. **Progress state**: Shows real-time generation progress via SSE
 *
 * @remarks
 * Follows the same SSE pattern as symbol generation, using the
 * shared progress-store for real-time updates.
 */
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Alert, AlertDescription, AlertTitle } from '@fossapp/ui'
import { cn } from '@fossapp/ui'
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  MapPin,
  FolderOpen,
  Check,
  XCircle,
  Settings,
  Download,
  Upload,
  FileCode,
} from 'lucide-react'
import type { LuminaireProduct, Placement } from '../types'
import type { LogMessage } from '@/components/tiles/terminal-log'

// ============================================================================
// TYPES
// ============================================================================

/** Generation phase for progress display */
type GeneratePhase = 'idle' | 'init' | 'script' | 'aps' | 'download' | 'drive' | 'complete' | 'error'

/** Phase configuration for display */
const PHASE_CONFIG: Record<GeneratePhase, { label: string; icon: React.ElementType; color: string }> = {
  idle: { label: 'Ready', icon: Sparkles, color: 'text-muted-foreground' },
  init: { label: 'Preparing...', icon: Loader2, color: 'text-blue-500' },
  script: { label: 'Generating script...', icon: FileCode, color: 'text-yellow-500' },
  aps: { label: 'Running AutoCAD...', icon: Settings, color: 'text-purple-500' },
  download: { label: 'Downloading DWG...', icon: Download, color: 'text-cyan-500' },
  drive: { label: 'Uploading to Drive...', icon: Upload, color: 'text-green-500' },
  complete: { label: 'Complete', icon: Check, color: 'text-emerald-500' },
  error: { label: 'Failed', icon: XCircle, color: 'text-red-500' },
}

// ============================================================================
// PROPS
// ============================================================================

interface GenerateModalProps {
  /** Modal visibility */
  open: boolean
  /** Callback to change modal visibility */
  onOpenChange: (open: boolean) => void
  /** Project code (e.g., "2501-001") */
  projectCode: string
  /** Project display name */
  projectName: string
  /** Area code for display */
  areaCode: string
  /** Revision number */
  revisionNumber: number
  /** Floor plan filename */
  floorPlanFilename: string | null
  /** Area revision ID for generation */
  areaRevisionId: string | null
  /** All placements in the area */
  placements: Placement[]
  /** All luminaires (for symbol lookup) */
  luminaires: LuminaireProduct[]
  /** Products missing symbol DWGs */
  missingSymbols?: string[]
  /** Called on successful generation */
  onSuccess?: (result: { driveLink?: string; outputFilename?: string }) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Generate Modal for Case Study DWG output
 */
/** Hardcoded HUB path for display (matches GOOGLE_DRIVE_HUB_PATH env var) */
const HUB_PATH = 'F:/Shared drives/HUB/Projects'

export function GenerateModal({
  open,
  onOpenChange,
  projectCode,
  projectName,
  areaCode,
  revisionNumber,
  floorPlanFilename,
  areaRevisionId,
  placements,
  luminaires,
  missingSymbols = [],
  onSuccess,
}: GenerateModalProps) {
  // Generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [phase, setPhase] = useState<GeneratePhase>('idle')
  const [progressMessage, setProgressMessage] = useState<string>('')
  const [progressDetail, setProgressDetail] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ driveLink?: string; outputFilename?: string } | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setIsGenerating(false)
      setJobId(null)
      setPhase('idle')
      setProgressMessage('')
      setProgressDetail(undefined)
      setError(null)
      setResult(null)
    }
  }, [open])

  // ─────────────────────────────────────────────────────────────────────────
  // COMPUTED VALUES
  // ─────────────────────────────────────────────────────────────────────────

  /** Group placements by symbol */
  const placementsBySymbol = useMemo(() => {
    const groups = new Map<string, number>()
    for (const p of placements) {
      groups.set(p.symbol, (groups.get(p.symbol) || 0) + 1)
    }
    return groups
  }, [placements])

  /** Sorted symbols for display */
  const sortedSymbols = useMemo(() => {
    return Array.from(placementsBySymbol.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [placementsBySymbol])

  /** Output path preview */
  const outputFilename = `${projectCode}_${areaCode}_RV${revisionNumber}.dwg`
  const outputPath = useMemo(() => {
    return `${HUB_PATH}/${projectCode}/02_Areas/${areaCode}/RV${revisionNumber}/Output/${outputFilename}`
  }, [projectCode, areaCode, revisionNumber, outputFilename])

  /** Can generate check */
  const canGenerate = Boolean(
    floorPlanFilename &&
    placements.length > 0 &&
    areaRevisionId &&
    !isGenerating
  )

  // ─────────────────────────────────────────────────────────────────────────
  // SSE SUBSCRIPTION
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!jobId) return

    const eventSource = new EventSource(`/api/tiles/stream/${jobId}`)
    let completed = false

    eventSource.onmessage = (event) => {
      if (completed) return

      try {
        const msg: LogMessage = JSON.parse(event.data)

        // Update phase based on message
        const phaseMap: Record<string, GeneratePhase> = {
          init: 'init',
          script: 'script',
          aps: 'aps',
          download: 'download',
          drive: 'drive',
          complete: 'complete',
          error: 'error',
        }

        const mappedPhase = phaseMap[msg.phase] || phase
        setPhase(mappedPhase)
        setProgressMessage(msg.message)
        setProgressDetail(msg.detail)

        if (msg.phase === 'complete') {
          completed = true
          setIsGenerating(false)
          // Cast to any to access extended result fields
          const extResult = msg.result as { driveLink?: string; outputFilename?: string } | undefined
          setResult({
            driveLink: extResult?.driveLink,
            outputFilename: extResult?.outputFilename,
          })
          onSuccess?.({
            driveLink: extResult?.driveLink,
            outputFilename: extResult?.outputFilename,
          })
          eventSource.close()
        } else if (msg.phase === 'error') {
          completed = true
          setIsGenerating(false)
          setError(msg.detail || msg.message || 'Generation failed')
          eventSource.close()
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.addEventListener('done', () => {
      eventSource.close()
    })

    eventSource.onerror = () => {
      if (!completed) {
        setPhase('error')
        setError('Connection lost')
        setIsGenerating(false)
      }
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [jobId, phase, onSuccess])

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!areaRevisionId || isGenerating) return

    setIsGenerating(true)
    setPhase('init')
    setProgressMessage('Starting generation...')
    setError(null)

    try {
      const response = await fetch('/api/case-study/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaRevisionId }),
      })

      const data = await response.json()

      if (data.success && data.jobId) {
        setJobId(data.jobId)
      } else {
        throw new Error(data.error || 'Failed to start generation')
      }
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
      setIsGenerating(false)
    }
  }, [areaRevisionId, isGenerating])

  const handleClose = useCallback(() => {
    if (!isGenerating) {
      onOpenChange(false)
    }
  }, [isGenerating, onOpenChange])

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  const PhaseIcon = PHASE_CONFIG[phase].icon
  const phaseColor = PHASE_CONFIG[phase].color

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Generate DWG
          </DialogTitle>
          <DialogDescription>
            <span className="font-medium">{projectCode}</span> {projectName} &bull; {areaCode} v{revisionNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Preview state - before generation */}
          {phase === 'idle' && (
            <>
              {/* Placement summary */}
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">
                    Placements ({placements.length})
                  </p>
                  {sortedSymbols.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {sortedSymbols.map(([symbol, count]) => (
                        <Badge key={symbol} variant="outline" className="text-xs">
                          {symbol}: {count}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No placements yet
                    </p>
                  )}
                </div>
              </div>

              {/* Missing symbols warning */}
              {missingSymbols.length > 0 && (
                <Alert variant="default" className="border-yellow-500/50 bg-yellow-500/10">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <AlertTitle className="text-yellow-600">Missing Symbol DWGs</AlertTitle>
                  <AlertDescription className="text-sm text-muted-foreground">
                    {missingSymbols.length} product{missingSymbols.length !== 1 ? 's' : ''} will use a placeholder symbol.
                    Generate symbols in Settings &rarr; Symbols for better results.
                  </AlertDescription>
                </Alert>
              )}

              {/* Output path */}
              <div className="flex items-start gap-3">
                <FolderOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Output</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {outputPath}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Progress state - during generation */}
          {phase !== 'idle' && (
            <div className="space-y-4">
              {/* Current phase indicator */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <PhaseIcon className={cn('h-5 w-5', phaseColor, phase !== 'complete' && phase !== 'error' && 'animate-spin')} />
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', phaseColor)}>
                    {PHASE_CONFIG[phase].label}
                  </p>
                  {progressMessage && (
                    <p className="text-xs text-muted-foreground truncate">
                      {progressMessage}
                    </p>
                  )}
                  {progressDetail && (
                    <p className="text-xs text-muted-foreground/70 truncate">
                      {progressDetail}
                    </p>
                  )}
                </div>
              </div>

              {/* Error display */}
              {phase === 'error' && error && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Generation Failed</AlertTitle>
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              {/* Success display */}
              {phase === 'complete' && result && (
                <Alert className="border-emerald-500/50 bg-emerald-500/10">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <AlertTitle className="text-emerald-600">Generation Complete</AlertTitle>
                  <AlertDescription className="text-sm text-muted-foreground">
                    {result.outputFilename && (
                      <span className="font-mono">{result.outputFilename}</span>
                    )}
                    {result.driveLink && (
                      <a
                        href={result.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block mt-1 text-primary hover:underline"
                      >
                        Open in Google Drive
                      </a>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {phase === 'idle' ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Generate
              </Button>
            </>
          ) : phase === 'complete' || phase === 'error' ? (
            <Button onClick={handleClose}>
              Close
            </Button>
          ) : (
            <Button disabled className="gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
