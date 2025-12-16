# Production Deployment Checklist

**Last Updated**: 2025-12-16
**Current Version**: v1.9.7

This checklist was created after the v1.1.4 deployment to prevent common issues.
**Updated v1.4.1**: Added automated pre-deployment script with smoke tests.

> **Note**: For version history and release notes, see [CHANGELOG.md](../CHANGELOG.md)

---

## ⚠️ Critical: Pre-Deployment Checks

### 1. Run Automated Pre-Deployment Script (MANDATORY)
```bash
# ALWAYS run this BEFORE committing/pushing
./scripts/deploy-check.sh
```

**What it does**:
- ✓ TypeScript type checking (`npm run type-check`)
- ✓ ESLint validation (`npm run lint`)
- ✓ Playwright smoke tests (7 critical path tests)
- ✓ Production build test (`npm run build`)

**Why?** Production builds are stricter than dev mode:
- ESLint runs with `--strict` mode
- TypeScript type checking is enforced
- All warnings become errors
- Missing dependencies are caught
- Critical functionality is verified

**Lessons from v1.1.4**:
- Dev server didn't catch unused `theme` variable → Production build failed
- Dev server didn't catch missing `supplier_logo_dark` in interface → Production build failed
- Dev server allowed React hooks warnings → Production build failed

**New in v1.4.1+**:
- Smoke tests catch broken auth flows before deployment
- Type-check catches TypeScript errors early
- Script exits on first failure (fail-fast)

### 2. Fix All Errors Reported by Script

Common issues to check:
```typescript
// ❌ Unused variables (will fail build)
const { theme, resolvedTheme } = useTheme()  // theme unused

// ✅ Fix: Remove unused
const { resolvedTheme } = useTheme()

// ❌ Missing TypeScript properties
supplier_logo_dark: data.supplier_logo_dark  // Not in interface

// ✅ Fix: Add to interface
interface ProductDetail {
  supplier_logo_dark?: string  // Add missing property
}

// ❌ React hooks exhaustive deps
useEffect(() => {
  loadProducts()
}, [supplierFilter])  // Missing loadProducts dependency

// ✅ Fix: Add eslint-disable if intentional
useEffect(() => {
  loadProducts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [supplierFilter])
```

### 3. Version & Tag Management

**IMPORTANT**: Never tag until build succeeds!

```bash
# ❌ WRONG ORDER (what we did in v1.1.4)
npm version patch           # Creates v1.1.4 tag
git push origin main --tags
# Build fails! Now tag points to broken code

# ✅ CORRECT ORDER
npm run build               # Test build first!
git add -A
git commit -m "..."
git push origin main
npm version patch           # Only tag after build succeeds
git push origin main --tags
```

**If you need to move a tag** (like we did):
```bash
# Delete tag locally and remotely
git tag -d v1.1.4
git push origin :refs/tags/v1.1.4

# Recreate on correct commit
git tag v1.1.4
git push origin v1.1.4

# Force fetch on VPS
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu \
  "cd /opt/fossapp && git fetch --tags --force"
```

---

## 📋 Complete Deployment Workflow

### Step 1: Development & Testing
```bash
# 1. Make changes locally
# 2. Test in dev mode
npm run dev

# 3. Run pre-deployment checks (CRITICAL!)
./scripts/deploy-check.sh

# 4. Fix any errors that appear
# 5. Repeat until all checks pass
```

### Step 2: Commit & Push
```bash
# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "feat: description of changes

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Push to GitHub
git push origin main
```

### Step 3: Version Bump
```bash
# Only after successful build!
npm version patch  # or minor/major

# Push version commit and tag
git push origin main --tags
```

### Step 4: Deploy to Production
```bash
# Deploy to platon VPS
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu \
  "cd /opt/fossapp && ./deploy.sh v1.1.4"

# Verify deployment
curl https://app.titancnc.eu/api/health
```

---

## 🚨 Common Deployment Failures & Fixes

### Issue 1: "Module not found" Error

**Symptom**:
```
Module not found: Can't resolve '@radix-ui/react-icons'
```

**Cause**: Missing dependency when adding shadcn components

**Fix**:
```bash
npm install @radix-ui/react-icons
git add package.json package-lock.json
git commit -m "fix: add missing dependency"
git push origin main
```

### Issue 2: ESLint Errors in Production

**Symptom**:
```
Error: 'theme' is assigned a value but never used
```

**Cause**: Dev mode doesn't enforce ESLint strictly

**Fix**: Run `npm run build` locally first, fix all errors

### Issue 3: TypeScript Type Errors

**Symptom**:
```
Type error: Object literal may only specify known properties
```

**Cause**: Missing property in TypeScript interface

**Fix**: Update interface to match actual data structure

### Issue 4: Docker Build Failures

**Symptom**: Build succeeds locally but fails in Docker

**Cause**:
- Different Node.js version (local vs Docker)
- Missing environment variables
- Cached layers with old dependencies

**Fix**:
```bash
# On VPS: Clear Docker cache
docker system prune -a --volumes

# Rebuild from scratch
./deploy.sh v1.1.4
```

---

## 📝 Pre-Deployment Checklist

Before running `npm version patch`:

- [ ] `./scripts/deploy-check.sh` passes all checks
  - [ ] TypeScript type-check passes
  - [ ] ESLint validation passes
  - [ ] Smoke tests pass (7 tests)
  - [ ] Production build succeeds
