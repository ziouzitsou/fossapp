/**
 * Tile Group Card - Container for products grouped into a single DWG tile
 *
 * Displays a named group of products that will be rendered together as a
 * tile layout in AutoCAD. Supports drag-and-drop reordering, custom notes
 * per product, and triggers DWG generation via APS Design Automation.
 *
 * @remarks
 * **Tiles Workflow**:
 * 1. User drags products from the bucket into a tile group
 * 2. Products are displayed in vertical order (matches DWG output)
 * 3. User can add custom notes per product (e.g., "with dimming")
 * 4. "Generate DWG" sends payload to APS, streams progress via SSE
 * 5. Result includes Drive folder link and DWG viewer access
 *
 * @see {@link useTileGeneration} for the streaming generation hook
 * @see {@link BucketContext} for drag-and-drop state management
 */
'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Grid2X2, Trash2, SquarePen, Check, X, GripVertical, DraftingCompass, Loader2, Eye } from 'lucide-react'
import { Button } from '@fossapp/ui'
import { Input } from '@fossapp/ui'
import { Badge } from '@fossapp/ui'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@fossapp/ui'
import { TileGroup, BucketItem, getProductImage, getProductDrawing } from '@fossapp/tiles/types'
import { useBucket } from '@/components/tiles/bucket-context'
import { ProductImage } from './product-image'
import { cn } from '@fossapp/ui'
import { TilePayload } from '@/lib/tiles/actions'
import { TerminalLog, useTileGeneration } from './terminal-log'
import { GoogleDriveIcon, WindowsExplorerIcon } from '@/components/icons/brand-icons'
import { TileViewerModal } from './tile-viewer-modal'

/**
 * Props for a draggable/sortable product member within a tile group.
 */
interface SortableMemberProps {
  /** The product bucket item containing product data */
  item: BucketItem
  /** Parent tile group ID for composite sortable key */
  groupId: string
  /** User-entered custom notes for this product instance */
  customText?: string
  /** Callback when custom notes are updated */
  onTextChange: (text: string) => void
  /** Callback to remove this product from the group */
  onRemove: () => void
}

/**
 * Renders a single product within a tile group with drag handle,
 * product images, info, and inline-editable custom notes.
 */
