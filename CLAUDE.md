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

For local development and Playwright testing, a development-only authentication bypass is available:

**Setup** (already configured in `.env.local`):
```bash
NEXT_PUBLIC_BYPASS_AUTH=true
```

**How it works**:
- Custom hook `useDevSession()` in `src/lib/use-dev-session.ts`
- Returns mock session ("Dev User") when `NODE_ENV=development` AND `NEXT_PUBLIC_BYPASS_AUTH=true`
- Falls back to real NextAuth session in production
- **Security**: Only works in development mode, never in production

**Usage**:
- Dashboard and Products pages use `useDevSession()` instead of `useSession()`
- Allows access to protected routes without Google OAuth sign-in
- Essential for Playwright MCP testing and rapid development

**Mock User**:
- Name: Dev User
- Email: dev@fossapp.local
- Image: /default-avatar.png

⚠️ **IMPORTANT**: Never set `NEXT_PUBLIC_BYPASS_AUTH=true` in production!

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16.0.0 with App Router and Turbopack (file-based routing)
- **Language**: TypeScript
- **Authentication**: NextAuth.js v4 (Google OAuth only)
- **Database**: Supabase PostgreSQL (dual-client pattern)
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS with HSL color system
- **Components**: shadcn/ui components with CVA variants
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
│   │   ├── button.tsx          # Button with CVA variants
│   │   ├── card.tsx            # Card container components
│   │   ├── input.tsx           # Form input field
│   │   ├── badge.tsx           # Status badges
│   │   ├── alert.tsx           # Alert/notification component
│   │   ├── avatar.tsx          # User avatar component
│   │   └── ...                 # Additional shadcn components as needed
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

**Usage Pattern**:
```typescript
// In server actions (src/lib/actions.ts) or API routes
import { supabaseServer } from '@/lib/supabase-server'

export async function searchProductsAction(query: string) {
  const { data } = await supabaseServer
    .from('items.product_info')
    .select('*')
    .ilike('description_short', `%${query}%`)
  return data
}

// In client components
import { supabase } from '@/lib/supabase'
// Use sparingly - prefer server actions
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
**Permissions**: Both service_role and anon have SELECT on items.product_info

### Database Functions - Domain-Driven Organization ⚡

**Best Practice**: Functions are organized by domain schema, not in `public.*`

**Current Organization** (as of 2025-11-15):
```
items.*          → Product/catalog functions (get_active_catalogs_with_counts)
analytics.*      → User tracking functions (get_most_active_users)
etim.*           → Classification functions (future)
public.*         → Legacy functions marked OBSOLETE (will be removed)
```

**Calling Functions by Schema**:
```typescript
// ✅ CORRECT: Use domain-specific schema
const { data } = await supabaseServer
  .schema('items')
  .rpc('get_active_catalogs_with_counts')

// ✅ CORRECT: Analytics functions in analytics schema
const { data } = await supabaseServer
  .schema('analytics')
  .rpc('get_most_active_users', { user_limit: 5 })

// ❌ DEPRECATED: Old public schema (backwards compatible, but marked obsolete)
const { data } = await supabaseServer
  .rpc('get_active_catalogs_with_counts')  // Works but obsolete
```

**Why Domain-Driven?**
- Functions live close to their data
- Clear ownership (items functions work with items tables)
- Easier to maintain and debug as app scales
- Better organization for multiple developers
- Follows PostgreSQL best practices

**Migration Status**:
- ✅ Active functions moved to domain schemas
- ⚠️ Old `public.*` functions marked OBSOLETE (commented for safe removal)
- 🗑️ 10 unused functions identified for future cleanup

See migration: `supabase/migrations/20251115_reorganize_functions_to_domain_schemas.sql`

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

### Component Architecture

**shadcn/ui Integration**:
- Project uses **shadcn/ui** component library
- Configuration: `components.json` (New York style, RSC enabled)
- Installed components: Button, Card, Input, Badge, Alert, Avatar
- Add new components: `npx shadcn@latest add <component-name>`
- Or use shadcn MCP server for AI-assisted component management

**UI Component Pattern**:
- Based on Radix UI primitives for accessibility
- Styled with Tailwind CSS utility classes
- CVA (Class Variance Authority) for variant management
- Forwardref pattern for ref access
- Slot pattern for "asChild" polymorphism

**Example Pattern**:
```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"

