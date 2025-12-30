'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@fossapp/ui'
import { CheckCircle2, Circle, Loader2, XCircle, Terminal as TerminalIcon, X, Camera, FileText, Settings, Cloud, Database, Bot } from 'lucide-react'

export interface LogMessage {
  timestamp: number
  elapsed: string
  phase: 'images' | 'script' | 'aps' | 'drive' | 'storage' | 'complete' | 'error' | 'llm'
  step?: string
  message: string
  detail?: string
  result?: {
    success: boolean
    dwgUrl?: string
    dwgFileId?: string
    driveLink?: string
    viewerUrn?: string
    errors?: string[]
    hasDwgBuffer?: boolean
    hasPngBuffer?: boolean
    costEur?: number
    llmModel?: string
    tokensIn?: number
    tokensOut?: number
    savedToSupabase?: boolean
    dwgPath?: string
    pngPath?: string
    svgPath?: string
  }
}

interface TerminalLogProps {
  jobId: string | null
  onComplete?: (result: { success: boolean; dwgUrl?: string; dwgFileId?: string; driveLink?: string; viewerUrn?: string; hasDwgBuffer?: boolean; hasPngBuffer?: boolean; costEur?: number; llmModel?: string; tokensIn?: number; tokensOut?: number; savedToSupabase?: boolean; dwgPath?: string; pngPath?: string; svgPath?: string }) => void
  onClose?: () => void
  className?: string
}

const PhaseIcon = ({ phase }: { phase: keyof typeof PHASE_COLORS }) => {
  const iconClass = "w-3.5 h-3.5"
  switch (phase) {
    case 'images': return <Camera className={iconClass} />
    case 'script': return <FileText className={iconClass} />
    case 'aps': return <Settings className={iconClass} />
    case 'drive': return <Cloud className={iconClass} />
    case 'storage': return <Database className={iconClass} />
    case 'complete': return <CheckCircle2 className={iconClass} />
    case 'error': return <XCircle className={iconClass} />
    case 'llm': return <Bot className={iconClass} />
    default: return <Circle className={iconClass} />
  }
}

const PHASE_COLORS = {
  images: 'text-blue-400',
  script: 'text-yellow-400',
  aps: 'text-purple-400',
  drive: 'text-green-400',
  storage: 'text-cyan-400',
  complete: 'text-emerald-400',
  error: 'text-red-400',
  llm: 'text-violet-400',
}

