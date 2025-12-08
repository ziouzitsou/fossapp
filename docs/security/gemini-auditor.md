# Gemini Code Auditor Agent

**Agent Type**: Custom Claude Code Agent
**Location**: `.claude/agents/gemini-code-auditor.md`
**Status**: ✅ Active (as of v1.4.3)
**Purpose**: AI-powered code quality and security auditing during development

---

## Overview

The Gemini Code Auditor is a specialized Claude Code agent that performs comprehensive code reviews focusing on security, quality, architecture compliance, performance, and accessibility. It provides immediate feedback during development conversations.

### Key Difference: Agent vs Scripts

| Feature | gemini-code-auditor Agent | Gemini CLI Scripts |
|---------|---------------------------|-------------------|
| **Trigger** | Conversational ("Review this code") | Manual/scheduled (`./scripts/run-gemini-audit.sh`) |
| **Integration** | Part of Claude Code workflow | Standalone automation |
| **Output** | In-conversation (immediate) | Markdown files in `audits/` |
| **Context** | Full conversation history | Files only |
| **Use Case** | Interactive development review | Pre-deployment gate, weekly audits |
| **Best For** | "Just coded X, review it" | "Weekly security check", CI/CD |

**They complement each other** - use the agent for interactive development, scripts for automated security checks.

---

## When to Use the Agent

### Automatic Triggers (Proactive)

The agent can be automatically invoked after:
- Completing a new feature implementation
- Writing database migrations
- Adding API endpoints
- Implementing authentication logic
- Refactoring existing code
- Security-sensitive changes

### Manual Triggers (User Request)

Use the agent when you ask:
- "Review this code"
- "Audit the authentication implementation"
- "Check for security issues in this function"
- "gemini will audit our code"

### Example Usage

```
User: "I just added a new API endpoint for user preferences"

Claude: "I'll use the gemini-code-auditor agent to review
        the endpoint for security and best practices."

[Agent runs comprehensive audit]

Claude: "The audit is complete. Found 0 critical issues,
        1 warning about rate limiting, and 2 optimization
        suggestions. Here's the detailed report..."
```

---

## Audit Coverage

The agent systematically examines:

### 1. Security Analysis
- Authentication/Authorization (NextAuth.js, session handling)
- Input Validation (SQL injection, XSS, parameter validation)
- Secret Management (environment variables, no hardcoded credentials)
- API Security (rate limiting, CORS, error exposure)
- Database Access (service_role vs anon key usage)

### 2. Code Quality
- Type Safety (explicit TypeScript types, no `any`)
- Error Handling (try-catch blocks, graceful degradation)
- Code Duplication (opportunities for abstraction)
- Naming Conventions (clarity and consistency)
- Comments (complex logic documented)

### 3. Architecture Compliance
- Server vs Client Components ('use client' directive usage)
- Data Fetching (server actions preferred)
- Routing (App Router conventions)
- Component Structure (separation of concerns)
- State Management (React hooks, no prop drilling)

### 4. Performance
- Bundle Size (heavy imports, code splitting)
- Database Queries (N+1 queries, missing indexes)
- Caching (Next.js caching strategies)
- Image Optimization (Next.js Image component)
- Lazy Loading (dynamic imports)

### 5. Accessibility
- Semantic HTML (headings, landmarks, ARIA)
- Keyboard Navigation (focus management, tab order)
- Screen Reader Support (alt text, labels)
- Color Contrast (potential issues)

### 6. Project-Specific Standards
- Supabase Dual-Client Pattern (supabase.ts vs supabase-server.ts)
- Authentication Flow (NextAuth integration, protected routes)
- shadcn/ui Patterns (component usage, variants)
- Port Configuration (port 8080, not 3000)
- Environment Variables (from .env.example)

---

## Audit Output Format

The agent provides structured reports with:

### 📊 Audit Summary
- Files reviewed (count and paths)
- Overall grade (A+ to F)
- Issue counts by severity

### 🚨 Critical Issues
Must fix before deployment:
- Security vulnerabilities (SQL injection, XSS, exposed secrets)
- Authentication bypass
- Data loss potential
- Application crashes

### ⚠️ Warnings
Should fix soon:
- Missing error handling
- Performance bottlenecks
- Accessibility violations
- Code duplication
- Missing TypeScript types

