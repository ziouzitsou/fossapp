'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { SymbolGeneratorForm } from '@/components/symbol-generator/symbol-generator-form'
import { Loader2 } from 'lucide-react'

function SymbolGeneratorContent() {
  const searchParams = useSearchParams()
  const productId = searchParams.get('pid')

  return (
    <div className="flex flex-col h-full p-6 overflow-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Symbol Generator</h1>
        <p className="text-muted-foreground mt-2">
          Generate AutoCAD plan-view symbol descriptions from luminaire product data
        </p>
      </div>

      {/* Main Form */}
      <SymbolGeneratorForm initialProductId={productId || undefined} />
    </div>
  )
}

export default function SymbolGeneratorPage() {
  return (
    <ProtectedPageLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <SymbolGeneratorContent />
      </Suspense>
    </ProtectedPageLayout>
  )
}
