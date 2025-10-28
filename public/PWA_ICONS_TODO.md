# PWA Icons TODO

## Current Status
PWA is configured but needs proper app icons generated.

## Required Icons
- icon-192x192.png (Android, Chrome)
- icon-384x384.png (Android)
- icon-512x512.png (Android, Chrome, Desktop)
- apple-touch-icon.png (iOS, 180x180)

## How to Generate Icons

### Option 1: Use Logo SVG
Convert `logo.svg` and `logo-dark.svg` to PNG at required sizes:
```bash
# Using ImageMagick or similar tool
convert -background none -resize 192x192 logo.svg icon-192x192.png
convert -background none -resize 384x384 logo.svg icon-384x384.png
convert -background none -resize 512x512 logo.svg icon-512x512.png
convert -background none -resize 180x180 logo.svg apple-touch-icon.png
```

### Option 2: Use Online Tool
1. Visit: https://realfavicongenerator.net
2. Upload logo.svg
3. Download generated icons
4. Place in /public folder

### Option 3: Use PWA Asset Generator
```bash
npm install -g pwa-asset-generator
pwa-asset-generator logo.svg ./public --icon-only
```

## Temporary Setup
Until proper icons are generated:
- App will use default browser icon
- PWA install will still work
- Functionality not affected

## Favicon
Also consider generating favicon.ico for browser tab icon.
