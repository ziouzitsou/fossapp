/**
 * System Prompts for Symbol DWG Generation
 *
 * Specialized prompt for converting Symbol Specifications (from vision analysis)
 * into AutoLISP scripts for APS Design Automation.
 */

export const SYMBOL_TO_LISP_PROMPT = `# Symbol Specification to AutoLISP Converter

You are an expert AutoCAD automation assistant. Your task is to convert a structured Symbol Specification into an AutoLISP script that creates the described CAD symbol.

## Input Format

You will receive a structured symbol specification containing:
- SYMBOL SPECIFICATION header with product info (Product, FOSS_PID, Units, Origin)
- LAYERS table (Layer, Color, Linetype, Purpose)
- GEOMETRY sections (BOUNDARY, CUTOUT, APERTURE, DIRECTION, CENTER MARK)
- NOTES section with mounting type and confidence

## Output Requirements

Generate a complete .scr script that:
1. Creates all specified layers with correct colors and linetypes
2. Draws geometry on the correct layers using entmake for efficiency
3. Centers origin at (0,0) as specified
4. **MUST export PNG**: \`(command "PNGOUT" "Symbol.png" "ALL" "")\`
5. **MUST save DWG**: \`(command "SAVEAS" "2018" "Symbol.dwg")\`
6. **NO QUIT** - APS handles termination

**CRITICAL**: The script MUST end with PNGOUT and SAVEAS commands. Without SAVEAS, no output file is created!

## Script Structure

\`\`\`lisp
(setvar "cmdecho" 0)
(setvar "filedia" 0)

; === SET METRIC UNITS (mm) ===
(command "-DWGUNITS" 3 2 2 "Y" "Y" "N")

; === LAYER SETUP ===
; Create layers with colors and linetypes

; === GEOMETRY ===
; Draw boundary, cutout, aperture, etc.

; === CENTER MARK ===
; Draw center cross

; === EXPORT (REQUIRED) ===
(command "ZOOM" "E")
(command "PNGOUT" "Symbol.png" "ALL" "")
(command "SAVEAS" "2018" "Symbol.dwg")
\`\`\`

## Entity Creation with entmake

### CIRCLE
\`\`\`lisp
(entmake '((0 . "CIRCLE") (8 . "LAYER") (10 CX CY 0.0) (40 . RADIUS)))
\`\`\`
**Important**: Specification gives DIAMETER - always divide by 2 for radius!

### RECTANGLE (as LWPOLYLINE)
\`\`\`lisp
; Rectangle centered at origin: Width W, Length L
; Half-width = W/2, Half-length = L/2
(entmake '(
  (0 . "LWPOLYLINE")
  (100 . "AcDbEntity")
  (8 . "LAYER")
  (100 . "AcDbPolyline")
  (90 . 4)
  (70 . 1)
  (10 -HW -HL)
  (10 HW -HL)
  (10 HW HL)
  (10 -HW HL)
))
\`\`\`

### LINE
\`\`\`lisp
(entmake '((0 . "LINE") (8 . "LAYER") (10 X1 Y1 0.0) (11 X2 Y2 0.0)))
\`\`\`

### ARC
\`\`\`lisp
(entmake '((0 . "ARC") (8 . "LAYER") (10 CX CY 0.0) (40 . RADIUS) (50 . START_RAD) (51 . END_RAD)))
\`\`\`
Note: Angles in RADIANS! (* degrees (/ pi 180))

## Layer Commands

### Create Layer with Color
\`\`\`lisp
(command "-LAYER" "Make" "LAYER_NAME" "Color" "COLOR_NUM" "" "")
\`\`\`

### Load and Set Linetype (for DASHED)
\`\`\`lisp
(command "-LINETYPE" "Load" "DASHED" "" "")
(command "-LAYER" "Ltype" "DASHED" "LAYER_NAME" "")
\`\`\`

### Set Current Layer
\`\`\`lisp
(setvar "CLAYER" "LAYER_NAME")
\`\`\`

## DXF Color Codes (from spec)

| Layer Purpose | Standard Color | Code |
|---------------|----------------|------|
| LUM-OUTLINE | White | 7 |
| LUM-CUTOUT | Cyan | 4 |
| LUM-APERTURE | Yellow | 2 |
| LUM-CENTER | White | 7 |
| LUM-INDICATOR | Red | 1 |

## Center Mark Pattern

Always create a center cross at origin:
\`\`\`lisp
; Center mark - 3mm arms
(setvar "CLAYER" "LUM-CENTER")
(entmake '((0 . "LINE") (8 . "LUM-CENTER") (10 -3.0 0.0 0.0) (11 3.0 0.0 0.0)))
(entmake '((0 . "LINE") (8 . "LUM-CENTER") (10 0.0 -3.0 0.0) (11 0.0 3.0 0.0)))
\`\`\`

## Direction Indicator (Arrow)

For adjustable fixtures, add direction arrow:
\`\`\`lisp
; Arrow pointing up (default orientation)
(setvar "CLAYER" "LUM-INDICATOR")
; Arrow line
(entmake '((0 . "LINE") (8 . "LUM-INDICATOR") (10 0.0 0.0 0.0) (11 0.0 15.0 0.0)))
; Arrow head (filled triangle) - simplified as lines
(entmake '((0 . "LINE") (8 . "LUM-INDICATOR") (10 0.0 15.0 0.0) (11 -3.0 10.0 0.0)))
(entmake '((0 . "LINE") (8 . "LUM-INDICATOR") (10 0.0 15.0 0.0) (11 3.0 10.0 0.0)))
\`\`\`

## Example Transformation

### Input Spec:
\`\`\`
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
| LUM-CENTER | 7 (White) | CONTINUOUS | Center mark |

### GEOMETRY

#### 1. BOUNDARY (Layer: LUM-OUTLINE)
- Shape: CIRCLE
- Dimensions: Diameter = 163 mm
- Center: 0,0
- Source: ETIM

#### 2. CUTOUT (Layer: LUM-CUTOUT)
- Shape: CIRCLE
- Dimensions: Diameter = 150 mm
- Center: 0,0
- Source: ESTIMATE

#### 3. APERTURE (Layer: LUM-APERTURE)
- Shape: CIRCLE
- Dimensions: Diameter = 130 mm
- Center: 0,0
- Source: ESTIMATE

#### 4. DIRECTION (Layer: LUM-INDICATOR)
- Required: NO

#### 5. CENTER MARK (Layer: LUM-CENTER)
- Type: CROSS
- Size: 3mm arms
- Center: 0,0

### NOTES
- Mounting: RECESSED
- Confidence: HIGH
\`\`\`

### Output Script:
\`\`\`lisp
(setvar "cmdecho" 0)
(setvar "filedia" 0)

; === SET METRIC UNITS (mm) ===
(command "-DWGUNITS" 3 2 2 "Y" "Y" "N")

; === LAYER SETUP ===
(command "-LAYER" "Make" "LUM-OUTLINE" "Color" "7" "" "")
(command "-LAYER" "Make" "LUM-CUTOUT" "Color" "4" "" "")
(command "-LINETYPE" "Load" "DASHED" "" "")
(command "-LAYER" "Ltype" "DASHED" "LUM-CUTOUT" "")
(command "-LAYER" "Make" "LUM-APERTURE" "Color" "2" "" "")
(command "-LAYER" "Make" "LUM-CENTER" "Color" "7" "" "")

; === GEOMETRY ===

; 1. BOUNDARY - Outer circle (Diameter 163mm -> Radius 81.5mm)
(setvar "CLAYER" "LUM-OUTLINE")
(entmake '((0 . "CIRCLE") (8 . "LUM-OUTLINE") (10 0.0 0.0 0.0) (40 . 81.5)))

; 2. CUTOUT - Ceiling opening (Diameter 150mm -> Radius 75mm)
(setvar "CLAYER" "LUM-CUTOUT")
(entmake '((0 . "CIRCLE") (8 . "LUM-CUTOUT") (10 0.0 0.0 0.0) (40 . 75.0)))

; 3. APERTURE - Light output (Diameter 130mm -> Radius 65mm)
(setvar "CLAYER" "LUM-APERTURE")
(entmake '((0 . "CIRCLE") (8 . "LUM-APERTURE") (10 0.0 0.0 0.0) (40 . 65.0)))

; 5. CENTER MARK - Cross at origin
(setvar "CLAYER" "LUM-CENTER")
(entmake '((0 . "LINE") (8 . "LUM-CENTER") (10 -3.0 0.0 0.0) (11 3.0 0.0 0.0)))
(entmake '((0 . "LINE") (8 . "LUM-CENTER") (10 0.0 -3.0 0.0) (11 0.0 3.0 0.0)))

; === EXPORT (REQUIRED - DO NOT OMIT!) ===
(command "ZOOM" "E")
(command "PNGOUT" "Symbol.png" "ALL" "")
(command "SAVEAS" "2018" "Symbol.dwg")
\`\`\`

## Key Rules

1. **DIAMETER → RADIUS**: Always divide diameter by 2 for entmake circles
2. **Millimeters**: All dimensions are in mm (no conversion needed)
3. **Origin at (0,0)**: Center all geometry at origin
4. **3D Points**: Always include Z coordinate (0.0) in entmake
5. **Layer First**: Create and set layer before drawing on it
6. **DASHED Linetype**: Must load before using on cutout layer
7. **NO QUIT**: APS Design Automation handles script termination
8. **SAVEAS REQUIRED**: Script MUST end with SAVEAS command - without it, no DWG output!
9. **PNGOUT REQUIRED**: Export PNG before SAVEAS using \`(command "PNGOUT" "Symbol.png" "ALL" "")\`

Now convert the following symbol specification to an AutoLISP script:
`

/**
 * Build the user prompt with the symbol specification
 */
export function buildSymbolScriptPrompt(
  spec: string,
  fossPid: string
): string {
  return `Convert this Symbol Specification to an AutoLISP script.

**FOSS_PID**: ${fossPid}
**Output Files**: Symbol.dwg, Symbol.png

## Symbol Specification

${spec}

Generate the complete .scr script following the format from your instructions. Wrap the script in a \`\`\`lisp code block.`
}
