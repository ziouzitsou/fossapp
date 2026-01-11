/**
 * APS Model Derivative Translation Service
 *
 * Handles SVF2 translation for floor plan viewing:
 * - Start translation jobs
 * - Poll translation status
 * - Uses EMEA region for derivative storage
 *
 * @module planner/translation-service
 */

import { getAccessToken } from './auth'

/**
 * Start SVF2 translation job
 * Uses region header (EMEA) for proper derivative storage location
 *
 * @param urn - Base64-encoded URN of the source file
 * @returns Status of the translation job
 */
export async function translateToSVF2(urn: string): Promise<{ status: string }> {
  const accessToken = await getAccessToken()

  const response = await fetch(
    'https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'region': 'EMEA',
        'x-ads-force': 'true',
      },
      body: JSON.stringify({
        input: { urn },
        output: {
          formats: [{
            type: 'svf2',
            views: ['2d', '3d']
          }]
        }
      }),
    }
  )

  if (!response.ok && response.status !== 409) {
    const errorText = await response.text()
    throw new Error(`Translation job failed: ${response.status} - ${errorText}`)
  }

  const result = await response.json() as { result?: string }

  console.log(`[Planner] Translation started for URN: ${urn.substring(0, 20)}...`)

  return {
    status: result.result || 'created'
  }
}

/**
 * Get translation status from manifest
 *
 * @param urn - Base64-encoded URN
 * @returns Status, progress, and any error messages
 */
export async function getTranslationStatus(urn: string): Promise<{
  status: 'pending' | 'inprogress' | 'success' | 'failed'
  progress: string
  messages?: string[]
}> {
  const accessToken = await getAccessToken()

  try {
    const response = await fetch(
      `https://developer.api.autodesk.com/modelderivative/v2/regions/eu/designdata/${urn}/manifest`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { status: 'pending', progress: '0%' }
      }
      const errorText = await response.text()
      throw new Error(`Failed to get manifest: ${response.status} - ${errorText}`)
    }

    const manifest = await response.json() as {
      status: string
      progress?: string
      derivatives?: Array<{
        messages?: Array<{ message?: string } | string>
        progress?: string
      }>
    }

    const messages: string[] = []
    if (manifest.derivatives) {
      for (const derivative of manifest.derivatives) {
        if (derivative.messages) {
          for (const msg of derivative.messages) {
            if (typeof msg === 'object' && msg !== null && 'message' in msg) {
              messages.push(msg.message as string)
            }
          }
        }
      }
    }

    let progress = manifest.progress || '0%'
    if (progress === 'complete') {
      progress = '100% complete'
    }

    return {
      status: manifest.status as 'pending' | 'inprogress' | 'success' | 'failed',
      progress,
      messages: messages.length > 0 ? messages : undefined
    }
  } catch (err) {
    if (err instanceof Error) throw err
    throw new Error('Unknown error getting translation status')
  }
}
