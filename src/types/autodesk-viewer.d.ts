/**
 * Autodesk Viewer Type Definitions
 *
 * Shared types for both GuiViewer3D (with built-in toolbar) and Viewer3D (no GUI).
 * Used by:
 * - src/components/tiles/dwg-viewer.tsx (GuiViewer3D)
 * - src/components/planner/planner-viewer.tsx (Viewer3D)
 */

interface ViewerInitOptions {
  env: string
  api: string
  getAccessToken: (callback: (token: string, expires: number) => void) => void
  /** A link to a help page on WebGL if it's disabled */
  webGLHelpLink?: string
}

interface ViewerConfig {
  extensions?: string[]
}

interface ViewerNavigation {
  setZoomTowardsPivot: (value: boolean) => void
  setReverseZoomDirection?: (value: boolean) => void
}

interface ToolController {
  registerTool: (tool: unknown) => void
  activateTool: (toolName: string) => boolean
  deactivateTool: (toolName: string) => boolean
  getActiveToolName: () => string
  getTool?: (toolName: string) => unknown
}

interface ViewerDocument {
  getRoot: () => BubbleNode
}

interface BubbleNode {
  getDefaultGeometry: () => Viewable
}

interface Viewable {
  data?: {
    guid: string
  }
}

interface WorldCoordinates {
  x: number
  y: number
  z: number
}

/**
 * Result from clientToWorld ray cast
 */
interface ClientToWorldResult {
  point: WorldCoordinates
  face?: unknown
  fragId?: number
  dbId?: number
}

/**
 * Viewer Model - provides access to model metadata and units
 */
interface ViewerModel {
  getUnitString?: () => string | null
  getDisplayUnit?: () => string | null
  getUnitScale?: () => number | null
  getMetadata?: (itemName: string, subitemName?: string, defaultValue?: unknown) => unknown
}

/**
 * GuiViewer3D - Viewer with built-in toolbar inside the canvas
 * Used by tiles/dwg-viewer.tsx
 */
interface GuiViewer3DInstance {
  /** Start the viewer. Returns 0 on success, >0 on failure (e.g., WebGL not supported) */
  start: () => number
  finish: () => void
  loadDocumentNode: (doc: ViewerDocument, viewable: Viewable) => Promise<void>
  setTheme: (theme: 'light-theme' | 'dark-theme') => void
  /** Set background gradient color (top RGB, bottom RGB) - values 0-255 */
  setBackgroundColor: (topR: number, topG: number, topB: number, bottomR: number, bottomG: number, bottomB: number) => void
  resize: () => void
  container: HTMLElement
  navigation: ViewerNavigation
  toolController: ToolController
  fitToView: (objectIds?: number[], model?: unknown, immediate?: boolean) => void
  addEventListener: (event: string, callback: (e: unknown) => void) => void
  removeEventListener: (event: string, callback: (e: unknown) => void) => void
}

/**
 * Viewer3D - Viewer without built-in GUI (custom toolbar)
 * Used by planner/planner-viewer.tsx
 */
interface Viewer3DInstance {
  /** Start the viewer. Returns 0 on success, >0 on failure (e.g., WebGL not supported) */
  start: () => number
  finish: () => void
  loadDocumentNode: (doc: ViewerDocument, viewable: Viewable) => Promise<void>
  setTheme: (theme: 'light-theme' | 'dark-theme') => void
  /** Set background gradient color (top RGB, bottom RGB) - values 0-255 */
  setBackgroundColor: (topR: number, topG: number, topB: number, bottomR: number, bottomG: number, bottomB: number) => void
  /** Reverse the default direction for camera dolly (zoom) operations */
  setReverseZoomDirection: (value: boolean) => void
  /** Set the view to the default view defined in the source file */
  setViewFromFile: (model?: unknown) => void
  resize: () => void
  container: HTMLElement
  navigation: ViewerNavigation
  toolController: ToolController
  fitToView: (objectIds?: number[], model?: unknown, immediate?: boolean) => void
  clientToWorld: (clientX: number, clientY: number) => ClientToWorldResult | null
  worldToClient: (point: WorldCoordinates) => { x: number; y: number } | null
  addEventListener: (event: string, callback: (e: unknown) => void) => void
  removeEventListener: (event: string, callback: (e: unknown) => void) => void
  getExtension: (extensionId: string) => unknown
  /** The currently loaded model (available after loadDocumentNode completes) */
  model?: ViewerModel
  /** Internal implementation with low-level APIs */
  impl?: {
    createOverlayScene: (name: string) => boolean
    addOverlay: (sceneName: string, mesh: unknown) => void
    removeOverlay: (sceneName: string, mesh: unknown) => void
    clearOverlay: (sceneName: string) => void
    invalidate: (needsClear?: boolean) => void
    intersectGround: (clientX: number, clientY: number) => WorldCoordinates | null
    getVisibleBounds?: () => { min: WorldCoordinates; max: WorldCoordinates } | null
    camera?: unknown
  }
}

