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

# Check 0: Auto-sync .env.production to server if changed
echo -n "⚙️  Environment: Syncing .env.production to server... "
SSH_KEY="$HOME/.ssh/platon.key"
SSH_HOST="sysadmin@platon.titancnc.eu"
REMOTE_ENV="/opt/fossapp/.env.production"
LOCAL_ENV=".env.production"

if [ ! -f "$LOCAL_ENV" ]; then
  echo -e "${RED}✗ FAILED${NC}"
  echo "  Local .env.production not found!"
  FAILED=1
elif [ ! -f "$SSH_KEY" ]; then
  echo -e "${YELLOW}⚠ SKIPPED${NC} (SSH key not found)"
else
  # Get remote file content (keys only, sorted)
  REMOTE_KEYS=$(ssh -i "$SSH_KEY" "$SSH_HOST" "grep -E '^[A-Z_]+=' $REMOTE_ENV 2>/dev/null | cut -d= -f1 | sort" 2>/dev/null) || REMOTE_KEYS=""
  LOCAL_KEYS=$(grep -E '^[A-Z_]+=' "$LOCAL_ENV" | cut -d= -f1 | sort)

  # Check for new keys in local that aren't in remote
  NEW_KEYS=$(comm -23 <(echo "$LOCAL_KEYS") <(echo "$REMOTE_KEYS"))

  # Check for value changes (compare full file hashes of matching keys)
  REMOTE_CONTENT=$(ssh -i "$SSH_KEY" "$SSH_HOST" "cat $REMOTE_ENV" 2>/dev/null) || REMOTE_CONTENT=""

  CHANGED_KEYS=""
  while IFS= read -r key; do
    [ -z "$key" ] && continue
    LOCAL_VAL=$(grep "^${key}=" "$LOCAL_ENV" | cut -d= -f2-)
    REMOTE_VAL=$(echo "$REMOTE_CONTENT" | grep "^${key}=" | cut -d= -f2-)
    if [ "$LOCAL_VAL" != "$REMOTE_VAL" ] && [ -n "$REMOTE_VAL" ]; then
      CHANGED_KEYS="$CHANGED_KEYS $key"
    fi
  done <<< "$LOCAL_KEYS"

  if [ -n "$NEW_KEYS" ] || [ -n "$CHANGED_KEYS" ]; then
    # Sync needed - backup and push
    ssh -i "$SSH_KEY" "$SSH_HOST" "cp $REMOTE_ENV ${REMOTE_ENV}.backup-\$(date +%Y%m%d-%H%M%S)" 2>/dev/null || true
    scp -i "$SSH_KEY" "$LOCAL_ENV" "$SSH_HOST:$REMOTE_ENV" > /dev/null 2>&1

    echo -e "${GREEN}✓ SYNCED${NC}"
    [ -n "$NEW_KEYS" ] && echo -e "  ${YELLOW}New keys:${NC} $(echo $NEW_KEYS | tr '\n' ' ')"
    [ -n "$CHANGED_KEYS" ] && echo -e "  ${YELLOW}Changed:${NC}$CHANGED_KEYS"
  else
    echo -e "${GREEN}✓ IN SYNC${NC}"
  fi
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
