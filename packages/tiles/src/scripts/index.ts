/**
 * @fossapp/tiles/scripts
 * AutoLISP Script Generator for Tiles
 * Ported from genlsp (Node.js/Express) to TypeScript
 *
 * Generates .scr files for AutoCAD to create tile layouts with:
 * - Layer management (LEGEND TILES LINE THIN/THICK, IMAGES)
 * - Image insertion with proper scaling
 * - Rectangle frames around images
 * - Text labels positioned to the right
 */

// Types
export interface TileMember {
  productId: string
  imageFilename?: string
  drawingFilename?: string
  tileText: string
  width: number      // pixels
  height: number     // pixels
  dpi: number        // dots per inch
  tileWidth: number  // mm (target width in AutoCAD)
  tileHeight: number // mm (target height in AutoCAD)
}

export interface TileData {
  tile: string
  tileId: string
  members: TileMember[]
}

export interface ScriptSettings {
  textGap?: number       // mm gap between container and text (default: 10)
  textHeight?: number    // AutoCAD text height (default: 3)
  textWidth?: number     // MTEXT width (default: 40)
  outputFilename?: string
}

interface RectangleLayout {
  type: 'image' | 'drawing'
  filename: string
  y: number
  width: number
  height: number
}

interface MemberLayout {
  index: number
  startY: number
  endY: number
  rectangles: RectangleLayout[]
}

interface ContainerLayout {
  container: {
    width: number
    height: number
    origin: { x: number; y: number }
  }
  members: MemberLayout[]
  settings: {
    memberSpacing: number
    textGap: number
  }
}

// ============================================================================
// Image Scaling Calculator
// ============================================================================

/**
 * Convert pixels to millimeters using DPI
 * Formula: (pixels / dpi) * 25.4 (mm per inch)
 */
export function pixelsToMm(pixels: number, dpi: number): number {
  return (pixels / dpi) * 25.4
}

/**
 * Calculate AutoCAD scale factor for image insertion
 * For 1500x1500 @ 300 DPI fitting in 50mm squares:
 * Physical size: 1500px / 300 DPI = 5 inches = 127mm
 * Target size: 50mm -> Scale: 50 / 127 = 0.3937
 */
export function calculateAutoCADScale(dpi: number, targetSizeMm: number = 50): number {
  const imageSizeInches = 1500 / dpi // Assuming 1500x1500 standard images
  const imageSizeMm = imageSizeInches * 25.4
  return targetSizeMm / imageSizeMm
}

/**
 * Calculate scaling information for a tile member
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
 * Calculate container dimensions for all members
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
// Script Generator Class
// ============================================================================

export class TileScriptGenerator {
  private commands: string[] = []

  /**
   * Create a layer with specific properties
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
   * Generate the complete tile script
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
 * Convenience function to generate a script
 */
export function generateTileScript(
  tileData: TileData,
  settings: ScriptSettings = {}
): string {
  const generator = new TileScriptGenerator()
  return generator.generateScript(tileData, settings)
}

/**
 * Generate script preview (returns info without full script)
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
