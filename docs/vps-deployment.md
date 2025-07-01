# VPS Deployment Guide for FOSSAPP

## Overview

This guide covers deploying FOSSAPP to a VPS using Docker with proper versioning, logging, and zero-downtime updates.

## Prerequisites

### VPS Requirements
- **RAM**: Minimum 2GB (recommended 4GB+)
- **CPU**: 2+ cores
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 22.04 LTS (recommended)
- **Network**: Public IP with ports 80/443 accessible

### Software Requirements
- Docker & Docker Compose
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

# Install Docker Compose
sudo apt install docker-compose -y

# Add user to docker group
sudo usermod -aG docker $USER
```

### 3. Install Nginx & Certbot
```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

## Deployment Strategy

### Blue-Green Deployment Approach

Use this strategy for zero-downtime updates:

1. **Blue Environment**: Current running version
2. **Green Environment**: New version being deployed
3. **Switch**: Nginx routes traffic to new version
4. **Cleanup**: Remove old version

### Directory Structure
```
/opt/fossapp/
├── current/           # Current deployment (symlink)
├── releases/
│   ├── v1.0.0/       # Version directories
│   ├── v1.0.1/
│   └── v1.1.0/
├── shared/
│   ├── .env.production
│   └── logs/
└── scripts/
    ├── deploy.sh
    └── rollback.sh
```

## Deployment Scripts

### Deploy Script (`/opt/fossapp/scripts/deploy.sh`)
```bash
#!/bin/bash
set -e

VERSION=$1
REPO_URL="https://github.com/ziouzitsou/fossapp.git"
DEPLOY_DIR="/opt/fossapp"
RELEASES_DIR="$DEPLOY_DIR/releases"
SHARED_DIR="$DEPLOY_DIR/shared"

if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 v1.1.1"
    exit 1
fi

echo "🚀 Deploying FOSSAPP $VERSION"

# Create directories
mkdir -p $RELEASES_DIR/$VERSION
mkdir -p $SHARED_DIR/logs

# Clone and checkout version
cd $RELEASES_DIR/$VERSION
git clone $REPO_URL .
git checkout tags/$VERSION

# Copy shared environment file (not symlink for Docker build)
cp $SHARED_DIR/.env.production .env.production

# Build Docker image
docker build -t fossapp:$VERSION .

# Update docker-compose to use new image
sed -i "s/image: fossapp:.*/image: fossapp:$VERSION/" docker-compose.yml

# Stop old version if running
CURRENT_DIR=$(readlink -f $DEPLOY_DIR/current 2>/dev/null || echo "")
if [ -n "$CURRENT_DIR" ] && [ -d "$CURRENT_DIR" ]; then
    echo "🔄 Stopping previous version..."
    cd "$CURRENT_DIR"
    docker compose down || true
fi

# Start new container
cd $RELEASES_DIR/$VERSION
docker compose up -d

# Health check
echo "⏳ Waiting for health check..."
sleep 30
if ! curl -f http://localhost:8080/api/health; then
    echo "❌ Health check failed, rolling back..."
    docker compose down
    exit 1
fi

# Update current symlink
cd $DEPLOY_DIR
rm -f current
ln -sf releases/$VERSION current

# Clean up old containers and images
docker system prune -f

echo "✅ Deployment successful: $VERSION"
echo "📊 Version display should show: $VERSION (without -dev suffix)"
```

### Rollback Script (`/opt/fossapp/scripts/rollback.sh`)
```bash
#!/bin/bash
set -e

DEPLOY_DIR="/opt/fossapp"
RELEASES_DIR="$DEPLOY_DIR/releases"

# Find previous version
CURRENT_VERSION=$(readlink $DEPLOY_DIR/current | sed 's/releases\///')
PREVIOUS_VERSION=$(ls -1 $RELEASES_DIR | grep -v $CURRENT_VERSION | tail -1)

if [ -z "$PREVIOUS_VERSION" ]; then
    echo "❌ No previous version found"
    exit 1
fi

echo "🔄 Rolling back from $CURRENT_VERSION to $PREVIOUS_VERSION"

# Switch to previous version
cd $DEPLOY_DIR
rm -f current
ln -sf releases/$PREVIOUS_VERSION current

# Restart with previous version
cd current
docker-compose down
docker-compose up -d

echo "✅ Rollback successful: $PREVIOUS_VERSION"
```

