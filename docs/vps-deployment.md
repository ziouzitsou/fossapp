# VPS Deployment Guide for FOSSAPP

## Overview

This guide covers deploying FOSSAPP to a VPS using Docker with simple git-based versioning.

**Updated 2025-10-27**: Migrated from Blue-Green deployment to simplified git-based deployment for easier solo development.

## Prerequisites

### VPS Requirements
- **RAM**: Minimum 2GB (recommended 4GB+)
- **CPU**: 2+ cores
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 22.04 LTS (recommended)
- **Network**: Public IP with ports 80/443 accessible

### Software Requirements
- Docker & Docker Compose v2
- Git
- Nginx (for reverse proxy)
- Certbot (for SSL certificates)

## Initial VPS Setup

### 1. Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify Docker Compose v2
docker compose version

# Add user to docker group
sudo usermod -aG docker $USER
```

### 3. Install Nginx & Certbot
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

## Deployment Strategy

### Simple Git-Based Deployment

**Perfect for solo development** - Optimized for single developer workflow.

**Deployment Directory Structure**:
```
/opt/fossapp/
├── .git/                # Git repository (source of truth)
├── src/                 # Application source code
├── docker-compose.yml   # Docker Compose configuration
├── .env.production      # Production secrets (not in git)
├── Dockerfile           # Multi-stage production build
├── deploy.sh            # Automated deployment script
└── docs/                # Documentation
```

**Benefits**:
- ✅ Simple and maintainable
- ✅ Git tags are versions (single source of truth)
- ✅ Easy rollback via `git checkout`
- ✅ No complex symlinks or multiple directories
- ✅ Perfect for early-stage apps

**Trade-offs**:
- ⚠️ ~1-2 minutes downtime during deployment (acceptable at current scale)
- ⚠️ Rollback requires rebuild (~2-3 minutes)

## Initial Deployment

### 1. Clone Repository
```bash
sudo mkdir -p /opt/fossapp
sudo chown $USER:$USER /opt/fossapp
cd /opt/fossapp
git clone https://github.com/ziouzitsou/fossapp.git .
git checkout v1.1.1  # Deploy specific version
```

### 2. Create Environment File
```bash
# Copy from template or create manually
nano /opt/fossapp/.env.production
```

Required variables:
```bash
# NextAuth
NEXTAUTH_URL=https://app.titancnc.eu
NEXTAUTH_SECRET=<generate-with-openssl-rand>

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase>

# Application
NODE_ENV=production
PORT=8080
HOSTNAME=0.0.0.0
```

### 3. Create Deploy Script
The deploy script is already in the repository at `/opt/fossapp/deploy.sh`.

Make it executable:
```bash
chmod +x /opt/fossapp/deploy.sh
```

### 4. Build and Deploy
```bash
cd /opt/fossapp
./deploy.sh v1.1.1
```

## Deploy Script Usage

The `deploy.sh` script automates the entire deployment process:

```bash
# Deploy specific version
./deploy.sh v1.1.1

# Deploy latest from main
./deploy.sh main

# The script will:
# 1. Fetch latest from GitHub
# 2. Checkout specified version
# 3. Stop existing container
# 4. Build Docker image
# 5. Start new container
# 6. Wait and verify health check
# 7. Clean up old images
```

## Nginx Configuration

### Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/fossapp
```

```nginx
upstream fossapp {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name app.titancnc.eu;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name app.titancnc.eu;

    ssl_certificate /etc/letsencrypt/live/app.titancnc.eu/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.titancnc.eu/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    location / {
        proxy_pass http://fossapp;
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
        proxy_pass http://fossapp;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    access_log /var/log/nginx/fossapp.access.log;
    error_log /var/log/nginx/fossapp.error.log;
}
```

### Enable Site and Get SSL
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/fossapp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d app.titancnc.eu