const buttonVariants = cva(baseStyles, {
  variants: {
    variant: { default, destructive, outline, ... },
    size: { default, sm, lg, ... }
  }
})

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ asChild = false, className, variant, size, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} />
  }
)
```

**Theme System**:
- Dark mode via `next-themes` with `class` strategy
- HSL color tokens via CSS variables
- Responsive design with Tailwind breakpoints
- Geist Sans & Geist Mono fonts

### State Management

**No global state library** - uses React built-in hooks:
- `useState` / `useEffect` for local component state
- `useSession()` from NextAuth for auth state
- `next-themes` provider for theme state
- Server actions preferred over client-side fetching

**Data Fetching Pattern**:
```typescript
const [results, setResults] = useState<Product[]>([])
const [isLoading, setIsLoading] = useState(false)

const handleSearch = async (query: string) => {
  setIsLoading(true)
  try {
    const data = await searchProductsAction(query) // Server action
    setResults(data)
  } catch (error) {
    console.error(error)
    // Fallback to API route if needed
  } finally {
    setIsLoading(false)
  }
}
```

### Security Measures ✅

- **Environment Variables**: All secrets in `.env.local` / `.env.production`
- **Parameterized Queries**: No SQL injection vulnerabilities
- **Input Validation**: Regex patterns, trim, 100 char limits, UUID validation
- **Query Sanitization**: All user inputs validated before database calls
- **Service Role Isolation**: Server actions use service_role, never exposed to client
- **Database Access Control**: `items.product_info` restricted to authenticated users only
  - ✅ `service_role`: Full server-side access
  - ✅ `authenticated`: Read access for logged-in users
  - ❌ `anon`: No public access (authentication required)

**Never commit these files**: `.env.local`, `.env.production`
**Reference file**: `.env.example` (safe to commit)

**Database Permissions** (as of v1.1.3):
- Migration `fix_product_info_permissions`: Initial grants to service_role, anon, authenticated
- Migration `restrict_product_info_to_authenticated`: Revoked anon access for security

### Automated Security Auditing 🔍

**System**: Gemini AI-powered security audits (as of v1.4.3)
**Location**: `audits/` folder with automation scripts in `scripts/`

**Available Commands**:
```bash
# Manual security audit
./scripts/run-gemini-audit.sh --auto-approve

# Pre-deployment security gate (blocks if critical/high issues found)
./scripts/pre-deploy-audit.sh

# Schedule recurring audits
./scripts/schedule-audit.sh weekly
```

**How It Works**:
1. Gemini CLI analyzes codebase for security vulnerabilities
2. Generates markdown report: `audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md`
3. Categorizes findings by severity (Critical/High/Medium/Low)
4. Blocks deployment if critical/high severity issues found
5. Maintains audit history locally (excluded from git)

**Audit Focus Areas**:
- Authentication & Authorization (NextAuth.js, domain validation)
- Database Security (Supabase clients, RLS policies, SQL injection)
- API Security (input validation, error handling, CORS)
- Code Quality (secrets management, dependency vulnerabilities)
- Production Deployment (Docker security, logging)

**Documentation**:
- **Quick Start**: `audits/AUTOMATION_QUICK_START.md`
- **Complete Guide**: `audits/README.md`
- **Setup Details**: `audits/AUTOMATION_SETUP_COMPLETE.md`

**Severity Response Guide**:
| Severity | Action |
|----------|--------|
| 🔴 Critical | Block deployment, fix immediately |
| 🟠 High | Block deployment, fix before release |
| 🟡 Medium | Review required, document decision |
| 🟢 Low | Document and backlog |

**Integration**:
- Pre-deployment checks: `./scripts/pre-deploy-audit.sh`
- CI/CD ready: Returns exit codes for automation
- Scheduled audits: Weekly via Windows Task Scheduler (WSL)

**Git Configuration**:
- Audit reports: Excluded from repository (sensitive)
- Documentation: Tracked in git (public)
- Execution logs: Local only

**Future Enhancement**: Dedicated audit agent planned for seamless integration with Claude Code workflow.

**Example Workflow**:
```bash
# Before deployment
./scripts/pre-deploy-audit.sh

# If passed
npm version patch
git push --tags

