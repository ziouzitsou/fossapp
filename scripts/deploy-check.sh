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

# Check 0: Security - Auth bypass must not be enabled in production
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

# Check 1: TypeScript type checking
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
