/**
 * APS Authentication Service
 *
 * Handles OAuth2 two-legged authentication for Autodesk Platform Services.
 * Provides both full-access tokens (server-to-server) and read-only viewer tokens.
 *
 * @module planner/auth
 */

import { SdkManagerBuilder } from '@aps_sdk/autodesk-sdkmanager'
import { AuthenticationClient, Scopes } from '@aps_sdk/authentication'
import { OssClient } from '@aps_sdk/oss'

// Configuration
const APS_CLIENT_ID = process.env.APS_CLIENT_ID!
const APS_CLIENT_SECRET = process.env.APS_CLIENT_SECRET!

// SDK Manager singleton
const sdkManager = SdkManagerBuilder.create().build()

// Client singletons (exported for use by other services)
export const authClient = new AuthenticationClient({ sdkManager })
export const ossClient = new OssClient({ sdkManager })

// Token cache
let tokenCache: { accessToken: string; expiresAt: number } | null = null

/**
 * Get full access token (server-to-server)
 * Cached until 5 minutes before expiration
 *
 * @returns Access token string
 */
export async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return tokenCache.accessToken
  }

  const credentials = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [
      Scopes.DataRead,
      Scopes.DataWrite,
      Scopes.DataCreate,
      Scopes.BucketCreate,
      Scopes.BucketRead,
      Scopes.BucketDelete,
      Scopes.ViewablesRead
    ]
  )

  tokenCache = {
    accessToken: credentials.access_token,
    expiresAt: Date.now() + (credentials.expires_in * 1000)
  }

  return credentials.access_token
}

/**
 * Get viewer-only token for client-side viewer
 * Does NOT use cache - generates fresh token each time
 *
 * @returns Token object with access_token and expires_in
 */
export async function getViewerToken(): Promise<{ access_token: string; expires_in: number }> {
  const credentials = await authClient.getTwoLeggedToken(
    APS_CLIENT_ID,
    APS_CLIENT_SECRET,
    [Scopes.DataRead, Scopes.ViewablesRead]
  )

  return {
    access_token: credentials.access_token,
    expires_in: credentials.expires_in
  }
}
