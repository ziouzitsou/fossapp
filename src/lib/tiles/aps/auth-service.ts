/**
 * APS Authentication Service
 * Handles 2-legged OAuth authentication with token caching
 */

import { SdkManagerBuilder, SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient } from '@aps_sdk/authentication'
import { APS_CONFIG } from './config'

export class APSAuthService {
  private sdkManager: SdkManager
  private authClient: AuthenticationClient
  private tokenCache: string | null = null
  private tokenExpiry: number | null = null

  constructor() {
    this.sdkManager = SdkManagerBuilder.create().build()
    this.authClient = new AuthenticationClient({ sdkManager: this.sdkManager })
  }

  /**
   * Get the SDK manager instance (needed by OSS service)
   */
  getSdkManager(): SdkManager {
    return this.sdkManager
  }

  /**
   * Get access token with caching
   * Automatically refreshes token 5 minutes before expiry
   */
  async getAccessToken(): Promise<string> {
    // Check cached token
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache
    }

    if (!APS_CONFIG.clientId || !APS_CONFIG.clientSecret) {
      throw new Error('APS credentials not configured. Check APS_CLIENT_ID and APS_CLIENT_SECRET')
    }

    const credentials = await this.authClient.getTwoLeggedToken(
      APS_CONFIG.clientId,
      APS_CONFIG.clientSecret,
      [...APS_CONFIG.scopes] // Spread to create mutable array
    )

    // Cache token with 5-minute buffer before expiry
    this.tokenCache = credentials.access_token
    this.tokenExpiry = Date.now() + (credentials.expires_in - 300) * 1000

    return this.tokenCache
  }

  /**
   * Clear cached token (useful for forcing re-authentication)
   */
  clearCache(): void {
    this.tokenCache = null
    this.tokenExpiry = null
  }
}
