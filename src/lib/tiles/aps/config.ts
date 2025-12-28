/**
 * APS Configuration
 * Centralized configuration for APS Design Automation services
 */

import { Scopes } from '@aps_sdk/authentication'

export const APS_CONFIG = {
  clientId: process.env.APS_CLIENT_ID || '',
  clientSecret: process.env.APS_CLIENT_SECRET || '',
  region: 'US', // Design Automation is in US region
  ossRegion: process.env.APS_REGION || 'EMEA', // OSS can be in EMEA
  scopes: [
    Scopes.BucketCreate,
    Scopes.BucketRead,
    Scopes.BucketDelete,
    Scopes.DataRead,
    Scopes.DataWrite,
    Scopes.DataCreate,
    Scopes.CodeAll,
  ],
  // Design Automation settings
  nickname: 'fossapp',
  appBundleName: 'tilebundle', // The existing permanent bundle
  activityName: 'fossappTileAct2',
  engineVersion: 'Autodesk.AutoCAD+25_1',
  // Processing limits
  processingTimeoutMinutes: 8,
  maxPollingAttempts: 240, // 8 minutes at 2-second intervals
} as const

/** Design Automation base URL */
export const DA_BASE_URL = 'https://developer.api.autodesk.com/da/us-east/v3'
