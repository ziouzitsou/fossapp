'use client'

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import { ProductInfo, BucketItem, TileGroup } from '@fossapp/tiles/types'

const STORAGE_KEYS = {
  bucket: 'tiles-bucket-items',
  canvas: 'tiles-canvas-items',
  groups: 'tiles-tile-groups',
} as const

interface BucketContextType {
  // Bucket state
  bucketItems: BucketItem[]
  addToBucket: (product: ProductInfo) => void
  removeFromBucket: (productId: string) => void
  isInBucket: (productId: string) => boolean
  clearBucket: () => void
  getBucketItem: (productId: string) => BucketItem | undefined

  // Canvas state (standalone items on canvas, not in a group yet)
  canvasItems: BucketItem[]
  addToCanvas: (productId: string) => void
  removeFromCanvas: (productId: string) => void
  getCanvasItem: (productId: string) => BucketItem | undefined

  // Tile groups state
  tileGroups: TileGroup[]
  createTileGroup: (name: string, items: BucketItem[]) => void
  createTileFromBucket: (productId: string) => void
  createTileGroupFromCanvas: (item1Id: string, item2Id: string) => void
  addToTileGroup: (groupId: string, item: BucketItem) => void
  addToTileGroupFromCanvas: (groupId: string, productId: string) => void
  removeFromTileGroup: (groupId: string, productId: string) => void
  deleteTileGroup: (groupId: string) => void
  renameTileGroup: (groupId: string, name: string) => void
  reorderTileMembers: (groupId: string, oldIndex: number, newIndex: number) => void
  updateMemberText: (groupId: string, productId: string, text: string) => void
  clearAllTiles: () => void
}

const BucketContext = createContext<BucketContextType | undefined>(undefined)

// localStorage helpers
function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) : fallback
  } catch {
    return fallback
  }
}

function saveToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error('Failed to save to localStorage:', e)
  }
}

function generateTileCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export function BucketProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [bucketItems, setBucketItems] = useState<BucketItem[]>([])
  const [canvasItems, setCanvasItems] = useState<BucketItem[]>([])
  const [tileGroups, setTileGroups] = useState<TileGroup[]>([])

  // Load from localStorage on mount (hydration pattern)
  useEffect(() => {
    setBucketItems(loadFromStorage(STORAGE_KEYS.bucket, []))
    setCanvasItems(loadFromStorage(STORAGE_KEYS.canvas, []))
    setTileGroups(loadFromStorage(STORAGE_KEYS.groups, []))
    setMounted(true)
  }, [])

  // Save to localStorage when state changes
  useEffect(() => {
    if (mounted) saveToStorage(STORAGE_KEYS.bucket, bucketItems)
  }, [bucketItems, mounted])

  useEffect(() => {
    if (mounted) saveToStorage(STORAGE_KEYS.canvas, canvasItems)
  }, [canvasItems, mounted])

  useEffect(() => {
    if (mounted) saveToStorage(STORAGE_KEYS.groups, tileGroups)
  }, [tileGroups, mounted])

  const addToBucket = useCallback((product: ProductInfo) => {
    setBucketItems(prev => {
      if (prev.some(item => item.product.product_id === product.product_id)) {
        return prev
      }
      return [...prev, { product, addedAt: new Date() }]
    })
  }, [])

  const removeFromBucket = useCallback((productId: string) => {
    setBucketItems(prev => prev.filter(item => item.product.product_id !== productId))
  }, [])

  const isInBucket = useCallback((productId: string) => {
    return bucketItems.some(item => item.product.product_id === productId)
  }, [bucketItems])

  const clearBucket = useCallback(() => {
    setBucketItems([])
  }, [])

  const getBucketItem = useCallback((productId: string) => {
    return bucketItems.find(item => item.product.product_id === productId)
  }, [bucketItems])

  // Canvas management
  const addToCanvas = useCallback((productId: string) => {
    const item = bucketItems.find(i => i.product.product_id === productId)
    if (!item) return

    setCanvasItems(prev => {
      if (prev.some(i => i.product.product_id === productId)) return prev
      return [...prev, item]
    })
    setBucketItems(prev => prev.filter(i => i.product.product_id !== productId))
  }, [bucketItems])

  const removeFromCanvas = useCallback((productId: string) => {
    const item = canvasItems.find(i => i.product.product_id === productId)
    if (!item) return

    setCanvasItems(prev => prev.filter(i => i.product.product_id !== productId))
    setBucketItems(prev => {
      // Prevent duplicates
      if (prev.some(i => i.product.product_id === productId)) {
        return prev
      }
      return [...prev, item]
    })
  }, [canvasItems])

  const getCanvasItem = useCallback((productId: string) => {
    return canvasItems.find(item => item.product.product_id === productId)
  }, [canvasItems])

  // Tile group management
  const createTileGroup = useCallback((name: string, items: BucketItem[]) => {
    const newGroup: TileGroup = {
      id: crypto.randomUUID(),
      name,
      members: items
    }
    setTileGroups(prev => [...prev, newGroup])
    const productIds = items.map(i => i.product.product_id)
    setBucketItems(prev => prev.filter(item => !productIds.includes(item.product.product_id)))
  }, [])

  const createTileFromBucket = useCallback((productId: string) => {
    const item = bucketItems.find(i => i.product.product_id === productId)
    if (!item) return

    const newGroup: TileGroup = {
      id: crypto.randomUUID(),
      name: `Tile ${generateTileCode()}`,
      members: [item]
    }
    setTileGroups(prev => [...prev, newGroup])
    setBucketItems(prev => prev.filter(i => i.product.product_id !== productId))
  }, [bucketItems])

  const createTileGroupFromCanvas = useCallback((item1Id: string, item2Id: string) => {
    const item1 = canvasItems.find(i => i.product.product_id === item1Id)
    const item2 = canvasItems.find(i => i.product.product_id === item2Id)
    if (!item1 || !item2) return

    const newGroup: TileGroup = {
      id: crypto.randomUUID(),
      name: `Tile ${generateTileCode()}`,
      members: [item1, item2]
    }
    setTileGroups(prev => [...prev, newGroup])
    setCanvasItems(prev => prev.filter(i =>
      i.product.product_id !== item1Id && i.product.product_id !== item2Id
    ))
  }, [canvasItems])

  const addToTileGroup = useCallback((groupId: string, item: BucketItem) => {
    setTileGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group
      if (group.members.some(m => m.product.product_id === item.product.product_id)) {
        return group
      }
      return { ...group, members: [...group.members, item] }
    }))
    removeFromBucket(item.product.product_id)
  }, [removeFromBucket])

  const addToTileGroupFromCanvas = useCallback((groupId: string, productId: string) => {
    const item = canvasItems.find(i => i.product.product_id === productId)
    if (!item) return

    setTileGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group
      if (group.members.some(m => m.product.product_id === productId)) return group
      return { ...group, members: [...group.members, item] }
    }))
    setCanvasItems(prev => prev.filter(i => i.product.product_id !== productId))
  }, [canvasItems])

  const removeFromTileGroup = useCallback((groupId: string, productId: string) => {
    setTileGroups(prev => {
      const updatedGroups = prev.map(group => {
        if (group.id !== groupId) return group
        const removedItem = group.members.find(m => m.product.product_id === productId)
        const newMembers = group.members.filter(m => m.product.product_id !== productId)

        if (removedItem) {
          setBucketItems(prevBucket => {
            // Prevent duplicates
            if (prevBucket.some(i => i.product.product_id === productId)) {
              return prevBucket
            }
            return [...prevBucket, removedItem]
          })
        }

        return { ...group, members: newMembers }
      })
      // Auto-delete empty tile groups
      return updatedGroups.filter(group => group.members.length > 0)
    })
  }, [])

  const deleteTileGroup = useCallback((groupId: string) => {
    setTileGroups(prev => {
      const group = prev.find(g => g.id === groupId)
      if (group) {
        setBucketItems(prevBucket => {
          // Filter out any members that already exist in bucket
          const existingIds = new Set(prevBucket.map(i => i.product.product_id))
          const newItems = group.members.filter(m => !existingIds.has(m.product.product_id))
          return [...prevBucket, ...newItems]
        })
      }
      return prev.filter(g => g.id !== groupId)
    })
  }, [])

  const renameTileGroup = useCallback((groupId: string, name: string) => {
    setTileGroups(prev => prev.map(group =>
      group.id === groupId ? { ...group, name } : group
    ))
  }, [])

  const reorderTileMembers = useCallback((groupId: string, oldIndex: number, newIndex: number) => {
    setTileGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group
      const newMembers = [...group.members]
      const [removed] = newMembers.splice(oldIndex, 1)
      newMembers.splice(newIndex, 0, removed)
      return { ...group, members: newMembers }
    }))
  }, [])

  const updateMemberText = useCallback((groupId: string, productId: string, text: string) => {
    setTileGroups(prev => prev.map(group => {
      if (group.id !== groupId) return group
      const memberTexts = { ...group.memberTexts }
      if (text.trim()) {
        memberTexts[productId] = text
      } else {
        delete memberTexts[productId] // Remove if empty, will fall back to default
      }
      return { ...group, memberTexts }
    }))
  }, [])

  const clearAllTiles = useCallback(() => {
    // Return all tile members to bucket (avoiding duplicates)
    setTileGroups(prev => {
      const allMembers = prev.flatMap(g => g.members)
      setBucketItems(prevBucket => {
        const existingIds = new Set(prevBucket.map(i => i.product.product_id))
        const newItems = allMembers.filter(m => !existingIds.has(m.product.product_id))
        return [...prevBucket, ...newItems]
      })
      return []
    })
    // Also clear canvas items
    setCanvasItems(prev => {
      setBucketItems(prevBucket => {
        const existingIds = new Set(prevBucket.map(i => i.product.product_id))
        const newItems = prev.filter(m => !existingIds.has(m.product.product_id))
        return [...prevBucket, ...newItems]
      })
      return []
    })
  }, [])

  return (
    <BucketContext.Provider value={{
      bucketItems,
      addToBucket,
      removeFromBucket,
      isInBucket,
      clearBucket,
      getBucketItem,
      canvasItems,
      addToCanvas,
      removeFromCanvas,
      getCanvasItem,
      tileGroups,
      createTileGroup,
      createTileFromBucket,
      createTileGroupFromCanvas,
      addToTileGroup,
      addToTileGroupFromCanvas,
      removeFromTileGroup,
      deleteTileGroup,
      renameTileGroup,
      reorderTileMembers,
      updateMemberText,
      clearAllTiles
    }}>
      {children}
    </BucketContext.Provider>
  )
}

export function useBucket() {
  const context = useContext(BucketContext)
  if (context === undefined) {
    throw new Error('useBucket must be used within a BucketProvider')
  }
  return context
}
