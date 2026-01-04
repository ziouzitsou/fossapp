# CLAUDE.md

Essential guidance for Claude Code. For detailed docs, see [docs/README.md](./docs/README.md).

---

## Monorepo Architecture (v1.13.4)

FOSSAPP uses **Turborepo** with shared packages. **ALWAYS check packages first** before writing new code.

### Package Structure

| Package | Contents | Import Pattern |
|---------|----------|----------------|
| `@fossapp/core` | DB clients, logging, ratelimit, config, validation | `@fossapp/core`, `@fossapp/core/db`, `@fossapp/core/config` |
| `@fossapp/ui` | 38 shadcn components, theme, hooks, cn utility | `@fossapp/ui` |
| `@fossapp/products` | Product types, search actions | `@fossapp/products/types`, `@fossapp/products/actions` |
| `@fossapp/tiles` | Tile types, progress store, script generator | `@fossapp/tiles/types`, `@fossapp/tiles/progress` |
| `@fossapp/projects` | Project/area types | `@fossapp/projects`, `@fossapp/projects/types/areas` |

### Before Writing New Code - CHECK PACKAGES FIRST

1. **Types**: Check if type already exists in `packages/*/src/types/`
2. **UI Components**: Check `@fossapp/ui` before creating new components
3. **Utilities**: Check `@fossapp/core` for logging, validation, config
4. **Server Actions**: Products/tiles actions are in packages, project actions stay in app

### Import Rules

```typescript
// CORRECT - Use package imports
import { supabaseServer } from '@fossapp/core/db'
import { Button, Card } from '@fossapp/ui'
import { ProductInfo } from '@fossapp/products/types'
import { cn } from '@fossapp/ui'

// WRONG - Don't use old paths (these files no longer exist)
import { supabaseServer } from '@/lib/supabase-server'  // DELETED
import { Button } from '@/components/ui/button'          // DELETED
```

### Key Guidelines

- `.claude/monorepo-development-guidelines.md` - Full development patterns
- Recovery tag: `pre-monorepo-refactor` (v1.12.3) if rollback needed

---

## Module Splitting (MANDATORY)

**Large files MUST be split** into focused, single-responsibility modules.

| Trigger | Action |
|---------|--------|
| File > 500 lines | Consider splitting |
| File > 800 lines | **MUST split** |

### Quick Patterns

```
# Server Actions → Create subdirectory
src/lib/actions/areas/
├── index.ts              # Barrel (NO 'use server')
├── area-crud-actions.ts  # Has 'use server'
└── version-actions.ts

# Page Components → Co-locate
src/app/projects/[id]/
├── page.tsx
└── components/
    ├── index.ts
    └── project-overview-tab.tsx
```

**Full details**: `.claude/monorepo-development-guidelines.md` → "Module Splitting Strategy"

---

## 📝 JSDoc Documentation (MANDATORY)

**All new code MUST include JSDoc.** This improves IDE experience and AI agent comprehension.

```typescript
/**
 * [What it does in one line]
 *
 * @param paramName - [Description]
 * @returns [What's returned]
 */
```

**Required for**: Exported functions, hooks, interfaces/types, complex logic.
**Skip**: Trivial getters, obvious one-liners, barrel exports.

**Full details**: `.claude/skills/coding-patterns/SKILL.md` → "JSDoc Documentation"

---

## 🤖 Claude Code Skills

Claude Code has access to specialized skills that provide domain knowledge automatically:

| Skill | Auto-Activates When | Manual Invoke |
|-------|---------------------|---------------|
| **viewer-api** | Case Study viewer, Edit2D, APS Viewer | N/A (automatic) |
| **coding-patterns** | Writing/modifying code | N/A (automatic) |
| **supabase-patterns** | Database queries | N/A (automatic) |
| **autolisp-dwg** | Working with DWG features | N/A (automatic) |
| **deployment-workflow** | Pre-deployment checks | N/A (automatic) |
| **api-patterns** | Creating API routes | N/A (automatic) |
| **knowledge-base-sync** | Feature changes (routes/actions) | N/A (automatic) |

**CRITICAL**: The `viewer-api` skill requires querying Context7 FIRST before implementing any Viewer/Edit2D features. The viewer is 85% of user interaction - quality is non-negotiable.

Skills are in `.claude/skills/` and complement this quick reference guide.

---

## Pre-Deployment (MANDATORY)

**BEFORE any deployment, version bump, or git tag:**

```bash
./scripts/deploy-check.sh   # MUST pass before proceeding
```

If ANY check fails: **STOP** and report errors. Never skip failures.

---

## Quick Reference

| Item | Value |
|------|-------|
| **Production** | https://main.fossapp.online |
| **Dev Server** | `npm run dev` → :8080 |
| **SSH** | `ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu` |
| **Deploy Dir** | `/opt/fossapp/` |
| **Docker Registry** | `registry.digitalocean.com/fossapp` |

---

## Commands

```bash
npm run dev                  # Dev server on :8080
npm run build                # Production build
npm run lint                 # ESLint
./scripts/deploy-check.sh    # Pre-deploy validation
npx shadcn@latest add <name> # Add shadcn component
```

---

## Tech Stack

- **Framework**: Next.js 16 + App Router + Turbopack
- **Monorepo**: Turborepo with 5 shared packages
- **Database**: Supabase PostgreSQL (56K+ products)
- **Auth**: NextAuth.js v4 (Google OAuth)
- **UI**: shadcn/ui + Tailwind CSS (via @fossapp/ui)
- **Deploy**: Docker multi-stage builds + DigitalOcean Container Registry

---

## Critical: Dual Supabase Pattern

