/**
 * Providers - Root context providers for the application
 *
 * Wraps the entire app with necessary context providers in the correct nesting order.
 * Must be a client component because most providers require client-side state.
 *
 * @remarks
 * **Provider Stack** (outer to inner):
 * 1. `ThemeProvider`: Light/dark/system theme from next-themes
 * 2. `SessionProvider`: NextAuth authentication session
 * 3. `UserSettingsProvider`: User preferences (viewer settings, etc.)
 * 4. `BucketProvider`: Tiles bucket state (persisted to localStorage)
 * 5. `GlobalSearchProvider`: Command palette (⌘K) state
 *
 * The order matters - inner providers can access outer provider context.
 */
'use client'

import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@fossapp/ui'
import { UserSettingsProvider } from '@/lib/user-settings-context'
import { BucketProvider } from '@/components/tiles/bucket-context'
import { GlobalSearchProvider } from '@/components/global-search'

/**
 * Application root providers component.
 * Wrap this around your app's children in the root layout.
 */
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
            <GlobalSearchProvider>
              {children}
            </GlobalSearchProvider>
          </BucketProvider>
        </UserSettingsProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}