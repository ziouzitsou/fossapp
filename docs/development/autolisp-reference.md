# AutoLISP Reference for DWG Generation

**Last Updated**: 2025-12-14

This document covers AutoLISP patterns used across FOSSAPP for generating DWG files via APS Design Automation.

---

## Features Using AutoLISP

| Feature | Prompt Location | Description |
|---------|-----------------|-------------|
| **Tiles** | `src/lib/tiles/script-generator.ts` | Programmatic tile layout generation |
| **Playground** | `src/lib/playground/prompts.ts` | Natural language to DWG |
| **Symbol Generator** | `src/lib/symbol-generator/script-prompts.ts` | Luminaire plan-view symbols |

---

## Script Structure

All generated scripts follow this structure:

```lisp
(setvar "cmdecho" 0)
(setvar "filedia" 0)

; === SET METRIC UNITS (mm) ===
(command "-DWGUNITS" 3 2 2 "Y" "Y" "N")

; === LAYER SETUP ===
; Create layers with colors

; === GEOMETRY ===
; Draw entities

; === FINALIZE ===
(command "ZOOM" "E")
(command "SAVEAS" "2018" "OutputName.dwg")
```

**Critical Rules:**
- `filedia=0` - Required for headless operation
- `SAVEAS` - Required for output (without it, no DWG is created)
- **NO QUIT** - APS handles process termination

---

## DWGUNITS Command

Sets drawing units to metric/millimeters. **Must be included in all DWG generation.**

```lisp
(command "-DWGUNITS" 3 2 2 "Y" "Y" "N")
```

### Parameters

| Position | Value | Meaning |
|----------|-------|---------|
| 1 | `3` | Linear units = Millimeters |
| 2 | `2` | Linear display format = Decimal |
| 3 | `2` | Linear display precision = 0.00 |
| 4 | `"Y"` | Scale objects from other drawings = Yes |
| 5 | `"Y"` | Match INSUNITS to drawing units = Yes |
| 6 | `"N"` | Reset scale list = No |

### Unit Codes

| Code | Unit |
|------|------|
| 1 | Inches |
| 2 | Feet |
| 3 | Millimeters |
| 4 | Centimeters |
| 5 | Meters |
| 6 | Decimeters |

---

## Entity Creation with entmake

### LINE
```lisp
(entmake '((0 . "LINE") (8 . "LAYER") (10 X1 Y1 0.0) (11 X2 Y2 0.0)))
```

### CIRCLE
```lisp
(entmake '((0 . "CIRCLE") (8 . "LAYER") (10 CX CY 0.0) (40 . RADIUS)))
```
**Note**: Specifications often give DIAMETER - always divide by 2 for radius!

### ARC
```lisp
(entmake '((0 . "ARC") (8 . "LAYER") (10 CX CY 0.0) (40 . RADIUS) (50 . START_RAD) (51 . END_RAD)))
```
**Note**: Angles in RADIANS! `(* degrees (/ pi 180))`

### LWPOLYLINE (Closed Rectangle)
```lisp
(entmake '(
  (0 . "LWPOLYLINE")
  (100 . "AcDbEntity")
  (8 . "LAYER")
  (100 . "AcDbPolyline")
  (90 . 4)           ; Number of vertices
  (70 . 1)           ; 1=closed, 0=open
  (10 -HW -HL)       ; Bottom-left
  (10 HW -HL)        ; Bottom-right
  (10 HW HL)         ; Top-right
  (10 -HW HL)        ; Top-left
))
```

### MTEXT (Multiline Text)
```lisp
(entmake (list
  '(0 . "MTEXT")
  '(100 . "AcDbEntity")
  '(8 . "LAYER")
  '(100 . "AcDbMText")
  '(10 X Y 0.0)      ; Insertion point
  '(40 . HEIGHT)     ; Text height
  '(41 . WIDTH)      ; Column width
  '(71 . 5)          ; Attachment: 1=TL,2=TC,3=TR,4=ML,5=MC,6=MR,7=BL,8=BC,9=BR
  (cons 1 "Your text")
))
```

### TEXT (Single Line)
```lisp
(entmake '(
  (0 . "TEXT")
  (100 . "AcDbEntity")
  (8 . "LAYER")
  (100 . "AcDbText")
  (10 X Y 0.0)
  (40 . HEIGHT)
  (1 . "Text string")
  (100 . "AcDbText")
))
```

---

## Layer Commands

### Create Layer with Color
```lisp
(command "-LAYER" "Make" "LAYER_NAME" "Color" "COLOR_NUM" "" "")
```

### Load and Set Linetype (e.g., DASHED)
```lisp
(command "-LINETYPE" "Load" "DASHED" "" "")
(command "-LAYER" "Ltype" "DASHED" "LAYER_NAME" "")
```

### Set Current Layer
```lisp
(setvar "CLAYER" "LAYER_NAME")
```

---

## DXF Color Codes

| Code | Color |
|------|-------|
| 1 | Red |
| 2 | Yellow |
| 3 | Green |
| 4 | Cyan |
| 5 | Blue |
| 6 | Magenta |
| 7 | White |

Add color to entity: `(62 . COLOR_NUMBER)`

---

## Block Operations

### Create Block with entmake
```lisp
; 1. Start block definition
(entmake '((0 . "BLOCK") (2 . "BLOCKNAME") (10 0.0 0.0 0.0) (70 . 0)))

; 2. Add entities (no layer needed inside block)
(entmake '((0 . "LINE") (10 0.0 0.0 0.0) (11 10.0 0.0 0.0)))
(entmake '((0 . "CIRCLE") (10 5.0 5.0 0.0) (40 . 3.0)))

; 3. End block
(entmake '((0 . "ENDBLK") (8 . "0")))

; 4. Insert block
(entmake '((0 . "INSERT") (2 . "BLOCKNAME") (10 X Y 0.0) (41 . 1.0) (42 . 1.0) (50 . 0.0)))
```

### Block Insertion with command
```lisp
(command "-INSERT" "BLOCKNAME" "X,Y" "XSCALE" "YSCALE" "ROTATION")
```

---

## MTEXT Formatting Codes

| Code | Effect |
|------|--------|
| `\\P` | New line |
| `\\L...\\l` | Underline |
| `\\O...\\o` | Overline |
| `{\\C1;text}` | Color (1=red) |
| `{\\H1.5x;text}` | Height 1.5x |

---

## Key Rules Summary

1. **All dimensions in millimeters** - DWGUNITS sets this
2. **Angles are RADIANS** - `(* degrees (/ pi 180))`
3. **Points are 3D** - Always include Z coordinate (usually 0.0)
4. **DIAMETER to RADIUS** - Divide by 2 for entmake circles
5. **Layer auto-creates** - Using a new layer name in entmake creates it
6. **filedia=0** - Required for headless APS operation
7. **NO QUIT** - APS Design Automation handles process termination
8. **SAVEAS required** - Without it, no DWG output is created

---

## APS Design Automation Notes

- Scripts are executed in Autodesk's cloud environment
- No interactive dialogs available (filedia=0)
- Process termination handled by APS (no QUIT)
- Output files must be named explicitly in SAVEAS
- PNGOUT can be used for PNG export before SAVEAS

---

## Related Documentation

- [Tiles Feature](../features/tiles.md)
- [Playground Feature](../features/playground.md)
- [Symbol Generator Feature](../features/symbol-generator.md)
