/**
 * XREF Generator Configuration
 *
 * APS Design Automation configuration for XREF generation.
 *
 * @module case-study/xref-config
 */

export const APS_CONFIG = {
  clientId: process.env.APS_CLIENT_ID || '',
  clientSecret: process.env.APS_CLIENT_SECRET || '',
  activityName: 'fossappXrefAct',
  engineVersion: 'Autodesk.AutoCAD+25_1',
  processingTimeoutMinutes: 10,
  maxPollingAttempts: 300, // 10 min at 2-second intervals
}

export const DA_BASE_URL = 'https://developer.api.autodesk.com/da/us-east/v3'
