/**
 * Environment Variable Schema & Validation
 *
 * Single source of truth for all environment variables.
 * This file:
 * 1. Documents all required/optional env vars
 * 2. Validates them at runtime (server startup)
 * 3. Provides typed access to env vars
 *
 * UPDATE THIS FILE when adding new environment variables!
 */

export interface EnvVarDefinition {
  name: string
  required: boolean
  description: string
  // Where this var is needed
  context: 'server' | 'client' | 'both'
  // When it's required
  environment?: 'production' | 'development' | 'all'
  // Example value (for .env.example generation)
  example?: string
  // Validation pattern
  pattern?: RegExp
  // Sensitive - should be masked in logs
  sensitive?: boolean
}

/**
 * Complete environment variable schema
 *
 * When adding a new feature that needs env vars:
 * 1. Add the definition here
 * 2. Run `npm run env:check` to see what's missing
 * 3. Add to local .env.local
 * 4. Add to production .env.production (via SSH or deployment)
 */
export const ENV_SCHEMA: EnvVarDefinition[] = [
  // ============================================
  // NextAuth.js Configuration
  // ============================================
  {
    name: 'NEXTAUTH_URL',
    required: true,
    description: 'Application URL for NextAuth callbacks',
    context: 'server',
    environment: 'all',
    example: 'http://localhost:8080',
  },
  {
    name: 'NEXTAUTH_SECRET',
    required: true,
    description: 'Secret for signing NextAuth tokens (openssl rand -base64 32)',
    context: 'server',
    environment: 'all',
    sensitive: true,
    example: 'your-secret-key-here-generate-with-openssl-rand-base64-32',
  },

  // ============================================
  // Google OAuth Configuration
  // ============================================
  {
    name: 'GOOGLE_CLIENT_ID',
    required: true,
    description: 'Google OAuth Client ID from Google Cloud Console',
    context: 'server',
    environment: 'all',
    example: 'your-google-client-id.apps.googleusercontent.com',
  },
  {
    name: 'GOOGLE_CLIENT_SECRET',
    required: true,
    description: 'Google OAuth Client Secret',
    context: 'server',
    environment: 'all',
    sensitive: true,
    example: 'GOCSPX-your-client-secret',
  },
  {
    name: 'ALLOWED_DOMAIN',
    required: false,
    description: 'Allowed Google Workspace domain for sign-in',
    context: 'server',
    environment: 'all',
    example: 'foss.gr',
  },

  // ============================================
  // Supabase Configuration
  // ============================================
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL',
    context: 'both',
    environment: 'all',
    example: 'https://your-project.supabase.co',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key (safe for client)',
    context: 'both',
    environment: 'all',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    required: true,
    description: 'Supabase service role key (NEVER expose to client!)',
    context: 'server',
    environment: 'all',
    sensitive: true,
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },

  // ============================================
  // Google Drive Configuration
  // ============================================
  {
    name: 'GOOGLE_DRIVE_HUB_ID',
    required: true,
    description: 'HUB Shared Drive ID',
    context: 'server',
    environment: 'all',
    example: '0AIqVhsENOYQjUk9PVA',
  },
  {
    name: 'GOOGLE_DRIVE_PROJECTS_FOLDER_ID',
    required: true,
    description: 'Projects folder ID within HUB drive',
    context: 'server',
    environment: 'all',
    example: '1ABC123...',
  },
  {
    name: 'GOOGLE_DRIVE_ARCHIVE_FOLDER_ID',
    required: true,
    description: 'Archive folder ID for archived projects',
    context: 'server',
    environment: 'all',
    example: '1DEF456...',
  },
  {
    name: 'NEXT_PUBLIC_TILES_EXPLORER_PATH',
    required: false,
    description: 'Windows Explorer path for TILES folder',
    context: 'client',
    environment: 'all',
    example: 'F:/Shared drives/HUB/RESOURCES/TILES',
  },

  // ============================================
  // Autodesk Platform Services (APS)
  // ============================================
  {
    name: 'APS_CLIENT_ID',
    required: true,
    description: 'APS Client ID for Design Automation',
    context: 'server',
    environment: 'all',
    example: 'your-aps-client-id',
  },
  {
    name: 'APS_CLIENT_SECRET',
    required: true,
    description: 'APS Client Secret',
    context: 'server',
    environment: 'all',
    sensitive: true,
    example: 'your-aps-client-secret',
  },
  {
    name: 'APS_REGION',
    required: false,
    description: 'APS Region (US or EMEA)',
    context: 'server',
    environment: 'all',
    example: 'EMEA',
  },
  {
    name: 'APS_NICKNAME',
    required: false,
    description: 'APS Design Automation nickname',
    context: 'server',
    environment: 'all',
    example: 'fossapp',
  },
  {
    name: 'APS_ACTIVITY_NAME',
    required: false,
    description: 'APS Design Automation activity name',
    context: 'server',
    environment: 'all',
    example: 'fossappTileAct2',
  },
  {
    name: 'APS_BUNDLE_NAME',
    required: false,
    description: 'APS Design Automation bundle name',
    context: 'server',
    environment: 'all',
    example: 'tilebundle',
  },

  // ============================================
  // OpenRouter API (Playground LLM)
  // ============================================
  {
    name: 'OPENROUTER_API_KEY',
    required: true,
    description: 'OpenRouter API key for Playground LLM features',
    context: 'server',
    environment: 'all',
    sensitive: true,
    pattern: /^sk-or-v1-/,
    example: 'sk-or-v1-your-key-here',
  },

  // ============================================
  // Feedback Chat AI Agent
  // ============================================
  {
    name: 'FEEDBACK_CHAT_OPENROUTER_KEY',
    required: true,
    description: 'OpenRouter API key for Feedback Chat AI Agent',
    context: 'server',
    environment: 'all',
    sensitive: true,
    pattern: /^sk-or-v1-/,
    example: 'sk-or-v1-your-feedback-key-here',
  },
  {
    name: 'FEEDBACK_CHAT_MODEL',
    required: false,
    description: 'Model to use for Feedback Chat (default: anthropic/claude-sonnet-4)',
    context: 'server',
    environment: 'all',
    example: 'anthropic/claude-sonnet-4',
  },
  {
    name: 'FEEDBACK_CHAT_MAX_TOKENS',
    required: false,
    description: 'Max tokens for Feedback Chat responses (default: 4096)',
    context: 'server',
    environment: 'all',
    example: '4096',
  },

  // ============================================
  // Email Notifications (Resend)
  // ============================================
  {
    name: 'RESEND_API_KEY',
    required: false,
    description: 'Resend API key for email notifications',
    context: 'server',
    environment: 'all',
    sensitive: true,
    pattern: /^re_/,
    example: 're_your-resend-api-key',
  },
  {
    name: 'FEEDBACK_NOTIFICATION_EMAILS',
    required: false,
    description: 'Comma-separated emails for feedback notifications',
    context: 'server',
    environment: 'all',
    example: 'dev@example.com,admin@example.com',
  },

  // ============================================
  // Development Configuration
  // ============================================
  {
    name: 'NEXT_PUBLIC_BYPASS_AUTH',
    required: false,
    description: 'Bypass auth for development (NEVER true in production!)',
    context: 'client',
    environment: 'development',
    example: 'false',
  },
]

