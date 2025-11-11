#!/bin/bash

# Pre-Deployment Security Audit
# Run this before any production deployment to catch security issues
# Usage: ./scripts/pre-deploy-audit.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Pre-Deployment Security Audit${NC}"
echo ""

# Run standard deployment checks first
if [[ -f "$PROJECT_ROOT/scripts/deploy-check.sh" ]]; then
    echo -e "${YELLOW}⚙️  Running deployment checks...${NC}"
    if ! "$PROJECT_ROOT/scripts/deploy-check.sh"; then
        echo -e "${RED}❌ Deployment checks failed!${NC}"
        echo "   Fix these issues before running security audit."
        exit 1
    fi
    echo ""
fi

# Run Gemini security audit
echo -e "${YELLOW}🔍 Running Gemini security audit...${NC}"
echo ""

if "$SCRIPT_DIR/run-gemini-audit.sh" --auto-approve; then
    LATEST_AUDIT=$(ls -t "$PROJECT_ROOT/audits/"*_GEMINI_AUDIT.md | head -1)

    # Check for critical/high severity issues
    CRITICAL_COUNT=$(grep -c "^| Critical" "$LATEST_AUDIT" 2>/dev/null || echo "0")
    HIGH_COUNT=$(grep -c "^| High" "$LATEST_AUDIT" 2>/dev/null || echo "0")

    echo ""
    echo -e "${GREEN}✅ Security audit completed${NC}"
    echo ""

    if [[ $CRITICAL_COUNT -gt 0 ]] || [[ $HIGH_COUNT -gt 0 ]]; then
        echo -e "${RED}⛔ DEPLOYMENT BLOCKED${NC}"
        echo ""
        echo -e "${RED}Found security issues:${NC}"
        echo "   🔴 Critical: $CRITICAL_COUNT"
        echo "   🟠 High: $HIGH_COUNT"
        echo ""
        echo -e "${YELLOW}Review audit report:${NC}"
        echo "   cat $LATEST_AUDIT"
        echo ""
        echo "Fix these issues before deploying to production!"
        exit 1
    else
        echo -e "${GREEN}✅ No critical or high severity issues found${NC}"
        echo ""
        echo "Safe to proceed with deployment."
        exit 0
    fi
else
    echo -e "${RED}❌ Security audit failed!${NC}"
    exit 1
fi
