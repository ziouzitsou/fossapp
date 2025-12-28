'use client'

/**
 * ProjectOverviewTab - Overview section of the project detail page
 *
 * Displays project details, customer info, financial summary, and team.
 */

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import type { ProjectDetail } from '@fossapp/projects'
import { formatDate, formatCurrency, getStatusBadge } from './utils'

interface ProjectOverviewTabProps {
  project: ProjectDetail
  totalProductsCost: number
  totalProducts: number
}

export function ProjectOverviewTab({
  project,
  totalProductsCost,
  totalProducts,
}: ProjectOverviewTabProps) {
  return (
    <div className="space-y-4">
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
    </div>
  )
}
