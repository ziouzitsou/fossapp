# Quick Deployment Checklist - New Domain

**New Domain**: `main.fossapp.online`
**Old Domain**: `app.titancnc.eu` (keep active during transition)
**Date**: 2025-10-28

## Pre-Deployment (Complete) ✅

- [x] Updated `src/lib/config.ts` with new domain
- [x] Build tested successfully
- [x] Documentation updated

## Production Server Setup

### 1. Update Environment Variables ⚠️ CRITICAL

```bash
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu
cd /opt/fossapp

# Backup
cp .env.production .env.production.backup-$(date +%Y%m%d)

# Edit
nano .env.production
```

Update:
```bash
NEXTAUTH_URL=https://main.fossapp.online
```

### 2. Update Google OAuth ⚠️ CRITICAL

Go to: https://console.cloud.google.com/

**Add to Authorized JavaScript origins**:
- `https://main.fossapp.online`

**Add to Authorized redirect URIs**:
- `https://main.fossapp.online/api/auth/callback/google`

**Keep old domain** during transition:
- `https://app.titancnc.eu`
- `https://app.titancnc.eu/api/auth/callback/google`

### 3. DNS & SSL

```bash
# Verify DNS
dig main.fossapp.online

# Generate SSL certificate
sudo certbot --nginx -d main.fossapp.online
```

### 4. Deploy

```bash
cd /opt/fossapp
git pull origin main
npm run build

# If using Docker:
docker-compose down && docker-compose build && docker-compose up -d

# If using PM2:
pm2 restart fossapp
```

### 5. Verify

```bash
# Health check
curl https://main.fossapp.online/api/health

# Manifest
curl https://main.fossapp.online/api/manifest

# Old domain still works
curl https://app.titancnc.eu/api/health
```

### 6. Test in Browser

- [ ] Visit `https://main.fossapp.online`
- [ ] Sign in with Google works
- [ ] PWA installs correctly
- [ ] No console errors

### 7. Monitor

```bash
# Logs
docker-compose logs -f
# or
pm2 logs fossapp

# Nginx
sudo tail -f /var/log/nginx/access.log
```

## Rollback Plan

If issues occur:

```bash
# Revert config
cd /opt/fossapp
git checkout HEAD~1 src/lib/config.ts

# Revert env
cp .env.production.backup-YYYYMMDD .env.production

# Rebuild
npm run build
docker-compose restart
```

## After 30 Days (Successful Transition)

1. Update Nginx to redirect old domain:
   ```nginx
   return 301 https://main.fossapp.online$request_uri;
   ```

2. Remove old domain from Google OAuth

3. Update all documentation

## Complete Documentation

See `docs/NEW_DOMAIN_DEPLOYMENT.md` for detailed guide.
