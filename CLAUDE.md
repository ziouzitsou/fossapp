# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ MANDATORY: Pre-Deployment Validation

**BEFORE any production deployment, version bump, or git tag creation**:

1. **ALWAYS run**: `./scripts/deploy-check.sh`
2. **If script fails**: STOP immediately and report errors to user
3. **Never skip failures**: Do not proceed with "it might work" assumptions
4. **Show all output**: Report exact error messages to user

This applies to:
- production-deployer agent
- Manual deployments
- Version bumps (npm version)
- Any git operations that affect production

See [Deployment Workflow](#deployment-workflow) for detailed requirements.

---

## Project Overview

FOSSAPP is a Next.js 16.0.0 application providing a searchable database of 56,456+ lighting products and accessories for lighting design professionals, architects, and AutoCAD users. Built with App Router, TypeScript, Turbopack, and Supabase PostgreSQL backend.

**Production**: https://main.fossapp.online (v1.4.3)
**Development**: Port 8080 (not 3000 - note the custom port configuration)

## Domain Configuration ⚙️

**Production Domain**: `main.fossapp.online`
**Previous Domain**: `app.titancnc.eu` (retired 2025-10-28)

All production domain references are centralized in `src/lib/config.ts` for easy migration to new domains.

**To change the production domain**:
1. Edit `src/lib/config.ts` (update `PRODUCTION_DOMAIN` and `PRODUCTION_URL`)
2. Update `.env.production` (update `NEXTAUTH_URL`)
3. Update Google OAuth settings
4. See [DOMAIN_CONFIGURATION.md](./docs/DOMAIN_CONFIGURATION.md) for complete migration guide

**Dynamic Endpoints**:
- `/api/manifest` - PWA manifest (uses centralized config)
- `/api/health` - Health check

## Production Server Access

**VPS Details**:
- **Host**: platon.titancnc.eu
- **User**: sysadmin
- **SSH Key**: `~/.ssh/platon.key`
- **Deployment Directory**: `/opt/fossapp/`

**SSH Connection**:
```bash
# Connect to production server
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu

# Direct deployment
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu "cd /opt/fossapp && ./deploy.sh v1.1.3"
```

## Development Commands

```bash
# Development
npm run dev      # Start dev server on :8080 (custom port, not :3000)
npm run build    # Production build with standalone output
npm run start    # Production server on :8080
npm run lint     # ESLint checking

# shadcn/ui Components
npx shadcn@latest add <component>   # Add new shadcn component
npx shadcn@latest add dialog        # Example: add dialog component
npx shadcn@latest add table         # Example: add table component
npx shadcn@latest diff              # Check for component updates

# Docker Operations
docker-compose up -d      # Start production container
docker-compose down       # Stop container
docker-compose logs -f    # View logs
docker-compose restart    # Restart after env changes

# Health Check
curl http://localhost:8080/api/health          # Local
curl https://main.fossapp.online/api/health    # Production
```

## Development Authentication Bypass

For local development, a development-only authentication bypass is available:

**Setup** (already configured in `.env.local`):
```bash
NEXT_PUBLIC_BYPASS_AUTH=true
```

**How it works**:
- Custom hook `useDevSession()` in `src/lib/use-dev-session.ts`
- Returns mock session ("Dev User") when `NODE_ENV=development` AND `NEXT_PUBLIC_BYPASS_AUTH=true`
- Falls back to real NextAuth session in production
- **Security**: Only works in development mode, never in production

⚠️ **IMPORTANT**: Never set `NEXT_PUBLIC_BYPASS_AUTH=true` in production!

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16.0.0 with App Router and Turbopack (file-based routing)
- **Language**: TypeScript
- **Authentication**: NextAuth.js v4 (Google OAuth only)
- **Database**: Supabase PostgreSQL (dual-client pattern)
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS with HSL color system
- **PWA**: @ducanh2912/next-pwa (installable app, automatic updates)
- **Deployment**: Docker multi-stage builds, standalone output

### Directory Structure

```
src/
├── app/                          # App Router pages and layouts
│   ├── layout.tsx               # Root layout with providers
│   ├── page.tsx                 # Landing page (auth gate)
│   ├── dashboard/               # Main dashboard after login
│   ├── products/                # Product search and detail pages
│   │   ├── page.tsx            # Search interface
│   │   └── [id]/page.tsx       # Dynamic product detail route
│   └── api/                     # API route handlers
│       ├── auth/[...nextauth]/ # NextAuth handlers
│       ├── health/             # Health check endpoint
│       ├── products/           # Product REST endpoints
│       └── supabase/           # Direct query API
│
├── components/
│   ├── ui/                      # shadcn/ui components (installed)
│   ├── providers.tsx            # SessionProvider + ThemeProvider wrapper
│   ├── theme-provider.tsx       # next-themes integration
│   ├── theme-toggle.tsx         # Dark/light mode switcher
│   └── version-display.tsx      # Environment-aware version badge
│
└── lib/                         # Core utilities and business logic
    ├── supabase.ts             # CLIENT-SIDE (anon key, browser)
    ├── supabase-server.ts      # SERVER-SIDE (service role, never exposed)
    ├── actions.ts              # Server actions (searchProductsAction, etc.)
    ├── auth.ts                 # NextAuth configuration
    └── utils.ts                # cn() utility for Tailwind merge
```

### Dual Supabase Client Pattern ⚠️ CRITICAL

**Never mix these up - security implications!**

1. **Client-Side** (`src/lib/supabase.ts`):
   - Uses `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - For browser-based operations only
   - Limited permissions (row-level security)
   - Exposed to client bundle

2. **Server-Side** (`src/lib/supabase-server.ts`):
   - Uses `SUPABASE_SERVICE_ROLE_KEY`
   - For server actions and API routes only
   - Full admin permissions
   - Never exposed to client
   - Session persistence disabled (stateless)

**Usage**:
```typescript
// Server actions/API routes
import { supabaseServer } from '@/lib/supabase-server'

// Client components (use sparingly - prefer server actions)
import { supabase } from '@/lib/supabase'
```

### Database Schema

**Primary Table**: `items.product_info` (materialized view)
- 56,456+ lighting products
- Fields: product_id, foss_pid, description_short, description_long, supplier_name, prices, multimedia, features
- Primarily Delta Light products

**Secondary Schema**: `etim.*` (ETIM classification system)
- Industry-standard product classification
- Hierarchical categorization

**Exposed Schemas**: public, extensions, items, etim, analytics
**Permissions**: service_role and authenticated have SELECT on items.product_info

### Database Functions - Domain-Driven Organization ⚡

**Best Practice**: Functions are organized by domain schema, not in `public.*`

**Current Organization** (as of 2025-11-15):
```
items.*          → Product/catalog functions (get_active_catalogs_with_counts)
analytics.*      → User tracking functions (get_most_active_users)
etim.*           → Classification functions (future)
public.*         → Legacy functions marked OBSOLETE (will be removed)
```

**Calling Functions**:
```typescript
// ✅ CORRECT: Use domain-specific schema
const { data } = await supabaseServer
  .schema('items')
  .rpc('get_active_catalogs_with_counts')

// ❌ DEPRECATED: Old public schema
const { data } = await supabaseServer
  .rpc('get_active_catalogs_with_counts')  // Works but obsolete
```

See migration: `supabase/migrations/20251115_reorganize_functions_to_domain_schemas.sql`

### Database Migrations & GitHub Integration

- **Migration Files**: `supabase/migrations/` (55 total in database, 2 in repository)
- **GitHub Integration**: ✅ Active - automatic preview databases for PRs
- **Connected Repository**: `ziouzitsou/fossapp` (main branch)
- **Detailed Documentation**: [docs/migrations/SUPABASE_GITHUB_INTEGRATION.md](./docs/migrations/SUPABASE_GITHUB_INTEGRATION.md)

### Authentication Flow

1. Unauthenticated users land on `/` (landing page)
2. "Sign in with Google" triggers OAuth via NextAuth.js
3. Successful auth redirects to `/dashboard`
4. Session stored in JWT (server-side)
5. Protected routes check `useSession()` hook
6. Automatic redirect to `/` if unauthenticated

**Auth Configuration**: `src/lib/auth.ts`
- Single provider: Google OAuth
- Custom sign-in page at root
- Session callbacks for JWT handling
- Provider wrapper: `src/components/providers.tsx` (must be client component)

### Routing Conventions

**App Router Patterns**:
- `layout.tsx` - Shared layouts (persistent across routes)
- `page.tsx` - Route endpoints (define URL paths)
- `[id]/` - Dynamic route segments
- `route.ts` - API endpoints (export GET, POST, etc.)

**Key Routes**:
- `/` - Landing page with auth
- `/dashboard` - Main dashboard with stats
- `/products` - Product search interface
- `/products/[id]` - Product detail page
- `/api/products/search?q=<term>` - Search API
- `/api/products/[id]` - Product detail API
- `/api/health` - Health check (Docker healthcheck)

## Component Architecture

**shadcn/ui Integration**:
- Project uses **shadcn/ui** component library (Radix UI + Tailwind CSS)
- Configuration: `components.json` (New York style, RSC enabled)
- **Migration Status**: ✅ Phase 6 completed (2025-11-23) - Full sidebar migration
- Installed components: Button, Card, Input, Badge, Alert, Avatar, Sidebar, Pagination, ToggleGroup, Command, and more
- Add new components: `npx shadcn@latest add <component-name>`

**Navigation Architecture** (as of Phase 6 migration):
- **AppSidebar** (`src/components/app-sidebar.tsx`) - Unified sidebar using shadcn Sidebar primitives
- **ProtectedPageLayout** (`src/components/protected-page-layout.tsx`) - Wrapper for all authenticated pages
- **SidebarProvider** - Wraps entire app in root layout for sidebar context
- **Keyboard Shortcut**: Cmd/Ctrl+B toggles sidebar
- **Code Reduction**: -269 lines (eliminated duplicate sidebar code across pages)

**Patterns**:
- CVA (Class Variance Authority) for variant management
- Forwardref pattern for ref access
- Slot pattern for "asChild" polymorphism
- Dark mode via `next-themes` with HSL color tokens

**Complete Guide**: See [COMPONENT_ARCHITECTURE.md](./docs/COMPONENT_ARCHITECTURE.md)

## State Management

**No global state library** - uses React built-in hooks:
- `useState` / `useEffect` for local component state
- `useSession()` from NextAuth for auth state
- `next-themes` provider for theme state
- Server actions preferred over client-side fetching

## Security Measures ✅

- **Environment Variables**: All secrets in `.env.local` / `.env.production`
- **Parameterized Queries**: No SQL injection vulnerabilities
- **Input Validation**: Regex patterns, trim, 100 char limits, UUID validation
- **Query Sanitization**: All user inputs validated before database calls
- **Service Role Isolation**: Server actions use service_role, never exposed to client
- **Database Access Control**: `items.product_info` restricted to authenticated users only

**Never commit these files**: `.env.local`, `.env.production`
**Reference file**: `.env.example` (safe to commit)

### Automated Security Auditing 🔍

**System**: Gemini AI-powered security audits
**Agent**: gemini-code-auditor (interactive code review during development)

**Quick Commands**:
```bash
./scripts/run-gemini-audit.sh --auto-approve  # Manual audit
./scripts/pre-deploy-audit.sh                 # Pre-deployment gate
```

**Complete Guide**: See [SECURITY_AUDITING.md](./docs/SECURITY_AUDITING.md)

## API Architecture

**Preferred Pattern**: Server actions in `src/lib/actions.ts`
**Fallback**: REST API routes in `src/app/api/`

**Available Endpoints**:
- `GET /api/products/search?q=<term>` - Max 50 results
- `GET /api/products/[id]` - Full product details
- `GET /api/health` - Health check with uptime

**Complete Guide**: See [API_PATTERNS.md](./docs/API_PATTERNS.md)

## Docker Deployment

**Multi-stage Build**: Base → Deps → Builder → Runner
**Image**: Node 18 Alpine, standalone output, ~150MB
**Build Time**: ~6-7 seconds (with Turbopack)

**Quick Commands**:
```bash
docker-compose build      # Build image
docker-compose up -d      # Start container
docker-compose logs -f    # View logs
```

**Complete Guide**: See [DOCKER_DEPLOYMENT.md](./docs/DOCKER_DEPLOYMENT.md)

## Environment Configuration

**Required Variables**:
```bash
# NextAuth
NEXTAUTH_URL=http://localhost:8080              # Note: Port 8080, not 3000
NEXTAUTH_SECRET=<generate-with-openssl-rand>

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://hyppizgiozyyyelwdius.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from-supabase-project-settings>
SUPABASE_SERVICE_ROLE_KEY=<from-supabase-project-settings>  # NEVER commit!
```

**Port Configuration**: All servers run on **port 8080** (not default 3000)

## Version Management

**Version Display Component** (`src/components/version-display.tsx`):
- Reads from `package.json` version field
- Shows `v1.x.x-dev` in development
- Shows `v1.x.x` in production
- Located at bottom of sidebar navigation

**Update Process**:
1. Bump version in `package.json`
2. Component automatically reflects new version
3. Commit and deploy

## Code Patterns & Conventions

### Server vs Client Components
- **Default**: Server components (better performance, SEO)
- **Use `'use client'` only when**:
  - Need React hooks (useState, useEffect, useContext)
  - Browser APIs required
  - Event handlers needed
  - Third-party libraries require client context

### Type Safety
- TypeScript throughout (strict mode)
- Interface definitions co-located with usage
- Type exports from lib files
- No `any` types (use `unknown` if needed)

### Error Handling
```typescript
try {
  const data = await fetchData()
} catch (error) {
  console.error('Error:', error)
  // Graceful fallback: empty array, null state, error UI
}
```

### Code Organization
- Co-locate related code (types with components)
- Shared utilities in `src/lib/`
- Reusable UI in `src/components/ui/`
- Business logic in server actions (`src/lib/actions.ts`)
- Keep API routes thin (delegate to server actions)

## Testing & Quality

**Current State**:
- No automated tests (future enhancement)
- ESLint configured (`eslint.config.mjs`)
- TypeScript compile-time checks
- Manual testing via development server

**Linting**: `npm run lint` (Next.js ESLint config)

**Production Build Testing**:
⚠️ **CRITICAL**: Always run `npm run build` before deploying!
- Production builds are stricter than dev mode
- ESLint errors become build failures
- TypeScript type checking enforced
- Missing dependencies caught at build time

See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) for complete deployment workflow.

## Common Development Tasks

**Quick Reference**:
- Adding new pages → Create `src/app/new-page/page.tsx`
- Creating API endpoints → `src/app/api/endpoint/route.ts`
- Adding server actions → Update `src/lib/actions.ts`
- Working with Supabase → Use `supabaseServer` in actions
- Installing shadcn components → `npx shadcn@latest add <component>`

**Complete Guide**: See [DEVELOPMENT_TASKS.md](./docs/DEVELOPMENT_TASKS.md)

## Known Issues

- OAuth callback has state cookie issue in WSL2 environment (production works fine)
- CORS warnings for cross-origin requests (can configure in `next.config.ts`)
- Materialized view `items.product_info` requires manual refresh (see `/home/sysadmin/fossdb/utils/matview_maintenance/`)
  - **Note**: If advanced search is implemented, add 3 search schema views to refresh workflow (+6-9s total time). See [ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md](./docs/ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md#materialized-view-refresh-sequence) for complete refresh sequence.

## Future Enhancements

- **Advanced Search & Faceted Filtering**: Production-ready three-tier search architecture with Delta Light-style context-aware filters. Complete database architecture, RPC functions, and integration guide available at [ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md](./docs/ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md). Working demo at `/home/sysadmin/tools/searchdb/search-test-app/` (http://localhost:3001).
- **Google Drive Shared Drive Integration**: Read/write access to "HUB" Shared Drive for supplier catalogs, product images, and documentation. Complete implementation guide available at [GOOGLE_DRIVE_SHARED_DRIVE_INTEGRATION.md](./docs/GOOGLE_DRIVE_SHARED_DRIVE_INTEGRATION.md). Reference implementation exists in `/home/sysadmin/tools/gdrive-sync/` (standalone OAuth tool).
- User favorites and wishlist
- Product comparison feature
- Image gallery for products
- Export to AutoCAD formats
- Lighting calculation tools
- Project collaboration features

## Production Details

**VPS**: platon.titancnc.eu
**Domain**: https://main.fossapp.online
**Current Version**: v1.4.3
**Deployment**: Automated via production-deployer agent
**Deployment Directory**: `/opt/fossapp/`
**Monitoring**: Docker healthcheck + `/api/health` endpoint

**Deployment Structure**:
```
/opt/fossapp/
├── .git/                # Git repository (source of truth)
├── src/                 # Application code
├── docker-compose.yml   # Docker configuration
├── .env.production      # Production secrets (not in git)
├── Dockerfile
├── deploy.sh            # Automated deployment script
└── docs/                # Documentation
```

**Deployment Workflow**:

**Recommended Method** (Automated via Claude Code):
```
Use the production-deployer agent in Claude Code:
"Deploy to production version 1.3.6"

The agent handles:
- Pre-deployment validation (./scripts/deploy-check.sh)
- Version bumping (npm version patch)
- Git commit and push with tags
- SSH to production server
- Docker build and deployment
- Health checks and API verification
```

**⚠️ CRITICAL: Agent Error Handling Requirements**:

When using the production-deployer agent, it MUST:

1. **Run Pre-Deployment Script FIRST**: `./scripts/deploy-check.sh`
   - If ANY check fails, STOP immediately and report to user
   - Do NOT proceed with version bump or deployment

2. **Report All Script Output**: Show user the full output
   - If type-check fails → Show TypeScript errors
   - If smoke tests fail → Show which test failed and why
   - If build fails → Show build errors

3. **Never Skip Errors**: Do NOT continue if any validation step fails

4. **Verification After Each Step**: Verify exit codes, push success, health checks

**Manual Method** (Alternative):
```bash
# 1. Local: Create new version
npm version patch
git push origin main --tags

# 2. Production: Deploy
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu
cd /opt/fossapp
./deploy.sh v1.3.6

# 3. Verify
curl https://main.fossapp.online/api/health
```

**Health Check Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T09:51:00.000Z",
  "version": "1.3.5",
  "uptime": 199,
  "environment": "production"
}
```

## Progressive Web App (PWA)

**Status**: ✅ Active (v1.1.4+)
**Package**: @ducanh2912/next-pwa

FOSSAPP is installable as a Progressive Web App on desktop, mobile, and tablet devices.

**Key Features**:
- Installable: Add to home screen/desktop like native app
- Automatic Updates: Updates deploy seamlessly in background (no user action)
- Faster Loading: Service worker caching reduces subsequent load times by 55%
- Cross-Platform: Works on Windows, macOS, Linux, Android, iOS
- Offline Support: App shell cached (product data requires connection)

**Complete Documentation**: See [PWA.md](./docs/PWA.md)

## What's New Dialog

**Location**: `src/components/whats-new-dialog.tsx`
**Documentation**: `WHATS_NEW.md` (user-friendly changelog)
**Status**: ✅ Active (v1.4.5+)

Automatically shows users new features when they update to a new version. Appears once per version, tracks via localStorage.

**Updating for New Releases**:
1. Update `WHATS_NEW.md` (user-friendly language)
2. Update `src/components/whats-new-dialog.tsx` (LATEST_CHANGES object)
3. Test locally (clear localStorage, refresh, verify)

**Writing Guidelines**: Focus on user benefits, use plain English, keep it brief (2-5 bullet points max).

## Chrome DevTools MCP

**Tool**: chrome-dev MCP (replaces Playwright)
**Status**: ✅ Active

Used for browser automation, testing, and debugging. Playwright has been disabled due to bugs.

## shadcn MCP

The shadcn MCP server enables AI-assisted component management.

**Benefits**:
- AI can add shadcn components directly without manual commands
- Automatic component installation with proper dependencies
- Context-aware component suggestions
- Consistent component usage patterns

**Currently Installed Components**: Button, Card, Input, Badge, Alert, Avatar

**Popular Components to Add**: Dialog, Table, Dropdown Menu, Select, Tabs, Toast, Form

## Project Documentation

### Documentation Convention

The `docs/` folder contains **supplementary documentation** and detailed guides:
- **CLAUDE.md** (this file) = Quick reference and development guide
- **docs/** = Extended documentation, procedures, and deep-dive guides

### Current Documentation

**Deployment & Operations**:
- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) - **MUST READ** before deploying
- [CHANGELOG.md](./CHANGELOG.md) - Version history and release notes (SemVer)
- [PWA.md](./docs/PWA.md) - Progressive Web App implementation
- [vps-deployment.md](./docs/vps-deployment.md) - VPS setup and deployment
- [DOMAIN_CONFIGURATION.md](./docs/DOMAIN_CONFIGURATION.md) - Domain configuration
- [SECURITY_AUDITING.md](./docs/SECURITY_AUDITING.md) - Security auditing guide
- [DOCKER_DEPLOYMENT.md](./docs/DOCKER_DEPLOYMENT.md) - Docker deployment details

**Development**:
- [COMPONENT_ARCHITECTURE.md](./docs/COMPONENT_ARCHITECTURE.md) - shadcn/ui patterns and component guide
- [API_PATTERNS.md](./docs/API_PATTERNS.md) - API architecture and server actions
- [DEVELOPMENT_TASKS.md](./docs/DEVELOPMENT_TASKS.md) - Common development tasks
- [gemini-auditor.md](./docs/gemini-auditor.md) - Gemini code auditor agent

**Database & Architecture**:
- [ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md](./docs/ADVANCED_SEARCH_DATABASE_ARCHITECTURE.md) - Faceted search system (8,500 words)
- [postgresql_etim_items_schema_overview.md](./docs/postgresql_etim_items_schema_overview.md) - Database schema
- [SUPPLIER_LOGOS.md](./docs/SUPPLIER_LOGOS.md) - Supplier logo guidelines

**Historical**:
- [migrations/NEXTJS_16_UPGRADE.md](./docs/migrations/NEXTJS_16_UPGRADE.md) - Next.js 16 upgrade notes

**Key Principle**: Keep CLAUDE.md concise for quick reference; use docs/ for detailed explanations.

## Support & References

- **Supabase Project**: hyppizgiozyyyelwdius.supabase.co
- **Database Maintenance**: `/home/sysadmin/fossdb/utils/matview_maintenance/`
- **Next.js Docs**: https://nextjs.org/docs
- **shadcn/ui Docs**: https://ui.shadcn.com
- **Radix UI Docs**: https://www.radix-ui.com/primitives
- **Tailwind CSS Docs**: https://tailwindcss.com/docs

## Version History

For detailed version history, deployment notes, and changelog, see **[CHANGELOG.md](./CHANGELOG.md)**.

**Current Production Version**: v1.4.3

## Documentation Updates

**Last updated**: 2025-11-22

- Restructured documentation (moved details to dedicated files in docs/)
- Removed Playwright references (using Chrome DevTools MCP now)
- Created comprehensive guides for components, API, Docker, security, and development tasks
