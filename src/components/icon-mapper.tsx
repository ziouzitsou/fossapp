/**
 * Icon Mapper Component
 *
 * Maps string icon names from the database to actual Lucide React icon components.
 * This provides consistent, professional-looking icons across all platforms.
 *
 * Usage:
 *   <IconMapper name="Lightbulb" className="w-6 h-6" />
 *   <IconMapper name="Zap" className="w-4 h-4 text-blue-500" />
 */

import {
  Lightbulb,
  Plug,
  Zap,
  Lamp,
  Package,
  Home,
  Building,
  Factory,
  ShoppingCart,
  Settings,
  Scissors,
  HelpCircle,
  LucideIcon
} from 'lucide-react'

// Map of icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  // Main categories
  Lightbulb: Lightbulb,
  Plug: Plug,
  Zap: Zap,
  Lamp: Lamp,
  Package: Package,

  // Additional common icons
  Home: Home,
  Building: Building,
  Factory: Factory,
  ShoppingCart: ShoppingCart,
  Settings: Settings,
  Scissors: Scissors,
  HelpCircle: HelpCircle,
}

interface IconMapperProps {
  name?: string | null
  className?: string
  fallback?: LucideIcon
}

/**
 * Renders a Lucide icon based on the provided name
 *
 * @param name - Icon name from database (e.g., "Lightbulb", "Zap")
 * @param className - Tailwind classes for styling
 * @param fallback - Fallback icon if name not found (defaults to HelpCircle)
 */
export function IconMapper({
  name,
  className = "w-6 h-6",
  fallback = HelpCircle
}: IconMapperProps) {
  // Get the icon component from the map, or use fallback
  const IconComponent = name ? iconMap[name] || fallback : fallback

  return <IconComponent className={className} />
}

/**
 * Get all available icon names (useful for admin interfaces)
 */
export function getAvailableIcons(): string[] {
  return Object.keys(iconMap).sort()
}
