# FOSSAPP - Next-Auth v5 Migration Guide

> **Status:** ⚠️ INDEFINITELY POSTPONED
> **Created:** 2025-11-09
> **Updated:** 2026-01-04
> **Current Version:** next-auth v4.24.11
> **Target Version:** ~~next-auth v5.x (stable)~~ - Never released

---

## ⚠️ Important Update (January 2026)

**NextAuth v5 / Auth.js never reached stable release.** The project has undergone significant changes:

| Event | Date | Impact |
|-------|------|--------|
| Auth.js v5 beta released | 2023 | Remained in beta |
| Main contributor left | January 2025 | Development slowed |
| Auth.js merged into Better Auth | October 2025 | Project direction changed |
| v5 stable release | Never | Still beta as of Jan 2026 |

### Current Recommendation

**Stay on next-auth v4** for the following reasons:

1. **v4 is stable and maintained** - Latest is 4.24.13
2. **FOSSAPP's auth is simple** - Just Google OAuth, no complex features
3. **v5 brings no critical features we need** - Our use case is fully covered by v4
4. **Future is uncertain** - Better Auth is the new direction, but still evolving

### Future Options

If migration becomes necessary, consider:

1. **Better Auth** - Where Auth.js team went (https://better-auth.com)
2. **Clerk** - Fully managed auth service
3. **Lucia Auth** - Lightweight, framework-agnostic
4. **Custom implementation** - Supabase Auth (we already use Supabase)

### References

- [Auth.js joins Better Auth (HN)](https://news.ycombinator.com/item?id=45389293)
- [NextAuth v5 Discussion](https://github.com/nextauthjs/next-auth/discussions/8487)
- [next-auth npm](https://www.npmjs.com/package/next-auth)

---

## Historical Context

The content below was prepared in November 2025 when we expected v5 to stabilize. It is preserved for reference but **should not be implemented**.

---

## Table of Contents
1. [Current State Analysis](#current-state-analysis)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Steps](#migration-steps)
4. [Testing Checklist](#testing-checklist)
5. [Rollback Plan](#rollback-plan)
6. [Known Issues & Solutions](#known-issues--solutions)
7. [Testing Notes](#testing-notes)

---

## Current State Analysis

### Tech Stack (as of 2025-11-09)
- **Next.js:** 16.0.0 ✅
- **React:** 19.1.0 ✅
- **next-auth:** 4.24.11 (v4)
- **TypeScript:** 5.x
- **Database:** Supabase PostgreSQL
- **Products:** 56,456+ items

### Current Auth Implementation

#### Files Using next-auth (8 files)
```
src/lib/auth.ts                          # Auth configuration (v4 pattern)
src/app/api/auth/[...nextauth]/route.ts  # API route handler
src/components/login-form.tsx            # Sign-in component
src/lib/use-dev-session.ts               # Custom session hook
src/app/dashboard/page.tsx               # Protected page
src/app/products/page.tsx                # Protected page
src/app/projects/page.tsx                # Protected page
src/app/page.tsx                         # Main page with auth
```

#### Current Configuration Pattern (v4)
```typescript
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session }) {
      return session
    },
  },
  pages: {
    signIn: '/',
  }
}
```

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

const handler = NextAuth({
  // Configuration duplicated here
})

export { handler as GET, handler as POST }
```

### Authentication Features
- ✅ Google OAuth sign-in
- ✅ JWT token management
- ✅ Access token persistence
- ✅ Custom sign-in page (homepage)
- ✅ Session state in client components
- ✅ No middleware (route protection in components)

### Production Impact Assessment
- **User Base:** Internal Foss SA team (@foss.gr)
- **Critical Pages:** Dashboard, Products, Projects
- **Database:** Read-only for auth (Supabase handles user data)
- **Downtime Risk:** Medium (authentication affects all pages)

---

## Pre-Migration Checklist

### Before Starting

- [ ] **Backup database** (Supabase automated backups enabled?)
- [ ] **Create git branch** for migration work
- [ ] **Notify team** of planned upgrade window
- [ ] **Test current build** ensures it passes
- [ ] **Document current auth flow** with screenshots
- [ ] **List all protected routes** and their auth requirements
- [ ] **Verify environment variables** are documented
- [ ] **Check next-auth v5 stable release** is available
- [ ] **Review breaking changes** in v5 changelog

### Environment Variables Audit
```bash
# Current variables (verify these exist)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# May need to update to v5 naming
AUTH_SECRET=        # Alias for NEXTAUTH_SECRET (v5)
AUTH_URL=           # Alias for NEXTAUTH_URL (v5)
```

---

## Migration Steps

### Phase 1: Preparation (1-2 hours)

#### Step 1.1: Create Migration Branch
```bash
cd /home/sysadmin/nextjs/fossapp
git checkout -b feature/next-auth-v5-migration
git push -u origin feature/next-auth-v5-migration
```

#### Step 1.2: Document Current Behavior
```bash
# Test and document current auth flow
npm run dev
# Test:
# 1. Sign in flow
# 2. Sign out flow
# 3. Protected route access
# 4. Session persistence
# 5. Token refresh (if applicable)
```

#### Step 1.3: Verify Build
```bash
npm run build
# Should build successfully with current setup
```

### Phase 2: Code Migration (2-3 hours)

#### Step 2.1: Upgrade next-auth
```bash
npm install next-auth@beta  # or next-auth@latest when stable
```

#### Step 2.2: Create New Auth Configuration

**Create: `auth.ts` (root level)**
```typescript
import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      // v5: token is passed to session callback
      return session
    },
  },
  pages: {
    signIn: "/",
  },
})
```

#### Step 2.3: Update API Route Handler

**Update: `src/app/api/auth/[...nextauth]/route.ts`**
```typescript
import { handlers } from "@/auth"  // Import from root auth.ts

export const { GET, POST } = handlers
```

#### Step 2.4: Update Client Components

**Pattern Change:**
```typescript
// OLD (v4)
import { useSession, signIn, signOut } from 'next-auth/react'

// NEW (v5) - same imports work!
import { useSession, signIn, signOut } from 'next-auth/react'
// No changes needed in most cases
```

#### Step 2.5: Update Server Components

**Pattern Change:**
```typescript
// OLD (v4) - may not have been used
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
const session = await getServerSession(authOptions)

// NEW (v5)
import { auth } from '@/auth'
const session = await auth()
```

#### Step 2.6: Update TypeScript Types

**Update: `src/types/next-auth.d.ts` (if exists)**
```typescript
import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
  }
}
```

#### Step 2.7: Remove Old Auth Configuration

**Delete or archive:**
- `src/lib/auth.ts` (replaced by root `auth.ts`)

**Update imports in remaining files:**
```bash
# Find all imports of old auth config
grep -r "from '@/lib/auth'" src/
grep -r "from '../lib/auth'" src/

# Replace with new import from root auth.ts
# from '@/lib/auth' → from '@/auth'
```

### Phase 3: Testing (1-2 hours)

#### Step 3.1: Development Testing
```bash
npm run dev

# Test all auth flows:
✓ 1. Fresh sign-in from homepage
✓ 2. Sign-out from dashboard
✓ 3. Sign-out from products page
✓ 4. Sign-out from projects page
✓ 5. Session persistence (refresh page)
✓ 6. Protected route access (direct URL)
✓ 7. Redirect after sign-in
✓ 8. Multiple browser tabs
✓ 9. Private/incognito mode
✓ 10. Access token availability
```

#### Step 3.2: Build Testing
```bash
npm run build
npm start

# Test production build:
✓ 1. All auth flows work in production mode
✓ 2. No console errors
✓ 3. Session cookies work correctly
✓ 4. Performance is acceptable
```

#### Step 3.3: Database Impact
```bash
# Verify:
✓ 1. No new database tables needed
✓ 2. Existing sessions still work (if using database sessions)
✓ 3. User records unchanged
```

### Phase 4: Deployment (30 min - 1 hour)

#### Step 4.1: Staging Deployment (if available)
```bash
# Deploy to staging
# Test thoroughly
# Get team approval
```

#### Step 4.2: Production Deployment
```bash
# Merge to main
git checkout main
git merge feature/next-auth-v5-migration
git push origin main

# Deploy via Docker or Vercel
# Monitor logs closely
```

#### Step 4.3: Monitoring
```bash
# Watch for:
- Authentication failures
- Session errors
- Console warnings
- User complaints

# Check logs:
docker-compose logs -f fossapp
```

---

## Testing Checklist

### Functional Testing

#### Authentication Flow
- [ ] Sign in with Google OAuth works
- [ ] Sign out works from all pages
- [ ] Session persists across page refreshes
- [ ] Session expires after timeout
- [ ] Redirect to sign-in when accessing protected route while logged out
- [ ] Redirect to original page after sign-in
- [ ] Sign-in page shows correctly
- [ ] Error page shows for auth errors

#### Protected Routes
- [ ] `/dashboard` requires authentication
- [ ] `/products` requires authentication
- [ ] `/projects` requires authentication
- [ ] `/api/products/*` endpoints work with session
- [ ] `/api/supabase/query` works with session

#### Session Management
- [ ] `useSession()` returns correct session data
- [ ] Session data includes user email
- [ ] Session data includes access token (if needed)
- [ ] Session updates when user signs in/out
- [ ] Multiple tabs sync session state

#### Edge Cases
- [ ] Sign in with invalid credentials shows error
- [ ] Network timeout during sign-in handled gracefully
- [ ] Expired session redirects to sign-in
- [ ] Concurrent sign-in/sign-out handled correctly
- [ ] Session works in private/incognito mode

### Performance Testing
- [ ] Sign-in completes in < 3 seconds
- [ ] Page load time not significantly impacted
- [ ] No memory leaks in session management
- [ ] Build time is acceptable (< 10 minutes)

### Security Testing
- [ ] Session cookies are httpOnly
- [ ] Session cookies are secure (HTTPS only in production)
- [ ] CSRF protection is enabled
- [ ] OAuth state parameter is validated
- [ ] No sensitive data in client-side session

---

## Rollback Plan

### If Migration Fails

#### Immediate Rollback (< 5 minutes)
```bash
# 1. Switch back to main branch
git checkout main

# 2. Rebuild and restart
npm run build
docker-compose restart fossapp

# 3. Verify auth works
curl https://app.titancnc.eu/api/health
```

#### Partial Rollback (if some issues)
```bash
# 1. Revert specific files
git checkout main -- src/app/api/auth/[...nextauth]/route.ts

# 2. Keep other changes
git add .
git commit -m "Partial rollback: revert auth handler"
```

#### Database Rollback (if needed)
```bash
# Supabase: Use point-in-time recovery
# Contact Supabase support or use dashboard
```

### Rollback Decision Criteria
- Authentication failures > 10%
- Critical pages inaccessible
- Database corruption
- Performance degradation > 50%
- Security vulnerability discovered

---

## Known Issues & Solutions

### Issue 1: Middleware Deprecation Warning

**Symptom:**
```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

**Cause:** next-auth v5 beta doesn't support Next.js 16's proxy.ts yet

**Solution:**
- Keep using `middleware.ts` for now (works fine)
- Or don't use middleware at all (FOSSAPP doesn't currently use it)
- Wait for next-auth v5 stable release

**Impact:** Low - just a warning

---

### Issue 2: Type Errors After Upgrade

**Symptom:**
```typescript
Type 'NextAuthOptions' does not exist in 'next-auth'
```

**Cause:** v5 removed `NextAuthOptions` type

**Solution:**
```typescript
// Remove this import
import { NextAuthOptions } from 'next-auth'

// Use inline configuration or separate file
```

**Impact:** Medium - requires code changes

---

### Issue 3: Session Callback Signature Change

**Symptom:**
```typescript
Property 'token' does not exist on type 'SessionCallbackParams'
```

**Cause:** v5 passes token to session callback

**Solution:**
```typescript
// v4
async session({ session }) {
  return session
}

// v5
async session({ session, token }) {
  // Can now access token here
  return session
}
```

**Impact:** Low - easy fix

---

### Issue 4: Environment Variable Names

**Symptom:** Auth not working after upgrade

**Cause:** v5 prefers AUTH_* over NEXTAUTH_*

**Solution:**
```bash
# Option 1: Rename variables
NEXTAUTH_SECRET → AUTH_SECRET
NEXTAUTH_URL → AUTH_URL

# Option 2: Keep both (aliases work)
# Both naming conventions work in v5
```

**Impact:** Low - aliases supported

---

### Issue 5: Import Path Changes

**Symptom:**
```typescript
Module not found: Can't resolve '@/lib/auth'
```

**Cause:** Auth config moved to root

**Solution:**
```typescript
// Update all imports
import { auth } from '@/auth'  // new location
```

**Impact:** Medium - requires global find/replace

---

## Testing Notes

> **Instructions:** Add notes here during testing phase. Document any unexpected behavior, performance issues, or edge cases discovered.

### Test Session 1: [DATE]
**Tester:** [NAME]
**Environment:** Development / Staging / Production
**Duration:** [TIME]

**Tests Performed:**
- [ ] Test 1: Description
  - Result: Pass/Fail
  - Notes:

**Issues Found:**
1. Issue description
   - Severity: Critical/High/Medium/Low
   - Workaround:
   - Resolution:

---

### Test Session 2: [DATE]
**Tester:** [NAME]
**Environment:** Development / Staging / Production
**Duration:** [TIME]

**Tests Performed:**
- [ ] Test 1: Description
  - Result: Pass/Fail
  - Notes:

**Issues Found:**
1. Issue description
   - Severity: Critical/High/Medium/Low
   - Workaround:
   - Resolution:

---

### Performance Benchmarks

#### Before Migration (v4)
```
Sign-in time: _____ ms
Build time: _____ seconds
Bundle size: _____ KB
Memory usage: _____ MB
```

#### After Migration (v5)
```
Sign-in time: _____ ms
Build time: _____ seconds
Bundle size: _____ KB
Memory usage: _____ MB
```

**Performance Impact:** [Positive/Negative/Neutral]
**Notes:**

---

### User Feedback

#### Feedback 1: [DATE]
**User:** [NAME/EMAIL]
**Issue:** Description
**Severity:** Critical/High/Medium/Low
**Status:** Open/Resolved
**Resolution:**

---

### Production Monitoring

#### Week 1 Post-Migration
**Auth Success Rate:** ____%
**Error Rate:** ____%
**Average Response Time:** _____ ms
**Issues Reported:** _____

**Notes:**

---

## Additional Resources

### Documentation
- [next-auth v5 Migration Guide](https://authjs.dev/getting-started/migrating-to-v5)
- [Next.js 16 Upgrade Guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [FOSSAPP GitHub Issues](#) (if applicable)

### Similar Migrations
- [gdrive-sync migration](../gdrive-sync/NEXTAUTH_V5_SETUP.md) - Reference implementation
- gdrive-sync commit: `a65b0ca` - Example of successful migration

### Team Contacts
- **Developer:** Dimitri
- **Backup:** [NAME]
- **Supabase Admin:** [EMAIL]

### Support
- next-auth Discord: [Link]
- GitHub Issues: https://github.com/nextauthjs/next-auth/issues
- Stack Overflow: tag `next-auth`

---

## Decision Log

### Decision 1: When to Migrate
**Date:** 2025-11-09
**Decision:** POSTPONED - Wait for next-auth v5 stable release
**Reasoning:**
- next-auth v5.0.0-beta.30 hasn't been updated for Next.js 16 proxy.ts
- Current v4 setup works fine with Next.js 16
- No critical bugs or security issues with v4
- Low risk tolerance for production app

**Next Review:** When next-auth v5 stable is released

---

### Decision 2: Migration Indefinitely Postponed
**Date:** 2026-01-04
**Decision:** INDEFINITELY POSTPONED - Do not migrate to Auth.js v5
**Reasoning:**
- Auth.js v5 never reached stable release (still beta after 2+ years)
- Main Auth.js contributor left the project in January 2025
- Auth.js team merged into Better Auth project (October 2025)
- Current v4 setup works perfectly for our simple Google OAuth use case
- No security vulnerabilities or critical bugs in v4
- Migration effort not justified given uncertainty in Auth.js future

**Alternative paths if migration ever needed:**
1. Better Auth (where Auth.js team went)
2. Supabase Auth (we already use Supabase)
3. Clerk (managed service)

**Next Review:** Only if security issue found in v4 or v4 becomes unmaintained

---

## Changelog

### 2025-11-09
- Document created
- Current state analysis completed
- Migration steps drafted
- Testing checklist defined

### 2026-01-04
- Status changed to INDEFINITELY POSTPONED
- Added context about Auth.js v5 never stabilizing
- Added information about Auth.js merging into Better Auth
- Added alternative auth solutions section
- Migration guide preserved for historical reference only

---

**Document Owner:** Dimitri
**Last Updated:** 2026-01-04
**Next Review:** Only if v4 becomes unmaintained or security issue discovered