// ============================================================================
// Edit2D Extension Types
// ============================================================================

/**
 * Edit2D Shape - Represents a 2D shape in the Edit2D layer
 *
 * Shapes are managed objects with built-in support for:
 * - Selection and hover
 * - Move/rotate/resize via gizmos
 * - Undo/redo tracking
 * - Style customization
 */
interface Edit2DShape {
  id: number
  style: Edit2DStyle
  /** Export shape as SVG string */
  toSVG: (options?: { exportStyle?: boolean }) => string
  /** Get bounding box */
  getBBox: () => { min: { x: number; y: number }; max: { x: number; y: number } }
  /** Set position (world/page coordinates) */
  setPosition: (x: number, y: number) => void
  /** Get position */
  getPosition: () => { x: number; y: number }
  /** Apply transformation matrix */
  applyMatrix: (matrix: number[]) => void
}

/**
 * Edit2D Style - Visual styling for shapes
 */
interface Edit2DStyle {
  fillColor: string
  fillAlpha: number
  lineColor: string
  lineWidth: number
  lineStyle: number
  clone: () => Edit2DStyle
}

/**
 * Edit2D Layer - Container for shapes
 */
interface Edit2DLayer {
  shapes: Edit2DShape[]
  /** Update layer display after style changes */
  update: () => void
  /** Add a style modifier function */
  addStyleModifier: (modifier: (shape: Edit2DShape, style: Edit2DStyle) => Edit2DStyle | undefined) => void
}

/**
 * Edit2D Selection Manager
 */
interface Edit2DSelection {
  /** Select a single shape (deselects others) */
  selectOnly: (shape: Edit2DShape) => void
  /** Add shape to selection */
  addToSelection: (shape: Edit2DShape) => void
  /** Clear selection */
  clear: () => void
  /** Set hover highlight */
  setHoverID: (id: number) => void
  /** Get selected shapes */
  getSelectedShapes: () => Edit2DShape[]
  /** Event listener for selection changes */
  addEventListener: (event: string, callback: (event: unknown) => void) => void
  removeEventListener: (event: string, callback: (event: unknown) => void) => void
}

/**
 * Edit2D Context - Main API for shape manipulation
 */
interface Edit2DContext {
  /** The shape layer */
  layer: Edit2DLayer
  /** Temporary layer for gizmos/indicators */
  gizmoLayer: Edit2DLayer
  /** Undo/redo manager */
  undoStack: {
    undo: () => void
    redo: () => void
    canUndo: () => boolean
    canRedo: () => boolean
  }
  /** Selection manager */
  selection: Edit2DSelection
  /** Snapping helper */
  snapper: unknown
  /** Add shape to layer (with undo tracking) */
  addShape: (shape: Edit2DShape) => void
  /** Remove shape from layer (with undo tracking) */
  removeShape: (shape: Edit2DShape) => void
  /** Clear all shapes */
  clearLayer: () => void
}

/**
 * Edit2D InsertSymbol Tool - Click to place custom symbols
 */
interface Edit2DInsertSymbolTool {
  /** The symbol shape to insert on click */
  symbol: Edit2DShape | null
  getName: () => string
  isActive: () => boolean
}

/**
 * Edit2D Default Tools
 */
interface Edit2DDefaultTools {
  insertSymbolTool: Edit2DInsertSymbolTool
  polygonTool: unknown
  polylineTool: unknown
  polygonEditTool: {
    getName: () => string
    isActive: () => boolean
    setAreaLabelVisible: (visible: boolean) => void
    setLengthLabelVisible: (visible: boolean) => void
  }
}

/**
 * Edit2D Shape Label - Text label attached to a shape
 */
interface Edit2DShapeLabel {
  setText: (text: string) => void
  getText: () => string
  setVisible: (visible: boolean) => void
}

/**
 * Edit2D Extension - Main entry point
 */
