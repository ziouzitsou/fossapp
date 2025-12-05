#!/bin/bash
set -e

VERSION=${1:-main}
DEPLOY_DIR="/opt/fossapp"

echo "🚀 Deploying FOSSAPP $VERSION"

cd $DEPLOY_DIR

# Fetch latest from git
echo "📥 Fetching updates from GitHub..."
git fetch --all --tags

# Checkout and pull latest
echo "🔄 Checking out $VERSION..."
if [[ "$VERSION" == "main" || "$VERSION" == "master" ]]; then
    git checkout $VERSION
    git pull origin $VERSION
    echo "📦 Pulled latest from origin/$VERSION"
else
    # For tags, just checkout (no pull needed)
    git checkout $VERSION
    echo "📦 Checked out tag $VERSION"
fi

# Stop existing container
echo "🛑 Stopping existing container..."
docker compose down || true

# Build and start
echo "🔨 Building Docker image..."
docker compose build

echo "▶️  Starting container..."
docker compose up -d

# Wait and health check
echo "⏳ Waiting for health check (30 seconds)..."
sleep 30

if curl -f http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ Deployment successful: $VERSION"
    echo "🌐 App running at https://main.fossapp.online"
    # Show deployed commit
    echo "📌 Deployed commit: $(git log -1 --oneline)"
else
    echo "❌ Health check failed!"
    echo "📋 Check logs: docker compose logs -f"
    exit 1
fi

# Cleanup old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -f

echo "✨ Done!"
