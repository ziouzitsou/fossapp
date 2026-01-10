/**
 * AutoLISP Script Generator for Case Study XREF DWG Output
 *
 * Generates .scr (script) files for APS Design Automation to create
 * floor plan DWGs with luminaire symbols attached as XREFs.
 *
 * @remarks
 * Key technique: The script uses Google Drive paths for XREF attachment,
 * but APS downloads the actual files from Supabase URLs. AutoCAD finds
 * files by filename in its working directory and stores the full path
 * we specify in the XREF record. When users open locally, XREFs resolve
 * via their synced Google Drive.
 *
 * @module
 * @see {@link https://aps.autodesk.com/en/docs/design-automation} APS Design Automation docs
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single XREF placement on the floor plan.
 *
 * @remarks
 * Coordinates are in DWG model space (millimeters).
 * Mirror flags use scale factors: -1 for mirrored, 1 for normal.
 */
export interface XrefPlacement {
  /** FOSS product ID (e.g., "DT107479228WW") */
  fossPid: string
  /** Google Drive path for XREF record (the "lie" that resolves locally) */
  localPath: string
  /** DWG X coordinate in millimeters */
  worldX: number
  /** DWG Y coordinate in millimeters */
  worldY: number
  /** Rotation angle in degrees (0-360) */
  rotation: number
  /** Horizontal mirror - uses X scale = -1 */
  mirrorX: boolean
  /** Vertical mirror - uses Y scale = -1 */
  mirrorY: boolean
  /** Symbol label for comment (e.g., "A1", "B2") */
  symbol?: string
}

/**
 * Configuration options for script generation.
 */
export interface XrefScriptOptions {
  /** Output filename (e.g., "A01-GENERATED.dwg") */
  outputFilename: string
  /** AutoCAD DWG version for SAVEAS (default: "2018") */
  dwgVersion?: string
  /** Area code for header comment */
  areaCode?: string
  /** Revision number for header comment */
  revisionNumber?: number
}

// ============================================================================
// SCRIPT GENERATOR CLASS
// ============================================================================

/**
 * Generates AutoLISP scripts for XREF-based DWG output.
 *
 * @remarks
 * The generator accumulates commands and outputs a complete .scr file
 * compatible with APS Design Automation's accoreconsole.exe.
 *
 * @example
 * ```ts
 * const generator = new XrefScriptGenerator()
 * const script = generator.generateScript(placements, {
 *   outputFilename: 'F1-GENERATED.dwg',
 *   areaCode: 'F1',
 *   revisionNumber: 1
 * })
 * ```
 */
export class XrefScriptGenerator {
  private commands: string[] = []

