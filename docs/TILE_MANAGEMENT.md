# Tile Management System

**Feature Version**: 1.0.0
**Route**: `/tiles`
**Added**: 2025-12-05

## Overview

The Tile Management System enables users to create DWG (AutoCAD) tile drawings from product images and technical drawings. It integrates with:
- **Supabase** - Product database (`items.product_info`)
- **APS Design Automation** - AutoCAD cloud processing
- **Google Drive** - File storage (HUB/RESOURCES/TILES/)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         /tiles Page                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ ProductSearch│  │ ProductBucket│  │     TileCanvas       │  │
│  │              │  │  (Draggable) │  │  ┌────────────────┐  │  │
│  │ Search by    │  │              │  │  │  TileGroup 1   │  │  │
│  │ foss_pid     │──▶│  Products    │──▶│  │  - Member 1   │  │  │
│  │              │  │  waiting to  │  │  │  - Member 2   │  │  │
│  │              │  │  be grouped  │  │  └────────────────┘  │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Generation Pipeline                           │
├─────────────────────────────────────────────────────────────────┤
│  1. Image Processing (Sharp)                                     │
│     - Fetch product images & drawings from URLs                  │
│     - Convert to PNG (1500x1500 @ 300dpi)                       │
│                                                                  │
│  2. Script Generation                                            │
│     - Generate AutoLISP .scr file                               │
│     - Layer management, MTEXT, image placement                   │
│                                                                  │
│  3. APS Design Automation                                        │
│     - Upload images + script to OSS bucket                       │
│     - Execute AutoCAD WorkItem                                   │
│     - Download generated DWG                                     │
│                                                                  │
│  4. Google Drive Upload                                          │
│     - Create folder: TILES/{tileName}/                          │
│     - Upload: DWG, images, report                               │
└─────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/
│   ├── tiles/
│   │   └── page.tsx              # Main tiles page
│   └── api/
│       ├── tiles/
│       │   ├── generate/route.ts # POST - Start tile generation
│       │   └── stream/[jobId]/route.ts # SSE progress streaming
│       └── image/route.ts        # Image proxy with caching
│
├── components/
│   ├── tiles/
│   │   ├── bucket-context.tsx    # State management (React Context + localStorage)
│   │   ├── dnd-provider.tsx      # @dnd-kit drag-and-drop context
│   │   ├── product-search.tsx    # Search products by foss_pid
│   │   ├── product-bucket.tsx    # Product holding area
│   │   ├── product-card.tsx      # Draggable product card
│   │   ├── product-image.tsx     # Proxied image component
│   │   ├── draggable-product.tsx # Canvas draggable item
│   │   ├── tile-canvas.tsx       # Main canvas area
│   │   ├── canvas-drop-zone.tsx  # Drop zone for new tiles
│   │   ├── tile-group-card.tsx   # Tile group with sortable members
│   │   └── terminal-log.tsx      # SSE progress terminal UI
│   └── icons/
│       └── brand-icons.tsx       # GoogleDrive, Windows, AutoCAD icons
│
└── lib/
    └── tiles/
        ├── types.ts              # TypeScript interfaces
        ├── progress-store.ts     # SSE job progress tracking
        ├── image-processor.ts    # Sharp image conversion
        ├── script-generator.ts   # AutoLISP script generation
        ├── aps-service.ts        # APS Design Automation client
        ├── google-drive-tile-service.ts # Google Drive upload
        └── actions.ts            # Server actions
```

## Environment Variables

Required in `.env.local`:

```bash
# APS (Autodesk Platform Services) - Tiles Builder
APS_CLIENT_ID=<your-aps-client-id>
APS_CLIENT_SECRET=<your-aps-client-secret>
APS_REGION=EMEA
APS_NICKNAME=fossapp
APS_ACTIVITY_NAME=fossappTileAct2
APS_BUNDLE_NAME=tilebundle

