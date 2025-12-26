'use client'

import { useState } from 'react'
import { Button } from '@fossapp/ui'
import { Textarea } from '@fossapp/ui'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@fossapp/ui'
import { TerminalLog } from '@/components/tiles/terminal-log'
import { DraftingCompass, Loader2, Download, Sparkles, Eye } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { PlaygroundViewerModal } from './playground-viewer-modal'

interface PlaygroundResult {
  success: boolean
  dwgUrl?: string
  hasDwgBuffer?: boolean
  viewerUrn?: string
  errors?: string[]
  costEur?: number
  llmModel?: string
  tokensIn?: number
  tokensOut?: number
}

export function PlaygroundForm() {
  const [description, setDescription] = useState('')
  const [jobId, setJobId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<PlaygroundResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please describe what you want to draw')
      return
    }

    setIsGenerating(true)
    setResult(null)
    setError(null)
    setJobId(null)

    try {
      const response = await fetch('/api/playground/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          outputFilename: 'Playground.dwg',
        }),
      })

      const data = await response.json()

      if (data.success && data.jobId) {
        setJobId(data.jobId)
      } else {
        setIsGenerating(false)
        setError(data.error || 'Failed to start generation')
      }
    } catch (err) {
      setIsGenerating(false)
      setError(err instanceof Error ? err.message : 'Network error')
    }
  }

  const handleComplete = (res: { success: boolean; dwgUrl?: string; hasDwgBuffer?: boolean; viewerUrn?: string; costEur?: number; llmModel?: string; tokensIn?: number; tokensOut?: number }) => {
    setIsGenerating(false)
    setResult({
      success: res.success,
      dwgUrl: res.dwgUrl,
      hasDwgBuffer: res.hasDwgBuffer,
      viewerUrn: res.viewerUrn,
      costEur: res.costEur,
      llmModel: res.llmModel,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
    })
  }

  const handleClose = () => {
    setJobId(null)
    setResult(null)
  }

  const handleDownload = async () => {
    if (!jobId) return

    try {
      const response = await fetch(`/api/playground/download/${jobId}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Download failed')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Playground.dwg'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
      setError(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const examplePrompts = [
    'Draw a 100mm x 50mm rectangle with a 20mm radius circle in the center',
    'Draw a door 80cm x 200cm with a panel design and handle',
    'Draw a simple house outline with a triangular roof',
    'Draw a 3x3 grid of 25mm squares spaced 10mm apart',
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          Describe Your Drawing
        </CardTitle>
        <CardDescription>
          Describe what you want to draw in natural language. Claude will generate AutoLISP code
          and create a DWG file for you.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="e.g., Draw a rectangular frame 200mm x 100mm with rounded corners (radius 10mm) and a centered title 'SAMPLE'"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          disabled={isGenerating}
          className="resize-none"
        />

        {/* Example prompts */}
        <div className="flex flex-wrap gap-2">
          {examplePrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => setDescription(prompt)}
              disabled={isGenerating}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              {prompt.length > 40 ? prompt.slice(0, 40) + '...' : prompt}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !description.trim()}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <DraftingCompass className="h-4 w-4" />
                Generate DWG
              </>
            )}
          </Button>

          {result?.success && jobId && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      onClick={() => setViewerOpen(true)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View DWG in browser</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                variant="outline"
                onClick={handleDownload}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
              {result.costEur !== undefined && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 cursor-help">
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          €{result.costEur.toFixed(4)}
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="font-mono text-xs bg-zinc-900 dark:bg-zinc-800 border-zinc-700">
                      <div className="space-y-1">
                        <div className="font-semibold text-emerald-400">
                          {result.llmModel?.split('/')[1] || 'Claude'}
                        </div>
                        <div className="text-zinc-100">
                          {result.tokensIn?.toLocaleString() || 0} tokens in
                        </div>
                        <div className="text-zinc-100">
                          {result.tokensOut?.toLocaleString() || 0} tokens out
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>

        {/* Terminal Log - shows during and after generation */}
        {(jobId || result) && (
          <TerminalLog
            jobId={jobId}
            onComplete={handleComplete}
            onClose={handleClose}
            className="mt-4"
          />
        )}

        {/* DWG Viewer Modal */}
        {(result?.viewerUrn || jobId) && (
          <PlaygroundViewerModal
            open={viewerOpen}
            onOpenChange={setViewerOpen}
            viewerUrn={result?.viewerUrn}
            jobId={jobId ?? undefined}
            fileName="Playground.dwg"
          />
        )}
      </CardContent>
    </Card>
  )
}
