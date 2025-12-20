'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { listProjectsAction, ProjectListItem, ProjectListResult } from '@/lib/actions'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ProjectFormSheet, DeleteProjectDialog } from '@/components/projects'
import { useActiveProject } from '@/lib/active-project-context'
import { FaCheck } from 'react-icons/fa'

export default function ProjectsPage() {
  const router = useRouter()
  const { data: session, status } = useDevSession()
  const { setActiveProject, isActive } = useActiveProject()
  const [projectList, setProjectList] = useState<ProjectListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  // Sheet and dialog state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectListItem | null>(null)

  const handleActivateClick = (project: ProjectListItem, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isActive(project.id)) {
      // Deactivate if already active
      setActiveProject(null)
    } else {
      // Activate this project
      setActiveProject({
        id: project.id,
        project_code: project.project_code,
        name: project.name,
      })
    }
  }

  const loadProjects = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await listProjectsAction({ page: currentPage, pageSize: 10 })
      setProjectList(data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      loadProjects()
    }
  }, [status, loadProjects])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const handleCreateClick = () => {
    setSelectedProject(null)
    setIsFormOpen(true)
  }

  const handleDeleteClick = (project: ProjectListItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedProject(project)
    setIsDeleteOpen(true)
  }

  const handleFormSuccess = () => {
    loadProjects()
  }

  const handleDeleteSuccess = () => {
    // Clear active project if the deleted one was active
    if (selectedProject && isActive(selectedProject.id)) {
      setActiveProject(null)
    }
    loadProjects()
  }

  if (!session && status !== 'loading') {
    return null
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
    }
    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    )
  }

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      low: 'outline',
      medium: 'secondary',
      high: 'default',
      urgent: 'destructive',
    }
    return (
      <Badge variant={variants[priority] || 'default'}>
        {priority.toUpperCase()}
      </Badge>
    )
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
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <DashboardLayout>
      {status === 'loading' || isLoading ? (
        <div className="flex items-center justify-center flex-1">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Projects</h1>
              <p className="text-muted-foreground">Manage lighting design projects</p>
            </div>
            <Button onClick={handleCreateClick}>+ New Project</Button>
          </div>

          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : !projectList || projectList.projects.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground mb-4">No projects found</p>
                <Button onClick={handleCreateClick}>Create your first project</Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[70px] text-center">Active</TableHead>
                      <TableHead>Project Code</TableHead>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectList.projects.map((project) => (
                      <TableRow
                        key={project.id}
                        className={`cursor-pointer hover:bg-accent ${isActive(project.id) ? 'bg-primary/5' : ''}`}
                        onClick={() => router.push(`/projects/${project.id}`)}
                      >
                        <TableCell className="text-center">
                          <Button
                            variant={isActive(project.id) ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={(e) => handleActivateClick(project, e)}
                            title={isActive(project.id) ? 'Deactivate project' : 'Activate project'}
                          >
                            {isActive(project.id) ? (
                              <FaCheck className="h-4 w-4" />
                            ) : (
                              <span className="h-4 w-4 rounded-full border-2 border-current" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{project.project_code}</TableCell>
                        <TableCell>
                          <div className="font-medium">{project.name}</div>
                          {project.customer_name ? (
                            <div className="text-sm text-muted-foreground">
                              {project.customer_name}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="capitalize">{project.project_type || '-'}</TableCell>
                        <TableCell>{project.city || '-'}</TableCell>
                        <TableCell>{getStatusBadge(project.status)}</TableCell>
                        <TableCell>{getPriorityBadge(project.priority)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(project.estimated_budget, project.currency)}
                        </TableCell>
                        <TableCell>{formatDate(project.expected_completion_date)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <circle cx="12" cy="12" r="1" />
                                  <circle cx="12" cy="5" r="1" />
                                  <circle cx="12" cy="19" r="1" />
                                </svg>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/projects/${project.id}`)
                                }}
                              >
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => handleDeleteClick(project, e)}
                              >
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>

              {/* Pagination */}
              {projectList && projectList.totalPages > 1 && (
                <CardContent className="pt-0">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => handlePageChange(currentPage - 1)}
                          aria-disabled={currentPage === 1 || isLoading}
                          className={currentPage === 1 || isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>

                      <span className="flex items-center px-4 text-sm text-muted-foreground">
                        Page {currentPage} of {projectList.totalPages}
                      </span>

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => handlePageChange(currentPage + 1)}
                          aria-disabled={currentPage === projectList.totalPages || isLoading}
                          className={currentPage === projectList.totalPages || isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </CardContent>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Create/Edit Sheet */}
      <ProjectFormSheet
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        project={null}
        onSuccess={handleFormSuccess}
      />

      {/* Delete Dialog */}
      {selectedProject && (
        <DeleteProjectDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          projectCode={selectedProject.project_code}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </DashboardLayout>
  )
}
