/**
 * FOSSAPP Knowledge Base
 *
 * Structured knowledge about app features for the feedback assistant.
 * This is the SINGLE SOURCE OF TRUTH for what the AI knows about FOSSAPP.
 *
 * @remarks
 * **IMPORTANT**: UPDATE THIS FILE when new features are added or changed!
 * The assistant will ONLY know what's documented here - this prevents
 * hallucinating features that don't exist.
 *
 * When adding a new feature:
 * 1. Add entry to `features` object with name, description, capabilities
 * 2. Add `limitations` if something is intentionally not supported
 * 3. Add `howTo` for common user actions
 * 4. Add `statuses` if the feature has workflow states
 * 5. Update `commonQuestions` if users frequently ask about it
 *
 * @module feedback/knowledge-base
 * @see src/lib/feedback/knowledge-base.ts in project for updates
 */

/**
 * Knowledge about a single FOSSAPP feature
 *
 * @remarks
 * Each feature entry provides context for the AI to accurately
 * answer user questions without inventing non-existent functionality.
 */
export interface FeatureKnowledge {
  /** Display name of the feature */
  name: string
  /** Brief description of what the feature does */
  description: string
  /** List of things users CAN do with this feature */
  capabilities: string[]
  /** List of things that are NOT supported (prevents hallucination) */
  limitations?: string[]
  /** Step-by-step instructions for common actions (key: action name) */
  howTo?: Record<string, string>
  /** Available status values and their meanings (for workflow features) */
  statuses?: Record<string, string>
}

/**
 * Complete knowledge base structure
 *
 * @remarks
 * Organized to provide the AI with:
 * - Feature details (what the app can do)
 * - Common Q&A (quick answers to frequent questions)
 * - Product vocabulary (search term mappings and categories)
 */
export interface KnowledgeBase {
  /** Application name */
  appName: string
  /** One-line app description */
  appDescription: string
  /** Last update date (YYYY-MM-DD) - update when content changes */
  lastUpdated: string
  /** Feature entries keyed by feature ID */
  features: Record<string, FeatureKnowledge>
  /** Quick answers to common questions (key: question phrase) */
  commonQuestions: Record<string, string>
  /** Product search vocabulary for better results */
  productVocabulary: {
    /** Tips for effective searching */
    searchTips: string[]
    /** User term → database terms mapping */
    synonyms: Record<string, string[]>
    /** ETIM category names with product counts */
    categories: Record<string, string>
  }
}

