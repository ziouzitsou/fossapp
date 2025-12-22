/**
 * Dimension Utilities for Symbol Generator
 *
 * Extracts and formats ETIM dimensional features from product data.
 */

import { ProductInfo, Feature } from '@/types/product'
import { DIMENSION_FEATURE_IDS, LuminaireDimensions } from './types'

/**
 * Extract numeric value from a feature
 * Handles both direct numeric values and PostgreSQL numrange format
 */
function extractNumericValue(feature: Feature): number | undefined {
  // Direct numeric value
  if (feature.fvalueN !== null && feature.fvalueN !== undefined) {
    return feature.fvalueN
  }

  // Range value - take the first value (or average if different)
  if (feature.fvalueR) {
    const match = feature.fvalueR.match(/[\[\(]?([\d.-]+),([\d.-]+)[\]\)]?/)
    if (match) {
      const lower = parseFloat(match[1])
      const upper = parseFloat(match[2])
      // If same value, return it; otherwise return average
      return lower === upper ? lower : Math.round((lower + upper) / 2)
    }
  }

  // Try fvalue_detail if it looks like a range
  if (feature.fvalue_detail && typeof feature.fvalue_detail === 'string') {
    const match = feature.fvalue_detail.match(/[\[\(]?([\d.-]+),([\d.-]+)[\]\)]?/)
    if (match) {
      const lower = parseFloat(match[1])
      const upper = parseFloat(match[2])
      return lower === upper ? lower : Math.round((lower + upper) / 2)
    }
  }

  return undefined
}

/**
 * Extract all relevant dimensions from product features
 */
export function extractDimensions(product: ProductInfo): LuminaireDimensions {
  const features = product.features || []
  const dims: LuminaireDimensions = {}

  // Helper to find feature and extract numeric value
  const getValue = (featureId: string): number | undefined => {
    const feature = features.find(f => f.FEATUREID === featureId)
    return feature ? extractNumericValue(feature) : undefined
  }

  // Helper to get string value (for alphanumeric features)
  const getStringValue = (featureId: string): string | undefined => {
    const feature = features.find(f => f.FEATUREID === featureId)
    return feature?.fvalueC_desc || undefined
  }

  // Outer dimensions
  dims.length = getValue(DIMENSION_FEATURE_IDS.LENGTH)
  dims.width = getValue(DIMENSION_FEATURE_IDS.WIDTH)
  dims.height = getValue(DIMENSION_FEATURE_IDS.HEIGHT)
  dims.outerDiameter = getValue(DIMENSION_FEATURE_IDS.OUTER_DIAMETER)

  // Built-in/cutout dimensions
  dims.builtinLength = getValue(DIMENSION_FEATURE_IDS.BUILTIN_LENGTH)
  dims.builtinWidth = getValue(DIMENSION_FEATURE_IDS.BUILTIN_WIDTH)
  dims.builtinHeight = getValue(DIMENSION_FEATURE_IDS.BUILTIN_HEIGHT)
  dims.builtinDiameter = getValue(DIMENSION_FEATURE_IDS.BUILTIN_DIAMETER)

  // Adjustability
  const adjustFeature = features.find(f => f.FEATUREID === DIMENSION_FEATURE_IDS.ADJUSTABILITY)
  if (adjustFeature) {
    dims.adjustabilityType = adjustFeature.fvalueC_desc || undefined
    dims.isAdjustable = !!(
      adjustFeature.fvalueC_desc &&
      !adjustFeature.fvalueC_desc.toLowerCase().includes('not') &&
      !adjustFeature.fvalueC_desc.toLowerCase().includes('fixed')
    )
  }

  // Beam angle
  dims.beamAngle = getStringValue(DIMENSION_FEATURE_IDS.BEAM_ANGLE)

  // Infer shape characteristics
  dims.isRound = !!(dims.outerDiameter && !dims.length && !dims.width) ||
                 !!(dims.builtinDiameter && !dims.builtinLength && !dims.builtinWidth)

  dims.isRecessed = !!(
    dims.builtinLength ||
    dims.builtinWidth ||
    dims.builtinDiameter ||
    dims.builtinHeight
  )

  // Linear detection: length significantly larger than width
  if (dims.length && dims.width) {
    dims.isLinear = dims.length > dims.width * 3
  }

  return dims
}

/**
 * Format dimensions for display in the prompt
 */