# Optional: Windows Explorer path for direct file access
NEXT_PUBLIC_TILES_EXPLORER_PATH=F:/Shared drives/HUB/RESOURCES/TILES
```

## Dependencies

```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2",
  "sharp": "^0.34.5",
  "@aps_sdk/authentication": "^1.0.0",
  "@aps_sdk/autodesk-sdkmanager": "^1.0.0",
  "@aps_sdk/oss": "^1.3.2"
}
```

## State Management

Uses React Context (`BucketProvider`) with localStorage persistence:

```typescript
// localStorage keys
'tiles-bucket-items'   // Products waiting to be grouped
'tiles-canvas-items'   // Products on canvas (not in a group)
'tiles-tile-groups'    // Created tile groups with members
'tiles-search-history' // Recent search terms
```

State persists across page refreshes. Clear localStorage to reset.

## API Endpoints

### POST `/api/tiles/generate`

Starts tile generation. Returns jobId for SSE streaming.

**Request:**
```json
{
  "tile": "Tile ABCD",
  "tileId": "uuid",
  "members": [
    {
      "productId": "uuid",
      "imageUrl": "https://...",
      "drawingUrl": "https://...",
      "imageFilename": "MY8204045139-1-IMG.png",
      "drawingFilename": "MY8204045139-1-DRW.png",
      "tileText": "Product description",
      "width": 1500,
      "height": 1500,
      "dpi": 300,
      "tileWidth": 50,
      "tileHeight": 50
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "uuid",
  "message": "Tile generation started"
}
```

### GET `/api/tiles/stream/[jobId]`

SSE endpoint for real-time progress updates.

**Event Format:**
```
data: {"timestamp":1733401234567,"elapsed":"0.5s","phase":"images","message":"Processing images...","step":"Step 1/4"}
```

**Phases:** `images` → `script` → `aps` → `drive` → `complete` | `error`

### GET `/api/image`

Image proxy with Sharp processing and caching.

**Query Parameters:**
- `url` - Source image URL (required)
- `w` - Target width (32-512, default 128)

**Response:** WebP image with 30-day cache

## Workflow

### Creating a Tile

1. **Search** - Enter foss_pid in search bar
2. **Add to Bucket** - Click "Add to Bucket" on search results
3. **Drag to Canvas** - Drag products from bucket to canvas
4. **Create Tile** - Drop on "Drop here to create new tile" zone
5. **Add Members** - Drag more products to existing tile group
6. **Reorder** - Drag members within tile to reorder (top = first in DWG)
7. **Edit Notes** - Click notes area to add custom text per member
8. **Generate** - Click drafting compass icon to generate DWG

### Generation Progress

Terminal log shows real-time progress:
- 📷 Images - Downloading and converting images
- 📝 Script - Generating AutoLISP script
- ⚙️ APS - Processing with AutoCAD Design Automation
- ☁️ Drive - Uploading to Google Drive
- ✅ Complete / ❌ Error

### Post-Generation

After successful generation:
- **Google Drive icon** - Opens folder in browser
- **Windows icon** - Opens folder in Windows Explorer (if path configured)
- **AutoCAD icon** - Future: View DWG in browser

## Google Drive Structure

```
HUB/
└── RESOURCES/
    └── TILES/
        ├── Tile ABCD/
        │   ├── Tile ABCD.dwg
        │   ├── MY8204045139-1-IMG.png
        │   ├── MY8204045139-1-DRW.png
        │   ├── MY8204045140-2-IMG.png
        │   ├── MY8204045140-2-DRW.png
        │   └── Tile ABCD-report.txt
        └── Tile EFGH/
            └── ...
```

When regenerating a tile, the existing folder is renamed to `.BAK` before creating new content.

## APS Design Automation

### Activity: `fossappTileAct2`

The AutoCAD activity processes the tile:
1. Opens blank DWG template
2. Runs the generated .scr script
3. Script creates layers, inserts images, adds text
4. Saves and outputs the final DWG

### Bundle: `tilebundle`

Contains the AutoCAD appbundle with custom commands if needed.

### Regions

Default region: `EMEA` (can be changed via `APS_REGION`)
Available: `US`, `EMEA`

## Troubleshooting

### Images Not Loading

1. Check if product has images in `multimedia` JSON field
2. Verify image URLs are accessible
3. Check `.image-cache/` directory permissions
4. Clear cache: `rm -rf .image-cache/`

### APS Errors

1. Verify credentials: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`
2. Check activity exists: `APS_ACTIVITY_NAME`
3. Review APS logs in terminal output
4. Check APS console: https://aps.autodesk.com/

### Google Drive Upload Fails

1. Verify service account credentials at `credentials/google-service-account.json`
2. Check `GOOGLE_DRIVE_HUB_ID` environment variable
3. Verify service account has access to HUB shared drive
4. Check if RESOURCES/TILES folder exists

### State Issues

Clear localStorage to reset state:
```javascript
localStorage.removeItem('tiles-bucket-items')
localStorage.removeItem('tiles-canvas-items')
localStorage.removeItem('tiles-tile-groups')
localStorage.removeItem('tiles-search-history')
```

## Future Enhancements

- [ ] Batch tile generation
- [ ] Tile templates/presets
- [ ] DWG preview in browser (via APS Viewer)
- [ ] Tile history/version tracking
- [ ] Export tile configuration as JSON
- [ ] Import products from CSV
- [ ] Keyboard shortcuts for common actions

## Related Documentation

- [Google Drive Integration](./GOOGLE_DRIVE_SHARED_DRIVE_INTEGRATION.md)
- [API Patterns](./API_PATTERNS.md)
- [Component Architecture](./COMPONENT_ARCHITECTURE.md)
