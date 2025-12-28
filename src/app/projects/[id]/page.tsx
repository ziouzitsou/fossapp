'use client'

import { useEffect, useState, useCallback } from 'react'
import { use } from 'react'
import Link from 'next/link'
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
import { ArrowLeft, Plus, Minus, Trash2, ChevronDown, ChevronRight, Layers } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@fossapp/ui'
import { Input } from '@fossapp/ui'

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

  // Expanded areas state for collapsible sections
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set(['all']))

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

  const formatCurrency = (amount: number | undefined, currency: string = 'EUR') => {
    if (!amount) return '-'
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency,
    }).format(amount)
  }

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('el-GR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      draft: 'outline',
      quotation: 'secondary',
      approved: 'default',
      in_progress: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
      on_hold: 'outline',
      specified: 'outline',
      quoted: 'secondary',
      ordered: 'default',
      delivered: 'secondary',
      installed: 'default',
    }
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const totalProductsCost = project.products.reduce((sum, p) => sum + (p.total_price || 0), 0)
  const totalProducts = project.products.reduce((sum, p) => sum + p.quantity, 0)

  // Calculate detailed totals for Products tab summary
  const productsTotals = project.products.reduce((acc, p) => {
    const lineTotal = (p.unit_price || 0) * p.quantity
    const discountAmount = lineTotal * ((p.discount_percent || 0) / 100)
    return {
      quantity: acc.quantity + p.quantity,
      subtotal: acc.subtotal + lineTotal,
      discountTotal: acc.discountTotal + discountAmount,
      grandTotal: acc.grandTotal + (p.total_price || lineTotal - discountAmount),
    }
  }, { quantity: 0, subtotal: 0, discountTotal: 0, grandTotal: 0 })

  // Group products by area
  const productsByArea = project.products.reduce((acc, product) => {
    const areaKey = product.area_code || 'unassigned'
    if (!acc[areaKey]) {
      acc[areaKey] = {
        area_code: product.area_code || 'unassigned',
        area_name: product.area_name || 'Unassigned',
        products: [],
        totals: { quantity: 0, subtotal: 0, discountTotal: 0, grandTotal: 0 }
      }
    }
    acc[areaKey].products.push(product)
    const lineTotal = (product.unit_price || 0) * product.quantity
    const discountAmount = lineTotal * ((product.discount_percent || 0) / 100)
    acc[areaKey].totals.quantity += product.quantity
    acc[areaKey].totals.subtotal += lineTotal
    acc[areaKey].totals.discountTotal += discountAmount
    acc[areaKey].totals.grandTotal += (product.total_price || lineTotal - discountAmount)
    return acc
  }, {} as Record<string, {
    area_code: string
    area_name: string
    products: typeof project.products
    totals: { quantity: number; subtotal: number; discountTotal: number; grandTotal: number }
  }>)

  const areaGroups = Object.values(productsByArea).sort((a, b) => {
    // Sort by area_code, with 'unassigned' last
    if (a.area_code === 'unassigned') return 1
    if (b.area_code === 'unassigned') return -1
    return a.area_code.localeCompare(b.area_code)
  })

  const toggleAreaExpanded = (areaCode: string) => {
    setExpandedAreas(prev => {
      const next = new Set(prev)
      if (next.has(areaCode)) {
        next.delete(areaCode)
      } else {
        next.add(areaCode)
      }
      return next
    })
  }

  const expandAllAreas = () => {
    setExpandedAreas(new Set(areaGroups.map(g => g.area_code)))
  }

  const collapseAllAreas = () => {
    setExpandedAreas(new Set())
  }

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
          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Project Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Project Code</p>
                    <p className="font-medium">{project.project_code}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type / Category</p>
                    <p className="font-medium capitalize">{project.project_type || '-'} / {project.project_category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Building Area</p>
                    <p className="font-medium">{project.building_area_sqm ? `${project.building_area_sqm} m²` : '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formatDate(project.start_date)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expected Completion</p>
                    <p className="font-medium">{formatDate(project.expected_completion_date)}</p>
                  </div>
                  {project.actual_completion_date && (
                    <div>
                      <p className="text-sm text-muted-foreground">Actual Completion</p>
                      <p className="font-medium">{formatDate(project.actual_completion_date)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Customer & Location */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer & Location</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Customer</p>
                    {project.customer_id ? (
                      <Link
                        href={`/customers/${project.customer_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {project.customer_name || 'View Customer'}
                      </Link>
                    ) : (
                      <p className="font-medium">{project.customer_name || '-'}</p>
                    )}
                  </div>
                  {project.customer_email && (
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{project.customer_email}</p>
                    </div>
                  )}
                  {project.customer_phone && (
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{project.customer_phone}</p>
                    </div>
                  )}
                  {project.street_address && (
                    <div>
                      <p className="text-sm text-muted-foreground">Address</p>
                      <p className="font-medium">{project.street_address}</p>
                      <p className="text-sm">{project.postal_code} {project.city}, {project.country}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial */}
              <Card>
                <CardHeader>
                  <CardTitle>Financial</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Estimated Budget</p>
                    <p className="font-medium text-lg">{formatCurrency(project.estimated_budget, project.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Products Cost</p>
                    <p className="font-medium text-lg">{formatCurrency(totalProductsCost, project.currency)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Products</p>
                    <p className="font-medium">{totalProducts} units</p>
                  </div>
                </CardContent>
              </Card>

              {/* Team */}
              <Card>
                <CardHeader>
                  <CardTitle>Project Team</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Project Manager</p>
                    <p className="font-medium">{project.project_manager || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Architect Firm</p>
                    <p className="font-medium">{project.architect_firm || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Electrical Engineer</p>
                    <p className="font-medium">{project.electrical_engineer || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lighting Designer</p>
                    <p className="font-medium">{project.lighting_designer || '-'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Notes & Tags */}
            {(project.notes || (project.tags && project.tags.length > 0)) && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes & Tags</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {project.notes && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Notes</p>
                      <p className="whitespace-pre-wrap">{project.notes}</p>
                    </div>
                  )}
                  {project.tags && project.tags.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Tags</p>
                      <div className="flex gap-2 flex-wrap">
                        {project.tags.map((tag) => (
                          <Badge key={tag} variant="outline">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
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
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5" />
                      Project Products
                    </CardTitle>
                    <CardDescription>
                      {project.products.length} products across {areaGroups.length} area{areaGroups.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  {areaGroups.length > 1 && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={expandAllAreas}>
                        Expand All
                      </Button>
                      <Button variant="outline" size="sm" onClick={collapseAllAreas}>
                        Collapse All
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {project.products.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No products added yet</p>
                ) : (
                  <div className="space-y-4">
                    {areaGroups.map((group) => (
                      <Collapsible
                        key={group.area_code}
                        open={expandedAreas.has(group.area_code)}
                        onOpenChange={() => toggleAreaExpanded(group.area_code)}
                      >
                        <div className="border rounded-lg">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50">
                              <div className="flex items-center gap-3">
                                {expandedAreas.has(group.area_code) ? (
                                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                )}
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono">
                                      {group.area_code}
                                    </Badge>
                                    <span className="font-medium">{group.area_name}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {group.products.length} product{group.products.length !== 1 ? 's' : ''} • {group.totals.quantity} units
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-medium text-lg">
                                  {formatCurrency(group.totals.grandTotal, project.currency)}
                                </div>
                                {group.totals.discountTotal > 0 && (
                                  <p className="text-sm text-destructive">
                                    -{formatCurrency(group.totals.discountTotal, project.currency)} discount
                                  </p>
                                )}
                              </div>
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="border-t">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="w-[40px] text-center">#</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Location</TableHead>
                                    <TableHead className="text-center">Qty</TableHead>
                                    <TableHead className="text-right">Unit Price</TableHead>
                                    <TableHead className="text-right">Discount</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.products.map((product, index) => {
                                    const isUpdating = updatingProducts.has(product.id)
                                    return (
                                      <TableRow key={product.id} className={isUpdating ? 'opacity-50' : ''}>
                                        <TableCell className="text-center text-muted-foreground font-medium">
                                          {index + 1}
                                        </TableCell>
                                        <TableCell>
                                          <Link
                                            href={`/products/${product.product_id}`}
                                            className="hover:underline"
                                          >
                                            <div className="font-medium">{product.foss_pid}</div>
                                            <div className="text-sm text-muted-foreground">{product.description_short}</div>
                                          </Link>
                                        </TableCell>
                                        <TableCell>{product.room_location || '-'}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              disabled={isUpdating || product.quantity <= 1}
                                              onClick={() => handleQuantityChange(product.id, product.quantity - 1)}
                                            >
                                              <Minus className="h-3 w-3" />
                                            </Button>
                                            <Input
                                              key={`${product.id}-${product.quantity}`}
                                              type="number"
                                              min={1}
                                              defaultValue={product.quantity}
                                              onBlur={(e) => {
                                                const val = parseInt(e.target.value, 10)
                                                if (!isNaN(val) && val >= 1 && val !== product.quantity) {
                                                  handleQuantityChange(product.id, val)
                                                }
                                              }}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                  e.currentTarget.blur()
                                                }
                                              }}
                                              className="w-14 h-7 text-center px-1"
                                              disabled={isUpdating}
                                            />
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="h-7 w-7 p-0"
                                              disabled={isUpdating}
                                              onClick={() => handleQuantityChange(product.id, product.quantity + 1)}
                                            >
                                              <Plus className="h-3 w-3" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right">{formatCurrency(product.unit_price, project.currency)}</TableCell>
                                        <TableCell className="text-right">{product.discount_percent || 0}%</TableCell>
                                        <TableCell className="text-right font-medium">{formatCurrency(product.total_price, project.currency)}</TableCell>
                                        <TableCell>{getStatusBadge(product.status)}</TableCell>
                                        <TableCell>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                            disabled={isUpdating}
                                            onClick={() => handleRemoveProductClick(product.id)}
                                            title="Remove from project"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}

                    {/* Grand Total Summary */}
                    <Card className="bg-muted/30">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">Grand Total</p>
                            <p className="text-sm text-muted-foreground">
                              {project.products.length} products • {productsTotals.quantity} units
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold">
                              {formatCurrency(productsTotals.grandTotal, project.currency)}
                            </p>
                            {productsTotals.discountTotal > 0 && (
                              <p className="text-sm text-destructive">
                                -{formatCurrency(productsTotals.discountTotal, project.currency)} total discount
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
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