export function formatDimensionsForPrompt(dims: LuminaireDimensions): string {
  const lines: string[] = []

  // Outer dimensions section
  const outerLines: string[] = []
  if (dims.length) outerLines.push(`  - Length: ${dims.length} mm`)
  if (dims.width) outerLines.push(`  - Width: ${dims.width} mm`)
  if (dims.outerDiameter) outerLines.push(`  - Outer Diameter: ${dims.outerDiameter} mm`)
  if (dims.height) outerLines.push(`  - Height/Depth: ${dims.height} mm`)

  if (outerLines.length > 0) {
    lines.push('OUTER DIMENSIONS:')
    lines.push(...outerLines)
  }

  // Cutout/Built-in dimensions section
  const cutoutLines: string[] = []
  if (dims.builtinLength) cutoutLines.push(`  - Cutout Length: ${dims.builtinLength} mm`)
  if (dims.builtinWidth) cutoutLines.push(`  - Cutout Width: ${dims.builtinWidth} mm`)
  if (dims.builtinDiameter) cutoutLines.push(`  - Cutout Diameter: ${dims.builtinDiameter} mm`)
  if (dims.builtinHeight) cutoutLines.push(`  - Cutout Depth: ${dims.builtinHeight} mm`)

  if (cutoutLines.length > 0) {
    lines.push('')
    lines.push('CUTOUT/RECESS DIMENSIONS:')
    lines.push(...cutoutLines)
  }

  // Characteristics section
  const charLines: string[] = []
  if (dims.isAdjustable && dims.adjustabilityType) {
    charLines.push(`  - Adjustable: Yes (${dims.adjustabilityType})`)
  } else if (dims.isAdjustable) {
    charLines.push('  - Adjustable: Yes')
  }
  if (dims.beamAngle) charLines.push(`  - Beam Angle: ${dims.beamAngle}`)

  if (charLines.length > 0) {
    lines.push('')
    lines.push('CHARACTERISTICS:')
    lines.push(...charLines)
  }

  // Inferred properties
  const inferredLines: string[] = []
  if (dims.isRound) inferredLines.push('  - Shape: Circular/Round')
  if (dims.isLinear) inferredLines.push('  - Shape: Linear (elongated)')
  if (dims.isRecessed) inferredLines.push('  - Mounting: Recessed')

  if (inferredLines.length > 0) {
    lines.push('')
    lines.push('INFERRED:')
    lines.push(...inferredLines)
  }

  return lines.length > 0 ? lines.join('\n') : 'No dimension data available from ETIM features.'
}

/**
 * Format dimensions for UI display
 */
export function formatDimensionsForDisplay(dims: LuminaireDimensions): {
  outer: Array<{ label: string; value: string }>
  cutout: Array<{ label: string; value: string }>
  characteristics: Array<{ label: string; value: string }>
} {
  const outer: Array<{ label: string; value: string }> = []
  const cutout: Array<{ label: string; value: string }> = []
  const characteristics: Array<{ label: string; value: string }> = []

  // Outer
  if (dims.length) outer.push({ label: 'Length', value: `${dims.length} mm` })
  if (dims.width) outer.push({ label: 'Width', value: `${dims.width} mm` })
  if (dims.outerDiameter) outer.push({ label: 'Diameter', value: `${dims.outerDiameter} mm` })
  if (dims.height) outer.push({ label: 'Height', value: `${dims.height} mm` })

  // Cutout
  if (dims.builtinLength) cutout.push({ label: 'Length', value: `${dims.builtinLength} mm` })
  if (dims.builtinWidth) cutout.push({ label: 'Width', value: `${dims.builtinWidth} mm` })
  if (dims.builtinDiameter) cutout.push({ label: 'Diameter', value: `${dims.builtinDiameter} mm` })
  if (dims.builtinHeight) cutout.push({ label: 'Depth', value: `${dims.builtinHeight} mm` })

  // Characteristics
  if (dims.isAdjustable) {
    characteristics.push({
      label: 'Adjustable',
      value: dims.adjustabilityType || 'Yes'
    })
  }
  if (dims.beamAngle) characteristics.push({ label: 'Beam Angle', value: dims.beamAngle })
  if (dims.isRound) characteristics.push({ label: 'Shape', value: 'Circular' })
  if (dims.isLinear) characteristics.push({ label: 'Shape', value: 'Linear' })
  if (dims.isRecessed) characteristics.push({ label: 'Mounting', value: 'Recessed' })

  return { outer, cutout, characteristics }
}

/**
 * Get a list of which dimensions were provided (for logging/debugging)
 */
export function getDimensionsList(dims: LuminaireDimensions): string[] {
  const provided: string[] = []
  if (dims.length) provided.push('length')
  if (dims.width) provided.push('width')
  if (dims.height) provided.push('height')
  if (dims.outerDiameter) provided.push('outer_diameter')
  if (dims.builtinLength) provided.push('builtin_length')
  if (dims.builtinWidth) provided.push('builtin_width')
  if (dims.builtinHeight) provided.push('builtin_height')
  if (dims.builtinDiameter) provided.push('builtin_diameter')
  return provided
}
