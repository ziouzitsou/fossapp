/**
 * Application Hints Configuration
 *
 * DEPLOYMENT CHECKLIST:
 * Before deploying, review this file and consider:
 * 1. Are there new features that need hints?
 * 2. Are existing hints still accurate?
 * 3. Should any hints be removed for deprecated features?
 *
 * Hints are shown to users on the dashboard, rotating every 12 seconds.
 * Newer hints (by dateAdded) are prioritized for users who haven't seen them.
 */

export interface Hint {
  /** Unique identifier for tracking seen status */
  id: string
  /** The hint text displayed to users */
  text: string
  /** Icon type: 'keyboard' for shortcuts, 'tip' for tips, 'feature' for features */
  icon: 'keyboard' | 'tip' | 'feature'
  /** Date the hint was added (ISO format) - newer hints shown first to returning users */
  dateAdded: string
}

export const hints: Hint[] = [
  {
    id: 'search',
    text: 'Press / to search products instantly',
    icon: 'keyboard',
    dateAdded: '2025-12-16',
  },
  {
    id: 'tiles-drag',
    text: 'Drag products to Tiles to create comparison sheets',
    icon: 'feature',
    dateAdded: '2025-12-16',
  },
  {
    id: 'copy-pid',
    text: 'Click any PID or MPN to copy it to clipboard',
    icon: 'tip',
    dateAdded: '2025-12-16',
  },
  {
    id: 'symbol-gen',
    text: 'Generate AutoCAD symbols from product data in Symbol Generator',
    icon: 'feature',
    dateAdded: '2025-12-16',
  },
  {
    id: 'search-tiles',
    text: 'Add products to Tiles directly from search results',
    icon: 'tip',
    dateAdded: '2025-12-16',
  },
  {
    id: 'active-project',
    text: 'Set an active project to quickly add products',
    icon: 'tip',
    dateAdded: '2025-12-16',
  },
  {
    id: 'fts',
    text: 'Search works across PID, MPN, description, and supplier',
    icon: 'feature',
    dateAdded: '2025-12-16',
  },
  {
    id: 'search-symbol',
    text: 'Open products in Symbol Generator directly from search',
    icon: 'tip',
    dateAdded: '2025-12-16',
  },
]
