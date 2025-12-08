# Component Architecture

FOSSAPP uses shadcn/ui component library built on Radix UI primitives and Tailwind CSS.

## Overview

**Component Library**: shadcn/ui
**Configuration**: `components.json` (New York style, RSC enabled)
**Base Framework**: Radix UI (accessibility primitives)
**Styling**: Tailwind CSS with HSL color system
**Variant Management**: CVA (Class Variance Authority)

## shadcn/ui Integration

### Installation

```bash
# Add new component
npx shadcn@latest add <component-name>

# Examples
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add dropdown-menu

# Check for component updates
npx shadcn@latest diff
```

### Installed Components

Current components in `src/components/ui/`:
- **Button** - Primary actions and links
- **Card** - Content containers
- **Input** - Form input fields
- **Badge** - Status indicators and tags
- **Alert** - Notifications and messages
- **Avatar** - User profile images
- **Spinner** - Loading indicator (uses FossSpinner)

### Custom Components

#### FossSpinner

Custom branded loading spinner featuring the Foss "F" logo with an animated yellow dot tracing its outline.

**Location**: `src/components/foss-spinner.tsx`

**Usage**:
```tsx
// Direct usage
import { FossSpinner, FossSpinnerInline } from '@/components/foss-spinner'

<FossSpinner size={64} />                    // Custom size in pixels
<FossSpinner variant="dark" />               // White F for dark backgrounds
<FossSpinnerInline />                        // Small inline spinner (20px)

// Via Spinner wrapper (recommended)
import { Spinner } from '@/components/ui/spinner'

<Spinner size="lg" />                        // sm=20, md=32, lg=48, xl=64
<Spinner size="lg" variant="dark" />         // For dark backgrounds
```

**Props**:
- `size`: Number (pixels) or "sm" | "md" | "lg" | "xl" via Spinner wrapper
- `variant`: "auto" (default, respects dark mode) | "light" (black F) | "dark" (white F)
- `className`: Additional CSS classes

**Design Guidelines**:
- Always center spinners in the main content area, not in sidebars
- Use `variant="dark"` on dark backgrounds (e.g., `bg-black`)
- Use `variant="auto"` (default) when the spinner should respond to system dark mode
- Standard placement: `<div className="flex items-center justify-center flex-1">`

### Popular Components to Add

- **Dialog** - Modal dialogs
- **Table** - Data tables with sorting
- **Dropdown Menu** - Navigation menus
- **Select** - Form dropdowns
- **Tabs** - Tabbed interfaces
- **Toast** - Toast notifications
- **Form** - Form validation (with react-hook-form)

## Component Pattern

shadcn/ui components follow a consistent pattern:

### Example: Button Component

```typescript
// src/components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "@radix-ui/react-slot"
import { forwardRef } from "react"

// 1. Define variants with CVA
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input hover:bg-accent",
        ghost: "hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    }
  }
)

// 2. Define props interface
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

// 3. Create component with forwardRef
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### Key Patterns Explained

**1. CVA (Class Variance Authority)**
- Manages component variants (size, color, state)
- Type-safe variant props
- Composable variant combinations
- Example: `<Button variant="destructive" size="lg" />`

**2. Radix Slot Pattern**
- `asChild` prop for polymorphism
- Renders as child component instead of default element
- Example: `<Button asChild><Link href="/">Home</Link></Button>`
- Renders as `<a>` instead of `<button>`

**3. forwardRef Pattern**
- Allows ref access for parent components
- Essential for focus management, animations
- Compatible with React 19 and Next.js 16

**4. cn() Utility**
- Merges Tailwind classes intelligently
- Defined in `src/lib/utils.ts`
- Uses `clsx` + `tailwind-merge`
- Handles class conflicts (e.g., `px-4` + `px-6` = `px-6`)

## Theme System

### HSL Color Tokens

Colors defined as CSS variables in `src/app/globals.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... more tokens */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... more tokens */
}
```

### Dark Mode

**Provider**: `next-themes`
**Strategy**: CSS class (`.dark` added to `<html>`)
**Toggle**: `src/components/theme-toggle.tsx`

```typescript
// Usage in components
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      Toggle Theme
    </button>
  )
}
```

### Responsive Design

**Tailwind Breakpoints**:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Usage**:
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {/* Responsive grid */}
</div>
```

## Server vs Client Components

### Default: Server Components

```typescript
// No 'use client' directive = Server Component
export default function ProductPage() {
  return <div>Server-rendered content</div>
}
```

**Benefits**:
- Better performance (less JavaScript)
- SEO-friendly
- Direct database access
- Automatic code splitting

