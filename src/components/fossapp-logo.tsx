'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface FossappLogoProps {
  className?: string
  width?: number
  height?: number
  effect?: 'glow' | 'shimmer' | 'neon' | 'float' | 'none'
}

export function FossappLogo({
  className,
  width = 87,
  height = 50,
  effect = 'glow' // default effect
}: FossappLogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Effect classes based on selected effect
  const effectClasses = {
    glow: 'logo-glow logo-float',
    shimmer: 'logo-shimmer',
    neon: 'logo-neon logo-float',
    float: 'logo-float',
    none: ''
  }

  const effectClass = effectClasses[effect] || ''
  const combinedClassName = `${className || ''} ${effectClass}`.trim()

  // Show light logo during SSR and while loading
  if (!mounted) {
    return (
      <div className="logo-container">
        <Image
          src="/logo.svg"
          alt="FOSSAPP Logo"
          width={width}
          height={height}
          className={combinedClassName}
          priority
        />
      </div>
    )
  }

  return (
    <div className="logo-container">
      <Image
        src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.svg'}
        alt="FOSSAPP Logo"
        width={width}
        height={height}
        className={combinedClassName}
        priority
      />
    </div>
  )
}
