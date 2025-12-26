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
- [ ] Phase 2: Extract @fossapp/ui ← **NEXT**
- [ ] Phase 3: Extract domain packages
- [ ] Phase 4: Update deployment
- [ ] Phase 5: E2E tests
- [ ] Phase 6: Production deployment

### Last Session Summary

**Date**: 2025-12-26
**Completed**:
- Extracted @fossapp/core package with:
  - `db/server.ts` - Supabase server client (service role)
  - `db/client.ts` - Supabase client (anon key)
  - `logging/server.ts` - Server-side event logging
  - `logging/client.ts` - Client-side event logging
  - `logging/types.ts` - Shared types (EventType, EventData)
  - `ratelimit/index.ts` - Rate limiting utilities
- Updated 30+ files to import from @fossapp/core
- Original src/lib files now re-export from @fossapp/core (backward compatibility)
- Verified 18 Playwright tests pass
- Created checkpoint tag `monorepo-phase-1`

**Key Learning**:
- Client components must import from explicit client paths (`@fossapp/core/logging/client`)
- Barrel exports that include server modules cause issues when imported in client components

**Next Steps**:
1. Phase 2: Extract @fossapp/ui
   - Move `src/components/ui/*` → `packages/ui/src/components/*`
   - Move `src/lib/utils.ts` (cn function) → `packages/ui/src/utils/`
   - Move `src/hooks/use-mobile.tsx` → `packages/ui/src/hooks/`
   - Move `src/components/theme-provider.tsx` → `packages/ui/src/theme/`

**Blockers**:
- None for Phase 2

---

## Checkpoint Tags

| Tag | Description | Date |
|-----|-------------|------|
| `pre-monorepo-refactor` | Clean v1.12.3 before any changes | 2025-12-26 |
| `monorepo-phase-0` | Turbo setup + Playwright tests | 2025-12-26 |
| `monorepo-phase-1` | @fossapp/core extracted, 18 tests passing | 2025-12-26 |
| `monorepo-phase-2` | _TBD - After @fossapp/ui_ | |

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

### Moved to @fossapp/ui (Phase 2)
- [ ] `src/components/ui/*` → `packages/ui/src/components/*`
- [ ] `src/lib/utils.ts` → `packages/ui/src/utils/cn.ts`
- [ ] `src/hooks/use-mobile.tsx` → `packages/ui/src/hooks/`
- [ ] `src/components/theme-provider.tsx` → `packages/ui/src/theme/`

### Import Updates Required
_List files that need import path updates after each extraction_

**Phase 1 Complete** - 30+ files updated to use @fossapp/core

---

## Known Issues / Blockers

_Document any issues encountered for future sessions_

1. **Pre-existing Next.js 16 build issue**: `npm run build` fails with Suspense/useSearchParams errors on `/planner` and auth routes. This exists on main branch too - not caused by monorepo. Production deploys work via Docker. Dev server works fine.

2. **Playwright tests**: If tests hang, run in separate console with `npm run test:e2e:headed` to see what's happening.

3. **Server/Client boundary**: When extracting modules, be careful with barrel exports. Client components cannot import modules that reference server-only code. Use explicit subpath imports like `@fossapp/core/logging/client` instead of `@fossapp/core/logging`.

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

---

**Last Updated**: 2025-12-26 by Claude Code
