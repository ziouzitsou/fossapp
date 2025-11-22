# Docker Deployment

Complete guide for Docker-based deployment of FOSSAPP.

## Multi-Stage Build

The `Dockerfile` uses a multi-stage build for optimal production images.

### Build Stages

**1. Base Stage**
```dockerfile
FROM node:18-alpine AS base
```
- Node.js 18 on Alpine Linux (minimal footprint)
- Foundation for all other stages

**2. Dependencies Stage**
```dockerfile
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci
```
- Install production dependencies only
- Cached layer for faster rebuilds

**3. Builder Stage**
```dockerfile
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
```
- Full source code compilation
- Next.js standalone output mode
- Tree-shaking and optimization

**4. Runner Stage (Final)**
```dockerfile
FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
```
- Non-root user (`nextjs:nodejs`) for security
- Minimal production files only
- Standalone server bundle (~50MB)

## Docker Compose Configuration

### docker-compose.yml

```yaml
version: '3.8'

services:
  fossapp:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: fossapp-production
    ports:
      - "8080:8080"
    env_file:
      - .env.production
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8080/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "5"
        compress: "true"
    restart: unless-stopped
    networks:
      - fossapp-network

networks:
  fossapp-network:
    driver: bridge
```

### Key Features

- **Healthcheck**: Monitors `/api/health` endpoint every 30s
- **Logging**: Rotates logs at 10MB, keeps 5 files, compresses old logs
- **Restart Policy**: `unless-stopped` (survives reboots)
- **Custom Network**: Isolated bridge network
- **Environment**: Loaded from `.env.production`

## Health Check

The healthcheck verifies application status:

```bash
curl http://localhost:8080/api/health
```

**Healthy Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T09:51:00.000Z",
  "version": "1.3.5",
  "uptime": 199,
  "environment": "production"
}
```

**Health States**:
- **starting**: Initial 40s grace period
- **healthy**: 3 consecutive successful checks
- **unhealthy**: 3 consecutive failed checks

## Common Commands

### Build and Deploy

```bash
# Build image
docker-compose build

# Start container (detached)
docker-compose up -d

# Start with rebuild
docker-compose up -d --build

# Stop container
docker-compose down

# Restart (e.g., after .env changes)
docker-compose restart
```

### Monitoring

```bash
# View logs (follow mode)
docker-compose logs -f

# View last 100 lines
docker-compose logs --tail=100

# Check container status
docker-compose ps

# View health status
docker inspect fossapp-production | grep -A 10 Health

# Execute commands in running container
docker-compose exec fossapp sh
```

### Troubleshooting

```bash
# Check if container is running
docker ps | grep fossapp

# View detailed container info
docker inspect fossapp-production

# Check resource usage
docker stats fossapp-production

# Force rebuild without cache
docker-compose build --no-cache

# Remove container and volumes
docker-compose down -v
```

## Image Optimization

**Standalone Output**:
- Configured in `next.config.ts`: `output: 'standalone'`
- Bundles only necessary files (~50MB vs ~200MB)
- Self-contained server.js with minimal dependencies

**Layer Caching**:
- Dependencies cached separately (stage 2)
- Source code changes don't invalidate dependency layer
- Faster rebuilds during development

**Security**:
- Non-root user execution
- Minimal attack surface (Alpine base)
- No unnecessary packages
- Distroless alternative available

## Production Deployment

See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) for complete deployment workflow.

**Quick Deploy**:
```bash
# On production server
cd /opt/fossapp
./deploy.sh v1.3.6
```

The deploy script handles:
- Git pull
- Docker build
- Container restart
- Health verification

## Environment Variables

Required in `.env.production`:

```bash
# NextAuth
NEXTAUTH_URL=https://main.fossapp.online
NEXTAUTH_SECRET=<secret>

# Google OAuth
GOOGLE_CLIENT_ID=<id>
GOOGLE_CLIENT_SECRET=<secret>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_ROLE_KEY=<key>
```

**Never commit** `.env.production` - use `.env.example` as reference.

## Performance

**Build Time**: ~6-7 seconds (with Turbopack)
**Image Size**: ~150MB (Alpine + Node + standalone bundle)
**Startup Time**: ~5 seconds (to healthy state)
**Memory Usage**: ~150MB average, ~300MB peak

## Logging

Logs are stored in JSON format with rotation:

```bash
# Log location (on host)
/var/lib/docker/containers/<container-id>/<container-id>-json.log

# View logs
docker-compose logs -f

# Filter logs by time
docker-compose logs --since 1h

# Export logs
docker-compose logs > fossapp-logs-$(date +%Y%m%d).txt
```

## Advanced Configuration

### Custom Port

Change exposed port in `docker-compose.yml`:

```yaml
ports:
  - "3000:8080"  # Host:Container
```

### Resource Limits

Add resource constraints:

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 512M
    reservations:
      memory: 256M
```

### Volume Mounts

Persist data with volumes:

```yaml
volumes:
  - ./logs:/app/logs
  - ./uploads:/app/public/uploads
```

## Troubleshooting

**Container won't start**:
1. Check logs: `docker-compose logs`
2. Verify .env.production exists and is valid
3. Check port 8080 is available: `netstat -tuln | grep 8080`
4. Try rebuilding: `docker-compose up -d --build`

**Healthcheck failing**:
1. Check health endpoint manually: `curl http://localhost:8080/api/health`
2. Verify environment variables are set correctly
3. Check database connectivity (Supabase)
4. Review application logs for errors

**High memory usage**:
1. Check for memory leaks in application code
2. Add resource limits in docker-compose.yml
3. Monitor with: `docker stats fossapp-production`

## See Also

- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md)
- [vps-deployment.md](./vps-deployment.md)
- Main documentation: [CLAUDE.md](../CLAUDE.md)
