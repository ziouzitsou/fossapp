'use client'

import * as React from 'react'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { getNavigation } from '@/lib/navigation'
import { VersionDisplay } from '@/components/version-display'
import { ThemeToggle } from '@/components/theme-toggle'
import { FeedbackChatPanel } from '@/components/feedback/feedback-chat-panel'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@fossapp/ui'

export function AppSidebar() {
  const pathname = usePathname()
  const navigation = getNavigation(pathname)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <Sidebar collapsible="icon">
      {/* Logo Header */}
      <SidebarHeader className="border-b">
        <div className="flex items-center justify-center px-4 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
          {/* Full logo - hidden when collapsed */}
          <Image
            src="/logo.svg"
            alt="Company Logo"
            width={180}
            height={60}
            className="w-full h-auto max-h-12 object-contain dark:hidden group-data-[collapsible=icon]:hidden"
            priority
          />
          <Image
            src="/logo-dark.svg"
            alt="Company Logo"
            width={180}
            height={60}
            className="w-full h-auto max-h-12 object-contain hidden dark:block group-data-[collapsible=icon]:hidden!"
            priority
          />
          {/* Icon logo - shown when collapsed, inverts in dark mode */}
          <Image
            src="/logo-icon.svg"
            alt="Company Logo"
            width={32}
            height={32}
            className="h-8 w-8 object-contain hidden group-data-[collapsible=icon]:block sidebar-icon-adaptive"
            priority
          />
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent className="flex flex-col">
        {/* Main Navigation */}
        <SidebarMenu className="px-2 py-4">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.name}>
                <SidebarMenuButton
                  asChild
                  isActive={item.current}
                  tooltip={item.badge ? `${item.name} (${item.badge})` : item.name}
                >
                  <Link href={item.href}>
                    <Icon className="h-5 w-5" />
                    <span className="flex items-center gap-2">
                      {item.name}
                      {item.badge && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-medium">
                          {item.badge}
                        </Badge>
                      )}
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        {/* Spacer to push Feedback to bottom */}
        <div className="flex-1" />

        {/* Feedback Button - at bottom of content area */}
        <SidebarMenu className="px-2 pb-2">
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarMenuButton
                  onClick={() => setFeedbackOpen(true)}
                  className="w-full justify-start"
                >
                  <MessageCircle className="h-5 w-5" />
                  <span>Feedback</span>
                </SidebarMenuButton>
              </TooltipTrigger>
              <TooltipContent side="right">
                AI Assistant & Feedback
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      {/* Footer with Theme Toggle and Version */}
      <SidebarFooter className="border-t">
        <div className="flex flex-col gap-2 p-2 group-data-[collapsible=icon]:p-1">
          {/* Theme Toggle */}
          <div className="flex items-center justify-center">
            <ThemeToggle />
          </div>

          {/* Version Display - hidden when collapsed */}
          <div className="group-data-[collapsible=icon]:hidden">
            <VersionDisplay />
          </div>
        </div>
      </SidebarFooter>

      {/* Feedback Chat Panel */}
      <FeedbackChatPanel open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </Sidebar>
  )
}
