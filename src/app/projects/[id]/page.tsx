'use client'

import { useEffect, useState, useCallback } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { getProjectByIdAction, ProjectDetail } from '@/lib/actions'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProjectFormSheet, DeleteProjectDialog, ProjectVersionsCard } from '@/components/projects'
import { ArrowLeft } from 'lucide-react'

interface ProjectPageProps {
  params: Promise<{ id: string }>
}

export default function ProjectPage({ params }: ProjectPageProps) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { data: session, status } = useDevSession()
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Sheet and dialog state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

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

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="versions">
              Files & Versions
              {project.versions.length > 0 && ` (${project.versions.length})`}
            </TabsTrigger>
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

          {/* Files & Versions Tab */}
          <TabsContent value="versions">
            <ProjectVersionsCard
              projectId={project.id}
              projectCode={project.project_code}
              currentVersion={project.current_version}
              versions={project.versions}
              googleDriveFolderId={project.google_drive_folder_id}
              isArchived={project.is_archived}
              onVersionChange={loadProject}
            />
          </TabsContent>

          {/* Products Tab */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Project Products</CardTitle>
                <CardDescription>All products specified for this project</CardDescription>
              </CardHeader>
              <CardContent>
                {project.products.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No products added yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Discount</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {project.products.map((product) => (
                        <TableRow key={product.id}>
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
                          <TableCell className="text-right">{product.quantity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(product.unit_price, project.currency)}</TableCell>
                          <TableCell className="text-right">{product.discount_percent || 0}%</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(product.total_price, project.currency)}</TableCell>
                          <TableCell>{getStatusBadge(product.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
    </DashboardLayout>
  )
}
