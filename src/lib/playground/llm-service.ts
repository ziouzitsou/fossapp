/**
 * LLM Service for Playground DWG Generation
 *
 * Uses OpenRouter API with smart retry/escalation:
 * - Attempt 1: Sonnet (fast, cheap)
 * - Attempt 2+: Opus (smarter) with error context
 *
 * Ported from: /home/sysadmin/tools/dwg-creator/prompts/dwg_generator.py
 */

import { AUTOLISP_SYSTEM_PROMPT } from './prompts'

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Models
const MODEL_FAST = 'anthropic/claude-sonnet-4'  // Attempt 1
const MODEL_SMART = 'anthropic/claude-opus-4'   // Attempt 2+

// Cost per 1M tokens (approximate)
const PRICING = {
  'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
}

// Types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResult {
  success: boolean
  script?: string
  rawResponse?: string
  error?: string
  model: string
  attempts: number
  totalCost: number
  tokensIn: number
  tokensOut: number
}

interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

/**
 * Call OpenRouter API
 */
async function callLLM(
  messages: LLMMessage[],
  model: string
): Promise<{ content: string; cost: number; tokensIn: number; tokensOut: number }> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY environment variable not set')
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:8080',
      'X-Title': 'FOSSAPP Playground',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[playground] OpenRouter API error (${response.status}):`, errorText)

    // Create user-friendly error messages instead of raw API responses
    let userMessage: string
    const isHtmlResponse = errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')

    if (response.status === 503 || response.status === 502) {
      userMessage = 'AI service temporarily unavailable. Please try again in a few minutes.'
    } else if (response.status === 429) {
      userMessage = 'AI service rate limit exceeded. Please wait a moment and try again.'
    } else if (response.status === 401 || response.status === 403) {
      userMessage = 'AI service authentication error. Please contact support.'
    } else if (isHtmlResponse) {
      userMessage = `AI service error (${response.status}). Please try again later.`
    } else {
      // Try to extract JSON error message if available
      try {
        const errorJson = JSON.parse(errorText)
        userMessage = errorJson.error?.message || errorJson.message || `AI service error (${response.status})`
      } catch {
        userMessage = `AI service error (${response.status}). Please try again.`
      }
    }

    throw new Error(userMessage)
  }

  const result = (await response.json()) as OpenRouterResponse
  const content = result.choices[0]?.message?.content || ''

  // Calculate cost
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 }
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['anthropic/claude-sonnet-4']
  const cost =
    (usage.prompt_tokens * pricing.input) / 1_000_000 +
    (usage.completion_tokens * pricing.output) / 1_000_000

  return {
    content,
    cost,
    tokensIn: usage.prompt_tokens,
    tokensOut: usage.completion_tokens
  }
}

/**
 * Extract AutoLISP script from LLM response
 */
export function extractScript(response: string): string {
  // Try to find code blocks in order of specificity
  const patterns = [
    /```lisp\n([\s\S]*?)```/,
    /```autolisp\n([\s\S]*?)```/,
    /```scr\n([\s\S]*?)```/,
    /```\n([\s\S]*?)```/,
  ]

  for (const pattern of patterns) {
    const match = response.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  // Fallback: if response starts with AutoLISP code, use entire response
  const trimmed = response.trim()
  if (trimmed.startsWith('(setvar') || trimmed.startsWith(';')) {
    return trimmed
  }

  throw new Error('Could not extract script from LLM response')
}

/**
 * Extract relevant error lines from APS output
 */
export function extractErrorContext(output: string): string {
  const errorPatterns = ['Invalid', 'error:', 'Unknown', 'requires', 'nil', 'bad argument']
  const lines = output.split('\n')
  const errorLines = lines
    .filter((line) => errorPatterns.some((p) => line.toLowerCase().includes(p.toLowerCase())))
    .slice(-10) // Last 10 error lines

  return errorLines.length > 0 ? errorLines.join('\n') : output.slice(-500)
}

/**
 * Generate AutoLISP script from natural language description
 *
 * Uses smart retry with model escalation:
 * - Attempt 1: Sonnet
 * - Attempt 2+: Opus with error context
 */
export async function generateScript(
  description: string,
  outputFilename: string = 'Tile.dwg',
  maxAttempts: number = 3,
  onProgress?: (attempt: number, model: string, status: string) => void
): Promise<LLMResult> {
  const result: LLMResult = {
    success: false,
    model: MODEL_FAST,
    attempts: 0,
    totalCost: 0,
    tokensIn: 0,
    tokensOut: 0,
  }

  // Build initial messages
  const messages: LLMMessage[] = [
    { role: 'system', content: AUTOLISP_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Create a drawing: ${description}

Output file: ${outputFilename}

Generate the complete .scr script. Remember:
- All dimensions should be in millimeters
- Use entmake for entities when possible
- Include proper layer setup
- End with SAVEAS command`,
    },
  ]

  let lastError: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result.attempts = attempt

    // Choose model based on attempt
    const model = attempt === 1 ? MODEL_FAST : MODEL_SMART
    result.model = model

    const modelName = model.includes('opus') ? 'Opus' : 'Sonnet'
    onProgress?.(attempt, modelName, attempt === 1 ? 'Generating script...' : 'Retrying with smarter model...')

    try {
      // Call LLM
      const { content, cost, tokensIn, tokensOut } = await callLLM(messages, model)
      result.totalCost += cost
      result.tokensIn += tokensIn
      result.tokensOut += tokensOut
      result.rawResponse = content

      // Extract script
      const script = extractScript(content)
      result.script = script
      result.success = true

      onProgress?.(attempt, modelName, `Script generated (${script.length} chars)`)
      return result

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      result.error = lastError

      onProgress?.(attempt, modelName, `Failed: ${lastError}`)

      // If we have more attempts, add error context to conversation
      if (attempt < maxAttempts) {
        // Add the failed response if we have one
        if (result.rawResponse) {
          messages.push({
            role: 'assistant',
            content: result.rawResponse,
          })
        }

        // Add error feedback
        messages.push({
          role: 'user',
          content: `The script could not be extracted or had errors: ${lastError}

Please try again with a corrected script. Make sure to:
1. Wrap the script in a \`\`\`lisp code block
2. Use only valid AutoCAD command options
3. Check syntax carefully

Generate a corrected .scr script.`,
        })
      }
    }
  }

  // All attempts failed
  result.error = lastError || 'All attempts failed'
  return result
}

