# SVG Symbol Generation Plan

**Feature**: Generate SVG symbols alongside AutoLISP for web marker display
**Status**: ✅ Implemented
**Date**: 2025-12-30

---

## Overview

Enhance the symbol generation pipeline to produce SVG output alongside AutoLISP/DWG. SVGs will be used in the planner viewer markers for better scaling and AutoCAD-like appearance.

## Goals

1. **Better scaling** - SVG is vector, no pixelation at any zoom level
2. **Real coordinates** - SVG at 100mm viewBox maps to actual dimensions
3. **AutoCAD look** - Professional CAD symbol appearance
4. **Consistency** - Same LLM call generates both LISP and SVG

---

## Architecture

### Current Flow
```
Vision → Spec → LLM → LISP → APS → DWG + PNG → Storage
```

### New Flow
```
Vision → Spec → LLM → { LISP, SVG } → APS → DWG + PNG
                           ↓
                        Storage (SVG directly)
```

---

## Implementation Steps

### Step 1: Update Prompt (`script-prompts.ts`)

Add SVG generation instructions to `SYMBOL_TO_LISP_PROMPT`:

```markdown
## Output Requirements

Generate TWO outputs in a single response:

### 1. AutoLISP Script (```lisp block)
[existing instructions...]

### 2. SVG Symbol (```svg block)
Create an SVG representation of the same symbol:
- viewBox="0 0 100 100" (100mm × 100mm, centered at 50,50)
- Stroke colors matching AutoCAD DXF colors:
  - White (7) → #FFFFFF
  - Cyan (4) → #00FFFF
  - Yellow (2) → #FFFF00
  - Red (1) → #FF0000
- stroke-width="0.5" for normal lines
- stroke-dasharray="3,2" for DASHED linetype
- fill="none" for all shapes
- Scale: 1 SVG unit = 1mm
```

### Step 2: Update Script Service (`script-service.ts`)

Modify `extractScript()` to also extract SVG:

```typescript
interface ScriptGenerationResult {
  success: boolean
  script?: string      // AutoLISP
  svg?: string         // SVG markup
  error?: string
  // ... existing fields
}

function extractScript(response: string): { script: string | null; svg: string | null } {
  // Extract ```lisp ... ``` block
  const lispMatch = response.match(/```lisp\n([\s\S]*?)```/)
  const script = lispMatch ? lispMatch[1].trim() : null

  // Extract ```svg ... ``` block
  const svgMatch = response.match(/```svg\n([\s\S]*?)```/)
  const svg = svgMatch ? svgMatch[1].trim() : null

  return { script, svg }
}
```

### Step 3: Update Generate Route (`/api/symbol-generator/generate/route.ts`)

Save SVG to Supabase storage alongside PNG:

```typescript
// After APS success, also save SVG if available
if (llmResult.svg) {
  const svgPath = `${fossPid}/symbol.svg`
  await supabaseServer.storage
    .from('product-symbols')
    .upload(svgPath, llmResult.svg, {
      contentType: 'image/svg+xml',
      upsert: true,
    })

  // Update database record
  await supabaseServer
    .schema('items')
    .from('product_symbols')
    .update({ svg_path: svgPath })
    .eq('foss_pid', fossPid)
}
```

### Step 4: Update Progress Store

Add SVG to result type:

```typescript
// In progress-store.ts
result?: {
  // ... existing fields
  svgPath?: string
}
```

### Step 5: Update Marker System (`markup-markers.ts`)

Add SVG rendering capability:

```typescript
interface MarkerData {
  // ... existing fields
  svgPath?: string  // Path to SVG symbol
}

addMarkerAtMarkup(/* ... */) {
  // ... existing code

  if (data.svgPath) {
    // Render SVG symbol with letter badge
    this.renderSvgMarker(group, data.svgPath, label, radius)
  } else {
    // Fallback to current circle + letter
    this.renderCircleMarker(group, label, radius)
  }
}

private async renderSvgMarker(
  group: SVGElement,
  svgPath: string,
  label: string,
  radius: number
) {
  // Option A: Use <image> element with SVG URL
  const image = document.createElementNS(ns, 'image')
  image.setAttribute('href', `${SYMBOLS_BUCKET_URL}/${svgPath}`)
  image.setAttribute('width', String(radius * 2))
  image.setAttribute('height', String(radius * 2))
  image.setAttribute('x', String(-radius))
  image.setAttribute('y', String(-radius))
  image.setAttribute('transform', 'scale(1, -1)')  // Flip for DWG coords

  // Option B: Fetch and inline SVG content (better control)
  // const response = await fetch(`${SYMBOLS_BUCKET_URL}/${svgPath}`)
  // const svgContent = await response.text()
  // ... parse and inline

  // Add letter badge (small, bottom-right)
  const badge = this.createBadge(label, radius)

  group.appendChild(image)
  group.appendChild(badge)
}

