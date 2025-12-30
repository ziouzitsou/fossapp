/**
 * System Prompts for Symbol Generator
 *
 * Vision LLM prompts for analyzing luminaire products and generating
 * structured AutoCAD plan-view symbol specifications for LISP generation.
 *
 * Prompts are loaded from external markdown files for easier editing.
 * See: src/lib/symbol-generator/prompts/vision-analysis.md
 */

import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Load prompt from markdown file
 * Cached at module load time for performance
 */
function loadPrompt(filename: string): string {
  try {
    const promptPath = join(process.cwd(), 'src/lib/symbol-generator/prompts', filename)
    return readFileSync(promptPath, 'utf-8')
  } catch (error) {
    console.error(`[symbol-generator] Failed to load prompt file: ${filename}`, error)
    throw new Error(`Prompt file not found: ${filename}`)
  }
}

/**
 * System prompt for vision analysis
 * Loaded from: prompts/vision-analysis.md
 */
export const SYMBOL_ANALYSIS_SYSTEM_PROMPT = loadPrompt('vision-analysis.md')

/**
 * Build the user prompt with product details
 */
export function buildUserPrompt(
  productDescription: string,
  className: string,
  fossPid: string,
  dimensionsText: string,
  hasImage: boolean,
  hasDrawing: boolean
): string {
  const imageNote = []
  if (hasImage) imageNote.push('product photo (MD01)')
  if (hasDrawing) imageNote.push('technical drawing (MD12)')
  const imageText = imageNote.length > 0
    ? `**IMAGES PROVIDED**: ${imageNote.join(' and ')}`
    : '**IMAGES**: None available - use ETIM dimensions only'

  return `Generate a structured symbol specification for this luminaire.

**PRODUCT**: ${productDescription}
**CLASS**: ${className}
**FOSS_PID**: ${fossPid}

**ETIM DIMENSIONS (AUTHORITATIVE)**:
${dimensionsText || 'No dimension data available'}

${imageText}

Generate the SYMBOL SPECIFICATION following the exact format from your instructions. Use ETIM dimensions where available, mark estimates clearly.`
}
