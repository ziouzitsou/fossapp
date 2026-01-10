---
name: dev-server
description: Manage the FOSSAPP development server. Stop, start, restart, clean caches, or check status. Use when dev server is stalled or needs a fresh start.
user_invocable: true
arguments: "[action] - stop|start|restart|status|clean|nuke (default: status)"
---

# Dev Server Management for FOSSAPP

Manage the Next.js development server running on port 8080.

---

## Actions

Execute the action specified in the arguments. If no action provided, default to `status`.

### `status` (default)

Check if dev server is running:

```bash
# Check port 8080
lsof -i :8080 2>/dev/null || echo "Dev server is not running"

# Check for any node processes running npm dev
pgrep -af "npm.*dev" || echo "No npm dev processes found"
```

### `stop`

Stop the dev server gracefully, then forcefully if needed:

```bash
# 1. Find process on port 8080 using multiple methods (lsof may miss some)
PORT_PID=$(lsof -t -i :8080 2>/dev/null)

# Fallback: use ss to find PID if lsof missed it
if [ -z "$PORT_PID" ]; then
    PORT_PID=$(ss -tlnp 2>/dev/null | grep ':8080' | grep -oP 'pid=\K\d+')
fi

if [ -n "$PORT_PID" ]; then
    echo "Stopping dev server (PID: $PORT_PID)..."
    kill -TERM $PORT_PID 2>/dev/null
    sleep 2
    # Force kill if still running
    if kill -0 $PORT_PID 2>/dev/null; then
        echo "Force killing..."
        kill -9 $PORT_PID 2>/dev/null
    fi
    echo "Dev server stopped."
else
    echo "No process found on port 8080."
fi

# 2. Kill any lingering Turbopack/node processes from npm dev
pkill -f "npm run dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "turbopack" 2>/dev/null
pkill -f "next-router-worker" 2>/dev/null
```

### `start`

Start the dev server in background:

```bash
cd /home/sysadmin/nextjs/fossapp

# First ensure nothing is on port 8080
if lsof -i :8080 >/dev/null 2>&1; then
    echo "Port 8080 is already in use. Run 'stop' first."
    exit 1
fi

# Start in background
npm run dev
```

**Note:** Use Bash tool with `run_in_background: true` for this action.

### `restart`

Stop then start:

```bash
# Execute stop action first, then start action
```

### `clean`

Clean all development caches:

```bash
cd /home/sysadmin/nextjs/fossapp

echo "Cleaning caches..."

# Next.js cache
rm -rf .next
echo "✓ Removed .next/"

# Turbo cache
rm -rf .turbo
echo "✓ Removed .turbo/"

# Node modules cache
rm -rf node_modules/.cache
echo "✓ Removed node_modules/.cache/"

# ESLint cache
rm -f .eslintcache
echo "✓ Removed .eslintcache"

# TypeScript build info
rm -f tsconfig.tsbuildinfo
rm -f packages/*/tsconfig.tsbuildinfo
echo "✓ Removed TypeScript build info"

echo ""
echo "Cache cleanup complete!"
```

### `nuke`

Nuclear option - full clean including node_modules reinstall:

```bash
cd /home/sysadmin/nextjs/fossapp

echo "⚠️  NUKE: Full clean and reinstall..."

# 1. Stop any running server
PORT_PID=$(lsof -t -i :8080 2>/dev/null)
if [ -n "$PORT_PID" ]; then
    kill -9 $PORT_PID 2>/dev/null
fi
pkill -f "turbopack" 2>/dev/null
pkill -f "next-router-worker" 2>/dev/null

# 2. Clean all caches
rm -rf .next .turbo node_modules/.cache .eslintcache
rm -f tsconfig.tsbuildinfo packages/*/tsconfig.tsbuildinfo

# 3. Reinstall dependencies
echo "Reinstalling dependencies..."
rm -rf node_modules packages/*/node_modules
npm install

echo ""
echo "Nuke complete! Run '/dev start' to start fresh."
```

**Warning:** This takes 30-60 seconds due to npm install.

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `/dev` | Check status (default) |
| `/dev status` | Check if server is running |
| `/dev stop` | Stop the dev server |
| `/dev start` | Start dev server in background |
| `/dev restart` | Stop + start |
| `/dev clean` | Clean all caches |
| `/dev nuke` | Full clean + reinstall + stop (nuclear) |

---

## Common Issues

### Server Stalled After Exiting Claude Code

When Claude Code exits, background processes may become orphaned. Use:

```bash
/dev stop
/dev clean
/dev start
```

### Port 8080 Already In Use

```bash
# Check what's using it
lsof -i :8080

# Kill it
/dev stop
```

### Turbopack Workers Lingering

```bash
# These can consume CPU even after server stops
pkill -f "turbopack"
pkill -f "next-router-worker"
```

### Build Errors After Pulling New Code

```bash
/dev nuke  # Full reinstall
```

---

## Technical Details

- **Port:** 8080 (configured in package.json)
- **Framework:** Next.js 16 with Turbopack
- **Monorepo:** Turborepo (caches in .turbo/)
- **Cache locations:**
  - `.next/` - Next.js build cache
  - `.turbo/` - Turborepo cache
  - `node_modules/.cache/` - Various tool caches
  - `.eslintcache` - ESLint cache
  - `*.tsbuildinfo` - TypeScript incremental build
