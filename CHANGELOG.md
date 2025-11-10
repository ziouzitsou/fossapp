# Changelog

All notable changes to FOSSAPP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