interface Edit2DExtension {
  /** Register default drawing tools (polygon, polyline, insertSymbol, etc.) */
  registerDefaultTools: () => void
  /** Default drawing context with layer, selection, undoStack */
  defaultContext: Edit2DContext
  /** Default tools (available after registerDefaultTools) */
  defaultTools: Edit2DDefaultTools
}

/**
 * EllipseArcParams - Parameters for ellipse arc segments in PolygonPath
 *
 * These parameters follow the SVG arc command specification for defining
 * elliptical arc curves between two points.
 */
interface Edit2DEllipseArcParams {
  /** Center X coordinate */
  cx: number
  /** Center Y coordinate */
  cy: number
  /** Radius X (horizontal radius of the ellipse) */
  rx: number
  /** Radius Y (vertical radius of the ellipse) */
  ry: number
  /** Rotation of the ellipse in degrees */
  rotation: number
  /** Large arc flag: if true, use the larger of the two possible arcs */
  largeArcFlag: boolean
  /** Sweep flag: if true, draw arc in positive-angle direction (clockwise) */
  sweepFlag: boolean
  /** Start angle in radians (optional) */
  startAngle?: number
  /** End angle in radians (optional) */
  endAngle?: number
  /** Whether arc is clockwise (optional, alternative to sweepFlag) */
  isClockwise?: boolean
}

/**
 * Edit2D Namespace - Static utilities
 */
interface Edit2DNamespace {
  /** Create shape from SVG path string */
  Shape: {
    fromSVG: (svgString: string) => Edit2DShape
  }
  /** Polygon shape constructor - takes array of {x, y} points */
  Polygon: new (points: Array<{ x: number; y: number }>) => Edit2DShape
  /** PolygonPath constructor - polygon with arc edges (for circles/ellipses) */
  PolygonPath: new (points: Array<{ x: number; y: number }>) => Edit2DShape & {
    /** Set an edge to be an ellipse arc */
    setEllipseArc: (edgeIndex: number, params: Edit2DEllipseArcParams) => void
  }
  /** Polyline constructor - for line shapes */
  Polyline: new (points: Array<{ x: number; y: number }>) => Edit2DShape
  /** Ellipse arc parameters constructor */
  EllipseArcParams: new () => Edit2DEllipseArcParams
  /** Shape label constructor */
  ShapeLabel: new (shape: Edit2DShape, layer: Edit2DLayer) => Edit2DShapeLabel
  /** Edge label constructor */
  EdgeLabel: new (layer: Edit2DLayer) => {
    attachToEdge: (shape: Edit2DShape, edgeIndex: number) => void
    setText: (text: string) => void
  }
  /** SVG export utilities */
  Svg: {
    createSvgElement: (shapes: Edit2DShape[], options?: { dstBox?: DOMRect }) => SVGSVGElement
  }
  /** Selection event names */
  Selection: {
    Events: {
      SELECTION_CHANGED: string
      SELECTION_HOVER_CHANGED: string
    }
  }
  /** Unit handler for coordinate conversion */
  SimpleUnitHandler: new (viewer: Viewer3DInstance) => {
    layerUnit: string
    displayUnits: string
    digits: number
  }
}

declare global {
  interface Window {
    Autodesk: {
      Viewing: {
        Initializer: (options: ViewerInitOptions, callback: () => void) => void
        GuiViewer3D: new (container: HTMLElement, config?: ViewerConfig) => GuiViewer3DInstance
        Viewer3D: new (container: HTMLElement, config?: ViewerConfig) => Viewer3DInstance
        Document: {
          load: (
            urn: string,
            onSuccess: (doc: ViewerDocument) => void,
            onError: (errorCode: number, errorMsg: string) => void
          ) => void
        }
        TOOL_CHANGE_EVENT: string
        CAMERA_CHANGE_EVENT: string
      }
      /** Edit2D extension namespace with static utilities */
      Edit2D: Edit2DNamespace
    }
  }
}

export {
  ViewerInitOptions,
  ViewerConfig,
  ViewerNavigation,
  ToolController,
  ViewerDocument,
  BubbleNode,
  Viewable,
  WorldCoordinates,
  ClientToWorldResult,
  ViewerModel,
  GuiViewer3DInstance,
  Viewer3DInstance,
  // Edit2D types
  Edit2DExtension,
  Edit2DContext,
  Edit2DShape,
  Edit2DStyle,
  Edit2DLayer,
  Edit2DSelection,
  Edit2DDefaultTools,
  Edit2DInsertSymbolTool,
  Edit2DShapeLabel,
  Edit2DNamespace,
}
