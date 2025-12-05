'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from './theme-provider'
import { MultiThemeProvider } from '@/lib/theme-context'
import { ActiveProjectProvider } from '@/lib/active-project-context'
import { BucketProvider } from '@/components/tiles/bucket-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <MultiThemeProvider>
        <ActiveProjectProvider>
          <BucketProvider>
            <SessionProvider>{children}</SessionProvider>
          </BucketProvider>
        </ActiveProjectProvider>
      </MultiThemeProvider>
    </ThemeProvider>
  )
}