  /**
   * Generate the complete AutoLISP script for XREF attachment.
   *
   * @param placements - Array of XREF placements with positions and paths
   * @param options - Script configuration options
   * @returns Complete .scr file content
   */
  generateScript(placements: XrefPlacement[], options: XrefScriptOptions): string {
    this.commands = []
    const dwgVersion = options.dwgVersion || '2018'

    // Header comment
    this.addComment('============================================================================')
    this.addComment('FOSSAPP Case Study XREF Generation Script')
    this.addComment(`Generated: ${new Date().toISOString()}`)
    if (options.areaCode) {
      this.addComment(`Area: ${options.areaCode}${options.revisionNumber ? ` v${options.revisionNumber}` : ''}`)
    }
    this.addComment(`Placements: ${placements.length}`)
    this.addComment('============================================================================')
    this.addBlankLine()

    // 1. Set automation variables (disable dialogs for headless operation)
    this.setAutomationVariables()
    this.addBlankLine()

    // 2. Create dedicated layer for symbols
    this.createXrefLayer()
    this.addBlankLine()

    // 3. Attach each symbol as XREF
    if (placements.length > 0) {
      this.addComment('Attach XREFs')
      for (const placement of placements) {
        this.attachXref(placement)
      }
      this.addBlankLine()
    }

    // 4. Zoom to extents and regenerate
    this.zoomExtents()
    this.addBlankLine()

    // 5. Reset layer to 0
    this.resetLayer()
    this.addBlankLine()

    // 6. Save drawing
    this.saveDrawing(options.outputFilename, dwgVersion)
    this.addBlankLine()

    // 7. Restore variables and quit
    this.restoreAndQuit()

    return this.commands.join('\n')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Add a comment line to the script
   */
  private addComment(text: string): void {
    this.commands.push(`; ${text}`)
  }

  /**
   * Add a blank line for readability
   */
  private addBlankLine(): void {
    this.commands.push('')
  }

  /**
   * Set system variables for headless AutoCAD operation.
   *
   * @remarks
   * - cmdecho=0: Suppress command echoing
   * - filedia=0: Disable file dialogs
   */
  private setAutomationVariables(): void {
    this.addComment('Set automation variables')
    this.commands.push('(setvar "cmdecho" 0)')
    this.commands.push('(setvar "filedia" 0)')
  }

  /**
   * Create a dedicated layer for XREF symbols.
   */
  private createXrefLayer(): void {
    this.addComment('Create XREF layer')
    // Create layer, set color to white (7), add description
    this.commands.push(
      '(command "layer" "make" "CASE_STUDY_SYMBOLS" "color" "7" "" "d" "Generated symbol placements" "CASE_STUDY_SYMBOLS" "")'
    )
    // Set as current layer
    this.commands.push('(setvar "CLAYER" "CASE_STUDY_SYMBOLS")')
  }

  /**
   * Attach a symbol DWG as an XREF at the specified position.
   *
   * @remarks
   * -XREF Attach command syntax:
   * (command "-XREF" "Attach" "path" "x,y,z" xScale yScale rotation)
   *
   * Mirror is achieved via negative scale factors:
   * - mirrorX: xScale = -1
   * - mirrorY: yScale = -1
   *
   * @param placement - XREF placement data
   */
  private attachXref(placement: XrefPlacement): void {
    // Use forward slashes for path (AutoCAD accepts both, easier to escape)
    const path = placement.localPath.replace(/\\/g, '/')

    // Calculate scale factors (mirror uses -1)
    const xScale = placement.mirrorX ? -1 : 1
    const yScale = placement.mirrorY ? -1 : 1

    // Format coordinates with 1 decimal place (0.1mm precision)
    const x = placement.worldX.toFixed(1)
    const y = placement.worldY.toFixed(1)
    const rotation = placement.rotation.toFixed(1)

    // Add comment with symbol and position info
    const mirrorInfo = []
    if (placement.mirrorX) mirrorInfo.push('mirrorX')
    if (placement.mirrorY) mirrorInfo.push('mirrorY')
    const mirrorStr = mirrorInfo.length > 0 ? ` [${mirrorInfo.join(', ')}]` : ''

    this.addComment(
      `Symbol: ${placement.symbol || '?'} (${placement.fossPid}) at (${x}, ${y}) rotation ${rotation}°${mirrorStr}`
    )

    // -XREF Attach command
    // Format: "path" "x,y,z" xScale yScale rotation
    this.commands.push(
      `(command "-XREF" "Attach" "${path}" "${x},${y},0" "${xScale}" "${yScale}" "${rotation}")`
    )
  }

  /**
   * Zoom to show all content and regenerate display.
   */
  private zoomExtents(): void {
    this.addComment('Zoom to extents')
    this.commands.push('(command "ZOOM" "E")')
    this.commands.push('(command "REGEN")')
  }

  /**
   * Reset current layer to 0.
   */
  private resetLayer(): void {
    this.addComment('Reset layer')
    this.commands.push('(setvar "CLAYER" "0")')
  }

  /**
   * Save the drawing to specified filename.
   *
   * @param filename - Output filename (just the name, not path)
   * @param version - AutoCAD version string (e.g., "2018")
   */
  private saveDrawing(filename: string, version: string): void {
    this.addComment('Save drawing')
    this.commands.push(`(command "SAVEAS" "${version}" "${filename}")`)
  }

  /**
   * Restore system variables and quit AutoCAD.
   *
   * @remarks
   * QUIT command must be plain text (not wrapped in command) for APS compatibility.
   */
  private restoreAndQuit(): void {
    this.addComment('Restore variables')
    this.commands.push('(setvar "filedia" 1)')
    this.commands.push('(setvar "cmdecho" 1)')
    this.addBlankLine()
    this.addComment('Quit (required for APS Design Automation)')
    this.commands.push('QUIT')
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the filename from a full path.
 *
 * @param path - Full file path (Windows or Unix style)
 * @returns Just the filename
 *
 * @example
 * ```ts
 * getFilename('F:/Shared drives/HUB/SYMBOLS/DT123/DT123-SYMBOL.dwg')
 * // → 'DT123-SYMBOL.dwg'
 * ```
 */
export function getFilename(path: string): string {
  // Handle both Windows and Unix paths
  const parts = path.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1]
}
