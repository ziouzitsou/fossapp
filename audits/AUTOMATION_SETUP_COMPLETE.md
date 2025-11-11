# Gemini Audit Automation - Setup Complete ✅

**Setup Date**: 2025-11-11
**Status**: Ready to use

---

## 📦 What Was Installed

### 1. Automation Scripts (`scripts/`)

#### `run-gemini-audit.sh` (Main audit script)
- **Purpose**: Run Gemini security audit on demand
- **Features**:
  - Interactive or auto-approve mode
  - Comprehensive security analysis
  - Formatted markdown reports
  - Quick summary of findings
  - Alert for critical/high severity issues
- **Usage**:
  ```bash
  ./scripts/run-gemini-audit.sh              # Interactive
  ./scripts/run-gemini-audit.sh --auto-approve  # Automated
  ```

#### `pre-deploy-audit.sh` (Deployment gate)
- **Purpose**: Security check before production deployment
- **Features**:
  - Runs deployment checks first
  - Automated security audit
  - **Blocks deployment** if critical/high issues found
  - Returns exit code for CI/CD
- **Usage**:
  ```bash
  ./scripts/pre-deploy-audit.sh
  ```

#### `schedule-audit.sh` (Scheduled automation)
- **Purpose**: Set up recurring security audits
- **Features**:
  - Weekly/daily/monthly schedules
  - Cron job management
  - Windows Task Scheduler guide
- **Usage**:
  ```bash
  ./scripts/schedule-audit.sh weekly   # Recommended
  ./scripts/schedule-audit.sh daily    # High security
  ./scripts/schedule-audit.sh monthly  # Stable projects
  ```

### 2. Documentation (`audits/`)

#### `README.md` (Updated)
- Complete automation guide
- Use cases and examples
- Troubleshooting section
- Best practices

#### `AUTOMATION_QUICK_START.md` (New)
- Quick reference commands
- Common workflows
- Severity response guide
- Windows Task Scheduler setup

#### `AUTOMATION_SETUP_COMPLETE.md` (This file)
- Setup summary
- Testing instructions
- Integration examples

---

## 🧪 Testing the Setup

### Test 1: Manual Audit (Dry Run)
```bash
cd /home/sysadmin/nextjs/fossapp

# Run a test audit
./scripts/run-gemini-audit.sh --auto-approve

# Expected output:
# 🔍 Starting Gemini Security Audit
# 📅 Date: ...
# 📂 Files included in audit:
# ...
# ✅ Audit completed successfully!
# 📄 Audit report saved to: audits/YYYYMMDD_HHMMSS_GEMINI_AUDIT.md
```

### Test 2: View Generated Report
```bash
# List audit reports
ls -lth audits/*_GEMINI_AUDIT.md | head -5

# View latest audit
cat $(ls -t audits/*_GEMINI_AUDIT.md | head -1)
```

### Test 3: Pre-Deployment Check
```bash
# Test deployment gate
./scripts/pre-deploy-audit.sh

# Expected behavior:
# - Runs deploy-check.sh first
# - Runs security audit
# - Blocks if critical/high issues found
# - Allows if only medium/low issues
```

---

## 🔗 Integration Examples

### Integration 1: Manual Pre-Release Check
```bash
# Before bumping version
npm run build && \
./scripts/pre-deploy-audit.sh && \
npm version patch && \
git push origin main --tags
```

### Integration 2: Weekly Automated Audits
```bash
# Set up weekly Monday 2 AM audits
./scripts/schedule-audit.sh weekly

# View scheduled job
crontab -l | grep gemini-audit

# View audit logs
tail -f audits/audit.log
```

### Integration 3: Windows Task Scheduler (WSL)
Since WSL may not support cron reliably:

1. Open **Windows Task Scheduler**
2. **Create Basic Task**
3. **Name**: "FOSSAPP Weekly Security Audit"
4. **Trigger**: Weekly, Monday, 2:00 AM
5. **Action**: Start a program
   - **Program**: `wsl.exe`
   - **Arguments**: `bash /home/sysadmin/nextjs/fossapp/scripts/run-gemini-audit.sh --auto-approve`
6. **Settings**:
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges
7. **Save**

**Test the task**:
```powershell
# In Windows PowerShell
wsl bash /home/sysadmin/nextjs/fossapp/scripts/run-gemini-audit.sh --auto-approve

# View results
wsl cat /home/sysadmin/nextjs/fossapp/audits/audit.log
```

### Integration 4: GitHub Actions (Future)
Create `.github/workflows/security-audit.yml`:
```yaml
name: Security Audit

on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Gemini CLI
        run: |
          # Install Gemini CLI
          # (add installation steps)

      - name: Run Security Audit
        run: ./scripts/pre-deploy-audit.sh

      - name: Upload Audit Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-audit
          path: audits/*_GEMINI_AUDIT.md
```

---

## 📊 Monitoring and Maintenance

