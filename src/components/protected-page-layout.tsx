'use client'

import * as React from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { UserDropdown } from '@/components/user-dropdown'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useDevSession } from '@/lib/use-dev-session'

interface ProtectedPageLayoutProps {
  children: React.ReactNode
}

export function ProtectedPageLayout({ children }: ProtectedPageLayoutProps) {
  const { data: session } = useDevSession()

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex-1" />
          <UserDropdown user={session?.user} />
        </header>

        {/* Main Content */}
        <main className="flex flex-1 flex-col overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </>
  )
}
