'use client'

import { useEffect, useState, useCallback } from 'react'
import { use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import {
  getProjectByIdAction,
  ProjectDetail,
  updateProjectProductQuantityAction,
  removeProductFromProjectAction
} from '@/lib/actions'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@fossapp/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fossapp/ui'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@fossapp/ui'
import { ProjectFormSheet, DeleteProjectDialog, ProjectAreasCard } from '@/components/projects'
import { useActiveProject } from '@/lib/active-project-context'
import { ArrowLeft } from 'lucide-react'
import {
  ProjectOverviewTab,
  ProjectProductsTab,
  formatDate,
  formatCurrency,
  getStatusBadge,
  calculateProductTotals,
} from './components'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useDevSession()
  const { isActive, setActiveProject } = useActiveProject()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Sheet and dialog state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Product quantity update state
  const [updatingProducts, setUpdatingProducts] = useState<Set<string>>(new Set())

  // Remove product confirmation
  const [removeProductId, setRemoveProductId] = useState<string | null>(null)

  // Tab state from URL
  const validTabs = ['overview', 'areas', 'products', 'contacts', 'documents', 'phases']
  const tabFromUrl = searchParams.get('tab')
  const activeTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'overview'

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'overview') {
      params.delete('tab')
    } else {
      params.set('tab', value)
    }
    router.replace(`?${params.toString()}`, { scroll: false })
  }

  const handleQuantityChange = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1) return

    setUpdatingProducts(prev => new Set(prev).add(productId))
    try {
      const result = await updateProjectProductQuantityAction(productId, newQuantity)
      if (result.success) {
        // Update local state with recalculated total_price
        setProject(prev => {
          if (!prev) return prev
          return {
            ...prev,
            products: prev.products.map(p => {
              if (p.id !== productId) return p
              // Recalculate total_price
              let newTotalPrice = p.total_price
              if (p.unit_price !== undefined && p.unit_price !== null) {
                const discountAmount = p.unit_price * ((p.discount_percent || 0) / 100)
                newTotalPrice = (p.unit_price - discountAmount) * newQuantity
              }
              return { ...p, quantity: newQuantity, total_price: newTotalPrice }
            })
          }
        })
      } else {
        console.error('Failed to update quantity:', result.error)
      }
    } catch (error) {
      console.error('Error updating quantity:', error)
    } finally {
      setUpdatingProducts(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const handleRemoveProductClick = (productId: string) => {
    setRemoveProductId(productId)
  }

  const handleConfirmRemoveProduct = async () => {
    if (!removeProductId) return
    const productId = removeProductId
    setRemoveProductId(null)

    setUpdatingProducts(prev => new Set(prev).add(productId))
    try {
      const result = await removeProductFromProjectAction(productId)
      if (result.success) {
        // Update local state
        setProject(prev => {
          if (!prev) return prev
          return {
            ...prev,
            products: prev.products.filter(p => p.id !== productId)
          }
        })
      } else {
        console.error('Failed to remove product:', result.error)
      }
    } catch (error) {
      console.error('Error removing product:', error)
    } finally {
      setUpdatingProducts(prev => {
        const next = new Set(prev)
        next.delete(productId)
        return next
      })
    }
  }

  const loadProject = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getProjectByIdAction(resolvedParams.id)
      if (!data) {
        router.push('/projects')
        return
      }
      setProject(data)
    } catch (error) {
      console.error('Failed to load project:', error)
      router.push('/projects')
    } finally {
      setIsLoading(false)
    }
  }, [resolvedParams.id, router])

  useEffect(() => {
    if (status === 'authenticated') {
      loadProject()
    }
  }, [status, loadProject])

  const handleEditSuccess = () => {
    loadProject()
  }

  const handleDeleteSuccess = () => {
    // Clear active project if the deleted one was active
    if (isActive(resolvedParams.id)) {
      setActiveProject(null)
    }
    router.push('/projects')
  }

  if (status === 'loading' || isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  if (!session || !project) {
    return null
  }

  // Calculate product totals using the shared utility
  const productsTotals = calculateProductTotals(project.products)
  const totalProductsCost = productsTotals.grandTotal
  const totalProducts = productsTotals.quantity

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/projects')}
            className="flex items-center gap-2 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Projects
          </Button>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{project.name}</h1>
              <p className="text-muted-foreground mt-1">{project.description}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex gap-2">
                {getStatusBadge(project.status)}
                <Badge variant={project.priority === 'urgent' ? 'destructive' : 'default'}>
                  {project.priority.toUpperCase()}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditOpen(true)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="areas">Areas ({project.areas?.length || 0})</TabsTrigger>
            <TabsTrigger value="products">Products ({project.products.length})</TabsTrigger>
            <TabsTrigger value="contacts">Contacts ({project.contacts.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({project.documents.length})</TabsTrigger>
            {project.phases.length > 0 && (
              <TabsTrigger value="phases">Phases ({project.phases.length})</TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <ProjectOverviewTab
              project={project}
              totalProductsCost={totalProductsCost}
              totalProducts={totalProducts}
            />
          </TabsContent>

          {/* Areas Tab */}
          <TabsContent value="areas">
            <ProjectAreasCard
              projectId={project.id}
              projectCode={project.project_code}
              areas={project.areas || []}
              onAreaChange={loadProject}
            />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <ProjectProductsTab
              products={project.products}
              currency={project.currency || 'EUR'}
              updatingProducts={updatingProducts}
              onQuantityChange={handleQuantityChange}
              onRemoveProduct={handleRemoveProductClick}
            />
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts">
            <Card>
              <CardHeader>
                <CardTitle>Project Contacts</CardTitle>
                <CardDescription>Additional contacts for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {project.contacts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No additional contacts</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {project.contacts.map((contact) => (
                      <Card key={contact.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">{contact.name}</CardTitle>
                              <CardDescription>{contact.company || contact.role}</CardDescription>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline" className="capitalize">{contact.contact_type}</Badge>
                              {contact.is_primary && <Badge>Primary</Badge>}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {contact.email && <p>Email: {contact.email}</p>}
                          {contact.phone && <p>Phone: {contact.phone}</p>}
                          {contact.mobile && <p>Mobile: {contact.mobile}</p>}
                          {contact.notes && (
                            <p className="text-muted-foreground italic mt-2">{contact.notes}</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Project Documents</CardTitle>
                <CardDescription>Drawings, specifications, and other files</CardDescription>
              </CardHeader>
              <CardContent>
                {project.documents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">No documents uploaded yet</p>
                    <p className="text-sm text-muted-foreground">
                      Documents will be stored in Google Drive (HUB Shared Drive)
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.documents.map((doc) => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="font-medium">{doc.title}</div>
                            {doc.description && (
                              <div className="text-sm text-muted-foreground">{doc.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{doc.document_type}</Badge>
                          </TableCell>
                          <TableCell>
                            {doc.version}
                            {doc.is_latest && <Badge variant="secondary" className="ml-2">Latest</Badge>}
                          </TableCell>
                          <TableCell>{formatDate(doc.created_at)}</TableCell>
                          <TableCell>
                            {doc.file_url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                                  Open
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Phases Tab */}
          {project.phases.length > 0 && (
            <TabsContent value="phases">
              <Card>
                <CardHeader>
                  <CardTitle>Project Phases</CardTitle>
                  <CardDescription>Multi-phase project breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {project.phases.map((phase) => (
                      <Card key={phase.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-base">
                                Phase {phase.phase_number}: {phase.phase_name}
                              </CardTitle>
                              <CardDescription>{phase.description}</CardDescription>
                            </div>
                            {getStatusBadge(phase.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Budget</p>
                              <p className="font-medium">{formatCurrency(phase.budget, project.currency)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Start Date</p>
                              <p className="font-medium">{formatDate(phase.start_date)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">End Date</p>
                              <p className="font-medium">{formatDate(phase.end_date)}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Edit Sheet */}
      <ProjectFormSheet
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        project={project}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Dialog */}
      <DeleteProjectDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        projectId={project.id}
        projectName={project.name}
        projectCode={project.project_code}
        onSuccess={handleDeleteSuccess}
      />

      {/* Remove Product Confirmation Dialog */}
      <AlertDialog open={!!removeProductId} onOpenChange={() => setRemoveProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Product?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this product from the project? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemoveProduct}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}
