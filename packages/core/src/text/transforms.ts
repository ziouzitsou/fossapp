/**
 * Text transformation utilities
 *
 * Provides both local string operations and LLM-powered transformations
 * using OpenRouter API (Gemini Flash by default)
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
 * Apply local (non-LLM) transformations
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
 * Simple title case conversion
 * Capitalizes first letter of each word
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
 * Build the prompt for LLM transformations
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
 * Call OpenRouter API for LLM transformations
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
 * Quick helper for title case (no async needed)
 */
export function titleCase(text: string): string {
  return toTitleCase(text)
}

/**
 * Check if a transform requires LLM
 */
export function requiresLLM(transform: TextTransform): boolean {
  return LLM_TRANSFORMS.includes(transform)
}

/**
 * Check if any transforms in an array require LLM
 */
export function anyRequiresLLM(transforms: TextTransform[]): boolean {
  return transforms.some((t) => LLM_TRANSFORMS.includes(t))
}
