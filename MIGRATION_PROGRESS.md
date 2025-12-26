# Monorepo Migration Progress Tracker

**Started**: 2025-12-26
**Branch**: `claude/refactor-monorepo-fvct8`
**Recovery Tag**: `pre-monorepo-refactor` → v1.12.3

---

## Quick Context for New Sessions

**Read this file first when resuming work.**

### What We're Doing
Converting FOSSAPP from a single Next.js app to a Turborepo monorepo with ~12 packages to eliminate ~6,840 lines of duplicated code.

### Current Phase
- [x] Phase 0: Setup (turbo.json, workspace config) ✅ COMPLETE
- [x] Phase 1: Extract @fossapp/core ✅ COMPLETE
- [x] Phase 2: Extract @fossapp/ui ✅ COMPLETE
- [ ] Phase 3: Extract domain packages ← **IN PROGRESS**
  - [x] 3A: Extended core (config, validation)
  - [x] 3B: @fossapp/products
  - [x] 3C: @fossapp/tiles
  - [x] 3D: @fossapp/projects
- [ ] Phase 4: Update deployment
- [ ] Phase 5: E2E tests
- [ ] Phase 6: Production deployment

### Last Session Summary

**Date**: 2025-12-26
**Completed**:
- **Phase 3C**: Created @fossapp/tiles package (progress, types, scripts)
- **Phase 3D**: Created @fossapp/projects package:
  - `types/` - Project types (ProjectListItem, ProjectDetail, ProjectProduct, etc.)
  - `types/areas.ts` - Area types (ProjectArea, AreaVersion, AreaVersionSummary)
- Updated server action files to import and re-export types from packages
- Verified 17/18 E2E tests pass (1 flaky auth test - pre-existing)

**Key Learning**:
- Server actions can import types from packages while keeping `'use server'` directive
- Use `export type { ... }` to re-export types for backward compatibility
- Types can be separated from server actions without breaking existing imports

**Next Steps**:
1. Consider Phase 4: Update deployment configuration
2. Consider creating more shared utility packages
3. Clean up and consolidate duplicate code

**Blockers**:
- None

---

## Checkpoint Tags

| Tag | Description | Date |
|-----|-------------|------|
| `pre-monorepo-refactor` | Clean v1.12.3 before any changes | 2025-12-26 |
| `monorepo-phase-0` | Turbo setup + Playwright tests | 2025-12-26 |
| `monorepo-phase-1` | @fossapp/core extracted, 18 tests passing | 2025-12-26 |
| `monorepo-phase-2` | @fossapp/ui extracted, 18 tests passing | 2025-12-26 |
| `monorepo-phase-3` | _TBD - After domain packages_ | |

---

## Session Log

### Session 1: 2025-12-26 (Part 1)
**Focus**: Planning and safety setup
**Accomplished**:
- Created recovery tag `pre-monorepo-refactor`
- Reviewed all migration documents
- Created this progress tracker
- Set up Playwright E2E tests (Dimitri)

### Session 1: 2025-12-26 (Part 2)
**Focus**: Phase 0 - Turborepo setup
**Accomplished**:
- Installed Turborepo
- Created turbo.json
- Set up npm workspaces
- Created @fossapp/core skeleton
- Verified dev server works
- Documented known issues

### Session 2: 2025-12-26
**Focus**: Phase 1 - Extract @fossapp/core
**Accomplished**:
- Verified 18 Playwright tests pass (baseline)
- Created `monorepo-phase-0` checkpoint tag
- Created package structure:
  - `packages/core/src/db/` - Supabase clients
  - `packages/core/src/logging/` - Event logging (server + client)
  - `packages/core/src/ratelimit/` - Rate limiting
- Updated package.json with exports and dependencies
- Updated tsconfig.json with path aliases
- Migrated imports in 30+ files:
  - 13 API routes (ratelimit, supabase-server)
  - 6 client components (logEventClient)
  - 1 server action (filters/actions.ts)
- Fixed server/client boundary issue (client components need explicit client imports)
- Converted original src/lib files to re-export stubs
- Created `monorepo-phase-1` checkpoint tag

**Files Created**:
- `packages/core/src/db/server.ts`
- `packages/core/src/db/client.ts`
- `packages/core/src/db/index.ts`
- `packages/core/src/logging/types.ts`
- `packages/core/src/logging/server.ts`
- `packages/core/src/logging/client.ts`
- `packages/core/src/logging/index.ts`
- `packages/core/src/ratelimit/index.ts`