### 💡 Suggestions
Nice to have:
- Code organization improvements
- Performance optimizations
- Better naming conventions
- Enhanced user experience

### ✅ Strengths
Highlights what the code does well (reinforces good patterns)

### 📝 Detailed Analysis
In-depth explanations with code examples

---

## Example Audit Report

From real audit of v1.4.3 SQL injection fix:

```markdown
## Audit Summary
- Files Reviewed: 8
- Overall Grade: A-
- Critical Issues: 0
- Warnings: 3
- Suggestions: 5

## Critical Issues
✅ NONE FOUND

## Warnings

### WARNING 1: Inconsistent String Interpolation
File: src/lib/actions.ts:57
Severity: Medium
Issue: `.ilike` methods use string interpolation
Risk: Potential for accidental SQL injection if sanitization bypassed
Current: .or(`description_short.ilike.%${sanitizedQuery}%`)
Recommendation: Refactor to more explicit parameterization

## Strengths

✅ SQL Injection Fix - EXCELLENT
The recent fix properly addresses vulnerability:
- Uses query builder instead of raw SQL
- .in() method automatically parameterized
- Additional validation: filter(id => Number.isInteger(id))
- Zero breaking changes
```

---

## Test Results (2025-11-11)

**Test Case**: Audit SQL injection fix in v1.4.3

**Results**:
- ✅ Agent executed successfully
- ✅ Comprehensive audit delivered (A- grade)
- ✅ Confirmed SQL injection fix is secure
- ✅ Identified 3 warnings (medium priority)
- ✅ Provided 5 optimization suggestions
- ✅ Highlighted 8 code strengths
- ✅ Included specific file paths and line numbers
- ✅ Provided code examples and solutions
- ✅ No token limit issues (Gemini free tier)

**Quality Assessment**:
- Very detailed and specific
- Balanced (praises strengths, not just criticism)
- Project-aware (mentioned dual-client pattern, port 8080)
- Actionable recommendations with code examples
- Explains impact and risk levels

---

## Integration with Development Workflow

### During Feature Development

```
1. Write code for new feature
2. Test locally (npm run dev)
3. Ask: "Review the new authentication feature"
4. Agent provides audit
5. Address critical issues and warnings
6. Optional: address suggestions
7. Commit code
```

### Before Deployment

```
1. Complete feature development
2. Agent audit (conversational)
3. Fix critical/high issues
4. Run automated script: ./scripts/pre-deploy-audit.sh
5. If passed, proceed with deployment
```

### Weekly Review

```
1. Scheduled script runs: ./scripts/run-gemini-audit.sh --auto-approve
2. Review generated report: audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md
3. Address accumulated warnings
4. Track progress in TODO.md
```

---

## Complementary Tools

### Gemini CLI Scripts

**Location**: `scripts/run-gemini-audit.sh`, `scripts/pre-deploy-audit.sh`

**Use for**:
- Pre-deployment security gates (blocks deployment if critical issues)
- Scheduled weekly audits (via Windows Task Scheduler)
- CI/CD integration (returns exit codes)
- Historical audit tracking (markdown reports)

**Documentation**: `audits/README.md`, `audits/AUTOMATION_QUICK_START.md`

### Production Deployer Agent

**Use for**:
- Automated production deployments
- Version bumping
- CHANGELOG updates
- Health check verification

**Workflow**: Agent → Scripts → Deploy
```bash
# Agent audit (interactive)
"Review this code"

# Script audit (pre-deployment gate)
./scripts/pre-deploy-audit.sh

# Deploy (if passed)
"Deploy to production version 1.4.4"
```

---

## Configuration

**Agent File**: `.claude/agents/gemini-code-auditor.md`

**Model**: Sonnet (balanced performance and quality)

**Key Sections**:
- `name`: gemini-code-auditor
- `description`: When to use this agent (triggers)
- `model`: sonnet
- `---` (content): Agent instructions and methodology

**Customization**:
Edit `.claude/agents/gemini-code-auditor.md` to:
- Adjust audit focus areas
- Add project-specific checks
- Modify output format
- Change severity thresholds

---

## Behavioral Guidelines

The agent follows these principles:

