# Symbol Generator

**Status**: Production (integrated into Planner)
**Route**: `/planner` (embedded in Area Overview)
**Last Updated**: 2024-12-30

## Overview

The Symbol Generator creates AutoCAD plan-view symbols for luminaire products. It uses a **2-stage LLM pipeline**:

1. **Vision Analysis**: Analyzes product images to create a structured Symbol Specification
2. **Script Generation**: Converts the specification to AutoLISP + SVG

The generated symbols are stored in Supabase and displayed in the Planner.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Planner Area Overview → Product Card → Symbol Modal        │
├─────────────────────────────────────────────────────────────┤
│  1. Click product card → opens SymbolModal                  │
│  2. Click "Generate Symbol" → triggers pipeline             │
│  3. Progress displayed in real-time                         │
│  4. Results: PNG (DWG screenshot) + SVG (web display)       │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Vision Analysis (Claude Sonnet 4)                 │
├─────────────────────────────────────────────────────────────┤
│  Input:                                                     │
│  • Product photo (MD01/MD02)                                │
│  • Technical drawing (MD12/MD64)                            │
│  • ETIM dimensions from database                            │
│                                                             │
│  Output:                                                    │
│  • Structured Symbol Specification (text)                   │
│  • Layers, geometry, dimensions, mounting type              │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: Script Generation (Sonnet → Opus on retry)        │
├─────────────────────────────────────────────────────────────┤
│  Input:                                                     │
│  • Symbol Specification from Stage 1                        │
│  • Product ID                                               │
│                                                             │
│  Output:                                                    │
│  • AutoLISP script (.scr)                                   │
│  • SVG representation                                       │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Stage 3: APS Design Automation                             │
├─────────────────────────────────────────────────────────────┤
│  • Upload script to Autodesk cloud                          │
│  • Execute in headless AutoCAD                              │
│  • Generate DWG + PNG files                                 │
│  • Up to 3 retries with error feedback to LLM               │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│  Storage: Supabase                                          │
├─────────────────────────────────────────────────────────────┤
│  Bucket: product-symbols                                    │
│  Files: {FOSS_PID}/symbol.dwg, symbol.png, symbol.svg       │
│  Metadata: items.product_symbols table                      │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/
│   ├── planner/
│   │   └── components/
│   │       ├── symbol-modal.tsx      # Modal with generate UI
│   │       ├── symbol-gallery.tsx    # PNG/SVG carousel display
│   │       └── products-grid.tsx     # Product cards with symbols
│   └── api/
│       └── symbol-generator/
│           ├── analyze/route.ts      # Stage 1: Vision analysis
│           ├── generate/route.ts     # Stage 2+3: Script + APS
│           └── download/[jobId]/route.ts
└── lib/
    └── symbol-generator/
        ├── prompts/                  # ⭐ EXTERNAL PROMPT FILES
        │   ├── vision-analysis.md    # Stage 1 system prompt
        │   └── script-generation.md  # Stage 2 system prompt
        ├── prompts.ts                # Loads vision-analysis.md
        ├── script-prompts.ts         # Loads script-generation.md
        ├── types.ts                  # TypeScript interfaces
        ├── dimension-utils.ts        # ETIM dimension extraction
        ├── vision-service.ts         # OpenRouter vision API
        ├── script-service.ts         # Script generation + retry
        └── symbol-aps-service.ts     # APS Design Automation
```

## External Prompt Files

**Location**: `src/lib/symbol-generator/prompts/`

LLM prompts are stored in external markdown files for easy editing without modifying TypeScript code.

### vision-analysis.md

System prompt for Stage 1 (Vision Analysis):
- Analyzes product images and technical drawings
- Uses ETIM dimensions as authoritative source
- Outputs structured Symbol Specification with layers and geometry

**Key sections to customize**:
- `## Output Format` - Layer names, colors, structure
- `## Shape Recognition Guidelines` - How to identify fixture types
- `## DXF Color Codes` - Layer-to-color mapping

### script-generation.md

