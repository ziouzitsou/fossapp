import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'

const CACHE_DIR = join('/tmp', '.image-cache')
const CACHE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
const FETCH_TIMEOUT = 30000 // 30 seconds for large images

// SSRF Protection: Only allow images from trusted domains
const ALLOWED_DOMAINS = [
  'deltalight.com',
  'www.deltalight.com',
  'meyer-lighting.com',
  'www.meyer-lighting.com',
  'dga.it',
  'www.dga.it',
  'supabase.co',
  'hyppizgiozyyyelwdius.supabase.co',
  'flagcdn.com',
]

/**
 * Validates that a URL is from an allowed domain to prevent SSRF attacks.
 * Blocks requests to internal networks (localhost, private IPs, etc.)
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)

    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false
    }

    // Block localhost and private IP ranges
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    ) {
      return false
    }

    // Check against whitelist
    return ALLOWED_DOMAINS.some(
      domain => hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

// Ensure cache directory exists
if (!existsSync(CACHE_DIR)) {
  mkdirSync(CACHE_DIR, { recursive: true })
}

function getCacheKey(url: string, width: number): string {
  const hash = createHash('md5').update(`${url}-${width}`).digest('hex')
  return join(CACHE_DIR, `${hash}.webp`)
}

function isCacheValid(cachePath: string): boolean {
  if (!existsSync(cachePath)) return false
  const stat = statSync(cachePath)
  const age = (Date.now() - stat.mtimeMs) / 1000
  return age < CACHE_MAX_AGE
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const width = parseInt(request.nextUrl.searchParams.get('w') || '128', 10)

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // SSRF Protection: Validate URL against whitelist
  if (!isAllowedUrl(url)) {
    console.warn('Image proxy blocked request to:', url.substring(0, 100))
    return NextResponse.json(
      { error: 'Domain not allowed' },
      { status: 403 }
    )
  }

  // Validate width
  const validWidth = Math.min(Math.max(width, 32), 512)
  const cachePath = getCacheKey(url, validWidth)

  // Return cached image if valid
  if (isCacheValid(cachePath)) {
    const cached = readFileSync(cachePath)
    return new NextResponse(new Uint8Array(cached), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
      },
    })
  }

  try {
    // Fetch with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TilesApp/1.0)',
      },
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }

    const buffer = await response.arrayBuffer()

    // Resize with Sharp (much faster than Next.js image optimizer for large files)
    const optimized = await sharp(Buffer.from(buffer))
      .resize(validWidth, validWidth, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toBuffer()

    // Cache the result
    writeFileSync(cachePath, optimized)

    return new NextResponse(new Uint8Array(optimized), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE}, immutable`,
      },
    })
  } catch (error) {
    console.error('Image proxy error:', error)
    // Return a 1x1 transparent pixel on error
    const placeholder = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    )
    return new NextResponse(new Uint8Array(placeholder), {
      status: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'public, max-age=60', // Short cache for errors
      },
    })
  }
}