function SortableMember({ item, groupId, customText, onTextChange, onRemove }: SortableMemberProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `${groupId}:${item.product.product_id}`,
    data: {
      type: 'tile-member',
      groupId,
      productId: item.product.product_id,
    },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const drawingUrl = getProductDrawing(item.product)
  const imageUrl = getProductImage(item.product)

  const handleStartEdit = () => {
    setEditValue(customText || '')
    setIsEditing(true)
  }

  const handleSave = () => {
    onTextChange(editValue.trim())
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative bg-muted rounded-md p-2 flex items-start gap-3',
        isDragging && 'opacity-50 z-50'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Remove from group button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-muted-foreground/80 text-background opacity-0 group-hover:opacity-100 transition-opacity z-10"
      >
        <X className="h-2.5 w-2.5" />
      </Button>

      {/* Images stack - each with red border, only show if exists */}
      {(drawingUrl || imageUrl) && (
        <div className="flex flex-col gap-1 shrink-0 ml-4">
          {/* Drawing (MD64/MD12) on top */}
          {drawingUrl && (
            <div className="border border-red-500 rounded p-0.5">
              <ProductImage
                src={drawingUrl}
                alt={`${item.product.foss_pid} drawing`}
                size="md"
              />
            </div>
          )}
          {/* Image (MD02/MD01) below */}
          {imageUrl && (
            <div className="border border-red-500 rounded p-0.5">
              <ProductImage
                src={imageUrl}
                alt={`${item.product.foss_pid} image`}
                size="md"
              />
            </div>
          )}
        </div>
      )}

      {/* Text block aligned to top */}
      <div className="flex-1 min-w-0 pt-1">
        {/* Product info - read only */}
        <p className="text-xs font-medium">
          {item.product.description_short}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono mt-1">
          {item.product.foss_pid}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {item.product.supplier_name}
        </p>

        {/* Custom notes - looks like plain text, click to edit */}
        {isEditing ? (
          <div className="mt-1">
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-[10px] h-6 py-0 px-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') handleCancel()
              }}
              onBlur={handleSave}
            />
          </div>
        ) : (
          <p
            onClick={handleStartEdit}
            className={cn(
              "text-[10px] mt-1 cursor-pointer hover:bg-background/50 rounded px-1 -mx-1 min-h-[16px]",
              customText ? "text-muted-foreground" : "text-muted-foreground/50 italic"
            )}
            title="Click to add notes"
          >
            {customText || "Click to add notes..."}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Props for the TileGroupCard component.
 */
interface TileGroupCardProps {
  /** The tile group data including name, members, and custom texts */
  group: TileGroup
}

/**
 * Converts a TileGroup into the payload format expected by the APS tile generation API.
 *
 * @param group - The tile group with members and custom texts
 * @returns Payload with tile name, member images, and text overrides
 */
function generateTilePayload(group: TileGroup): TilePayload {
  return {
    tile: group.name,
    tileId: group.id,
    members: group.members.map((item, index) => {
      const imageUrl = getProductImage(item.product)
      const drawingUrl = getProductDrawing(item.product)
      const customText = group.memberTexts?.[item.product.product_id]

      return {
        productId: item.product.product_id,
        imageUrl: imageUrl || '',
        drawingUrl: drawingUrl || '',
        imageFilename: `${item.product.foss_pid}-${index + 1}-IMG.png`,
        drawingFilename: `${item.product.foss_pid}-${index + 1}-DRW.png`,
        tileText: customText || item.product.description_short,
        width: 1500,
        height: 1500,
        dpi: 300,
        tileWidth: 50,
        tileHeight: 50
      }
    })
  }
}

/**
 * Card component displaying a tile group with its product members.
 *
 * @remarks
 * Provides a drop zone for adding products, sortable members for reordering,
 * and controls for renaming, deleting, and generating DWG output.
 * After successful generation, shows links to Google Drive and DWG viewer.
 */
export function TileGroupCard({ group }: TileGroupCardProps) {
  const { deleteTileGroup, renameTileGroup, removeFromTileGroup, updateMemberText } = useBucket()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(group.name)
  const [driveFolderLink, setDriveFolderLink] = useState<string | null>(null)
  const [dwgFileId, setDwgFileId] = useState<string | null>(null)
  const [viewerUrn, setViewerUrn] = useState<string | null>(null)
  const [viewerOpen, setViewerOpen] = useState(false)

  // Use streaming tile generation
  const { jobId, isGenerating, result, startGeneration, handleComplete, reset } = useTileGeneration()

  const { setNodeRef, isOver } = useDroppable({
    id: `tile-group-${group.id}`,
  })

  const handleSaveName = () => {
    if (editName.trim()) {
      renameTileGroup(group.id, editName.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditName(group.name)
    setIsEditing(false)
  }

  const handleGenerateTile = async () => {
    reset()
    setDriveFolderLink(null)
    setDwgFileId(null)
    const payload = generateTilePayload(group)
    await startGeneration(payload)
  }

  const onGenerationComplete = (res: { success: boolean; dwgUrl?: string; dwgFileId?: string; driveLink?: string; viewerUrn?: string }) => {
    handleComplete(res)
    if (res.success) {
      if (res.driveLink) {
        setDriveFolderLink(res.driveLink)
      }
      if (res.dwgFileId) {
        setDwgFileId(res.dwgFileId)
      }
      if (res.viewerUrn) {
        setViewerUrn(res.viewerUrn)
      }
    }
  }

  // Generate sortable IDs for members
  const sortableIds = group.members.map(m => `${group.id}:${m.product.product_id}`)

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'bg-card border rounded-lg p-3 transition-all',
        isOver && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Grid2X2 className="h-4 w-4 text-primary" />

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') handleCancelEdit()
              }}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveName}>
              <Check className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <>
            <span className="font-medium text-sm flex-1">{group.name}</span>
            <Badge variant="secondary" className="text-xs">
              {group.members.length} items
            </Badge>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={handleGenerateTile}
                    disabled={isGenerating || group.members.length === 0}
                  >
                    {isGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <DraftingCompass className="h-3 w-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isGenerating ? 'Generating DWG...' : 'Generate DWG'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setIsEditing(true)}
                  >
                    <SquarePen className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Rename tile</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive"
              onClick={() => deleteTileGroup(group.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}
      </div>

      {/* Members - Vertical Stack (matches DWG output) */}
      <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3">
          {group.members.map((item) => (
            <SortableMember
              key={item.product.product_id}
              item={item}
              groupId={group.id}
              customText={group.memberTexts?.[item.product.product_id]}
              onTextChange={(text) => updateMemberText(group.id, item.product.product_id, text)}
              onRemove={() => removeFromTileGroup(group.id, item.product.product_id)}
            />
          ))}
        </div>
      </SortableContext>

      {/* Drop zone indicator - always visible as a hint */}
      <div className={cn(
        'mt-3 border-2 border-dashed rounded-md py-2 text-center text-xs transition-colors',
        isOver
          ? 'border-primary bg-primary/10 text-primary font-medium'
          : 'border-muted-foreground/20 text-muted-foreground/50'
      )}>
        {isOver ? 'Release to add here' : 'Drop products here'}
      </div>

      {/* Terminal Log - shows during and after generation */}
      {(jobId || result) && (
        <div className="mt-3">
          <TerminalLog
            jobId={jobId}
            onComplete={onGenerationComplete}
            onClose={reset}
          />

          {/* Success action buttons */}
          {result?.success && driveFolderLink && (
            <div className="mt-2 flex items-center gap-2">
              {(viewerUrn || dwgFileId) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewerOpen(true)}
                        className="p-1.5 rounded hover:bg-muted transition-colors"
                      >
                        <Eye className="w-5 h-5 text-primary" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View DWG</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={driveFolderLink}
                      target="_blank"
                      rel="noopener"
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <GoogleDriveIcon className="w-5 h-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open in Google Drive</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={`file:///F:/Shared drives/HUB/RESOURCES/TILES/${group.name}`}
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                    >
                      <WindowsExplorerIcon className="w-5 h-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Open in Windows Explorer</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

            </div>
          )}

          {/* DWG Viewer Modal */}
          {(viewerUrn || dwgFileId) && (
            <TileViewerModal
              open={viewerOpen}
              onOpenChange={setViewerOpen}
              viewerUrn={viewerUrn ?? undefined}
              driveFileId={dwgFileId ?? undefined}
              fileName={`${group.name}.dwg`}
              tileName={group.name}
            />
          )}
        </div>
      )}
    </div>
  )
}
