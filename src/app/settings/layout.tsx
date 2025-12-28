'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'
import { useDevSession } from '@/lib/use-dev-session'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { Spinner } from '@fossapp/ui'
import { cn } from '@fossapp/ui'

const tabs = [
  { name: 'User', href: '/settings/user' },
  { name: 'Symbols', href: '/settings/symbols' },
]

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useDevSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  if (!session && status !== 'loading') {
    return null
  }

  return (
    <ProtectedPageLayout>
      {status === 'loading' ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">Settings</h1>
              <p className="text-muted-foreground mt-2">
                Manage your account and application preferences
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground mb-6">
              {tabs.map((tab) => {
                const isActive = pathname === tab.href
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={cn(
                      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isActive
                        ? 'bg-background text-foreground shadow-sm'
                        : 'hover:bg-background/50'
                    )}
                  >
                    {tab.name}
                  </Link>
                )
              })}
            </div>

            {/* Tab Content */}
            <div className="mt-6">
              {children}
            </div>
          </div>
        </div>
      )}
    </ProtectedPageLayout>
  )
}
