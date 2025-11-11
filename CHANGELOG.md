# Changelog

All notable changes to FOSSAPP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security
- **CRITICAL**: Server-side Google Workspace domain validation (prevents unauthorized account access)
- **CRITICAL**: Removed server action import from client bundle (prevents service role key exposure)
- Sanitized error logging to prevent PII and credential leaks in logs
- Enhanced environment variable validation with descriptive error messages

### Added
- Pre-deployment validation script (`scripts/deploy-check.sh`)
- Playwright smoke tests for critical API endpoints and auth flows (7 tests)
- Type-check npm script for TypeScript validation
- Test scripts (test, test:ci) for automated testing
- ALLOWED_DOMAIN environment variable for workspace restriction

### Changed
- Client-side search now uses API endpoint instead of direct server action
- Error logging uses sanitized patterns (message/code only, no full error objects)
- Environment variables validated without TypeScript non-null assertions
- Improved error messages for missing configuration

### Fixed
- Next.js 16 build compatibility (server actions in client bundles)
- OAuth domain bypass vulnerability (now validated server-side)
- Inconsistent environment variable validation patterns
- Potential token/credential exposure in console logs

### Technical
- Auth callback validates email domain server-side in addition to OAuth 'hd' parameter
- All error handlers use sanitized logging (message only, no error objects)
- Playwright configuration for smoke testing critical paths
- Deploy-check script validates: type-check, lint, tests, and build

### Testing
- Health endpoint validation
- Manifest JSON validation
- Login page accessibility
- Protected route authentication checks
- API input validation
- Product search functionality

### Deployment Notes
- **IMPORTANT**: Add `ALLOWED_DOMAIN=foss.gr` to production `.env.production`
- Install Playwright browsers: `npx playwright install chromium`
- Run pre-deployment checks: `./scripts/deploy-check.sh`
- Smoke tests require dev server: `npm run test:ci`

## [1.4.0] - 2025-11-11

### Added
- User access monitoring system with comprehensive event tracking
- Analytics database schema in separate `analytics` namespace
- Most Active Users dashboard card showing top 5 active users
- User event logging with pathname and user agent tracking
- Empty state UI for analytics cards when no data available
- User activity tracking API endpoint (/api/user-events)

### Changed
- Moved user events table to `analytics.user_events` schema for better organization
- Enhanced event logging with detailed request metadata (pathname, user_agent)
- Improved dashboard layout with analytics cards
- Updated Supabase migrations for analytics schema

### Technical
- Analytics schema separation from main application schema
- Server-side event logging with service role access
- Type-safe analytics data structures
- Migration-based schema evolution (20251111_create_user_events_table.sql)

### Deployment
- **Method**: Automated deployment via production-deployer agent
- **Version**: Minor bump from 1.3.8 to 1.4.0 (new analytics features)
- **Build verification**: Local build passed successfully (10.4s with Turbopack)
- **Production build**: 55.6 seconds (Docker multi-stage build)
- **Changes merged**: PR #4 (user events) and PR #5 (analytics enhancements)
- **Main branch**: Commit 578927a (analytics schema enhancements)
- **Deployment time**: Container started in ~40 seconds
- **Health check**: Passed - API responding correctly with version 1.4.0
- **Verification**: Landing page, product search API, and container logs verified

## [1.3.8] - 2025-11-11

### Added
- Multi-theme system with three theme options: Default (green/emerald), Supabase (teal/green), and Graphite (zinc/slate)
- Theme selector component with visual color indicators for each theme
- LocalStorage-based theme persistence across sessions
- Full light/dark mode support for all themes
- System font stack for improved performance and native feel
- Hover effects and smooth transitions on theme selector
- Responsive design for theme customization

### Changed
- Migrated from Geist fonts to system font stack
- Removed font files from public directory for faster loading
- Updated CSS variables structure to support multiple themes
- Enhanced sidebar with theme switcher component
- Improved color palette with consistent theming across all components

### Technical
- Theme implementation using CSS custom properties with HSL color system
- Client-side theme state management with localStorage
- Backward-compatible with existing dark/light mode toggle
- Zero-runtime CSS with compile-time theme generation

