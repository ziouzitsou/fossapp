/**
 * APS Authentication Service
 *
 * Handles 2-legged OAuth (client credentials) authentication with Autodesk Platform Services.
 * Provides token caching with automatic refresh before expiry.
 *
 * @remarks
 * 2-legged OAuth is for server-to-server authentication (no user context).
 * Tokens are cached and refreshed 5 minutes before expiry to prevent failures.
 * Used by all APS services (OSS, Design Automation, Model Derivative).
 *
 * @module tiles/aps/auth-service
 * @see {@link https://aps.autodesk.com/en/docs/oauth/v2/tutorials/get-2-legged-token/} Auth Docs
 */

import { SdkManagerBuilder, SdkManager } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient } from '@aps_sdk/authentication'
import { APS_CONFIG } from './config'

/**
 * Service for managing APS authentication tokens
 *
 * @remarks
 * Singleton-like usage recommended - create one instance per service module.
 * Thread-safe token caching (in single-threaded Node.js context).
 */
export class APSAuthService {
  private sdkManager: SdkManager
  private authClient: AuthenticationClient
  private tokenCache: string | null = null
  private tokenExpiry: number | null = null

  /**
   * Create an APS authentication service
   *
   * @remarks
   * Initializes the Autodesk SDK manager and authentication client.
   * Credentials come from APS_CONFIG (environment variables).
   */
  constructor() {
    this.sdkManager = SdkManagerBuilder.create().build()
    this.authClient = new AuthenticationClient({ sdkManager: this.sdkManager })
  }

  /**
   * Get the SDK manager instance
   *
   * @remarks
   * Required by OSSService to initialize BucketsApi and ObjectsApi.
   *
   * @returns The Autodesk SDK manager instance
   */
  getSdkManager(): SdkManager {
    return this.sdkManager
  }

  /**
   * Get an access token with automatic caching and refresh
   *
   * @remarks
   * - Returns cached token if still valid (> 5 min remaining)
   * - Fetches new token if cache is empty or near expiry
   * - Throws if APS credentials are not configured
   *
   * Token scopes are defined in APS_CONFIG and include bucket and data operations.
   *
   * @returns Valid access token for APS API calls
   * @throws Error if credentials not configured or authentication fails
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
   * Clear the cached token
   *
   * @remarks
   * Useful for forcing re-authentication after credential rotation
   * or when debugging authentication issues.
   */
  clearCache(): void {
    this.tokenCache = null
    this.tokenExpiry = null
  }
}
