# FOSSAPP Monorepo Migration Plan

## Overview
Migration from single Next.js app to Turborepo-based monorepo with 12 packages.

**Timeline**: 4-6 weeks (Incremental approach)
**Strategy**: Extract packages one-by-one while keeping app running
**Tool**: Turborepo + npm workspaces

---

## Phase 1: Foundation (Week 1)

### Day 1-2: Setup Monorepo Infrastructure

```bash
# Install Turborepo
npm install turbo --save-dev

# Create directory structure
mkdir -p apps/web
mkdir -p packages/core/src
mkdir -p packages/ui/src

# Initialize workspace
npm pkg set workspaces='["apps/*","packages/*"]'
```

**Create `turbo.json`:**
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "outputs": []
    },
    "type-check": {
      "outputs": []
    }
  }
}
```

**Create `packages/core/package.json`:**
```json
{
  "name": "@fossapp/core",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    "./auth": "./src/auth/index.ts",
    "./db": "./src/db/index.ts",
    "./logging": "./src/logging/index.ts",
    "./ratelimit": "./src/ratelimit/index.ts",
    "./config": "./src/config/index.ts",
    "./utils": "./src/utils/index.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.50.2",
    "next-auth": "^4.24.11",
    "zod": "^4.2.1"
  }
}
```

**Create `packages/ui/package.json`:**
```json
{
  "name": "@fossapp/ui",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    "./components/*": "./src/components/*/index.tsx",
    "./hooks/*": "./src/hooks/*.ts",
    "./theme": "./src/theme/index.tsx",
    "./utils": "./src/utils/index.ts"
  },
  "dependencies": {
    "react": "^19.0.0",
    "next-themes": "^0.4.6",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.1",
    "@radix-ui/react-slot": "^1.2.4"
  }
}
```

### Day 3-4: Extract Core Services

**Move files:**
```bash
# Auth
mv src/lib/auth.ts packages/core/src/auth/index.ts
mv src/lib/user-service.ts packages/core/src/auth/user-service.ts
mv src/lib/permissions.ts packages/core/src/auth/permissions.ts

# Database
mv src/lib/supabase-server.ts packages/core/src/db/server.ts
mv src/lib/supabase.ts packages/core/src/db/client.ts

# Logging
mv src/lib/event-logger.ts packages/core/src/logging/server.ts
mv src/lib/event-logger-client.ts packages/core/src/logging/client.ts

# Config
mv src/lib/config.ts packages/core/src/config/index.ts
mv src/lib/constants.ts packages/core/src/config/constants.ts
mv src/lib/env-schema.ts packages/core/src/config/env.ts

# Rate limiting
mv src/lib/ratelimit.ts packages/core/src/ratelimit/index.ts

# Shared utilities
mv src/lib/utils.ts packages/core/src/utils/index.ts
mv src/lib/currency.ts packages/core/src/utils/currency.ts
mv src/lib/taxonomy-data.ts packages/core/src/utils/taxonomy.ts
mv src/lib/api-client.ts packages/core/src/utils/api-client.ts
```

**Create barrel exports:**
```typescript
// packages/core/src/auth/index.ts
export { authOptions } from './config'
export { createUser, getUserByEmail } from './user-service'
export { canUserAccess } from './permissions'

// packages/core/src/db/index.ts
export { supabaseServer } from './server'
export { supabase } from './client'

// packages/core/src/logging/index.ts
export { logEvent } from './server'
export { logEventClient } from './client'

// etc...
```

### Day 5: Update Imports in Main App

**Global find/replace:**
```typescript
// Before → After
import { supabaseServer } from '@/lib/supabase-server'
→ import { supabaseServer } from '@fossapp/core/db'

import { logEvent } from '@/lib/event-logger'
→ import { logEvent } from '@fossapp/core/logging'

import { authOptions } from '@/lib/auth'
→ import { authOptions } from '@fossapp/core/auth'
```

**Update `apps/web/package.json`:**
```json
{
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*"
  }
}
```

**Run:**
```bash
npm install
npx turbo run dev --filter=web
# Test everything works!
```

---

## Phase 2: Extract UI Layer (Week 1)

### Day 6-7: Extract UI Components

**Move files:**
```bash
# shadcn/ui components
mv src/components/ui packages/ui/src/components/ui

# Shared components
mv src/components/theme-provider.tsx packages/ui/src/theme/provider.tsx

# Hooks
mv src/hooks/use-mobile.tsx packages/ui/src/hooks/use-mobile.ts
mv src/hooks/use-page-performance.ts packages/ui/src/hooks/use-page-performance.ts

# Utilities
# (already moved to core, but UI-specific utils go here)
```

**Update imports:**
```typescript
// Before
import { Button } from '@/components/ui/button'
import { useIsMobile } from '@/hooks/use-mobile'

// After
import { Button } from '@fossapp/ui/components/button'
import { useIsMobile } from '@fossapp/ui/hooks/use-mobile'
```

**Checkpoint**: Verify app still runs and builds successfully.

---

## Phase 3: Extract Independent Domains (Week 2-3)

### Products Package

```bash
mkdir -p packages/products/src/{actions,components,api,types}

