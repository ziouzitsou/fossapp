/**
 * AutoLISP Script Generator for Tile Layouts
 *
 * Generates .scr (script) files for AutoCAD/APS to create product tile layouts.
 * Originally ported from the genlsp Node.js/Express service to TypeScript.
 *
 * The generated scripts create:
 * - Layer structure: LEGEND TILES LINE THIN/THICK (frames), IMAGES (product photos)
 * - Image insertion with DPI-aware scaling to fit tile dimensions
 * - Rectangle frames around each image
 * - MTEXT labels positioned to the right of the tile container
 *
 * @remarks
 * Scripts use AutoLISP `(command ...)` syntax for headless AutoCAD compatibility.
 * Units are set to millimeters via DWGUNITS for metric output.
 * The QUIT command at the end is required for APS Design Automation workflows.
 *
 * @module
 * @see {@link https://aps.autodesk.com/en/docs/design-automation} APS Design Automation docs
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * A single product within a tile, including its image dimensions and target size.
 *
 * @remarks
 * Images are typically 1500x1500px at 300 DPI from product catalogs.
 * The tileWidth/tileHeight define the target size in AutoCAD (mm).
 */
export interface TileMember {
  /** UUID linking to items.product_info */
  productId: string
  /** Product photo filename (JPEG/PNG) - optional if only drawing */
  imageFilename?: string
  /** Technical drawing filename (DWG) - optional if only photo */
  drawingFilename?: string
  /** Text description to appear beside the tile */
  tileText: string
  /** Source image width in pixels */
  width: number
  /** Source image height in pixels */
  height: number
  /** Image resolution (typically 300 for catalog images) */
  dpi: number
  /** Target width in AutoCAD units (mm) */
  tileWidth: number
  /** Target height in AutoCAD units (mm) */
  tileHeight: number
}

/**
 * A complete tile definition with multiple product members.
 *
 * @remarks
 * A tile is a grouped layout of products that share a common theme,
 * such as "LED Panel 600x600" variants from the same supplier.
 */
export interface TileData {
  /** Display name for the tile (e.g., "LED Panel 600x600") */
  tile: string
  /** Unique identifier for the tile record */
  tileId: string
  /** Products included in this tile layout */
  members: TileMember[]
}

/**
 * Configuration options for script generation.
 *
 * @remarks
 * All dimensions are in millimeters to match AutoCAD's metric setup.
 */
export interface ScriptSettings {
  /** Gap between tile container and text labels (default: 10mm) */
  textGap?: number
  /** AutoCAD MTEXT height for labels (default: 3mm) */
  textHeight?: number
  /** MTEXT column width for wrapping (default: 40mm) */
  textWidth?: number
  /** Custom output filename (default: tile name + .dwg) */
  outputFilename?: string
}

/**
 * Internal layout data for a single rectangle within a member.
 * @internal
 */
interface RectangleLayout {
  /** Whether this rectangle contains a photo or technical drawing */
  type: 'image' | 'drawing'
  /** Path to the image/drawing file */
  filename: string
  /** Y position from container origin (mm) */
  y: number
  /** Rectangle width (mm) */
  width: number
  /** Rectangle height (mm) */
  height: number
}

/**
 * Internal layout data for a tile member.
 * @internal
 */
interface MemberLayout {
  /** Index in the members array */
  index: number
  /** Y position where this member starts (mm) */
  startY: number
  /** Y position where this member ends (mm) */
  endY: number
  /** Rectangles to draw for this member (image + optional drawing) */
  rectangles: RectangleLayout[]
}

/**
 * Complete layout calculation result for a tile container.
 * @internal
 */
interface ContainerLayout {
  /** Container dimensions and position */
  container: {
    width: number
    height: number
    origin: { x: number; y: number }
  }
  /** Layout data for each member */
  members: MemberLayout[]
  /** Applied settings */
  settings: {
    memberSpacing: number
    textGap: number
  }
}

// ============================================================================
// IMAGE SCALING CALCULATOR
// ============================================================================

/**
 * Converts pixels to millimeters using DPI resolution.
 *
 * @remarks
 * Uses the standard formula: mm = (pixels / dpi) × 25.4
 * where 25.4 is the number of millimeters per inch.
 *
 * @param pixels - Image dimension in pixels
 * @param dpi - Dots per inch resolution (typically 300 for catalog images)
 * @returns Equivalent size in millimeters
 *
 * @example
 * ```ts
 * const widthMm = pixelsToMm(1500, 300) // 127mm (5 inches)
 * ```
 */
export function pixelsToMm(pixels: number, dpi: number): number {
  return (pixels / dpi) * 25.4
}

