/**
 * Product Taxonomy Data
 *
 * Hierarchical category structure for lighting products.
 * Based on the `search.taxonomy` table but provided as static data
 * for demo pages and UI components.
 *
 * @remarks
 * 3-level hierarchy:
 * - Level 1: Top categories (LUMINAIRE, ACCESSORIES, CONTROLS, COMPONENTS)
 * - Level 2: Subcategories (e.g., LUMINAIRE-CEILING, LUMINAIRE-WALL)
 * - Level 3: Specific types (e.g., LUMINAIRE-CEILING-RECESSED)
 *
 * Product counts are approximate and used for display purposes.
 *
 * @module taxonomy-data
 */

/**
 * A category in the product taxonomy tree
 */
export interface TaxonomyCategory {
  /** Unique code (e.g., "LUMINAIRE-CEILING-RECESSED") */
  code: string
  /** Display name */
  name: string
  /** Brief description */
  description: string
  /** Hierarchy level (1-3) */
  level: number
  /** Lucide icon name for UI display */
  icon: string
  /** Approximate number of products in this category */
  productCount: number
  /** Child categories (for levels 1 and 2) */
  children?: TaxonomyCategory[]
}

// Real taxonomy data from database
export const realTaxonomy: TaxonomyCategory[] = [
  {
    code: 'LUMINAIRE',
    name: 'Luminaires',
    description: 'Complete lighting units',
    level: 1,
    icon: 'Lightbulb',
    productCount: 8234,
    children: [
      {
        code: 'LUMINAIRE-CEILING',
        name: 'Ceiling',
        description: 'Ceiling-mounted luminaires',
        level: 2,
        icon: 'MoveUp',
        productCount: 3456,
        children: [
          {
            code: 'LUMINAIRE-CEILING-RECESSED',
            name: 'Recessed',
            description: 'Recessed ceiling fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 1234
          },
          {
            code: 'LUMINAIRE-CEILING-SURFACE',
            name: 'Surface',
            description: 'Surface-mounted ceiling fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 987
          },
          {
            code: 'LUMINAIRE-CEILING-SUSPENDED',
            name: 'Suspended',
            description: 'Suspended ceiling fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 765
          },
          {
            code: 'LUMINAIRE-CEILING-TRACK',
            name: 'Track-Mounted',
            description: 'Ceiling fixtures mounted via track systems',
            level: 3,
            icon: 'Circle',
            productCount: 470
          }
        ]
      },
      {
        code: 'LUMINAIRE-WALL',
        name: 'Wall',
        description: 'Wall-mounted luminaires',
        level: 2,
        icon: 'Square',
        productCount: 2134,
        children: [
          {
            code: 'LUMINAIRE-WALL-RECESSED',
            name: 'Recessed',
            description: 'Recessed wall fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 892
          },
          {
            code: 'LUMINAIRE-WALL-SURFACE',
            name: 'Surface',
            description: 'Surface-mounted wall fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 1242
          }
        ]
      },
      {
        code: 'LUMINAIRE-FLOOR',
        name: 'Floor',
        description: 'Floor-mounted luminaires',
        level: 2,
        icon: 'MoveDown',
        productCount: 876,
        children: [
          {
            code: 'LUMINAIRE-FLOOR-RECESSED',
            name: 'Recessed',
            description: 'In-ground floor fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 432
          },
          {
            code: 'LUMINAIRE-FLOOR-SURFACE',
            name: 'Surface',
            description: 'Surface-mounted floor fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 444
          }
        ]
      },
      {
        code: 'LUMINAIRE-DECORATIVE',
        name: 'Decorative',
        description: 'Decorative lighting fixtures',
        level: 2,
        icon: 'Sparkles',
        productCount: 1234,
        children: [
          {
            code: 'LUMINAIRE-DECORATIVE-TABLE',
            name: 'Table Lamps',
            description: 'Decorative table lamps',
            level: 3,
            icon: 'Circle',
            productCount: 567
          },
          {
            code: 'LUMINAIRE-DECORATIVE-PENDANT',
            name: 'Pendant',
            description: 'Decorative pendant lights',
            level: 3,
            icon: 'Circle',
            productCount: 432
          },
          {
            code: 'LUMINAIRE-DECORATIVE-FLOOR',
            name: 'Floor Lamps',
            description: 'Decorative floor lamps',
            level: 3,
            icon: 'Circle',
            productCount: 235
          }
        ]
      },
      {
        code: 'LUMINAIRE-SPECIAL',
        name: 'Special',
        description: 'Special purpose lighting',
        level: 2,
        icon: 'Target',
        productCount: 534,
        children: [
          {
            code: 'LUMINAIRE-SPECIAL-STRIP',
            name: 'LED Strips',
            description: 'LED strip lights',
            level: 3,
            icon: 'Circle',
            productCount: 234
          },
          {
            code: 'LUMINAIRE-SPECIAL-TRACK',
            name: 'Track Systems',
            description: 'Track lighting systems',
            level: 3,
            icon: 'Circle',
            productCount: 178
          },
          {
            code: 'LUMINAIRE-SPECIAL-BATTEN',
            name: 'Batten',
            description: 'Batten lights',
            level: 3,
            icon: 'Circle',
            productCount: 89
          },
          {
            code: 'LUMINAIRE-SPECIAL-POLE',
            name: 'Pole Mounted',
            description: 'Pole-mounted fixtures',
            level: 3,
            icon: 'Circle',
            productCount: 33
          }
        ]
      }
    ]
  },
  {
    code: 'ACCESSORIES',
    name: 'Accessories',
    description: 'Lighting accessories and components',
    level: 1,
    icon: 'Plug',
    productCount: 3456,
    children: [
      {
        code: 'ACCESSORY-TRACK',
        name: 'Tracks',
        description: 'Track system components and spares',
        level: 2,
        icon: 'Railway',
        productCount: 876,
        children: [
          {
            code: 'ACCESSORY-TRACK-PROFILE',
            name: 'Profiles',
            description: 'Track profiles and rails',
            level: 3,
            icon: 'Circle',
            productCount: 432
          },
          {
            code: 'ACCESSORY-TRACK-SPARE',
            name: 'Spares',
            description: 'Track system spare parts',
            level: 3,
            icon: 'Circle',
            productCount: 444
          }
        ]
      },
      {
        code: 'ACCESSORY-OPTICS',
        name: 'Optics',
        description: 'Optical components and accessories',
        level: 2,
        icon: 'Eye',
        productCount: 567,
        children: [
          {
            code: 'ACCESSORY-OPTICS-LENS',
            name: 'Lens',
            description: 'Lenses and optical lenses',
            level: 3,
            icon: 'Circle',
            productCount: 298
          },
          {
            code: 'ACCESSORY-OPTICS-REFLECTOR',
            name: 'Reflector',
            description: 'Reflectors and optical reflectors',
            level: 3,
            icon: 'Circle',
            productCount: 269
          }
        ]
      },
      {
        code: 'ACCESSORY-ELECTRICAL',
        name: 'Electrical',
        description: 'Electrical components and accessories',
        level: 2,
        icon: 'Cable',
        productCount: 1234,
        children: [
          {
            code: 'ACCESSORY-ELECTRICAL-BOXES',
            name: 'Boxes',
            description: 'Electrical boxes and enclosures',
            level: 3,
            icon: 'Circle',
            productCount: 456
          },
          {
            code: 'ACCESSORY-ELECTRICAL-CABLES',
            name: 'Cables',
            description: 'Cables and wiring',
            level: 3,
            icon: 'Circle',
            productCount: 523
          },
          {
            code: 'ACCESSORY-ELECTRICAL-CONNECTORS',
            name: 'Connectors',
            description: 'Electrical connectors',
            level: 3,
            icon: 'Circle',
            productCount: 255
          }
        ]
      },
      {
        code: 'ACCESSORY-MECHANICAL',
        name: 'Mechanical',
        description: 'Mechanical mounting and hardware',
        level: 2,
        icon: 'Wrench',
        productCount: 779,
        children: [
          {
            code: 'ACCESSORY-MECHANICAL-MOUNTING-BOXES',
            name: 'Mounting Boxes',
            description: 'Mounting boxes and frames',
            level: 3,
            icon: 'Circle',
            productCount: 387
          },
          {
            code: 'ACCESSORY-MECHANICAL-MOUNTING-KITS',
            name: 'Mounting Kits',
            description: 'Mounting kits and hardware',
            level: 3,
            icon: 'Circle',
            productCount: 392
          }
        ]
      }
    ]
  },
  {
    code: 'DRIVERS',
    name: 'Drivers',
    description: 'LED drivers and power supplies',
    level: 1,
    icon: 'Zap',
    productCount: 1876,
    children: [
      {
        code: 'DRIVER-CONSTANT-CURRENT',
        name: 'Constant Current',
        description: 'Constant current LED drivers',
        level: 2,
        icon: 'Zap',
        productCount: 1023,
        children: []
      },
      {
        code: 'DRIVER-CONSTANT-VOLTAGE',
        name: 'Constant Voltage',
        description: 'Constant voltage LED drivers',
        level: 2,
        icon: 'Battery',
        productCount: 853,
        children: []
      }
    ]
  },
  {
    code: 'LAMPS',
    name: 'Lamps',
    description: 'Light sources and lamps',
    level: 1,
    icon: 'Lamp',
    productCount: 2345,
    children: [
      {
        code: 'LAMP-LED',
        name: 'LED Lamps',
        description: 'LED light sources',
        level: 2,
        icon: 'Lightbulb',
        productCount: 2345,
        children: [
          {
            code: 'LAMP-FILAMENT',
            name: 'Filaments',
            description: 'Filament light sources',
            level: 3,
            icon: 'Circle',
            productCount: 1234
          },
          {
            code: 'LAMP-MODULE',
            name: 'Modules',
            description: 'LED modules and arrays',
            level: 3,
            icon: 'Circle',
            productCount: 1111
          }
        ]
      }
    ]
  },
  {
    code: 'MISC',
    name: 'Miscellaneous',
    description: 'Other lighting-related products',
    level: 1,
    icon: 'Package',
    productCount: 876,
    children: [
      {
        code: 'MISC-SMART',
        name: 'Smart Devices',
        description: 'Sensors, cameras, and connected devices',
        level: 2,
        icon: 'Smartphone',
        productCount: 432,
        children: [
          {
            code: 'MISC-SMART-SENSORS',
            name: 'Sensors',
            description: 'Movement and presence sensors',
            level: 3,
            icon: 'Circle',
            productCount: 178
          },
          {
            code: 'MISC-SMART-CAMERAS',
            name: 'Cameras',
            description: 'Surveillance cameras',
            level: 3,
            icon: 'Circle',
            productCount: 134
          },
          {
            code: 'MISC-SMART-WIRELESS',
            name: 'Wireless',
            description: 'Antennas and wireless devices',
            level: 3,
            icon: 'Circle',
            productCount: 120
          }
        ]
      },
      {
        code: 'MISC-HARDWARE',
        name: 'Hardware',
        description: 'Fasteners and mounting hardware',
        level: 2,
        icon: 'Hammer',
        productCount: 267,
        children: [
          {
            code: 'MISC-HARDWARE-FASTENERS',
            name: 'Fasteners',
            description: 'Screws, anchors, and fastening systems',
            level: 3,
            icon: 'Circle',
            productCount: 267
          }
        ]
      },
      {
        code: 'MISC-TOOLS',
        name: 'Tools',
        description: 'Installation and maintenance tools',
        level: 2,
        icon: 'Wrench',
        productCount: 177,
        children: [
          {
            code: 'MISC-TOOLS-CABLE',
            name: 'Cable Tools',
            description: 'Cable cutting and preparation tools',
            level: 3,
            icon: 'Circle',
            productCount: 177
          }
        ]
      }
    ]
  }
]

// Helper function to find category by code
export function findCategoryByCode(code: string): TaxonomyCategory | null {
  function search(categories: TaxonomyCategory[]): TaxonomyCategory | null {
    for (const category of categories) {
      if (category.code === code) {
        return category
      }
      if (category.children) {
        const found = search(category.children)
        if (found) return found
      }
    }
    return null
  }
  return search(realTaxonomy)
}

// Helper function to get breadcrumb trail
export function getBreadcrumb(code: string): string[] {
  const category = findCategoryByCode(code)
  if (!category) return ['Home']

  const trail: string[] = []
  let current: TaxonomyCategory | null = category

  while (current) {
    trail.unshift(current.name)
    const parentCode: string | null = current.code.split('-').slice(0, -1).join('-') ||
                      (current.level === 2 ? current.code.split('-')[0] : null)
    current = parentCode ? findCategoryByCode(parentCode) : null
  }

  trail.unshift('Home')
  return trail
}
