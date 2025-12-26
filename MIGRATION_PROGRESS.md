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
- [ ] Phase 1: Extract @fossapp/core ← **NEXT**
- [ ] Phase 2: Extract @fossapp/ui
- [ ] Phase 3: Extract domain packages
- [ ] Phase 4: Update deployment
- [ ] Phase 5: E2E tests
- [ ] Phase 6: Production deployment

### Last Session Summary

**Date**: 2025-12-26
**Completed**:
- Installed Turborepo (`turbo@2.7.2`)
- Created `turbo.json` with build/dev/lint/test tasks
- Added npm workspaces (`packages/*`)
- Created `@fossapp/core` skeleton package
- Added `packageManager` field to package.json
- Moved example files to `docs/monorepo-examples/`
- Added `dynamic = 'force-dynamic'` to planner page
- Verified dev server works (HTTP 200)
- Verified turbo recognizes workspace

**Next Steps**:
1. Confirm Playwright tests pass
2. Create `monorepo-phase-0` checkpoint tag
3. Start Phase 1: Extract core utilities to @fossapp/core

**Blockers**:
- Pre-existing Next.js 16 build issue (not from monorepo changes)

---

## Checkpoint Tags

| Tag | Description | Date |
|-----|-------------|------|
| `pre-monorepo-refactor` | Clean v1.12.3 before any changes | 2025-12-26 |
| `monorepo-phase-0` | Turbo setup + Playwright tests | 2025-12-26 |
| `monorepo-phase-1` | _TBD - After @fossapp/core_ | |
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

**Files Created**:
- `turbo.json`
- `packages/core/package.json`
- `packages/core/src/index.ts`
- `packages/core/tsconfig.json`
- `docs/monorepo-examples/` (moved example files)

**Files Modified**:
- `package.json` (added workspaces, packageManager, turbo scripts)
- `src/app/planner/page.tsx` (added dynamic export for Next.js 16)
- `CLAUDE.md` (added migration notice)

**Next Session Should**:
1. Read this file first
2. Run Playwright tests to verify baseline
3. Create `monorepo-phase-0` tag
4. Start Phase 1: Extract utilities to @fossapp/core

---

## Files Changed Tracker

_Track which files have been moved/modified for easy debugging_

### Moved to @fossapp/core
- [ ] `src/lib/supabase-server.ts` → `packages/core/src/db/server.ts`
- [ ] `src/lib/supabase.ts` → `packages/core/src/db/client.ts`
- [ ] `src/lib/auth.ts` → `packages/core/src/auth/index.ts`
- [ ] `src/lib/ratelimit.ts` → `packages/core/src/ratelimit/index.ts`
- [ ] `src/lib/utils.ts` → `packages/core/src/utils/index.ts`
- [ ] `src/lib/event-logger.ts` → `packages/core/src/logging/server.ts`

### Moved to @fossapp/ui
- [ ] `src/components/ui/*` → `packages/ui/src/components/*`
- [ ] `src/hooks/use-mobile.tsx` → `packages/ui/src/hooks/`
- [ ] `src/components/theme-provider.tsx` → `packages/ui/src/theme/`

### Import Updates Required
_List files that need import path updates after each extraction_

---

## Known Issues / Blockers

_Document any issues encountered for future sessions_

1. **Pre-existing Next.js 16 build issue**: `npm run build` fails with Suspense/useSearchParams errors on `/planner` and auth routes. This exists on main branch too - not caused by monorepo. Production deploys work via Docker. Dev server works fine.

2. **Playwright tests**: If tests hang, run in separate console with `npm run test:e2e:headed` to see what's happening.

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
```

---

## Architecture Decisions Log

_Document key decisions for future reference_

| Decision | Rationale | Date |
|----------|-----------|------|
| Use Turborepo (not Nx) | Simpler, official Vercel support | 2025-12-26 |
| Extract core first | Foundation for all other packages | 2025-12-26 |
| Keep env vars at root | Single source of secrets | 2025-12-26 |

---

**Last Updated**: 2025-12-26 by Claude Code
