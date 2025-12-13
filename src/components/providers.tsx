'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from './theme-provider'
import { UserSettingsProvider } from '@/lib/user-settings-context'
import { BucketProvider } from '@/components/tiles/bucket-context'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <UserSettingsProvider>
          <BucketProvider>
            {children}
          </BucketProvider>
        </UserSettingsProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}