# If failed
# Review: cat audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md
# Fix issues, then retry
```

**Note**: Gemini CLI uses free tier - be mindful of token usage for large audits.

### Gemini Code Auditor Agent 🤖

**Agent**: Interactive code review during development (as of v1.4.3)
**Location**: `.claude/agents/gemini-code-auditor.md`
**Documentation**: [docs/gemini-auditor.md](./docs/gemini-auditor.md)

**Purpose**: AI-powered code auditing within Claude Code conversations for immediate feedback during development.

**Usage**:
```
User: "Review the authentication implementation"
Claude: [Invokes gemini-code-auditor agent]
Claude: "Audit complete. Grade: A-, 0 critical issues, 2 warnings..."
```

**Triggers**:
- User requests: "Review this code", "Audit the new API endpoint"
- Proactive: After completing significant features or security-sensitive changes

**Audit Coverage**:
- 🔒 Security (SQL injection, XSS, auth bypass, secrets)
- 📊 Code Quality (TypeScript, error handling, duplication)
- 🏗️ Architecture (Server/Client components, routing)
- ⚡ Performance (queries, caching, bundle size)
- ♿ Accessibility (WCAG, semantic HTML, ARIA)
- 🎯 Project-Specific (Supabase dual-client, NextAuth, shadcn/ui)

**Output Format**:
- 📊 Audit Summary (grade, issue counts)
- 🚨 Critical Issues (must fix before deployment)
- ⚠️ Warnings (should fix soon)
- 💡 Suggestions (nice to have)
- ✅ Strengths (what code does well)
- 📝 Detailed Analysis (with code examples)

**Agent vs Scripts**:
| Use Case | Tool |
|----------|------|
| Interactive development review | 🤖 gemini-code-auditor agent |
| Pre-deployment security gate | 📜 `./scripts/pre-deploy-audit.sh` |
| Scheduled weekly audits | 📜 `./scripts/run-gemini-audit.sh --auto-approve` |
| CI/CD integration | 📜 Scripts (exit codes for automation) |
| Historical tracking | 📜 Scripts (markdown reports in `audits/`) |

**Test Results** (2025-11-11):
- ✅ Grade: A- (SQL injection fix audit)
- ✅ No token limit issues (Gemini free tier)
- ✅ Detailed, actionable feedback with code examples
- ✅ Project-aware (mentioned dual-client pattern, port 8080)

**See Also**: [Complete Agent Documentation](./docs/gemini-auditor.md)

## API Architecture

**REST Endpoint Pattern** (App Router style):
```typescript
// src/app/api/products/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { searchProductsAction } from '@/lib/actions'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')

  if (!query) {
    return NextResponse.json({ error: 'Query required' }, { status: 400 })
  }

  const results = await searchProductsAction(query)
  return NextResponse.json({ data: results })
}
```

**Available Endpoints**:
- `GET /api/products/search?q=<term>` - Max 50 results
- `GET /api/products/[id]` - Full product details
- `GET /api/health` - Health check with uptime

## Docker Deployment

**Multi-stage Build** (`Dockerfile`):
1. **Base**: Node 18 Alpine
2. **Deps**: Install dependencies only
3. **Builder**: `npm run build` with standalone output
4. **Runner**: Production image
   - Non-root user (`nextjs:nodejs`)
   - Minimal footprint (standalone + static files)
   - Healthcheck via wget + `/api/health`
   - Port 8080 exposed

**Docker Compose** (`docker-compose.yml`):
- Environment from `.env.production`
- Healthcheck: 30s interval, 3 retries, 10s timeout
- Logging: JSON driver, 10MB max, 5 files, compressed
- Restart policy: `unless-stopped`
- Custom network: `fossapp-network`

**Deployment Process**:
1. Build image: `docker-compose build`
2. Start container: `docker-compose up -d`
3. Verify health: `curl http://localhost:8080/api/health`
4. Check logs: `docker-compose logs -f`

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

**Port Configuration**:
- Development server: `npm run dev` runs on **port 8080** (not default 3000)
- Production server: `npm run start` runs on **port 8080**
- Docker exposes: **port 8080**
- This is configured in `package.json` scripts with `-p 8080` flag

## Version Management

**Version Display Component** (`src/components/version-display.tsx`):
- Reads from `package.json` version field (currently v1.1.1)
- Shows `v1.1.1-dev` in development (`NODE_ENV !== 'production'`)
- Shows `v1.1.1` in production
- Located at bottom of sidebar navigation
- Purpose: Environment awareness and deployment verification

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

## Common Tasks

### Adding a New Page
1. Create `src/app/new-page/page.tsx`
2. Use server component by default
3. Add to navigation in sidebar if needed
4. Protect route with `useSession()` if auth required

