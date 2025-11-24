'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDevSession } from '@/lib/use-dev-session'
import { listProjectsAction, ProjectListItem, ProjectListResult } from '@/lib/actions'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export default function ProjectsPage() {
  const router = useRouter()
  const { data: session, status } = useDevSession()
  const [projectList, setProjectList] = useState<ProjectListResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/')
    }
  }, [status, router])

  useEffect(() => {
    async function loadProjects() {
      setIsLoading(true)
      try {
        const data = await listProjectsAction({ page: currentPage, pageSize: 10 })
        setProjectList(data)
      } catch (error) {
        console.error('Failed to load projects:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === 'authenticated') {
      loadProjects()
    }
  }, [status, currentPage])

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
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
        <div className="container mx-auto py-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground">Manage lighting design projects</p>
          </div>
          <Button asChild>
            <Link href="/projects/new">+ New Project</Link>
          </Button>
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
              <Button asChild>
                <Link href="/projects/new">Create your first project</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project Code</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead>Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectList.projects.map((project) => (
                    <TableRow
                      key={project.id}
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      <TableCell className="font-medium">{project.project_code}</TableCell>
                      <TableCell>
                        <div className="font-medium">{project.name_en || project.name}</div>
                        {project.customer_name_en || project.customer_name ? (
                          <div className="text-sm text-muted-foreground">
                            {project.customer_name_en || project.customer_name}
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
    </DashboardLayout>
  )
}