1. **Be Specific**: Reference exact file paths and line numbers
2. **Provide Solutions**: Suggest fixes with code examples
3. **Context Awareness**: Consider project-specific patterns from CLAUDE.md
4. **Prioritize**: Focus on critical issues first
5. **Be Constructive**: Balance criticism with recognition of good practices
6. **Be Concise**: Avoid verbose explanations unless necessary
7. **Code Examples**: Show before/after code
8. **Explain Impact**: Describe real-world consequences

---

## Self-Verification Checklist

Before finalizing audit, the agent verifies:
- [ ] All critical security issues identified
- [ ] Project-specific patterns checked (CLAUDE.md context)
- [ ] Supabase dual-client pattern validated
- [ ] Authentication flow reviewed
- [ ] Performance implications assessed
- [ ] Accessibility basics covered
- [ ] Concrete fixes provided for each issue
- [ ] Code examples included where helpful
- [ ] Overall grade justified by findings

---

## Limitations

### What the Agent Does NOT Do

1. **Execute Code**: Cannot run tests or build the application
2. **Fix Code**: Identifies issues but doesn't auto-fix
3. **Manage Files**: Cannot create commits or manage git
4. **External Services**: Cannot access production logs or databases
5. **Exhaustive Testing**: Focuses on code review, not functional testing

### When to Use Scripts Instead

- **Scheduled Audits**: Use `./scripts/schedule-audit.sh weekly`
- **Pre-Deployment Gates**: Use `./scripts/pre-deploy-audit.sh`
- **CI/CD Integration**: Scripts return exit codes for automation
- **Historical Tracking**: Scripts save markdown reports in `audits/`

---

## Future Enhancements

Planned improvements for the agent:

1. **Integration with git diff**: Focus audits on changed files only
2. **Severity customization**: User-configurable thresholds
3. **Auto-fix suggestions**: Generate pull request diffs
4. **Performance benchmarks**: Compare before/after metrics
5. **Accessibility scanning**: Automated WCAG compliance checks
6. **Dependency audits**: npm audit integration
7. **Cost tracking**: Token usage monitoring for Gemini API

---

## Troubleshooting

### Agent Not Found

**Error**: "Unknown agent: gemini-code-auditor"

**Solution**:
```bash
# Verify agent file exists
ls -la .claude/agents/gemini-code-auditor.md

# If missing, restore from backup or create new
# Agent should be in .claude/agents/ directory
```

### Agent Returns Incomplete Audit

**Possible Causes**:
1. Gemini free tier token limit reached
2. Context too large (too many files)
3. Request timeout

**Solutions**:
- Reduce scope: "Audit only the authentication module"
- Wait for token reset (Gemini free tier limits)
- Use scripts for large audits

### Agent Focuses on Wrong Issues

**Solution**: Provide specific context
```
Bad:  "Review this code"
Good: "Audit the SQL queries in src/lib/actions.ts for
       injection vulnerabilities"
```

---

## Quick Reference

### Invoke the Agent

Via Claude Code conversation:
```
"Review this code"
"Audit the authentication implementation"
"Check the new API endpoint for security issues"
"gemini will audit our code"
```

### Agent vs Scripts Decision Tree

```
Need feedback NOW during development?
└─> Use agent (conversational, immediate)

Need pre-deployment security gate?
└─> Use script: ./scripts/pre-deploy-audit.sh

Need scheduled weekly audits?
└─> Use script: ./scripts/schedule-audit.sh weekly

Want historical audit tracking?
└─> Use scripts (creates markdown reports)

Want CI/CD integration?
└─> Use scripts (exit codes for automation)
```

---

## Related Documentation

- **Agent Configuration**: `.claude/agents/gemini-code-auditor.md`
- **Automation Scripts**: `audits/README.md`
- **Quick Start**: `audits/AUTOMATION_QUICK_START.md`
- **Project Guide**: `CLAUDE.md`
- **Changelog**: `CHANGELOG.md`

---

## Version History

- **v1.4.3** (2025-11-11): Agent created and tested
  - Initial agent configuration
  - Comprehensive audit methodology
  - Project-specific standards included
  - Test audit completed successfully (A- grade)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-11
**Status**: Active
**Tested**: ✅ Passed
