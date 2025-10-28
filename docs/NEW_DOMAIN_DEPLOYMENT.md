# New Domain Deployment Guide

**Domain Migration**: `app.titancnc.eu` → `main.fossapp.online`
**Date**: 2025-10-28
**Status**: Ready for deployment

## Overview

This guide covers deploying FOSSAPP to the new domain `main.fossapp.online` while keeping the old domain `app.titancnc.eu` active during the transition period.

## Pre-Deployment Checklist

### ✅ Code Changes (Already Completed)

- [x] Updated `src/lib/config.ts` with new domain
- [x] Dynamic manifest API uses new domain
- [x] Updated documentation (CLAUDE.md)
- [x] Build tested successfully

### 📋 Production Server Setup

#### 1. Update Environment Variables

SSH into the production server and update `.env.production`:

```bash
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu
cd /opt/fossapp

# Backup current .env.production
cp .env.production .env.production.backup-$(date +%Y%m%d)

# Edit .env.production
nano .env.production
```

Update these values:

```bash
# Update NEXTAUTH_URL to new domain
NEXTAUTH_URL=https://main.fossapp.online
NEXTAUTH_SECRET=<keep-existing-value>

# Google OAuth (update Client ID/Secret if changed for new domain)
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<your-client-secret>

# Supabase (no changes needed)
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<keep-existing-value>
SUPABASE_SERVICE_ROLE_KEY=<keep-existing-value>
```

#### 2. Update Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to: APIs & Services → Credentials
4. Click on your OAuth 2.0 Client ID

**Add new domain (keep old one during transition)**:

**Authorized JavaScript origins**:
- Add: `https://main.fossapp.online`
- Keep: `https://app.titancnc.eu` (for now)
- Keep: `http://localhost:8080` (for development)

**Authorized redirect URIs**:
- Add: `https://main.fossapp.online/api/auth/callback/google`
- Keep: `https://app.titancnc.eu/api/auth/callback/google` (for now)
- Keep: `http://localhost:8080/api/auth/callback/google` (for development)

5. Save changes

#### 3. DNS Configuration

Ensure DNS is configured for `main.fossapp.online`:

```bash
# Check DNS resolution
dig main.fossapp.online
nslookup main.fossapp.online

# Expected: A record pointing to your VPS IP
# Expected: AAAA record if using IPv6
```

#### 4. SSL Certificate

If using Let's Encrypt with Certbot:

```bash
# Generate certificate for new domain
sudo certbot --nginx -d main.fossapp.online

# Or if using separate certificate
sudo certbot certonly --webroot -w /var/www/html -d main.fossapp.online
```

If using Cloudflare or another CDN:
- Ensure SSL/TLS is set to "Full (strict)"
- Verify certificate is valid

#### 5. Nginx Configuration

Update Nginx to serve both domains during transition:

```nginx
# /etc/nginx/sites-available/fossapp

# New domain (primary)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name main.fossapp.online;

    ssl_certificate /etc/letsencrypt/live/main.fossapp.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/main.fossapp.online/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Old domain (redirect to new domain after testing)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.titancnc.eu;

    ssl_certificate /etc/letsencrypt/live/app.titancnc.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.titancnc.eu/privkey.pem;

    # Initially proxy to app (same as new domain)
    # Later change to redirect:
    # return 301 https://main.fossapp.online$request_uri;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# HTTP to HTTPS redirect
server {
    listen 80;
    listen [::]:80;
    server_name main.fossapp.online app.titancnc.eu;
    return 301 https://$server_name$request_uri;
}
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Deployment Steps

### 1. Pull Latest Code

```bash
cd /opt/fossapp
git fetch origin
git pull origin main
```

### 2. Rebuild Application

```bash
npm run build
```

Expected output:
```
✓ Compiled successfully in ~8s
Route (app)
...
├ ƒ /api/manifest         # New dynamic manifest endpoint
...
```

### 3. Restart Application

**If using Docker**:
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

**If using npm directly**:
```bash
# Kill existing process
pkill -f "next start"

# Start with new environment
npm run start > /var/log/fossapp/app.log 2>&1 &
```

**If using PM2**:
```bash
pm2 restart fossapp
```

### 4. Verify Deployment

```bash
# Health check on new domain
curl https://main.fossapp.online/api/health

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2025-10-28T...",
#   "version": "1.2.1",
#   "uptime": ...,
#   "environment": "production"
# }

# Check dynamic manifest
curl https://main.fossapp.online/api/manifest

# Expected: JSON manifest with new domain references

# Check old domain still works
curl https://app.titancnc.eu/api/health
```

### 5. Test OAuth Login

1. Visit `https://main.fossapp.online`
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Verify successful login and redirect to `/dashboard`

### 6. Test PWA Installation

**Chrome/Edge**:
1. Visit `https://main.fossapp.online`
2. Look for install icon in address bar
3. Click to install
4. Verify app installs with correct name and icons

**Mobile**:
1. Visit `https://main.fossapp.online` on mobile
2. Open browser menu
3. Select "Add to Home screen" or "Install"
4. Verify app installs correctly

## Post-Deployment Monitoring

### Monitor Application Logs

