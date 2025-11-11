#!/bin/bash

# Schedule Gemini Security Audit
# Usage: ./scripts/schedule-audit.sh [weekly|daily|monthly]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCHEDULE="${1:-weekly}"

echo -e "${BLUE}⏰ Setting up scheduled Gemini audits${NC}"
echo ""

# Check if cron is available
if ! command -v crontab &> /dev/null; then
    echo -e "${YELLOW}⚠️  cron not available in WSL${NC}"
    echo ""
    echo "Alternative options:"
    echo ""
    echo "1. Use Windows Task Scheduler:"
    echo "   - Open Task Scheduler"
    echo "   - Create Basic Task"
    echo "   - Action: Start a program"
    echo "   - Program: wsl.exe"
    echo "   - Arguments: bash $PROJECT_ROOT/scripts/run-gemini-audit.sh --auto-approve"
    echo ""
    echo "2. Manual execution:"
    echo "   cd $PROJECT_ROOT"
    echo "   ./scripts/run-gemini-audit.sh"
    echo ""
    exit 1
fi

# Create cron job based on schedule
case "$SCHEDULE" in
    daily)
        CRON_TIME="0 2 * * *"  # 2 AM daily
        DESCRIPTION="Daily at 2 AM"
        ;;
    weekly)
        CRON_TIME="0 2 * * 1"  # 2 AM every Monday
        DESCRIPTION="Weekly on Monday at 2 AM"
        ;;
    monthly)
        CRON_TIME="0 2 1 * *"  # 2 AM on 1st of month
        DESCRIPTION="Monthly on 1st at 2 AM"
        ;;
    *)
        echo "Usage: $0 [weekly|daily|monthly]"
        exit 1
        ;;
esac

CRON_JOB="$CRON_TIME cd $PROJECT_ROOT && ./scripts/run-gemini-audit.sh --auto-approve >> $PROJECT_ROOT/audits/audit.log 2>&1"

echo -e "${GREEN}📅 Schedule:${NC} $DESCRIPTION"
echo -e "${GREEN}📍 Command:${NC} $CRON_JOB"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "run-gemini-audit.sh"; then
    echo -e "${YELLOW}⚠️  Existing audit cron job found${NC}"
    echo ""
    crontab -l | grep "run-gemini-audit.sh"
    echo ""
    read -p "Replace existing job? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    # Remove old job
    crontab -l | grep -v "run-gemini-audit.sh" | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✅ Scheduled audit created!${NC}"
echo ""
echo -e "${BLUE}📋 Current cron jobs:${NC}"
crontab -l | grep "run-gemini-audit.sh"
echo ""
echo -e "${BLUE}📝 Log file:${NC} $PROJECT_ROOT/audits/audit.log"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "   - View logs: tail -f $PROJECT_ROOT/audits/audit.log"
echo "   - List cron jobs: crontab -l"
echo "   - Remove schedule: crontab -e (delete the audit line)"
echo "   - Run manual audit: ./scripts/run-gemini-audit.sh"
echo ""