### Deployment
- **Method**: Manual deployment following PRODUCTION_DEPLOYMENT_CHECKLIST.md
- **Build verification**: Local build passed successfully (11.9s with Turbopack)
- **Docker build time**: 42.9 seconds (production optimization)
- **Version**: Bumped from 1.3.7 to 1.3.8 (patch release)
- **Deployment time**: Container started in ~52 seconds
- **Health check**: Passed - API responding correctly with version 1.3.8

## [1.3.7] - 2025-11-10

### Added
- Logo animation effects (glow, shimmer, neon, float)
- Enhanced FossappLogo component with configurable effects
- Lighting-themed visual effects in globals.css
- Default glow + float effect on landing page logo

### Changed
- FOSSAPP logo now supports multiple visual effect types
- Landing page logo enhanced with glow animation
- Improved visual appeal for lighting products database branding

### Deployment
- **Method**: Automated via production-deployer agent
- **Build verification**: Local build passed successfully (8.7s with Turbopack)
- **Pre-deployment checks**: All environment variables verified

## [1.3.6] - 2025-11-10

### Added
- Customers feature with listing and detail pages
- Customer search functionality with pagination (1,700 customers)
- Three new server actions: searchCustomersAction, listCustomersAction, getCustomerByIdAction
- Customers navigation menu item

### Notes
- Requires Supabase 'customers' schema to be exposed in API settings post-deployment
- Customer data table: customers.foss_customers (1,700 records)

### Deployment
- **Method**: Automated via production-deployer agent
- **Build verification**: Local build passed successfully (10.1s with Turbopack)
- **Pre-deployment checks**: All environment variables verified

## [1.3.5] - 2025-11-09

### Changed
- Enhanced product media gallery with improved image handling
- Updated luminaire layout component for better product presentation

### Deployment
- **Method**: Automated via production-deployer agent (first automated deployment)
- **Build time**: 56.4 seconds (Docker)
- **Startup time**: 199ms
- **Verification**: All APIs tested and healthy (health, manifest, product search, product detail)
- **Note**: Successfully implemented agent-based deployment workflow, eliminating manual SSH steps

## [1.3.4] - 2025-11-09

### Added
- Comprehensive media gallery component
- Product description enhancements

## [1.1.4] - 2025-10-27

### Added
- Supplier logo dark mode support for better theme consistency
- Enhanced product detail page with dark mode logos

### Changed
- Improved supplier logo display logic
- Updated product detail TypeScript interfaces

### Fixed
- ESLint errors in production build (unused variables)
- TypeScript type errors for supplier logo properties
- React hooks exhaustive dependencies warnings

### Deployment
- **Lessons learned**: Always run `npm run build` before tagging
- **Issue**: Had to recreate tag 3 times due to build failures
- **Resolution**: Created PRODUCTION_DEPLOYMENT_CHECKLIST.md

## [1.1.1] - 2025-07-01

### Added
- Version display component in sidebar navigation
- Environment indicator (shows `-dev` suffix in development)
- Monospace font styling for version badge

### Changed
- Consistent UI across dashboard and products pages
- Production deployment testing and verification

## [1.1.0] - 2025-06-30

### Added
- Docker containerization with multi-stage build
- Health check endpoint (`/api/health`)
- Automatic log rotation (10MB × 5 files)
- Blue-green VPS deployment strategy
- Comprehensive deployment documentation

### Changed
- Port configuration to 8080 (from default 3000)
- Production environment templates

## [1.0.0] - 2025-06-30

### Added
- Product search and display (56,456+ lighting products)
- Google OAuth authentication via NextAuth.js
- Supabase PostgreSQL database integration
- Responsive design with Tailwind CSS and Radix UI
- Product details pages with full specifications
- Security-hardened API endpoints
- Professional lighting design focus

### Security
- Row-level security policies on database
- Service role isolation for server-side operations
- Input validation and sanitization

---

## Version Guidelines

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, major architectural updates
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible additions
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, security patches, small improvements

## Deployment Process

Before creating a new version, **always**:

1. Run `npm run build` to test production build
2. Fix all ESLint/TypeScript errors
3. Commit and push changes
4. **Only then** run `npm version patch|minor|major`
5. Push tags: `git push origin main --tags`
6. Deploy to production: `./deploy.sh v1.x.x`

See [PRODUCTION_DEPLOYMENT_CHECKLIST.md](./docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md) for complete workflow.
