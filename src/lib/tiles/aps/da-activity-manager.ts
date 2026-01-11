/**
 * DA Activity Manager
 *
 * Manages Design Automation Activities for tile processing.
 * Activities define the "contract" for WorkItems (inputs, outputs, commands).
 *
 * @module tiles/aps/da-activity-manager
 */

import { APS_CONFIG, DA_BASE_URL } from './config'
import { APSAuthService } from './auth-service'

/**
 * Manager for Design Automation Activities
 *
 * @remarks
 * Creates dynamic Activities with variable image count to support
 * different tile configurations (1-50+ images per tile).
 */
export class DAActivityManager {
  constructor(private authService: APSAuthService) {}

  /**
   * Create a Design Automation Activity with dynamic image parameters
   *
   * @remarks
   * Activities define the "contract" for WorkItems:
   * - Engine version (AutoCAD 2025)
   * - Command line (accoreconsole.exe with script)
   * - Parameters (script input, tile output, N image inputs)
   *
   * This method creates an Activity with exactly the number of image
   * parameters needed, avoiding the "unused parameter" warnings.
   *
   * If Activity already exists (409), it's deleted and recreated.
   *
   * @param imageCount - Number of image parameters to define
   */
  async createDynamicActivity(imageCount: number): Promise<void> {
    const accessToken = await this.authService.getAccessToken()
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }

    // Build image parameters dynamically
    const imageParams: Record<string, { verb: string; description: string; required: boolean; localName: string }> = {}
    for (let i = 1; i <= imageCount; i++) {
      imageParams[`image${i}`] = {
        verb: 'get',
        description: `Image ${i}`,
        required: false,
        localName: `image${i}.png`,
      }
    }

    const activitySpec = {
      id: APS_CONFIG.activityName,
      engine: APS_CONFIG.engineVersion,
      commandLine: [`$(engine.path)\\accoreconsole.exe /s "$(args[script].path)"`],
      parameters: {
        script: {
          verb: 'get',
          description: 'AutoCAD script file to execute',
          required: true,
          localName: 'script.scr',
        },
        tile: {
          verb: 'put',
          description: 'Output DWG file',
          required: true,
          localName: 'Tile.dwg',
        },
        ...imageParams,
      },
      description: `Dynamic tile activity with ${imageCount} images`,
    }

    // Create Activity
    const createResponse = await fetch(`${DA_BASE_URL}/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify(activitySpec),
    })

    if (!createResponse.ok && createResponse.status !== 409) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create activity: ${errorText}`)
    }

    // If activity exists (409), delete and recreate
    if (createResponse.status === 409) {
      await this.deleteActivity()
      const retryResponse = await fetch(`${DA_BASE_URL}/activities`, {
        method: 'POST',
        headers,
        body: JSON.stringify(activitySpec),
      })
      if (!retryResponse.ok) {
        const errorText = await retryResponse.text()
        throw new Error(`Failed to recreate activity: ${errorText}`)
      }
    }

    // Create production alias
    const activityData = createResponse.status === 409
      ? { version: 1 }
      : await createResponse.json() as { version: number }

    const aliasResponse = await fetch(
      `${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}/aliases`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: 'production', version: activityData.version }),
      }
    )

    // Ignore 409 (alias exists) - it's fine
    if (!aliasResponse.ok && aliasResponse.status !== 409) {
      const errorText = await aliasResponse.text()
      console.warn(`Alias creation warning: ${errorText}`)
    }
  }

  /**
   * Delete the current Activity and all its aliases/versions
   *
   * @remarks
   * Non-blocking: errors are logged but not thrown.
   * Called in cleanup phase to avoid accumulating old Activity versions.
   */
  async deleteActivity(): Promise<void> {
    try {
      const accessToken = await this.authService.getAccessToken()
      const response = await fetch(
        `${DA_BASE_URL}/activities/${encodeURIComponent(APS_CONFIG.activityName)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }
      )
      // Ignore 404 (doesn't exist) - that's fine
      if (!response.ok && response.status !== 404 && response.status !== 204) {
        console.warn(`Activity deletion warning: ${response.status}`)
      }
    } catch (error) {
      // Non-blocking - don't throw
      console.warn('Activity cleanup error:', error)
    }
  }

  /**
   * Get Activity parameter definitions
   */
  async getActivityParameters(): Promise<{ parameters?: Record<string, unknown> } | null> {
    try {
      const accessToken = await this.authService.getAccessToken()
      const activityId = `${APS_CONFIG.nickname}.${APS_CONFIG.activityName}+production`
      const response = await fetch(`${DA_BASE_URL}/activities/${activityId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) return null
      return (await response.json()) as { parameters?: Record<string, unknown> }
    } catch {
      return null
    }
  }
}