## Nginx Configuration

### `/etc/nginx/sites-available/fossapp`
```nginx
upstream fossapp {
    server 127.0.0.1:8080;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

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
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location /_next/static/ {
        proxy_pass http://fossapp;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Logs
    access_log /var/log/nginx/fossapp.access.log;
    error_log /var/log/nginx/fossapp.error.log;
}
```

## SSL Setup

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/fossapp /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Restart nginx
sudo systemctl restart nginx
```

## Monitoring & Logs

### Log Rotation (Already handled by Docker)
Docker Compose is configured with:
- Max log size: 10MB per file
- Max files: 5 (50MB total)
- Compression: enabled

### System Monitoring
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f fossapp

# View Nginx logs
sudo tail -f /var/log/nginx/fossapp.access.log
sudo tail -f /var/log/nginx/fossapp.error.log

# System resources
htop
df -h
```

## Deployment Workflow

### 1. Development
```bash
# Local development
npm run dev

# Create new version
npm version patch
git push origin main --tags
```

### 2. VPS Deployment
```bash
# SSH to VPS
ssh user@your-vps-ip

# Deploy new version
sudo /opt/fossapp/scripts/deploy.sh v1.0.1
```

### 3. Verification
- Check application health
- Verify logs
- Test functionality
- Monitor performance

### 4. Rollback (if needed)
```bash
sudo /opt/fossapp/scripts/rollback.sh
```

## Security Considerations

1. **Firewall**: Only open ports 22, 80, 443
2. **SSH**: Use key-based authentication
3. **Updates**: Regular system updates
4. **Backups**: Regular database backups
5. **Monitoring**: Set up alerts for downtime
6. **SSL**: Keep certificates updated

## Backup Strategy

```bash
# Database backup (if using local DB)
docker exec fossapp-db pg_dump -U user dbname > backup-$(date +%Y%m%d).sql

# Application backup
tar -czf fossapp-backup-$(date +%Y%m%d).tar.gz /opt/fossapp/
```

## Performance Optimization

1. **CDN**: Use CloudFlare for static assets
2. **Caching**: Implement Redis for session storage
3. **Database**: Optimize Supabase queries
4. **Images**: Use Next.js Image optimization
5. **Monitoring**: Set up APM tools

## Version Display Feature

FOSSAPP includes a built-in version display system for environment awareness:

### How It Works
- **Location**: Bottom of sidebar navigation on all authenticated pages
- **Development**: Shows `v1.1.1-dev` when running locally (`NODE_ENV=development`)
- **Production**: Shows `v1.1.1` when deployed to VPS (`NODE_ENV=production`)
- **Styling**: Small, monospace font with subtle border separator

### Benefits
- **Environment Clarity**: Instantly know if you're on dev or production
- **Version Tracking**: See exactly which version is deployed
- **Deployment Verification**: Confirm new versions are running correctly
- **Debugging Aid**: Include version info in bug reports

### Implementation
The version is read from `package.json` and environment is detected via `process.env.NODE_ENV`. The component is included in both dashboard and products pages for consistency.

## Troubleshooting

### Common Issues
1. **Container won't start**: Check logs and environment variables
2. **502 Bad Gateway**: Verify container is running on port 8080
3. **SSL issues**: Check certificate validity
4. **Memory issues**: Monitor RAM usage and adjust container limits
5. **Version not updating**: Ensure Docker build used correct environment file

### Useful Commands
```bash
# Container debugging
docker exec -it fossapp sh

# Nginx debugging
sudo nginx -t
sudo systemctl status nginx

# SSL debugging
sudo certbot certificates
```

This deployment strategy provides production-ready hosting with proper versioning, logging, and zero-downtime updates.