### Daily/Weekly Checks
```bash
# View latest audit results
cat $(ls -t audits/*_GEMINI_AUDIT.md | head -1) | grep -A 20 "Summary of Findings"

# Count total audits
ls audits/*_GEMINI_AUDIT.md | wc -l

# Check for recent critical issues
grep -l "^| Critical" audits/*_GEMINI_AUDIT.md | tail -5
```

### Audit History
```bash
# List all audits chronologically
ls -lth audits/*_GEMINI_AUDIT.md

# Compare two audits
diff audits/20251111_GEMINI_AUDIT.md audits/YYYYMMDD_GEMINI_AUDIT.md
```

### Log Management
```bash
# View audit execution logs
tail -n 100 audits/audit.log

# Check for failures
grep -i "failed\|error" audits/audit.log

# Rotate logs (if too large)
mv audits/audit.log audits/audit.log.old
touch audits/audit.log
```

---

## 🎯 Recommended Workflow

### For Regular Development
1. **Code changes** → Make your changes
2. **Pre-commit** → Run build and tests
3. **Before PR** → Run security audit
   ```bash
   ./scripts/run-gemini-audit.sh --auto-approve
   ```
4. **Review findings** → Address critical/high issues
5. **Create PR** → With clean audit

### For Production Releases
1. **Feature complete** → All features implemented
2. **Tests pass** → `npm run build && npm test`
3. **Security audit** → `./scripts/pre-deploy-audit.sh`
4. **If audit passes**:
   ```bash
   npm version patch  # or minor/major
   git push origin main --tags
   ```
5. **Deploy** → Use production-deployer agent
6. **Verify** → Check health endpoint

### For Scheduled Maintenance
- **Weekly**: Automated audit runs Monday 2 AM
- **Review**: Check audit results Wednesday morning
- **Address**: Fix any new issues found
- **Document**: Update response files

---

## 🛠️ Customization

### Modify Audit Prompt
Edit `scripts/run-gemini-audit.sh` line 25 (AUDIT_PROMPT):
```bash
# Add custom focus areas
AUDIT_PROMPT=$(cat <<'EOF'
... your custom audit instructions ...
EOF
)
```

### Adjust File Scope
Edit `scripts/run-gemini-audit.sh` line 67 (FILES_TO_AUDIT):
```bash
FILES_TO_AUDIT=(
    "src/app/api/auth/[...nextauth]/route.ts"
    # Add more files here
)
```

### Change Schedule
```bash
# Edit cron schedule in schedule-audit.sh
CRON_TIME="0 2 * * 1"  # Current: Monday 2 AM

# Examples:
# Daily 3 AM:    "0 3 * * *"
# Friday 6 PM:   "0 18 * * 5"
# 1st of month:  "0 2 1 * *"
```

---

## 📚 Documentation Reference

- **Quick Start**: `audits/AUTOMATION_QUICK_START.md`
- **Full Guide**: `audits/README.md`
- **Setup Summary**: `audits/AUTOMATION_SETUP_COMPLETE.md` (this file)
- **Example Response**: `audits/20251111_CLAUDE_RESPONSE.md`
- **Example Audit**: `audits/20251111_GEMINI_AUDIT.md`

---

## ✅ Verification Checklist

- [x] Scripts created in `scripts/`
- [x] Scripts are executable (`chmod +x`)
- [x] Documentation updated in `audits/`
- [x] Quick start guide created
- [x] Examples provided
- [ ] **TODO**: Run test audit (`./scripts/run-gemini-audit.sh --auto-approve`)
- [ ] **TODO**: Review test results
- [ ] **TODO**: Schedule weekly audits (Windows Task Scheduler recommended)
- [ ] **TODO**: Add to deployment checklist

---

## 🚀 Next Steps

1. **Test the automation**:
   ```bash
   cd /home/sysadmin/nextjs/fossapp
   ./scripts/run-gemini-audit.sh --auto-approve
   ```

2. **Review the test audit**:
   ```bash
   cat $(ls -t audits/*_GEMINI_AUDIT.md | head -1)
   ```

3. **Set up weekly audits**:
   - Windows Task Scheduler (recommended for WSL)
   - Or cron: `./scripts/schedule-audit.sh weekly`

4. **Integrate with deployment**:
   - Update `scripts/deploy-check.sh` to call `pre-deploy-audit.sh`
   - Or run manually before each release

5. **Create response template**:
   - Copy `audits/20251111_CLAUDE_RESPONSE.md`
   - Customize for your workflow

---

## 🎓 Learning Resources

- **Gemini CLI**: `gemini --help`
- **Previous Audits**: `audits/20251111_GEMINI_AUDIT.md`
- **Response Format**: `audits/20251111_CLAUDE_RESPONSE.md`
- **Process**: `audits/README.md` (Audit Process section)

---

**Status**: ✅ Setup Complete - Ready to use!

**Feedback**: If you encounter any issues or have suggestions, document them in this file.
