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
}

interface ViewerConfig {
  extensions?: string[]
}

interface ViewerNavigation {
  setZoomTowardsPivot: (value: boolean) => void
  setReverseZoomDirection?: (value: boolean) => void
}

interface ToolController {
  activateTool: (toolName: string) => boolean
  deactivateTool: (toolName: string) => boolean
  getActiveToolName: () => string
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
 * GuiViewer3D - Viewer with built-in toolbar inside the canvas
 * Used by tiles/dwg-viewer.tsx
 */
interface GuiViewer3DInstance {
  start: () => void
  finish: () => void
  loadDocumentNode: (doc: ViewerDocument, viewable: Viewable) => Promise<void>
  setTheme: (theme: 'light-theme' | 'dark-theme') => void
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
  start: () => void
  finish: () => void
  loadDocumentNode: (doc: ViewerDocument, viewable: Viewable) => Promise<void>
  setTheme: (theme: 'light-theme' | 'dark-theme') => void
  resize: () => void
  container: HTMLElement
  navigation: ViewerNavigation
  toolController: ToolController
  fitToView: (objectIds?: number[], model?: unknown, immediate?: boolean) => void
  clientToWorld: (clientX: number, clientY: number) => WorldCoordinates | null
  worldToClient: (point: WorldCoordinates) => { x: number; y: number } | null
  addEventListener: (event: string, callback: (e: unknown) => void) => void
  removeEventListener: (event: string, callback: (e: unknown) => void) => void
  getExtension: (extensionId: string) => unknown
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
      }
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
  GuiViewer3DInstance,
  Viewer3DInstance
}