/**
 * Validate environment variables
 * Returns an object with missing and invalid vars
 */
export function validateEnv(): {
  missing: EnvVarDefinition[]
  invalid: { def: EnvVarDefinition; value: string; reason: string }[]
  valid: boolean
} {
  const isProduction = process.env.NODE_ENV === 'production'
  const missing: EnvVarDefinition[] = []
  const invalid: { def: EnvVarDefinition; value: string; reason: string }[] = []

  for (const def of ENV_SCHEMA) {
    // Skip if not required for this environment
    if (def.environment === 'development' && isProduction) continue
    if (def.environment === 'production' && !isProduction) continue

    const value = process.env[def.name]

    // Check if required but missing
    if (def.required && (!value || value.trim() === '')) {
      missing.push(def)
      continue
    }

    // Check pattern if value exists
    if (value && def.pattern && !def.pattern.test(value)) {
      invalid.push({
        def,
        value: def.sensitive ? '***' : value,
        reason: `Value doesn't match expected pattern`,
      })
    }
  }

  return {
    missing,
    invalid,
    valid: missing.length === 0 && invalid.length === 0,
  }
}

/**
 * Get a formatted report of environment validation
 */
export function getEnvValidationReport(): string {
  const { missing, invalid, valid } = validateEnv()

  if (valid) {
    return '✅ All required environment variables are configured correctly.'
  }

  const lines: string[] = ['❌ Environment validation failed:\n']

  if (missing.length > 0) {
    lines.push('Missing required variables:')
    for (const def of missing) {
      lines.push(`  • ${def.name}: ${def.description}`)
    }
    lines.push('')
  }

  if (invalid.length > 0) {
    lines.push('Invalid variables:')
    for (const { def, reason } of invalid) {
      lines.push(`  • ${def.name}: ${reason}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Validate environment at startup - logs warnings but doesn't crash
 * Call this from instrumentation.ts or a similar startup file
 */
export function validateEnvAtStartup(): void {
  const { missing, invalid, valid } = validateEnv()

  if (valid) {
    console.log('[Env] ✅ All required environment variables are configured')
    return
  }

  console.warn('[Env] ⚠️ Environment validation issues detected:')

  if (missing.length > 0) {
    console.warn('[Env] Missing required variables:')
    for (const def of missing) {
      console.warn(`[Env]   • ${def.name}: ${def.description}`)
    }
  }

  if (invalid.length > 0) {
    console.warn('[Env] Invalid variables:')
    for (const { def, reason } of invalid) {
      console.warn(`[Env]   • ${def.name}: ${reason}`)
    }
  }

  // In production, we could optionally throw here to prevent startup
  // For now, we just warn to avoid breaking existing deployments
  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    console.error(
      '[Env] ❌ CRITICAL: Missing required environment variables in production!'
    )
    console.error(
      '[Env] Some features may not work. Please add the missing variables.'
    )
  }
}

/**
 * Generate .env.example content from schema
 */
export function generateEnvExample(): string {
  const lines: string[] = [
    '# FOSSAPP Environment Configuration',
    '# Generated from src/lib/env-schema.ts',
    '# Copy this file to .env.local and fill in the actual values',
    '# NEVER commit .env.local or .env.production to version control',
    '',
  ]

  let currentSection = ''

  for (const def of ENV_SCHEMA) {
    // Extract section from position in array (based on our schema structure)
    const newSection = getSectionForVar(def.name)
    if (newSection !== currentSection) {
      currentSection = newSection
      lines.push(`# ============================================`)
      lines.push(`# ${currentSection}`)
      lines.push(`# ============================================`)
      lines.push('')
    }

    // Add description
    lines.push(`# ${def.description}`)
    if (!def.required) {
      lines.push('# (Optional)')
    }
    if (def.sensitive) {
      lines.push('# SENSITIVE: Never commit actual values!')
    }
    if (def.environment === 'development') {
      lines.push('# Development only - do not set in production')
    }

    // Add example value
    lines.push(`${def.name}=${def.example || ''}`)
    lines.push('')
  }

  return lines.join('\n')
}

function getSectionForVar(name: string): string {
  if (name.startsWith('NEXTAUTH')) return 'NextAuth.js Configuration'
  if (name.startsWith('GOOGLE_CLIENT') || name === 'ALLOWED_DOMAIN')
    return 'Google OAuth Configuration'
  if (name.includes('SUPABASE')) return 'Supabase Configuration'
  if (name.startsWith('GOOGLE_DRIVE') || name.includes('TILES'))
    return 'Google Drive Configuration'
  if (name.startsWith('APS')) return 'Autodesk Platform Services (APS)'
  if (name.startsWith('OPENROUTER')) return 'OpenRouter API (Playground LLM)'
  if (name.startsWith('FEEDBACK')) return 'Feedback Chat AI Agent'
  if (name.startsWith('RESEND') || name.includes('NOTIFICATION'))
    return 'Email Notifications (Resend)'
  if (name.includes('BYPASS') || name.includes('DEBUG'))
    return 'Development Configuration'
  return 'Other'
}

/**
 * Get list of variable names for CLI scripts
 */
export function getRequiredVarNames(): string[] {
  return ENV_SCHEMA.filter((def) => def.required).map((def) => def.name)
}

export function getAllVarNames(): string[] {
  return ENV_SCHEMA.map((def) => def.name)
}
