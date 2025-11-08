import { Feature } from '@/types/product';
import {
  FaBolt, FaLightbulb, FaRuler, FaCogs, FaShieldAlt,
  FaThermometerHalf, FaWifi, FaTint, FaCertificate, FaListAlt
} from 'react-icons/fa';
import { IconType } from 'react-icons';

/**
 * Feature group configuration with icons and colors
 */
export const FEATURE_GROUP_CONFIG: Record<string, {
  icon: IconType;
  color: string;
  priority: number;
  name: string;
}> = {
  // Electrical (highest priority)
  'EFG00006': {
    icon: FaBolt,
    color: 'text-yellow-600 dark:text-yellow-400',
    priority: 1,
    name: 'Electrical'
  },
  // Light technical
  'EFG00009': {
    icon: FaLightbulb,
    color: 'text-amber-600 dark:text-amber-400',
    priority: 2,
    name: 'Light Technical'
  },
  // Measurements
  'EFG00011': {
    icon: FaRuler,
    color: 'text-blue-600 dark:text-blue-400',
    priority: 3,
    name: 'Dimensions'
  },
  // Mechanical
  'EFG00010': {
    icon: FaCogs,
    color: 'text-gray-600 dark:text-gray-400',
    priority: 4,
    name: 'Mechanical'
  },
  // Characteristics
  'EFG00001': {
    icon: FaListAlt,
    color: 'text-purple-600 dark:text-purple-400',
    priority: 5,
    name: 'Characteristics'
  },
  // Safety
  'EFG00020': {
    icon: FaShieldAlt,
    color: 'text-green-600 dark:text-green-400',
    priority: 6,
    name: 'Safety'
  },
  // Environmental
  'EFG00008': {
    icon: FaThermometerHalf,
    color: 'text-teal-600 dark:text-teal-400',
    priority: 7,
    name: 'Environmental'
  },
  // Control
  'EFG00002': {
    icon: FaWifi,
    color: 'text-indigo-600 dark:text-indigo-400',
    priority: 8,
    name: 'Control'
  },
  // Materials
  'EFG00007': {
    icon: FaTint,
    color: 'text-slate-600 dark:text-slate-400',
    priority: 9,
    name: 'Materials'
  },
  // Certification
  'EFG00003': {
    icon: FaCertificate,
    color: 'text-rose-600 dark:text-rose-400',
    priority: 10,
    name: 'Certification'
  }
};

/**
 * Group features by their ETIM feature group ID
 * @param features Array of features to group
 * @returns Grouped features sorted by priority
 */
export function groupFeaturesByCategory(features?: Feature[]): Record<string, Feature[]> {
  if (!features || features.length === 0) {
    return {};
  }

  const grouped = features.reduce((acc, feature) => {
    const groupId = feature.FEATUREGROUPID || 'OTHER';
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(feature);
    return acc;
  }, {} as Record<string, Feature[]>);

  // Sort groups by priority
  const sortedGroups: Record<string, Feature[]> = {};
  const sortedKeys = Object.keys(grouped).sort((a, b) => {
    const configA = FEATURE_GROUP_CONFIG[a];
    const configB = FEATURE_GROUP_CONFIG[b];

    if (!configA && !configB) return 0;
    if (!configA) return 1;
    if (!configB) return -1;

    return configA.priority - configB.priority;
  });

  sortedKeys.forEach(key => {
    sortedGroups[key] = grouped[key];
  });

  return sortedGroups;
}

/**
 * Check if a feature has a displayable value
 * @param feature Feature to check
 * @returns true if feature has any value to display
 */
export function hasDisplayableValue(feature: Feature): boolean {
  return !!(
    feature.fvalueB !== null ||
    feature.fvalueC_desc ||
    feature.fvalueN !== null ||
    feature.fvalueR ||
    feature.fvalue_detail
  );
}

/**
 * Get the display value for a feature
 * @param feature Feature to get value from
 * @returns Formatted display value
 */
