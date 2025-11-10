'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface FossappLogoProps {
  className?: string
  width?: number
  height?: number
}

export function FossappLogo({ className, width = 87, height = 50 }: FossappLogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Show light logo during SSR and while loading
  if (!mounted) {
    return (
      <Image
        src="/logo.svg"
        alt="FOSSAPP Logo"
        width={width}
        height={height}
        className={className}
        priority
      />
    )
  }

  return (
    <Image
      src={resolvedTheme === 'dark' ? '/logo-dark.svg' : '/logo.svg'}
      alt="FOSSAPP Logo"
      width={width}
      height={height}
      className={className}
      priority
    />
  )
}
