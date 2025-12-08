# Product Display System Specification
**For Next.js Implementation with Supabase Backend**

---

## Table of Contents
1. [Overview](#overview)
2. [Database Schema Reference](#database-schema-reference)
3. [Product Type Classification](#product-type-classification)
4. [Template Selection Logic](#template-selection-logic)
5. [Component Architecture](#component-architecture)
6. [Feature Group Display System](#feature-group-display-system)
7. [Data Fetching Patterns](#data-fetching-patterns)
8. [Component Specifications](#component-specifications)
9. [Routing Structure](#routing-structure)
10. [Type Definitions](#type-definitions)

---

## Overview

This system displays 14,889+ lighting products from a Supabase database using ETIM (European Technical Information Model) standards. Products span 33 ETIM classes across 3 main groups:

- **Luminaires** (EG000027): 13,271 products - complete lighting fixtures
- **Accessories** (EG000030): 1,489 products - drivers, mounting hardware, components
- **Lamps** (EG000028): 50 products - LED modules and bulbs

The display system must intelligently adapt based on product type, showing relevant features and hiding irrelevant ones.

---

## Database Schema Reference

### Primary Data Source: `items.product_info` (Materialized View)

This view denormalizes all product data into a single queryable structure:

```typescript
interface ProductInfo {
  // Core identification
  product_id: string;          // UUID
  foss_pid: string;            // Foss SA part number (e.g., "DT102149200B")
  catalog_id: number;
  catalog_version: string;
  
  // Product details
  description_short: string;
  description_long: string;
  manufacturer_pid: string;    // Supplier's part number
  family: string;              // Product family
  subfamily: string;           // Product subfamily
  
  // ETIM classification
  class: string;               // ETIM class ID (e.g., "EC002892")
  class_name: string;          // Human-readable class name
  group: string;               // ETIM group ID (e.g., "EG000027")
  group_name: string;          // Human-readable group name
  
  // Supplier
  supplier_name: string;
  supplier_logo: string;       // URL to logo (light mode)
  supplier_logo_dark: string;  // URL to logo (dark mode)
  
  // JSONB Arrays
  prices: Price[];             // Historical pricing data
  multimedia: Multimedia[];    // Images, drawings, documents
  features: Feature[];         // All ETIM features
}
```

### Nested JSONB Structures

#### Price Object
```typescript
interface Price {
  start_price: number;         // Base price
  disc1: number;               // Discount tier 1 (percentage)
  disc2: number;               // Discount tier 2
  disc3: number;               // Discount tier 3
  date: string;                // ISO date string
}
```

#### Multimedia Object
```typescript
interface Multimedia {
  mime_code: string;           // MD01, MD12, MD14, MD16, MD22, MD04
  mime_source: string;         // URL to resource
}

// MIME Code Reference:
// MD01 - Product photographs
// MD12 - Technical drawings (SVG/CAD)
// MD14 - Installation manuals (PDF)
// MD16 - Light distribution curves (IES/LDT)
// MD22 - Specification sheets
// MD04 - Manufacturer product page
```

#### Feature Object
```typescript
interface Feature {
  FEATUREID: string;           // ETIM feature ID (e.g., "EF000001")
  feature_name: string;        // Human-readable name
  FEATUREGROUPID: string;      // ETIM feature group (e.g., "EFG00007")
  FEATUREGROUPDESC: string;    // Group description (e.g., "Electrical")
  
  // Value fields (only ONE will be populated based on feature type)
  fvalueC: string | null;      // Alphanumeric ETIM value ID
  fvalueC_desc: string | null; // Translated alphanumeric value
  fvalueN: number | null;      // Numeric value
  fvalueR: string | null;      // Range value (PostgreSQL numrange as string)
  fvalueB: boolean | null;     // Boolean value
  
  fvalue_detail: string | null; // Additional details
  
  // Unit information (for numeric/range values)
  unit: string | null;         // ETIM unit ID
  unit_desc: string | null;    // Unit description
  unit_abbrev: string | null;  // Unit abbreviation (W, V, mm, lm, K, etc.)
}
```

### ETIM Feature Groups Reference

```typescript
// All 18 ETIM feature groups
const ETIM_FEATURE_GROUPS = {
  'EFG00001': 'Application',
  'EFG00002': 'Approval/certification',
  'EFG00003': 'Colour',
  'EFG00004': 'Communication',
  'EFG00005': 'Connection',
  'EFG00006': 'Consumption',
  'EFG00007': 'Electrical',
  'EFG00008': 'Energy efficiency/environmental',
  'EFG00010': 'Material',
  'EFG00011': 'Measurements',
  'EFG00012': 'Model/type',
  'EFG00013': 'Mounting/installation',
  'EFG00014': 'Operating conditions',
  'EFG00015': 'Options',
  'EFG00016': 'Other',
  'EFG00017': 'Performance',
  'EFG00018': 'Protection',
  'EFG00019': 'Setting/control'
} as const;
```

---

## Product Type Classification

### Classification Hierarchy

```
ETIM Group (3 main groups)
    ↓
ETIM Class (33 classes)
    ↓
Display Template (4 templates)
```

### Product Distribution

```typescript
// Product counts by class (Top 20)
const PRODUCT_DISTRIBUTION = {
  'EC001744': { count: 5794, name: 'Downlight/spot/floodlight', group: 'EG000027' },
  'EC000986': { count: 3692, name: 'Electrical unit for light-line system', group: 'EG000027' },
  'EC002892': { count: 1566, name: 'Ceiling-/wall luminaire', group: 'EG000027' },
  'EC001743': { count: 1090, name: 'Pendant luminaire', group: 'EG000027' },
  'EC002557': { count: 543,  name: 'Mechanical accessories/spare parts', group: 'EG000030' },
  'EC000758': { count: 452,  name: 'In-ground luminaire', group: 'EG000027' },
  'EC000109': { count: 246,  name: 'Batten luminaire', group: 'EG000027' },
  'EC000301': { count: 222,  name: 'Luminaire bollard', group: 'EG000027' },
  'EC002558': { count: 221,  name: 'Light technical accessories', group: 'EG000030' },
  'EC002556': { count: 211,  name: 'Electrical accessories', group: 'EG000030' },
  'EC000293': { count: 190,  name: 'Support profile light-line system', group: 'EG000030' },
  'EC000481': { count: 85,   name: 'Orientation luminaire', group: 'EG000027' },
  'EC002710': { count: 83,   name: 'LED driver', group: 'EG000030' },
  'EC004966': { count: 65,   name: 'Profile for light ribbon', group: 'EG000030' },
  'EC000062': { count: 60,   name: 'Luminaire for streets and places', group: 'EG000027' },
  'EC000533': { count: 60,   name: 'Lighting control system component', group: 'EG000030' },
  'EC000101': { count: 59,   name: 'Light-track', group: 'EG000030' },
  'EC000300': { count: 56,   name: 'Floor luminaire', group: 'EG000027' },
  'EC002706': { count: 56,   name: 'Light ribbon/-hose/-strip', group: 'EG000027' },
  'EC000061': { count: 44,   name: 'Light pole', group: 'EG000030' }
};
```

---

## Template Selection Logic

### Four Template Types

#### 1. **Luminaire Template** (Standard)
- **Use for**: Complete lighting fixtures
- **ETIM Classes**: EC001744, EC002892, EC001743, EC000758, EC000109, EC000301, EC000481, EC000062, EC000300, EC002706
- **ETIM Group**: EG000027 (Luminaires)
- **Characteristics**:
  - Large image gallery (60% visual focus)
  - Light characteristics emphasized (lumens, CCT, CRI, beam angle)
  - Installation/mounting options prominent
  - Aesthetic features (color, material, design)

#### 2. **Accessory Template**
- **Use for**: Components, drivers, mounting hardware, spare parts
- **ETIM Classes**: EC002710 (LED drivers), EC002557, EC002558, EC002556, EC004966, EC002955, EC002707, EC000414, EC000471, EC000401
- **ETIM Group**: EG000030 (Accessories for lighting)
- **Characteristics**:
  - Smaller image gallery (20% visual focus)
  - Electrical specifications emphasized
  - Compatibility matrix/finder
  - Technical diagrams prioritized over photos
  - Input/output specs prominent

#### 3. **Light-Line System Template**
- **Use for**: Track system components, electrical units for rail systems
- **ETIM Classes**: EC000986 (Electrical unit for light-line system), EC000293 (Support profiles), EC000101 (Light-track)
- **ETIM Group**: EG000027 or EG000030
- **Characteristics**:
  - Hybrid between luminaire and accessory
  - System compatibility indicators
  - Track/rail specifications
  - Mounting options for track systems

#### 4. **Generic Template** (Fallback)
- **Use for**: LED modules, lamps, rare product types, edge cases
- **ETIM Classes**: EC000996, EC001959, and all others not categorized above
- **ETIM Group**: EG000028 (Lamps) and others
- **Characteristics**:
  - Basic specification display
  - No special emphasis
  - All feature groups shown equally

### Template Selection Function

```typescript
type TemplateType = 'luminaire' | 'accessory' | 'lightline' | 'generic';

function getTemplateType(product: ProductInfo): TemplateType {
  const classId = product.class;
  const groupId = product.group;
  
  // Define class-to-template mappings
  const LUMINAIRE_CLASSES = [
    'EC001744', // Downlight/spot/floodlight
    'EC002892', // Ceiling-/wall luminaire
    'EC001743', // Pendant luminaire
    'EC000758', // In-ground luminaire
    'EC000109', // Batten luminaire
    'EC000301', // Luminaire bollard
    'EC000481', // Orientation luminaire
    'EC000062', // Street luminaire
    'EC000300', // Floor luminaire
    'EC002706', // Light ribbon/-hose/-strip
    'EC000302', // Table luminaire
  ];
  
  const ACCESSORY_CLASSES = [
    'EC002710', // LED driver
    'EC002557', // Mechanical accessories
    'EC002558', // Light technical accessories
    'EC002556', // Electrical accessories
    'EC004966', // Profile for light ribbon
    'EC000533', // Lighting control system component
    'EC002955', // Accessories for LED drivers
    'EC002707', // Accessories for light ribbon
    'EC000414', // Built-in installation box
    'EC000471', // Emergency unit
    'EC000401', // Lamp holder
    'EC000061', // Light pole
  ];
  
  const LIGHTLINE_CLASSES = [
    'EC000986', // Electrical unit for light-line system
    'EC000293', // Support profile light-line system
    'EC000101', // Light-track
  ];
  
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
  
  // Generic fallback
  return 'generic';
}
```

---

## Component Architecture

### Page Structure

```
app/products/[foss_pid]/page.tsx (Server Component)
    ↓
  ProductDisplayContainer (Client Component)
    ↓
  ├─ ProductHeader (Server/Client)
  │   ├─ SupplierBadge
  │   ├─ ProductTitle
  │   ├─ ArticleNumbers
  │   └─ ProductTypeBadge ← NEW: Shows product type
  │
  ├─ ProductLayout (Layout wrapper based on template type)
  │   │
  │   ├─ [If Luminaire Template]
  │   │   ├─ ProductMediaGallery (60% width)
  │   │   │   ├─ MainImage
  │   │   │   ├─ ThumbnailGallery
  │   │   │   └─ DocumentLinks
  │   │   └─ ProductContent (40% width)
  │   │       ├─ KeySpecsGrid
  │   │       ├─ QuickInfoTags
  │   │       ├─ PricingSection
  │   │       └─ FeatureGroupsDisplay
  │   │
  │   ├─ [If Accessory Template]
  │   │   ├─ ProductMediaCompact (20% or sidebar)
  │   │   │   ├─ ThumbnailImage
  │   │   │   └─ DocumentLinks
  │   │   └─ ProductContent (80% width)
  │   │       ├─ ElectricalSpecsHighlight ← NEW
  │   │       ├─ CompatibilityFinder ← NEW
  │   │       ├─ KeySpecsGrid
  │   │       ├─ PricingSection
  │   │       └─ FeatureGroupsDisplay
  │   │
  │   └─ [If Light-Line Template]
  │       ├─ SystemCompatibilityIndicator ← NEW
  │       └─ (Hybrid of luminaire + accessory)
  │
  └─ FeatureGroupsDisplay (Smart grouping component)
      ├─ FeatureGroup (Collapsible section per ETIM group)
      │   ├─ FeatureGroupHeader (Icon + Title)
      │   └─ FeatureList
      │       └─ FeatureRow (Label + Value with type-aware rendering)
      └─ ETIMClassificationFooter
```

### Component Hierarchy

```typescript
// Root page component
app/products/[foss_pid]/page.tsx

// Main container
components/products/ProductDisplayContainer.tsx

// Header components
components/products/header/ProductHeader.tsx
components/products/header/SupplierBadge.tsx
components/products/header/ProductTitle.tsx
components/products/header/ArticleNumbers.tsx
components/products/header/ProductTypeBadge.tsx  ← NEW

// Layout components
components/products/layouts/ProductLayout.tsx     ← NEW: Smart layout selector
components/products/layouts/LuminaireLayout.tsx
components/products/layouts/AccessoryLayout.tsx
components/products/layouts/LightLineLayout.tsx
components/products/layouts/GenericLayout.tsx

// Media components
components/products/media/ProductMediaGallery.tsx
components/products/media/ProductMediaCompact.tsx ← NEW: For accessories
components/products/media/MainImage.tsx
components/products/media/ThumbnailGallery.tsx
components/products/media/DocumentLinks.tsx

// Content components
components/products/content/KeySpecsGrid.tsx
components/products/content/QuickInfoTags.tsx
components/products/content/PricingSection.tsx
components/products/content/ElectricalSpecsHighlight.tsx    ← NEW: For accessories
components/products/content/CompatibilityFinder.tsx         ← NEW: For accessories
components/products/content/SystemCompatibilityIndicator.tsx ← NEW: For light-line

// Feature display components
components/products/features/FeatureGroupsDisplay.tsx ← NEW: Smart feature grouping
components/products/features/FeatureGroup.tsx
components/products/features/FeatureGroupHeader.tsx
components/products/features/FeatureList.tsx
components/products/features/FeatureRow.tsx
components/products/features/ETIMClassificationFooter.tsx

// Utility components
components/products/shared/FeatureValueRenderer.tsx  ← NEW: Type-aware value display
```

---

## Feature Group Display System

### Feature Group Ordering by Product Type

Different product types need different feature priorities:

```typescript
// Feature group priority configuration
const FEATURE_GROUP_PRIORITY: Record<TemplateType, string[]> = {
  luminaire: [
    'EFG00003', // Colour (CCT, CRI) - MOST IMPORTANT
    'EFG00017', // Performance (lumens, efficacy)
    'EFG00007', // Electrical (voltage, power)
    'EFG00013', // Mounting/installation
    'EFG00018', // Protection (IP rating)
    'EFG00011', // Measurements (dimensions)
    'EFG00019', // Setting/control (dimmable)
    'EFG00010', // Material
    'EFG00012', // Model/type
    'EFG00008', // Energy efficiency
    'EFG00015', // Options
    'EFG00014', // Operating conditions
    'EFG00002', // Approval/certification
    'EFG00005', // Connection
    'EFG00004', // Communication
    'EFG00001', // Application
    'EFG00006', // Consumption
    'EFG00016', // Other
  ],
  
  accessory: [
    'EFG00007', // Electrical (input/output) - MOST IMPORTANT
    'EFG00015', // Options (dimming protocols)
    'EFG00018', // Protection (IP, class)
    'EFG00011', // Measurements (will it fit?)
    'EFG00012', // Model/type
    'EFG00005', // Connection (terminals)
    'EFG00004', // Communication (DALI, etc.)
    'EFG00013', // Mounting/installation
    'EFG00014', // Operating conditions
    'EFG00008', // Energy efficiency
    'EFG00010', // Material
    'EFG00002', // Approval/certification
    'EFG00001', // Application
    'EFG00006', // Consumption
    'EFG00016', // Other
  ],
  
  lightline: [
    'EFG00007', // Electrical
    'EFG00003', // Colour (for light-emitting units)
    'EFG00017', // Performance
    'EFG00013', // Mounting/installation (track compatibility)
    'EFG00011', // Measurements
    'EFG00018', // Protection
    'EFG00019', // Setting/control
    'EFG00012', // Model/type
    'EFG00015', // Options
    'EFG00010', // Material
    'EFG00008', // Energy efficiency
    'EFG00005', // Connection
    'EFG00004', // Communication
    'EFG00014', // Operating conditions
    'EFG00002', // Approval/certification
    'EFG00001', // Application
    'EFG00006', // Consumption
    'EFG00016', // Other
  ],
  
  generic: [
    // Use ETIM default ordering or alphabetical by group ID
    'EFG00001', 'EFG00002', 'EFG00003', 'EFG00004', 'EFG00005',
    'EFG00006', 'EFG00007', 'EFG00008', 'EFG00010', 'EFG00011',
    'EFG00012', 'EFG00013', 'EFG00014', 'EFG00015', 'EFG00016',
    'EFG00017', 'EFG00018', 'EFG00019',
  ],
};
```

### Feature Group Icons and Colors

```typescript
const FEATURE_GROUP_ICONS: Record<string, { icon: string; color: string }> = {
  'EFG00001': { icon: 'tag',                color: 'text-cyan-600' },       // Application
  'EFG00002': { icon: 'check-circle',       color: 'text-green-600' },      // Approval/certification
  'EFG00003': { icon: 'palette',            color: 'text-purple-600' },     // Colour
  'EFG00004': { icon: 'messages',           color: 'text-indigo-600' },     // Communication
  'EFG00005': { icon: 'plug',               color: 'text-blue-gray-600' },  // Connection
  'EFG00006': { icon: 'zap',                color: 'text-amber-600' },      // Consumption
  'EFG00007': { icon: 'bolt',               color: 'text-blue-600' },       // Electrical
  'EFG00008': { icon: 'leaf',               color: 'text-green-500' },      // Energy efficiency
  'EFG00010': { icon: 'box',                color: 'text-brown-600' },      // Material
  'EFG00011': { icon: 'ruler-combined',     color: 'text-gray-600' },       // Measurements
  'EFG00012': { icon: 'tag',                color: 'text-pink-600' },       // Model/type
  'EFG00013': { icon: 'wrench',             color: 'text-orange-600' },     // Mounting/installation
  'EFG00014': { icon: 'thermometer',        color: 'text-red-600' },        // Operating conditions
  'EFG00015': { icon: 'cog',                color: 'text-gray-700' },       // Options
  'EFG00016': { icon: 'info-circle',        color: 'text-gray-500' },       // Other
  'EFG00017': { icon: 'chart-line',         color: 'text-yellow-500' },     // Performance
  'EFG00018': { icon: 'shield-alt',         color: 'text-green-600' },      // Protection
  'EFG00019': { icon: 'sliders-h',          color: 'text-teal-600' },       // Setting/control
};
```

### Feature Filtering Logic

Some features should be hidden or displayed conditionally:

```typescript
function shouldDisplayFeature(feature: Feature): boolean {
  // Hide features where all values are null
  if (!feature.fvalueB && !feature.fvalueC && !feature.fvalueN && !feature.fvalueR) {
    return false;
  }
  
  // Only show boolean features if they are TRUE
  if (feature.fvalueB !== null && feature.fvalueB === false) {
    return false; // Hide false booleans
  }
  
  // Hide "None" alphanumeric values (optional - configurble)
  if (feature.fvalueC_desc === 'None' || feature.fvalueC_desc === 'No') {
    // Could make this configurable per feature group
    return false;
  }
  
  return true;
}
```

### Feature Grouping Function

```typescript
function groupFeaturesByGroup(
  features: Feature[], 
  templateType: TemplateType
): Map<string, Feature[]> {
  // Get priority order for this template type
  const priorityOrder = FEATURE_GROUP_PRIORITY[templateType];
  
  // Group features by FEATUREGROUPID
  const grouped = new Map<string, Feature[]>();
  
  features.forEach(feature => {
    if (shouldDisplayFeature(feature)) {
      const groupId = feature.FEATUREGROUPID;
      if (!grouped.has(groupId)) {
        grouped.set(groupId, []);
      }
      grouped.get(groupId)!.push(feature);
    }
  });
  
  // Sort groups according to priority
  const sortedGroups = new Map<string, Feature[]>();
  
  priorityOrder.forEach(groupId => {
    if (grouped.has(groupId)) {
      sortedGroups.set(groupId, grouped.get(groupId)!);
    }
  });
  
  // Add any remaining groups not in priority list
  grouped.forEach((features, groupId) => {
    if (!sortedGroups.has(groupId)) {
      sortedGroups.set(groupId, features);
    }
  });
  
  return sortedGroups;
}
```

---

## Data Fetching Patterns

### Page-Level Data Fetching (Server Component)

```typescript
// app/products/[foss_pid]/page.tsx

import { createClient } from '@/lib/supabase/server';
import { ProductDisplayContainer } from '@/components/products/ProductDisplayContainer';
import { notFound } from 'next/navigation';

interface PageProps {
  params: {
    foss_pid: string;
  };
}

export default async function ProductPage({ params }: PageProps) {
  const supabase = createClient();
  
  // Fetch product from materialized view
  const { data: product, error } = await supabase
    .from('product_info')
    .select('*')
    .eq('foss_pid', params.foss_pid)
    .single();
  
  if (error || !product) {
    notFound();
  }
  
  return <ProductDisplayContainer product={product} />;
}

// Generate static params for all products (optional, for SSG)
export async function generateStaticParams() {
  const supabase = createClient();
  
  const { data: products } = await supabase
    .from('product_info')
    .select('foss_pid')
    .limit(1000); // Start with subset, expand gradually
  
  return products?.map(p => ({ foss_pid: p.foss_pid })) ?? [];
}

// Metadata generation
export async function generateMetadata({ params }: PageProps) {
  const supabase = createClient();
  
  const { data: product } = await supabase
    .from('product_info')
    .select('description_short, supplier_name, class_name')
    .eq('foss_pid', params.foss_pid)
    .single();
  
  if (!product) {
    return {
      title: 'Product Not Found',
    };
  }
  
  return {
    title: `${product.description_short} - ${product.supplier_name} | Foss SA`,
    description: `${product.class_name} from ${product.supplier_name}. Professional lighting solutions.`,
  };
}
```

### Compatibility Query (For Accessories)

```typescript
// lib/queries/compatibility.ts

export async function findCompatibleLuminaires(
  driverProduct: ProductInfo
): Promise<ProductInfo[]> {
  const supabase = createClient();
  
  // Extract driver specs
  const outputVoltage = extractFeatureValue(driverProduct, 'EF003933'); // Output voltage
  const maxPower = extractFeatureValue(driverProduct, 'EF000346');      // Power consumption
  
  if (!outputVoltage || !maxPower) {
    return [];
  }
  
  // Query for compatible luminaires
  // This is complex - requires JSONB querying
  const { data } = await supabase
    .from('product_info')
    .select('*')
    .eq('group', 'EG000027') // Luminaires only
    .filter('features', 'cs', JSON.stringify([{
      FEATUREID: 'EF005127', // Nominal voltage
      // Match voltage logic here
    }]))
    .limit(20);
  
  return data ?? [];
}

// Helper to extract feature value
function extractFeatureValue(product: ProductInfo, featureId: string): any {
  const feature = product.features.find(f => f.FEATUREID === featureId);
  if (!feature) return null;
  
  return feature.fvalueN ?? feature.fvalueC_desc ?? feature.fvalueB ?? feature.fvalueR;
}
```

---

## Component Specifications

### 1. ProductTypeBadge Component

**Purpose**: Display product type indicator at top of page

**Props**:
```typescript
interface ProductTypeBadgeProps {
  templateType: TemplateType;
  className: string;
  classId: string;
  className: string;
}
```

**Rendering Logic**:
```typescript
// components/products/header/ProductTypeBadge.tsx

export function ProductTypeBadge({ templateType, classId, className }: ProductTypeBadgeProps) {
  const badges = {
    luminaire: {
      icon: '💡',
      label: 'COMPLETE LUMINAIRE',
      description: 'Ready to install',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-900',
      borderColor: 'border-blue-200',
    },
    accessory: {
      icon: '🔧',
      label: 'COMPONENT / ACCESSORY',
      description: 'Requires installation by qualified electrician',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-900',
      borderColor: 'border-orange-200',
    },
    lightline: {
      icon: '🔗',
      label: 'SYSTEM COMPONENT',
      description: 'Part of light-line system - requires compatible track',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-900',
      borderColor: 'border-purple-200',
    },
    generic: {
      icon: '📦',
      label: 'PRODUCT',
      description: '',
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-900',
      borderColor: 'border-gray-200',
    },
  };
  
  const badge = badges[templateType];
  
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${badge.bgColor} ${badge.textColor} ${badge.borderColor}`}>
      <span className="text-lg">{badge.icon}</span>
      <div>
        <div className="font-semibold text-sm">{badge.label}</div>
        {badge.description && (
          <div className="text-xs opacity-75">{badge.description}</div>
        )}
      </div>
    </div>
  );
}
```

### 2. ProductLayout Component

**Purpose**: Smart layout selector that renders appropriate layout based on template type

**Props**:
```typescript
interface ProductLayoutProps {
  product: ProductInfo;
  templateType: TemplateType;
  children?: React.ReactNode;
}
```

**Implementation**:
```typescript
// components/products/layouts/ProductLayout.tsx

export function ProductLayout({ product, templateType }: ProductLayoutProps) {
  switch (templateType) {
    case 'luminaire':
      return <LuminaireLayout product={product} />;
    case 'accessory':
      return <AccessoryLayout product={product} />;
    case 'lightline':
      return <LightLineLayout product={product} />;
    case 'generic':
    default:
      return <GenericLayout product={product} />;
  }
}
```

### 3. FeatureGroupsDisplay Component

**Purpose**: Main component for displaying all features grouped by ETIM feature groups

**Props**:
```typescript
interface FeatureGroupsDisplayProps {
  features: Feature[];
  templateType: TemplateType;
  collapsible?: boolean; // Whether groups should be collapsible
  defaultExpanded?: boolean; // Whether groups start expanded
}
```

**Implementation Pattern**:
```typescript
// components/products/features/FeatureGroupsDisplay.tsx

export function FeatureGroupsDisplay({ 
  features, 
  templateType, 
  collapsible = true,
  defaultExpanded = true 
}: FeatureGroupsDisplayProps) {
  const groupedFeatures = groupFeaturesByGroup(features, templateType);
  
  return (
    <div className="space-y-4">
      {Array.from(groupedFeatures.entries()).map(([groupId, groupFeatures]) => (
        <FeatureGroup
          key={groupId}
          groupId={groupId}
          features={groupFeatures}
          collapsible={collapsible}
          defaultExpanded={defaultExpanded}
        />
      ))}
      
      <ETIMClassificationFooter 
        classId={features[0]?.FEATUREGROUPID} 
        // ... other props
      />
    </div>
  );
}
```

### 4. FeatureRow Component

**Purpose**: Display a single feature with type-aware value rendering

**Props**:
```typescript
interface FeatureRowProps {
  feature: Feature;
  className?: string;
}
```

**Implementation Pattern**:
```typescript
// components/products/features/FeatureRow.tsx

export function FeatureRow({ feature }: FeatureRowProps) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-4 py-3 border-b last:border-b-0">
      <div className="text-sm font-medium text-gray-700">
        {feature.feature_name}
      </div>
      <div className="text-sm font-semibold text-gray-900">
        <FeatureValueRenderer feature={feature} />
      </div>
    </div>
  );
}
```

### 5. FeatureValueRenderer Component

**Purpose**: Intelligently render feature values based on type

**Props**:
```typescript
interface FeatureValueRendererProps {
  feature: Feature;
}
```

**Implementation Pattern**:
```typescript
// components/products/shared/FeatureValueRenderer.tsx

export function FeatureValueRenderer({ feature }: FeatureValueRendererProps) {
  // Boolean value
  if (feature.fvalueB !== null) {
    return (
      <span className={feature.fvalueB ? 'text-green-600' : 'text-red-600'}>
        {feature.fvalueB ? (
          <>
            <CheckCircleIcon className="w-4 h-4 inline mr-1" />
            Yes
          </>
        ) : (
          <>
            <XCircleIcon className="w-4 h-4 inline mr-1" />
            No
          </>
        )}
      </span>
    );
  }
  
  // Numeric value
  if (feature.fvalueN !== null) {
    return (
      <span className="font-mono">
        {feature.fvalueN}
        {feature.unit_abbrev && ` ${feature.unit_abbrev}`}
      </span>
    );
  }
  
  // Range value (stored as string "[min,max]")
  if (feature.fvalueR !== null) {
    const match = feature.fvalueR.match(/\[([0-9.]+),([0-9.]+)\]/);
    if (match) {
      const [_, min, max] = match;
      const isSingleValue = min === max;
      
      return (
        <span className="font-mono">
          {isSingleValue ? min : `${min} - ${max}`}
          {feature.unit_abbrev && ` ${feature.unit_abbrev}`}
        </span>
      );
    }
  }
  
  // Alphanumeric value (ETIM code translated to description)
  if (feature.fvalueC_desc) {
    return <span>{feature.fvalueC_desc}</span>;
  }
  
  // Fallback
  return <span className="text-gray-400">—</span>;
}
```

### 6. ElectricalSpecsHighlight Component

**Purpose**: Prominent display of electrical specifications for accessories (especially drivers)

**Props**:
```typescript
interface ElectricalSpecsHighlightProps {
  product: ProductInfo;
}
```

**Implementation Pattern**:
```typescript
// components/products/content/ElectricalSpecsHighlight.tsx

export function ElectricalSpecsHighlight({ product }: ElectricalSpecsHighlightProps) {
  // Extract key electrical features
  const inputVoltage = product.features.find(f => f.FEATUREID === 'EF003840');
  const outputVoltage = product.features.find(f => f.FEATUREID === 'EF003933');
  const power = product.features.find(f => f.FEATUREID === 'EF000346');
  const frequency = product.features.find(f => f.FEATUREID === 'EF006705');
  
  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold text-blue-900 mb-4">
        Electrical Specifications
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {inputVoltage && (
          <SpecCard 
            label="Input" 
            value={<FeatureValueRenderer feature={inputVoltage} />} 
          />
        )}
        {outputVoltage && (
          <SpecCard 
            label="Output" 
            value={<FeatureValueRenderer feature={outputVoltage} />} 
          />
        )}
        {power && (
          <SpecCard 
            label="Power" 
            value={<FeatureValueRenderer feature={power} />} 
          />
        )}
        {frequency && (
          <SpecCard 
            label="Frequency" 
            value={<FeatureValueRenderer feature={frequency} />} 
          />
        )}
      </div>
    </div>
  );
}
```

### 7. CompatibilityFinder Component

**Purpose**: Show compatible products for accessories (e.g., which luminaires work with this driver)

**Props**:
```typescript
interface CompatibilityFinderProps {
  product: ProductInfo;
}
```

**Implementation Pattern**:
```typescript
// components/products/content/CompatibilityFinder.tsx
'use client';

import { useEffect, useState } from 'react';
import { findCompatibleLuminaires } from '@/lib/queries/compatibility';

export function CompatibilityFinder({ product }: CompatibilityFinderProps) {
  const [compatibleProducts, setCompatibleProducts] = useState<ProductInfo[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadCompatible() {
      const products = await findCompatibleLuminaires(product);
      setCompatibleProducts(products);
      setLoading(false);
    }
    
    loadCompatible();
  }, [product]);
  
  if (loading) {
    return <div>Loading compatible products...</div>;
  }
  
  if (compatibleProducts.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
      <h3 className="text-lg font-bold text-green-900 mb-4">
        Compatible Products
      </h3>
      <p className="text-sm text-green-800 mb-4">
        This driver can power the following luminaires:
      </p>
      <div className="space-y-2">
        {compatibleProducts.slice(0, 5).map(p => (
          <a 
            key={p.product_id}
            href={`/products/${p.foss_pid}`}
            className="block p-3 bg-white rounded border hover:border-green-400 transition"
          >
            <div className="font-medium">{p.description_short}</div>
            <div className="text-xs text-gray-600">{p.manufacturer_pid}</div>
          </a>
        ))}
      </div>
      {compatibleProducts.length > 5 && (
        <button className="mt-4 text-sm text-green-700 font-medium">
          View all {compatibleProducts.length} compatible products →
        </button>
      )}
    </div>
  );
}
```

---

## Routing Structure

```
app/
├── products/
│   ├── [foss_pid]/
│   │   ├── page.tsx              # Main product display page
│   │   └── loading.tsx           # Loading state
│   ├── page.tsx                  # Product listing/search page (future)
│   └── layout.tsx                # Products section layout
```

### URL Structure

```
/products/DT102149200B           # Product by Foss PID
/products/PHI-DL18-3K            # Product by Foss PID
/products/DT210120191            # Driver example
```

---

## Type Definitions

### Complete TypeScript Definitions

```typescript
// types/product.ts

export type TemplateType = 'luminaire' | 'accessory' | 'lightline' | 'generic';

export interface ProductInfo {
  product_id: string;
  foss_pid: string;
  catalog_id: number;
  catalog_version: string;
  description_short: string;
  description_long: string;
  manufacturer_pid: string;
  family: string;
  subfamily: string;
  class: string;
  class_name: string;
  group: string;
  group_name: string;
  supplier_name: string;
  supplier_logo: string;
  supplier_logo_dark: string;
  prices: Price[];
  multimedia: Multimedia[];
  features: Feature[];
}

export interface Price {
  start_price: number;
  disc1: number;
  disc2: number;
  disc3: number;
  date: string;
}

export interface Multimedia {
  mime_code: string;
  mime_source: string;
}

export interface Feature {
  FEATUREID: string;
  feature_name: string;
  FEATUREGROUPID: string;
  FEATUREGROUPDESC: string;
  fvalueC: string | null;
  fvalueC_desc: string | null;
  fvalueN: number | null;
  fvalueR: string | null;
  fvalueB: boolean | null;
  fvalue_detail: string | null;
  unit: string | null;
  unit_desc: string | null;
  unit_abbrev: string | null;
}

export interface FeatureGroupConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  priority: number;
}
```

---

## Implementation Checklist

### Phase 1: Core Template System
- [ ] Create `getTemplateType()` function in `lib/utils/product-classification.ts`
- [ ] Create `ProductLayout` smart selector component
- [ ] Implement `LuminaireLayout` component
- [ ] Implement `AccessoryLayout` component
- [ ] Implement `LightLineLayout` component
- [ ] Implement `GenericLayout` component
- [ ] Create `ProductTypeBadge` component

### Phase 2: Feature Display System
- [ ] Create `groupFeaturesByGroup()` function in `lib/utils/feature-grouping.ts`
- [ ] Create `shouldDisplayFeature()` function
- [ ] Define `FEATURE_GROUP_PRIORITY` constant
- [ ] Define `FEATURE_GROUP_ICONS` constant
- [ ] Implement `FeatureGroupsDisplay` component
- [ ] Implement `FeatureGroup` component (collapsible)
- [ ] Implement `FeatureRow` component
- [ ] Implement `FeatureValueRenderer` component with type-aware rendering

### Phase 3: Specialized Components
- [ ] Implement `ElectricalSpecsHighlight` component for accessories
- [ ] Implement `CompatibilityFinder` component
- [ ] Implement `SystemCompatibilityIndicator` for light-line systems
- [ ] Create compatibility query functions in `lib/queries/compatibility.ts`

### Phase 4: Polish & Optimization
- [ ] Add loading states
- [ ] Add error boundaries
- [ ] Implement print-friendly styles
- [ ] Add SEO metadata
- [ ] Performance optimization (image loading, code splitting)
- [ ] Mobile responsive design
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)

---

## Key Implementation Notes

### 1. Server vs Client Components

- **Server Components** (default): Page, layouts, data fetching
- **Client Components** ('use client'): Interactive elements (collapsible sections, image gallery, compatibility finder)

### 2. Data Flow

```
Server: Fetch from Supabase
    ↓
Server: Determine template type
    ↓
Server: Render layout shell
    ↓
Client: Hydrate interactive components
    ↓
Client: Lazy load compatibility data (accessories only)
```

### 3. Performance Considerations

- Use Next.js Image component for all images
- Lazy load multimedia documents
- Implement pagination for compatible products
- Consider caching template type determination
- Use React.memo for feature rows if performance issues arise

### 4. Bilingual Support

The app should support Greek (primary) and English (secondary):
- Use next-intl or similar i18n solution
- ETIM feature names are in English, consider translation table
- UI labels should be bilingual

### 5. Styling Guidelines

- Use Tailwind CSS for all styling
- Follow existing design system tokens
- Maintain consistent spacing (4px base unit)
- Use semantic color names (primary, success, warning, etc.)
- Responsive breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)

---

## Example Usage

### In a Next.js Page

```typescript
// app/products/[foss_pid]/page.tsx

import { createClient } from '@/lib/supabase/server';
import { ProductDisplayContainer } from '@/components/products/ProductDisplayContainer';
import { getTemplateType } from '@/lib/utils/product-classification';

export default async function ProductPage({ params }: { params: { foss_pid: string } }) {
  const supabase = createClient();
  
  const { data: product } = await supabase
    .from('product_info')
    .select('*')
    .eq('foss_pid', params.foss_pid)
    .single();
  
  if (!product) {
    notFound();
  }
  
  const templateType = getTemplateType(product);
  
  return (
    <ProductDisplayContainer 
      product={product} 
      templateType={templateType} 
    />
  );
}
```

### In the Container Component

```typescript
// components/products/ProductDisplayContainer.tsx

import { ProductHeader } from './header/ProductHeader';
import { ProductLayout } from './layouts/ProductLayout';
import { ProductInfo, TemplateType } from '@/types/product';

interface Props {
  product: ProductInfo;
  templateType: TemplateType;
}

export function ProductDisplayContainer({ product, templateType }: Props) {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <ProductHeader product={product} templateType={templateType} />
      <ProductLayout product={product} templateType={templateType} />
    </div>
  );
}
```

---

## Testing Strategy

### Unit Tests
- Template type determination logic
- Feature grouping and filtering
- Feature value rendering
- Price calculation

### Integration Tests
- Full product page rendering for each template type
- Feature group ordering
- Compatibility queries
- Image gallery functionality

### E2E Tests
- Navigate to different product types
- Expand/collapse feature groups
- View compatible products
- Print functionality

---

## Troubleshooting Guide

### Common Issues

**Issue**: Features not displaying in correct order
**Solution**: Check `FEATURE_GROUP_PRIORITY` configuration and ensure `groupFeaturesByGroup()` is using it

**Issue**: Boolean features showing as "No"
**Solution**: Verify `shouldDisplayFeature()` is filtering out false booleans

**Issue**: Range values displaying incorrectly
**Solution**: Check regex in `FeatureValueRenderer` for parsing PostgreSQL numrange format

**Issue**: Images not loading
**Solution**: Verify multimedia array has MD01 entries, check CORS settings for Delta Light CDN

**Issue**: Compatibility finder showing no results
**Solution**: Check JSONB query syntax in `findCompatibleLuminaires()`, ensure feature IDs are correct

---

## Future Enhancements

1. **Search & Filter System**: Build product search with faceted filtering
2. **Comparison View**: Side-by-side comparison of 2-4 products
3. **Project Builder**: Save products to projects, calculate total power/cost
4. **BIM/CAD Export**: Export product data in standardized formats
5. **Advanced Compatibility**: Cross-reference system components automatically
6. **User Annotations**: Allow users to add notes to products
7. **Stock Availability**: Real-time inventory integration
8. **Lighting Calculations**: Calculate lumens required for room size

---

## Support & Documentation

### ETIM Resources
- [ETIM International](https://www.etim-international.com/)
- [ETIM Classification Browser](https://www.etim-international.com/etimnation/)
- [BMEcat Standard](https://www.bmecat.org/)

### Next.js Resources
- [Next.js App Router](https://nextjs.org/docs/app)
- [Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)
- [Data Fetching](https://nextjs.org/docs/app/building-your-application/data-fetching)

### Supabase Resources
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)
- [JSONB Queries](https://supabase.com/docs/guides/database/json)
- [Materialized Views](https://supabase.com/docs/guides/database/postgres/custom-queries#materialized-views)

---

## Conclusion

This specification provides a complete roadmap for implementing a smart, adaptive product display system that handles 14,889+ diverse lighting products. The system intelligently adapts its layout and feature presentation based on ETIM classification, providing optimal user experience for each product type.

Key principles:
- **Template-driven**: 4 specialized templates for different product types
- **ETIM-native**: Respects ETIM feature group organization
- **Type-aware**: Renders feature values correctly based on data type
- **Extensible**: Easy to add new product types or customize existing ones
- **Performance-focused**: Server-side rendering with client-side hydration only where needed

Good luck with implementation!
