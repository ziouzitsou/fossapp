'use client'

/**
 * useTextTransform Hook
 *
 * React hook for text transformations with debouncing and loading states.
 * Uses server actions to keep API keys secure.
 *
 * @example
 * const { transform, transformedText, isLoading } = useTextTransform()
 *
 * // Manual transform
 * const result = await transform('hello world', ['titleCase', 'toEnglish'])
 *
 * @example
 * // With preset for project names
 * const { transformProjectName, isLoading } = useTextTransform()
 * const result = await transformProjectName('my project')
 */

import { useState, useCallback, useTransition } from 'react'
import {
  transformTextAction,
  transformProjectNameAction,
  transformDescriptionAction,
  titleCaseAction,
} from '@/lib/actions/text'
import type { TextTransform, TransformResult } from '@fossapp/core/text'

interface UseTextTransformReturn {
  /** Transform text with custom transforms */
  transform: (
    text: string,
    transforms: TextTransform | TextTransform[],
    context?: string
  ) => Promise<TransformResult>

  /** Quick title case (instant, no LLM) */
  titleCase: (text: string) => Promise<string>

  /** Transform project name (Title Case + English) */
  transformProjectName: (text: string) => Promise<TransformResult>

  /** Transform description (Title Case + English) */
  transformDescription: (text: string) => Promise<TransformResult>

  /** Whether a transformation is in progress */
  isLoading: boolean

  /** Last error if any */
  error: Error | null

  /** Last transform result */
  lastResult: TransformResult | null
}

export function useTextTransform(): UseTextTransformReturn {
  const [isPending, startTransition] = useTransition()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [lastResult, setLastResult] = useState<TransformResult | null>(null)

  const transform = useCallback(
    async (
      text: string,
      transforms: TextTransform | TextTransform[],
      context?: string
    ): Promise<TransformResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await transformTextAction(text, transforms, context)
        setLastResult(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transform failed')
        setError(error)
        return {
          original: text,
          transformed: text,
          appliedTransforms: [],
          usedLLM: false,
        }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const titleCase = useCallback(async (text: string): Promise<string> => {
    try {
      return await titleCaseAction(text)
    } catch {
      return text
    }
  }, [])

  const transformProjectName = useCallback(
    async (text: string): Promise<TransformResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await transformProjectNameAction(text)
        setLastResult(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transform failed')
        setError(error)
        return {
          original: text,
          transformed: text,
          appliedTransforms: [],
          usedLLM: false,
        }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  const transformDescription = useCallback(
    async (text: string): Promise<TransformResult> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await transformDescriptionAction(text)
        setLastResult(result)
        return result
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Transform failed')
        setError(error)
        return {
          original: text,
          transformed: text,
          appliedTransforms: [],
          usedLLM: false,
        }
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  return {
    transform,
    titleCase,
    transformProjectName,
    transformDescription,
    isLoading: isLoading || isPending,
    error,
    lastResult,
  }
}
