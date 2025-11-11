#!/bin/bash

# Automated Gemini Security Audit Script
# Usage: ./scripts/run-gemini-audit.sh [--auto-approve]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
AUDITS_DIR="$PROJECT_ROOT/audits"
DATE=$(date +%Y%m%d_%H%M%S)
AUDIT_FILE="$AUDITS_DIR/${DATE}_GEMINI_AUDIT.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running in auto-approve mode
AUTO_APPROVE=false
if [[ "$1" == "--auto-approve" ]]; then
    AUTO_APPROVE=true
fi

echo -e "${BLUE}🔍 Starting Gemini Security Audit${NC}"
echo "📅 Date: $(date)"
echo "📁 Output: $AUDIT_FILE"
echo ""

# Ensure audits directory exists
mkdir -p "$AUDITS_DIR"

# Build the audit prompt
AUDIT_PROMPT=$(cat <<EOF
You are a security auditor reviewing the FOSSApp Next.js application.

**CRITICAL INSTRUCTION**: You MUST write your audit report to this exact file using the Write tool:
File path: $AUDIT_FILE

**Your task**: Perform a comprehensive security audit focusing on:

1. **Authentication & Authorization**
   - NextAuth.js configuration and session handling
   - Domain validation and access controls
   - Protected routes and API endpoints
   - Session management and JWT security

2. **Database Security**
   - Supabase client usage (service_role vs anon key)
   - Row Level Security (RLS) policies
   - SQL injection vulnerabilities
   - Data access patterns

3. **API Security**
   - Input validation and sanitization
   - Error handling and information disclosure
   - Rate limiting and abuse prevention
   - CORS configuration

4. **Code Quality & Security**
   - Environment variable handling
   - Secrets management
   - Dependency vulnerabilities
   - Error logging (credential exposure)

5. **Production Deployment**
   - Docker security configuration
   - Health check endpoints
   - Logging and monitoring

**Output Format**: Create a markdown report with:

```markdown
# Gemini Security Audit - YYYY-MM-DD

## Summary of Findings

| Severity | Finding | Location |
| :------- | :------ | :------- |
| Critical | ... | ... |
| High     | ... | ... |
| Medium   | ... | ... |
| Low      | ... | ... |

## Detailed Findings

### 1. [Severity]: [Finding Title]

**Impact**: [Describe the security impact]

**Location**: [File paths and line numbers]

**Recommendation**: [Specific fix with code examples]

**Evidence**: [Code snippets showing the vulnerability]
```

**Important Context**:
- This is an internal tool for a single organization (@foss.gr)
- Current design uses service_role key (documented design decision)
- See previous audit: audits/20251111_GEMINI_AUDIT.md for reference
- Review audits/20251111_CLAUDE_RESPONSE.md to understand resolved issues

**Focus on**:
- New vulnerabilities introduced since last audit
- Regression of previously fixed issues
- Configuration drift
- Dependency updates that may affect security

**Analyze these key files**:
- src/app/api/auth/[...nextauth]/route.ts
- src/lib/auth.ts
- src/lib/supabase-server.ts
- src/lib/actions.ts
- src/app/api/products/*/route.ts
- src/app/api/health/route.ts
- .env.example
- Dockerfile
- docker-compose.yml

**Final Step - REQUIRED**:
After completing your analysis, you MUST:
1. Use the Write tool to create the audit report
2. Write to this exact file path: $AUDIT_FILE
3. Use the markdown format specified above
4. Do NOT create files with different names
5. Confirm the file was written successfully

Begin the audit now.
EOF
)

echo -e "${YELLOW}📋 Preparing codebase context...${NC}"

# Gather relevant files for audit
FILES_TO_AUDIT=(
    "src/app/api/auth/[...nextauth]/route.ts"
    "src/lib/auth.ts"
    "src/lib/supabase.ts"
    "src/lib/supabase-server.ts"
    "src/lib/actions.ts"
    "src/app/api/products/search/route.ts"
    "src/app/api/products/[id]/route.ts"
    "src/app/api/health/route.ts"
    ".env.example"
    "Dockerfile"
    "docker-compose.yml"
    "package.json"
    "audits/README.md"
    "audits/20251111_GEMINI_AUDIT.md"
    "audits/20251111_CLAUDE_RESPONSE.md"
)

echo -e "${BLUE}📂 Files included in audit:${NC}"
for file in "${FILES_TO_AUDIT[@]}"; do
    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        echo "  ✓ $file"
    else
        echo "  ⚠ $file (not found)"
    fi
done
echo ""

# Run Gemini audit
echo -e "${GREEN}🤖 Running Gemini audit...${NC}"
echo ""

cd "$PROJECT_ROOT"

# Build gemini command
GEMINI_CMD="gemini"

# Add include directories for context
GEMINI_CMD="$GEMINI_CMD --include-directories src/app/api"
GEMINI_CMD="$GEMINI_CMD --include-directories src/lib"
GEMINI_CMD="$GEMINI_CMD --include-directories audits"

# Set output format
GEMINI_CMD="$GEMINI_CMD --output-format text"

# Auto-approve if flag is set
if [[ "$AUTO_APPROVE" == true ]]; then
    echo -e "${YELLOW}⚡ Running in auto-approve mode${NC}"
    GEMINI_CMD="$GEMINI_CMD --yolo"
fi

# Execute Gemini with the audit prompt
# Capture execution log separately
EXEC_LOG="${AUDIT_FILE}.log"
if $GEMINI_CMD "$AUDIT_PROMPT" > "$EXEC_LOG" 2>&1; then
    echo ""

    # Check if Gemini created the audit file using Write tool
    if [[ -f "$AUDIT_FILE" ]] && grep -q "# Gemini Security Audit" "$AUDIT_FILE"; then
        echo -e "${GREEN}✅ Audit completed successfully!${NC}"
        echo -e "${GREEN}✅ Gemini wrote to correct location${NC}"
    else
        # Gemini may have created its own file - look for it
        echo -e "${YELLOW}⚠️  Gemini created its own file, searching...${NC}"

        # Find the most recent GEMINI_AUDIT.md file
        GEMINI_FILE=$(find "$AUDITS_DIR" -name "*GEMINI_AUDIT*.md" -type f -newer "$EXEC_LOG" 2>/dev/null | head -1)

        if [[ -n "$GEMINI_FILE" ]] && [[ "$GEMINI_FILE" != "$AUDIT_FILE" ]]; then
            echo -e "${BLUE}📄 Found Gemini's report: $(basename "$GEMINI_FILE")${NC}"
            echo -e "${BLUE}📋 Moving to expected location...${NC}"
            mv "$GEMINI_FILE" "$AUDIT_FILE"
            echo -e "${GREEN}✅ Audit report consolidated${NC}"
        else
            echo -e "${RED}⚠️  Could not find Gemini-generated audit report${NC}"
            echo -e "${YELLOW}📋 Execution log saved to: $EXEC_LOG${NC}"
        fi
    fi

    echo ""
    echo -e "${BLUE}📄 Audit report location:${NC}"
    echo "   $AUDIT_FILE"
    echo ""

    # Show quick summary (if proper markdown exists)
    if [[ -f "$AUDIT_FILE" ]] && grep -q "## Summary of Findings" "$AUDIT_FILE"; then
        echo -e "${YELLOW}📊 Quick Summary:${NC}"
        sed -n '/## Summary of Findings/,/## Detailed Findings/p' "$AUDIT_FILE" | head -n 20
        echo ""
    fi

    # Check for critical/high severity findings
    CRITICAL_COUNT=$(grep -c "^| Critical" "$AUDIT_FILE" || true)
    HIGH_COUNT=$(grep -c "^| High" "$AUDIT_FILE" || true)

    if [[ $CRITICAL_COUNT -gt 0 ]] || [[ $HIGH_COUNT -gt 0 ]]; then
        echo -e "${RED}⚠️  ATTENTION: Found $CRITICAL_COUNT Critical and $HIGH_COUNT High severity issues!${NC}"
        echo "   Review the audit report immediately."
        echo ""
    fi

    echo -e "${BLUE}📝 Next steps:${NC}"
    echo "   1. Review the audit report: cat $AUDIT_FILE"
    echo "   2. Create response document: audits/${DATE}_CLAUDE_RESPONSE.md"
    echo "   3. Address critical and high severity findings"
    echo "   4. Document design decisions and false positives"
    echo ""

    exit 0
else
    echo ""
    echo -e "${RED}❌ Audit failed!${NC}"
    echo "   Check the output file for errors: $AUDIT_FILE"
    echo ""
    exit 1
fi
