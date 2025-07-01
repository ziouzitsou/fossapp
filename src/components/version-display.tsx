'use client'

import packageJson from '../../package.json'

export function VersionDisplay() {
  const version = packageJson.version
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return (
    <div className="text-center text-xs text-muted-foreground font-mono px-3 py-2">
      v{version}{isDevelopment && '-dev'}
    </div>
  )
}