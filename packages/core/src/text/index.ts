/**
 * @fossapp/core/text - Text transformation utilities
 *
 * Provides both local string operations and LLM-powered transformations
 * using OpenRouter API (Gemini Flash by default)
 *
 * @example
 * // Server-side usage
 * import { transformText, titleCase } from '@fossapp/core/text'
 *
 * // Simple title case (synchronous, no API)
 * const title = titleCase('hello world') // 'Hello World'
 *
 * // Translate to Greek (async, uses LLM)
 * const result = await transformText('Hello', 'toGreek')
 * console.log(result.transformed) // 'Γεια'
 *
 * // Chain transforms
 * const result = await transformText('hello', ['titleCase', 'toGreek'])
 */

// Types
export type {
  TextTransform,
  TransformOptions,
  TransformResult,
} from './types'

export { LLM_TRANSFORMS, LOCAL_TRANSFORMS } from './types'

// Functions
export {
  transformText,
  titleCase,
  requiresLLM,
  anyRequiresLLM,
} from './transforms'
