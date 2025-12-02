'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import {
  updateProjectAction,
  type CreateProjectInput,
  type ProjectDetail,
  type CustomerSearchResult,
} from '@/lib/actions'
import {
  createProjectWithDriveAction,
  type CreateProjectWithDriveInput,
} from '@/lib/actions/project-drive'
import { CustomerCombobox } from '@/components/customer-combobox'

// Project status options
const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'quotation', label: 'Quotation' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'on_hold', label: 'On Hold' },
]

// Project priority options
const PROJECT_PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

// Project type options
const PROJECT_TYPES = [
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'hospitality', label: 'Hospitality' },
  { value: 'retail', label: 'Retail' },
  { value: 'office', label: 'Office' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'cultural', label: 'Cultural' },
  { value: 'outdoor', label: 'Outdoor/Landscape' },
  { value: 'other', label: 'Other' },
]

// Currency options - EUR only for Greek market
const CURRENCIES = [
  { value: 'EUR', label: 'EUR (€)' },
]

interface ProjectFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: ProjectDetail | null  // If provided, we're editing
  onSuccess?: (projectId: string) => void
}

export function ProjectFormSheet({
  open,
  onOpenChange,
  project,
  onSuccess,
}: ProjectFormSheetProps) {
  const isEditing = !!project
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState<CreateProjectInput>({
    project_code: '',
    name: '',
    description: '',
    street_address: '',
    postal_code: '',
    city: '',
    region: '',
    prefecture: '',
    country: 'Greece',
    project_type: '',
    project_category: '',
    building_area_sqm: undefined,
    estimated_budget: undefined,
    currency: 'EUR',
    status: 'draft',
    priority: 'medium',
    start_date: '',
    expected_completion_date: '',
    project_manager: '',
    architect_firm: '',
    electrical_engineer: '',
    lighting_designer: '',
    notes: '',
    tags: [],
  })

  // Reset form when opening or when project changes
  useEffect(() => {
    if (open) {
      if (project) {
        // Editing - populate form with project data
        setFormData({
          project_code: project.project_code || '',
          name: project.name_en || project.name || '',
          description: project.description || '',
          street_address: project.street_address || '',
          postal_code: project.postal_code || '',
          city: project.city || '',
          region: project.region || '',
          prefecture: project.prefecture || '',
          country: project.country || 'Greece',
          project_type: project.project_type || '',
          project_category: project.project_category || '',
          building_area_sqm: project.building_area_sqm,
          estimated_budget: project.estimated_budget,
          currency: project.currency || 'EUR',
          status: project.status || 'draft',
          priority: project.priority || 'medium',
          start_date: project.start_date || '',
          expected_completion_date: project.expected_completion_date || '',
          project_manager: project.project_manager || '',
          architect_firm: project.architect_firm || '',
          electrical_engineer: project.electrical_engineer || '',
          lighting_designer: project.lighting_designer || '',
          notes: project.notes || '',
          tags: project.tags || [],
        })
      } else {
        // Creating - reset to defaults
        setFormData({
          project_code: '',
          name: '',
          description: '',
          street_address: '',
          postal_code: '',
          city: '',
          region: '',
          prefecture: '',
          country: 'Greece',
          project_type: '',
          project_category: '',
          building_area_sqm: undefined,
          estimated_budget: undefined,
          currency: 'EUR',
          status: 'draft',
          priority: 'medium',
          start_date: '',
          expected_completion_date: '',
          project_manager: '',
          architect_firm: '',
          electrical_engineer: '',
          lighting_designer: '',
          notes: '',
          tags: [],
        })
      }
      setError(null)
    }
  }, [open, project])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    const numValue = value ? parseFloat(value) : undefined
    setFormData((prev) => ({ ...prev, [name]: numValue }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleCustomerChange = (customerId: string | null, customer: CustomerSearchResult | null) => {
    setFormData((prev) => ({ ...prev, customer_id: customerId || undefined }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      // Validate customer is selected
      if (!formData.customer_id) {
        setError('Please select a customer')
        setIsSubmitting(false)
        return
      }

      if (isEditing && project) {
        // Editing existing project - use standard update
        const result = await updateProjectAction(project.id, formData)
        if (result.success) {
          onOpenChange(false)
          if (onSuccess) {
            onSuccess(project.id)
          }
        } else {
          setError(result.error || 'An error occurred')
        }
      } else {
        // Creating new project with auto-generated code and Drive folder
        const createInput: CreateProjectWithDriveInput = {
          name: formData.name,
          name_en: formData.name_en,
          description: formData.description,
          customer_id: formData.customer_id,
          street_address: formData.street_address,
          postal_code: formData.postal_code,
          city: formData.city,
          region: formData.region,
          prefecture: formData.prefecture,
          country: formData.country,
          project_type: formData.project_type,
          project_category: formData.project_category,
          building_area_sqm: formData.building_area_sqm,
          estimated_budget: formData.estimated_budget,
          currency: formData.currency,
          status: formData.status,
          priority: formData.priority,
          start_date: formData.start_date,
          expected_completion_date: formData.expected_completion_date,
          project_manager: formData.project_manager,
          architect_firm: formData.architect_firm,
          electrical_engineer: formData.electrical_engineer,
          lighting_designer: formData.lighting_designer,
          notes: formData.notes,
          tags: formData.tags,
        }

        const result = await createProjectWithDriveAction(createInput)
        if (result.success && result.data) {
          onOpenChange(false)
          if (onSuccess) {
            onSuccess(result.data.id)
          }
        } else {
          setError(result.error || 'An error occurred')
        }
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? 'Edit Project' : 'Create New Project'}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Update the project details below.'
              : 'Fill in the details to create a new project.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="team">Team</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
              </TabsList>

              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_code">Project Code</Label>
                    {isEditing ? (
                      <Input
                        id="project_code"
                        name="project_code"
                        value={formData.project_code}
                        disabled
                        className="bg-muted"
                      />
                    ) : (
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-muted text-muted-foreground text-sm">
                        Auto-generated (YYMM-NNN)
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => handleSelectChange('status', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_STATUSES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <CustomerCombobox
                    value={formData.customer_id}
                    onValueChange={handleCustomerChange}
                    placeholder="Search and select customer..."
                    initialCustomer={project ? {
                      id: project.customer_id || '',
                      name: project.customer_name || ''
                    } : null}
                  />
                  <p className="text-xs text-muted-foreground">
                    Type at least 2 characters to search
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Brief description of the project..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project_type">Project Type</Label>
                    <Select
                      value={formData.project_type || ''}
                      onValueChange={(v) => handleSelectChange('project_type', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(v) => handleSelectChange('priority', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROJECT_PRIORITIES.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="estimated_budget">Budget</Label>
                    <Input
                      id="estimated_budget"
                      name="estimated_budget"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.estimated_budget ?? ''}
                      onChange={handleNumberChange}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={formData.currency}
                      onValueChange={(v) => handleSelectChange('currency', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="building_area_sqm">Area (m²)</Label>
                    <Input
                      id="building_area_sqm"
                      name="building_area_sqm"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.building_area_sqm ?? ''}
                      onChange={handleNumberChange}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expected_completion_date">Expected Completion</Label>
                    <Input
                      id="expected_completion_date"
                      name="expected_completion_date"
                      type="date"
                      value={formData.expected_completion_date}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Location Tab */}
              <TabsContent value="location" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="street_address">Street Address</Label>
                  <Input
                    id="street_address"
                    name="street_address"
                    value={formData.street_address}
                    onChange={handleInputChange}
                    placeholder="Street name and number"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="e.g., Athens"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      name="postal_code"
                      value={formData.postal_code}
                      onChange={handleInputChange}
                      placeholder="e.g., 10552"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="region">Region</Label>
                    <Input
                      id="region"
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      placeholder="e.g., Attica"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prefecture">Prefecture</Label>
                    <Input
                      id="prefecture"
                      name="prefecture"
                      value={formData.prefecture}
                      onChange={handleInputChange}
                      placeholder="e.g., Central Athens"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Greece"
                  />
                </div>
              </TabsContent>

              {/* Team Tab */}
              <TabsContent value="team" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project_manager">Project Manager</Label>
                  <Input
                    id="project_manager"
                    name="project_manager"
                    value={formData.project_manager}
                    onChange={handleInputChange}
                    placeholder="Name of project manager"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="architect_firm">Architect / Firm</Label>
                  <Input
                    id="architect_firm"
                    name="architect_firm"
                    value={formData.architect_firm}
                    onChange={handleInputChange}
                    placeholder="Architect or firm name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="electrical_engineer">Electrical Engineer</Label>
                  <Input
                    id="electrical_engineer"
                    name="electrical_engineer"
                    value={formData.electrical_engineer}
                    onChange={handleInputChange}
                    placeholder="Electrical engineer name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lighting_designer">Lighting Designer</Label>
                  <Input
                    id="lighting_designer"
                    name="lighting_designer"
                    value={formData.lighting_designer}
                    onChange={handleInputChange}
                    placeholder="Lighting designer name"
                  />
                </div>
              </TabsContent>

              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project_category">Project Category</Label>
                  <Input
                    id="project_category"
                    name="project_category"
                    value={formData.project_category}
                    onChange={handleInputChange}
                    placeholder="e.g., New Construction, Renovation"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Additional notes about the project..."
                    rows={5}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          {error && (
            <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <SheetFooter className="mt-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  {isEditing ? 'Saving...' : 'Creating project & Drive folder...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Project'
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