/**
 * Generate script with APS error feedback for retry
 *
 * This is called when APS execution fails - feeds the error back to LLM
 */
export async function retryWithError(
  description: string,
  previousScript: string,
  apsError: string,
  outputFilename: string = 'Tile.dwg',
  previousMessages?: LLMMessage[],
  onProgress?: (attempt: number, model: string, status: string) => void
): Promise<LLMResult> {
  const result: LLMResult = {
    success: false,
    model: MODEL_SMART, // Always use Opus for retries
    attempts: 1,
    totalCost: 0,
    tokensIn: 0,
    tokensOut: 0,
  }

  // Build messages with error context
  const messages: LLMMessage[] = previousMessages || [
    { role: 'system', content: AUTOLISP_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Create a drawing: ${description}

Output file: ${outputFilename}

Generate the complete .scr script.`,
    },
  ]

  // Add the failed script
  messages.push({
    role: 'assistant',
    content: `\`\`\`lisp\n${previousScript}\n\`\`\``,
  })

  // Add error feedback with extracted context
  const errorContext = extractErrorContext(apsError)
  messages.push({
    role: 'user',
    content: `The script failed when executed in AutoCAD with this error:

${errorContext}

Please fix the script and try again. Make sure to:
1. Use only valid AutoCAD command options
2. Check syntax carefully
3. Ensure all coordinates and values are valid numbers

Generate a corrected .scr script.`,
  })

  onProgress?.(1, 'Opus', 'Retrying with error context...')

  try {
    const { content, cost, tokensIn, tokensOut } = await callLLM(messages, MODEL_SMART)
    result.totalCost = cost
    result.tokensIn = tokensIn
    result.tokensOut = tokensOut
    result.rawResponse = content

    const script = extractScript(content)
    result.script = script
    result.success = true

    onProgress?.(1, 'Opus', `Script corrected (${script.length} chars)`)

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    onProgress?.(1, 'Opus', `Retry failed: ${result.error}`)
  }

  return result
}
