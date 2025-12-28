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
} from '@fossapp/ui'
import {
  getUserPreferencesAction,
  updateViewPreferencesAction,
} from '@/lib/actions/user-preferences'
import {
  DEFAULT_VIEW_PREFERENCES,
  type ViewPreferences,
} from '@/lib/actions/user-preferences-types'
import { Eye, Monitor, RotateCcw } from 'lucide-react'

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

  const handleSliderChange = (value: number[]) => {
    const newValue = value[0]
    setPreferences(prev => ({ ...prev, marker_min_screen_px: newValue }))
    setHasChanges(newValue !== originalPrefs.marker_min_screen_px)
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
    setHasChanges(
      DEFAULT_VIEW_PREFERENCES.marker_min_screen_px !== originalPrefs.marker_min_screen_px
    )
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
          {/* Marker Minimum Size */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="marker-size" className="text-base font-medium">
                  Marker Minimum Size
                </Label>
                <p className="text-sm text-muted-foreground">
                  Minimum display size for markers when zoomed out (in pixels)
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
              <div
                className="rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs"
                style={{
                  width: preferences.marker_min_screen_px * 2,
                  height: preferences.marker_min_screen_px * 2,
                  fontSize: preferences.marker_min_screen_px * 0.8,
                }}
              >
                A1
              </div>
              <span className="text-xs text-muted-foreground">
                {preferences.marker_min_screen_px * 2}px diameter at minimum zoom
              </span>
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
