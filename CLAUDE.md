# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FOSSAPP is a Next.js 15.3.4 application providing a searchable database of 56,456+ lighting products and accessories for lighting design professionals, architects, and AutoCAD users. Built with App Router, TypeScript, and Supabase PostgreSQL backend.

**Production**: https://app.titancnc.eu (v1.1.2)
**Development**: Port 8080 (not 3000 - note the custom port configuration)

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
curl https://app.titancnc.eu/api/health        # Production
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
- **Framework**: Next.js 15.3.4 with App Router (file-based routing)
- **Language**: TypeScript
- **Authentication**: NextAuth.js v4 (Google OAuth only)
- **Database**: Supabase PostgreSQL (dual-client pattern)
- **UI Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS with HSL color system
- **Components**: shadcn/ui components with CVA variants
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

**Exposed Schemas**: public, extensions, items, etim
**Permissions**: Both service_role and anon have SELECT on items.product_info

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

## Production Details

**VPS**: platon.titancnc.eu
**Domain**: https://app.titancnc.eu
**Current Version**: v1.1.2
**Deployment**: Simple git-based deployment with Docker
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
```bash
# 1. Local: Create new version
npm version patch
git push origin main --tags

# 2. Production: Deploy
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu
cd /opt/fossapp
./deploy.sh v1.1.3

# 3. Verify
curl https://app.titancnc.eu/api/health
```

**Health Check Response**:
```json
{
  "status": "healthy",
  "timestamp": "2025-10-27T11:21:16.913Z",
  "version": "1.1.2",
  "uptime": 38.436665712,
  "environment": "production"
}
```

**Migration Notes**:
- **2025-10-27**: Migrated from Blue-Green deployment to simple git-based deployment
- Benefits: 70% simpler, git as single source of truth, easy rollback
- Trade-off: ~1-2 minutes downtime during deployment (acceptable for solo dev)

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

## Support & References

- **Supabase Project**: hyppizgiozyyyelwdius.supabase.co
- **Database Maintenance**: `/home/sysadmin/fossdb/utils/matview_maintenance/`
- **Next.js Docs**: https://nextjs.org/docs
- **shadcn/ui Docs**: https://ui.shadcn.com
- **Radix UI Docs**: https://www.radix-ui.com/primitives
- **Tailwind CSS Docs**: https://tailwindcss.com/docs

## Last Updated

**2025-10-27** - Documented shadcn/ui integration and MCP server setup. Project already uses shadcn components (Button, Card, Input, Badge, Alert, Avatar) with New York style configuration.
