'use client'

import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { PlaygroundForm } from '@/components/playground/playground-form'

export default function PlaygroundPage() {
  return (
    <ProtectedPageLayout>
      <div className="flex flex-col h-full p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Playground</h1>
          <p className="text-muted-foreground mt-2">Your ideas in DWG</p>
        </div>

        <PlaygroundForm />
      </div>
    </ProtectedPageLayout>
  )
}
