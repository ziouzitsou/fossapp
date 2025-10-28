# Google OAuth Cleanup - Remove Old Domain

**Old Domain to Remove**: app.titancnc.eu
**Current Domain to Keep**: main.fossapp.online

## When to Perform This Cleanup

**Option 1: Now (Recommended after Nginx redirect is active)**
- If Nginx redirect from app.titancnc.eu → main.fossapp.online is working
- Users will be redirected automatically, OAuth will use new domain

**Option 2: After monitoring period (30+ days)**
- Keep old domain in OAuth for safety
- Monitor traffic to ensure all users are using new domain
- Then remove old domain

## Instructions

### 1. Go to Google Cloud Console

Visit: https://console.cloud.google.com/

### 2. Select Your Project

Click the project dropdown at the top and select your FOSSAPP project.

### 3. Navigate to OAuth Credentials

1. In the left sidebar: **APIs & Services** → **Credentials**
2. Find your OAuth 2.0 Client ID (should be named something like "FOSSAPP" or "Web client")
3. Click on it to edit

### 4. Remove Old Domain from Authorized JavaScript Origins

**Current list includes:**
- `https://main.fossapp.online` ✅ KEEP
- `https://app.titancnc.eu` ❌ REMOVE
- `http://localhost:8080` ✅ KEEP (for development)

**After cleanup:**
- `https://main.fossapp.online` ✅
- `http://localhost:8080` ✅

**Steps:**
1. Scroll to **Authorized JavaScript origins**
2. Find `https://app.titancnc.eu`
3. Click the **X** or **Delete** button next to it
4. **Do NOT delete** `https://main.fossapp.online` or `http://localhost:8080`

### 5. Remove Old Domain from Authorized Redirect URIs

**Current list includes:**
- `https://main.fossapp.online/api/auth/callback/google` ✅ KEEP
- `https://app.titancnc.eu/api/auth/callback/google` ❌ REMOVE
- `http://localhost:8080/api/auth/callback/google` ✅ KEEP (for development)

**After cleanup:**
- `https://main.fossapp.online/api/auth/callback/google` ✅
- `http://localhost:8080/api/auth/callback/google` ✅

**Steps:**
1. Scroll to **Authorized redirect URIs**
2. Find `https://app.titancnc.eu/api/auth/callback/google`
3. Click the **X** or **Delete** button next to it
4. **Do NOT delete** the new domain or localhost URIs

### 6. Save Changes

1. Click **SAVE** at the bottom of the page
2. Wait for confirmation message

### 7. Verify Changes

**Check the OAuth client configuration:**
1. Refresh the page
2. Verify only new domain and localhost remain
3. Confirm no errors or warnings

## What Happens After Removal

### If Nginx Redirect is Active ✅

- Users visiting `app.titancnc.eu` → automatically redirected to `main.fossapp.online`
- OAuth works seamlessly on new domain
- No user impact

### If Nginx Redirect is NOT Active ⚠️

- Users visiting `app.titancnc.eu` → OAuth login will FAIL
- Error: "Redirect URI mismatch"
- **Solution**: Keep old domain in OAuth until redirect is active

## Rollback

If you need to re-add the old domain:

1. Go back to Google Cloud Console → Credentials
2. Edit the OAuth client
3. Add back:
   - **JavaScript origin**: `https://app.titancnc.eu`
   - **Redirect URI**: `https://app.titancnc.eu/api/auth/callback/google`
4. Save

## Current Status Checklist

Before removing old domain from OAuth, ensure:

- [x] New domain deployed and working: https://main.fossapp.online ✅
- [x] `.env.production` updated with new domain ✅
- [ ] Nginx redirect configured (app.titancnc.eu → main.fossapp.online)
- [ ] Redirect tested and working
- [ ] Ready to remove old domain from OAuth

## Testing After Removal

1. **Clear browser cache** (or use incognito)
2. Visit `https://main.fossapp.online`
3. Click "Sign in with Google"
4. Complete OAuth flow
5. Verify successful login

## Monitoring

After OAuth cleanup, monitor for errors:

```bash
# On production server
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu
cd /opt/fossapp
docker compose logs -f | grep -i "oauth\|auth\|401\|403"
```

Look for:
- OAuth callback errors
- Redirect URI mismatch errors
- Authentication failures

## Support

If users report OAuth issues:

1. Check they're using `https://main.fossapp.online` (not old domain)
2. Ask them to clear browser cache
3. Ask them to try incognito/private mode
4. If persistent, temporarily re-add old domain to OAuth

## Last Updated

**2025-10-28** - Created for domain migration OAuth cleanup
