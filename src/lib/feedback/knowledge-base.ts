/**
 * FOSSAPP Knowledge Base
 *
 * Structured knowledge about app features for the feedback assistant.
 * UPDATE THIS FILE when new features are added or changed.
 *
 * The assistant will ONLY know what's documented here - this prevents
 * hallucinating features that don't exist.
 */

export interface FeatureKnowledge {
  name: string
  description: string
  capabilities: string[]
  limitations?: string[]
  howTo?: Record<string, string>
  statuses?: Record<string, string>
}

export interface KnowledgeBase {
  appName: string
  appDescription: string
  lastUpdated: string
  features: Record<string, FeatureKnowledge>
  commonQuestions: Record<string, string>
}

export const FOSSAPP_KNOWLEDGE: KnowledgeBase = {
  appName: 'FOSSAPP',
  appDescription: 'Lighting product database for Foss SA lighting designers in Athens, Greece. Contains 56,000+ products from multiple suppliers.',
  lastUpdated: '2025-12-23',

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
  },

  commonQuestions: {
    'how to search': 'Go to Products page and use the search bar. You can search by product name, description, family, or product ID (like DT102149200B).',
    'how to add to project': 'First make sure you have an active project selected (shown in the header). Then on any product, click "Add to Project".',
    'what is ETIM': 'ETIM (European Technical Information Model) is a standardized classification system for technical products. Each product has an ETIM class and features that describe its specifications.',
    'change product status': 'Currently, product status in projects is fixed at "specified". Status workflow features are planned for a future update.',
    'export project': 'Project export features are available through the project actions menu. You can export product lists and specifications.',
  },
}

/**
 * Generate a knowledge summary for the system prompt
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

  return summary
}

/**
 * Get detailed info about a specific feature
 */
export function getFeatureInfo(featureKey: string): FeatureKnowledge | null {
  return FOSSAPP_KNOWLEDGE.features[featureKey] || null
}