```typescript
// SERVER-SIDE (API routes, server actions) - NEVER expose!
import { supabaseServer } from '@fossapp/core/db'

// CLIENT-SIDE (browser components) - use sparingly
import { supabase } from '@/lib/supabase'
```

**Never mix these up** - `supabaseServer` uses service_role key with full admin access.

---

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/db/server.ts` | Server DB client (service role) |
| `packages/ui/src/components/` | 38 shadcn UI components |
| `src/lib/supabase.ts` | Client DB client (anon key) |
| `src/lib/actions/` | Server actions by domain |
| `src/lib/auth.ts` | NextAuth configuration |
| `src/data/releases.json` | **What's New** - update for each release! |
| `src/lib/feedback/knowledge-base.ts` | **Feedback AI knowledge** - update when features change! |
| `scripts/docker-push.sh` | Build & push to DO registry |
| `.env.local` | Secrets (NEVER commit) |

---

## Feedback Assistant Knowledge Base

**IMPORTANT**: When adding or changing features, update the AI assistant's knowledge!

```
src/lib/feedback/knowledge-base.ts
```

The feedback assistant (sidebar chat) only knows what's in this file. If you add a new feature and don't update the knowledge base, the assistant will say "I don't have information about that."

**Update when you:**
- Add a new feature
- Change how a feature works
- Add new statuses or options
- Remove/deprecate features

See [docs/features/feedback-assistant.md](./docs/features/feedback-assistant.md) for full documentation.

---

## Directory Structure

```
packages/                    # Shared monorepo packages
├── core/                    # DB clients, logging, ratelimit, config, validation
├── ui/                      # 38 shadcn components, theme, hooks
├── products/                # Product types + server actions
├── tiles/                   # Tile types, progress store, script generator
└── projects/                # Project/area types

src/
├── app/                     # App Router pages + API routes
├── components/              # App-specific React components
└── lib/                     # App-specific utilities, actions
    └── actions/             # Domain-organized server actions
```

---

## Features & Routes

| Feature | Route | Docs |
|---------|-------|------|
| Products | `/products` | [features/product-search.md](./docs/features/product-search.md) |
| Filters | `/products` | [features/filters.md](./docs/features/filters.md) |
| Tiles | `/tiles` | [features/tiles.md](./docs/features/tiles.md) |
| Symbols | `/settings/symbols` | [features/symbol-generator.md](./docs/features/symbol-generator.md) |
| Playground | `/playground` | [features/playground.md](./docs/features/playground.md) |
| Projects | `/projects` | [features/project-management/](./docs/features/project-management/) |
| Case Study | `/case-study` | [features/case-study.md](./docs/features/case-study.md) |
| Feedback | Sidebar | [features/feedback-assistant.md](./docs/features/feedback-assistant.md) |
| Theming | User dropdown | [features/theming.md](./docs/features/theming.md) |
| Dashboard | `/dashboard` | - |

---

## Environment Variables

```bash
# Required in .env.local
NEXTAUTH_URL=http://localhost:8080
NEXTAUTH_SECRET=<openssl rand -base64 32>
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase>  # NEVER commit!
```

---

## Known Issues

- WSL2: OAuth callback state cookie issue (production works fine)
- Materialized view `items.product_info` requires manual refresh
- NextAuth: Staying on v4 (v5/Auth.js never stabilized, merged into Better Auth)

---

## Documentation Index

See [docs/README.md](./docs/README.md) for complete index.

| Category | Key Docs |
|----------|----------|
| **Architecture** | [overview](./docs/architecture/overview.md), [components](./docs/architecture/components.md), [api-patterns](./docs/architecture/api-patterns.md) |
| **Database** | [schema](./docs/database/schema.md), [advanced-search](./docs/database/advanced-search.md), [multimedia-codes](./docs/database/multimedia-codes.md) |
| **Deployment** | [checklist](./docs/deployment/checklist.md), [docker](./docs/deployment/docker.md), [vps](./docs/deployment/vps.md) |
| **Features** | [tiles](./docs/features/tiles.md), [symbols](./docs/features/symbol-generator.md), [playground](./docs/features/playground.md), [filters](./docs/features/filters.md), [pwa](./docs/features/pwa.md), [whats-new](./docs/features/whats-new.md) |
| **Security** | [auditing](./docs/security/auditing.md), [gemini-auditor](./docs/security/gemini-auditor.md) |
| **Development** | [roadmap](./docs/development/roadmap.md), [tasks](./docs/development/tasks.md) |

---

## Deployment

**Recommended**: Use production-deployer agent in Claude Code.

### Quick Deploy (5 seconds)

Uses pre-built images from DigitalOcean Container Registry:

```bash
# 1. Build & push to registry (from dev machine)
./scripts/docker-push.sh

# 2. Pull & restart on production
ssh platon 'cd /opt/fossapp && docker compose pull && docker compose up -d'

# 3. Verify
curl https://main.fossapp.online/api/health
```

### Full Deploy (with version bump)

```bash
# 1. Pre-deploy check (MANDATORY)
./scripts/deploy-check.sh

# 2. Version bump
npm version patch && git push origin main --tags

# 3. Build & push image
./scripts/docker-push.sh

# 4. Deploy on production
ssh platon 'cd /opt/fossapp && docker compose pull && docker compose up -d'
```

### E2E Testing on Production

Playwright tests can run against production using secure header bypass:

```bash
E2E_TEST_SECRET=<secret> npx playwright test --project=chromium
```

See [docs/deployment/checklist.md](./docs/deployment/checklist.md) for full workflow.

---

**Last Updated**: 2026-01-04 (v1.13.4 - Documentation audit and reorganization)