### Creating a New API Endpoint
1. Create `src/app/api/endpoint/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Use `supabaseServer` for database access
4. Return `NextResponse.json()`
5. Add error handling

### Adding a Server Action
1. Add to `src/lib/actions.ts`
2. Use `supabaseServer` client
3. Add input validation (regex, trim, limits)
4. Export async function
5. Call from client components or API routes

### Updating Styles
- Global styles: `src/app/globals.css`
- Component styles: Inline Tailwind classes
- New colors: Add to CSS variables in globals.css
- Dark mode: Use Tailwind dark: prefix

### Working with Supabase
```typescript
// Server-side query (preferred)
import { supabaseServer } from '@/lib/supabase-server'

const { data, error } = await supabaseServer
  .from('items.product_info')
  .select('*')
  .eq('product_id', id)
  .single()

if (error) throw error
return data
```

### Deploying to Production
1. **Use production-deployer agent** (recommended):
   - "Deploy to production version 1.3.6"
   - Agent handles everything automatically

2. **Update CHANGELOG.md**:
   - Add entry for new version
   - Document changes (Added/Changed/Fixed/Security)
   - Include deployment notes if significant

3. **Manual method** (if needed):
   - See Production Details section for manual deployment steps

## Known Issues

- OAuth callback has state cookie issue in WSL2 environment (production works fine)
- CORS warnings for cross-origin requests (can configure in `next.config.ts`)
- Materialized view `items.product_info` requires manual refresh (see `/home/sysadmin/fossdb/utils/matview_maintenance/`)

## Future Enhancements

- Advanced product filtering (categories, suppliers, price ranges)
- User favorites and wishlist
- Product comparison feature
- Image gallery for products
- Advanced ETIM classification filters
- Export to AutoCAD formats
- Lighting calculation tools
- Project collaboration features
- **Google Drive Shared Drive Integration**: Read/write access to "HUB" Shared Drive for supplier catalogs, product images, and documentation. Complete implementation guide available at [GOOGLE_DRIVE_SHARED_DRIVE_INTEGRATION.md](./docs/GOOGLE_DRIVE_SHARED_DRIVE_INTEGRATION.md). Reference implementation exists in `/home/sysadmin/tools/gdrive-sync/` (standalone OAuth tool).

## Production Details

**VPS**: platon.titancnc.eu
**Domain**: https://main.fossapp.online
**Current Version**: v1.4.3
**Deployment**: Automated via production-deployer agent
**Deployment Directory**: `/opt/fossapp/`
**Monitoring**: Docker healthcheck + `/api/health` endpoint

**Deployment Structure** (Updated 2025-10-27):
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

**Old Structure** (Archived):
- `/opt/fossapp-old-bluegreen/` - Previous Blue-Green deployment
- `/opt/fossapp-backup-20251027-130630.tar.gz` - Backup of old structure

**Deployment Workflow**:

**Recommended Method** (Automated via Claude Code):
```
Use the production-deployer agent in Claude Code:
"Deploy to production version 1.3.6" (or specify the version you want)

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

1. **Run Pre-Deployment Script FIRST**:
   ```bash
   ./scripts/deploy-check.sh
   ```
   - If ANY check fails, STOP immediately and report to user
   - Do NOT proceed with version bump or deployment
   - Show the exact error output to the user

2. **Report All Script Output**:
   - Show user the full output of deploy-check.sh
   - If type-check fails → Show TypeScript errors
   - If smoke tests fail → Show which test failed and why
   - If build fails → Show build errors (ESLint, missing deps, etc.)

3. **Never Skip Errors**:
   - Do NOT continue if any validation step fails
   - Do NOT assume "it will work in production"
   - Do NOT create version tags if checks fail
   - Do NOT push to git if checks fail

4. **Clear Communication**:
   ```
   ❌ BAD: "Build might have issues, proceeding anyway..."
   ✅ GOOD: "❌ Pre-deployment checks FAILED. Cannot deploy.
             Error: TypeScript type checking failed with 3 errors.
             Fix these errors before deploying."
   ```

5. **Verification After Each Step**:
   - After running script → Verify exit code is 0
   - After git push → Verify push succeeded
   - After VPS deploy → Verify health check passes
   - After health check → Compare version numbers match