private createBadge(label: string, radius: number): SVGElement {
  const badgeGroup = document.createElementNS(ns, 'g')
  const badgeRadius = radius * 0.4
  const offsetX = radius * 0.6
  const offsetY = radius * 0.6

  // Badge circle
  const circle = document.createElementNS(ns, 'circle')
  circle.setAttribute('cx', String(offsetX))
  circle.setAttribute('cy', String(-offsetY))  // Negative for DWG coords
  circle.setAttribute('r', String(badgeRadius))
  circle.setAttribute('fill', '#3b82f6')
  circle.setAttribute('stroke', '#ffffff')
  circle.setAttribute('stroke-width', String(badgeRadius * 0.2))

  // Badge text
  const text = document.createElementNS(ns, 'text')
  text.setAttribute('x', String(offsetX))
  text.setAttribute('y', String(-offsetY))
  text.setAttribute('text-anchor', 'middle')
  text.setAttribute('dominant-baseline', 'central')
  text.setAttribute('fill', '#ffffff')
  text.setAttribute('font-size', String(badgeRadius * 1.2))
  text.setAttribute('font-weight', 'bold')
  text.setAttribute('transform', `translate(${offsetX}, ${-offsetY}) scale(1, -1) translate(${-offsetX}, ${offsetY})`)
  text.textContent = label

  badgeGroup.appendChild(circle)
  badgeGroup.appendChild(text)
  return badgeGroup
}
```

### Step 6: Update Product Data Types

Ensure SVG path flows through to markers:

```typescript
// In revision-products-actions.ts
interface AreaRevisionProduct {
  // ... existing fields
  symbol_svg_path?: string  // Already exists
}

// In planner types
interface PanelProduct {
  // ... existing fields
  svgPath?: string
}
```

---

## SVG Template

Example SVG output for a recessed downlight:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <!-- Boundary (LUM-OUTLINE, White) - Diameter 163mm scaled to viewBox -->
  <circle cx="50" cy="50" r="40.75"
          stroke="#FFFFFF" stroke-width="0.5" fill="none"/>

  <!-- Cutout (LUM-CUTOUT, Cyan, Dashed) - Diameter 150mm -->
  <circle cx="50" cy="50" r="37.5"
          stroke="#00FFFF" stroke-width="0.5" fill="none"
          stroke-dasharray="3,2"/>

  <!-- Aperture (LUM-APERTURE, Yellow) - Diameter 130mm -->
  <circle cx="50" cy="50" r="32.5"
          stroke="#FFFF00" stroke-width="0.5" fill="none"/>

  <!-- Center Mark (LUM-CENTER, White) -->
  <line x1="47" y1="50" x2="53" y2="50" stroke="#FFFFFF" stroke-width="0.3"/>
  <line x1="50" y1="47" x2="50" y2="53" stroke="#FFFFFF" stroke-width="0.3"/>
</svg>
```

**Scaling notes:**
- Symbol specification uses mm, origin at (0,0)
- SVG viewBox is 100×100, center at (50,50)
- Scale factor: if symbol is 163mm diameter, scale to fit ~80% of viewBox
- Or: use actual mm dimensions if marker sizing handles scaling

---

## Color Mapping

| AutoCAD DXF | Color Name | SVG Hex |
|-------------|------------|---------|
| 1 | Red | #FF0000 |
| 2 | Yellow | #FFFF00 |
| 3 | Green | #00FF00 |
| 4 | Cyan | #00FFFF |
| 5 | Blue | #0000FF |
| 6 | Magenta | #FF00FF |
| 7 | White | #FFFFFF |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/symbol-generator/script-prompts.ts` | Add SVG generation instructions |
| `src/lib/symbol-generator/script-service.ts` | Extract SVG from response |
| `src/app/api/symbol-generator/generate/route.ts` | Save SVG to storage |
| `packages/tiles/src/progress/progress-store.ts` | Add svgPath to result |
| `src/components/planner/markup-markers.ts` | Render SVG in markers |
| `src/components/planner/types.ts` | Add svgPath to types |

---

## Rollout Plan

### Phase 1: Generation
1. Update prompts to request SVG
2. Extract and save SVG to storage
3. Test generation produces valid SVG

### Phase 2: Display
1. Update marker system to use SVG
2. Implement fallback for products without SVG
3. Test zoom/pan behavior

### Phase 3: Refinement
1. Tune SVG styling for dark/light backgrounds
2. Optimize badge positioning
3. Handle edge cases (very small/large symbols)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| LLM generates invalid SVG | Validate before saving, fallback to PNG |
| SVG doesn't match DWG exactly | Accept minor differences for web preview |
| Performance with many SVG markers | Cache fetched SVGs, use `<use>` elements |
| CORS issues | Supabase public bucket already configured |

---

## Success Criteria

- [ ] SVG generated alongside LISP in single LLM call
- [ ] SVG saved to `product-symbols/{foss_pid}/symbol.svg`
- [ ] Markers show SVG when available, letter badge visible
- [ ] Fallback to circle+letter when no SVG exists
- [ ] Smooth zoom/pan performance with SVG markers

---

## Estimated Effort

| Task | Estimate |
|------|----------|
| Prompt updates | 1 hour |
| Script service extraction | 30 min |
| API route SVG storage | 30 min |
| Marker SVG rendering | 2-3 hours |
| Testing & refinement | 1-2 hours |
| **Total** | **5-7 hours** |

---

**Next Steps**: Review plan, then implement Phase 1 (generation).
