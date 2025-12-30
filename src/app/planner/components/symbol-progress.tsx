'use client'

/**
 * Symbol Progress Component
 * Minimalistic step indicator for symbol generation progress
 * Replaces TerminalLog in the planner modal for a cleaner UX
 */

import { useEffect, useState } from 'react'
import { cn } from '@fossapp/ui'
import { Check, Loader2, Circle, AlertCircle } from 'lucide-react'
import type { LogMessage } from '@/components/tiles/terminal-log'

interface SymbolProgressProps {
  jobId: string | null
  onComplete?: (result: {
    success: boolean
    savedToSupabase?: boolean
    pngPath?: string
  }) => void
}

// Define the generation steps (matches actual phases from /api/symbol-generator/generate)
type Phase = 'llm' | 'aps' | 'storage'

const STEPS: { id: string; label: string; phases: Phase[] }[] = [
  { id: 'script', label: 'Generating AutoLISP', phases: ['llm'] },
  { id: 'autocad', label: 'Running AutoCAD', phases: ['aps'] },
  { id: 'save', label: 'Saving symbol', phases: ['storage'] },
]

type StepStatus = 'pending' | 'active' | 'complete' | 'error'

export function SymbolProgress({ jobId, onComplete }: SymbolProgressProps) {
  // First step starts active since job is already running when component mounts
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({
    script: 'active',
    autocad: 'pending',
    save: 'pending',
  })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    if (!jobId) {
      // Reset state (first step active for next run)
      setStepStatuses({
        script: 'active',
        autocad: 'pending',
        save: 'pending',
      })
      setErrorMessage(null)
      setIsComplete(false)
      setIsHidden(false)
      return
    }

    if (isComplete) return

    const eventSource = new EventSource(`/api/tiles/stream/${jobId}`)
    let currentPhase: string | null = null

    eventSource.onmessage = (event) => {
      try {
        const msg: LogMessage = JSON.parse(event.data)

        // Find which step this phase belongs to
        const step = STEPS.find(s => s.phases.includes(msg.phase as Phase))

        if (step && msg.phase !== currentPhase) {
          currentPhase = msg.phase

          // Mark previous steps as complete, current as active
          setStepStatuses(prev => {
            const newStatuses = { ...prev }
            let foundCurrent = false

            for (const s of STEPS) {
              if (s.id === step.id) {
                newStatuses[s.id] = 'active'
                foundCurrent = true
              } else if (!foundCurrent) {
                newStatuses[s.id] = 'complete'
              }
            }
            return newStatuses
          })
        }

        // Handle completion
        if (msg.phase === 'complete') {
          setIsComplete(true)
          setStepStatuses({
            script: 'complete',
            autocad: 'complete',
            save: 'complete',
          })
          eventSource.close()

          // Hide after brief delay to show success state
          setTimeout(() => setIsHidden(true), 1000)

          if (onComplete && msg.result) {
            onComplete({
              success: true,
              savedToSupabase: msg.result.savedToSupabase,
              pngPath: msg.result.pngPath,
            })
          }
        }

        // Handle error
        if (msg.phase === 'error') {
          setIsComplete(true)
          setErrorMessage(msg.message || 'Generation failed')

          // Mark current active step as error
          setStepStatuses(prev => {
            const newStatuses = { ...prev }
            for (const s of STEPS) {
              if (prev[s.id] === 'active') {
                newStatuses[s.id] = 'error'
                break
              }
            }
            return newStatuses
          })

          eventSource.close()
          onComplete?.({ success: false })
        }
      } catch {
        // Ignore parse errors
      }
    }

    eventSource.addEventListener('done', () => {
      setIsComplete(true)
      eventSource.close()
    })

    eventSource.onerror = () => {
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [jobId, isComplete, onComplete])

  // Hide when no job, or after successful completion
  if (!jobId || isHidden) return null

  return (
    <div className="py-3 px-4 rounded-lg border bg-muted/30">
      <div className="space-y-2">
        {STEPS.map((step) => {
          const status = stepStatuses[step.id]
          return (
            <div key={step.id} className="flex items-center gap-3">
              {/* Status icon */}
              <div className="shrink-0">
                {status === 'complete' && (
                  <Check className="w-4 h-4 text-emerald-500" />
                )}
                {status === 'active' && (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                )}
                {status === 'pending' && (
                  <Circle className="w-4 h-4 text-muted-foreground/40" />
                )}
                {status === 'error' && (
                  <AlertCircle className="w-4 h-4 text-destructive" />
                )}
              </div>

              {/* Label */}
              <span className={cn(
                'text-sm',
                status === 'complete' && 'text-muted-foreground',
                status === 'active' && 'text-foreground font-medium',
                status === 'pending' && 'text-muted-foreground/60',
                status === 'error' && 'text-destructive',
              )}>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Error message */}
      {errorMessage && (
        <p className="mt-3 text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  )
}