System prompt for Stage 2 (Script Generation):
- Converts Symbol Specification to AutoLISP
- Also generates SVG for web display
- Includes entmake patterns for all geometry types

**Key sections to customize**:
- `## Layer Commands` - AutoLISP layer setup
- `## DXF Color Codes` - Color numbers for layers
- `## Entity Creation with entmake` - Geometry patterns
- `## SVG Rules` - Web display styling

### Editing Prompts

1. Edit the markdown file directly
2. Restart the dev server (or wait for hot reload)
3. Test with a product in the Planner

Changes take effect immediately - no code changes required.

## Database Schema

### product_symbols table (items schema)

```sql
CREATE TABLE items.product_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  foss_pid TEXT UNIQUE NOT NULL,
  dwg_path TEXT,           -- Path in storage: {foss_pid}/symbol.dwg
  png_path TEXT,           -- Path in storage: {foss_pid}/symbol.png
  svg_path TEXT,           -- Path in storage: {foss_pid}/symbol.svg
  generated_at TIMESTAMPTZ,
  generation_model TEXT,   -- Model used (e.g., 'claude-sonnet-4')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Storage Bucket

- **Bucket**: `product-symbols` (public)
- **Structure**: `{FOSS_PID}-SYMBOL.{ext}` (flat naming)
- **Files**: `.dwg`, `.png`, `.svg`
- **Example**: `DT20229692W-SYMBOL.dwg`, `DT20229692W-SYMBOL.png`

## API Endpoints

### POST /api/symbol-generator/analyze

Stage 1: Vision analysis

**Request**:
```json
{
  "product": { /* ProductInfo */ }
}
```

**Response**:
```json
{
  "success": true,
  "description": "## SYMBOL SPECIFICATION\n...",
  "model": "anthropic/claude-sonnet-4",
  "tokensIn": 3000,
  "tokensOut": 600,
  "costUsd": 0.02,
  "hadImage": true,
  "hadDrawing": true
}
```

### POST /api/symbol-generator/generate

Stage 2+3: Script generation + APS execution

**Request**:
```json
{
  "product": { /* ProductInfo */ },
  "spec": "## SYMBOL SPECIFICATION\n...",
  "dimensions": { /* LuminaireDimensions */ },
  "saveToSupabase": true
}
```

**Response**:
```json
{
  "success": true,
  "jobId": "sym_abc123"
}
```

Returns immediately with jobId. Poll `/api/symbol-generator/download/{jobId}` for progress and results.

## Cost & Rate Limits

### Vision Analysis (Stage 1)
- ~$0.02 per request
- Model: anthropic/claude-sonnet-4
- Rate limit: 20/min per user

### Script Generation (Stage 2)
- ~$0.01 (Sonnet) to ~$0.05 (Opus on retry)
- Models: claude-sonnet-4 → claude-opus-4
- Rate limit: 10/min per user

### APS Design Automation
- ~$0.001 per work item (Autodesk credits)
- Processing time: 30-60 seconds

## Error Handling & Retry

The pipeline has automatic retry with error feedback:

1. **Attempt 1**: Sonnet generates script → APS executes
2. **If APS fails**: Extract error, feed back to Opus
3. **Attempt 2**: Opus corrects script → APS executes
4. **Attempt 3**: Final attempt with Opus

Error context from APS is fed back to the LLM for intelligent correction.

## Environment Variables

```bash
OPENROUTER_API_KEY=sk-or-...          # OpenRouter API key
APS_CLIENT_ID=...                      # Autodesk Platform Services
APS_CLIENT_SECRET=...
APS_CALLBACK_URL=...
```

## Known Limitations

1. **Complex shapes**: Irregular geometries may not be accurately generated
2. **Cutout estimation**: Many products lack built-in dimensions in ETIM
3. **APS cold start**: First request after idle may take longer (~90s)
4. **SVG colors**: White strokes require dark background for visibility

## Future Enhancements

- [ ] Block library support (insert pre-defined blocks)
- [ ] Multi-aperture patterns (LED arrays, spots)
- [ ] Symbol versioning and history
- [ ] Batch generation for product families
