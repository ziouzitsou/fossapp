'use client'

import { ReactNode } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'

interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedPageLayout>
      {children}
    </ProtectedPageLayout>
  )
}
