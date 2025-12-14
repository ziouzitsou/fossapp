# Playground - DWG from Natural Language

**Route**: `/playground`
**Status**: Simple Mode (v1)
**Added**: December 2025

---

## Overview

The Playground allows users to generate DWG files by describing drawings in natural language. Claude generates AutoLISP scripts which are executed via APS Design Automation.

```
User Description → LLM (Claude) → AutoLISP Script → APS Design Automation → DWG File
```

---

## Current Implementation (Simple Mode)

Single-shot generation with smart retry:

1. User enters description (e.g., "Draw a 100mm x 50mm rectangle")
2. LLM generates AutoLISP script
3. APS executes script and returns DWG
4. User downloads the file

### Smart Retry with Model Escalation

| Attempt | Model | Behavior |
|---------|-------|----------|
| 1 | Claude Sonnet | Fast, cost-effective first try |
| 2 | Claude Opus | Smarter model with error context |
| 3 | Claude Opus | Final attempt with accumulated context |

On APS failure, error context is extracted and fed back to LLM for correction.

---

## Future: Chat Mode (v2)

Planned conversational interface:

- Multi-turn conversation for iterative refinement
- "Make the rectangle larger"
- "Add a circle in the center"
- "Change the color to red"
- Preview changes before final DWG generation
- Conversation history with context

---

## API Endpoints

### `POST /api/playground/generate`

Starts generation job.

**Request:**
```json
{
  "description": "Draw a door 80cm x 200cm with panel design",
  "outputFilename": "MyDrawing.dwg"
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job-1234567890-abc123def"
}
```

### `GET /api/playground/download/[jobId]`

Downloads the generated DWG file (available for 5 minutes after generation).

---

## Progress Streaming

Uses existing SSE infrastructure:
- Endpoint: `/api/tiles/stream/[jobId]`
- Component: `<TerminalLog />`
- Phases: `llm` → `aps` → `complete` or `error`

---

## Rate Limiting

- 10 generations per minute per user
- Configured in `src/lib/ratelimit.ts`

---

## Cost Tracking

Displays cost in EUR next to download button with tooltip showing:
- Model used (Sonnet/Opus)
- Tokens in
- Tokens out

Currency conversion: USD → EUR with caching (`src/lib/currency.ts`)

---

## System Prompt

Location: `src/lib/playground/prompts.ts`

The prompt teaches Claude to generate AutoLISP scripts for APS Design Automation:

### Key Sections

1. **Output Format** - .scr script structure with SAVEAS
2. **Entity Creation** - entmake patterns for LINE, CIRCLE, ARC, LWPOLYLINE, MTEXT, TEXT
3. **Commands** - RECTANG, -LAYER, -BLOCK, -INSERT
4. **DXF Codes** - Color codes, entity properties
5. **Rules** - Millimeters, radians, 3D points, no QUIT

### Prompt Summary

```
# DWG Creator - AutoLISP Script Generator

You are an expert AutoCAD automation assistant. You generate AutoLISP scripts
(.scr files) that create DWG drawings. The scripts will be executed via
Autodesk Platform Services (APS) Design Automation.

## Output Format
- Always output complete .scr script in ```lisp code block
- Start with setvar for cmdecho=0, filedia=0
- Set metric units: DWGUNITS 3 2 2 "Y" "Y" "N" (mm, decimal)
- End with ZOOM E and SAVEAS 2018
- NO QUIT - APS handles termination

## Entity Patterns
- LINE: (entmake '((0 . "LINE") (8 . "LAYER") (10 X1 Y1 0.0) (11 X2 Y2 0.0)))
- CIRCLE: (entmake '((0 . "CIRCLE") (8 . "LAYER") (10 CX CY 0.0) (40 . RADIUS)))
- MTEXT: Best for text, supports formatting
- LWPOLYLINE: For closed shapes with multiple vertices

## Key Rules
1. All dimensions in millimeters
2. Angles are RADIANS: (* degrees (/ pi 180))
3. Points are 3D: Always include Z (usually 0.0)
4. Layer auto-creates when used
```

Full prompt: ~230 lines with examples and reference tables.

---

## File Structure

```
src/
├── app/
│   ├── playground/
│   │   └── page.tsx                    # Playground page
│   └── api/playground/
│       ├── generate/route.ts           # Generation endpoint
│       └── download/[jobId]/route.ts   # Download endpoint
├── components/
│   ├── playground/
│   │   ├── playground-form.tsx         # Form with terminal
│   │   └── playground-viewer-modal.tsx # DWG viewer modal
│   └── tiles/
│       └── dwg-viewer.tsx              # Shared DWG viewer component
└── lib/
    ├── playground/
    │   ├── llm-service.ts              # OpenRouter API integration
    │   └── prompts.ts                  # System prompt
    └── tiles/
        └── aps-viewer.ts               # Viewer token & translation service
```

---

## Environment Variables

```bash
OPENROUTER_API_KEY=sk-or-v1-...   # Required for LLM calls
```

---

## Example Prompts

- "Draw a 100mm x 50mm rectangle with a 20mm radius circle in the center"
- "Draw a door 80cm x 200cm with a panel design and handle"
- "Draw a simple house outline with a triangular roof"
- "Draw a 3x3 grid of 25mm squares spaced 10mm apart"

---

## DWG Viewer

**Added**: December 2025

View generated DWGs directly in the browser using Autodesk Platform Services Viewer:

1. After generation completes, click **View** button
2. DWG is uploaded to transient bucket (24h retention)
3. SVF2 translation starts automatically
4. Full-featured Autodesk viewer loads in modal

### Viewer Features

- Pan, zoom, orbit controls
- 2D/3D view switching
- Layer visibility toggle
- Measurement tools
- Settings: 2D Sheet Color (dark/light theme)

### Technical Flow

```
DWG Buffer → Upload to OSS → Start SVF2 Translation → Poll Status → Load Viewer
```

- Uses EMEA region endpoints for Model Derivative API
- Viewer URN passed through job progress for instant viewing
- Falls back to download if viewer fails

---

## Dependencies

- OpenRouter API (Claude models via proxy)
- APS Design Automation (reuses tiles infrastructure)
- APS Model Derivative (SVF2 translation for viewer)
- SSE streaming (reuses tiles progress store)
