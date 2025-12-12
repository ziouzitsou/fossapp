'use client'

import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { SymbolGeneratorForm } from '@/components/symbol-generator/symbol-generator-form'

export default function SymbolGeneratorPage() {
  return (
    <ProtectedPageLayout>
      <div className="flex flex-col h-full p-6 overflow-auto">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Symbol Generator</h1>
          <p className="text-muted-foreground mt-2">
            Generate AutoCAD plan-view symbol descriptions from luminaire product data
          </p>
        </div>

        {/* Main Form */}
        <SymbolGeneratorForm />
      </div>
    </ProtectedPageLayout>
  )
}
