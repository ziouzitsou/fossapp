/**
 * Script Service for Symbol DWG Generation
 *
 * Converts Symbol Specifications (from vision analysis) to AutoLISP scripts.
 * Uses OpenRouter API with smart retry/escalation (Sonnet → Opus).
 */

import { SYMBOL_TO_LISP_PROMPT, buildSymbolScriptPrompt } from './script-prompts'
import { LuminaireDimensions } from './types'

// Configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

// Models
const MODEL_FAST = 'anthropic/claude-sonnet-4'  // Attempt 1
const MODEL_SMART = 'anthropic/claude-opus-4'   // Attempt 2+

// Cost per 1M tokens
const PRICING = {
  'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
}

// Types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ScriptGenerationResult {
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
      'X-Title': 'FOSSAPP Symbol Generator',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[symbol-script] OpenRouter API error (${response.status}):`, errorText)

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

  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0 }
  const pricing = PRICING[model as keyof typeof PRICING] || PRICING['anthropic/claude-sonnet-4']
  const cost =
    (usage.prompt_tokens * pricing.input) / 1_000_000 +
    (usage.completion_tokens * pricing.output) / 1_000_000

  return {
    content,
    cost,
    tokensIn: usage.prompt_tokens,
    tokensOut: usage.completion_tokens,
  }
}

/**
 * Extract AutoLISP script from LLM response
 */
export function extractScript(response: string): string {
  const patterns = [
    /```lisp\n([\s\S]*?)```/,
    /```autolisp\n([\s\S]*?)```/,
    /```scr\n([\s\S]*?)```/,
    /```\n([\s\S]*?)```/,
  ]

  let script: string | null = null

  for (const pattern of patterns) {
    const match = response.match(pattern)
    if (match) {
      script = match[1].trim()
      break
    }
  }

  // Fallback: if response starts with AutoLISP code
  if (!script) {
    const trimmed = response.trim()
    if (trimmed.startsWith('(setvar') || trimmed.startsWith(';')) {
      script = trimmed
    }
  }

  if (!script) {
    throw new Error('Could not extract script from LLM response')
  }

  // CRITICAL: Always append SAVEAS command at the end
  // LLMs often forget this even when explicitly instructed
  // Double SAVEAS won't hurt - AutoCAD will just save twice
  console.log('[symbol-script] Appending SAVEAS command to script')
  script = script.trimEnd()
  script += '\n\n; === AUTO-ADDED: Required output commands ===\n'
  script += '(command "SAVEAS" "2018" "Symbol.dwg")\n'

  return script
}

/**
 * Extract relevant error lines from APS output for retry context
 */
export function extractErrorContext(output: string): string {
  const errorPatterns = ['Invalid', 'error:', 'Unknown', 'requires', 'nil', 'bad argument']
  const lines = output.split('\n')
  const errorLines = lines
    .filter((line) => errorPatterns.some((p) => line.toLowerCase().includes(p.toLowerCase())))
    .slice(-10)

  return errorLines.length > 0 ? errorLines.join('\n') : output.slice(-500)
}

/**
 * Generate AutoLISP script from Symbol Specification
 *
 * Uses smart retry with model escalation:
 * - Attempt 1: Sonnet (fast, cheap)
 * - Attempt 2+: Opus (smarter) with error context
 */
export async function generateSymbolScript(
  spec: string,
  fossPid: string,
  dimensions: LuminaireDimensions,
  maxAttempts: number = 3,
  onProgress?: (attempt: number, model: string, status: string) => void
): Promise<ScriptGenerationResult> {
  const result: ScriptGenerationResult = {
    success: false,
    model: MODEL_FAST,
    attempts: 0,
    totalCost: 0,
    tokensIn: 0,
    tokensOut: 0,
  }

  // Build initial messages
  const messages: LLMMessage[] = [
    { role: 'system', content: SYMBOL_TO_LISP_PROMPT },
    { role: 'user', content: buildSymbolScriptPrompt(spec, fossPid) },
  ]

  let lastError: string | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    result.attempts = attempt

    const model = attempt === 1 ? MODEL_FAST : MODEL_SMART
    result.model = model

    const modelName = model.includes('opus') ? 'Opus' : 'Sonnet'
    onProgress?.(attempt, modelName, attempt === 1 ? 'Generating AutoLISP script...' : 'Retrying with smarter model...')

    try {
      const { content, cost, tokensIn, tokensOut } = await callLLM(messages, model)
      result.totalCost += cost
      result.tokensIn += tokensIn
      result.tokensOut += tokensOut
      result.rawResponse = content

      const script = extractScript(content)
      result.script = script
      result.success = true

      onProgress?.(attempt, modelName, `Script generated (${script.length} chars)`)
      return result

    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      result.error = lastError

      onProgress?.(attempt, modelName, `Failed: ${lastError}`)

      if (attempt < maxAttempts) {
        if (result.rawResponse) {
          messages.push({
            role: 'assistant',
            content: result.rawResponse,
          })
        }

        messages.push({
          role: 'user',
          content: `The script could not be extracted or had errors: ${lastError}

Please try again with a corrected script. Make sure to:
1. Wrap the script in a \`\`\`lisp code block
2. Use only valid AutoCAD command options
3. Check syntax carefully
4. Remember: Diameter -> Radius (divide by 2)

Generate a corrected .scr script.`,
        })
      }
    }
  }

  result.error = lastError || 'All attempts failed'
  return result
}

/**
 * Retry script generation with APS error feedback
 *
 * Called when APS execution fails - feeds the error back to LLM for correction
 */
export async function retryScriptWithApsError(
  spec: string,
  fossPid: string,
  previousScript: string,
  apsError: string,
  onProgress?: (model: string, status: string) => void
): Promise<ScriptGenerationResult> {
  const result: ScriptGenerationResult = {
    success: false,
    model: MODEL_SMART,
    attempts: 1,
    totalCost: 0,
    tokensIn: 0,
    tokensOut: 0,
  }

  const errorContext = extractErrorContext(apsError)

  const messages: LLMMessage[] = [
    { role: 'system', content: SYMBOL_TO_LISP_PROMPT },
    { role: 'user', content: buildSymbolScriptPrompt(spec, fossPid) },
    { role: 'assistant', content: `\`\`\`lisp\n${previousScript}\n\`\`\`` },
    {
      role: 'user',
      content: `The script failed when executed in AutoCAD with this error:

${errorContext}

Please fix the script and try again. Make sure to:
1. Use only valid AutoCAD command options
2. Check syntax carefully
3. Ensure all coordinates and values are valid numbers
4. Remember: Diameter values must be divided by 2 for radius in entmake

Generate a corrected .scr script.`,
    },
  ]

  onProgress?.('Opus', 'Retrying with APS error context...')

  try {
    const { content, cost, tokensIn, tokensOut } = await callLLM(messages, MODEL_SMART)
    result.totalCost = cost
    result.tokensIn = tokensIn
    result.tokensOut = tokensOut
    result.rawResponse = content

    const script = extractScript(content)
    result.script = script
    result.success = true

    onProgress?.('Opus', `Script corrected (${script.length} chars)`)

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error)
    onProgress?.('Opus', `Retry failed: ${result.error}`)
  }

  return result
}