export function getFeatureDisplayValue(feature: Feature): string {
  // Handle range values first (PostgreSQL numrange format)
  if (feature.fvalueR) {
    return parseAndFormatRange(feature.fvalueR, feature.unit_abbrev || undefined);
  }

  // Handle different value types
  if (feature.fvalueC_desc) {
    return feature.fvalueC_desc;
  }

  if (feature.fvalueN !== null) {
    const unit = feature.unit_abbrev || '';
    // Format number to remove .0 for whole numbers
    const value = Number.isInteger(feature.fvalueN)
      ? feature.fvalueN.toString()
      : feature.fvalueN.toString();
    return `${value}${unit ? ' ' + unit : ''}`;
  }

  if (feature.fvalueB !== null) {
    return feature.fvalueB ? 'Yes' : 'No';
  }

  if (feature.fvalue_detail) {
    // Check if fvalue_detail contains a range value (like "[180.0,180.0]")
    if (typeof feature.fvalue_detail === 'string' &&
        feature.fvalue_detail.startsWith('[') &&
        feature.fvalue_detail.includes(',')) {
      return parseAndFormatRange(feature.fvalue_detail, feature.unit_abbrev || undefined);
    }
    return feature.fvalue_detail;
  }

  return '—';
}

/**
 * Get important features for quick display
 * @param features Array of features
 * @param limit Max number of features to return
 * @returns Important features limited to specified count
 */
export function getImportantFeatures(features?: Feature[], limit: number = 5): Feature[] {
  if (!features) return [];

  // Priority feature IDs (most commonly important)
  const priorityFeatureIds = [
    'EF005127', // Voltage
    'EF000123', // Power
    'EF001742', // Luminous flux
    'EF002638', // Color temperature
    'EF000159', // IP rating
    'EF002079', // Protection class
    'EF001678', // CRI
    'EF005996', // Beam angle
    'EF000082', // Length
    'EF001747', // Width
  ];

  // First get priority features
  const priorityFeatures = features.filter(f =>
    priorityFeatureIds.includes(f.FEATUREID || '') && hasDisplayableValue(f)
  );

  // Then get other displayable features
  const otherFeatures = features.filter(f =>
    !priorityFeatureIds.includes(f.FEATUREID || '') && hasDisplayableValue(f)
  );

  // Combine and limit
  return [...priorityFeatures, ...otherFeatures].slice(0, limit);
}

/**
 * Format a numeric value with proper precision
 * @param value Numeric value
 * @param decimals Number of decimal places
 * @returns Formatted string
 */
export function formatNumericValue(value: number, decimals: number = 0): string {
  if (decimals === 0) {
    return Math.round(value).toString();
  }
  return value.toFixed(decimals);
}

/**
 * Parse and format PostgreSQL numrange string
 * @param rangeStr Range string like "[180.0,180.0]" or "[32.3,34.2]"
 * @param unit Optional unit to append
 * @returns Formatted range string
 */
export function parseAndFormatRange(rangeStr: string, unit?: string): string {
  // Parse PostgreSQL numrange format "[lower,upper]" or "(lower,upper)"
  const match = rangeStr.match(/[\[\(]?([\d.-]+),([\d.-]+)[\]\)]?/);

  if (!match) {
    return rangeStr; // Return as-is if parsing fails
  }

  const lower = parseFloat(match[1]);
  const upper = parseFloat(match[2]);

  // Format numbers (remove .0 for whole numbers, keep decimals otherwise)
  const formatNum = (num: number): string => {
    // If it's effectively a whole number, show without decimals
    if (Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.0001) {
      return Math.round(num).toString();
    }
    // Otherwise keep the decimal precision from the original
    return num.toString();
  };

  const unitStr = unit ? ` ${unit}` : '';

  // If lower equals upper, show as single value
  if (lower === upper) {
    return `${formatNum(lower)}${unitStr}`;
  }

  // Otherwise show as range with tilde
  return `${formatNum(lower)} ~ ${formatNum(upper)}${unitStr}`;
}