# Restart nginx
sudo systemctl restart nginx
```

## Common Operations

### Deploy New Version
```bash
cd /opt/fossapp
./deploy.sh v1.1.2
```

### Rollback to Previous Version
```bash
cd /opt/fossapp
./deploy.sh v1.1.1
```

### View Logs
```bash
cd /opt/fossapp
docker compose logs -f fossapp
```

### Check Status
```bash
cd /opt/fossapp
docker compose ps
curl http://localhost:8080/api/health
```

### Restart Container
```bash
cd /opt/fossapp
docker compose restart
```

### Manual Deployment (if script fails)
```bash
cd /opt/fossapp
git fetch --tags
git checkout v1.1.2
docker compose down
docker compose build
docker compose up -d

# Wait and verify
sleep 30
curl http://localhost:8080/api/health
```

## Monitoring & Logs

### Docker Logs
Configured in `docker-compose.yml`:
- Max log size: 10MB per file
- Max files: 5 (50MB total)
- Compression: enabled

### View Logs
```bash
# Real-time logs
docker compose logs -f

# Last 50 lines
docker compose logs --tail 50

# Nginx logs
sudo tail -f /var/log/nginx/fossapp.access.log
sudo tail -f /var/log/nginx/fossapp.error.log
```

### Health Monitoring
```bash
# Local health check
curl http://localhost:8080/api/health

# Production health check
curl https://app.titancnc.eu/api/health
```

## Version Management

### Create New Version Locally
```bash
# Make changes
git add .
git commit -m "feat: new feature"

# Create version
npm version patch  # or minor, major
git push origin main --tags
```

### Deploy to Production
```bash
# SSH to VPS
ssh user@platon.titancnc.eu

# Deploy
cd /opt/fossapp
./deploy.sh v1.1.2
```

## Troubleshooting

### Health Check Fails
```bash
# Check container logs
cd /opt/fossapp
docker compose logs -f

# Check container is running
docker compose ps

# Restart container
docker compose restart

# Check port availability
sudo lsof -i :8080
```

### Database Connection Issues
```bash
# Verify environment variables
cat /opt/fossapp/.env.production | grep SUPABASE

# Check Supabase status
# Visit Supabase dashboard
```

### Build Failures
```bash
# Clean Docker cache
docker system prune -a

# Rebuild from scratch
cd /opt/fossapp
docker compose build --no-cache
docker compose up -d
```

### Git Issues
```bash
# Reset to specific version
cd /opt/fossapp
git fetch --tags
git reset --hard v1.1.1

# Force pull latest
git fetch origin
git reset --hard origin/main
```

## Security Best Practices

1. **Firewall**: Only open ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
2. **SSH Keys**: Use key-based authentication only
3. **Updates**: Regular system updates (`apt update && apt upgrade`)
4. **Secrets**: Never commit `.env.production` to git
5. **SSL**: Keep Let's Encrypt certificates updated (auto-renews)
6. **Backups**: Regular database backups to external storage

## Future Enhancements

When the app scales beyond solo development:

### Option 1: Watchtower (Automated Deployments)
```yaml
# Add to docker-compose.yml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 300
```

### Option 2: GitHub Actions CI/CD
- Automated testing on push
- Build and push to Docker registry
- Auto-deploy to production

### Option 3: Load Balancer
- Zero-downtime deployments
- Blue-green or rolling updates
- Traffic distribution

For now, the simple git-based approach is optimal for solo development.

## Migration Notes (2025-10-27)

### Previous Setup (Deprecated)
- Blue-Green deployment with symlinks
- Directory: `/opt/fossapp-old-bluegreen/`
- Multiple release directories
- Symlink management for version switching

### Current Setup (Active)
- Simple git-based deployment
- Directory: `/opt/fossapp/`
- Git tags for versioning
- Single deployment directory

**Backup of old structure**: `/opt/fossapp-backup-20251027-130630.tar.gz`

Can be safely removed after 1 week of stable operation.
