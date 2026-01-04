'use client'

import { useEffect, useState } from 'react'
import { useDevSession } from '@/lib/use-dev-session'
import {
  Spinner,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Slider,
  Label,
  Button,
  ColorPicker,
  Switch,
} from '@fossapp/ui'
import {
  getUserPreferencesAction,
  updateViewPreferencesAction,
} from '@/lib/actions/user-preferences'
import {
  DEFAULT_VIEW_PREFERENCES,
  type ViewPreferences,
} from '@/lib/actions/user-preferences-types'
import { Eye, Monitor, MousePointer2, Palette, RotateCcw } from 'lucide-react'

// Gradient presets
const GRADIENT_PRESETS = [
  { name: 'Subtle Dark', top: '#2a2a2a', bottom: '#0a0a0a' },
  { name: 'Medium Contrast', top: '#404040', bottom: '#000000' },
  { name: 'Strong Contrast', top: '#606060', bottom: '#000000' },
  { name: 'Solid Black', top: '#000000', bottom: '#000000' },
] as const

export default function ViewSettingsPage() {
  const { data: session, status } = useDevSession()
  const [preferences, setPreferences] = useState<ViewPreferences>(DEFAULT_VIEW_PREFERENCES)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [originalPrefs, setOriginalPrefs] = useState<ViewPreferences>(DEFAULT_VIEW_PREFERENCES)

  useEffect(() => {
    async function loadPreferences() {
      if (session?.user?.email) {
        setLoading(true)
        const result = await getUserPreferencesAction(session.user.email)
        if (result.success && result.data) {
          setPreferences(result.data.view_preferences)
          setOriginalPrefs(result.data.view_preferences)
        }
        setLoading(false)
      }
    }

    if (status === 'authenticated') {
      loadPreferences()
    }
  }, [session?.user?.email, status])

  // Helper to check if preferences have changed
  const checkHasChanges = (newPrefs: ViewPreferences) => {
    return (
      newPrefs.marker_min_screen_px !== originalPrefs.marker_min_screen_px ||
      newPrefs.viewer_bg_top_color !== originalPrefs.viewer_bg_top_color ||
      newPrefs.viewer_bg_bottom_color !== originalPrefs.viewer_bg_bottom_color ||
      newPrefs.reverse_zoom_direction !== originalPrefs.reverse_zoom_direction
    )
  }

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0]
    const newPrefs = { ...preferences, marker_min_screen_px: newValue }
    setPreferences(newPrefs)
    setHasChanges(checkHasChanges(newPrefs))
  }

  const handleColorChange = (field: 'viewer_bg_top_color' | 'viewer_bg_bottom_color', value: string) => {
    const newPrefs = { ...preferences, [field]: value }
    setPreferences(newPrefs)
    setHasChanges(checkHasChanges(newPrefs))
  }

  const handlePresetSelect = (top: string, bottom: string) => {
    const newPrefs = { ...preferences, viewer_bg_top_color: top, viewer_bg_bottom_color: bottom }
    setPreferences(newPrefs)
    setHasChanges(checkHasChanges(newPrefs))
  }

  const handleReverseZoomChange = (checked: boolean) => {
    const newPrefs = { ...preferences, reverse_zoom_direction: checked }
    setPreferences(newPrefs)
    setHasChanges(checkHasChanges(newPrefs))
  }

  const handleSave = async () => {
    if (!session?.user?.email) return

    setSaving(true)
    const result = await updateViewPreferencesAction(session.user.email, preferences)
    if (result.success && result.data) {
      setOriginalPrefs(result.data.view_preferences)
      setHasChanges(false)
    }
    setSaving(false)
  }

  const handleReset = () => {
    setPreferences(DEFAULT_VIEW_PREFERENCES)
    setHasChanges(checkHasChanges(DEFAULT_VIEW_PREFERENCES))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Planner Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Planner View Settings
          </CardTitle>
          <CardDescription>
            Configure how elements appear in the floor plan viewer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Marker Label Size */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="marker-size" className="text-base font-medium">
                  Marker Label Size
                </Label>
                <p className="text-sm text-muted-foreground">
                  Minimum font size for symbol labels (A1, B2, etc.) in the floor plan viewer
                </p>
              </div>
              <div className="flex items-center gap-2 text-lg font-mono tabular-nums">
                <Monitor className="h-4 w-4 text-muted-foreground" />
                <span className="w-12 text-right">{preferences.marker_min_screen_px}</span>
                <span className="text-sm text-muted-foreground">px</span>
              </div>
            </div>

            <div className="pt-2">
              <Slider
                id="marker-size"
                value={[preferences.marker_min_screen_px]}
                onValueChange={handleSliderChange}
                min={8}
                max={32}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>8px (small)</span>
                <span>12px (default)</span>
                <span>32px (large / 4K)</span>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
              <span className="text-sm text-muted-foreground">Preview:</span>
              <span
                className="font-semibold text-white px-1.5 py-0.5 rounded"
                style={{
                  fontSize: Math.max(8, Math.round(preferences.marker_min_screen_px * 0.6)),
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                  backgroundColor: 'rgb(59, 130, 246)',
                }}
              >
                A1
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.max(8, Math.round(preferences.marker_min_screen_px * 0.6))}px font size
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t" />

          {/* Reverse Zoom Direction */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <MousePointer2 className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="reverse-zoom" className="text-base font-medium">
                  Reverse Zoom Direction
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Invert mouse wheel zoom behavior (scroll up to zoom out, like AutoCAD)
              </p>
            </div>
            <Switch
              id="reverse-zoom"
              checked={preferences.reverse_zoom_direction ?? false}
              onCheckedChange={handleReverseZoomChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Viewer Background Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Viewer Background
          </CardTitle>
          <CardDescription>
            Customize the floor plan viewer&apos;s background gradient
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="h-24 w-full rounded-lg border"
              style={{
                background: `linear-gradient(to bottom, ${preferences.viewer_bg_top_color || DEFAULT_VIEW_PREFERENCES.viewer_bg_top_color}, ${preferences.viewer_bg_bottom_color || DEFAULT_VIEW_PREFERENCES.viewer_bg_bottom_color})`,
              }}
            />
          </div>

          {/* Color Pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Top Color</Label>
              <ColorPicker
                value={preferences.viewer_bg_top_color || DEFAULT_VIEW_PREFERENCES.viewer_bg_top_color!}
                onChange={(color) => handleColorChange('viewer_bg_top_color', color)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bottom Color</Label>
              <ColorPicker
                value={preferences.viewer_bg_bottom_color || DEFAULT_VIEW_PREFERENCES.viewer_bg_bottom_color!}
                onChange={(color) => handleColorChange('viewer_bg_bottom_color', color)}
              />
            </div>
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <Label>Presets</Label>
            <div className="flex flex-wrap gap-2">
              {GRADIENT_PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => handlePresetSelect(preset.top, preset.bottom)}
                >
                  <div
                    className="h-4 w-4 rounded border"
                    style={{
                      background: `linear-gradient(to bottom, ${preset.top}, ${preset.bottom})`,
                    }}
                  />
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          className="gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to Defaults
        </Button>

        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <>
              <Spinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </div>
  )
}
