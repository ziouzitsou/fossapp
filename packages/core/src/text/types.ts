/**
 * Text transformation types for @fossapp/core/text
 *
 * Supports both simple string operations and LLM-powered transformations
 */

/**
 * Available text transformations
 *
 * Local transforms (no API call):
 * - titleCase: Convert to Title Case
 * - uppercase: Convert to UPPERCASE
 * - lowercase: Convert to lowercase
 * - trim: Remove leading/trailing whitespace
 *
 * LLM transforms (requires OpenRouter API):
 * - toGreek: Translate to Greek
 * - toEnglish: Translate to English
 * - smartTitleCase: AI-aware title case (handles proper nouns, acronyms)
 */
export type TextTransform =
  | 'titleCase'
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'toGreek'
  | 'toEnglish'
  | 'smartTitleCase'

/**
 * Transforms that require LLM API call
 */
export const LLM_TRANSFORMS: TextTransform[] = [
  'toGreek',
  'toEnglish',
  'smartTitleCase',
]

/**
 * Transforms that are purely local string operations
 */
export const LOCAL_TRANSFORMS: TextTransform[] = [
  'titleCase',
  'uppercase',
  'lowercase',
  'trim',
]

/**
 * Options for text transformation
 */
export interface TransformOptions {
  /**
   * OpenRouter API key (required for LLM transforms)
   * If not provided, will use OPENROUTER_API_KEY env variable
   */
  apiKey?: string

  /**
   * Model to use for LLM transforms
   * @default 'google/gemini-2.0-flash-001'
   */
  model?: string

  /**
   * Context hint to help the LLM (e.g., "this is a project name")
   */
  context?: string
}

/**
 * Result of a text transformation
 */
export interface TransformResult {
  /** Original input text */
  original: string

  /** Transformed text */
  transformed: string

  /** Transforms that were applied */
  appliedTransforms: TextTransform[]

  /** Whether an LLM was used */
  usedLLM: boolean

  /** Token usage (if LLM was used) */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * OpenRouter API response structure
 */
export interface OpenRouterResponse {
  id: string
  choices: Array<{
    message: {
      content: string
      role: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
