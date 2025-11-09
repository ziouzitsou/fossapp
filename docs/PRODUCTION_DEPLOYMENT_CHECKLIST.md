# Production Deployment Checklist

**Last Updated**: 2025-11-09
**Current Version**: v1.1.4

This checklist was created after the v1.1.4 deployment to prevent common issues.

> **Note**: For version history and release notes, see [CHANGELOG.md](../CHANGELOG.md)

---

## ⚠️ Critical: Pre-Deployment Checks

### 1. Local Build Test (MANDATORY)
```bash
# ALWAYS run this BEFORE committing/pushing
npm run build
```

**Why?** Production builds are stricter than dev mode:
- ESLint runs with `--strict` mode
- TypeScript type checking is enforced
- All warnings become errors
- Missing dependencies are caught

**Lessons from v1.1.4**:
- Dev server didn't catch unused `theme` variable → Production build failed
- Dev server didn't catch missing `supplier_logo_dark` in interface → Production build failed
- Dev server allowed React hooks warnings → Production build failed

### 2. Fix All ESLint/TypeScript Errors

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

# 3. Test build (CRITICAL!)
npm run build

# 4. Fix any errors that appear
# 5. Repeat until build succeeds
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

- [ ] `npm run build` succeeds locally
- [ ] No ESLint errors/warnings
- [ ] No TypeScript errors
- [ ] All dependencies in package.json
- [ ] Changes committed and pushed to main
- [ ] Dev server tested (npm run dev)
- [ ] All features tested locally

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

### 1. Always Test Build Locally
```bash
# Add this to your workflow
npm run build && echo "✅ Build successful" || echo "❌ Build failed"
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

**Remember**: 5 minutes of local testing saves 30 minutes of deployment debugging! 🚀
