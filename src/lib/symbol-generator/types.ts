/**
 * Symbol Generator Types
 *
 * Types for the AutoCAD plan-view symbol generation feature.
 * Uses ETIM dimensional features to describe luminaire geometry.
 */

import { ProductInfo } from '@fossapp/products/types'

// Key ETIM Feature IDs for luminaire dimensions
export const DIMENSION_FEATURE_IDS = {
  // Outer dimensions
  LENGTH: 'EF001438',
  WIDTH: 'EF000008',
  HEIGHT: 'EF001456',
  OUTER_DIAMETER: 'EF000015',

  // Built-in/cutout dimensions (for recessed fixtures)
  BUILTIN_LENGTH: 'EF023168',
  BUILTIN_WIDTH: 'EF011933',
  BUILTIN_HEIGHT: 'EF010795',
  BUILTIN_DIAMETER: 'EF009348',

  // Characteristics
  ADJUSTABILITY: 'EF009351',
  BEAM_ANGLE: 'EF008157',
  MOUNTING_TYPE: 'EF007793', // Suitable for surface mounting
  RECESSED_MOUNTING: 'EF007794', // Suitable for recessed mounting
} as const

// Extracted dimensions from ETIM features
export interface LuminaireDimensions {
  // Outer boundary
  length?: number
  width?: number
  height?: number
  outerDiameter?: number

  // Cutout/recess (for recessed fixtures)
  builtinLength?: number
  builtinWidth?: number
  builtinHeight?: number
  builtinDiameter?: number

  // Characteristics
  isAdjustable?: boolean
  adjustabilityType?: string  // e.g., "Rotating and swivelling"
  beamAngle?: string         // e.g., "21-40° - Medium beam"

  // Inferred properties
  isRound?: boolean
  isRecessed?: boolean
  isLinear?: boolean
}

// Request to analyze a product for symbol generation
export interface SymbolAnalysisRequest {
  product: ProductInfo
  dimensions: LuminaireDimensions
  imageUrl?: string      // MD02 (preferred) or MD01 product photo URL
  drawingUrl?: string    // MD64 (preferred) or MD12 technical drawing URL
}

// Result from vision analysis
export interface VisionAnalysisResult {
  success: boolean
  description?: string   // Raw text description from LLM
  error?: string

  // Metadata
  model: string
  tokensIn: number
  tokensOut: number
  costUsd: number
  processingTimeMs: number

  // Input info (for debugging)
  hadImage: boolean
  hadDrawing: boolean
  dimensionsProvided: string[]
}

// OpenRouter API types for vision
export interface VisionContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string  // Can be URL or data:image/...;base64,...
  }
}

export interface VisionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | VisionContentPart[]
}

export interface OpenRouterVisionResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
  }
}

// Pricing for cost calculation
export const VISION_MODEL_PRICING = {
  'anthropic/claude-sonnet-4': { input: 3.0, output: 15.0 },  // $ per 1M tokens
  'anthropic/claude-3.5-sonnet': { input: 3.0, output: 15.0 },
  'anthropic/claude-opus-4': { input: 15.0, output: 75.0 },
} as const

// Default model for vision analysis
export const DEFAULT_VISION_MODEL = 'anthropic/claude-sonnet-4'