```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs fossapp

# Direct npm
tail -f /var/log/fossapp/app.log
```

### Monitor Nginx Logs

```bash
# Access logs
sudo tail -f /var/log/nginx/access.log | grep fossapp

# Error logs
sudo tail -f /var/log/nginx/error.log
```

### Key Metrics to Watch

- HTTP status codes (should be mostly 200, 304)
- OAuth callback success rate
- API endpoint response times
- PWA manifest requests
- User agent strings (PWA vs browser)

## Transition Period

During the transition period (both domains active):

1. **Monitor both domains** for traffic patterns
2. **Communicate new domain** to users via:
   - Email announcement
   - Banner in application
   - Social media/newsletter
3. **Track which domain users prefer** via analytics
4. **Keep old domain active** for at least 30 days

## Switching to Redirect (After Successful Transition)

Once the new domain is stable and users have migrated:

### 1. Update Nginx (Old Domain → Redirect)

```bash
sudo nano /etc/nginx/sites-available/fossapp
```

Change the old domain server block to redirect:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.titancnc.eu;

    ssl_certificate /etc/letsencrypt/live/app.titancnc.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.titancnc.eu/privkey.pem;

    # Permanent redirect to new domain
    return 301 https://main.fossapp.online$request_uri;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Remove Old Domain from Google OAuth

1. Go to Google Cloud Console → Credentials
2. Remove `app.titancnc.eu` from:
   - Authorized JavaScript origins
   - Authorized redirect URIs
3. Keep only `main.fossapp.online` and `localhost:8080`

### 3. Update Documentation

Remove references to old domain in:
- `CLAUDE.md`
- `docs/PWA.md`
- `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- `docs/vps-deployment.md`

## Rollback Plan

If issues arise with the new domain:

### Quick Rollback

1. **Revert `src/lib/config.ts`**:
   ```typescript
   PRODUCTION_DOMAIN: 'app.titancnc.eu',
   PRODUCTION_URL: 'https://app.titancnc.eu',
   ```

2. **Revert `.env.production`**:
   ```bash
   cp .env.production.backup-YYYYMMDD .env.production
   ```

3. **Rebuild and restart**:
   ```bash
   npm run build
   docker-compose restart  # or pm2 restart fossapp
   ```

4. **Update Google OAuth** (remove new domain if necessary)

## Troubleshooting

### OAuth Login Fails on New Domain

**Symptoms**: "Redirect URI mismatch" error

**Solution**:
1. Check Google Cloud Console has exact redirect URI:
   `https://main.fossapp.online/api/auth/callback/google`
2. Verify `NEXTAUTH_URL` in `.env.production` matches
3. Check Nginx `proxy_set_header Host $host` is set
4. Clear browser cookies and try again

### PWA Not Installing on New Domain

**Symptoms**: No install prompt or icon

**Solution**:
1. Check `/api/manifest` returns valid JSON
2. Verify SSL certificate is valid (no mixed content)
3. Check manifest references in DevTools → Application → Manifest
4. Clear cache and hard reload (Ctrl+Shift+R)

### Old Domain Shows Cached Content

**Symptoms**: Old domain shows old manifest/metadata

**Solution**:
1. Add cache-busting headers in Nginx:
   ```nginx
   add_header Cache-Control "no-cache, must-revalidate";
   ```
2. Clear CDN cache if using Cloudflare/etc.
3. Clear service worker: DevTools → Application → Service Workers → Unregister

### Health Check Fails

**Symptoms**: `/api/health` returns 502 or times out

**Solution**:
1. Check application is running: `docker-compose ps` or `pm2 status`
2. Check logs for errors: `docker-compose logs -f`
3. Verify port 8080 is accessible: `curl http://localhost:8080/api/health`
4. Check Nginx proxy configuration

## Success Criteria

Deployment is successful when:

- [x] New domain resolves correctly
- [x] SSL certificate is valid
- [x] `/api/health` returns 200 status
- [x] `/api/manifest` returns valid PWA manifest
- [x] OAuth login works on new domain
- [x] PWA installs correctly on desktop and mobile
- [x] All API endpoints respond correctly
- [x] No console errors in browser DevTools
- [x] Old domain still works (during transition)

## Communication Plan

### Announcement Template

**Subject**: FOSSAPP Moving to New Domain

Dear FOSSAPP Users,

We're excited to announce that FOSSAPP is moving to a new domain:

**New URL**: https://main.fossapp.online

**What you need to do**:
- Update your bookmarks to the new URL
- If you have the PWA installed, you may need to reinstall it
- Sign in with Google will work on both domains during transition

**Timeline**:
- Now: Both domains active
- 30 days: Old domain redirects to new domain
- 60 days: Old domain may be retired

The old domain (https://app.titancnc.eu) will continue to work during the transition period.

Thank you for your continued support!

## Notes

- DNS propagation can take up to 48 hours (usually much faster)
- SSL certificate generation with Let's Encrypt is instant
- Monitor error logs closely for first 24 hours
- Keep old domain active for at least 30 days
- Update internal documentation and links

## Last Updated

**2025-10-28** - Initial deployment guide created for domain migration to main.fossapp.online