**Example Deployment Flow**:
```
User: "Deploy to production version 1.4.1"

Agent:
1. ✓ Running ./scripts/deploy-check.sh...
   ✓ Type checking... PASSED
   ✓ Smoke tests (7)... PASSED
   ✓ Production build... PASSED

2. ✓ All checks passed. Proceeding with deployment.

3. ✓ Version bumped to 1.4.1
4. ✓ Committed and pushed to GitHub
5. ✓ Deployed to platon.titancnc.eu
6. ✓ Health check: {"status":"healthy","version":"1.4.1"}

Deployment successful! ✅
```

**If ANY step fails**:
```
User: "Deploy to production version 1.4.1"

Agent:
1. ❌ Running ./scripts/deploy-check.sh... FAILED

   Error output:
   ⚙️  Type checking... ✓ PASSED
   ⚙️  Smoke tests... ✗ FAILED

   Test "health endpoint responds" failed:
   Expected status 200, got 500

   ❌ Cannot proceed with deployment.

   Please fix the failing test and try again.
```

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

**Migration Notes**:
- **2025-10-27**: Migrated from Blue-Green deployment to simple git-based deployment
- Benefits: 70% simpler, git as single source of truth, easy rollback
- Trade-off: ~1-2 minutes downtime during deployment (acceptable for solo dev)

## Progressive Web App (PWA)

**Status**: ✅ Active (v1.1.4+)
**Package**: @ducanh2912/next-pwa
**Documentation**: See `docs/PWA.md` for complete details

FOSSAPP is installable as a Progressive Web App on desktop, mobile, and tablet devices.

### Key Features

- **Installable**: Add to home screen/desktop like native app
- **Automatic Updates**: Updates deploy seamlessly in background (no user action)
- **Faster Loading**: Service worker caching reduces subsequent load times by 55%
- **Cross-Platform**: Works on Windows, macOS, Linux, Android, iOS
- **Offline Support**: App shell cached (product data requires connection)

### Update Strategy

```typescript
// Configured in next.config.ts
{
  skipWaiting: true,        // Immediate activation of new version
  reloadOnOnline: true,     // Check for updates when reconnecting
}
```

**User Experience**:
- No update prompts or "Reload to update" messages
- New versions activate automatically in background
- Users see latest version on next page navigation
- Zero downtime, zero user action required

### Installation

**Desktop** (Chrome, Edge, Brave):
- Visit https://main.fossapp.online
- Click install icon in address bar
- App appears on desktop/Start Menu

**Mobile** (Android Chrome):
- Visit https://main.fossapp.online
- Menu → "Add to Home screen"

**iOS** (Safari):
- Visit https://main.fossapp.online
- Share → "Add to Home Screen"

### Configuration Files

- **next.config.ts**: PWA wrapper configuration
- **public/manifest.json**: Web app manifest
- **src/app/layout.tsx**: PWA metadata
- **public/PWA_ICONS_TODO.md**: Icon generation guide

### Testing PWA

```bash
# Local production build (PWA disabled in dev)
npm run build && npm run start

# Production testing
curl https://main.fossapp.online/api/health

# Chrome DevTools
F12 → Application → Service Workers
F12 → Application → Manifest
```

**Complete Documentation**: See `docs/PWA.md` for:
- Detailed installation instructions
- Update mechanism explained
- Offline capabilities
- Troubleshooting guide
- Testing procedures
- Security considerations

## Using Playwright MCP for Development

Playwright MCP is a powerful tool for visual testing, UI development, and debugging. With the authentication bypass enabled, you can fully explore the application.

**Available Actions**:
- `browser_navigate` - Navigate to any page
- `browser_take_screenshot` - Capture page screenshots
- `browser_snapshot` - Get accessibility tree snapshot
- `browser_type` - Type text into inputs
- `browser_click` - Click buttons and links
- `browser_evaluate` - Execute JavaScript in browser context

**Example Workflow**:
```javascript
// Navigate to products page
browser_navigate("http://localhost:8080/products")

// Take screenshot
browser_take_screenshot("products-initial.png")

// Search for products
browser_type(element="search input", ref="e48", text="downlight")
browser_click(element="search button", ref="e49")

// Capture results
browser_take_screenshot("search-results.png")
```

**Screenshots Location**: `.playwright-mcp/` directory

**Use Cases**:
- Visual regression testing after UI changes
- Documenting features with screenshots
- Testing user flows and interactions
- Debugging layout and styling issues
- Verifying responsive design at different viewport sizes

## Using shadcn MCP for Component Management

The shadcn MCP server enables AI-assisted component management for faster development.

