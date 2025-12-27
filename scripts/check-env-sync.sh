#!/bin/bash
# check-env-sync.sh - Compare environment variables between local and production
#
# This script helps ensure all required environment variables are synchronized
# between development and production environments.
#
# Usage:
#   ./scripts/check-env-sync.sh              # Compare local vs production
#   ./scripts/check-env-sync.sh --local-only # Just check local .env.local
#   ./scripts/check-env-sync.sh --generate   # Regenerate .env.example from schema
#
# Required env vars are defined in: src/lib/env-schema.ts

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# SSH config for production
SSH_KEY="$HOME/.ssh/platon.key"
SSH_HOST="sysadmin@platon.titancnc.eu"
REMOTE_ENV="/opt/fossapp/.env.production"

# Local env file
LOCAL_ENV="$PROJECT_DIR/.env.local"

echo "================================================"
echo "  FOSSAPP Environment Variable Sync Check"
echo "================================================"
echo ""

# Required environment variables (from env-schema.ts)
# Keep this in sync with the schema!
REQUIRED_VARS=(
  "NEXTAUTH_URL"
  "NEXTAUTH_SECRET"
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "GOOGLE_DRIVE_HUB_ID"
  "GOOGLE_DRIVE_PROJECTS_FOLDER_ID"
  "APS_CLIENT_ID"
  "APS_CLIENT_SECRET"
  "OPENROUTER_API_KEY"
  "FEEDBACK_CHAT_OPENROUTER_KEY"
)

# Optional but recommended variables
OPTIONAL_VARS=(
  "ALLOWED_DOMAIN"
  "NEXT_PUBLIC_TILES_EXPLORER_PATH"
  "APS_REGION"
  "APS_NICKNAME"
  "APS_ACTIVITY_NAME"
  "APS_BUNDLE_NAME"
  "FEEDBACK_CHAT_MODEL"
  "FEEDBACK_CHAT_MAX_TOKENS"
  "RESEND_API_KEY"
  "FEEDBACK_NOTIFICATION_EMAILS"
)

# Function to check if a variable is set in a file
var_exists_in_file() {
  local var_name="$1"
  local file_path="$2"

  if [ ! -f "$file_path" ]; then
    return 1
  fi

  # Check if variable is defined (not commented out, has a value)
  grep -q "^${var_name}=.\+" "$file_path" 2>/dev/null
}

