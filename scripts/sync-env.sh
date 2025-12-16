#!/bin/bash
# sync-env.sh - Sync environment files to production server
#
# Usage:
#   ./scripts/sync-env.sh           # Sync .env.production to server
#   ./scripts/sync-env.sh --diff    # Show diff without syncing
#   ./scripts/sync-env.sh --pull    # Pull production env to local
#
# TODO: Future versions should use git-crypt for encrypted secrets in repo
#       See: https://github.com/AGWA/git-crypt
#
# Security Note:
#   This script syncs secrets over SSH. Never commit .env files to git.
#   Keep secrets out of version control even in private repos.

set -e

SERVER="sysadmin@platon.titancnc.eu"
SSH_KEY="$HOME/.ssh/platon.key"
REMOTE_DIR="/opt/fossapp"
LOCAL_ENV=".env.production"
REMOTE_ENV="$REMOTE_DIR/.env.production"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check SSH key exists
if [[ ! -f "$SSH_KEY" ]]; then
    echo -e "${RED}Error: SSH key not found at $SSH_KEY${NC}"
    exit 1
fi

# Check local .env.production exists
if [[ ! -f "$LOCAL_ENV" && "$1" != "--pull" ]]; then
    echo -e "${RED}Error: $LOCAL_ENV not found${NC}"
    echo "Create it first or use --pull to fetch from production"
    exit 1
fi

case "$1" in
    --diff)
        echo -e "${YELLOW}Comparing local vs production .env.production...${NC}"
        echo ""

        # Get remote file
        REMOTE_CONTENT=$(ssh -i "$SSH_KEY" "$SERVER" "cat $REMOTE_ENV" 2>/dev/null)

        # Compare (hide actual values, show only keys that differ)
        echo "Keys in local but not in production:"
        comm -23 <(grep -E "^[A-Z_]+=" "$LOCAL_ENV" | cut -d= -f1 | sort) \
                 <(echo "$REMOTE_CONTENT" | grep -E "^[A-Z_]+=" | cut -d= -f1 | sort) || echo "  (none)"

        echo ""
        echo "Keys in production but not in local:"
        comm -13 <(grep -E "^[A-Z_]+=" "$LOCAL_ENV" | cut -d= -f1 | sort) \
                 <(echo "$REMOTE_CONTENT" | grep -E "^[A-Z_]+=" | cut -d= -f1 | sort) || echo "  (none)"

        echo ""
        echo "Keys with different values:"
        while IFS='=' read -r key value; do
            [[ -z "$key" || "$key" =~ ^# ]] && continue
            remote_value=$(echo "$REMOTE_CONTENT" | grep "^$key=" | cut -d= -f2-)
            if [[ "$value" != "$remote_value" && -n "$remote_value" ]]; then
                echo "  $key"
            fi
        done < "$LOCAL_ENV"
        ;;

    --pull)
        echo -e "${YELLOW}Pulling .env.production from production...${NC}"
        scp -i "$SSH_KEY" "$SERVER:$REMOTE_ENV" "$LOCAL_ENV"
        echo -e "${GREEN}✓ Downloaded to $LOCAL_ENV${NC}"
        ;;

    "")
        echo -e "${YELLOW}Syncing .env.production to production server...${NC}"

        # Backup remote file first
        BACKUP_NAME=".env.production.backup-$(date +%Y%m%d-%H%M%S)"
        ssh -i "$SSH_KEY" "$SERVER" "cp $REMOTE_ENV $REMOTE_DIR/$BACKUP_NAME" 2>/dev/null || true

        # Copy local to remote
        scp -i "$SSH_KEY" "$LOCAL_ENV" "$SERVER:$REMOTE_ENV"

        echo -e "${GREEN}✓ Synced $LOCAL_ENV to production${NC}"
        echo -e "${YELLOW}Note: Restart the container to apply changes:${NC}"
        echo "  ssh -i $SSH_KEY $SERVER 'cd $REMOTE_DIR && docker compose restart fossapp'"
        ;;

    *)
        echo "Usage: $0 [--diff|--pull]"
        echo ""
        echo "Options:"
        echo "  (none)    Sync local .env.production to server"
        echo "  --diff    Compare local and production (keys only)"
        echo "  --pull    Download production env to local"
        exit 1
        ;;
esac
