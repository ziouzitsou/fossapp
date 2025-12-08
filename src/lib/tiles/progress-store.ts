/**
 * Progress Store for Tile Generation
 * In-memory store for streaming job progress via SSE
 * Uses globalThis to ensure singleton across all API routes
 */

export interface ProgressMessage {
  timestamp: number
  elapsed: string
  phase: 'images' | 'script' | 'aps' | 'drive' | 'complete' | 'error' | 'llm'
  step?: string
  message: string
  detail?: string
  result?: {
    success: boolean
    dwgUrl?: string
    dwgFileId?: string
    driveLink?: string
    errors?: string[]
    hasDwgBuffer?: boolean // Indicates DWG can be downloaded via /api/playground/download/[jobId]
    costEur?: number // LLM cost in EUR for playground
    llmModel?: string // Model used (e.g., "anthropic/claude-sonnet-4")
    tokensIn?: number // Input tokens used
    tokensOut?: number // Output tokens used
  }
}

export interface JobProgress {
  jobId: string
  tileName: string
  status: 'running' | 'complete' | 'error'
  startTime: number
  messages: ProgressMessage[]
  result?: {
    success: boolean
    dwgUrl?: string
    dwgFileId?: string
    driveLink?: string
    errors?: string[]
    hasDwgBuffer?: boolean
    costEur?: number
    llmModel?: string
    tokensIn?: number
    tokensOut?: number
  }
  dwgBuffer?: Buffer // Temporary storage for playground downloads
}

// Use globalThis to ensure singleton across all API routes in Next.js
const globalForProgress = globalThis as unknown as {
  tileJobs: Map<string, JobProgress> | undefined
  tileSubscribers: Map<string, Set<(msg: ProgressMessage) => void>> | undefined
}

// In-memory store for active jobs
const jobs = globalForProgress.tileJobs ?? new Map<string, JobProgress>()
globalForProgress.tileJobs = jobs

// SSE subscribers per job
const subscribers = globalForProgress.tileSubscribers ?? new Map<string, Set<(msg: ProgressMessage) => void>>()
globalForProgress.tileSubscribers = subscribers

/**
 * Create a new job
 */
export function createJob(jobId: string, tileName: string): JobProgress {
  const job: JobProgress = {
    jobId,
    tileName,
    status: 'running',
    startTime: Date.now(),
    messages: [],
  }
  jobs.set(jobId, job)
  subscribers.set(jobId, new Set())
  return job
}

/**
 * Add a progress message to a job
 */
export function addProgress(
  jobId: string,
  phase: ProgressMessage['phase'],
  message: string,
  detail?: string,
  step?: string
): void {
  const job = jobs.get(jobId)
  if (!job) return

  const elapsed = ((Date.now() - job.startTime) / 1000).toFixed(1)
  const progressMsg: ProgressMessage = {
    timestamp: Date.now(),
    elapsed: `${elapsed}s`,
    phase,
    step,
    message,
    detail,
  }

  job.messages.push(progressMsg)

  // Also log to console for server monitoring
  console.log(`[${elapsed}s] ${step ? `${step}: ` : ''}${message}${detail ? ` - ${detail}` : ''}`)

  // Notify all subscribers
  const subs = subscribers.get(jobId)
  if (subs) {
    subs.forEach((callback) => callback(progressMsg))
  }
}

/**
 * Complete a job with result
 */
export function completeJob(
  jobId: string,
  success: boolean,
  result?: { dwgUrl?: string; dwgFileId?: string; driveLink?: string; errors?: string[]; dwgBuffer?: Buffer; costEur?: number; llmModel?: string; tokensIn?: number; tokensOut?: number },
  customDetail?: string
): void {
  const job = jobs.get(jobId)
  if (!job) return

  job.status = success ? 'complete' : 'error'

  // Store dwgBuffer separately (not in result to avoid JSON serialization)
  if (result?.dwgBuffer) {
    job.dwgBuffer = result.dwgBuffer
  }

  // Build result without buffer (for JSON serialization)
  const { dwgBuffer, ...resultWithoutBuffer } = result || {}
  const hasDwgBuffer = !!dwgBuffer
  job.result = { success, ...resultWithoutBuffer, hasDwgBuffer }

  const elapsed = ((Date.now() - job.startTime) / 1000).toFixed(1)

  // Create completion message with result included (no buffer)
  const progressMsg: ProgressMessage = {
    timestamp: Date.now(),
    elapsed: `${elapsed}s`,
    phase: success ? 'complete' : 'error',
    message: success ? 'Generation complete!' : 'Generation failed',
    detail: customDetail || `Total time: ${elapsed}s`,
    result: { success, ...resultWithoutBuffer, hasDwgBuffer },
  }

  job.messages.push(progressMsg)
  console.log(`[${elapsed}s] ${progressMsg.message} - ${progressMsg.detail}`)

  // Notify all subscribers
  const subs = subscribers.get(jobId)
  if (subs) {
    subs.forEach((callback) => callback(progressMsg))
  }

  // Clean up after 5 minutes
  setTimeout(() => {
    jobs.delete(jobId)
    subscribers.delete(jobId)
  }, 5 * 60 * 1000)
}

/**
 * Get job progress
 */
export function getJob(jobId: string): JobProgress | undefined {
  return jobs.get(jobId)
}

/**
 * Subscribe to job progress updates
 */
export function subscribe(jobId: string, callback: (msg: ProgressMessage) => void): () => void {
  const subs = subscribers.get(jobId)
  if (subs) {
    subs.add(callback)
  }

  // Return unsubscribe function
  return () => {
    const subs = subscribers.get(jobId)
    if (subs) {
      subs.delete(callback)
    }
  }
}

/**
 * Generate a unique job ID
 */
export function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
