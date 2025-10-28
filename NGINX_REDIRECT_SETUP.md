# Nginx Redirect Setup - Old Domain to New Domain

**Old Domain**: app.titancnc.eu
**New Domain**: main.fossapp.online

## Instructions for Manual Setup (Requires sudo)

Since Nginx configuration requires sudo access, follow these steps on the production server:

### 1. SSH to Production Server

```bash
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu
```

### 2. Check Current Nginx Configuration

```bash
sudo cat /etc/nginx/sites-available/default
# or
sudo cat /etc/nginx/sites-available/fossapp
```

### 3. Update Nginx Configuration

Find the server block for `app.titancnc.eu` and change it from proxying to redirecting:

**Before** (current):
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.titancnc.eu;

    ssl_certificate /etc/letsencrypt/live/app.titancnc.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.titancnc.eu/privkey.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**After** (redirect):
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

### 4. Edit the Configuration

```bash
sudo nano /etc/nginx/sites-available/default
# or
sudo nano /etc/nginx/sites-available/fossapp
```

Replace the old server block with the redirect version above.

### 5. Test Nginx Configuration

```bash
sudo nginx -t
```

Expected output:
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 6. Reload Nginx

```bash
sudo systemctl reload nginx
```

### 7. Verify Redirect Works

```bash
# Test redirect
curl -I https://app.titancnc.eu

# Expected output:
# HTTP/2 301
# location: https://main.fossapp.online/
```

## Alternative: Complete Nginx Configuration Example

If you need to create a new configuration from scratch:

```nginx
# New domain (primary)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name main.fossapp.online;

    ssl_certificate /etc/letsencrypt/live/main.fossapp.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/main.fossapp.online/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;

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

# Old domain (redirect)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.titancnc.eu;

    ssl_certificate /etc/letsencrypt/live/app.titancnc.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.titancnc.eu/privkey.pem;

    # Permanent redirect to new domain
    return 301 https://main.fossapp.online$request_uri;
}

# HTTP to HTTPS redirect for both domains
server {
    listen 80;
    listen [::]:80;
    server_name main.fossapp.online app.titancnc.eu;
    return 301 https://$server_name$request_uri;
}
```

## Troubleshooting

### Redirect Not Working

1. Check Nginx is running:
   ```bash
   sudo systemctl status nginx
   ```

2. Check Nginx error logs:
   ```bash
   sudo tail -f /var/log/nginx/error.log
   ```

3. Check SSL certificates:
   ```bash
   sudo certbot certificates
   ```

### SSL Certificate Issues

If SSL certificate for old domain expires or causes issues:

```bash
# Renew certificate
sudo certbot renew

# Or just keep the certificate for redirects (it's fine)
```

### Browser Still Shows Old Domain

- Clear browser cache
- Use incognito/private mode
- Check DNS propagation: `dig app.titancnc.eu`

## After Nginx Update

Once Nginx redirect is configured, you can optionally clean up:

1. **Remove old domain from Google OAuth** (see below)
2. **Update deploy script** to remove old domain message
3. **Monitor access logs** to see redirect activity:
   ```bash
   sudo tail -f /var/log/nginx/access.log | grep "app.titancnc.eu"
   ```

## Last Updated

**2025-10-28** - Created for domain migration from app.titancnc.eu to main.fossapp.online