export function TerminalLog({ jobId, onComplete, onClose, className }: TerminalLogProps) {
  const [messages, setMessages] = useState<LogMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // SSE connection (state reset on prop change is intentional)
  useEffect(() => {
    if (!jobId) {
      setMessages([])
      setIsConnected(false)
      setIsComplete(false)
      return
    }

    // Don't reconnect if already complete
    if (isComplete) {
      return
    }

    const eventSource = new EventSource(`/api/tiles/stream/${jobId}`)
    const localMessages: LogMessage[] = []

    eventSource.onopen = () => {
      setIsConnected(true)
    }

    eventSource.onmessage = (event) => {
      try {
        const msg: LogMessage = JSON.parse(event.data)
        localMessages.push(msg)
        setMessages((prev) => [...prev, msg])

        // Check for completion
        if (msg.phase === 'complete' || msg.phase === 'error') {
          setIsComplete(true)
          setIsConnected(false)
          eventSource.close()

          // Extract result from completion message
          if (onComplete) {
            const success = msg.phase === 'complete'
            // The result is now included in the completion message
            if (msg.result) {
              onComplete({
                success,
                dwgUrl: msg.result.dwgUrl,
                dwgFileId: msg.result.dwgFileId,
                driveLink: msg.result.driveLink,
                viewerUrn: msg.result.viewerUrn,
                hasDwgBuffer: msg.result.hasDwgBuffer,
                hasPngBuffer: msg.result.hasPngBuffer,
                costEur: msg.result.costEur,
                llmModel: msg.result.llmModel,
                tokensIn: msg.result.tokensIn,
                tokensOut: msg.result.tokensOut,
                savedToSupabase: msg.result.savedToSupabase,
                dwgPath: msg.result.dwgPath,
                pngPath: msg.result.pngPath,
                svgPath: msg.result.svgPath,
              })
            } else {
              // Fallback: parse drive link from all messages
              const driveMsg = localMessages.find(m => m.phase === 'drive' && m.detail?.includes('drive.google.com'))
              onComplete({
                success,
                driveLink: driveMsg?.detail,
              })
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Listen for "done" event from server
    eventSource.addEventListener('done', () => {
      setIsComplete(true)
      setIsConnected(false)
      eventSource.close()
    })

    eventSource.onerror = () => {
      // Only set disconnected, don't trigger reconnect if complete
      setIsConnected(false)
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [jobId, isComplete, onComplete])

  if (!jobId && messages.length === 0) {
    return null
  }

  return (
    <div className={cn('group/terminal rounded-lg overflow-hidden border border-zinc-700', className)}>
      {/* Terminal header - VS Code / Linux style */}
      <div className="bg-zinc-800 px-3 py-2 flex items-center gap-2 border-b border-zinc-700">
        <TerminalIcon className="w-4 h-4 text-zinc-400" />
        <span className="text-zinc-300 text-sm font-medium">Terminal</span>
        <span className="text-zinc-500 text-xs">— Tile Generation</span>

        <div className="flex-1" />

        {/* Status badge */}
        <div className="flex items-center gap-1.5">
          {isConnected && !isComplete && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Running</span>
            </div>
          )}
          {isComplete && (
            <>
              {messages[messages.length - 1]?.phase === 'complete' ? (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Success</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-xs">
                  <XCircle className="w-3 h-3" />
                  <span>Failed</span>
                </div>
              )}
            </>
          )}
          {!isConnected && !isComplete && jobId && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-500/20 text-zinc-400 text-xs">
              <Circle className="w-3 h-3" />
              <span>Connecting</span>
            </div>
          )}
        </div>

        {/* Close button - always visible when complete */}
        {isComplete && onClose && (
          <button
            onClick={onClose}
            className="ml-2 p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Close terminal"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        className="bg-zinc-900 p-3 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto"
      >
        {messages.map((msg, idx) => (
          <div key={idx} className="flex gap-2">
            {/* Timestamp */}
            <span className="text-zinc-500 shrink-0">[{msg.elapsed}]</span>

            {/* Phase icon */}
            <span className={cn("shrink-0", PHASE_COLORS[msg.phase])}><PhaseIcon phase={msg.phase} /></span>

            {/* Step indicator */}
            {msg.step && (
              <span className="text-zinc-400 shrink-0">{msg.step}</span>
            )}

            {/* Message */}
            <span className={cn('font-medium', PHASE_COLORS[msg.phase])}>
              {msg.message}
            </span>

            {/* Detail */}
            {msg.detail && (
              <span className="text-zinc-400 truncate">
                - {msg.detail}
              </span>
            )}
          </div>
        ))}

        {/* Blinking cursor when processing */}
        {isConnected && !isComplete && (
          <div className="flex gap-2">
            <span className="text-zinc-500">&gt;</span>
            <span className="animate-pulse text-zinc-300">▌</span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Hook for using tile generation with SSE streaming
 */
export function useTileGeneration() {
  const [jobId, setJobId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    dwgUrl?: string
    dwgFileId?: string
    driveLink?: string
    viewerUrn?: string
  } | null>(null)

  const startGeneration = async (payload: unknown) => {
    setIsGenerating(true)
    setResult(null)

    try {
      const response = await fetch('/api/tiles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (data.success && data.jobId) {
        setJobId(data.jobId)
      } else {
        setIsGenerating(false)
        setResult({ success: false })
      }
    } catch {
      setIsGenerating(false)
      setResult({ success: false })
    }
  }

  const handleComplete = (res: { success: boolean; dwgUrl?: string; dwgFileId?: string; driveLink?: string; viewerUrn?: string }) => {
    setIsGenerating(false)
    setResult(res)
  }

  const reset = () => {
    setJobId(null)
    setIsGenerating(false)
    setResult(null)
  }

  return {
    jobId,
    isGenerating,
    result,
    startGeneration,
    handleComplete,
    reset,
  }
}
