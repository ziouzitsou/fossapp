/**
 * Next.js Instrumentation
 *
 * This file is automatically loaded by Next.js at startup.
 * Use it for one-time initialization like environment validation.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server startup, not during build or in browser
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvAtStartup } = await import('./lib/env-schema')
    validateEnvAtStartup()
  }
}
