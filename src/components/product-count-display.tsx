'use client'

import { useEffect, useState } from 'react'
import { getProductCountAction } from '@/lib/actions'

export function ProductCountDisplay() {
  const [productCount, setProductCount] = useState<number | null>(null)

  useEffect(() => {
    const fetchCount = async () => {
      const count = await getProductCountAction()
      setProductCount(count)
    }
    fetchCount()
  }, [])

  if (productCount === null) {
    return <>Professional lighting database</>
  }

  return (
    <>
      Professional lighting database • {Math.floor(productCount / 100) * 100}+ products
    </>
  )
}
