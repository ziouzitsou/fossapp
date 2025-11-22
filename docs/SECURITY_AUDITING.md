# Security Auditing

FOSSAPP uses Gemini AI-powered security audits for automated vulnerability detection.

## Overview

**Location**: `audits/` folder with automation scripts in `scripts/`
**Tool**: Gemini CLI (free tier)
**Agent**: gemini-code-auditor (interactive reviews during development)

## Available Commands

```bash
# Manual security audit
./scripts/run-gemini-audit.sh --auto-approve

# Pre-deployment security gate (blocks if critical/high issues found)
./scripts/pre-deploy-audit.sh

# Schedule recurring audits
./scripts/schedule-audit.sh weekly
```

## How It Works

1. Gemini CLI analyzes codebase for security vulnerabilities
2. Generates markdown report: `audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md`
3. Categorizes findings by severity (Critical/High/Medium/Low)
4. Blocks deployment if critical/high severity issues found
5. Maintains audit history locally (excluded from git)

## Audit Focus Areas

- **Authentication & Authorization**: NextAuth.js, domain validation
- **Database Security**: Supabase clients, RLS policies, SQL injection
- **API Security**: Input validation, error handling, CORS
- **Code Quality**: Secrets management, dependency vulnerabilities
- **Production Deployment**: Docker security, logging

## Severity Response Guide

| Severity | Action |
|----------|--------|
| 🔴 Critical | Block deployment, fix immediately |
| 🟠 High | Block deployment, fix before release |
| 🟡 Medium | Review required, document decision |
| 🟢 Low | Document and backlog |

## Gemini Code Auditor Agent

**Agent**: `.claude/agents/gemini-code-auditor.md`
**Documentation**: [gemini-auditor.md](./gemini-auditor.md)

Interactive code review during development for immediate feedback.

**Usage**:
```
User: "Review the authentication implementation"
Claude: [Invokes gemini-code-auditor agent]
Claude: "Audit complete. Grade: A-, 0 critical issues, 2 warnings..."
```

**Triggers**:
- User requests: "Review this code", "Audit the new API endpoint"
- Proactive: After completing significant features or security-sensitive changes

**Audit Coverage**:
- 🔒 Security (SQL injection, XSS, auth bypass, secrets)
- 📊 Code Quality (TypeScript, error handling, duplication)
- 🏗️ Architecture (Server/Client components, routing)
- ⚡ Performance (queries, caching, bundle size)
- ♿ Accessibility (WCAG, semantic HTML, ARIA)
- 🎯 Project-Specific (Supabase dual-client, NextAuth, shadcn/ui)

## Agent vs Scripts

| Use Case | Tool |
|----------|------|
| Interactive development review | 🤖 gemini-code-auditor agent |
| Pre-deployment security gate | 📜 `./scripts/pre-deploy-audit.sh` |
| Scheduled weekly audits | 📜 `./scripts/run-gemini-audit.sh --auto-approve` |
| CI/CD integration | 📜 Scripts (exit codes for automation) |
| Historical tracking | 📜 Scripts (markdown reports in `audits/`) |

## Integration

- Pre-deployment checks: `./scripts/pre-deploy-audit.sh`
- CI/CD ready: Returns exit codes for automation
- Scheduled audits: Weekly via Windows Task Scheduler (WSL)

## Git Configuration

- Audit reports: Excluded from repository (sensitive)
- Documentation: Tracked in git (public)
- Execution logs: Local only

## Example Workflow

```bash
# Before deployment
./scripts/pre-deploy-audit.sh

# If passed
npm version patch
git push --tags

# If failed
# Review: cat audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md
# Fix issues, then retry
```

## Complete Documentation

- **Quick Start**: `audits/AUTOMATION_QUICK_START.md`
- **Complete Guide**: `audits/README.md`
- **Setup Details**: `audits/AUTOMATION_SETUP_COMPLETE.md`
- **Agent Documentation**: `docs/gemini-auditor.md`

## Notes

- Gemini CLI uses free tier - be mindful of token usage for large audits
- Test Results (2025-11-11): Grade A-, no token limit issues with free tier
- Agent is project-aware (knows about dual-client pattern, port 8080, etc.)
