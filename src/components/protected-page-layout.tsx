'use client'

import * as React from 'react'
import Link from 'next/link'
import { FaFolder, FaTimes } from 'react-icons/fa'
import { AppSidebar } from '@/components/app-sidebar'
import { UserDropdown } from '@/components/user-dropdown'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useDevSession } from '@/lib/use-dev-session'
import { useActiveProject } from '@/lib/active-project-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ProtectedPageLayoutProps {
  children: React.ReactNode
  headerContent?: React.ReactNode
}

export function ProtectedPageLayout({ children, headerContent }: ProtectedPageLayoutProps) {
  const { data: session } = useDevSession()
  const { activeProject, clearActiveProject } = useActiveProject()

  return (
    <>
      <AppSidebar />
      <SidebarInset>
        {/* Header */}
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
          <SidebarTrigger className="-ml-1" />
          {headerContent && <div className="ml-4">{headerContent}</div>}
          <div className="flex-1" />

          {/* Active Project Indicator */}
          {activeProject && (
            <div className="flex items-center gap-1 mr-2">
              <Link href={`/projects/${activeProject.id}`}>
                <Badge
                  variant="secondary"
                  className="flex items-center gap-1.5 px-2.5 py-1 cursor-pointer hover:bg-secondary/80 transition-colors"
                >
                  <FaFolder className="h-3 w-3 text-primary" />
                  <span className="font-medium text-xs">
                    {activeProject.project_code}
                  </span>
                  <span className="text-muted-foreground text-xs max-w-[150px] truncate">
                    {activeProject.name}
                  </span>
                </Badge>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                onClick={clearActiveProject}
                title="Deactivate project"
              >
                <FaTimes className="h-3 w-3" />
              </Button>
            </div>
          )}

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
