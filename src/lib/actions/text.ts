'use server'

/**
 * Text Transform Server Actions
 *
 * Server-side text transformations using LLM (Gemini Flash via OpenRouter).
 * Keeps API key secure on the server.
 */

import {
  transformText,
  titleCase as localTitleCase,
} from '@fossapp/core/text'
import type { TextTransform, TransformResult } from '@fossapp/core/text'

/**
 * Transform text using one or more transformations
 *
 * @param text - The text to transform
 * @param transforms - Single transform or array of transforms
 * @param context - Optional context hint for LLM
 * @returns TransformResult with original and transformed text
 */
export async function transformTextAction(
  text: string,
  transforms: TextTransform | TextTransform[],
  context?: string
): Promise<TransformResult> {
  // Don't process empty text
  if (!text || text.trim().length === 0) {
    return {
      original: text,
      transformed: text,
      appliedTransforms: [],
      usedLLM: false,
    }
  }

  try {
    const result = await transformText(text, transforms, { context })
    return result
  } catch (error) {
    console.error('[TextTransform] Error:', error)
    // Return original text on error
    return {
      original: text,
      transformed: text,
      appliedTransforms: [],
      usedLLM: false,
    }
  }
}

/**
 * Quick title case transformation (no LLM, instant)
 */
export async function titleCaseAction(text: string): Promise<string> {
  if (!text || text.trim().length === 0) return text
  return localTitleCase(text)
}

/**
 * Transform project name: Title Case + English
 * Optimized for project names
 */
export async function transformProjectNameAction(
  text: string
): Promise<TransformResult> {
  return transformTextAction(text, ['titleCase', 'toEnglish'], 'This is a project name')
}

/**
 * Transform description: Title Case + English
 * Optimized for descriptions
 */
export async function transformDescriptionAction(
  text: string
): Promise<TransformResult> {
  return transformTextAction(text, ['titleCase', 'toEnglish'], 'This is a project description')
}