**Setup** (User configuration):
Add to Claude Code MCP settings:
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@shadcn/mcp"]
    }
  }
}
```

**Benefits**:
- AI can add shadcn components directly without manual commands
- Automatic component installation with proper dependencies
- Context-aware component suggestions
- Consistent component usage patterns

**Available MCP Actions** (once configured):
- Add new components (dialog, table, dropdown-menu, etc.)
- List available components
- Update existing components
- Check component documentation

**Example Usage**:
```
User: "Add a data table with sorting and filtering"
→ shadcn MCP adds table component
→ AI generates implementation with Supabase integration
→ Styled consistently with existing components
```

**Currently Installed Components**:
- Button, Card, Input, Badge, Alert, Avatar

**Popular Components to Add**:
- Dialog (modals)
- Table (data tables with sorting)
- Dropdown Menu (navigation menus)
- Select (form dropdowns)
- Tabs (tabbed interfaces)
- Toast (notifications)
- Form (form validation with react-hook-form)

## Project Documentation

### Documentation Convention

The `docs/` folder contains **supplementary documentation** and detailed guides:
- CLAUDE.md (this file) = Quick reference and development guide
- docs/ = Extended documentation, procedures, and deep-dive guides

**When to add docs**:
- ✅ Detailed procedures (deployment checklists, setup guides)
- ✅ Architecture deep-dives (database schemas, data flows)
- ✅ Operational guides (troubleshooting, maintenance)
- ✅ Domain-specific documentation (ETIM, supplier info)
- ❌ Code documentation (use inline comments and JSDoc)

### Current Documentation

**Deployment & Operations**:
- [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) - **MUST READ** before deploying
- [CHANGELOG.md](./CHANGELOG.md) - Version history and release notes (SemVer)
- [PWA.md](./docs/PWA.md) - Progressive Web App implementation, updates, and testing
- [vps-deployment.md](./docs/vps-deployment.md) - VPS setup and deployment guide
- [DOMAIN_CONFIGURATION.md](./docs/DOMAIN_CONFIGURATION.md) - Centralized domain configuration and migration guide

**Database & Architecture**:
- [postgresql_etim_items_schema_overview.md](./docs/postgresql_etim_items_schema_overview.md) - Database schema documentation
- [SUPPLIER_LOGOS.md](./docs/SUPPLIER_LOGOS.md) - Supplier logo guidelines and dark mode support

**Key Principle**: Keep CLAUDE.md concise for quick reference; use docs/ for detailed explanations and procedures.

## Support & References

- **Supabase Project**: hyppizgiozyyyelwdius.supabase.co
- **Database Maintenance**: `/home/sysadmin/fossdb/utils/matview_maintenance/`
- **Next.js Docs**: https://nextjs.org/docs
- **shadcn/ui Docs**: https://ui.shadcn.com
- **Radix UI Docs**: https://www.radix-ui.com/primitives
- **Tailwind CSS Docs**: https://tailwindcss.com/docs

## Next.js 16 Upgrade Notes

**Upgraded**: 2025-10-28 from Next.js 15.3.4 → 16.0.0

### Key Changes
- **Turbopack**: Now default bundler (2-5x faster builds, 10x faster Fast Refresh)
- **Build Performance**: ~6-7 seconds for production builds (previously ~8-10s)
- **Metadata API**: Moved `viewport` and `themeColor` to separate `generateViewport` export in `src/app/layout.tsx`
- **Import Resolution**: Fixed `package.json` import in health route (Turbopack has stricter path resolution)

### What Works
✅ All routes functional
✅ NextAuth.js v4 compatible (despite peer dependency warning)
✅ shadcn/ui components work flawlessly
✅ Supabase client libraries compatible
✅ PWA functionality intact
✅ Development and production builds successful

### Configuration Changes
- Added `turbopack: {}` to `next.config.ts` to silence webpack warnings
- Updated `src/app/api/health/route.ts` to use relative imports instead of path aliases

### Future Considerations
- NextAuth.js officially supports up to Next.js 15, but works fine with 16
- Consider upgrading to NextAuth v5 (Auth.js) in future for full Next.js 16 support
- No breaking changes affect current codebase (no middleware, no custom caching)

## Version History

For detailed version history, deployment notes, and changelog, see **[CHANGELOG.md](./CHANGELOG.md)**.

**Current Production Version**: v1.3.5

## Documentation Updates

**Last updated**: 2025-11-09

- Deployment workflow now uses production-deployer agent (automated)
- Documentation kept minimal (details moved to CHANGELOG.md)
- ImageMagick is installed
- Always close playwright browser when finished using it