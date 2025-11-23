'use client'

import * as React from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

export function AppSidebar() {
  const pathname = usePathname()
  const navigation = getNavigation(pathname)

  return (
    <Sidebar collapsible="offcanvas">
      {/* Logo Header */}
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-center py-4">
          <Image
            src="/logo.svg"
            alt="Company Logo"
            width={60}
            height={60}
            className="h-15 w-15 dark:hidden"
            priority
          />
          <Image
            src="/logo-dark.svg"
            alt="Company Logo"
            width={60}
            height={60}
            className="h-15 w-15 hidden dark:block"
            priority
          />
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent>
        <SidebarMenu className="px-2 py-4">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={item.current}
                  tooltip={item.name}
                >
                  <Link href={item.href}>
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      {/* Footer with Theme Toggle and Version */}
      <SidebarFooter className="border-t">
        <div className="flex flex-col gap-2 p-2">
          {/* Theme Toggle */}
          <div className="flex items-center justify-center">
            <ThemeToggle />
          </div>

          {/* Version Display */}
          <VersionDisplay />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
