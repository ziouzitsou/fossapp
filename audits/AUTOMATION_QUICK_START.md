# Gemini Audit Automation - Quick Start

## 🚀 Quick Commands

### Run Manual Audit (Interactive)
```bash
cd /home/sysadmin/nextjs/fossapp
./scripts/run-gemini-audit.sh
```

### Run Manual Audit (Auto-approve)
```bash
./scripts/run-gemini-audit.sh --auto-approve
```

### Pre-Deployment Security Check
```bash
./scripts/pre-deploy-audit.sh
```
**Blocks deployment if critical/high issues found**

### Schedule Weekly Audits
```bash
./scripts/schedule-audit.sh weekly
```

---

## 📋 Common Workflows

### Before Deploying to Production
```bash
# Run all checks including security audit
./scripts/pre-deploy-audit.sh

# If passed, proceed with deployment
npm version patch
git push --tags
```

### Weekly Security Review
```bash
# Manual weekly audit
./scripts/run-gemini-audit.sh --auto-approve

# Review results
ls -lt audits/*_GEMINI_AUDIT.md | head -1
cat $(ls -t audits/*_GEMINI_AUDIT.md | head -1)
```

### After Major Code Changes
```bash
# Quick security check
./scripts/run-gemini-audit.sh --auto-approve

# If issues found, review and fix
cat audits/$(ls -t audits/*_GEMINI_AUDIT.md | head -1)
```

---

## 🎯 Severity Response Guide

| Severity | What to Do |
|----------|------------|
| 🔴 Critical | Stop everything, fix immediately |
| 🟠 High | Fix before next deployment |
| 🟡 Medium | Review, fix, or document decision |
| 🟢 Low | Document and backlog |

---

## 📂 File Locations

- **Scripts**: `scripts/run-gemini-audit.sh`, `scripts/pre-deploy-audit.sh`
- **Audit Reports**: `audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md`
- **Response Docs**: `audits/YYYYMMDD_HHMMSS_CLAUDE_RESPONSE.md`
- **Logs**: `audits/audit.log`

---

## 🔧 Windows Task Scheduler Setup (WSL)

Since WSL may not support cron, use Windows Task Scheduler:

1. Open **Task Scheduler**
2. **Create Basic Task**
3. **Trigger**: Weekly, Monday, 2:00 AM
4. **Action**: Start a program
5. **Program**: `wsl.exe`
6. **Arguments**: `bash /home/sysadmin/nextjs/fossapp/scripts/run-gemini-audit.sh --auto-approve`
7. **Save**

**View logs in Windows**:
```powershell
wsl cat /home/sysadmin/nextjs/fossapp/audits/audit.log
```

---

## ✅ Verification

Check if automation is working:

```bash
# Test manual audit
./scripts/run-gemini-audit.sh --auto-approve

# Check output
ls -lh audits/*_GEMINI_AUDIT.md

# View latest audit
cat $(ls -t audits/*_GEMINI_AUDIT.md | head -1)
```

---

## 📚 Full Documentation

See `audits/README.md` for complete documentation.
