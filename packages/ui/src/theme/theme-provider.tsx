/**
 * Theme Provider Wrapper
 *
 * Re-exports next-themes ThemeProvider with proper typing for use
 * across the FOSSAPP monorepo.
 *
 * @remarks
 * FOSSAPP supports three themes: 'light', 'dark', and 'system'.
 * The provider persists theme choice to localStorage.
 *
 * @example
 * // In app/layout.tsx
 * import { ThemeProvider } from '@fossapp/ui'
 *
 * <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
 *   {children}
 * </ThemeProvider>
 *
 * @module @fossapp/ui
 * @see {@link https://github.com/pacocoursey/next-themes} next-themes documentation
 */
'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import * as React from 'react'

/**
 * Theme provider component wrapping next-themes.
 *
 * @param children - App content
 * @param props - All next-themes ThemeProvider props (attribute, defaultTheme, etc.)
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