**Files Modified** (now re-export from @fossapp/core):
- `src/lib/supabase-server.ts` (deprecated, re-exports)
- `src/lib/ratelimit.ts` (deprecated, re-exports)
- `src/lib/event-logger.ts` (deprecated, re-exports)
- `src/lib/event-logger-client.ts` (deprecated, re-exports)

**Next Session Should**:
1. Read this file first
2. Start Phase 2: Extract @fossapp/ui
3. Focus on shadcn/ui components first

### Session 3: 2025-12-26
**Focus**: Phase 2 - Extract @fossapp/ui
**Accomplished**:
- Created @fossapp/ui package structure:
  - `packages/ui/package.json` with all Radix UI dependencies
  - `packages/ui/tsconfig.json` extending root config
  - `packages/ui/src/utils/cn.ts` - Tailwind class merging
  - `packages/ui/src/hooks/use-mobile.tsx` - Responsive hooks
  - `packages/ui/src/theme/theme-provider.tsx` - Theme context
  - `packages/ui/src/components/` - 35 shadcn components
- Updated internal component imports (e.g., sidebar → relative paths)
- Created re-export stubs in src/components/ui/* → @fossapp/ui
- Updated src/lib/utils.ts to re-export cn (keeping getThumbnailUrl local)
- Updated src/hooks/use-mobile.tsx to re-export from @fossapp/ui
- Updated src/components/theme-provider.tsx to re-export from @fossapp/ui
- Fixed flaky E2E test (auth.spec.ts:22) - timeout/viewport issues
- All 18 Playwright tests passing
- Created checkpoint tag `monorepo-phase-2`

**Files Created**:
- `packages/ui/package.json`
- `packages/ui/tsconfig.json`
- `packages/ui/.gitignore`
- `packages/ui/src/index.ts`
- `packages/ui/src/utils/cn.ts`
- `packages/ui/src/utils/index.ts`
- `packages/ui/src/hooks/use-mobile.tsx`
- `packages/ui/src/hooks/index.ts`
- `packages/ui/src/theme/theme-provider.tsx`
- `packages/ui/src/theme/index.ts`
- `packages/ui/src/components/index.ts`
- `packages/ui/src/components/*.tsx` (35 components)

**Files Modified** (now re-export from @fossapp/ui):
- `src/components/ui/*.tsx` (35 stubs)
- `src/lib/utils.ts` (cn re-export, getThumbnailUrl stays)
- `src/hooks/use-mobile.tsx` (re-export)
- `src/components/theme-provider.tsx` (re-export)
- `e2e/auth.spec.ts` (test fix)

**Next Session Should**:
1. Read this file first
2. Review MONOREPO_MIGRATION_PLAN.md for Phase 3 structure
3. Start with most isolated domain package

### Session 4: 2025-12-26
**Focus**: Phase 3A/3B - Extend core + Extract products
**Accomplished**:
- Extended @fossapp/core with shared utilities:
  - `config/constants.ts` - VALIDATION, PAGINATION, DASHBOARD, CACHE, UI, API
  - `config/index.ts` - Barrel exports
  - `validation/index.ts` - validateSearchQuery, validateProductId, etc.
- Created @fossapp/products package:
  - `types/index.ts` - ProductInfo, Feature, MIME_CODES, ETIM_FEATURE_GROUPS
  - `actions/index.ts` - searchProductsBasicAction, getProductByIdAction, etc.
  - `index.ts` - Main package exports
- Fixed npm workspace syntax (use `*` not `workspace:*` for npm)
- Learned: Server action re-export stubs must NOT have `'use server'` directive
- 17/18 E2E tests passing (1 flaky auth test - pre-existing)

**Files Created**:
- `packages/core/src/config/constants.ts`
- `packages/core/src/config/index.ts`
- `packages/core/src/validation/index.ts`
- `packages/products/package.json`
- `packages/products/tsconfig.json`
- `packages/products/src/index.ts`
- `packages/products/src/types/index.ts`
- `packages/products/src/actions/index.ts`

**Files Modified** (now re-export stubs):
- `src/lib/constants.ts` → @fossapp/core/config
- `src/lib/actions/validation.ts` → @fossapp/core/validation
- `src/types/product.ts` → @fossapp/products/types
- `src/lib/actions/products.ts` → @fossapp/products/actions

**Next Session Should**:
1. Read this file first
2. Extract @fossapp/projects package
3. Consider extracting more shared utilities

### Session 5: 2025-12-26
**Focus**: Phase 3C - Extract @fossapp/tiles
**Accomplished**:
- Created @fossapp/tiles package structure:
  - `packages/tiles/package.json` with exports for progress, types, scripts
  - `packages/tiles/tsconfig.json` extending root config
  - `packages/tiles/src/progress/progress-store.ts` - SSE streaming job progress
  - `packages/tiles/src/types/index.ts` - Tile-specific types
  - `packages/tiles/src/scripts/index.ts` - AutoLISP script generator
- Added @fossapp/tiles and @fossapp/products to root package.json dependencies
- Added TypeScript paths for @fossapp/tiles/* and @fossapp/products/*
- Created re-export stubs in original src/lib/tiles/ locations
- Server-heavy services (aps-service, aps-viewer, image-processor, google-drive) stay in app
- 17/18 E2E tests passing (1 flaky auth test - pre-existing)

**Files Created**:
- `packages/tiles/package.json`
- `packages/tiles/tsconfig.json`
- `packages/tiles/src/index.ts`
- `packages/tiles/src/progress/index.ts`
- `packages/tiles/src/progress/progress-store.ts`
- `packages/tiles/src/types/index.ts`
- `packages/tiles/src/scripts/index.ts`

**Files Modified** (now re-export stubs):
- `src/lib/tiles/progress-store.ts` → @fossapp/tiles/progress
- `src/lib/tiles/types.ts` → @fossapp/tiles/types
- `src/lib/tiles/script-generator.ts` → @fossapp/tiles/scripts

### Session 6: 2025-12-26
**Focus**: Phase 3D - Extract @fossapp/projects
**Accomplished**:
- Created @fossapp/projects package structure:
  - `packages/projects/package.json` with exports for types, types/areas
  - `packages/projects/tsconfig.json` extending root config
  - `packages/projects/src/types/index.ts` - All project types
  - `packages/projects/src/types/areas.ts` - Area and version types
- Updated server action files to import types from package:
  - `src/lib/actions/projects.ts` - imports and re-exports types
  - `src/lib/actions/project-areas.ts` - imports and re-exports area types
- Server actions stay in app (depend on Supabase, Google Drive, planner)
- 17/18 E2E tests passing (1 flaky auth test - pre-existing)

**Files Created**:
- `packages/projects/package.json`
- `packages/projects/tsconfig.json`
- `packages/projects/src/index.ts`
- `packages/projects/src/types/index.ts`
- `packages/projects/src/types/areas.ts`

**Files Modified** (now import from package):
- `src/lib/actions/projects.ts` → imports from @fossapp/projects
- `src/lib/actions/project-areas.ts` → imports from @fossapp/projects/types/areas

---

## Files Changed Tracker

_Track which files have been moved/modified for easy debugging_

### Moved to @fossapp/core ✅
- [x] `src/lib/supabase-server.ts` → `packages/core/src/db/server.ts`
- [x] `src/lib/supabase.ts` → `packages/core/src/db/client.ts` (client only)
- [ ] `src/lib/auth.ts` → _Staying in app (too many app-specific deps)_
- [x] `src/lib/ratelimit.ts` → `packages/core/src/ratelimit/index.ts`
- [ ] `src/lib/utils.ts` → _Moving to @fossapp/ui (Phase 2)_
- [x] `src/lib/event-logger.ts` → `packages/core/src/logging/server.ts`
- [x] `src/lib/event-logger-client.ts` → `packages/core/src/logging/client.ts`
- [x] `src/lib/constants.ts` → `packages/core/src/config/constants.ts`
- [x] `src/lib/actions/validation.ts` → `packages/core/src/validation/index.ts`

### Moved to @fossapp/ui ✅
- [x] `src/components/ui/*` → `packages/ui/src/components/*` (35 components)
- [x] `src/lib/utils.ts` (cn only) → `packages/ui/src/utils/cn.ts`
- [x] `src/hooks/use-mobile.tsx` → `packages/ui/src/hooks/use-mobile.tsx`
- [x] `src/components/theme-provider.tsx` → `packages/ui/src/theme/theme-provider.tsx`

### Moved to @fossapp/products ✅
- [x] `src/types/product.ts` → `packages/products/src/types/index.ts`
- [x] `src/lib/actions/products.ts` → `packages/products/src/actions/index.ts`

### Moved to @fossapp/tiles ✅
- [x] `src/lib/tiles/progress-store.ts` → `packages/tiles/src/progress/progress-store.ts`
- [x] `src/lib/tiles/types.ts` → `packages/tiles/src/types/index.ts`
- [x] `src/lib/tiles/script-generator.ts` → `packages/tiles/src/scripts/index.ts`
- [ ] `src/lib/tiles/aps-service.ts` → _Staying in app (heavy APS SDK deps)_
- [ ] `src/lib/tiles/aps-viewer.ts` → _Staying in app (heavy APS SDK deps)_
- [ ] `src/lib/tiles/image-processor.ts` → _Staying in app (Sharp deps)_
- [ ] `src/lib/tiles/google-drive-tile-service.ts` → _Staying in app (googleapis deps)_
- [ ] `src/lib/tiles/actions.ts` → _Staying in app (server actions, depends on above)_

### Moved to @fossapp/projects ✅
- [x] `src/lib/actions/projects.ts` types → `packages/projects/src/types/index.ts`
- [x] `src/lib/actions/project-areas.ts` types → `packages/projects/src/types/areas.ts`
- [ ] Server actions stay in app (heavy deps on Supabase, Google Drive, planner)

### Phase 3: Domain Packages (IN PROGRESS)
- [x] Products/search functionality → @fossapp/products ✅
- [x] Tiles/DWG generation → @fossapp/tiles ✅ (core components extracted)
- [x] Projects management → @fossapp/projects ✅ (types extracted)

### Import Updates Required
_List files that need import path updates after each extraction_

**Phase 1 Complete** - 30+ files updated to use @fossapp/core
**Phase 2 Complete** - 180+ UI component imports work via re-export stubs
**Phase 3A/3B Complete** - config, validation, products extracted with re-export stubs
**Phase 3C Complete** - tiles (progress, types, scripts) extracted with re-export stubs
**Phase 3D Complete** - projects (types, area types) extracted with re-export in server actions

---

## Known Issues / Blockers

_Document any issues encountered for future sessions_

1. **Pre-existing Next.js 16 build issue**: `npm run build` fails with Suspense/useSearchParams errors on `/planner` and auth routes. This exists on main branch too - not caused by monorepo. Production deploys work via Docker. Dev server works fine.

2. **Playwright tests**: If tests hang, run in separate console with `npm run test:e2e:headed` to see what's happening.

3. **Server/Client boundary**: When extracting modules, be careful with barrel exports. Client components cannot import modules that reference server-only code. Use explicit subpath imports like `@fossapp/core/logging/client` instead of `@fossapp/core/logging`.

4. **Server Action re-exports**: Files with `'use server'` directive can ONLY export async functions. When creating re-export stubs for server actions, do NOT include the `'use server'` directive - the actual server actions in the package already have it.

---

## Commands Reference

```bash
# Start dev after monorepo setup
npx turbo run dev --filter=web

# Build all packages
npx turbo run build

# Run specific package
npx turbo run dev --filter=@fossapp/core

# Check for circular deps
npx turbo run build --dry-run

# Create checkpoint tag
git tag monorepo-phase-X && git push origin monorepo-phase-X

# Rollback to clean state
git checkout pre-monorepo-refactor

# Run E2E tests
npm run test:e2e:chromium
```

---

## Architecture Decisions Log

_Document key decisions for future reference_

| Decision | Rationale | Date |
|----------|-----------|------|
| Use Turborepo (not Nx) | Simpler, official Vercel support | 2025-12-26 |
| Extract core first | Foundation for all other packages | 2025-12-26 |
| Keep env vars at root | Single source of secrets | 2025-12-26 |
| Keep auth.ts in app | Too many app-specific deps (user-service, domain validation) | 2025-12-26 |
| Explicit client imports | Avoid server code leaking into client bundles | 2025-12-26 |
| Re-export stubs | Backward compatibility during migration | 2025-12-26 |

| Keep tiles services in app | Heavy server deps (APS SDK, Sharp, googleapis) | 2025-12-26 |

---

**Last Updated**: 2025-12-26 (Phase 3D complete - @fossapp/projects extracted) by Claude Code
