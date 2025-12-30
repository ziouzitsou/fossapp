/**
 * System Prompts for Symbol DWG Generation
 *
 * Specialized prompt for converting Symbol Specifications (from vision analysis)
 * into AutoLISP scripts for APS Design Automation.
 *
 * Prompts are loaded from external markdown files for easier editing.
 * See: src/lib/symbol-generator/prompts/script-generation.md
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
 * System prompt for AutoLISP script generation
 * Loaded from: prompts/script-generation.md
 */
export const SYMBOL_TO_LISP_PROMPT = loadPrompt('script-generation.md')

/**
 * Build the user prompt with the symbol specification
 */
export function buildSymbolScriptPrompt(
  spec: string,
  fossPid: string
): string {
  return `Convert this Symbol Specification to BOTH an AutoLISP script AND an SVG.

**FOSS_PID**: ${fossPid}
**Output Files**: Symbol.dwg, Symbol.png (from AutoLISP)

## Symbol Specification

${spec}

## Required Output

Generate TWO code blocks:

1. **AutoLISP Script** (\`\`\`lisp block):
   - Complete .scr script following the format from your instructions
   - Must end with PNGOUT and SAVEAS commands

2. **SVG Symbol** (\`\`\`svg block):
   - **CRITICAL: DO NOT use viewBox="0 0 100 100" - this is WRONG!**
   - **TRUE SCALE**: viewBox dimensions MUST match the BOUNDARY size in mm
   - Example: 84mm square boundary → viewBox="0 0 84 84"
   - Example: 163mm diameter circle → viewBox="0 0 163 163"
   - REQUIRED attributes: data-unit="mm" data-boundary-mm="BOUNDARY_SIZE"
   - Center geometry at (BOUNDARY_SIZE/2, BOUNDARY_SIZE/2)
   - Use actual mm values for all geometry - NO scaling!
   - Use hex colors matching DXF codes`
}