# Move files
mv src/lib/actions/products.ts packages/products/src/actions/index.ts
mv src/components/products packages/products/src/components/
mv src/app/api/products packages/products/src/api/
# Update imports
```

**`packages/products/package.json`:**
```json
{
  "name": "@fossapp/products",
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*"
  }
}
```

### Customers Package

```bash
mkdir -p packages/customers/src/{actions,components}

mv src/lib/actions/customers.ts packages/customers/src/actions/index.ts
# Update imports
```

### Dashboard Package

```bash
mkdir -p packages/dashboard/src/{actions,components}

mv src/lib/actions/dashboard.ts packages/dashboard/src/actions/index.ts
# Update imports
```

### Planner Package

```bash
mkdir -p packages/planner/src/{services,components,api}

mv src/lib/planner packages/planner/src/services/
mv src/components/planner packages/planner/src/components/
mv src/app/api/planner packages/planner/src/api/
# Update imports
```

**`packages/planner/package.json`:**
```json
{
  "name": "@fossapp/planner",
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "@aps_sdk/model-derivative": "^1.2.0"
  }
}
```

### Projects Package

```bash
mkdir -p packages/projects/src/{actions,services,components}

mv src/lib/actions/projects.ts packages/projects/src/actions/projects.ts
mv src/lib/actions/project-areas.ts packages/projects/src/actions/areas.ts
mv src/lib/actions/project-drive.ts packages/projects/src/actions/drive.ts
mv src/lib/google-drive-project-service.ts packages/projects/src/services/drive.ts
mv src/components/projects packages/projects/src/components/
# Update imports
```

**`packages/projects/package.json`:**
```json
{
  "name": "@fossapp/projects",
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "googleapis": "^166.0.0"
  }
}
```

### Feedback Package

```bash
mkdir -p packages/feedback/src/{agent,services,components,api}

mv src/lib/feedback packages/feedback/src/
mv src/components/feedback packages/feedback/src/components/
mv src/app/api/feedback packages/feedback/src/api/
# Update imports
```

**`packages/feedback/package.json`:**
```json
{
  "name": "@fossapp/feedback",
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "@anthropic-ai/sdk": "^0.71.2",
    "resend": "^6.6.0",
    "html2canvas": "^1.4.1"
  }
}
```

**Checkpoint**: After each package extraction:
```bash
npm install
npx turbo run build --filter=web
npx turbo run dev --filter=web
# Manual smoke test of extracted feature
git commit -m "refactor: extract @fossapp/[package-name]"
```

---

## Phase 4: Extract Coupled Domains (Week 4)

### Tiles Package (with shared progress-store)

```bash
mkdir -p packages/tiles/src/{services,components,api,progress}

# Move files
mv src/lib/tiles packages/tiles/src/services/
mv src/components/tiles packages/tiles/src/components/
mv src/app/api/tiles packages/tiles/src/api/

# IMPORTANT: Export progress-store for reuse
mv src/lib/tiles/progress-store.ts packages/tiles/src/progress/store.ts
```

**`packages/tiles/package.json`:**
```json
{
  "name": "@fossapp/tiles",
  "exports": {
    "./services/*": "./src/services/*.ts",
    "./components/*": "./src/components/*.tsx",
    "./progress": "./src/progress/store.ts",  // ← EXPORTED!
    "./api/*": "./src/api/*.ts"
  },
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "@aps_sdk/oss": "^1.3.2",
    "sharp": "^0.34.5",
    "googleapis": "^166.0.0",
    "archiver": "^7.0.1"
  }
}
```

### Playground Package (depends on tiles)

```bash
mkdir -p packages/playground/src/{services,components,api}

mv src/lib/playground packages/playground/src/services/
mv src/components/playground packages/playground/src/components/
mv src/app/api/playground packages/playground/src/api/
```

**`packages/playground/package.json`:**
```json
{
  "name": "@fossapp/playground",
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "@fossapp/tiles": "workspace:*"  // ← Uses progress-store
  }
}
```

**Update imports in playground:**
```typescript
// Before
import { createJob, addProgress } from '@/lib/tiles/progress-store'

// After
import { createJob, addProgress } from '@fossapp/tiles/progress'
```

### Symbol-Generator Package (depends on tiles)

```bash
mkdir -p packages/symbol-generator/src/{services,components,api}

mv src/lib/symbol-generator packages/symbol-generator/src/services/
mv src/components/symbol-generator packages/symbol-generator/src/components/
mv src/app/api/symbol-generator packages/symbol-generator/src/api/
```

**`packages/symbol-generator/package.json`:**
```json
{
  "name": "@fossapp/symbol-generator",
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "@fossapp/tiles": "workspace:*",  // ← Uses progress-store
    "@anthropic-ai/sdk": "^0.71.2"
  }
}
```

**Update imports:**
```typescript
// Before
import { createJob, addProgress } from '@/lib/tiles/progress-store'

// After
import { createJob, addProgress } from '@fossapp/tiles/progress'
```

**Checkpoint**: Verify all generator features work correctly:
```bash
npx turbo run build
# Test tiles generation
# Test playground
# Test symbol-generator
git commit -m "refactor: extract coupled generator packages"
```

---

## Phase 5: Finalize Main App (Week 5-6)

### Move remaining app code to apps/web

```bash
# Move app router
mv src/app apps/web/src/app

