# Changelog

All notable changes to FOSSAPP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.0] - 2025-12-02

### Added
- **Google Drive Integration for Projects**
  - Auto-generated project codes in YYMM-NNN format (e.g., 2512-001)
  - Automatic Google Drive folder creation in HUB Shared Drive when projects are created
  - Standard folder structure: Documentation, Images, Technical, Correspondence
  - Project version management (v1, v2, etc.) with full folder copies
  - Files & Versions tab on project detail page
  - Archive projects with automatic Drive folder management
  - View Drive folder links directly from project detail page
- **Customer Selector** - Required field in project form with searchable dropdown
  - Debounced search (300ms) for performance
  - Shows customer name, code, city, and email in results
- **Back to Projects Button** - Arrow navigation on project detail page
- New components:
  - `CustomerCombobox` - Searchable customer dropdown
  - `ProjectVersionsCard` - Version management UI with Drive links
- New server actions:
  - `createProjectWithDriveAction()` - Creates project + Drive folder atomically
  - `createProjectVersionWithDriveAction()` - Creates new version with folder copy
  - `archiveProjectWithDriveAction()` - Archives project and moves Drive folder
  - `deleteProjectVersionWithDriveAction()` - Removes version and Drive folder
- New service: `GoogleDriveProjectService` for Drive API operations
- Documentation: `docs/PROJECT_MANAGEMENT/` with full implementation guides

### Changed
- Project form now requires customer selection
- Project codes are auto-generated (no manual entry)
- Currency simplified to EUR only (Greek market)
- Budget field shows inline € symbol instead of currency dropdown
- Standardized page padding to `p-6` across all main pages

### Fixed
- Inconsistent padding across Dashboard, Products, Projects, and Customers pages
- Currency dropdown removed (was single EUR option)

## [1.6.0] - 2025-12-01

### Added
- **Project Management System** - Full CRUD for lighting design projects
  - Create, edit, delete projects with detailed information
  - Project status tracking (Draft, Quotation, Approved, In Progress, Completed, etc.)
  - Priority levels (Low, Medium, High, Urgent)
  - Budget and timeline management
  - Team member assignments (PM, Architect, Electrical Engineer, Lighting Designer)
  - Location details with Greek address fields
- Projects list page with pagination and quick actions
- Project detail page with tabbed interface (Overview, Products, Contacts, Documents, Timeline)
- Database schema: `projects.projects` table with comprehensive fields
- Delete confirmation dialogs with project name verification

## [1.5.0] - 2025-11-24

### Added
- **Dynamic Filter System**: 18 filters across 6 groups for advanced product search
  - Source (1): Supplier dropdown
  - Electricals (4): Voltage, Light Source, Dimmable, Protection Class
  - Design (2): IP Rating, Finishing Colour
  - Light (5): Light Distribution, CCT, CRI, Luminous Flux, Beam Angle Type
  - Location (3): Indoor, Outdoor, Submersible (boolean flags)
  - Options (3): Trimless, Round Cut, Rectangular Cut (boolean flags)
- Database-driven filter configuration (`search.filter_definitions` table)
- Real-time facet counts (e.g., "IP65 (234 products)")
- Context-aware filtering prevents "0 results" dead-ends (Delta Light-style UX)
- Active filter badges with individual clear buttons
- URL state persistence for shareable filter links
- New filter components:
  - `BooleanFilter` - Toggle switches for yes/no filters
  - `MultiSelectFilter` - Checkbox lists with product counts
  - `RangeFilter` - Dual sliders with preset buttons (e.g., "Warm White 2700-3000K")
  - `FilterCategory` - Collapsible filter groups
- New API endpoint: `/api/filters/facets` for dynamic facet loading
- New server action: `searchProductsWithFiltersAction()` using `search_products_with_filters` RPC
- Loading skeletons for FilterPanel and product grid
- Empty state messaging when no products match filters
- Implementation guide: `docs/ui/DYNAMIC_FILTERS_IMPLEMENTATION.md`

### Changed
- Products page now uses filter-aware search (`search_products_with_filters` RPC)
- FilterPanel re-enabled (previously disabled due to infinite loop bug)
- Pagination resets to page 1 when filters change
- Product search integrates with all 18 filter types

### Fixed
- Infinite loop bug in FilterPanel (useEffect dependencies now use primitive values)
- Filter state management optimized to prevent unnecessary re-renders
- TypeScript compilation errors in filter components (`ui_config` type definitions)

### Performance
- Search queries with filters: < 200ms
- Facet count updates: < 100ms
- No console errors or React warnings

## [1.4.4] - 2025-11-12

### Fixed
- Fixed Active Catalogs showing incorrect product counts (0 and 1000)
  - Created database function `get_active_catalogs_with_counts()` for efficient server-side aggregation
  - Resolves pagination limit issues in fallback function
