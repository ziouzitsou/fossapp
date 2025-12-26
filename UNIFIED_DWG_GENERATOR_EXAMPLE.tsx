/**
 * EXAMPLE: Unified DWG Generator Page (Post-Monorepo)
 *
 * This shows how easy it would be to merge tiles, playground, and symbol-generator
 * into a single unified page after monorepo conversion.
 *
 * All three packages export their components and share the progress-store!
 */

'use client'

import { useState } from 'react'
import { ProtectedPageLayout } from '@/components/protected-page-layout'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@fossapp/ui/components/tabs'
import { Card, CardContent } from '@fossapp/ui/components/card'

// Import from monorepo packages
import { TileBuilder } from '@fossapp/tiles/components/tile-builder'
import { PlaygroundForm } from '@fossapp/playground/components/playground-form'
import { SymbolGeneratorForm } from '@fossapp/symbol-generator/components/symbol-form'
import { UnifiedJobQueue } from '@/components/unified-job-queue' // New shared component

export default function UnifiedDWGGeneratorPage() {
  const [activeTab, setActiveTab] = useState<'tiles' | 'playground' | 'symbols'>('tiles')

  return (
    <ProtectedPageLayout>
      <div className="flex flex-col h-full p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">DWG Generator</h1>
          <p className="text-muted-foreground mt-2">
            Create AutoCAD drawings from products, text descriptions, or images
          </p>
        </div>

        {/* Unified Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="tiles">
              <span className="flex items-center gap-2">
                📐 Tile Builder
              </span>
            </TabsTrigger>
            <TabsTrigger value="playground">
              <span className="flex items-center gap-2">
                ✨ AI Playground
              </span>
            </TabsTrigger>
            <TabsTrigger value="symbols">
              <span className="flex items-center gap-2">
                🎨 Symbol Generator
              </span>
            </TabsTrigger>
          </TabsList>

          {/* Tiles Tab */}
          <TabsContent value="tiles" className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Left: Tile Builder */}
              <div className="lg:col-span-2">
                <Card className="h-full">
                  <CardContent className="p-6 h-full">
                    <TileBuilder />
                  </CardContent>
                </Card>
              </div>

              {/* Right: Job Queue */}
              <div className="lg:col-span-1">
                <UnifiedJobQueue filterType="tiles" />
              </div>
            </div>
          </TabsContent>

          {/* Playground Tab */}
          <TabsContent value="playground" className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Left: Playground Form */}
              <div className="lg:col-span-2">
                <Card className="h-full">
                  <CardContent className="p-6">
                    <PlaygroundForm />
                  </CardContent>
                </Card>
              </div>

              {/* Right: Job Queue */}
              <div className="lg:col-span-1">
                <UnifiedJobQueue filterType="playground" />
              </div>
            </div>
          </TabsContent>

          {/* Symbols Tab */}
          <TabsContent value="symbols" className="flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              {/* Left: Symbol Generator Form */}
              <div className="lg:col-span-2">
                <Card className="h-full">
                  <CardContent className="p-6">
                    <SymbolGeneratorForm />
                  </CardContent>
                </Card>
              </div>

              {/* Right: Job Queue */}
              <div className="lg:col-span-1">
                <UnifiedJobQueue filterType="symbols" />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedPageLayout>
  )
}
