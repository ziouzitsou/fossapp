'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@fossapp/ui'
import { Button } from '@fossapp/ui'
import { Input } from '@fossapp/ui'
import { Label } from '@fossapp/ui'
import { Textarea } from '@fossapp/ui'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fossapp/ui'
import { Spinner } from '@fossapp/ui'
import {
  createAreaAction,
  updateAreaAction,
  type ProjectArea,
  type CreateAreaInput,
  type UpdateAreaInput,
} from '@/lib/actions'
import { useDevSession } from '@/lib/use-dev-session'

const AREA_TYPES = [
  { value: 'floor', label: 'Floor' },
  { value: 'room', label: 'Room' },
  { value: 'outdoor', label: 'Outdoor/Landscape' },
  { value: 'common_area', label: 'Common Area' },
  { value: 'parking', label: 'Parking' },
  { value: 'technical', label: 'Technical Space' },
  { value: 'other', label: 'Other' },
]

interface AreaFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  area?: ProjectArea | null
  onSuccess?: () => void
}

export function AreaFormDialog({
  open,
  onOpenChange,
  projectId,
  area,
  onSuccess,
}: AreaFormDialogProps) {
  const isEditing = !!area
  const { data: session } = useDevSession()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    area_code: '',
    area_name: '',
    area_name_en: '',
    area_type: '',
    floor_level: '',
    area_sqm: '',
    ceiling_height_m: '',
    description: '',
    notes: '',
  })

  // Reset form when opening or when area changes
  useEffect(() => {
    if (open) {
      if (area) {
        setFormData({
          area_code: area.area_code || '',
          area_name: area.area_name || '',
          area_name_en: area.area_name_en || '',
          area_type: area.area_type || '',
          floor_level: area.floor_level !== undefined && area.floor_level !== null ? String(area.floor_level) : '',
          area_sqm: area.area_sqm ? String(area.area_sqm) : '',
          ceiling_height_m: area.ceiling_height_m ? String(area.ceiling_height_m) : '',
          description: area.description || '',
          notes: area.notes || '',
        })
      } else {
        setFormData({
          area_code: '',
          area_name: '',
          area_name_en: '',
          area_type: '',
          floor_level: '',
          area_sqm: '',
          ceiling_height_m: '',
          description: '',
          notes: '',
        })
      }
      setError(null)
    }
  }, [open, area])

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditing && area) {
        // Update existing area
        const updateInput: UpdateAreaInput = {
          area_code: formData.area_code || undefined,
          area_name: formData.area_name || undefined,
          area_name_en: formData.area_name_en || undefined,
          area_type: formData.area_type || undefined,
          floor_level: formData.floor_level ? parseInt(formData.floor_level, 10) : undefined,
          area_sqm: formData.area_sqm ? parseFloat(formData.area_sqm) : undefined,
          ceiling_height_m: formData.ceiling_height_m ? parseFloat(formData.ceiling_height_m) : undefined,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
        }

        const result = await updateAreaAction(area.id, updateInput)
        if (result.success) {
          onSuccess?.()
        } else {
          setError(result.error || 'Failed to update area')
        }
      } else {
        // Create new area
        const createInput: CreateAreaInput = {
          project_id: projectId,
          area_code: formData.area_code,
          area_name: formData.area_name,
          area_name_en: formData.area_name_en || undefined,
          area_type: formData.area_type || undefined,
          floor_level: parseInt(formData.floor_level, 10),  // Required field
          area_sqm: formData.area_sqm ? parseFloat(formData.area_sqm) : undefined,
          ceiling_height_m: formData.ceiling_height_m ? parseFloat(formData.ceiling_height_m) : undefined,
          description: formData.description || undefined,
          notes: formData.notes || undefined,
          created_by: session?.user?.email || undefined,
        }

        const result = await createAreaAction(createInput)
        if (result.success) {
          onSuccess?.()
        } else {
          setError(result.error || 'Failed to create area')
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Area' : 'Create New Area'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update area details.'
              : 'Define a new area (floor, garden, zone, etc.). Revision 1 will be created automatically.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="area_code">
                Area Code *
              </Label>
              <Input
                id="area_code"
                name="area_code"
                value={formData.area_code}
                onChange={handleInputChange}
                placeholder="GF, F1, GARDEN"
                required
                disabled={isEditing}
                className={isEditing ? 'bg-muted' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Short unique code (e.g., GF, F1, GARDEN)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area_type">Area Type</Label>
              <Select
                value={formData.area_type}
                onValueChange={(v) => handleSelectChange('area_type', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {AREA_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area_name">Area Name *</Label>
            <Input
              id="area_name"
              name="area_name"
              value={formData.area_name}
              onChange={handleInputChange}
              placeholder="Ground Floor, Garden, Lobby, etc."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="area_name_en">Area Name (English)</Label>
            <Input
              id="area_name_en"
              name="area_name_en"
              value={formData.area_name_en}
              onChange={handleInputChange}
              placeholder="Optional English name"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="floor_level">Floor Level *</Label>
              <Input
                id="floor_level"
                name="floor_level"
                type="number"
                value={formData.floor_level}
                onChange={handleInputChange}
                placeholder="0"
                required
              />
              <p className="text-xs text-muted-foreground">
                -1=basement, 0=ground, 1, 2...
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="area_sqm">Area (m²)</Label>
              <Input
                id="area_sqm"
                name="area_sqm"
                type="number"
                step="0.01"
                value={formData.area_sqm}
                onChange={handleInputChange}
                placeholder="100.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ceiling_height_m">Height (m)</Label>
              <Input
                id="ceiling_height_m"
                name="ceiling_height_m"
                type="number"
                step="0.01"
                value={formData.ceiling_height_m}
                onChange={handleInputChange}
                placeholder="3.0"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Brief description of this area..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}

          <DialogFooter>
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
                  {isEditing ? 'Saving...' : 'Creating...'}
                </>
              ) : isEditing ? (
                'Save Changes'
              ) : (
                'Create Area'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