export const FOSSAPP_KNOWLEDGE: KnowledgeBase = {
  appName: 'FOSSAPP',
  appDescription: 'Lighting product database for Foss SA lighting designers in Athens, Greece. Contains 56,000+ products from multiple suppliers.',
  lastUpdated: '2025-12-28',

  features: {
    products: {
      name: 'Product Search',
      description: 'Search and browse the lighting product database',
      capabilities: [
        'Search by keyword (description, family, product ID)',
        'Filter by supplier, ETIM class, features',
        'View detailed specifications and ETIM classification',
        'View product images and datasheets',
        'Add products to projects',
      ],
      limitations: [
        'Products are read-only - cannot edit product data',
        'Product data comes from supplier catalogs',
      ],
      howTo: {
        'search': 'Use the search bar at the top of the Products page. Type keywords like product name, family, or ID.',
        'filter': 'Use the filter panel on the left side to narrow results by supplier, ETIM class, or specifications.',
        'addToProject': 'Click the "Add to Project" button on a product card to add it to your active project.',
      },
    },

    projects: {
      name: 'Projects',
      description: 'Manage lighting design projects with areas, phases, and product selections',
      capabilities: [
        'Create and manage projects with customer association',
        'Organize projects into phases and areas',
        'Add products to project areas with quantities',
        'Track project status through workflow stages',
        'Generate project documentation',
      ],
      statuses: {
        'draft': 'Initial project state, still being set up',
        'quotation': 'Project is in quotation phase',
        'approved': 'Project has been approved by client',
        'in_progress': 'Project is actively being worked on',
        'completed': 'Project has been finished',
        'cancelled': 'Project was cancelled',
        'on_hold': 'Project is temporarily paused',
      },
      howTo: {
        'createProject': 'Click "New Project" button on the Projects page. Fill in project details and associate a customer.',
        'addProducts': 'Open a project, navigate to an area, and use "Add Product" to search and add products.',
        'changeQuantity': 'Click on the quantity field in the product table and type the new number.',
      },
    },

    projectProducts: {
      name: 'Project Products',
      description: 'Products added to project areas',
      capabilities: [
        'Add products from the database to project areas',
        'Set quantities for each product',
        'View product details within project context',
      ],
      limitations: [
        'Product status is currently fixed at "specified" - status changes are not yet implemented',
        'No bulk import of products yet',
      ],
      statuses: {
        'specified': 'Product has been specified for the project (currently the only status)',
      },
      howTo: {
        'changeQuantity': 'Click directly on the quantity number in the table. The field becomes editable. Type the new quantity and click outside or press Enter.',
      },
    },

    tiles: {
      name: 'Tiles',
      description: 'Generate product specification tiles (images) for presentations',
      capabilities: [
        'Generate visual product tiles with key specifications',
        'Download tiles as images',
        'Batch generate multiple tiles',
      ],
      howTo: {
        'generate': 'Search for a product, then click "Generate Tile" button. The tile will be created and can be downloaded.',
      },
    },

    playground: {
      name: 'Playground',
      description: 'Generate AutoCAD DWG blocks for lighting symbols',
      capabilities: [
        'Generate DWG blocks from product data',
        'Customize symbol appearance',
        'Download DWG files for AutoCAD',
      ],
      howTo: {
        'generate': 'Select a product and configure the symbol options, then click Generate to create the DWG file.',
      },
    },

    symbolGenerator: {
      name: 'Symbol Generator',
      description: 'Create lighting symbols from product images or drawings',
      capabilities: [
        'Upload product images or technical drawings',
        'AI-powered symbol extraction',
        'Generate clean vector symbols',
        'Download as DWG for AutoCAD',
      ],
      howTo: {
        'upload': 'Drag and drop an image or click to browse. The AI will analyze and generate a symbol.',
      },
    },

    planner: {
      name: 'Planner',
      description: 'Visual lighting layout planner with 3D viewer',
      capabilities: [
        'Upload floor plans',
        'Place lighting fixtures on plans',
        'View 3D visualization',
        'Calculate lighting levels',
      ],
      limitations: [
        'Currently in beta - some features still in development',
      ],
    },

    settings: {
      name: 'Settings',
      description: 'Application settings and configuration',
      capabilities: [
        'View symbol classification rules (A-P letter codes)',
        'See how products are categorized for drawings',
        'Understand ETIM class to symbol mappings',
      ],
      howTo: {
        'viewSymbols': 'Go to Settings > Symbols to see the classification rules that assign letter codes to products.',
        'symbolMeaning': 'Symbols are assigned based on ETIM class and IP rating. A=Interior Spots, B=Suspension, C=Exterior Spots, etc.',
      },
    },

    symbolClassification: {
      name: 'Symbol Classification',
      description: 'Automatic product classification system using letter codes (A-P) for lighting design drawings',
      capabilities: [
        'Automatic symbol assignment based on ETIM class',
        'IP rating differentiation (indoor vs outdoor)',
        'Rule priority system for special cases',
        'View all classification rules in Settings',
      ],
      limitations: [
        'Rules are currently read-only (admin-managed)',
        'Not all ETIM classes have symbol mappings yet',
      ],
      howTo: {
        'viewRules': 'Go to Settings > Symbols to see all classification rules.',
        'understand': 'Products get symbols like A (Interior Spots), B (Suspension), C (Exterior Spots) based on their ETIM class and IP rating.',
      },
    },
  },

  commonQuestions: {
    'how to search': 'Go to Products page and use the search bar. You can search by product name, description, family, or product ID (like DT102149200B).',
    'how to add to project': 'First make sure you have an active project selected (shown in the header). Then on any product, click "Add to Project".',
    'what is ETIM': 'ETIM (European Technical Information Model) is a standardized classification system for technical products. Each product has an ETIM class and features that describe its specifications.',
    'change product status': 'Currently, product status in projects is fixed at "specified". Status workflow features are planned for a future update.',
    'export project': 'Project export features are available through the project actions menu. You can export product lists and specifications.',
    'what are symbols': 'Symbols are letter codes (A-P) assigned to products for use in lighting design drawings. A=Interior Spots, B=Suspension, C=Exterior Spots, etc. View all rules at Settings > Symbols.',
    'symbol classification': 'Products are automatically classified based on their ETIM class and IP rating. For example, downlights with IP<54 get symbol A (Interior), while IP>=54 get symbol C (Exterior).',
  },

  // Product vocabulary helps the assistant understand user terminology
  productVocabulary: {
    searchTips: [
      'Search also covers description_long (technical specs) and class_name (ETIM categories)',
      'For CCT/color temperature, try "3000K", "4000K", "2700K" or "warm white"',
      'For brightness, include "lm" or specific values like "2000lm"',
      'Product families: BOXY, ENTERO, MONOSPOT, SUPERLIGHT, FLUXA (Delta Light); ECOLINE, LOGIC (Meyer)',
    ],
    synonyms: {
      // User term -> what to actually search
      spotlight: ['spot', 'monospot', 'metaspot', 'nightspot'],
      downlight: ['downlight', 'recessed', 'ceiling recessed'],
      'wall light': ['wall', 'wall-mounted', 'wallwash'],
      pendant: ['pendant', 'suspended', 'hanging'],
      'track light': ['track', 'rail', 'light-track'],
      outdoor: ['outdoor', 'IP65', 'IP67', 'exterior', 'garden'],
      bathroom: ['IP44', 'IP65', 'wet area'],
      dimmable: ['dimmable', 'DIM5', 'DIM8', 'phase cut'],
      'LED strip': ['strip', 'ribbon', 'tape', 'linear'],
    },
    categories: {
      // ETIM class names for reference
      'Downlight/spot/floodlight': '13,607 products - includes spots, downlights, floodlights',
      'Ceiling-/wall luminaire': '4,184 products - surface mounted ceiling and wall lights',
      'Pendant luminaire': '1,090 products - hanging/suspended lights',
      'In-ground luminaire': '2,265 products - recessed ground lights, uplights',
      'Light-track': '59 products - track lighting systems',
      'Luminaire bollard': '222 products - outdoor path/garden bollards',
    },
  },
}

