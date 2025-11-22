# Development Tasks

Common development tasks and patterns for FOSSAPP.

## Adding a New Page

### 1. Create Page File

```bash
# Create new route
mkdir -p src/app/new-page
touch src/app/new-page/page.tsx
```

### 2. Server Component (Default)

```typescript
// src/app/new-page/page.tsx
export default function NewPage() {
  return (
    <div>
      <h1>New Page</h1>
      <p>Server-rendered content</p>
    </div>
  )
}
```

### 3. Client Component (If Needed)

```typescript
// src/app/new-page/page.tsx
'use client'

import { useState } from 'react'

export default function NewPage() {
  const [state, setState] = useState('')

  return <div>Interactive content</div>
}
```

### 4. Add to Navigation

```typescript
// src/components/sidebar.tsx (or navigation component)
<nav>
  <Link href="/new-page">New Page</Link>
</nav>
```

### 5. Protect Route (Optional)

```typescript
'use client'

import { useSession } from 'next-auth/react'
import { redirect } from 'next/navigation'

export default function ProtectedPage() {
  const { data: session, status } = useSession()

  if (status === 'loading') return <div>Loading...</div>
  if (!session) redirect('/')

  return <div>Protected content</div>
}
```

## Creating a New API Endpoint

### 1. Create Route File

```bash
# Simple endpoint
mkdir -p src/app/api/endpoint
touch src/app/api/endpoint/route.ts

# Dynamic endpoint
mkdir -p src/app/api/endpoint/[id]
touch src/app/api/endpoint/[id]/route.ts
```

### 2. Implement Handler

```typescript
// src/app/api/endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // Extract query parameters
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    // Validate input
    if (!query) {
      return NextResponse.json(
        { error: 'Query required' },
        { status: 400 }
      )
    }

    // Query database
    const { data, error } = await supabaseServer
      .from('table_name')
      .select('*')
      .ilike('column', `%${query}%`)

    if (error) throw error

    return NextResponse.json({ data })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### 3. Test Endpoint

```bash
# Local testing
curl "http://localhost:8080/api/endpoint?q=test"

# Production testing
curl "https://main.fossapp.online/api/endpoint?q=test"
```

## Adding a Server Action

### 1. Add to actions.ts

```typescript
// src/lib/actions.ts
'use server'

import { supabaseServer } from '@/lib/supabase-server'

export async function newAction(input: string) {
  // Validate input
  if (!input || input.trim().length === 0) {
    throw new Error('Input required')
  }

  // Sanitize
  const sanitized = input.trim().slice(0, 100)

  // Query database
  const { data, error } = await supabaseServer
    .from('table_name')
    .select('*')
    .eq('column', sanitized)

  if (error) throw error
  return data
}
```

### 2. Use in Component

```typescript
'use client'

import { newAction } from '@/lib/actions'

export function MyComponent() {
  const handleAction = async (input: string) => {
    try {
      const result = await newAction(input)
      console.log(result)
    } catch (error) {
      console.error('Action failed:', error)
    }
  }

  return <button onClick={() => handleAction('test')}>Test</button>
}
```

## Working with Supabase

### Server-Side Query

```typescript
import { supabaseServer } from '@/lib/supabase-server'

// Select all columns
const { data, error } = await supabaseServer
  .from('items.product_info')
  .select('*')

// Select specific columns
const { data } = await supabaseServer
  .from('items.product_info')
  .select('product_id, description_short')

// Filter results
const { data } = await supabaseServer
  .from('items.product_info')
  .select('*')
  .eq('supplier_name', 'Delta Light')
  .limit(50)

// Single record
const { data, error } = await supabaseServer
  .from('items.product_info')
  .select('*')
  .eq('product_id', id)
  .single()

// Case-insensitive search
const { data } = await supabaseServer
  .from('items.product_info')
  .select('*')
  .ilike('description_short', `%${query}%`)

// Call RPC function
const { data } = await supabaseServer
  .schema('items')
  .rpc('get_active_catalogs_with_counts')
```

### Error Handling

```typescript
const { data, error } = await supabaseServer
  .from('items.product_info')
  .select('*')
  .eq('product_id', id)
  .single()

if (error) {
  console.error('Database error:', error)
  throw error  // or return null, empty array
}

return data
```

## Adding shadcn/ui Components

### Install Component

```bash
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add dropdown-menu
```

### Use Component

```typescript
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        <Button variant="default">Click me</Button>
      </CardContent>
    </Card>
  )
}
```

### Check Installed Components

```bash
ls src/components/ui/
```

## Updating Styles

### Global Styles

```css
/* src/app/globals.css */
@layer base {
  :root {
    --custom-color: 200 50% 50%;
  }
}

@layer components {
  .custom-class {
    @apply flex items-center gap-2;
  }
}
```

### Component Styles

```typescript
// Use Tailwind classes
<div className="flex items-center justify-between p-4 bg-background">
  <h1 className="text-2xl font-bold">Title</h1>
