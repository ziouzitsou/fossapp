#!/bin/bash
#
# Build and push FOSSAPP image to DigitalOcean Container Registry
#
# Usage:
#   ./scripts/docker-push.sh          # Push as :latest and :v{version}
#   ./scripts/docker-push.sh v1.12.5  # Push with specific tag
#

set -e

REGISTRY="registry.digitalocean.com/fossapp"
IMAGE_NAME="fossapp"

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Use provided tag or default to version
TAG=${1:-"v$VERSION"}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FOSSAPP Docker Push"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Registry: $REGISTRY"
echo "  Version:  $VERSION"
echo "  Tag:      $TAG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Build the image
echo "🔨 Building image..."
docker build -t $REGISTRY/$IMAGE_NAME:$TAG -t $REGISTRY/$IMAGE_NAME:latest .

# Push both tags
echo ""
echo "📤 Pushing $TAG..."
docker push $REGISTRY/$IMAGE_NAME:$TAG

echo ""
echo "📤 Pushing latest..."
docker push $REGISTRY/$IMAGE_NAME:latest

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Done! Images pushed:"
echo "     $REGISTRY/$IMAGE_NAME:$TAG"
echo "     $REGISTRY/$IMAGE_NAME:latest"
echo ""
echo "  Deploy on production:"
echo "     ssh platon 'cd /opt/fossapp && docker compose pull && docker compose up -d'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