### Client Components

```typescript
'use client'

import { useState } from 'react'

export default function InteractiveComponent() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

**Use when you need**:
- React hooks (useState, useEffect, useContext)
- Browser APIs (localStorage, window)
- Event handlers (onClick, onChange)
- Third-party libraries requiring client context

### Composition Pattern

Keep client components small and compose them in server components:

```typescript
// app/page.tsx (Server Component)
import { InteractiveButton } from '@/components/interactive-button'

export default function Page() {
  return (
    <div>
      <h1>Server-rendered heading</h1>
      <InteractiveButton /> {/* Client component */}
    </div>
  )
}
```

## State Management

**No global state library** - React built-in hooks:

- `useState` / `useEffect` - Local component state
- `useSession()` - NextAuth authentication state
- `useTheme()` - Theme state from next-themes
- Server actions - Data fetching from database

### Data Fetching Pattern

```typescript
'use client'

import { useState } from 'react'
import { searchProductsAction } from '@/lib/actions'

export function ProductSearch() {
  const [results, setResults] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    try {
      const data = await searchProductsAction(query)
      setResults(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div>
      {isLoading ? <Spinner /> : <Results data={results} />}
    </div>
  )
}
```

## Typography

**Fonts**: Geist Sans & Geist Mono (Next.js optimized)

```typescript
// src/app/layout.tsx
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export default function RootLayout({ children }) {
  return (
    <html className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  )
}
```

**CSS Variables**:
- `font-sans` - Geist Sans (default)
- `font-mono` - Geist Mono (code blocks)

## Best Practices

### Component Organization

```
src/components/
├── ui/              # shadcn/ui primitives (don't modify)
├── providers.tsx    # Context providers
├── theme-*.tsx      # Theme-related components
└── feature-*.tsx    # Feature-specific components
```

### Styling Guidelines

**DO**:
- ✅ Use Tailwind utility classes
- ✅ Use HSL color tokens from theme
- ✅ Leverage dark: prefix for dark mode
- ✅ Use responsive breakpoint prefixes (md:, lg:)
- ✅ Compose with cn() utility

**DON'T**:
- ❌ Write custom CSS unless absolutely necessary
- ❌ Use inline styles (`style={{}}`)
- ❌ Hardcode colors (use theme tokens)
- ❌ Modify shadcn/ui components directly (extend instead)

### Accessibility

shadcn/ui components are built on Radix UI primitives with:
- ARIA attributes
- Keyboard navigation
- Focus management
- Screen reader support

**Always**:
- Use semantic HTML
- Add `aria-label` for icon-only buttons
- Ensure sufficient color contrast
- Test with keyboard navigation

### Type Safety

```typescript
// Define component props interface
interface ProductCardProps {
  product: {
    id: string
    name: string
    price: number
  }
  onSelect?: (id: string) => void
}

// Use in component
export function ProductCard({ product, onSelect }: ProductCardProps) {
  return (
    <Card onClick={() => onSelect?.(product.id)}>
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </Card>
  )
}
```

## Adding Custom Components

### Method 1: Extend shadcn/ui

```typescript
// src/components/ui/custom-button.tsx
import { Button, buttonVariants } from './button'
import { cva } from 'class-variance-authority'

const customButtonVariants = cva({
  extend: buttonVariants,
  variants: {
    gradient: {
      blue: "bg-gradient-to-r from-blue-500 to-cyan-500",
      purple: "bg-gradient-to-r from-purple-500 to-pink-500",
    }
  }
})

// Use with: <CustomButton gradient="blue" />
```

### Method 2: Compose shadcn/ui

```typescript
// src/components/delete-button.tsx
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

export function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <Button variant="destructive" size="sm" onClick={onDelete}>
      <Trash2 className="mr-2 h-4 w-4" />
      Delete
    </Button>
  )
}
```

## Icons

**Library**: lucide-react (included with shadcn/ui)

```typescript
import { Search, User, Settings } from 'lucide-react'

<Button>
  <Search className="mr-2 h-4 w-4" />
  Search
</Button>
```

**Icon Sizing**:
- `h-4 w-4` - Small (16px) - inline with text
- `h-6 w-6` - Medium (24px) - standalone buttons
- `h-8 w-8` - Large (32px) - hero sections

## See Also

- **shadcn/ui Docs**: https://ui.shadcn.com
- **Radix UI Docs**: https://www.radix-ui.com/primitives
- **Tailwind CSS Docs**: https://tailwindcss.com/docs
- **CVA Docs**: https://cva.style/docs
- Main documentation: [CLAUDE.md](../CLAUDE.md)