</div>

// Dark mode
<div className="bg-white dark:bg-slate-900">
  <p className="text-black dark:text-white">Text</p>
</div>
```

### Theme Colors

```typescript
// Use theme tokens (automatically support dark mode)
<div className="bg-background text-foreground">
  <button className="bg-primary text-primary-foreground">
    Button
  </button>
</div>
```

## Environment Variables

### Add New Variable

```bash
# .env.local (development)
NEW_VARIABLE=value

# .env.production (production)
NEW_VARIABLE=production_value
```

### Public vs Private

```bash
# Public (exposed to browser)
NEXT_PUBLIC_API_URL=https://api.example.com

# Private (server-side only)
DATABASE_PASSWORD=secret
```

### Use in Code

```typescript
// Server-side (actions, API routes)
const secret = process.env.DATABASE_PASSWORD

// Client-side (components)
const apiUrl = process.env.NEXT_PUBLIC_API_URL
```

### Restart Required

After changing `.env.*` files:
```bash
# Development
# Stop dev server (Ctrl+C), then restart
npm run dev

# Production (Docker)
docker-compose restart
```

## Database Migrations

### Create Migration

```bash
# Create new migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_description.sql
```

### Write Migration

```sql
-- supabase/migrations/20251115_add_new_table.sql

-- Create table
CREATE TABLE IF NOT EXISTS items.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Grant permissions
GRANT SELECT ON items.new_table TO service_role;
GRANT SELECT ON items.new_table TO authenticated;

-- Add comment
COMMENT ON TABLE items.new_table IS 'Description of table';
```

### Apply Migration

Use Supabase MCP or dashboard to apply migrations.

## Debugging

### Development Console

```bash
# Start dev server
npm run dev

# Watch for errors in terminal
# Check browser console (F12)
```

### Production Logs

```bash
# Docker logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Filter by time
docker-compose logs --since 1h
```

### Common Issues

**Port 8080 already in use**:
```bash
# Find process
lsof -i :8080

# Kill process
kill -9 <PID>
```

**Build fails**:
```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

**TypeScript errors**:
```bash
# Check types
npx tsc --noEmit

# Fix auto-fixable issues
npm run lint -- --fix
```

## Testing

### Manual Testing

```bash
# Start development server
npm run dev

# Visit http://localhost:8080
# Test features manually
```

### Production Build Testing

```bash
# Build for production
npm run build

# Start production server
npm run start

# Test on http://localhost:8080
```

### Health Check

```bash
# Local
curl http://localhost:8080/api/health

# Production
curl https://main.fossapp.online/api/health
```

## Code Quality

### Linting

```bash
# Check for issues
npm run lint

# Fix auto-fixable issues
npm run lint -- --fix
```

### Type Checking

```bash
# Check TypeScript types
npx tsc --noEmit
```

### Format Code

```bash
# Using VS Code
# Shift+Alt+F (Windows)
# Shift+Option+F (Mac)
```

## Git Workflow

### Feature Branch

```bash
# Create branch
git checkout -b feature/new-feature

# Make changes
git add .
git commit -m "Add new feature"

# Push to remote
git push origin feature/new-feature
```

### Commit Message Convention

```bash
# Format: type: description

git commit -m "feat: Add product filtering"
git commit -m "fix: Resolve search bug"
git commit -m "docs: Update API documentation"
git commit -m "style: Format code"
git commit -m "refactor: Simplify search logic"
git commit -m "test: Add unit tests"
git commit -m "chore: Update dependencies"
```

### Version Bump

```bash
# Patch (1.0.0 → 1.0.1)
npm version patch

# Minor (1.0.0 → 1.1.0)
npm version minor

# Major (1.0.0 → 2.0.0)
npm version major

# Push with tags
git push origin main --tags
```

## Deployment

### Pre-Deployment Checklist

```bash
# 1. Run validation script
./scripts/deploy-check.sh

# 2. If passed, use production-deployer agent
# "Deploy to production version 1.3.6"
```

See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./PRODUCTION_DEPLOYMENT_CHECKLIST.md) for complete guide.

## Common Patterns

### Loading States

```typescript
'use client'

import { useState } from 'react'

export function SearchComponent() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async () => {
    setIsLoading(true)
    try {
      await fetchData()
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) return <Spinner />
  return <Results />
}
```

### Error Boundaries

```typescript
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

### Not Found Pages

```typescript
// src/app/not-found.tsx
export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find requested resource</p>
    </div>
  )
}
```

## See Also

- Component patterns: [COMPONENT_ARCHITECTURE.md](./COMPONENT_ARCHITECTURE.md)
- API patterns: [API_PATTERNS.md](./API_PATTERNS.md)
- Docker deployment: [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)
- Security: [SECURITY_AUDITING.md](./SECURITY_AUDITING.md)
