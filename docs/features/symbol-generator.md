# Symbol Generator

**Status**: Experimental / Test Tool
**Route**: `/symbol-generator`
**Last Updated**: 2024-12-09

## Overview

The Symbol Generator analyzes luminaire product images using Claude Vision (via OpenRouter) to generate structured specifications for AutoCAD plan-view symbols. This is a test/prototyping tool that outputs text descriptions which can be fed into an external LISP generator.

**Output**: Structured text specification (NOT AutoLISP code - user has separate tool for that)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  /symbol-generator                                          │
├─────────────────────────────────────────────────────────────┤
│  1. Search product (reuses /api/tiles/search)               │
│  2. Select product → show MD01 photo + MD12 drawing         │
│  3. Extract ETIM dimensions from features                   │
│  4. Click "Analyze" → send to Claude Vision                 │
│  5. Display structured specification                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Vision Analysis Pipeline                                   │
├─────────────────────────────────────────────────────────────┤
│  • Fetch MD01 (product photo) - JPEG/PNG                    │
│  • Fetch MD12 (technical drawing) - SVG → convert to PNG    │
│  • Extract ETIM dimensions from features JSONB              │
│  • Build multimodal prompt with images + dimensions         │
│  • Call OpenRouter (anthropic/claude-sonnet-4)              │
│  • Return structured specification                          │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── app/
│   ├── symbol-generator/
│   │   └── page.tsx                    # Main page
│   └── api/
│       └── symbol-generator/
│           └── analyze/
│               └── route.ts            # POST endpoint
├── components/
│   └── symbol-generator/
│       └── symbol-generator-form.tsx   # Main form component
└── lib/
    └── symbol-generator/
        ├── types.ts                    # TypeScript interfaces
        ├── dimension-utils.ts          # ETIM dimension extraction
        ├── prompts.ts                  # Vision system prompt
        └── vision-service.ts           # OpenRouter multimodal API
```

## Key Features

### 1. Product Search
- Reuses the existing tiles search API (`/api/tiles/search`)
- Search by FOSS PID or product name
- Local search history in localStorage

### 2. Image Processing
- **MD01 (Photo)**: Product appearance image - helps identify shape
- **MD12 (Drawing)**: Technical drawing with dimensions
- **SVG Conversion**: SVG drawings are converted to PNG using Sharp (Claude Vision doesn't support SVG)
- Images are base64 encoded for the multimodal API

### 3. ETIM Dimension Extraction

Extracts from `features` JSONB field using these ETIM feature IDs:

| Feature ID | Description | Use |
|------------|-------------|-----|
| EF001438 | Length | Outer dimension |
| EF000008 | Width | Outer dimension |
| EF001456 | Height | Outer dimension |
| EF000015 | Outer diameter | Circular fixtures |
| EF023168 | Built-in length | Cutout dimension |
| EF011933 | Built-in width | Cutout dimension |
| EF010795 | Built-in height/depth | Cutout dimension |
| EF009351 | Adjustability | Direction indicator |

### 4. Vision Analysis

Uses OpenRouter API with Claude Sonnet 4 for multimodal analysis:
- System prompt instructs structured output format
- ETIM dimensions marked as authoritative
- Estimated values tagged with `[ESTIMATE]`
- Source tracking (ETIM | DRAWING | ESTIMATE)

## Output Format

The tool generates structured specifications compatible with the external LISP generator:

```markdown
## SYMBOL SPECIFICATION
Product: DIRO SBL 927 W - Recessed Downlight
FOSS_PID: DT20229692W
Units: mm
Origin: Center (0,0)

### LAYERS
| Layer | Color | Linetype | Purpose |
|-------|-------|----------|---------|
| LUM-OUTLINE | 7 (White) | CONTINUOUS | Outer boundary |
| LUM-CUTOUT | 4 (Cyan) | DASHED | Ceiling opening |
| LUM-APERTURE | 2 (Yellow) | CONTINUOUS | Light output |

### GEOMETRY

#### 1. BOUNDARY (Layer: LUM-OUTLINE)
- Shape: CIRCLE
- Dimensions: Diameter = 163 mm
- Center: 0,0
- Source: ETIM (Outer diameter)

#### 2. CUTOUT (Layer: LUM-CUTOUT)
- Shape: CIRCLE
- Dimensions: Diameter = 150 mm [ESTIMATE]
- Center: 0,0
- Source: ESTIMATE

...
```

## Rate Limiting

- 20 requests per minute per user
- Configured in `src/lib/ratelimit.ts`

## Cost

Typical analysis costs ~$0.015-0.02 per request:
- Input tokens: ~3000 (images + prompt)
- Output tokens: ~500-600
- Model: anthropic/claude-sonnet-4

## Integration with External LISP Tool

The output is designed to be copy/pasted or fed into:
- **Location**: `/home/sysadmin/tools/dwg-creator/`
- **Tool**: `dwg_generator.py` - LLM-powered AutoLISP generator
- **Workflow**: Symbol spec → LISP generator → accoreconsole.exe → DWG file

## Environment Variables

Requires `OPENROUTER_API_KEY` in `.env.local`

## Known Limitations

1. **SVG dimension extraction**: While SVG is converted to PNG for vision, dimension text in SVGs may not be readable by the vision model
2. **Cutout estimation**: Many products don't have built-in dimensions in ETIM, requiring estimation
3. **Complex shapes**: Irregular shapes (L-shaped, custom profiles) may not be accurately described
4. **No LISP output**: This tool only generates specifications - LISP generation is separate

## Future Enhancements (Not Implemented)

- [ ] Direct integration with dwg_generator.py
- [ ] APS Design Automation for DWG creation
- [ ] Google Drive upload of generated symbols
- [ ] Batch processing multiple products
- [ ] Symbol library/catalog management
