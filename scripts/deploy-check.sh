#!/bin/bash
# deploy-check.sh - Pre-deployment validation script
# Run this before every deployment to catch issues early

set -e  # Exit on any error

echo "🔍 Running pre-deployment checks..."
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
FAILED=0

# Function to run a check and report status
run_check() {
  local name="$1"
  local command="$2"

  echo -n "⚙️  ${name}... "

  if eval "$command" > /tmp/deploy-check-output.log 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo ""
    echo "Error output:"
    cat /tmp/deploy-check-output.log
    echo ""
    FAILED=1
  fi
}

# Check 0: Environment variable sync between local and production
echo -n "⚙️  Environment: Checking env var sync with production... "
if [ -f "./scripts/check-env-sync.sh" ]; then
  if ./scripts/check-env-sync.sh --local-only > /tmp/env-check-output.log 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}"
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo ""
    echo "Missing required environment variables in local .env.local:"
    cat /tmp/env-check-output.log
    echo ""
    echo "Run './scripts/check-env-sync.sh' for full comparison with production."
    echo ""
    FAILED=1
  fi
else
  echo -e "${YELLOW}⚠ SKIPPED${NC} (check-env-sync.sh not found)"
fi

# Check 0b: Security - Auth bypass must not be enabled in production
echo -n "⚙️  Security: Auth bypass disabled in production... "
if [ -f ".env.production" ]; then
  if grep -q "NEXT_PUBLIC_BYPASS_AUTH=true" .env.production 2>/dev/null; then
    echo -e "${RED}✗ FAILED${NC}"
    echo ""
    echo "SECURITY ERROR: NEXT_PUBLIC_BYPASS_AUTH=true found in .env.production"
    echo "This would bypass authentication in production!"
    echo "Remove or set to 'false' before deploying."
    echo ""
    FAILED=1
  else
    echo -e "${GREEN}✓ PASSED${NC}"
  fi
else
  echo -e "${GREEN}✓ PASSED${NC} (no .env.production file)"
fi

# Check 1: Security audit for critical vulnerabilities
echo -n "⚙️  Security: npm audit (critical vulnerabilities)... "
AUDIT_OUTPUT=$(npm audit --audit-level=critical 2>&1) || true
if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
  echo -e "${GREEN}✓ PASSED${NC}"
elif echo "$AUDIT_OUTPUT" | grep -q "critical"; then
  echo -e "${RED}✗ FAILED${NC}"
  echo ""
  echo "CRITICAL SECURITY VULNERABILITIES FOUND:"
  echo "$AUDIT_OUTPUT" | grep -A5 "Severity: critical" || echo "$AUDIT_OUTPUT"
  echo ""
  echo "Run 'npm audit fix' to resolve, or 'npm audit' for details."
  echo ""
  FAILED=1
else
  # No critical vulnerabilities (may have high/moderate)
  echo -e "${GREEN}✓ PASSED${NC} (no critical vulnerabilities)"
fi

# Check 2: TypeScript type checking
run_check "Type checking" "npm run type-check"

# Check 2: Production build (includes ESLint in strict mode)
run_check "Production build (with linting)" "npm run build"

# Summary
echo ""
echo "================================================"
if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed! Safe to deploy.${NC}"
  echo "================================================"
  exit 0
else
  echo -e "${RED}❌ Some checks failed. Fix issues before deploying.${NC}"
  echo "================================================"
  exit 1
fi
