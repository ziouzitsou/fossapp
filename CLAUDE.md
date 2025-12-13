# CLAUDE.md

Essential guidance for Claude Code. For detailed docs, see [docs/README.md](./docs/README.md).

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
- **Database**: Supabase PostgreSQL (56K+ products)
- **Auth**: NextAuth.js v4 (Google OAuth)
- **UI**: shadcn/ui + Tailwind CSS
- **Deploy**: Docker multi-stage builds

---

## Critical: Dual Supabase Pattern

```typescript
// SERVER-SIDE (API routes, server actions) - NEVER expose!
import { supabaseServer } from '@/lib/supabase-server'

// CLIENT-SIDE (browser components) - use sparingly
import { supabase } from '@/lib/supabase'
```

**Never mix these up** - `supabaseServer` uses service_role key with full admin access.

---

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase-server.ts` | Server DB client (service role) |
| `src/lib/supabase.ts` | Client DB client (anon key) |
| `src/lib/actions/` | Server actions by domain |
| `src/lib/auth.ts` | NextAuth configuration |
| `src/data/releases.json` | **What's New** - update for each release! |
| `.env.local` | Secrets (NEVER commit) |

---

## Directory Structure

```
src/
├── app/              # App Router pages + API routes
├── components/       # React components
│   └── ui/           # shadcn/ui primitives
└── lib/              # Utilities, actions, DB clients
    └── actions/      # Domain-organized server actions
```

---

## Features & Routes

| Feature | Route | Docs |
|---------|-------|------|
| Products | `/products` | [features/product-search.md](./docs/features/product-search.md) |
| Filters | `/products` | [features/filters.md](./docs/features/filters.md) |
| Tiles | `/tiles` | [features/tiles.md](./docs/features/tiles.md) |
| Symbols | `/symbol-generator` | [features/symbol-generator.md](./docs/features/symbol-generator.md) |
| Playground | `/playground` | [features/playground.md](./docs/features/playground.md) |
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
- Middleware deprecation: Migrate when next-auth v5 releases

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

---

## Deployment

**Recommended**: Use production-deployer agent in Claude Code.

**Manual**:
```bash
npm version patch && git push origin main --tags
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu "cd /opt/fossapp && ./deploy.sh vX.X.X"
curl https://main.fossapp.online/api/health
```

See [docs/deployment/checklist.md](./docs/deployment/checklist.md) for full workflow.

---

**Last Updated**: 2025-12-13