# Move any remaining components
mv src/components apps/web/src/components

# Move types
mv src/types apps/web/src/types

# Move data
mv src/data apps/web/src/data
```

### Update apps/web/package.json

```json
{
  "name": "web",
  "version": "1.12.3",
  "private": true,
  "scripts": {
    "dev": "next dev -p 8080",
    "build": "next build",
    "start": "next start -p 8080",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@fossapp/core": "workspace:*",
    "@fossapp/ui": "workspace:*",
    "@fossapp/products": "workspace:*",
    "@fossapp/tiles": "workspace:*",
    "@fossapp/symbol-generator": "workspace:*",
    "@fossapp/playground": "workspace:*",
    "@fossapp/planner": "workspace:*",
    "@fossapp/projects": "workspace:*",
    "@fossapp/feedback": "workspace:*",
    "@fossapp/customers": "workspace:*",
    "@fossapp/dashboard": "workspace:*",
    "next": "^16.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

### Update root package.json

```json
{
  "name": "fossapp-monorepo",
  "version": "1.12.3",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "deploy:check": "./scripts/deploy-check.sh"
  },
  "devDependencies": {
    "turbo": "^2.3.3",
    "typescript": "^5",
    "eslint": "^9.39.2"
  }
}
```

### Update Deployment

**Update `Dockerfile`:**
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/*/package.json ./packages/*/

RUN npm ci

# Rebuild only what changed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build using Turborepo
RUN npx turbo run build --filter=web

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 8080

ENV PORT=8080

CMD ["node", "apps/web/server.js"]
```

**Update `deploy.sh`:**
```bash
#!/bin/bash
# deploy.sh

VERSION=$1

echo "🚀 Deploying FOSSAPP v$VERSION (Monorepo)"

# Pull changes
git fetch origin main
git checkout main
git pull origin main

# Verify tag
git checkout tags/v$VERSION

# Build with Turborepo
docker build \
  --build-arg PRODUCTION_BUILD=true \
  -t fossapp:$VERSION \
  -f Dockerfile .

# Stop old container
docker stop fossapp || true
docker rm fossapp || true

# Start new container
docker run -d \
  --name fossapp \
  -p 8080:8080 \
  --env-file .env.production \
  --restart unless-stopped \
  fossapp:$VERSION

echo "✅ Deployment complete!"
curl https://main.fossapp.online/api/health
```

---

## Testing Checklist

After migration, test all features:

- [ ] User login (Google OAuth)
- [ ] Product search and filtering
- [ ] Tiles generation
- [ ] Symbol generator
- [ ] Playground
- [ ] 3D model viewing (Planner)
- [ ] Project management
- [ ] Feedback assistant
- [ ] Customer management
- [ ] Dashboard analytics
- [ ] PWA installation
- [ ] Image optimization
- [ ] Rate limiting
- [ ] Event logging

---

## Rollback Plan

If migration fails:

1. Revert to `main` branch
2. Deploy previous version tag
3. Analyze what went wrong
4. Fix in feature branch
5. Retry migration

---

## Success Metrics

After migration:

- ✅ All features work as before
- ✅ Build time < 5 minutes (Turborepo caching)
- ✅ Dev server starts in < 30s
- ✅ No circular dependencies
- ✅ TypeScript compiles without errors
- ✅ Deployment successful to production
- ✅ Zero user-facing bugs

---

## Final Directory Structure

```
fossapp/
├── package.json (workspace root)
├── turbo.json
├── .env.local
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/              # App Router pages
│       │   ├── components/       # App-specific components
│       │   ├── types/            # App-specific types
│       │   └── data/             # Static data
│       ├── package.json
│       ├── next.config.ts
│       └── tsconfig.json
│
└── packages/
    ├── core/                     # Foundation
    ├── ui/                       # Design system
    ├── products/                 # Product catalog
    ├── tiles/                    # DWG tile generation
    ├── symbol-generator/         # AI symbol generation
    ├── playground/               # Freeform DWG generation
    ├── planner/                  # 3D model viewing
    ├── projects/                 # Project management
    ├── feedback/                 # AI feedback assistant
    ├── customers/                # Customer management
    └── dashboard/                # Analytics
```

Each package has:
```
package-name/
├── src/
│   ├── actions/              # Server actions (if applicable)
│   ├── services/             # Business logic
│   ├── components/           # React components
│   ├── api/                  # API routes (if applicable)
│   ├── types.ts              # Domain types
│   └── index.ts              # Barrel exports
├── package.json
└── tsconfig.json
```

---

## Notes

- Keep all env vars at root (`.env.local`)
- Use `workspace:*` protocol for internal dependencies
- Each package should be independently testable
- Avoid circular dependencies at all costs
- Deploy from `apps/web` only
- Use Turborepo caching for faster builds

---

**Status**: READY TO IMPLEMENT
**Owner**: TBD
**Start Date**: TBD
**Target Completion**: TBD + 6 weeks
