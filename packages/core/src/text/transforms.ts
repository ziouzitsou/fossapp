/**
 * Text Transformation Utilities
 *
 * Provides both local string operations (titleCase, uppercase, lowercase, trim)
 * and LLM-powered transformations (translation, smart title case) using
 * OpenRouter API with Gemini Flash by default.
 *
 * Local transforms execute synchronously without any API calls.
 * LLM transforms require an OpenRouter API key (via env or options).
 *
 * @module @fossapp/core/text
 * @see {@link ./types.ts} for type definitions and available transforms
 */

import type {
  TextTransform,
  TransformOptions,
  TransformResult,
  OpenRouterResponse,
} from './types'
import { LLM_TRANSFORMS } from './types'

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001'
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'

/**
 * Applies a local (non-LLM) transformation to text.
 *
 * @param text - The input string to transform
 * @param transform - The transformation to apply (titleCase, uppercase, lowercase, trim)
 * @returns The transformed string, or original if transform is LLM-only
 */
function applyLocalTransform(text: string, transform: TextTransform): string {
  switch (transform) {
    case 'titleCase':
      return toTitleCase(text)
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'trim':
      return text.trim()
    default:
      return text
  }
}

/**
 * Converts text to title case by capitalizing the first letter of each word.
 *
 * @remarks
 * This is a naive implementation that doesn't handle articles, prepositions,
 * or proper nouns. For smarter title casing, use the 'smartTitleCase' LLM transform.
 *
 * @param text - The input string to convert
 * @returns Text with each word's first letter capitalized
 */
function toTitleCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => {
      if (word.length === 0) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Builds the prompt string for LLM-based transformations.
 *
 * @remarks
 * Combines multiple transform instructions into a single prompt for efficiency.
 * The prompt structure includes optional context, transformation instructions,
 * and explicit instructions for clean output.
 *
 * @param text - The text to be transformed
 * @param transforms - Array of LLM transforms to apply
 * @param context - Optional context hint (e.g., "this is a project name")
 * @returns Formatted prompt string ready for the LLM
 */
function buildPrompt(
  text: string,
  transforms: TextTransform[],
  context?: string
): string {
  const instructions: string[] = []

  for (const transform of transforms) {
    switch (transform) {
      case 'toGreek':
        instructions.push('Translate the text to Greek')
        break
      case 'toEnglish':
        instructions.push('Translate the text to English')
        break
      case 'smartTitleCase':
        instructions.push(
          'Apply proper title case, respecting proper nouns, acronyms, and common conventions'
        )
        break
    }
  }

  let prompt = `${instructions.join('. ')}.\n\nText: "${text}"`

  if (context) {
    prompt = `Context: ${context}\n\n${prompt}`
  }

  prompt += '\n\nRespond with ONLY the transformed text, nothing else.'

  return prompt
}

/**
 * Calls OpenRouter API to perform LLM-based text transformation.
 *
 * @remarks
 * Uses low temperature (0.1) for consistent, deterministic results.
 * Automatically strips any quotes the LLM might add to the response.
 *
 * @param prompt - The formatted prompt from buildPrompt()
 * @param options - Transform options including API key and model
 * @returns Object containing transformed text and optional token usage stats
 * @throws {Error} If API key is missing or API call fails
 *
 * @see {@link https://openrouter.ai/docs} OpenRouter API documentation
 */
async function callLLM(
  prompt: string,
  options: TransformOptions
): Promise<{ text: string; usage?: TransformResult['usage'] }> {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error(
      'OpenRouter API key is required for LLM transforms. ' +
        'Set OPENROUTER_API_KEY environment variable or pass apiKey in options.'
    )
  }

  const model = options.model || DEFAULT_MODEL

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.titancnc.eu',
      'X-Title': 'FOSSAPP Text Transform',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a text transformation assistant. You transform text exactly as instructed. Respond with ONLY the transformed text, no explanations or quotes.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent results
      max_tokens: 500,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`)
  }

  const data = (await response.json()) as OpenRouterResponse

  const text = data.choices[0]?.message?.content?.trim() || ''

  // Remove any quotes the LLM might have added
  const cleanText = text.replace(/^["']|["']$/g, '')

  return {
    text: cleanText,
    usage: data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined,
  }
}

/**
 * Transform text using one or more transformations
 *
 * @param text - The text to transform
 * @param transforms - Single transform or array of transforms to apply (in order)
 * @param options - Optional configuration
 * @returns Promise<TransformResult> - The transformation result
 *
 * @example
 * // Simple title case (no API call)
 * const result = await transformText('hello world', 'titleCase')
 * // result.transformed = 'Hello World'
 *
 * @example
 * // Translate to Greek
 * const result = await transformText('Hello World', 'toGreek')
 * // result.transformed = 'Γειά σου Κόσμε'
 *
 * @example
 * // Chain multiple transforms: title case then translate
 * const result = await transformText('hello world', ['titleCase', 'toGreek'])
 * // result.transformed = 'Γειά Σου Κόσμε'
 */
export async function transformText(
  text: string,
  transforms: TextTransform | TextTransform[],
  options: TransformOptions = {}
): Promise<TransformResult> {
  const transformArray = Array.isArray(transforms) ? transforms : [transforms]

  if (transformArray.length === 0) {
    return {
      original: text,
      transformed: text,
      appliedTransforms: [],
      usedLLM: false,
    }
  }

  // Separate local and LLM transforms
  const localTransforms = transformArray.filter(
    (t) => !LLM_TRANSFORMS.includes(t)
  )
  const llmTransforms = transformArray.filter((t) => LLM_TRANSFORMS.includes(t))

  let currentText = text

  // Apply local transforms first
  for (const transform of localTransforms) {
    currentText = applyLocalTransform(currentText, transform)
  }

  let usage: TransformResult['usage'] | undefined

  // Apply LLM transforms if any
  if (llmTransforms.length > 0) {
    const prompt = buildPrompt(currentText, llmTransforms, options.context)
    const llmResult = await callLLM(prompt, options)
    currentText = llmResult.text
    usage = llmResult.usage
  }

  return {
    original: text,
    transformed: currentText,
    appliedTransforms: transformArray,
    usedLLM: llmTransforms.length > 0,
    usage,
  }
}

/**
 * Synchronous title case helper for simple use cases.
 *
 * @remarks
 * Use this when you just need basic title case without async overhead.
 * For smarter title casing that respects proper nouns and acronyms,
 * use `transformText(text, 'smartTitleCase')` instead.
 *
 * @param text - The input string to convert
 * @returns Text with each word's first letter capitalized
 *
 * @example
 * titleCase('hello world') // 'Hello World'
 */
export function titleCase(text: string): string {
  return toTitleCase(text)
}

/**
 * Checks if a single transform requires an LLM API call.
 *
 * @remarks
 * Useful for UI hints (e.g., showing "requires API key" warning) or
 * conditionally enabling features based on API availability.
 *
 * @param transform - The transform type to check
 * @returns True if the transform requires OpenRouter API
 */
export function requiresLLM(transform: TextTransform): boolean {
  return LLM_TRANSFORMS.includes(transform)
}

/**
 * Checks if any transform in an array requires an LLM API call.
 *
 * @remarks
 * Use this to check a batch of transforms before processing to determine
 * if API credentials will be needed.
 *
 * @param transforms - Array of transform types to check
 * @returns True if at least one transform requires OpenRouter API
 */
export function anyRequiresLLM(transforms: TextTransform[]): boolean {
  return transforms.some((t) => LLM_TRANSFORMS.includes(t))
}
