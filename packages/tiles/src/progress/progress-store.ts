/**
 * Progress Store for Tile/Symbol Generation Jobs
 *
 * An in-memory pub/sub store for tracking long-running generation jobs and
 * streaming progress updates to clients via Server-Sent Events (SSE).
 *
 * @remarks
 * Uses globalThis to ensure a singleton instance across all Next.js API routes.
 * Without this, each API route would have its own Map instance due to module isolation.
 *
 * Jobs are automatically cleaned up after 5 minutes to prevent memory leaks.
 * Binary buffers (DWG/PNG) are stored temporarily for download but excluded
 * from JSON serialization.
 *
 * @module
 * @see {@link /api/tiles/generate/route.ts} for tile generation API
 * @see {@link /api/playground/generate/route.ts} for playground API
 */

/**
 * A single progress update message sent during job execution.
 *
 * @remarks
 * Messages are pushed to subscribers in real-time via SSE.
 * The `result` field is only populated on the final 'complete' or 'error' message.
 */
export interface ProgressMessage {
  /** Unix timestamp when message was created */
  timestamp: number
  /** Human-readable elapsed time (e.g., "2.5s") */
  elapsed: string
  /**
   * Current processing phase:
   * - 'init': Initializing/fetching data
   * - 'images': Downloading/processing product images
   * - 'script': Generating AutoLISP script
   * - 'aps': Running APS Design Automation
   * - 'download': Downloading generated files
   * - 'drive': Uploading to Google Drive
   * - 'storage': Saving to Supabase storage
   * - 'llm': Processing with AI model
   * - 'complete': Job finished successfully
   * - 'error': Job failed
   */
  phase: 'init' | 'images' | 'script' | 'aps' | 'download' | 'drive' | 'storage' | 'complete' | 'error' | 'llm'
  /** Optional sub-step within the phase */
  step?: string
  /** User-facing progress message */
  message: string
  /** Additional technical details */
  detail?: string
  /** Final result data (only on complete/error) */
  result?: {
    /** Whether generation succeeded */
    success: boolean
    /** Public URL to download DWG file */
    dwgUrl?: string
    /** Google Drive file ID */
    dwgFileId?: string
    /** Google Drive shareable link */
    driveLink?: string
    /** Autodesk Viewer URN for SVF translation */
    viewerUrn?: string
    /** Error messages if failed */
    errors?: string[]
    /** True if DWG buffer available for download */
    hasDwgBuffer?: boolean
    /** True if PNG buffer available for download */
    hasPngBuffer?: boolean
    /** LLM usage cost in EUR (playground) */
    costEur?: number
    /** LLM model identifier */
    llmModel?: string
    /** Input tokens consumed */
    tokensIn?: number
    /** Output tokens generated */
    tokensOut?: number
    /** True if files saved to Supabase storage */
    savedToSupabase?: boolean
    /** Path in product-symbols bucket (DWG) */
    dwgPath?: string
    /** Path in product-symbols bucket (PNG) */
    pngPath?: string
    /** Path in product-symbols bucket (SVG) */
    svgPath?: string
    /** Output filename (case study generation) */
    outputFilename?: string
    /** Products that used placeholder symbols (case study) */
    missingSymbols?: string[]
  }
}

/**
 * Complete state for a generation job.
 *
 * @remarks
 * Stored in the in-memory Map and returned via getJob().
 * Binary buffers are stored separately from the result to avoid
 * JSON serialization issues.
 */
export interface JobProgress {
  /** Unique job identifier */
  jobId: string
  /** Display name (tile name or symbol description) */
  tileName: string
  /** Current job status */
  status: 'running' | 'complete' | 'error'
  /** Job start timestamp (ms since epoch) */
  startTime: number
  /** Accumulated progress messages */
  messages: ProgressMessage[]
  /** Final result (mirrors ProgressMessage.result) */
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
  /** Temporary DWG file buffer for downloads */
  dwgBuffer?: Buffer
  /** Temporary PNG file buffer for downloads */
  pngBuffer?: Buffer
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
 * Creates a new generation job and initializes its subscriber set.
 *
 * @param jobId - Unique identifier for the job (use {@link generateJobId})
 * @param tileName - Display name for the job (tile name or description)
 * @returns The newly created JobProgress object
 *
 * @example
 * ```ts
 * const jobId = generateJobId()
 * const job = createJob(jobId, 'LED Panel 600x600')
 * ```
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
 * Adds a progress message to a job and notifies all subscribers.
 *
 * @remarks
 * Messages are logged to console for server-side monitoring and
 * pushed to all SSE subscribers in real-time.
 *
 * @param jobId - Target job identifier
 * @param phase - Current processing phase
 * @param message - User-facing progress message
 * @param detail - Optional technical details
 * @param step - Optional sub-step identifier
 *
 * @example
 * ```ts
 * addProgress(jobId, 'aps', 'Running APS workitem', 'workitem-123', 'APS')
 * ```
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

