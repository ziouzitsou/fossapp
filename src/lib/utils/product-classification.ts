import { ProductInfo, TemplateType } from '@fossapp/products/types';

// Define class-to-template mappings based on ETIM classification
const LUMINAIRE_CLASSES = [
  'EC001744', // Downlight/spot/floodlight (5794 products)
  'EC002892', // Ceiling-/wall luminaire (1566 products)
  'EC001743', // Pendant luminaire (1090 products)
  'EC000758', // In-ground luminaire (452 products)
  'EC000109', // Batten luminaire (246 products)
  'EC000301', // Luminaire bollard (222 products)
  'EC000481', // Orientation luminaire (85 products)
  'EC000062', // Street luminaire (60 products)
  'EC000300', // Floor luminaire (56 products)
  'EC002706', // Light ribbon/-hose/-strip (56 products)
  'EC000302', // Table luminaire
];

const ACCESSORY_CLASSES = [
  'EC002710', // LED driver (83 products)
  'EC002557', // Mechanical accessories (543 products)
  'EC002558', // Light technical accessories (221 products)
  'EC002556', // Electrical accessories (211 products)
  'EC004966', // Profile for light ribbon (65 products)
  'EC000533', // Lighting control system component (60 products)
  'EC002955', // Accessories for LED drivers
  'EC002707', // Accessories for light ribbon
  'EC000414', // Built-in installation box
  'EC000471', // Emergency unit
  'EC000401', // Lamp holder
  'EC000061', // Light pole (44 products)
];

const LIGHTLINE_CLASSES = [
  'EC000986', // Electrical unit for light-line system (3692 products!)
  'EC000293', // Support profile light-line system (190 products)
  'EC000101', // Light-track (59 products)
];

/**
 * Determines the appropriate display template based on product classification
 * @param product - The product information from the database
 * @returns The template type to use for display
 */
export function getTemplateType(product: ProductInfo): TemplateType {
  const classId = product.class;
  const groupId = product.group;

  // Class-based selection (most specific)
  if (LUMINAIRE_CLASSES.includes(classId)) {
    return 'luminaire';
  }

  if (ACCESSORY_CLASSES.includes(classId)) {
    return 'accessory';
  }

  if (LIGHTLINE_CLASSES.includes(classId)) {
    return 'lightline';
  }

  // Group-based fallback
  if (groupId === 'EG000027') {
    return 'luminaire'; // Default luminaires group to luminaire template
  }

  if (groupId === 'EG000030') {
    return 'accessory'; // Default accessories group to accessory template
  }

  // Generic fallback for edge cases
  return 'generic';
}

/**
 * Gets a human-readable description of the template type
 * @param templateType - The template type
 * @returns Description of what the template is for
 */
export function getTemplateDescription(templateType: TemplateType): string {
  switch (templateType) {
    case 'luminaire':
      return 'Complete lighting fixture ready to install';
    case 'accessory':
      return 'Component or accessory for lighting systems';
    case 'lightline':
      return 'Track or rail system component';
    case 'generic':
      return 'Lighting product';
    default:
      return 'Product';
  }
}

/**
 * Gets the visual focus percentage for a template type
 * @param templateType - The template type
 * @returns Percentage of layout that should be visual (images)
 */
export function getVisualFocusPercentage(templateType: TemplateType): number {
  switch (templateType) {
    case 'luminaire':
      return 60; // 60% visual focus for complete fixtures
    case 'accessory':
      return 20; // 20% visual focus for technical components
    case 'lightline':
      return 40; // 40% visual focus for system components
    case 'generic':
      return 30; // 30% visual focus for generic products
    default:
      return 30;
  }
}