- [ ] All dependencies in package.json
- [ ] Changes committed and pushed to main
- [ ] Dev server tested (npm run dev)
- [ ] All features tested manually
- [ ] **What's New updated** (if user-facing changes)
  - Add new release to **top** of `src/data/releases.json`
  - See [docs/features/whats-new.md](../features/whats-new.md) for format
- [ ] **Dashboard hints reviewed** (if new features added)
  - Review `src/data/hints.ts` for new feature hints
  - Update/remove hints for deprecated features

Before deploying to production:

- [ ] GitHub has latest code
- [ ] Version tag created and pushed
- [ ] Production environment variables set
- [ ] Database migrations applied (if any)
- [ ] Backup taken (if major changes)

After deployment:

- [ ] Health check passes: `curl https://app.titancnc.eu/api/health`
- [ ] Manually test key features
- [ ] Check Docker logs for errors: `docker-compose logs -f`
- [ ] Monitor for first 5-10 minutes

---

## 🎯 Best Practices

### 1. Always Run Pre-Deployment Script
```bash
# Add this to your workflow (runs all checks)
./scripts/deploy-check.sh

# Or run individual checks
npm run type-check  # TypeScript validation
npm run lint        # ESLint validation
npm run test:ci     # Smoke tests (3.8s)
npm run build       # Production build
```

### 2. Commit Messages
Use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `chore:` Maintenance

### 3. Version Bumping Strategy
- **patch** (1.1.3 → 1.1.4): Bug fixes, small changes
- **minor** (1.1.4 → 1.2.0): New features, backwards compatible
- **major** (1.2.0 → 2.0.0): Breaking changes

### 4. Component Addition Workflow

When adding shadcn components:
```bash
# 1. Add component
npx shadcn@latest add table

# 2. Check for missing dependencies
npm run build

# 3. Install any missing packages
npm install <missing-package>

# 4. Test build again
npm run build

# 5. Only then commit
```

---

## 🔐 Environment Variables Sync

Environment files (`.env.production`) contain secrets and are **never committed to git**.

### Sync Script

Use the sync helper to keep production in sync:

```bash
# Sync local .env.production to server
./scripts/sync-env.sh

# Compare local vs production (shows key differences only)
./scripts/sync-env.sh --diff

# Pull production env to local (for backup or review)
./scripts/sync-env.sh --pull
```

### When to Sync

- After changing API keys (APS, Google, Supabase)
- After adding new environment variables
- Before major deployments with config changes

### Important Notes

- Always restart the container after syncing: `docker compose restart fossapp`
- The script creates automatic backups on the server before overwriting
- Never commit `.env*` files to git (even private repos)

### Future Improvement: git-crypt

**TODO**: Consider implementing [git-crypt](https://github.com/AGWA/git-crypt) for encrypted secrets in the repository. This would allow:
- Secrets stored encrypted in git history
- Automatic decryption for authorized developers
- Easier onboarding and secret rotation
- Audit trail for secret changes

---

## 🔍 Debugging Failed Deployments

### Check VPS Logs
```bash
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu

# Docker logs
cd /opt/fossapp
docker-compose logs -f

# Build logs
docker-compose build --no-cache

# Container status
docker ps -a
```

### Check Git Status on VPS
```bash
ssh -i ~/.ssh/platon.key sysadmin@platon.titancnc.eu \
  "cd /opt/fossapp && git log -1 && git status"
```

### Force Clean Deploy
```bash
# On VPS
cd /opt/fossapp
docker-compose down
docker system prune -a --volumes  # CAUTION: Removes all unused data
./deploy.sh v1.1.4
```

---

## 📚 Related Documentation

- [CHANGELOG.md](../CHANGELOG.md) - Version history and release notes
- [DEPLOYMENT.md](./DEPLOYMENT.md) - General deployment guide
- [CLAUDE.md](../CLAUDE.md) - Project overview and development guide
- [Production Server Details](../CLAUDE.md#production-server-access) - SSH and VPS info

---

## 🐛 v1.1.4 Deployment Issues Summary

**What went wrong**:
1. ❌ Tagged version before testing production build
2. ❌ Unused `theme` variable not caught in dev
3. ❌ Missing `supplier_logo_dark` in TypeScript interface
4. ❌ React hooks dependency warning not caught
5. ❌ Had to delete and recreate tag 3 times

**What we learned**:
1. ✅ **ALWAYS** run `npm run build` before committing
2. ✅ Never tag until build succeeds
3. ✅ Production builds are stricter than dev
4. ✅ ESLint/TypeScript errors must be fixed before deployment
5. ✅ Keep this checklist updated with new lessons

---

## 🎉 v1.4.1 Improvements (External Audit Fixes)

**What changed**:
1. ✅ Automated pre-deployment script (`scripts/deploy-check.sh`)
2. ✅ Playwright smoke tests (7 critical path tests in 3.8s)
3. ✅ Type-check script for TypeScript validation
4. ✅ Security fixes (domain validation, error sanitization)
5. ✅ Single command replaces manual checklist: `./scripts/deploy-check.sh`

**What you get**:
- **Faster**: One command vs 4 manual steps
- **Safer**: Tests catch broken auth flows before deployment
- **Consistent**: Same checks every time, no forgetting steps
- **Fail-fast**: Stops at first failure with clear error output

**New workflow**:
```bash
# Old way (v1.4.0 and before)
npm run build              # Manual
# Check for errors
# Fix issues
# Test manually

# New way (v1.4.1+)
./scripts/deploy-check.sh  # Automated
# Fix any failures
# Done!
```

---

**Remember**: 5 minutes of automated testing saves 30 minutes of deployment debugging! 🚀
