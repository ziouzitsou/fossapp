# Beta Deployment Strategy for FOSSAPP

**Status**: Planning / Not Yet Implemented
**Last Updated**: 2025-11-08
**Target Implementation**: When project reaches beta testing phase

---

## Executive Summary

This document provides a complete blueprint for deploying beta versions of FOSSAPP for user testing. After analyzing multiple approaches, we recommend **Subdomain with Shared Database** as the optimal solution for a solo developer workflow.

**Recommended Approach**: Deploy beta to `beta.fossapp.online` while production runs at `main.fossapp.online`, both sharing the same Supabase database.

---

## Table of Contents

1. [Comparison of Approaches](#comparison-of-approaches)
2. [Recommended Solution](#recommended-solution-subdomain-with-shared-database)
3. [Implementation Guide](#implementation-guide)
4. [PWA Considerations](#pwa-considerations)
5. [Version Management](#version-management-strategy)
6. [Resource Requirements](#resource-usage-estimates)
7. [Beta User Onboarding](#beta-user-onboarding)
8. [Monitoring & Rollback](#monitoring--rollback)

---

## Comparison of Approaches

### Approach #1: Feature Flags (In-Production Beta)

**How it works**: Deploy beta features to production with feature flags, control access via user attributes.

**Pros:**
- ✅ Zero infrastructure changes needed
- ✅ Fastest to implement (~2-4 hours)
- ✅ No additional hosting costs
- ✅ Test with real production data
- ✅ Gradual rollouts (5% → 25% → 100%)

**Cons:**
- ❌ Beta code deployed to production (risk)
- ❌ Requires feature flag library
- ❌ Code complexity (if/else logic everywhere)
- ❌ Users can't have both stable and beta installed (PWA limitation)
- ❌ Difficult to isolate breaking changes

**Implementation Complexity**: Low (4/10)
**Maintenance Overhead**: Medium
**Cost**: $0 (self-hosted) to $20/month

**Best For**: Testing small features, A/B experiments, gradual rollouts

---

### Approach #2: Subdomain with Shared Database ⭐ RECOMMENDED

**How it works**: Deploy beta to `beta.fossapp.online`, production stays at `main.fossapp.online`, both use same Supabase database.

**Pros:**
- ✅ Clean separation of environments
- ✅ Test full deployment workflow
- ✅ Users can install both PWAs (different scope)
- ✅ Easy URL sharing with testers
- ✅ Same database = realistic data
- ✅ Low cost (same VPS)
- ✅ Simple rollback (just redeploy)
- ✅ Professional appearance

**Cons:**
- ⚠️ Need to configure Nginx for routing
- ⚠️ Manage two containers on VPS
- ⚠️ Database changes affect both environments
- ⚠️ ~512MB-1GB extra RAM needed

**Implementation Complexity**: Medium (6/10)
**Maintenance Overhead**: Low
**Cost**: $0 (same VPS)

**Best For**: Solo developers, testing with real data, full feature testing

---

### Approach #3: Separate Subdomain + Separate Database

**How it works**: Beta domain with completely separate Supabase project.

**Pros:**
- ✅ Complete isolation
- ✅ Database changes won't affect production
- ✅ Can test migrations safely

**Cons:**
- ❌ Requires second Supabase project
- ❌ Data drift between environments
- ❌ More complex setup

**Implementation Complexity**: High (8/10)
**Maintenance Overhead**: High
**Cost**: $0-25/month (additional Supabase)

**Best For**: Teams, apps with sensitive data, complex migrations

---

### Approach #4: Blue-Green with Git Branches

**How it works**: `main` branch → production, `beta` branch → beta environment.

**Pros:**
- ✅ Simple branching strategy
- ✅ Easy rollback
- ✅ No subdomain needed

**Cons:**
- ❌ Users can't have both versions (same PWA scope)
- ❌ Need to manage branch merges
- ❌ Confusing for beta testers

**Implementation Complexity**: Medium (5/10)
**Maintenance Overhead**: Medium
**Cost**: $0

**Best For**: Quick testing before production push

---

## Recommended Solution: Subdomain with Shared Database

### Why This Approach?

1. **Solo Developer Friendly**: Minimal complexity, maximum flexibility
2. **PWA Compatible**: Users can install both as separate apps
3. **Cost Effective**: No additional infrastructure needed
4. **Professional**: Clean URLs for beta testers
5. **Safe Testing**: Full deployment workflow without production risk

### Architecture Overview

```
                            ┌─────────────────────────┐
                            │   DNS / Domain          │
                            │   fossapp.online        │
                            └───────────┬─────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
            ┌───────▼────────┐  ┌──────▼───────┐          │
            │ main.fossapp   │  │ beta.fossapp │          │
            │ .online        │  │ .online      │          │
            └───────┬────────┘  └──────┬───────┘          │
                    │                   │                   │
            ┌───────▼────────┐  ┌──────▼───────┐          │
            │ SSL Cert       │  │ SSL Cert     │          │
            │ (Let's Encrypt)│  │ (Let's Enc.) │          │
            └───────┬────────┘  └──────┬───────┘          │
                    │                   │                   │
            ┌───────▼────────────────────▼───────┐         │
            │         Nginx Reverse Proxy        │         │
            │  - Route by hostname               │         │
            │  - SSL termination                 │         │
            └───────┬────────────────────┬───────┘         │
                    │                    │                  │
         ┌──────────▼────────┐  ┌────────▼────────────┐   │
         │  Docker Container │  │  Docker Container   │   │
         │  fossapp-prod     │  │  fossapp-beta       │   │
         │  Port: 8080       │  │  Port: 8081         │   │
         │  .env.production  │  │  .env.beta          │   │
         └──────────┬────────┘  └────────┬────────────┘   │
                    │                    │                  │
                    └────────────────────┼──────────────────┘
                                         │
                              ┌──────────▼───────────┐
                              │   Supabase Database  │
                              │   (Shared)           │
                              │   - items.product_*  │
                              │   - etim.*           │
                              └──────────────────────┘
```

---

## Implementation Guide

### Phase 1: Infrastructure Setup (1-2 hours)

#### Step 1: DNS Configuration

Add DNS A record at your domain registrar:

```
Host: beta.fossapp.online
Type: A
Value: <VPS IP address>
TTL: 300 (5 minutes)
```

**Verify DNS propagation:**
```bash
dig beta.fossapp.online
nslookup beta.fossapp.online
```

---

#### Step 2: SSL Certificate

SSH to production server and generate certificate:

```bash
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu

# Generate SSL certificate for beta subdomain
sudo certbot --nginx -d beta.fossapp.online

# Certbot will automatically configure Nginx
```

**Alternative - Wildcard Certificate** (for future subdomains):
```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d '*.fossapp.online' -d 'fossapp.online'

# Follow DNS TXT record instructions
# Note: Requires manual renewal
```

**Recommendation**: Use individual certificates for easier auto-renewal.

---

#### Step 3: Nginx Configuration

Create new Nginx configuration file:

**File**: `/etc/nginx/sites-available/fossapp-beta`

```nginx
upstream fossapp-beta {
    server 127.0.0.1:8081;
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name beta.fossapp.online;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name beta.fossapp.online;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/beta.fossapp.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/beta.fossapp.online/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';

    # Environment indicator
    add_header X-Environment "beta" always;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Proxy settings
    location / {
        proxy_pass http://fossapp-beta;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://fossapp-beta;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Logs
    access_log /var/log/nginx/fossapp-beta.access.log;
    error_log /var/log/nginx/fossapp-beta.error.log;
}
```

**Enable the configuration:**
```bash
sudo ln -s /etc/nginx/sites-available/fossapp-beta /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

#### Step 4: Docker Compose Configuration

Update `/opt/fossapp/docker-compose.yml`:

```yaml
services:
  # Production container (existing)
  fossapp:
    build: .
    container_name: fossapp-production
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
      - HOSTNAME=0.0.0.0
    env_file:
      - .env.production
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
        compress: "true"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - fossapp-network

  # Beta container (new)
  fossapp-beta:
    build: .
    container_name: fossapp-beta
    ports:
      - "8081:8080"  # External 8081 → Internal 8080
    environment:
      - NODE_ENV=production
      - PORT=8080
      - HOSTNAME=0.0.0.0
    env_file:
      - .env.beta
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
        compress: "true"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - fossapp-network

networks:
  fossapp-network:
    driver: bridge
```

---

#### Step 5: Environment Files

Create `/opt/fossapp/.env.beta`:

```bash
# Copy from production as starting point
cp /opt/fossapp/.env.production /opt/fossapp/.env.beta

# Edit beta-specific values
nano /opt/fossapp/.env.beta
```

**Key changes in `.env.beta`:**

```bash
# NextAuth - CRITICAL: Update callback URL
NEXTAUTH_URL=https://beta.fossapp.online
NEXTAUTH_SECRET=<same-as-production>

# Google OAuth (same credentials, but add beta domain to OAuth settings)
GOOGLE_CLIENT_ID=<same-as-production>
GOOGLE_CLIENT_SECRET=<same-as-production>

# Supabase - Use same database (shared data)
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<same-as-production>
SUPABASE_SERVICE_ROLE_KEY=<same-as-production>
```

---

#### Step 6: Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to: APIs & Services → Credentials
3. Click on your OAuth 2.0 Client ID

**Add beta domain to Authorized JavaScript origins:**
- `https://beta.fossapp.online`

**Add beta domain to Authorized redirect URIs:**
- `https://beta.fossapp.online/api/auth/callback/google`

**Keep production URLs** (both should be active):
- `https://main.fossapp.online`
- `https://main.fossapp.online/api/auth/callback/google`

---

### Phase 2: Application Changes (1-2 hours)

#### Update `src/lib/config.ts`

Add environment detection:

```typescript
export const APP_CONFIG = {
  // ... existing config ...

  /**
   * Detect if running on beta subdomain
   */
  isBeta: (): boolean => {
    if (typeof window !== 'undefined') {
      return window.location.hostname === 'beta.fossapp.online'
    }
    return process.env.NEXTAUTH_URL?.includes('beta.fossapp.online') || false
  },

  /**
   * Get current environment
   */
  getEnvironment: (): 'development' | 'beta' | 'production' => {
    if (APP_CONFIG.isDevelopment) return 'development'
    if (APP_CONFIG.isBeta()) return 'beta'
    return 'production'
  },
}
```

---

#### Update Dynamic Manifest

Modify `src/app/api/manifest/route.ts`:

```typescript
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  const isBeta = origin.includes('beta.fossapp.online')

  const manifest = {
    name: isBeta
      ? "FOSSAPP Beta - Lighting Database"
      : "FOSSAPP - Lighting Product Database",
    short_name: isBeta ? "FOSSAPP Beta" : "FOSSAPP",
    description: "Professional lighting product database for architects and designers. Search 56,456+ products with ETIM classification.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: isBeta ? "#f59e0b" : "#000000",  // Orange for beta
    orientation: "any",
    scope: "/",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ],
    categories: ["business", "productivity"],
  }

  return NextResponse.json(manifest)
}
```

---

#### Add Beta Indicator UI

Update `src/components/version-display.tsx`:

```typescript
'use client'

import { APP_CONFIG } from '@/lib/config'

export function VersionDisplay() {
  const version = process.env.npm_package_version || '1.0.0'
  const environment = APP_CONFIG.getEnvironment()

  let badge = ''
  let bgColor = 'bg-muted'
  let textColor = 'text-muted-foreground'

  if (environment === 'development') {
    badge = '-dev'
    bgColor = 'bg-blue-500/10'
    textColor = 'text-blue-500'
  }

  if (environment === 'beta') {
    badge = '-beta'
    bgColor = 'bg-orange-500/10'
    textColor = 'text-orange-500'
  }

  return (
    <div className={`px-3 py-2 rounded-md ${bgColor}`}>
      <div className={`text-xs font-mono ${textColor}`}>
        v{version}{badge}
      </div>
      {environment === 'beta' && (
        <div className="text-[10px] text-orange-500 mt-1 font-semibold">
          🧪 Beta Testing
        </div>
      )}
    </div>
  )
}
```

---

### Phase 3: Deployment Scripts (30 minutes)

#### Create Beta Deployment Script

**File**: `/opt/fossapp/deploy-beta.sh`

```bash
#!/bin/bash

set -e  # Exit on error

VERSION=$1

if [ -z "$VERSION" ]; then
  echo "Usage: ./deploy-beta.sh <version>"
  echo "Example: ./deploy-beta.sh v1.3.2-beta.1"
  exit 1
fi

echo "🚀 Deploying FOSSAPP Beta: $VERSION"

# Navigate to deployment directory
cd /opt/fossapp

# Fetch latest tags
echo "📥 Fetching updates from GitHub..."
git fetch origin
git fetch --tags --force

# Checkout version
echo "🔄 Checking out $VERSION..."
git checkout $VERSION

# Stop beta container
echo "🛑 Stopping beta container..."
docker compose stop fossapp-beta

# Build image
echo "🔨 Building Docker image..."
docker compose build fossapp-beta

# Start beta container
echo "▶️  Starting beta container..."
docker compose up -d fossapp-beta

# Wait for health check
echo "⏳ Waiting for health check (40 seconds)..."
sleep 40

# Verify deployment
echo "✅ Verifying deployment..."
HEALTH_CHECK=$(curl -s http://localhost:8081/api/health || echo "failed")

if echo "$HEALTH_CHECK" | grep -q "healthy"; then
  VERSION_FROM_API=$(echo "$HEALTH_CHECK" | grep -o '"version":"[^"]*"' | cut -d'"' -f4)
  echo "✅ Beta deployment successful!"
  echo "📊 Version: $VERSION_FROM_API"
  echo "🌐 Beta URL: https://beta.fossapp.online"

  # Clean up old images
  echo "🧹 Cleaning up old Docker images..."
  docker image prune -f

  echo "✨ Done!"
else
  echo "❌ Health check failed!"
  echo "Response: $HEALTH_CHECK"
  echo "Check logs: docker compose logs fossapp-beta"
  exit 1
fi
```

Make executable:
```bash
chmod +x /opt/fossapp/deploy-beta.sh
```

---

## Version Management Strategy

### Semantic Versioning with Pre-release Tags

**Format**: `MAJOR.MINOR.PATCH-beta.N`

**Examples:**
- `v1.3.2-beta.1` - First beta of version 1.3.2
- `v1.3.2-beta.2` - Second beta (after fixes)
- `v1.3.2-beta.3` - Third beta
- `v1.3.2` - Final stable release

### Beta Development Workflow

```bash
# 1. Develop new feature locally
npm run dev

# 2. Create beta version
npm version 1.3.2-beta.1 --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore: bump to v1.3.2-beta.1"

# 3. Create git tag
git tag v1.3.2-beta.1
git push origin main --tags

# 4. Deploy to beta
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu \
  "cd /opt/fossapp && ./deploy-beta.sh v1.3.2-beta.1"

# 5. Share with beta testers
# URL: https://beta.fossapp.online

# 6. Gather feedback and iterate
# If bugs found, create beta.2, beta.3, etc.

# 7. When stable, create production release
npm version 1.3.2
git push origin main --tags

# 8. Deploy to production
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu \
  "cd /opt/fossapp && ./deploy.sh v1.3.2"
```

---

## PWA Considerations

### Service Worker Scoping

**Key Facts:**
- `main.fossapp.online` and `beta.fossapp.online` are separate origins
- Each gets its own service worker, cache, and storage
- Users can install **both** PWAs simultaneously
- Each PWA updates independently

### Visual Differentiation

**Production PWA:**
- Name: "FOSSAPP - Lighting Product Database"
- Theme Color: Black (#000000)
- Icon: Regular app icon

**Beta PWA:**
- Name: "FOSSAPP Beta - Lighting Database"
- Theme Color: Orange (#f59e0b)
- Icon: Same (or add "BETA" badge overlay)
- UI Badge: Orange "🧪 Beta Testing" indicator

### PWA Installation

Users can have both installed:
- **Desktop**: Two separate app icons
- **Mobile**: Two separate home screen icons
- **No conflicts**: Completely independent installations

---

## Resource Usage Estimates

### Current Production (Single Container)
- Container RAM: ~256MB
- Nginx RAM: ~5MB
- **Total: ~260MB**

### After Beta Addition (Two Containers)
- Production container: ~256MB
- Beta container: ~256MB
- Nginx: ~10MB (routing both)
- **Total: ~520MB**

### VPS Requirements
- **Minimum**: 2GB RAM
- **Recommended**: 4GB RAM (comfortable headroom)
- **Storage**: +500MB for beta Docker images

---

## Beta User Onboarding

### Beta Testing Guide Template

Create and share with beta testers:

**Content for `/docs/BETA_TESTING_GUIDE.md`:**

```markdown
# FOSSAPP Beta Testing Guide

Welcome beta testers! Thank you for helping test new features.

## Installation

### Desktop (Chrome/Edge/Brave)
1. Visit: https://beta.fossapp.online
2. Sign in with Google
3. Click install icon in address bar
4. Install as app

### Mobile (Android Chrome)
1. Visit: https://beta.fossapp.online
2. Menu → "Add to Home screen"

### Mobile (iOS Safari)
1. Visit: https://beta.fossapp.online
2. Share → "Add to Home Screen"

## Important Notes

- ✅ You can have BOTH production and beta installed
- ✅ Uses same data as production (shared database)
- ⚠️ Beta may have bugs or incomplete features
- 🔄 Updates happen automatically

## Reporting Issues

**Found a bug?** Please report:
- What you were doing
- What you expected
- What actually happened
- Screenshots if possible

**Contact**: [your email]

## Current Beta Features

### Version: v1.3.2-beta.1

**What's New:**
- Feature 1: Description
- Feature 2: Description

**Known Issues:**
- Issue 1: Workaround
```

---

## Monitoring & Rollback

### Health Monitoring Script

**File**: `/opt/fossapp/monitor-beta.sh`

```bash
#!/bin/bash

BETA_HEALTH=$(curl -s https://beta.fossapp.online/api/health)
PROD_HEALTH=$(curl -s https://main.fossapp.online/api/health)

BETA_STATUS=$(echo $BETA_HEALTH | jq -r '.status' 2>/dev/null || echo "error")
PROD_STATUS=$(echo $PROD_HEALTH | jq -r '.status' 2>/dev/null || echo "error")

echo "$(date): Production=$PROD_STATUS, Beta=$BETA_STATUS"

if [ "$PROD_STATUS" != "healthy" ]; then
  echo "❌ PRODUCTION IS DOWN!"
  # Add notification (email/Slack)
fi

if [ "$BETA_STATUS" != "healthy" ]; then
  echo "⚠️  Beta is down"
fi
```

Add to crontab:
```bash
# Check every 5 minutes
*/5 * * * * /opt/fossapp/monitor-beta.sh >> /var/log/fossapp-health.log 2>&1
```

### Rollback Strategies

**Beta Rollback** (if beta breaks):
```bash
# Deploy previous beta version
./deploy-beta.sh v1.3.2-beta.1

# Or stop beta entirely (production unaffected)
docker compose stop fossapp-beta
```

**Production Protection:**
- Beta issues never affect production
- Containers run independently
- Separate health checks
- Can stop beta without impacting production

---

## Implementation Timeline

### Week 1: Infrastructure
- [ ] Add DNS record for beta.fossapp.online
- [ ] Generate SSL certificate
- [ ] Configure Nginx
- [ ] Update docker-compose.yml
- [ ] Create .env.beta
- [ ] Test beta deployment manually

### Week 2: Application Updates
- [ ] Update config.ts for environment detection
- [ ] Create dynamic manifest endpoint
- [ ] Add beta UI indicators
- [ ] Test PWA installation on both domains
- [ ] Update Google OAuth settings

### Week 3: Automation
- [ ] Create deploy-beta.sh script
- [ ] Document beta workflow
- [ ] Create beta testing guide
- [ ] Invite initial beta testers
- [ ] Deploy first beta version

### Week 4: Monitoring
- [ ] Set up health check monitoring
- [ ] Gather feedback from testers
- [ ] Refine deployment workflow
- [ ] Document lessons learned

---

## Cost Analysis

| Approach | Infrastructure | Services | Total/Month |
|----------|---------------|----------|-------------|
| Feature Flags | $0 | $0-20 | $0-20 |
| **Subdomain (Shared DB)** | **$0** | **$0** | **$0** ⭐ |
| Subdomain (Separate DB) | $0 | $0-25 | $0-25 |
| Blue-Green | $0 | $0 | $0 |

**Winner**: Subdomain with Shared Database - Zero additional cost!

---

## Quick Start When Ready

When you're ready to implement beta deployment:

```bash
# 1. Set up DNS (at domain registrar)
# Add A record: beta.fossapp.online → VPS IP

# 2. SSH to VPS
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu

# 3. Get SSL certificate
sudo certbot --nginx -d beta.fossapp.online

# 4. Follow implementation guide in this document
# Start with Phase 1, Step 3 (Nginx configuration)
```

---

## Troubleshooting

### Beta Container Won't Start
```bash
# Check logs
docker compose logs fossapp-beta

# Verify .env.beta exists
ls -la /opt/fossapp/.env.beta

# Check port 8081 not in use
sudo netstat -tulpn | grep 8081
```

### OAuth Fails on Beta
```bash
# Verify Google OAuth has beta domain
# Check: console.cloud.google.com

# Verify .env.beta has correct NEXTAUTH_URL
cat /opt/fossapp/.env.beta | grep NEXTAUTH_URL
```

### PWA Not Installing
```bash
# Check manifest endpoint
curl https://beta.fossapp.online/api/manifest

# Verify SSL certificate valid
openssl s_client -connect beta.fossapp.online:443

# Check browser DevTools → Application → Manifest
```

---

## References

- Production Deployment Checklist: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- Domain Configuration: `DOMAIN_CONFIGURATION.md`
- PWA Documentation: `PWA.md`

---

## Status & Next Steps

**Current Status**: Documentation complete, ready for implementation

**When to Implement**:
- Project has stable production version
- Ready for user testing
- Have 3-5 willing beta testers
- Time available for 3-5 hour setup

**First Step**: Add DNS record for beta.fossapp.online

---

**Last Updated**: 2025-11-08
**Author**: Automated documentation based on beta deployment research
**Review**: Pending implementation experience