/**
 * Calculates AutoCAD scale factor for image insertion.
 *
 * The scale factor maps physical image size to target AutoCAD units.
 *
 * @remarks
 * Assumes standard 1500×1500 pixel catalog images.
 * Example calculation for 1500px @ 300 DPI fitting in 50mm:
 * - Physical size: 1500px ÷ 300 DPI = 5 inches = 127mm
 * - Target size: 50mm → Scale: 50 ÷ 127 = 0.3937
 *
 * @param dpi - Image resolution in dots per inch
 * @param targetSizeMm - Desired size in AutoCAD (default: 50mm)
 * @returns Scale factor for the -IMAGE ATTACH command
 */
export function calculateAutoCADScale(dpi: number, targetSizeMm: number = 50): number {
  const imageSizeInches = 1500 / dpi // Assuming 1500x1500 standard images
  const imageSizeMm = imageSizeInches * 25.4
  return targetSizeMm / imageSizeMm
}

/**
 * Calculates complete scaling information for a tile member.
 *
 * Computes physical dimensions, scaled dimensions to fit the tile,
 * AutoCAD scale factor, and centering offsets.
 *
 * @param member - Tile member with image dimensions and target size
 * @returns Scaling data including physical size, scaled size, scale factor, and offsets
 *
 * @example
 * ```ts
 * const scaling = calculateMemberScaling(member)
 * // scaling.autoCADScale → 0.3937 for standard 50mm tiles
 * // scaling.offset.x/y → centering offsets if image doesn't fill tile
 * ```
 */
export function calculateMemberScaling(member: TileMember) {
  const physicalWidth = pixelsToMm(member.width, member.dpi)
  const physicalHeight = pixelsToMm(member.height, member.dpi)

  // Calculate proportional scale to fit within target
  const scaleX = member.tileWidth / physicalWidth
  const scaleY = member.tileHeight / physicalHeight
  const scale = Math.min(scaleX, scaleY)

  const scaledWidth = physicalWidth * scale
  const scaledHeight = physicalHeight * scale

  const autoCADScale = calculateAutoCADScale(member.dpi, member.tileWidth)

  return {
    physical: { width: physicalWidth, height: physicalHeight },
    scaled: { width: scaledWidth, height: scaledHeight },
    autoCADScale,
    offset: {
      x: (member.tileWidth - scaledWidth) / 2,
      y: (member.tileHeight - scaledHeight) / 2,
    },
  }
}

/**
 * Calculates layout dimensions for the entire tile container.
 *
 * Stacks members vertically, with each member potentially having
 * multiple rectangles (image + drawing). Returns complete layout
 * data needed for script generation.
 *
 * @param members - Array of tile members to layout
 * @param settings - Optional settings for gaps and text positioning
 * @returns Complete layout with container dimensions and member positions
 *
 * @example
 * ```ts
 * const layout = calculateContainerDimensions(tileData.members, { textGap: 15 })
 * console.log(layout.container.height) // Total height in mm
 * ```
 */
export function calculateContainerDimensions(
  members: TileMember[],
  settings: ScriptSettings = {}
): ContainerLayout {
  const containerWidth = members[0]?.tileWidth || 50
  const textGap = settings.textGap || 10

  let totalHeight = 0
  const memberLayouts: MemberLayout[] = []

  members.forEach((member, index) => {
    const memberLayout: MemberLayout = {
      index,
      startY: totalHeight,
      endY: 0,
      rectangles: [],
    }

    // Add image rectangle if imageFilename exists
    if (member.imageFilename && member.imageFilename.trim() !== '') {
      memberLayout.rectangles.push({
        type: 'image',
        filename: member.imageFilename,
        y: totalHeight,
        width: member.tileWidth,
        height: member.tileHeight,
      })
      totalHeight += member.tileHeight
    }

    // Add drawing rectangle if drawingFilename exists
    if (member.drawingFilename && member.drawingFilename.trim() !== '') {
      memberLayout.rectangles.push({
        type: 'drawing',
        filename: member.drawingFilename,
        y: totalHeight,
        width: member.tileWidth,
        height: member.tileHeight,
      })
      totalHeight += member.tileHeight
    }

    memberLayout.endY = totalHeight
    memberLayouts.push(memberLayout)
  })

  return {
    container: {
      width: containerWidth,
      height: totalHeight,
      origin: { x: 0, y: 0 },
    },
    members: memberLayouts,
    settings: {
      memberSpacing: 0, // No spacing - continuous layout
      textGap,
    },
  }
}

// ============================================================================
// SCRIPT GENERATOR CLASS
// ============================================================================

