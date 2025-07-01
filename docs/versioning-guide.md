# FOSSAPP Versioning Guide

## Overview

This document outlines the simple versioning workflow for FOSSAPP, designed for solo development and deployment.

## Versioning Strategy

FOSSAPP uses **Semantic Versioning (SemVer)**: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.0.0 → 2.0.0): Breaking changes, major architectural updates
- **MINOR** (1.0.0 → 1.1.0): New features, backwards compatible additions
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, security patches, small improvements

## Release Workflow

### 1. Pre-Release Checks

Before creating a new version, run these commands to ensure code quality:

```bash
# Test the build
npm run build

# Check for linting issues
npm run lint

# Run any tests (if available)
npm test
```

### 2. Version Creation

Use npm's built-in versioning to automatically update `package.json` and create git tags:

```bash
# For bug fixes and small improvements
npm version patch

# For new features
npm version minor

# For breaking changes (rare)
npm version major
```

This command will:
- Update the version in `package.json`
- Create a git commit with the version change
- Create a git tag (e.g., `v1.2.3`)

### 3. Push Changes

```bash
# Push the code and tags to GitHub
git push origin main --tags
```

### 4. Deploy to Production

After pushing to GitHub, deploy your application to your production environment.

## Version History

Track your releases in this section:

### v1.1.1 - Version Display & UI Enhancement
- **Date**: July 1, 2025
- **Features**:
  - Version display in sidebar navigation
  - Environment indicator (dev suffix for development)
  - Consistent UI across dashboard and products pages
  - Monospace font styling for technical appearance
  - Production deployment testing and verification

### v1.1.0 - Docker & VPS Deployment
- **Date**: June 30, 2025
- **Features**:
  - Docker containerization with multi-stage build
  - Port 8080 configuration for production
  - Automatic log rotation (10MB × 5 files)
  - Health check endpoint (/api/health)
  - Blue-green VPS deployment strategy
  - Production environment templates
  - Comprehensive deployment documentation

### v1.0.0 - Initial Release
- **Date**: June 30, 2025
- **Features**: 
  - Product search and display (56,456+ lighting products)
  - Google OAuth authentication
  - Supabase database integration
  - Responsive design with Tailwind CSS and Radix UI
  - Product details pages with full specifications
  - Security-hardened API endpoints
  - Professional lighting design focus

### Future Releases

Document each release here with:
- Version number
- Release date
- New features
- Bug fixes
- Breaking changes (if any)

## Hotfix Workflow

For critical bugs in production:

1. Fix the issue directly on main branch
2. Test the fix
3. Create patch version: `npm version patch`
4. Push and deploy immediately: `git push origin main --tags`

## Development Tips

### Check Current Version
```bash
# View current version
npm version

# View all git tags
git tag --list

# View version history
git log --oneline --tags --graph
```

### Version Rollback
If you need to rollback a version:

```bash
# View recent tags
git tag --list

# Reset to previous version (CAREFUL!)
git reset --hard v1.2.0

# Force push (only if not yet deployed)
git push --force-with-lease origin main
```

## Best Practices

1. **Always test before versioning** - Run build and lint checks
2. **Use descriptive commit messages** - The version commit should be clear
3. **Document breaking changes** - Always note compatibility issues
4. **Keep versions consistent** - Don't skip version numbers
5. **Tag meaningful releases** - Don't create versions for minor commits

## Environment-Specific Versions

If you deploy to multiple environments:

- **Development**: Work directly on main branch
- **Staging**: Use tagged versions for testing
- **Production**: Only deploy tagged, tested versions

## Automation (Future)

When ready to add automation, consider:
- GitHub Actions for automatic building and testing
- Automatic deployment on tagged releases
- Changelog generation from commit messages
- Automated security scanning

## Notes

- Version information is stored in `package.json`
- Git tags provide version history
- GitHub Releases can be created manually from tags
- Keep this document updated with each release