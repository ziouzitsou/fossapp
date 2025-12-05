'use client'

import { useState } from 'react'
import { ImageOff } from 'lucide-react'

interface ProductImageProps {
  src: string | undefined
  alt: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { width: 48, height: 48 },
  md: { width: 80, height: 80 },
  lg: { width: 128, height: 128 },
}

export function ProductImage({ src, alt, size = 'md', className = '' }: ProductImageProps) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const { width, height } = sizes[size]

  if (!src || error) {
    return (
      <div
        className={`bg-muted rounded-md flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <ImageOff className="h-4 w-4 text-muted-foreground" />
      </div>
    )
  }

  // Use our custom image proxy API
  const proxiedUrl = `/api/image?url=${encodeURIComponent(src)}&w=${width}`

  return (
    <div
      className={`relative bg-muted rounded-md overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
      <img
        src={proxiedUrl}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-full object-contain"
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
        loading="lazy"
      />
    </div>
  )
}