  // Notify all subscribers
  const subs = subscribers.get(jobId)
  if (subs) {
    subs.forEach((callback) => callback(progressMsg))
  }
}

/**
 * Marks a job as complete and sends the final result to all subscribers.
 *
 * @remarks
 * Binary buffers (DWG/PNG) are stored on the job for download but
 * excluded from the result object to allow JSON serialization.
 * Jobs are automatically deleted after 5 minutes to free memory.
 *
 * @param jobId - Target job identifier
 * @param success - Whether the job completed successfully
 * @param result - Optional result data including URLs, buffers, and metadata
 * @param customDetail - Custom detail message (defaults to total time)
 *
 * @example
 * ```ts
 * completeJob(jobId, true, {
 *   dwgUrl: 'https://storage.example.com/output.dwg',
 *   driveLink: 'https://drive.google.com/...',
 *   dwgBuffer: buffer
 * })
 * ```
 */
export function completeJob(
  jobId: string,
  success: boolean,
  result?: { dwgUrl?: string; dwgFileId?: string; driveLink?: string; viewerUrn?: string; errors?: string[]; dwgBuffer?: Buffer; pngBuffer?: Buffer; costEur?: number; llmModel?: string; tokensIn?: number; tokensOut?: number; savedToSupabase?: boolean; dwgPath?: string; pngPath?: string; svgPath?: string },
  customDetail?: string
): void {
  const job = jobs.get(jobId)
  if (!job) return

  job.status = success ? 'complete' : 'error'

  // Store buffers separately (not in result to avoid JSON serialization)
  if (result?.dwgBuffer) {
    job.dwgBuffer = result.dwgBuffer
  }
  if (result?.pngBuffer) {
    job.pngBuffer = result.pngBuffer
  }

  // Build result without buffers (for JSON serialization)
  const { dwgBuffer, pngBuffer, ...resultWithoutBuffers } = result || {}
  const hasDwgBuffer = !!dwgBuffer
  const hasPngBuffer = !!pngBuffer
  job.result = { success, ...resultWithoutBuffers, hasDwgBuffer, hasPngBuffer }

  const elapsed = ((Date.now() - job.startTime) / 1000).toFixed(1)

  // Create completion message with result included (no buffers)
  const progressMsg: ProgressMessage = {
    timestamp: Date.now(),
    elapsed: `${elapsed}s`,
    phase: success ? 'complete' : 'error',
    message: success ? 'Generation complete!' : 'Generation failed',
    detail: customDetail || `Total time: ${elapsed}s`,
    result: { success, ...resultWithoutBuffers, hasDwgBuffer, hasPngBuffer },
  }

  job.messages.push(progressMsg)

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
 * Retrieves the current state of a job.
 *
 * @param jobId - Job identifier to look up
 * @returns JobProgress if found, undefined otherwise
 */
export function getJob(jobId: string): JobProgress | undefined {
  return jobs.get(jobId)
}

/**
 * Subscribes to real-time progress updates for a job.
 *
 * @remarks
 * Used by SSE endpoints to push updates to connected clients.
 * Returns an unsubscribe function that should be called when
 * the client disconnects.
 *
 * @param jobId - Job identifier to subscribe to
 * @param callback - Function called with each progress message
 * @returns Unsubscribe function to remove the callback
 *
 * @example
 * ```ts
 * const unsubscribe = subscribe(jobId, (msg) => {
 *   stream.write(`data: ${JSON.stringify(msg)}\n\n`)
 * })
 *
 * // On client disconnect:
 * unsubscribe()
 * ```
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
 * Generates a unique job identifier.
 *
 * @remarks
 * Format: `job-{timestamp}-{random}` for easy debugging and sorting.
 *
 * @returns Unique job ID string
 *
 * @example
 * ```ts
 * const jobId = generateJobId() // "job-1703097600000-abc123xyz"
 * ```
 */
export function generateJobId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}