- Fixed Most Active Users not displaying analytics data
  - Corrected schema references in `actions.ts` and `event-logger.ts`
  - Created database function `get_most_active_users()` for analytics aggregation
  - Fixed Supabase client schema queries to use `.schema('analytics').from('user_events')`

### Added
- Database migration: `add_catalog_counts_function` - Efficient catalog product counting
- Database migration: `add_most_active_users_function` - User activity aggregation
- Both functions granted to `authenticated` and `service_role` roles

### Changed
- Dashboard now uses RPC functions for better performance and reliability
- Analytics queries now properly reference the analytics schema

## [1.4.3] - 2025-11-11

### Security
- Fixed SQL injection vulnerability in catalog fallback function (`getActiveCatalogsFallback`)
- Replaced raw SQL with parameterized Supabase query builder
- Added automated Gemini security audit system

### Added
- Pre-deployment security audit script (`scripts/pre-deploy-audit.sh`)
- Automated audit scheduling helpers (`scripts/run-gemini-audit.sh`, `scripts/schedule-audit.sh`)
- Comprehensive audit documentation (`audits/AUTOMATION_QUICK_START.md`)
- Quick start guide for audit automation

### Changed
- Updated `.gitignore` to exclude audit reports from repository
- Improved audit README with automation instructions

## [1.4.2] - 2025-11-11

**SECURITY RELEASE**: Critical fixes for authentication and API protection based on Gemini audit recommendations.

### Security
- **CRITICAL**: Fixed NextAuth handler not using secure authOptions (Gemini audit finding)
- **CRITICAL**: Server-side Google Workspace domain validation (prevents unauthorized account access)
- **CRITICAL**: Removed server action import from client bundle (prevents service role key exposure)
- **MEDIUM**: Product catalog API now requires authentication (Gemini audit recommendation)
- Sanitized error logging to prevent PII and credential leaks in logs
- Enhanced environment variable validation with descriptive error messages
- Made ALLOWED_DOMAIN environment variable required (no fallback to prevent config errors)

### Added
- Pre-deployment validation script (`scripts/deploy-check.sh`)
- Playwright smoke tests for critical API endpoints and auth flows (7 tests)
- Type-check npm script for TypeScript validation
- Test scripts (test, test:ci) for automated testing
- ALLOWED_DOMAIN environment variable for workspace restriction
- ALLOWED_DOMAIN to .env.local and .env.production files

### Changed
- **BREAKING**: API endpoints now require authentication (401 for unauthenticated requests)
- Client-side search now uses API endpoint instead of direct server action
- Error logging uses sanitized patterns (message/code only, no full error objects)
- Environment variables validated without TypeScript non-null assertions
- Improved error messages for missing configuration
- Search error handling: returns empty array instead of throwing errors (better UX)
- Auth callback: separate validation for missing email vs unauthorized domain

### Fixed
- **CRITICAL**: NextAuth route handler now uses authOptions from src/lib/auth.ts (was bypassing all domain validation)
- Next.js 16 build compatibility (server actions in client bundles)
- OAuth domain bypass vulnerability (now validated server-side)
- Inconsistent environment variable validation patterns
- Potential token/credential exposure in console logs
- Inconsistent error handling in searchProducts (now returns empty array on error)
- Unclear log messages when email is missing in auth callback

### Technical
- Auth callback validates email domain server-side in addition to OAuth 'hd' parameter
- All error handlers use sanitized logging (message only, no error objects)
- Playwright configuration for smoke testing critical paths
- Deploy-check script validates: type-check, lint, tests, and build
- Created GitHub issue #6 for LOW priority technical debt (race conditions, input validation, user ID logging)
- Gemini LLM security audit completed (GEMINI_AUDIT_20251111.md)
- Comprehensive audit response document (GEMINI_AUDIT_RESPONSE.md)

### Testing
- Health endpoint validation
- Manifest JSON validation
- Login page accessibility
- Protected route authentication checks
- API input validation
- Product search functionality

### Deployment Notes
- **BREAKING CHANGE**: All API endpoints now require authentication
- **IMPORTANT**: Add `ALLOWED_DOMAIN=foss.gr` to production `.env.production`
- Users must be logged in to access product data via API
- Landing page will need adjustment if it calls API endpoints before auth
- Install Playwright browsers: `npx playwright install chromium`
- Run pre-deployment checks: `./scripts/deploy-check.sh`
- Smoke tests require dev server: `npm run test:ci`
- Deployed to production: 2025-11-11 at 18:49 UTC
- Health check confirmed: v1.4.2 live at https://main.fossapp.online
- API authentication verified: Returns 401 for unauthenticated requests

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
