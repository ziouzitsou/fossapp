'use client'

import { cn } from '@/lib/utils'

interface FossSpinnerProps {
  size?: number
  className?: string
  variant?: 'auto' | 'light' | 'dark'
}

export function FossSpinner({ size = 48, className, variant = 'auto' }: FossSpinnerProps) {
  const colorClass = {
    auto: 'text-black dark:text-white',
    light: 'text-black',
    dark: 'text-white',
  }[variant]
  // The F outline path - traced around the perimeter of the F shape
  // Original F path from favicon: m131 106v304h88v-155l97 81v-162l-97 81v-90h151v-76h-239z
  // This traces the outer edge of the F in a continuous path
  const fOutlinePath = `
    M 131 106
    L 370 106
    L 370 182
    L 219 182
    L 219 174
    L 316 255
    L 219 336
    L 219 255
    L 219 410
    L 131 410
    Z
  `.trim()

  return (
    <div className={cn('inline-flex items-center justify-center', colorClass, className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 500 500"
        className="overflow-visible"
      >
        {/* The F shape */}
        <path
          d="m131 106v304h88v-155l97 81v-162l-97 81v-90h151v-76h-239z"
          fill="currentColor"
        />

        {/* Animated yellow dot tracing the F outline */}
        <g>
          <animateMotion
            dur="4s"
            repeatCount="indefinite"
            path={fOutlinePath}
            rotate="auto"
          />
          {/* cy offset moves perpendicular to path direction (outside the F) */}
          <circle r="29" cy="-20" fill="#f6f82c" className="drop-shadow-lg" />
        </g>
      </svg>
    </div>
  )
}

// Smaller inline variant for buttons/text
export function FossSpinnerInline({ className }: { className?: string }) {
  return <FossSpinner size={20} className={className} />
}