# Function to check variables in a file
check_vars_in_file() {
  local file_path="$1"
  local file_name="$2"
  local missing_required=()
  local missing_optional=()

  echo -e "${BLUE}Checking ${file_name}...${NC}"

  if [ ! -f "$file_path" ]; then
    echo -e "  ${RED}File not found: $file_path${NC}"
    return 1
  fi

  # Check required vars
  for var in "${REQUIRED_VARS[@]}"; do
    if ! var_exists_in_file "$var" "$file_path"; then
      missing_required+=("$var")
    fi
  done

  # Check optional vars
  for var in "${OPTIONAL_VARS[@]}"; do
    if ! var_exists_in_file "$var" "$file_path"; then
      missing_optional+=("$var")
    fi
  done

  # Report
  if [ ${#missing_required[@]} -eq 0 ]; then
    echo -e "  ${GREEN}✓ All required variables present${NC}"
  else
    echo -e "  ${RED}✗ Missing REQUIRED variables:${NC}"
    for var in "${missing_required[@]}"; do
      echo -e "    ${RED}• $var${NC}"
    done
  fi

  if [ ${#missing_optional[@]} -gt 0 ]; then
    echo -e "  ${YELLOW}⚠ Missing optional variables:${NC}"
    for var in "${missing_optional[@]}"; do
      echo -e "    ${YELLOW}• $var${NC}"
    done
  fi

  echo ""

  # Return error if required vars are missing
  [ ${#missing_required[@]} -eq 0 ]
}

# Function to fetch and check production env
check_production() {
  echo -e "${BLUE}Fetching production environment...${NC}"

  # Check SSH key exists
  if [ ! -f "$SSH_KEY" ]; then
    echo -e "${RED}SSH key not found: $SSH_KEY${NC}"
    echo "Cannot check production environment."
    return 1
  fi

  # Fetch production env file
  TEMP_FILE=$(mktemp)
  if ssh -i "$SSH_KEY" "$SSH_HOST" "cat $REMOTE_ENV" > "$TEMP_FILE" 2>/dev/null; then
    check_vars_in_file "$TEMP_FILE" "Production ($REMOTE_ENV)"
    local result=$?
    rm -f "$TEMP_FILE"
    return $result
  else
    echo -e "${RED}Failed to fetch production environment${NC}"
    rm -f "$TEMP_FILE"
    return 1
  fi
}

# Function to compare local and production
compare_envs() {
  echo -e "${BLUE}Comparing local and production environments...${NC}"
  echo ""

  # Get all var names from local
  local local_vars=()
  while IFS= read -r line; do
    if [[ "$line" =~ ^[A-Z_]+=.+ ]]; then
      local_vars+=("${line%%=*}")
    fi
  done < "$LOCAL_ENV"

  # Fetch production vars
  TEMP_FILE=$(mktemp)
  if ! ssh -i "$SSH_KEY" "$SSH_HOST" "cat $REMOTE_ENV" > "$TEMP_FILE" 2>/dev/null; then
    echo -e "${RED}Failed to fetch production environment${NC}"
    rm -f "$TEMP_FILE"
    return 1
  fi

  local prod_vars=()
  while IFS= read -r line; do
    if [[ "$line" =~ ^[A-Z_]+=.+ ]]; then
      prod_vars+=("${line%%=*}")
    fi
  done < "$TEMP_FILE"

  # Find vars in local but not in production
  echo -e "${YELLOW}Variables in LOCAL but not in PRODUCTION:${NC}"
  local local_only=()
  for var in "${local_vars[@]}"; do
    if ! printf '%s\n' "${prod_vars[@]}" | grep -qx "$var"; then
      local_only+=("$var")
      echo -e "  ${YELLOW}• $var${NC}"
    fi
  done
  if [ ${#local_only[@]} -eq 0 ]; then
    echo -e "  ${GREEN}(none)${NC}"
  fi
  echo ""

  # Find vars in production but not in local
  echo -e "${BLUE}Variables in PRODUCTION but not in LOCAL:${NC}"
  local prod_only=()
  for var in "${prod_vars[@]}"; do
    if ! printf '%s\n' "${local_vars[@]}" | grep -qx "$var"; then
      prod_only+=("$var")
      echo -e "  ${BLUE}• $var${NC}"
    fi
  done
  if [ ${#prod_only[@]} -eq 0 ]; then
    echo -e "  ${GREEN}(none)${NC}"
  fi
  echo ""

  rm -f "$TEMP_FILE"

  # Report action needed
  if [ ${#local_only[@]} -gt 0 ]; then
    echo -e "${YELLOW}ACTION NEEDED: Add these variables to production:${NC}"
    for var in "${local_only[@]}"; do
      # Check if it's a required var
      if printf '%s\n' "${REQUIRED_VARS[@]}" | grep -qx "$var"; then
        echo -e "  ${RED}[REQUIRED]${NC} $var"
      else
        echo -e "  ${YELLOW}[optional]${NC} $var"
      fi
    done
    echo ""
    echo "To add to production:"
    echo "  ssh -i $SSH_KEY $SSH_HOST"
    echo "  nano $REMOTE_ENV"
    echo "  cd /opt/fossapp && docker compose down && docker compose up -d"
    echo ""
  fi
}

# Main script logic
case "${1:-}" in
  --local-only)
    check_vars_in_file "$LOCAL_ENV" "Local (.env.local)"
    ;;
  --generate)
    echo "Generating .env.example from schema..."
    # This would require running a Node.js script
    cd "$PROJECT_DIR"
    npx tsx -e "
      import { generateEnvExample } from './src/lib/env-schema';
      console.log(generateEnvExample());
    " > "$PROJECT_DIR/.env.example"
    echo -e "${GREEN}✓ Generated .env.example${NC}"
    ;;
  --help|-h)
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --local-only   Only check local .env.local"
    echo "  --generate     Regenerate .env.example from schema"
    echo "  --help         Show this help"
    echo ""
    echo "Default: Compare local and production environments"
    ;;
  *)
    # Default: full comparison
    LOCAL_OK=true
    PROD_OK=true

    check_vars_in_file "$LOCAL_ENV" "Local (.env.local)" || LOCAL_OK=false
    check_production || PROD_OK=false

    echo "================================================"

    if $LOCAL_OK && $PROD_OK; then
      echo -e "${GREEN}✅ Both environments have all required variables${NC}"
      compare_envs
    else
      echo -e "${RED}❌ Environment sync issues detected${NC}"
      compare_envs
      exit 1
    fi
    ;;
esac
