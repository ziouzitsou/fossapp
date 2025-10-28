# Domain Configuration Guide

## Overview

FOSSAPP uses a centralized configuration system to manage production URLs and domain references. This makes it easy to update the domain when migrating to a new server or changing the production URL.

**Current Production Domain**: `app.titancnc.eu`

## How It Works

### Centralized Configuration

All production domain references are centralized in a single file:

**Location**: `src/lib/config.ts`

This file contains:
- Production domain and URL
- Application metadata (name, description)
- PWA configuration (theme colors, display settings)
- Helper functions for environment-aware URL generation

### Dynamic Manifest

Instead of a static `public/manifest.json`, the app uses a **dynamic manifest** generated via an API route:

**Endpoint**: `/api/manifest` (served by `src/app/api/manifest/route.ts`)

This ensures the PWA manifest always uses the correct domain from the centralized configuration.

### Metadata Integration

The root layout (`src/app/layout.tsx`) imports and uses values from the centralized config for:
- Page metadata (title, description)
- PWA manifest reference
- Theme colors
- Apple Web App settings

## Changing the Production Domain

When you need to deploy to a new domain, follow these steps:

### 1. Update Centralized Configuration

Edit `src/lib/config.ts`:

```typescript
export const APP_CONFIG = {
  // Update these two values:
  PRODUCTION_DOMAIN: 'new-domain.com',        // Without protocol
  PRODUCTION_URL: 'https://new-domain.com',   // With protocol

  // ... rest stays the same
}
```

### 2. Update Environment Variables

Update `.env.production` on the production server:

```bash
NEXTAUTH_URL=https://new-domain.com
NEXTAUTH_SECRET=<your-secret>
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Supabase (no changes needed unless database changes)
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-key>
SUPABASE_SERVICE_ROLE_KEY=<your-key>
```

### 3. Update Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to your OAuth 2.0 Client
3. Update **Authorized JavaScript origins**:
   - Add: `https://new-domain.com`
   - Remove old domain (after verifying new one works)
4. Update **Authorized redirect URIs**:
   - Add: `https://new-domain.com/api/auth/callback/google`
   - Remove old domain (after verifying new one works)

### 4. Update Documentation

Search and replace the old domain in documentation files:

```bash
cd /home/sysadmin/nextjs/fossapp
grep -r "app.titancnc.eu" docs/ CLAUDE.md
# Manually update each reference
```

Files that typically reference the domain:
- `CLAUDE.md`
- `docs/PWA.md`
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/vps-deployment.md`

### 5. Rebuild and Deploy

```bash
npm run build
npm run start

# Or with Docker:
docker-compose build
docker-compose up -d
```

### 6. Verify

```bash
# Check health endpoint
curl https://new-domain.com/api/health

# Check dynamic manifest
curl https://new-domain.com/api/manifest

# Test OAuth login flow
# Visit https://new-domain.com and sign in with Google
```

## File Structure

```
src/
├── lib/
│   └── config.ts                      # ⭐ Primary configuration file
├── app/
│   ├── layout.tsx                     # Uses config for metadata
│   └── api/
│       └── manifest/
│           └── route.ts               # Dynamic manifest endpoint
└── ...

docs/
└── DOMAIN_CONFIGURATION.md            # This file
```

## Benefits of This Approach

1. **Single Source of Truth**: Update domain in one place (`src/lib/config.ts`)
2. **Type Safety**: TypeScript ensures correct usage throughout the app
3. **Environment Awareness**: Automatically uses localhost in dev, production URL in prod
4. **Dynamic PWA Manifest**: No need to manually edit `public/manifest.json`
5. **Easy Migration**: Clear checklist for domain changes
6. **No Hardcoded URLs**: Helper functions prevent scattered URL strings

## Environment Detection

The configuration automatically detects the environment:

- **Development**: Uses `http://localhost:8080` or `NEXTAUTH_URL` from `.env.local`
- **Production**: Uses hardcoded `https://app.titancnc.eu` from `config.ts`

This ensures:
- Local development works without configuration
- Production always uses the correct domain
- No accidental localhost references in production

## Helper Functions

### `getProductionUrl(path?)`

Generate absolute URLs with the correct domain:

```typescript
import { getProductionUrl } from '@/lib/config'

// In production: https://app.titancnc.eu
// In dev: http://localhost:8080
const baseUrl = getProductionUrl()

// In production: https://app.titancnc.eu/products
// In dev: http://localhost:8080/products
const productsUrl = getProductionUrl('/products')
```

### `APP_CONFIG.getBaseUrl()`

Get the current base URL (environment-aware):

```typescript
import { APP_CONFIG } from '@/lib/config'

const baseUrl = APP_CONFIG.getBaseUrl()
// Production: https://app.titancnc.eu
// Development: http://localhost:8080
```

### `APP_CONFIG.getDomain()`

Get the domain without protocol:

```typescript
import { APP_CONFIG } from '@/lib/config'

const domain = APP_CONFIG.getDomain()
// Production: app.titancnc.eu
// Development: localhost:8080
```

## Security Considerations

- The centralized config is compiled into the Next.js bundle
- **No secrets** should be stored in `src/lib/config.ts`
- Environment variables (`.env.production`) still required for:
  - OAuth secrets
  - Database credentials
  - NextAuth secret key

## Troubleshooting

### PWA Installation Issues After Domain Change

If users can't install the PWA after changing domains:

1. Clear browser cache
2. Check `/api/manifest` returns correct values
3. Verify `metadataBase` in `layout.tsx` matches new domain
4. Check Chrome DevTools → Application → Manifest

### OAuth Login Fails After Domain Change

1. Verify Google Cloud Console has new domain in:
   - Authorized JavaScript origins
   - Authorized redirect URIs
2. Check `NEXTAUTH_URL` in `.env.production`
3. Restart the application after env changes

### Wrong Domain in Links/Metadata

1. Check `src/lib/config.ts` has correct values
2. Verify `npm run build` was run after changes
3. Check no hardcoded URLs exist in components:
   ```bash
   grep -r "https://app.titancnc.eu" src/
   ```

## Migration Checklist

When changing domains, use this checklist:

- [ ] Update `src/lib/config.ts` (PRODUCTION_DOMAIN, PRODUCTION_URL)
- [ ] Update `.env.production` (NEXTAUTH_URL)
- [ ] Update Google OAuth settings (origins + redirect URIs)
- [ ] Update documentation files (grep for old domain)
- [ ] Rebuild application (`npm run build`)
- [ ] Test locally with production build (`npm run start`)
- [ ] Deploy to production
- [ ] Test OAuth login flow
- [ ] Test PWA installation
- [ ] Verify `/api/health` endpoint
- [ ] Verify `/api/manifest` endpoint
- [ ] Update DNS records (if applicable)
- [ ] Update SSL certificate (if applicable)

## Last Updated

**2025-10-28** - Initial domain configuration documentation created for Next.js 16 upgrade.