/**
 * Generates AutoLISP/SCR scripts for creating tile layouts in AutoCAD.
 *
 * The class builds up a sequence of AutoCAD commands that:
 * 1. Set automation system variables (CMDECHO=0, FILEDIA=0)
 * 2. Configure millimeter units via DWGUNITS
 * 3. Create layer structure for tiles
 * 4. Insert images with proper scaling
 * 5. Draw rectangle frames
 * 6. Add text labels via MTEXT
 * 7. Save and quit (required for APS Design Automation)
 *
 * @example
 * ```ts
 * const generator = new TileScriptGenerator()
 * const script = generator.generateScript(tileData, { textGap: 15 })
 * // Write script to .scr file for APS processing
 * ```
 */
export class TileScriptGenerator {
  /** Accumulated AutoLISP commands */
  private commands: string[] = []

  /**
   * Creates a layer with specific properties.
   * @internal
   */
  private createLayer(
    layerName: string,
    color: string = '7',
    lineweight: number | null = null,
    description: string = ''
  ) {
    const cmd = `(command "layer" "make" "${layerName}" "color" "${color}" ""`

    if (lineweight !== null) {
      this.commands.push(
        `${cmd} "lw" ${lineweight} "" "d" "${description}" "${layerName}" "")`
      )
    } else {
      this.commands.push(`${cmd} "d" "${description}" "${layerName}" "")`)
    }
  }

  /**
   * Set current layer
   */
  private setCurrentLayer(layerName: string) {
    this.commands.push(`(setvar "CLAYER" "${layerName}")`)
  }

  /**
   * Add a rectangle
   */
  private addRectangle(x1: number, y1: number, x2: number, y2: number) {
    this.commands.push(`(command "RECTANG" "${x1},${y1}" "${x2},${y2}")`)
  }

  /**
   * Add multiline text
   */
  private addMText(
    x: number,
    y: number,
    height: number,
    width: number,
    text: string
  ) {
    this.commands.push(
      `(command "-MTEXT" "${x},${y}" "H" "${height}" "W" "${width}" "${text}" "")`
    )
  }

  /**
   * Add image with AutoLISP -IMAGE command
   */
  private addImage(
    imagePath: string,
    x: number,
    y: number,
    scale: number = 0.3937,
    rotation: number = 0
  ) {
    // Use double backslashes for Windows paths
    const formattedPath = imagePath.replace(/\\/g, '\\\\')
    this.commands.push(
      `(command "-IMAGE" "ATTACH" "${formattedPath}" "${x},${y}" ${scale} ${rotation})`
    )
  }

  /**
   * Set system variables for automation
   */
  private setAutomationVariables() {
    this.commands.push('(setvar "cmdecho" 0)')
    this.commands.push('(setvar "filedia" 0)')
  }

  /**
   * Set drawing units to millimeters
   * APS/AutoCAD defaults to inches, this switches to metric
   * DWGUNITS parameters: 3=mm, 2=decimal, 2=precision, Y=scale objects, Y=match INSUNITS, N=don't reset scale list
   */
  private setMetricUnits() {
    this.commands.push('(command "-DWGUNITS" 3 2 2 "Y" "Y" "N")')
  }

  /**
   * Restore system variables
   */
  private restoreSystemVariables() {
    this.commands.push('(setvar "filedia" 1)')
    this.commands.push('(setvar "cmdecho" 1)')
  }

  /**
   * Zoom to extents
   */
  private zoomExtents() {
    this.commands.push('(command "ZOOM" "E")')
    this.commands.push('(command "REGEN")')
  }

  /**
   * Save the drawing
   */
  private saveDrawing(filePath: string, version: string = '2018') {
    this.commands.push(`(command "SAVEAS" "${version}" "${filePath}")`)
  }

  /**
   * Reset current layer to default
   */
  private resetCurrentLayer() {
    this.commands.push('(setvar "CLAYER" "0")')
  }

  /**
   * Quit AutoCAD (required for APS model derivative)
   * Uses plain QUIT command (not AutoLISP wrapper)
   */
  private quitAutoCAD() {
    this.commands.push('QUIT')
  }

  /**
   * Add completion message
   */
  private addCompletionMessage() {
    this.commands.push('; End of script')
    this.commands.push('(princ)')
  }