/**
 * Generate a markdown summary of the knowledge base for the AI system prompt
 *
 * @remarks
 * This summary is injected into the AI's system prompt so it knows
 * what features exist, their capabilities, limitations, and common Q&A.
 *
 * The summary is formatted for AI consumption:
 * - Features grouped with capabilities and limitations
 * - Quick answers section for common questions
 * - Product search vocabulary for better tool use
 *
 * @returns Markdown-formatted knowledge base summary
 */
export function generateKnowledgeSummary(): string {
  const kb = FOSSAPP_KNOWLEDGE

  let summary = `## FOSSAPP Knowledge Base (Updated: ${kb.lastUpdated})\n\n`

  // Features
  summary += '### Features\n'
  for (const [key, feature] of Object.entries(kb.features)) {
    summary += `\n**${feature.name}**: ${feature.description}\n`

    if (feature.capabilities.length > 0) {
      summary += 'Can do: ' + feature.capabilities.slice(0, 3).join(', ')
      if (feature.capabilities.length > 3) summary += ', ...'
      summary += '\n'
    }

    if (feature.limitations && feature.limitations.length > 0) {
      summary += '⚠️ Limitations: ' + feature.limitations.join('; ') + '\n'
    }

    if (feature.statuses) {
      summary += 'Statuses: ' + Object.keys(feature.statuses).join(', ') + '\n'
    }
  }

  // Common questions
  summary += '\n### Quick Answers\n'
  for (const [question, answer] of Object.entries(kb.commonQuestions)) {
    summary += `- **${question}**: ${answer}\n`
  }

  // Product vocabulary for better search
  summary += '\n### Product Search Vocabulary\n'
  summary += 'When users search for products, use these mappings:\n'
  for (const [userTerm, dbTerms] of Object.entries(kb.productVocabulary.synonyms)) {
    summary += `- "${userTerm}" → try: ${dbTerms.join(', ')}\n`
  }
  summary += '\nProduct categories (ETIM classes):\n'
  for (const [category, description] of Object.entries(kb.productVocabulary.categories)) {
    summary += `- ${category}: ${description}\n`
  }
  summary += '\nSearch tips:\n'
  for (const tip of kb.productVocabulary.searchTips) {
    summary += `- ${tip}\n`
  }

  return summary
}

/**
 * Get detailed info about a specific feature
 *
 * @param featureKey - Feature identifier (e.g., 'products', 'projects', 'tiles')
 * @returns Feature knowledge or null if not found
 */
export function getFeatureInfo(featureKey: string): FeatureKnowledge | null {
  return FOSSAPP_KNOWLEDGE.features[featureKey] || null
}
