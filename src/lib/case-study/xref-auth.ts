/**
 * XREF Generator Authentication
 *
 * APS OAuth2 authentication for Design Automation.
 *
 * @module case-study/xref-auth
 */

import { APS_CONFIG } from './xref-config'

/**
 * APS Authentication Service for XREF generation.
 * Handles OAuth2 two-legged authentication with token caching.
 */
export class XrefAuthService {
  private tokenCache: string | null = null
  private tokenExpiry: number | null = null

  /**
   * Get access token for APS API calls.
   * Cached until 5 minutes before expiration.
   *
   * @returns Access token string
   */
  async getAccessToken(): Promise<string> {
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache
    }

    if (!APS_CONFIG.clientId || !APS_CONFIG.clientSecret) {
      throw new Error('APS credentials not configured')
    }

    const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: APS_CONFIG.clientId,
        client_secret: APS_CONFIG.clientSecret,
        scope: 'bucket:create bucket:read bucket:delete data:read data:write data:create code:all',
      }),
    })

    if (!response.ok) {
      throw new Error(`APS auth failed: ${response.statusText}`)
    }

    const data = (await response.json()) as { access_token: string; expires_in: number }
    this.tokenCache = data.access_token
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000

    return this.tokenCache
  }
}