  /**
   * Generates the complete AutoLISP script for a tile layout.
   *
   * This is the main entry point that orchestrates all script generation.
   * The generated script can be executed in AutoCAD or processed by APS
   * Design Automation to produce DWG output.
   *
   * @param tileData - Tile definition with members and metadata
   * @param settings - Optional customization for text positioning and output
   * @returns Complete script as a string, ready to write to .scr file
   *
   * @example
   * ```ts
   * const script = generator.generateScript(tileData)
   * await fs.writeFile('output.scr', script)
   * ```
   */
  generateScript(tileData: TileData, settings: ScriptSettings = {}): string {
    this.commands = [] // Reset

    // 1. Set system variables for automation
    this.setAutomationVariables()

    // 2. Set drawing units to millimeters (APS defaults to inches)
    this.setMetricUnits()

    // 3. Calculate container dimensions and layout
    const layout = calculateContainerDimensions(tileData.members, settings)

    // 4. Create layers
    this.createLayer('LEGEND TILES LINE THIN', '10', 0.3, 'Inner Tiles Style')
    this.createLayer('LEGEND TILES LINE THICK', '10', 0.5, 'Inner Tiles Style')
    this.createLayer('LEGEND TILES IMAGES', '7', null, 'Tiles Images Style')

    // 5. Process each member - images first, then rectangles
    layout.members.forEach((memberLayout, memberIndex) => {
      const member = tileData.members[memberIndex]

      memberLayout.rectangles.forEach((rect) => {
        // Add image first (background layer)
        if (rect.filename) {
          this.setCurrentLayer('LEGEND TILES IMAGES')

          const scalingInfo = calculateMemberScaling(member)

          this.addImage(
            rect.filename,
            layout.container.origin.x + scalingInfo.offset.x,
            layout.container.origin.y + rect.y + scalingInfo.offset.y,
            scalingInfo.autoCADScale,
            0
          )
        }

        // Add rectangle on top (frame layer)
        this.setCurrentLayer('LEGEND TILES LINE THIN')
        this.addRectangle(
          layout.container.origin.x,
          layout.container.origin.y + rect.y,
          layout.container.origin.x + rect.width,
          layout.container.origin.y + rect.y + rect.height
        )
      })
    })

    // 6. Create container rectangle (thick line)
    this.setCurrentLayer('LEGEND TILES LINE THICK')
    this.addRectangle(
      layout.container.origin.x,
      layout.container.origin.y,
      layout.container.origin.x + layout.container.width,
      layout.container.origin.y + layout.container.height
    )

    // 7. Add tile text using MTEXT
    const textX =
      layout.container.origin.x +
      layout.container.width +
      layout.settings.textGap

    tileData.members.forEach((member, index) => {
      const memberLayout = layout.members[index]
      // Position text at the top of the member
      const memberTextY =
        layout.container.origin.y + memberLayout.endY - 5 // 5mm offset from top

      this.addMText(
        textX,
        memberTextY,
        settings.textHeight || 3,
        settings.textWidth || 40,
        member.tileText
      )
    })

    // 8. Zoom to extents
    this.zoomExtents()

    // 9. Reset current layer
    this.resetCurrentLayer()

    // 10. Save the drawing
    const outputFilename = settings.outputFilename || `${tileData.tile}.dwg`
    this.saveDrawing(outputFilename)

    // 11. Restore system variables
    this.restoreSystemVariables()

    // 12. Quit AutoCAD cleanly for APS
    this.quitAutoCAD()

    return this.commands.join('\n')
  }
}

/**
 * Generates a tile script using default TileScriptGenerator instance.
 *
 * This is a convenience wrapper around {@link TileScriptGenerator.generateScript}
 * for simple one-off script generation without managing class instances.
 *
 * @param tileData - Tile definition with members and metadata
 * @param settings - Optional customization settings
 * @returns Complete AutoLISP script as a string
 *
 * @example
 * ```ts
 * const script = generateTileScript(tileData, { textGap: 15 })
 * ```
 */
export function generateTileScript(
  tileData: TileData,
  settings: ScriptSettings = {}
): string {
  const generator = new TileScriptGenerator()
  return generator.generateScript(tileData, settings)
}

/**
 * Generates a preview of the tile script without the full command output.
 *
 * Returns layout information useful for displaying to users before
 * committing to full script generation and APS processing.
 *
 * @param tileData - Tile definition to preview
 * @param settings - Optional settings that affect layout
 * @returns Preview object with dimensions, member count, and layer names
 *
 * @example
 * ```ts
 * const preview = previewTileScript(tileData)
 * console.log(`Container: ${preview.container.width}x${preview.container.height}mm`)
 * console.log(`Members: ${preview.memberCount}`)
 * ```
 */
export function previewTileScript(tileData: TileData, settings: ScriptSettings = {}) {
  const layout = calculateContainerDimensions(tileData.members, settings)

  return {
    tileName: tileData.tile,
    tileId: tileData.tileId,
    memberCount: tileData.members.length,
    container: {
      width: layout.container.width,
      height: layout.container.height,
    },
    members: layout.members.map((m, i) => ({
      productId: tileData.members[i].productId,
      rectangleCount: m.rectangles.length,
      startY: m.startY,
      endY: m.endY,
    })),
    layers: [
      'LEGEND TILES LINE THIN',
      'LEGEND TILES LINE THICK',
      'LEGEND TILES IMAGES',
    ],
  }
}
